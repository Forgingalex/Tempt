'use client'

import { useState, useEffect } from 'react'
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { CheckCircle2, AlertCircle, Clock, Loader2, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { ESCROW_ABI } from '@/lib/abis'
import { PLATFORM_CONTRACTS, ESCROW_CONFIG } from '@/lib/tempo'
import { formatCurrency } from '@/lib/utils'
import type { Purchase } from '@tempt/types'

interface EscrowActionsProps {
  purchase: Purchase
  agentDbId: string
  tokenSymbol: string
  /** Called after successful accept or dispute */
  onStatusChange: (newStatus: 'accepted' | 'disputed') => void
  /** Whether the agent has been run at least once */
  hasRun: boolean
}

function useCountdown(targetDate: string): { days: number; hours: number; minutes: number; expired: boolean } {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  const target = new Date(targetDate).getTime()
  const diff = Math.max(0, target - now)
  const expired = diff === 0

  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
    expired,
  }
}

export function EscrowActions({
  purchase,
  tokenSymbol,
  onStatusChange,
  hasRun,
}: EscrowActionsProps): React.ReactElement | null {
  const countdown = useCountdown(purchase.autoReleaseAt)
  const [disputeOpen, setDisputeOpen] = useState(false)
  const [disputeReason, setDisputeReason] = useState('')
  const [acceptTxHash, setAcceptTxHash] = useState<`0x${string}` | undefined>()
  const [disputeTxHash, setDisputeTxHash] = useState<`0x${string}` | undefined>()
  const [isAccepting, setIsAccepting] = useState(false)
  const [isDisputing, setIsDisputing] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const escrowAddress = PLATFORM_CONTRACTS.MARKETPLACE_ESCROW

  const { writeContractAsync } = useWriteContract()

  // Wait for accept tx
  const { data: acceptReceipt } = useWaitForTransactionReceipt({
    hash: acceptTxHash,
    query: { enabled: !!acceptTxHash },
  })

  // Wait for dispute tx
  const { data: disputeReceipt } = useWaitForTransactionReceipt({
    hash: disputeTxHash,
    query: { enabled: !!disputeTxHash },
  })

  // Effect: accept confirmed
  useEffect(() => {
    if (!acceptReceipt || !isAccepting) return
    setIsAccepting(false)
    if (acceptReceipt.status === 'reverted') {
      setErrorMsg('Accept transaction failed. Please try again.')
      setAcceptTxHash(undefined)
      return
    }
    void recordAccept(acceptTxHash!)
  }, [acceptReceipt, isAccepting])

  // Effect: dispute confirmed
  useEffect(() => {
    if (!disputeReceipt || !isDisputing) return
    setIsDisputing(false)
    if (disputeReceipt.status === 'reverted') {
      setErrorMsg('Dispute transaction failed. Please try again.')
      setDisputeTxHash(undefined)
      return
    }
    void recordDispute(disputeTxHash!, disputeReason)
  }, [disputeReceipt, isDisputing])

  async function recordAccept(txHash: `0x${string}`): Promise<void> {
    try {
      const res = await fetch(`/api/purchases/${purchase.id}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txHash }),
      })
      if (res.ok) {
        setSuccessMsg('Payment released to seller. Thank you!')
        onStatusChange('accepted')
      } else {
        setErrorMsg('Payment released on-chain but record update failed.')
        onStatusChange('accepted')
      }
    } catch {
      setErrorMsg('Payment released on-chain but record update failed.')
      onStatusChange('accepted')
    }
  }

  async function recordDispute(txHash: `0x${string}`, reason: string): Promise<void> {
    try {
      const res = await fetch(`/api/purchases/${purchase.id}/dispute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txHash, reason }),
      })
      if (res.ok) {
        setSuccessMsg('Issue reported. Our team will review this within 24 hours.')
        onStatusChange('disputed')
        setDisputeOpen(false)
      } else {
        setErrorMsg('Dispute filed on-chain but record update failed.')
        onStatusChange('disputed')
        setDisputeOpen(false)
      }
    } catch {
      setErrorMsg('Dispute filed on-chain but record update failed.')
      onStatusChange('disputed')
      setDisputeOpen(false)
    }
  }

  async function handleAccept(): Promise<void> {
    if (purchase.escrowId === null || purchase.escrowId === undefined) {
      setErrorMsg('No escrow ID found for this purchase.')
      return
    }
    setErrorMsg(null)
    setIsAccepting(true)
    try {
      const hash = await writeContractAsync({
        address: escrowAddress,
        abi: ESCROW_ABI,
        functionName: 'acceptAndRelease',
        args: [BigInt(purchase.escrowId)],
      })
      setAcceptTxHash(hash)
    } catch (err) {
      setIsAccepting(false)
      const msg = err instanceof Error ? err.message : ''
      if (!msg.toLowerCase().includes('user rejected') && !msg.toLowerCase().includes('denied')) {
        setErrorMsg('Accept transaction failed. Please try again.')
      }
    }
  }

  async function handleDisputeSubmit(): Promise<void> {
    if (disputeReason.trim().length < 10) {
      setErrorMsg('Please describe the issue in at least 10 characters.')
      return
    }
    if (purchase.escrowId === null || purchase.escrowId === undefined) {
      setErrorMsg('No escrow ID found for this purchase.')
      return
    }
    setErrorMsg(null)
    setIsDisputing(true)
    try {
      const hash = await writeContractAsync({
        address: escrowAddress,
        abi: ESCROW_ABI,
        functionName: 'raiseDispute',
        args: [BigInt(purchase.escrowId), disputeReason],
      })
      setDisputeTxHash(hash)
    } catch (err) {
      setIsDisputing(false)
      const msg = err instanceof Error ? err.message : ''
      if (!msg.toLowerCase().includes('user rejected') && !msg.toLowerCase().includes('denied')) {
        setErrorMsg('Dispute transaction failed. Please try again.')
      }
    }
  }

  const isBusy =
    isAccepting || isDisputing || !!acceptTxHash || !!disputeTxHash

  const priceBigInt = BigInt(purchase.amount)
  const sellerReceives =
    priceBigInt - (priceBigInt * BigInt(ESCROW_CONFIG.PLATFORM_FEE_BPS)) / 10000n

  if (purchase.status === 'accepted' || purchase.status === 'auto_released') {
    return (
      <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <span className="text-sm font-medium">Payment released</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {purchase.status === 'auto_released' ? 'Auto-released after 7 days' : 'You accepted this agent'}
        </p>
      </div>
    )
  }

  if (purchase.status === 'disputed') {
    return (
      <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-4">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-yellow-500" />
          <span className="text-sm font-medium">Issue reported</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Our team is reviewing your dispute. We&apos;ll contact you within 24 hours.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-3">
        {/* Countdown */}
        <div className="rounded-lg border border-border bg-secondary/30 p-3">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            Payment Status: In Escrow
          </div>
          <div className="flex items-center gap-1 text-sm">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            {countdown.expired ? (
              <span className="text-yellow-500">Auto-release period ended</span>
            ) : (
              <span>
                Auto-releases in{' '}
                <span className="font-medium">
                  {countdown.days}d {countdown.hours}h
                </span>
              </span>
            )}
          </div>
        </div>

        {/* Success message */}
        {successMsg && (
          <div className="rounded-lg border border-green-500/20 bg-green-500/5 px-3 py-2 text-sm text-green-600 dark:text-green-400">
            {successMsg}
          </div>
        )}

        {/* Error */}
        {errorMsg && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Prompt: only show after agent has been run */}
        {hasRun && purchase.status === 'escrowed' && !successMsg && (
          <p className="text-xs font-medium text-muted-foreground">
            Are you satisfied with this agent?
          </p>
        )}

        {/* Actions */}
        {purchase.status === 'escrowed' && !successMsg && (
          <div className="space-y-2">
            <Button
              className="w-full"
              onClick={() => void handleAccept()}
              disabled={isBusy}
            >
              {isAccepting || acceptTxHash ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {acceptTxHash ? 'Confirming...' : 'Accepting...'}
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Accept &amp; Release Payment
                </>
              )}
            </Button>

            <Button
              variant="outline"
              className="w-full text-muted-foreground"
              onClick={() => { setDisputeOpen(true); setErrorMsg(null) }}
              disabled={isBusy}
            >
              <AlertCircle className="mr-2 h-4 w-4" />
              Report an Issue
            </Button>
          </div>
        )}

        {/* Fee note */}
        {purchase.status === 'escrowed' && !successMsg && (
          <p className="text-xs text-muted-foreground">
            Accepting releases {formatCurrency(sellerReceives, tokenSymbol)} to the seller
            ({formatCurrency(priceBigInt - sellerReceives, tokenSymbol)} platform fee).
          </p>
        )}
      </div>

      {/* Dispute Dialog */}
      <Dialog open={disputeOpen} onOpenChange={setDisputeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Report an Issue</DialogTitle>
            <DialogDescription>
              Describe the problem with this agent. Your payment will be held until
              our team resolves the dispute.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 space-y-3">
            {errorMsg && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {errorMsg}
              </div>
            )}
            <textarea
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              placeholder="Describe what the agent failed to do, or how the output didn't match the description..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              rows={4}
              maxLength={2000}
            />
            <p className="text-right text-xs text-muted-foreground">
              {disputeReason.length}/2000
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => { setDisputeOpen(false); setDisputeReason(''); setErrorMsg(null) }}
              disabled={isBusy}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleDisputeSubmit()}
              disabled={isBusy || disputeReason.trim().length < 10}
            >
              {isDisputing || disputeTxHash ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {disputeTxHash ? 'Confirming...' : 'Filing dispute...'}
                </>
              ) : (
                'Submit Dispute'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
