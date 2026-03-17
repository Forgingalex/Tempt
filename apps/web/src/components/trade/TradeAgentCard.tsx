'use client'

import Link from 'next/link'
import { TrendingUp, TrendingDown, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { formatUnits } from 'viem'

interface TradeAgentCardProps {
  agent: {
    id: string
    onChainAgentId: number
    name: string
    symbol: string
    imageUrl: string | null
    currentPrice: string
    priceChange24h: number
    totalVolume: string
    holders: number
    currentSupply: string
    supplyCap: string
  }
  rank?: number
}

export function TradeAgentCard({ agent, rank }: TradeAgentCardProps): React.ReactElement {
  const priceNum = parseFloat(formatUnits(BigInt(agent.currentPrice), 6))
  const isPositive = agent.priceChange24h >= 0
  const volumeNum = parseFloat(formatUnits(BigInt(agent.totalVolume), 6))
  const supplyPct = agent.supplyCap !== '0'
    ? (Number(BigInt(agent.currentSupply) * 100n / BigInt(agent.supplyCap)))
    : 0

  return (
    <Link
      href={`/trade/${agent.id}`}
      className="group flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-all hover:border-foreground/20 hover:bg-accent/30"
    >
      {rank !== undefined && (
        <span className="w-6 shrink-0 text-center text-sm font-medium text-muted-foreground">{rank}</span>
      )}

      {/* Avatar */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-sm font-bold">
        {agent.imageUrl ? (
          <img src={agent.imageUrl} alt={agent.name} className="h-full w-full rounded-lg object-cover" />
        ) : (
          agent.symbol.slice(0, 2)
        )}
      </div>

      {/* Name + symbol */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold group-hover:text-foreground">{agent.name}</span>
          <Badge variant="secondary" className="shrink-0 text-[10px] font-mono">{agent.symbol}</Badge>
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {agent.holders.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Price */}
      <div className="shrink-0 text-right">
        <div className="text-sm font-semibold">
          ${priceNum < 0.001 ? priceNum.toExponential(2) : priceNum.toFixed(4)}
        </div>
        <div className={`flex items-center justify-end gap-0.5 text-xs ${isPositive ? 'text-emerald-500' : 'text-red-500'}`}>
          {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {isPositive ? '+' : ''}{agent.priceChange24h.toFixed(2)}%
        </div>
      </div>

      {/* Volume */}
      <div className="hidden shrink-0 text-right sm:block">
        <div className="text-xs text-muted-foreground">Volume</div>
        <div className="text-sm font-medium">${volumeNum.toFixed(2)}</div>
      </div>

      {/* Supply bar */}
      <div className="hidden w-20 shrink-0 lg:block">
        <div className="mb-1 text-right text-xs text-muted-foreground">{supplyPct.toFixed(1)}%</div>
        <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-foreground/60 transition-all"
            style={{ width: `${Math.min(supplyPct, 100)}%` }}
          />
        </div>
      </div>
    </Link>
  )
}
