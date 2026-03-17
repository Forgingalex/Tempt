'use client'

import { useState, useEffect } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseUnits, formatUnits } from 'viem'
import { Loader2, PlusCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TIP20_DECIMALS, PLATFORM_CONTRACTS } from '@/lib/tempo'
import { DepositWithdrawModal } from './DepositWithdrawModal'

const BONDING_CURVE_ABI = [
  {
    name: 'buy',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'stableAmount', type: 'uint256' },
      { name: 'receiver', type: 'address' },
    ],
    outputs: [{ name: 'minted', type: 'uint256' }],
  },
  {
    name: 'sell',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'shareAmount', type: 'uint256' },
      { name: 'receiver', type: 'address' },
    ],
    outputs: [{ name: 'returned', type: 'uint256' }],
  },
  {
    name: 'previewBuy',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'agentId', type: 'uint256' }, { name: 'stableAmount', type: 'uint256' }],
    outputs: [{ name: 'shares', type: 'uint256' }, { name: 'fee', type: 'uint256' }],
  },
  {
    name: 'previewSell',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'agentId', type: 'uint256' }, { name: 'shareAmount', type: 'uint256' }],
    outputs: [{ name: 'stable', type: 'uint256' }, { name: 'fee', type: 'uint256' }],
  },
] as const

interface BuySellPanelProps {
  agentId: string
  onChainAgentId: number
  currentPrice: string
  vaultBalance: string
  onTradeSuccess?: () => void
}

export function BuySellPanel({
  agentId,
  onChainAgentId,
  currentPrice,
  vaultBalance,
  onTradeSuccess,
}: BuySellPanelProps): React.ReactElement {
  const { address } = useAccount()
  const [tab, setTab] = useState<'buy' | 'sell'>('buy')
  const [amount, setAmount] = useState('')
  const [step, setStep] = useState<'idle' | 'confirming' | 'recording' | 'done'>('idle')
  const [error, setError] = useState('')
  const [depositOpen, setDepositOpen] = useState(false)
  const [depositDefaultAmount, setDepositDefaultAmount] = useState('')

  const { writeContractAsync } = useWriteContract()
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>()
  const { isLoading: isTxPending } = useWaitForTransactionReceipt({ hash: txHash })

  const bondingCurve = PLATFORM_CONTRACTS.BONDING_CURVE_MARKET as `0x${string}`
  const vaultBalNum = parseFloat(formatUnits(BigInt(vaultBalance || '0'), TIP20_DECIMALS))
  const priceNum = parseFloat(formatUnits(BigInt(currentPrice || '0'), 6))

  const amountNum = parseFloat(amount || '0')
  const estimatedShares = priceNum > 0 && tab === 'buy' ? (amountNum / priceNum).toFixed(4) : '—'
  const estimatedStable = priceNum > 0 && tab === 'sell' ? (amountNum * priceNum).toFixed(4) : '—'

  const hasInsufficientBalance = tab === 'buy' && amountNum > vaultBalNum

  useEffect(() => {
    setAmount('')
    setError('')
    setStep('idle')
  }, [tab])

  async function handleTrade(): Promise<void> {
    if (!address || !amount) return
    setError('')
    try {
      setStep('confirming')
      const parsedAmount = tab === 'buy'
        ? parseUnits(amount, TIP20_DECIMALS)
        : parseUnits(amount, 18) // shares are 18 decimals

      const hash = await writeContractAsync({
        address: bondingCurve,
        abi: BONDING_CURVE_ABI,
        functionName: tab === 'buy' ? 'buy' : 'sell',
        args: [BigInt(onChainAgentId), parsedAmount, address],
      })
      setTxHash(hash)

      // Record in DB (simplified — in production, parse Bought/Sold event for exact amounts)
      setStep('recording')
      const endpoint = `/api/trade/agents/${agentId}/${tab}`
      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trader: address,
          stableAmount: tab === 'buy' ? parsedAmount.toString() : '0',
          shareAmount: tab === 'sell' ? parsedAmount.toString() : '0',
          pricePerShare: currentPrice,
          fee: '0', // parse from event in production
          txHash: hash,
          newPrice: currentPrice, // refresh from chain in production
          newSupply: '0',
          newReserve: '0',
        }),
      })

      setStep('done')
      onTradeSuccess?.()
      setTimeout(() => { setStep('idle'); setAmount('') }, 2000)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Transaction failed'
      setError(msg.includes('User rejected') ? 'Transaction cancelled.' : 'Transaction failed. Please try again.')
      setStep('idle')
    }
  }

  const isLoading = (step !== 'idle' && step !== 'done') || isTxPending
  const isDone = step === 'done'

  const stepLabel: Record<typeof step, string> = {
    idle:       tab === 'buy' ? 'Buy Shares' : 'Sell Shares',
    confirming: 'Confirming...',
    recording:  'Recording...',
    done:       'Done!',
  }

  return (
    <>
      <div className="rounded-xl border border-border bg-card p-5">
        {/* Vault balance */}
        <div className="mb-4 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Trading Balance</span>
          <div className="flex items-center gap-2">
            <span className="font-medium">{vaultBalNum.toFixed(2)} USD</span>
            <button
              onClick={() => setDepositOpen(true)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <PlusCircle className="h-3 w-3" />
              Deposit
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-4 flex rounded-lg border border-border p-0.5">
          <button
            onClick={() => setTab('buy')}
            className={`flex-1 rounded-md py-2 text-sm font-semibold transition-colors ${
              tab === 'buy' ? 'bg-emerald-500 text-white' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Buy
          </button>
          <button
            onClick={() => setTab('sell')}
            className={`flex-1 rounded-md py-2 text-sm font-semibold transition-colors ${
              tab === 'sell' ? 'bg-red-500 text-white' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Sell
          </button>
        </div>

        <div className="space-y-3">
          {/* Amount */}
          <div className="space-y-1">
            <Label htmlFor="trade-amount">
              {tab === 'buy' ? 'Amount (USD)' : 'Shares to sell'}
            </Label>
            <div className="relative">
              <Input
                id="trade-amount"
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pr-14"
                disabled={isLoading}
              />
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => {
                  if (tab === 'buy') setAmount(vaultBalNum.toFixed(6))
                }}
              >
                MAX
              </button>
            </div>
          </div>

          {/* Preview */}
          {amountNum > 0 && (
            <div className="space-y-1.5 rounded-lg bg-secondary/40 p-3 text-xs">
              {tab === 'buy' && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">You receive ~</span>
                  <span className="font-medium">{estimatedShares} shares</span>
                </div>
              )}
              {tab === 'sell' && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">You receive ~</span>
                  <span className="font-medium">${estimatedStable}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Price per share</span>
                <span className="font-medium">${priceNum.toFixed(6)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fee (0.30%)</span>
                <span className="font-medium">
                  {tab === 'buy' ? `$${(amountNum * 0.003).toFixed(4)}` : `${(amountNum * priceNum * 0.003).toFixed(6)} shares`}
                </span>
              </div>
            </div>
          )}

          {/* Insufficient balance */}
          {hasInsufficientBalance && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
              <p className="font-medium text-amber-600">Insufficient balance.</p>
              <p className="mt-1 text-muted-foreground">
                You need ${(amountNum - vaultBalNum).toFixed(2)} more.{' '}
                <button
                  className="text-foreground underline"
                  onClick={() => {
                    setDepositDefaultAmount((amountNum - vaultBalNum).toFixed(2))
                    setDepositOpen(true)
                  }}
                >
                  Deposit now
                </button>
              </p>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}

          {!address ? (
            <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
              Connect your wallet to trade.
            </div>
          ) : (
            <Button
              className={`w-full font-semibold ${
                tab === 'buy' ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-red-500 hover:bg-red-600 text-white'
              }`}
              onClick={handleTrade}
              disabled={!amount || amountNum <= 0 || isLoading || isDone || hasInsufficientBalance}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {stepLabel[step]}
            </Button>
          )}
        </div>
      </div>

      <DepositWithdrawModal
        open={depositOpen}
        onOpenChange={setDepositOpen}
        defaultTab="deposit"
        defaultAmount={depositDefaultAmount}
        vaultBalance={vaultBalance}
        onSuccess={() => { setDepositOpen(false); onTradeSuccess?.() }}
      />
    </>
  )
}
