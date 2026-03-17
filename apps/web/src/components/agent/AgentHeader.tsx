import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { shortenAddress } from '@/lib/utils'

interface AgentHeaderProps {
  name: string
  slug: string
  category: string
  status: string
  sellerAddress: string
  sellerId: string
  sellerName?: string | null
  totalSales: number
  totalExecutions: number
  acceptanceRate: number
  disputeRate: number
  price: string
  paymentToken: string
  tokenSymbol?: string
  variant?: 'detail' | 'usage'
}

const CATEGORY_LABELS: Record<string, string> = {
  WRITING: 'Writing',
  CODING: 'Coding',
  ART: 'Art & Creative',
  AUTOMATION: 'Automation',
  RESEARCH: 'Research',
  OTHER: 'Other',
}

export function AgentHeader({
  name,
  category,
  status,
  sellerAddress,
  sellerName,
  totalSales,
  totalExecutions,
  acceptanceRate,
  disputeRate,
  variant = 'detail',
}: AgentHeaderProps): React.ReactElement {
  const isVerified = status === 'LISTED' || status === 'APPROVED'
  const categoryLabel = CATEGORY_LABELS[category] ?? category

  return (
    <div className="mb-6">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{categoryLabel}</Badge>
        {isVerified && <Badge variant="success">Verified</Badge>}
        {variant === 'usage' && (
          <Badge className="bg-primary/10 text-primary border-primary/20">Purchased</Badge>
        )}
      </div>

      <h1 className="mb-2 text-3xl font-bold">{name}</h1>

      <p className="text-sm text-muted-foreground">
        by{' '}
        <Link
          href={`/profile/${sellerAddress}`}
          className="text-foreground underline-offset-4 hover:underline"
        >
          {sellerName || shortenAddress(sellerAddress)}
        </Link>
      </p>

      {/* Stats row */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-3 text-center">
          <div className="text-xl font-bold">{totalExecutions.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground">Uses</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3 text-center">
          <div className="text-xl font-bold">
            {acceptanceRate > 0 ? `${(acceptanceRate * 100).toFixed(0)}%` : '--'}
          </div>
          <div className="text-xs text-muted-foreground">Acceptance</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3 text-center">
          <div className="text-xl font-bold">
            {disputeRate > 0 ? `${(disputeRate * 100).toFixed(1)}%` : '--'}
          </div>
          <div className="text-xs text-muted-foreground">Disputes</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3 text-center">
          <div className="text-xl font-bold">{totalSales.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground">Sales</div>
        </div>
      </div>
    </div>
  )
}
