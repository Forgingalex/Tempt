'use client'

import Link from 'next/link'
import { MoreHorizontal, ExternalLink, Pencil, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatTokenAmount, formatRelativeTime } from '@/lib/utils'

interface SellerAgent {
  id: string
  slug: string
  name: string
  description: string
  category: string
  price: string
  status: string
  totalSales: number
  totalExecutions: number
  acceptanceRate: number
  disputeRate: number
  createdAt: string
  updatedAt: string
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' }> = {
  PENDING_REVIEW: { label: 'Pending Review', variant: 'warning' },
  APPROVED: { label: 'Approved', variant: 'secondary' },
  LISTED: { label: 'Listed', variant: 'success' },
  DELISTED: { label: 'Delisted', variant: 'destructive' },
  REJECTED: { label: 'Rejected', variant: 'destructive' },
}

const categoryLabels: Record<string, string> = {
  WRITING: 'Writing',
  CODING: 'Coding',
  ART: 'Art',
  AUTOMATION: 'Automation',
  RESEARCH: 'Research',
  OTHER: 'Other',
}

interface AgentListProps {
  agents: SellerAgent[]
}

export function AgentList({ agents }: AgentListProps): React.ReactElement {
  return (
    <div className="space-y-3">
      {agents.map((agent) => {
        const status = statusConfig[agent.status] ?? { label: agent.status, variant: 'outline' as const }

        return (
          <div
            key={agent.id}
            className="flex items-center gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent/50"
          >
            {/* Agent info */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="truncate font-semibold">{agent.name}</h3>
                <Badge variant={status.variant}>{status.label}</Badge>
                <Badge variant="outline" className="text-xs">
                  {categoryLabels[agent.category] ?? agent.category}
                </Badge>
              </div>
              <p className="mt-1 truncate text-sm text-muted-foreground">
                {agent.description}
              </p>
            </div>

            {/* Stats */}
            <div className="hidden items-center gap-6 text-sm md:flex">
              <div className="text-right">
                <div className="font-medium">
                  {formatTokenAmount(BigInt(agent.price))} USD
                </div>
                <div className="text-xs text-muted-foreground">Price</div>
              </div>
              <div className="text-right">
                <div className="font-medium">{agent.totalSales}</div>
                <div className="text-xs text-muted-foreground">Sales</div>
              </div>
              <div className="text-right">
                <div className="font-medium">
                  {agent.totalSales > 0
                    ? `${(agent.acceptanceRate * 100).toFixed(0)}%`
                    : '--'}
                </div>
                <div className="text-xs text-muted-foreground">Accept</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">
                  {formatRelativeTime(new Date(agent.createdAt))}
                </div>
              </div>
            </div>

            {/* Actions */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {agent.status === 'LISTED' && (
                  <DropdownMenuItem asChild>
                    <Link href={`/agent/${agent.slug}`} className="flex items-center gap-2">
                      <ExternalLink className="h-4 w-4" />
                      View Listing
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <Link href={`/studio/${agent.id}/edit`} className="flex items-center gap-2">
                    <Pencil className="h-4 w-4" />
                    Edit
                  </Link>
                </DropdownMenuItem>
                {agent.status !== 'DELISTED' && (
                  <DropdownMenuItem className="flex items-center gap-2 text-destructive">
                    <Trash2 className="h-4 w-4" />
                    Delist
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      })}
    </div>
  )
}
