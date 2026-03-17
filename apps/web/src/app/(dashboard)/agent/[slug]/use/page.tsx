'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { UsageInterface } from '@/components/agent/UsageInterface'
import { EscrowActions } from '@/components/agent/EscrowActions'
import { useReadContract } from 'wagmi'
import { TIP20_ABI } from '@/lib/abis'
import type { AgentInput, AgentDemo, Purchase } from '@tempt/types'

interface AgentData {
  id: string
  name: string
  slug: string
  description: string
  inputs: AgentInput[]
  demos: AgentDemo[]
  outputFormat: string
  paymentToken: string
  licenseType: string
  usageLimit: number | null
}

interface AccessResponse {
  hasAccess: boolean
  reason?: string
  purchase?: {
    id: string
    status: string
    usagesRemaining: number | null
    autoReleaseAt: string
    escrowId: number | null
    paymentToken: string
    amount: string
  }
}

interface AgentResponse {
  agent: AgentData
}

function Skeleton(): React.ReactElement {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-6 w-48 rounded bg-secondary" />
      <div className="h-32 rounded bg-secondary" />
      <div className="h-32 rounded bg-secondary" />
    </div>
  )
}

export default function UseAgentPage(): React.ReactElement {
  const { slug: id } = useParams<{ slug: string }>()

  const [accessData, setAccessData] = useState<AccessResponse | null>(null)
  const [agent, setAgent] = useState<AgentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [purchaseStatus, setPurchaseStatus] = useState<string | null>(null)
  const [usagesRemaining, setUsagesRemaining] = useState<number | null>(null)
  const [hasRunOnce, setHasRunOnce] = useState(false)

  // Read token symbol for display in EscrowActions
  const tokenAddress = (agent?.paymentToken ?? '0x0000000000000000000000000000000000000000') as `0x${string}`
  const { data: tokenSymbol } = useReadContract({
    address: tokenAddress,
    abi: TIP20_ABI,
    functionName: 'symbol',
    query: { enabled: !!agent && tokenAddress !== '0x0000000000000000000000000000000000000000' },
  })

  useEffect(() => {
    async function loadPage(): Promise<void> {
      try {
        // Parallel fetch: access check + agent data
        const [accessRes, agentRes] = await Promise.all([
          fetch(`/api/agents/${id}/access`),
          fetch(`/api/agents/${id}`),
        ])

        const access = (await accessRes.json()) as AccessResponse
        setAccessData(access)

        if (!access.hasAccess) {
          setLoading(false)
          return
        }

        if (access.purchase) {
          setPurchaseStatus(access.purchase.status)
          setUsagesRemaining(access.purchase.usagesRemaining)
        }

        if (agentRes.ok) {
          const agentData = (await agentRes.json()) as AgentResponse
          setAgent(agentData.agent)
        }
      } catch {
        setAccessData({ hasAccess: false, reason: 'error' })
      } finally {
        setLoading(false)
      }
    }

    void loadPage()
  }, [id])

  function handleStatusChange(newStatus: 'accepted' | 'disputed'): void {
    setPurchaseStatus(newStatus)
  }

  function handleRun(result: { usagesRemaining: number | null }): void {
    setHasRunOnce(true)
    setUsagesRemaining(result.usagesRemaining)
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-8 h-6 w-32 animate-pulse rounded bg-secondary" />
        <Skeleton />
      </div>
    )
  }

  if (!accessData?.hasAccess) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-16 text-center">
        <Lock className="mx-auto mb-4 h-12 w-12 text-muted-foreground/40" />
        <h1 className="mb-2 text-2xl font-bold">Access Required</h1>
        <p className="mb-6 text-muted-foreground">
          You need to purchase this agent to use it.
        </p>
        <Button asChild>
          <Link href={`/agent/${id}`}>View Agent &amp; Purchase</Link>
        </Button>
      </div>
    )
  }

  if (!agent) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-16 text-center">
        <p className="text-muted-foreground">Agent not found.</p>
      </div>
    )
  }

  // Build purchase object for EscrowActions
  const purchase: Purchase | null = accessData.purchase
    ? {
        id: accessData.purchase.id,
        agentId: id,
        agentName: agent.name,
        agentSlug: agent.slug,
        buyerId: '',
        amount: accessData.purchase.amount,
        paymentToken: accessData.purchase.paymentToken,
        status: accessData.purchase.status as Purchase['status'],
        usagesRemaining: usagesRemaining ?? undefined,
        autoReleaseAt: accessData.purchase.autoReleaseAt,
        escrowId: accessData.purchase.escrowId ?? undefined,
        createdAt: new Date().toISOString(),
      }
    : null

  const activePurchase = purchase && (purchaseStatus === 'escrowed')

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      {/* Back link */}
      <Link
        href={`/agent/${agent.slug}`}
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to {agent.name}
      </Link>

      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold">{agent.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{agent.description}</p>
      </div>

      {/* Two-column layout on desktop */}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Left: Input + Output */}
        <div className="rounded-lg border border-border bg-card p-6">
          <UsageInterface
            agentId={id}
            agentName={agent.name}
            inputs={agent.inputs}
            outputFormat={agent.outputFormat}
            usagesRemaining={usagesRemaining}
            onRun={handleRun}
          />
        </div>

        {/* Right: Escrow status + actions */}
        <div className="lg:self-start lg:sticky lg:top-24">
          {purchase ? (
            <div className="rounded-lg border border-border bg-card p-5">
              <h3 className="mb-4 text-sm font-semibold">Payment</h3>
              <EscrowActions
                purchase={{
                  ...purchase,
                  status: (purchaseStatus ?? purchase.status) as Purchase['status'],
                  usagesRemaining: usagesRemaining ?? undefined,
                }}
                agentDbId={id}
                tokenSymbol={typeof tokenSymbol === 'string' ? tokenSymbol : 'TOKEN'}
                onStatusChange={handleStatusChange}
                hasRun={hasRunOnce}
              />
            </div>
          ) : null}

          {/* Mobile sticky accept FAB */}
          {hasRunOnce && activePurchase && (
            <div className="fixed bottom-6 right-6 lg:hidden">
              <Button
                size="lg"
                className="shadow-lg"
                onClick={() => {
                  document.querySelector('[data-escrow-actions]')?.scrollIntoView({
                    behavior: 'smooth',
                  })
                }}
              >
                Accept &amp; Pay
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
