'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  useAccount,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi'
import { useQuery } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { decodeEventLog, type Log } from 'viem'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Clock,
  ExternalLink,
  ArrowRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TIP20_ABI, ESCROW_ABI } from '@/lib/abis'
import { PLATFORM_CONTRACTS, ESCROW_CONFIG } from '@/lib/tempo'
import { formatCurrency, formatTokenAmount } from '@/lib/utils'
import type { Purchase } from '@tempt/types'

interface PurchaseFlowProps {
  agentDbId: string
  agentName: string
  onChainId: number | null
  /** Serialized bigint — price in TIP-20 units (6 decimals) */
  price: string
  /** TIP-20 token address */
  paymentToken: string
  licenseType: 'ONE_TIME' | 'USAGE_BASED'
  usageLimit?: number | null
}

export function PurchaseFlow({
  agentDbId,
  onChainId,
  price,
  paymentToken,
  licenseType,
  usageLimit,
}: PurchaseFlowProps): React.ReactElement {
  const router = useRouter()
  const { address, isConnected } = useAccount()
  const { status: sessionStatus } = useSession()

  const [approveTxHash, setApproveTxHash] = useState<`0x${string}` | undefined>()
  const [purchaseTxHash, setPurchaseTxHash] = useState<`0x${string}` | undefined>()
  const [isApproving, setIsApproving] = useState(false)
  const [isPurchasing, setIsPurchasing] = useState(false)
  const [successTxHash, setSuccessTxHash] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [countdown, setCountdown] = useState(3)

  const priceBigInt = BigInt(price)
  const escrowAddress = PLATFORM_CONTRACTS.MARKETPLACE_ESCROW
  const tokenAddress = paymentToken as `0x${string}`
  const isAuthenticated = sessionStatus === 'authenticated'
  const explorerUrl = process.env.NEXT_PUBLIC_TEMPO_EXPLORER_URL || 'https://explore.tempo.xyz'

  // — Check if user already has an active purchase —
  const { data: purchasesData, isLoading: purchasesLoading } = useQuery({
    queryKey: ['my-purchases', agentDbId],
    queryFn: async (): Promise<{ purchases: Purchase[] }> => {
      const res = await fetch(`/api/purchases/my?agentId=${agentDbId}`)
      if (!res.ok) return { purchases: [] }
      return res.json() as Promise<{ purchases: Purchase[] }>
    },
    enabled: isAuthenticated,
    staleTime: 30_000,
  })

  const activePurchase = purchasesData?.purchases.find(
    (p) =>
      p.agentId === agentDbId &&
      (p.status === 'escrowed' || p.status === 'accepted' || p.status === 'auto_released')
  )

  // — Read TIP-20 balance, allowance, and symbol —
  const { data: reads, refetch: refetchReads } = useReadContracts({
    contracts: [
      {
        address: tokenAddress,
        abi: TIP20_ABI,
        functionName: 'balanceOf',
        args: [address ?? '0x0000000000000000000000000000000000000000'],
      },
      {
        address: tokenAddress,
        abi: TIP20_ABI,
        functionName: 'allowance',
        args: [
          address ?? '0x0000000000000000000000000000000000000000',
          escrowAddress,
        ],
      },
      {
        address: tokenAddress,
        abi: TIP20_ABI,
        functionName: 'symbol',
      },
    ],
    query: { enabled: isConnected && !!address && tokenAddress !== '0x0000000000000000000000000000000000000000' },
  })

  const balance = reads?.[0]?.result as bigint | undefined
  const allowance = reads?.[1]?.result as bigint | undefined
  const tokenSymbol = (reads?.[2]?.result as string | undefined) || 'TOKEN'

  // — Write contract —
  const { writeContractAsync } = useWriteContract()

  // — Wait for approve tx —
  const { data: approveReceipt } = useWaitForTransactionReceipt({
    hash: approveTxHash,
    query: { enabled: !!approveTxHash },
  })

  // — Wait for purchase tx —
  const { data: purchaseReceipt } = useWaitForTransactionReceipt({
    hash: purchaseTxHash,
    query: { enabled: !!purchaseTxHash },
  })

  // Effect: approve confirmed
  useEffect(() => {
    if (!approveReceipt || !isApproving) return
    setIsApproving(false)
    setApproveTxHash(undefined)
    void refetchReads()
  }, [approveReceipt, isApproving, refetchReads])

  // Effect: purchase confirmed
  useEffect(() => {
    if (!purchaseReceipt || !isPurchasing || !purchaseTxHash) return

    setIsPurchasing(false)

    if (purchaseReceipt.status === 'reverted') {
      setErrorMsg('Transaction failed on-chain. Please try again.')
      setPurchaseTxHash(undefined)
      return
    }

    void recordPurchaseInDb(purchaseTxHash, purchaseReceipt.logs)
  }, [purchaseReceipt, isPurchasing, purchaseTxHash])

  // Effect: countdown after success
  useEffect(() => {
    if (!successTxHash) return
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timer)
          router.push(`/agent/${agentDbId}/use`)
          return 0
        }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [successTxHash, router, agentDbId])

  const recordPurchaseInDb = useCallback(
    async (txHash: `0x${string}`, logs: readonly Log[]): Promise<void> => {
      // Parse EscrowCreated event from tx logs to get on-chain escrow ID
      let escrowId: number | null = null
      for (const log of logs) {
        if (log.address.toLowerCase() !== escrowAddress.toLowerCase()) continue
        try {
          const decoded = decodeEventLog({
            abi: ESCROW_ABI,
            eventName: 'EscrowCreated',
            data: log.data,
            topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
          })
          escrowId = Number(decoded.args.escrowId)
          break
        } catch {
          // Not the EscrowCreated event — continue
        }
      }

      try {
        const res = await fetch('/api/purchases', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agentId: agentDbId,
            txHash,
            escrowId,
            buyerAddress: address,
          }),
        })
        const data = (await res.json()) as { purchase?: { id: string } }
        if (res.ok && data.purchase) {
          setSuccessTxHash(txHash)
          setCountdown(3)
        } else {
          // Purchase went on-chain but DB record failed — still show success
          setSuccessTxHash(txHash)
          setCountdown(3)
        }
      } catch {
        // Network error recording — still show success since on-chain tx confirmed
        setSuccessTxHash(txHash)
        setCountdown(3)
      }
    },
    [agentDbId, address, escrowAddress]
  )

  async function handleApprove(): Promise<void> {
    setErrorMsg(null)
    setIsApproving(true)
    try {
      const hash = await writeContractAsync({
        address: tokenAddress,
        abi: TIP20_ABI,
        functionName: 'approve',
        args: [escrowAddress, priceBigInt],
      })
      setApproveTxHash(hash)
    } catch (err) {
      setIsApproving(false)
      const msg = err instanceof Error ? err.message : ''
      if (!msg.toLowerCase().includes('user rejected') && !msg.toLowerCase().includes('denied')) {
        setErrorMsg('Approval failed. Please try again.')
      }
    }
  }

  async function handlePurchase(): Promise<void> {
    if (onChainId === null) {
      setErrorMsg('This agent is not yet listed on-chain. Please contact support.')
      return
    }
    setErrorMsg(null)
    setIsPurchasing(true)
    try {
      const hash = await writeContractAsync({
        address: escrowAddress,
        abi: ESCROW_ABI,
        functionName: 'purchase',
        args: [BigInt(onChainId)],
      })
      setPurchaseTxHash(hash)
    } catch (err) {
      setIsPurchasing(false)
      const msg = err instanceof Error ? err.message : ''
      if (!msg.toLowerCase().includes('user rejected') && !msg.toLowerCase().includes('denied')) {
        setErrorMsg(`Transaction failed. Please try again.`)
      }
    }
  }

  // Derived state
  const isBusy = isApproving || isPurchasing || !!approveTxHash || !!purchaseTxHash
  const hasInsufficientBalance = balance !== undefined && balance < priceBigInt
  const needsApproval = allowance !== undefined && allowance < priceBigInt
  const sellerReceives =
    priceBigInt - (priceBigInt * BigInt(ESCROW_CONFIG.PLATFORM_FEE_BPS)) / 10000n
  const platformFeePercent = ESCROW_CONFIG.PLATFORM_FEE_BPS / 100

  // — STATE: Already purchased —
  if (activePurchase && !successTxHash) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-4 py-3">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
          <span className="text-sm font-medium">You own this agent</span>
        </div>
        <Button className="w-full" size="lg" asChild>
          <Link href={`/agent/${agentDbId}/use`}>
            Use Agent <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    )
  }

  // — STATE: Success —
  if (successTxHash) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-4 text-center">
          <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-green-500" />
          <p className="font-semibold">Purchase complete!</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Your payment is held in escrow.
          </p>
          <a
            href={`${explorerUrl}/tx/${successTxHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            View transaction <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <Button className="w-full" size="lg" asChild>
          <Link href={`/agent/${agentDbId}/use`}>
            Go to Agent <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Redirecting in {countdown}s...
        </p>
      </div>
    )
  }

  // — LOADING —
  if (purchasesLoading && isAuthenticated) {
    return (
      <div className="space-y-3">
        <div className="h-16 animate-pulse rounded-lg bg-secondary" />
        <div className="h-11 animate-pulse rounded-md bg-secondary" />
      </div>
    )
  }

  // — MAIN PURCHASE UI —
  const priceFormatted = formatCurrency(priceBigInt, tokenSymbol)
  const balanceFormatted =
    balance !== undefined
      ? `${parseFloat(formatTokenAmount(balance)).toFixed(2)} ${tokenSymbol}`
      : null

  return (
    <div className="space-y-4">
      {/* Price */}
      <div className="text-center">
        <div className="text-3xl font-bold">{priceFormatted}</div>
        <div className="mt-1 text-sm text-muted-foreground">
          {licenseType === 'ONE_TIME' ? 'One-time purchase' : `${usageLimit ?? '∞'} uses`}
        </div>
      </div>

      {/* Escrow info */}
      <div className="rounded-lg border border-border bg-secondary/30 p-3 text-xs text-muted-foreground space-y-1.5">
        <div className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>Your payment is held in escrow until you confirm satisfaction</span>
        </div>
        <div className="flex items-start gap-2">
          <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>Auto-releases to seller after {ESCROW_CONFIG.AUTO_RELEASE_DAYS} days if no action</span>
        </div>
      </div>

      {/* Fee breakdown */}
      <div className="space-y-1 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <span>Price</span>
          <span>{priceFormatted}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Platform fee ({platformFeePercent}%)</span>
          <span>
            {formatCurrency(priceBigInt - sellerReceives, tokenSymbol)}
          </span>
        </div>
        <div className="flex justify-between border-t border-border pt-1 font-medium">
          <span>Seller receives</span>
          <span>{formatCurrency(sellerReceives, tokenSymbol)}</span>
        </div>
      </div>

      {/* Balance display */}
      {balanceFormatted && (
        <div
          className={`text-xs ${hasInsufficientBalance ? 'text-destructive' : 'text-muted-foreground'}`}
        >
          Your balance: {balanceFormatted}
        </div>
      )}

      {/* Error */}
      {errorMsg && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* — Action Button — */}
      {!isConnected || !isAuthenticated ? (
        <Button className="w-full" size="lg" disabled>
          Connect wallet to purchase
        </Button>
      ) : hasInsufficientBalance ? (
        <Button className="w-full" size="lg" disabled variant="outline">
          <AlertCircle className="mr-2 h-4 w-4" />
          Insufficient {tokenSymbol} balance
        </Button>
      ) : needsApproval ? (
        <Button
          className="w-full"
          size="lg"
          onClick={() => void handleApprove()}
          disabled={isBusy}
        >
          {isApproving || approveTxHash ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {approveTxHash ? 'Confirming approval...' : 'Approving...'}
            </>
          ) : (
            `Step 1: Approve ${tokenSymbol}`
          )}
        </Button>
      ) : (
        <Button
          className="w-full"
          size="lg"
          onClick={() => void handlePurchase()}
          disabled={isBusy || onChainId === null}
        >
          {isPurchasing || purchaseTxHash ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {purchaseTxHash ? 'Confirming purchase...' : 'Processing...'}
            </>
          ) : (
            'Purchase Agent'
          )}
        </Button>
      )}

      <p className="text-center text-xs text-muted-foreground">
        Payment held in escrow · release any time
      </p>
    </div>
  )
}
