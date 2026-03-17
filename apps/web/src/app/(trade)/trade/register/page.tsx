'use client'

import { useState } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseUnits } from 'viem'
import { useRouter } from 'next/navigation'
import { ChevronRight, Lock, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PLATFORM_CONTRACTS, TIP20_DECIMALS } from '@/lib/tempo'

const STEPS = ['Details', 'Economics', 'Bond & Register', 'Done'] as const
type Step = 0 | 1 | 2 | 3

// Minimal ABIs for contract calls
const STAKING_ABI = [
  {
    name: 'postBond',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'requiredBond',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

const TIP20_APPROVE_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

const REGISTRY_ABI = [
  {
    name: 'registerAgent',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'metadataUri', type: 'string' },
      { name: 'codeHash', type: 'bytes32' },
      { name: 'creatorFeeBps', type: 'uint32' },
      { name: 'bondAmount', type: 'uint256' },
      { name: 'supplyCap', type: 'uint256' },
    ],
    outputs: [{ name: 'agentId', type: 'uint256' }],
  },
] as const

const REQUIRED_BOND = parseUnits('200', TIP20_DECIMALS) // $200 USDC

export default function RegisterAgentPage(): React.ReactElement {
  const { address } = useAccount()
  const router = useRouter()
  const [step, setStep] = useState<Step>(0)

  // Form state
  const [name, setName] = useState('')
  const [ticker, setTicker] = useState('')
  const [description, setDescription] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [codeHash, setCodeHash] = useState('')
  const [supplyCap, setSupplyCap] = useState(100_000_000) // 100M default
  const [creatorFeePct, setCreatorFeePct] = useState(2) // 2% default

  const [txStatus, setTxStatus] = useState<'idle' | 'approving' | 'bonding' | 'registering' | 'recording' | 'done'>('idle')
  const [error, setError] = useState('')
  const [createdAgentId, setCreatedAgentId] = useState<string>('')

  const { writeContractAsync } = useWriteContract()
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>()
  const { isLoading: isTxPending } = useWaitForTransactionReceipt({ hash: txHash })

  const isLoading = txStatus !== 'idle' && txStatus !== 'done' || isTxPending

  const stakingAddress = PLATFORM_CONTRACTS.STAKING_AND_SLASHING as `0x${string}`
  const registryAddress = PLATFORM_CONTRACTS.TRADE_AGENT_REGISTRY as `0x${string}`
  const payToken = PLATFORM_CONTRACTS.DEFAULT_PAYMENT_TOKEN

  async function handleRegister(): Promise<void> {
    if (!address) return
    setError('')
    try {
      // Step 1: Approve bond token
      setTxStatus('approving')
      await writeContractAsync({
        address: payToken,
        abi: TIP20_APPROVE_ABI,
        functionName: 'approve',
        args: [stakingAddress, REQUIRED_BOND],
      })

      // Step 2: Post bond
      setTxStatus('bonding')
      await writeContractAsync({
        address: stakingAddress,
        abi: STAKING_ABI,
        functionName: 'postBond',
        args: [],
      })

      // Step 3: Register agent on-chain
      setTxStatus('registering')
      const supplyCapWei = BigInt(supplyCap) * BigInt(1e18)
      const creatorFeeBps = Math.round(creatorFeePct * 100)
      const metadataUri = `ipfs://placeholder-${Date.now()}`
      const codeHashBytes: `0x${string}` = codeHash
        ? `0x${Buffer.from(codeHash).toString('hex').padEnd(64, '0').slice(0, 64)}`
        : `0x${'0'.repeat(64)}`

      const registerTx = await writeContractAsync({
        address: registryAddress,
        abi: REGISTRY_ABI,
        functionName: 'registerAgent',
        args: [metadataUri, codeHashBytes, creatorFeeBps, REQUIRED_BOND, supplyCapWei],
      })
      setTxHash(registerTx)

      // Step 4: Record in DB
      setTxStatus('recording')
      // In production: parse AgentRegistered event for agentId
      const onChainAgentId = Math.floor(Math.random() * 10000) // placeholder, parse from event

      const res = await fetch('/api/trade/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          onChainAgentId,
          creator: address,
          metadataUri,
          codeHash: codeHash || 'placeholder',
          name,
          symbol: ticker.toUpperCase(),
          description,
          imageUrl: imageUrl || undefined,
          supplyCap: supplyCapWei.toString(),
          bondAmount: REQUIRED_BOND.toString(),
          creatorFeeBps,
          txHash: registerTx,
        }),
      })

      const json = await res.json() as { agent?: { id: string } }
      if (json.agent?.id) setCreatedAgentId(json.agent.id)

      setTxStatus('done')
      setStep(3)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Transaction failed'
      setError(msg.includes('User rejected') ? 'Transaction cancelled.' : msg.slice(0, 120))
      setTxStatus('idle')
    }
  }

  const txStepLabels: Record<typeof txStatus, string> = {
    idle:       'Register Agent',
    approving:  'Approving bond ($200)...',
    bonding:    'Posting bond...',
    registering:'Registering on-chain...',
    recording:  'Recording...',
    done:       'Done!',
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Register Agent for Trading</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create a tradeable AI agent with its own bonding curve market.
        </p>
      </div>

      {/* Step indicator */}
      <div className="mb-8 flex items-center gap-2">
        {STEPS.map((label, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
              i < step ? 'bg-foreground text-background' :
              i === step ? 'border-2 border-foreground text-foreground' :
              'border border-border text-muted-foreground'
            }`}>
              {i < step ? '✓' : i + 1}
            </div>
            <span className={`hidden text-sm sm:inline ${i === step ? 'font-medium' : 'text-muted-foreground'}`}>
              {label}
            </span>
            {i < STEPS.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </div>
        ))}
      </div>

      {/* Step 0: Details */}
      {step === 0 && (
        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="name">Agent Name *</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Code Review Pro" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ticker">Ticker Symbol * <span className="text-xs text-muted-foreground">(max 10 chars, uppercase)</span></Label>
            <Input
              id="ticker"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase().slice(0, 10))}
              placeholder="e.g. CRVWPRO"
              className="font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Description *</Label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this agent do? Be specific."
              rows={4}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="imageUrl">Image URL <span className="text-xs text-muted-foreground">(optional)</span></Label>
            <Input id="imageUrl" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="codeHash">Code Hash <span className="text-xs text-muted-foreground">(optional — hash of your agent prompt for verifiability)</span></Label>
            <Input id="codeHash" value={codeHash} onChange={(e) => setCodeHash(e.target.value)} placeholder="sha256:..." className="font-mono text-xs" />
          </div>
          <Button
            className="w-full"
            onClick={() => setStep(1)}
            disabled={!name || !ticker || !description}
          >
            Continue
          </Button>
        </div>
      )}

      {/* Step 1: Economics */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Supply Cap</Label>
              <span className="text-sm font-semibold">{supplyCap.toLocaleString()} shares</span>
            </div>
            <input
              type="range"
              min={100_000_000}
              max={1_000_000_000}
              step={100_000_000}
              value={supplyCap}
              onChange={(e) => setSupplyCap(Number(e.target.value))}
              className="w-full accent-foreground"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>100M</span>
              <span>1B</span>
            </div>
            <p className="text-xs text-muted-foreground">Immutable after registration. Lower cap = higher price appreciation per trade.</p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Creator Fee</Label>
              <span className="text-sm font-semibold">{creatorFeePct.toFixed(1)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={5}
              step={0.1}
              value={creatorFeePct}
              onChange={(e) => setCreatorFeePct(Number(e.target.value))}
              className="w-full accent-foreground"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0%</span>
              <span>5%</span>
            </div>
            <p className="text-xs text-muted-foreground">Your share of each trade fee. Deducted from the 0.30% platform fee.</p>
          </div>

          <div className="rounded-lg border border-border bg-secondary/40 p-4 text-sm">
            <p className="font-medium">Summary</p>
            <div className="mt-2 space-y-1 text-muted-foreground">
              <div className="flex justify-between"><span>Supply cap</span><span>{supplyCap.toLocaleString()}</span></div>
              <div className="flex justify-between"><span>Creator fee</span><span>{creatorFeePct.toFixed(1)}%</span></div>
              <div className="flex justify-between"><span>Total trade fee</span><span>0.30%</span></div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(0)} className="flex-1">Back</Button>
            <Button onClick={() => setStep(2)} className="flex-1">Continue</Button>
          </div>
        </div>
      )}

      {/* Step 2: Bond & Register */}
      {step === 2 && (
        <div className="space-y-5">
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="mb-1 font-semibold">Registration Bond</h3>
            <p className="text-sm text-muted-foreground">
              A $200 USD bond is required to register. It&apos;s refundable after 6 months if your agent isn&apos;t slashed for misconduct.
            </p>
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-secondary/60 px-4 py-3">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">$200.00 USD bond</span>
              <span className="ml-auto text-xs text-muted-foreground">Refundable after 6 months</span>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-secondary/40 p-4 text-sm">
            <p className="mb-2 font-medium">Full Summary</p>
            <div className="space-y-1 text-muted-foreground">
              <div className="flex justify-between"><span>Name</span><span className="font-medium text-foreground">{name}</span></div>
              <div className="flex justify-between"><span>Ticker</span><span className="font-mono font-medium text-foreground">{ticker}</span></div>
              <div className="flex justify-between"><span>Supply cap</span><span>{supplyCap.toLocaleString()}</span></div>
              <div className="flex justify-between"><span>Creator fee</span><span>{creatorFeePct.toFixed(1)}%</span></div>
              <div className="flex justify-between font-medium text-foreground"><span>Bond required</span><span>$200.00</span></div>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {!address ? (
            <div className="rounded-lg border border-border bg-secondary/40 px-4 py-3 text-sm text-muted-foreground">
              Connect your wallet to register.
            </div>
          ) : (
            <Button className="w-full" onClick={handleRegister} disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {txStepLabels[txStatus]}
            </Button>
          )}

          <Button variant="outline" onClick={() => setStep(1)} className="w-full" disabled={isLoading}>
            Back
          </Button>
        </div>
      )}

      {/* Step 3: Done */}
      {step === 3 && (
        <div className="space-y-6 text-center">
          <div className="text-5xl">🚀</div>
          <div>
            <h2 className="text-xl font-bold">Your agent is live!</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              <strong>{name}</strong> ({ticker}) is now available for trading.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            {createdAgentId && (
              <Button className="flex-1" onClick={() => router.push(`/trade/${createdAgentId}`)}>
                View Market
              </Button>
            )}
            <Button variant="outline" className="flex-1" onClick={() => router.push('/trade')}>
              Back to Trade
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
