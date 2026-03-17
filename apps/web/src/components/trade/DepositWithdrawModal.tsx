'use client'

import { useState } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseUnits, formatUnits } from 'viem'
import { Loader2, Wallet } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TIP20_DECIMALS, PLATFORM_CONTRACTS } from '@/lib/tempo'
import { TIP20_ABI } from '@/lib/abis'

// Minimal vault ABI for deposit/withdraw
const VAULT_ABI = [
  {
    name: 'deposit',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'token', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'withdraw',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'token', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [],
  },
] as const

interface DepositWithdrawModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultTab?: 'deposit' | 'withdraw'
  defaultAmount?: string
  vaultBalance?: string
  onSuccess?: () => void
}

export function DepositWithdrawModal({
  open,
  onOpenChange,
  defaultTab = 'deposit',
  defaultAmount = '',
  vaultBalance = '0',
  onSuccess,
}: DepositWithdrawModalProps): React.ReactElement {
  const { address } = useAccount()
  const [tab, setTab] = useState<'deposit' | 'withdraw'>(defaultTab)
  const [amount, setAmount] = useState(defaultAmount)
  const [step, setStep] = useState<'idle' | 'approving' | 'confirming' | 'recording' | 'done'>('idle')
  const [error, setError] = useState('')

  const payToken = PLATFORM_CONTRACTS.DEFAULT_PAYMENT_TOKEN
  const vaultAddress = PLATFORM_CONTRACTS.TRADING_VAULT as `0x${string}`

  // Wallet balance
  const { data: walletBal } = useReadContract({
    address: payToken,
    abi: TIP20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })

  const { writeContractAsync } = useWriteContract()
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>()
  const { isLoading: isTxPending } = useWaitForTransactionReceipt({ hash: txHash })

  const walletBalFmt = walletBal ? formatUnits(walletBal as bigint, TIP20_DECIMALS) : '0.00'
  const vaultBalFmt = formatUnits(BigInt(vaultBalance || '0'), TIP20_DECIMALS)

  async function handleDeposit(): Promise<void> {
    if (!address || !amount) return
    setError('')
    try {
      const parsedAmount = parseUnits(amount, TIP20_DECIMALS)

      // Step 1: Approve
      setStep('approving')
      const approveTx = await writeContractAsync({
        address: payToken,
        abi: TIP20_ABI,
        functionName: 'approve',
        args: [vaultAddress, parsedAmount],
      })
      setTxHash(approveTx)

      // Step 2: Deposit
      setStep('confirming')
      const depositTx = await writeContractAsync({
        address: vaultAddress,
        abi: VAULT_ABI,
        functionName: 'deposit',
        args: [payToken, parsedAmount],
      })

      // Step 3: Record
      setStep('recording')
      await fetch('/api/trade/vault/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: payToken, amount: parsedAmount.toString(), txHash: depositTx }),
      })

      setStep('done')
      onSuccess?.()
      setTimeout(() => {
        onOpenChange(false)
        setStep('idle')
        setAmount('')
      }, 1500)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Transaction failed'
      setError(msg.includes('User rejected') ? 'Transaction cancelled.' : 'Transaction failed. Please try again.')
      setStep('idle')
    }
  }

  async function handleWithdraw(): Promise<void> {
    if (!address || !amount) return
    setError('')
    try {
      const parsedAmount = parseUnits(amount, TIP20_DECIMALS)

      setStep('confirming')
      const withdrawTx = await writeContractAsync({
        address: vaultAddress,
        abi: VAULT_ABI,
        functionName: 'withdraw',
        args: [payToken, parsedAmount],
      })

      setStep('recording')
      await fetch('/api/trade/vault/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: payToken, amount: parsedAmount.toString(), txHash: withdrawTx }),
      })

      setStep('done')
      onSuccess?.()
      setTimeout(() => {
        onOpenChange(false)
        setStep('idle')
        setAmount('')
      }, 1500)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Transaction failed'
      setError(msg.includes('User rejected') ? 'Transaction cancelled.' : 'Transaction failed. Please try again.')
      setStep('idle')
    }
  }

  const isLoading = step !== 'idle' && step !== 'done' || isTxPending
  const isDone = step === 'done'

  const stepLabel: Record<typeof step, string> = {
    idle:      tab === 'deposit' ? 'Deposit' : 'Withdraw',
    approving: 'Approving...',
    confirming:'Confirming...',
    recording: 'Recording...',
    done:      'Done!',
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Trading Balance</DialogTitle>
          <DialogDescription>Deposit or withdraw stablecoins from your trading vault.</DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex rounded-lg border border-border p-0.5">
          {(['deposit', 'withdraw'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded-md py-1.5 text-sm font-medium capitalize transition-colors ${
                tab === t ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {/* Balance info */}
          <div className="rounded-lg border border-border bg-secondary/40 px-4 py-3 text-sm">
            {tab === 'deposit' ? (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Wallet balance</span>
                <span className="font-medium">{parseFloat(walletBalFmt).toFixed(2)} USD</span>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Trading balance</span>
                <span className="font-medium">{parseFloat(vaultBalFmt).toFixed(2)} USD</span>
              </div>
            )}
          </div>

          {/* Amount input */}
          <div className="space-y-1.5">
            <Label htmlFor="amount">Amount (USD)</Label>
            <div className="relative">
              <Input
                id="amount"
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pr-16"
                disabled={isLoading}
              />
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground hover:text-foreground"
                onClick={() => {
                  if (tab === 'deposit' && walletBal) {
                    setAmount(formatUnits(walletBal as bigint, TIP20_DECIMALS))
                  } else {
                    setAmount(vaultBalFmt)
                  }
                }}
              >
                MAX
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          {!address && (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/40 px-4 py-3 text-sm text-muted-foreground">
              <Wallet className="h-4 w-4" />
              Connect your wallet to {tab === 'deposit' ? 'deposit' : 'withdraw'}.
            </div>
          )}

          <Button
            className="w-full"
            onClick={tab === 'deposit' ? handleDeposit : handleWithdraw}
            disabled={!address || !amount || parseFloat(amount) <= 0 || isLoading || isDone}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {stepLabel[step]}
          </Button>

          {/* Testnet helper */}
          <p className="text-center text-xs text-muted-foreground">
            Need test tokens?{' '}
            <a
              href="https://docs.tempo.xyz/quickstart/connection-details"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              Get test stablecoins
            </a>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
