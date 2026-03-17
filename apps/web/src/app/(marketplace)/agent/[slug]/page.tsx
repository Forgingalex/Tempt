import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PurchaseFlow } from '@/components/agent/PurchaseFlow'
import { AgentHeader } from '@/components/agent/AgentHeader'
import { DemoSection } from '@/components/agent/DemoSection'
import { ReviewSection } from '@/components/agent/ReviewSection'
import { prisma } from '@/lib/db'
import { shortenAddress } from '@/lib/utils'
import type { AgentInput, AgentDemo } from '@tempt/types'

interface AgentPageProps {
  params: Promise<{ slug: string }>
}

const CATEGORY_LABELS: Record<string, string> = {
  WRITING: 'Writing',
  CODING: 'Coding',
  ART: 'Art & Creative',
  AUTOMATION: 'Automation',
  RESEARCH: 'Research',
  OTHER: 'Other',
}

export default async function AgentPage({ params }: AgentPageProps): Promise<React.ReactElement> {
  const { slug } = await params

  // Fetch agent — accept slug or ID
  const agent = await prisma.agent.findFirst({
    where: {
      OR: [{ slug }, { id: slug }],
      status: { in: ['LISTED', 'APPROVED'] },
    },
    select: {
      id: true,
      onChainId: true,
      slug: true,
      name: true,
      description: true,
      doesNotDo: true,
      category: true,
      tags: true,
      inputs: true,
      outputFormat: true,
      demos: true,
      price: true,
      paymentToken: true,
      licenseType: true,
      usageLimit: true,
      status: true,
      totalSales: true,
      totalExecutions: true,
      acceptanceRate: true,
      disputeRate: true,
      repeatBuyerRate: true,
      sellerId: true,
      createdAt: true,
      seller: {
        select: {
          id: true,
          walletAddress: true,
          displayName: true,
        },
      },
      reviews: {
        select: {
          didWhatItClaimed: true,
          wasSetupClear: true,
          wouldUseAgain: true,
        },
      },
      versions: {
        select: {
          version: true,
          changelog: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 3,
      },
    },
  })

  if (!agent) notFound()

  const inputs = (agent.inputs as unknown as AgentInput[]) ?? []
  const demos = (agent.demos as unknown as AgentDemo[]) ?? []
  const categoryLabel = CATEGORY_LABELS[agent.category] ?? agent.category
  const sellerDisplay = agent.seller.displayName || shortenAddress(agent.seller.walletAddress)

  // Review stats
  const totalReviews = agent.reviews.length
  const reviewStats = {
    total: totalReviews,
    acceptanceRate:
      totalReviews > 0
        ? agent.reviews.filter((r) => r.didWhatItClaimed === 'YES').length / totalReviews
        : 0,
    wouldUseAgainRate:
      totalReviews > 0
        ? agent.reviews.filter((r) => r.wouldUseAgain).length / totalReviews
        : 0,
    setupClearRate:
      totalReviews > 0
        ? agent.reviews.filter((r) => r.wasSetupClear).length / totalReviews
        : 0,
  }

  return (
    <main className="mx-auto max-w-8xl px-6 py-8">
      {/* Breadcrumbs */}
      <nav className="mb-6 flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/explore" className="transition-colors hover:text-foreground">
          Explore
        </Link>
        <ChevronRight className="h-3 w-3" />
        <Link
          href={`/explore?category=${agent.category.toLowerCase()}`}
          className="transition-colors hover:text-foreground"
        >
          {categoryLabel}
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">{agent.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2">
          <AgentHeader
            name={agent.name}
            slug={agent.slug}
            category={agent.category}
            status={agent.status}
            sellerAddress={agent.seller.walletAddress}
            sellerId={agent.seller.id}
            sellerName={agent.seller.displayName}
            totalSales={agent.totalSales}
            totalExecutions={agent.totalExecutions}
            acceptanceRate={agent.acceptanceRate}
            disputeRate={agent.disputeRate}
            price={String(agent.price)}
            paymentToken={agent.paymentToken}
          />

          {/* Description */}
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="text-base">What This Agent Does</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {agent.description}
              </p>
              {agent.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {agent.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* What It Does NOT Do */}
          <Card className="mb-4 border-border/60">
            <CardHeader>
              <CardTitle className="text-base text-muted-foreground">
                What This Agent Does NOT Do
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {agent.doesNotDo}
              </p>
            </CardContent>
          </Card>

          {/* Demos */}
          <DemoSection demos={demos} inputs={inputs} />

          {/* Reviews */}
          <ReviewSection stats={reviewStats} />

          {/* Version history */}
          {agent.versions.length > 0 && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-base">Version History</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {agent.versions.map((v) => (
                  <div key={v.version} className="flex gap-3">
                    <div className="mt-0.5 text-xs font-mono text-muted-foreground">
                      v{v.version}
                    </div>
                    <div>
                      <p className="text-sm">{v.changelog}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(v.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="sticky top-24 space-y-4">
            {/* Purchase Card */}
            <div className="rounded-lg border border-border bg-card p-5">
              <PurchaseFlow
                agentDbId={agent.id}
                agentName={agent.name}
                onChainId={agent.onChainId}
                price={String(agent.price)}
                paymentToken={agent.paymentToken}
                licenseType={agent.licenseType}
                usageLimit={agent.usageLimit}
              />
            </div>

            {/* Creator */}
            <div className="rounded-lg border border-border bg-card p-4">
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Creator
              </h4>
              <Link
                href={`/profile/${agent.seller.walletAddress}`}
                className="flex items-center gap-3 rounded-lg p-2 -mx-2 transition-colors hover:bg-accent"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
                  {sellerDisplay.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-medium">{sellerDisplay}</div>
                  <div className="text-xs text-muted-foreground">
                    {agent.totalSales} completed sale{agent.totalSales === 1 ? '' : 's'}
                  </div>
                </div>
              </Link>
            </div>

            {/* Agent metadata */}
            <div className="rounded-lg border border-border bg-card p-4 text-xs text-muted-foreground space-y-1.5">
              <div className="flex justify-between">
                <span>Output format</span>
                <span className="capitalize">{agent.outputFormat.toLowerCase()}</span>
              </div>
              <div className="flex justify-between">
                <span>License</span>
                <span>{agent.licenseType === 'ONE_TIME' ? 'One-time' : 'Usage-based'}</span>
              </div>
              {agent.usageLimit && (
                <div className="flex justify-between">
                  <span>Uses per purchase</span>
                  <span>{agent.usageLimit}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Listed</span>
                <span>{new Date(agent.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
