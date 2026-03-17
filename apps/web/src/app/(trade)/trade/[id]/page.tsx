import { notFound } from 'next/navigation'
import { formatUnits } from 'viem'
import { Badge } from '@/components/ui/badge'
import { PriceChart } from '@/components/trade/PriceChart'
import { BuySellPanel } from '@/components/trade/BuySellPanel'
import { BondingCurveChart } from '@/components/trade/BondingCurveChart'
import { prisma } from '@/lib/db'
import { TIP20_DECIMALS } from '@/lib/tempo'
import { shortenAddress } from '@/lib/utils'

interface TradeDetailPageProps {
  params: Promise<{ id: string }>
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE:   'Active',
  PAUSED:   'Paused',
  DELISTED: 'Delisted',
  SLASHED:  'Slashed',
}

function formatSupplyPct(currentSupply: string, supplyCap: string): string {
  try {
    const cur = BigInt(currentSupply)
    const cap = BigInt(supplyCap)
    if (cap === 0n) return '0%'
    return `${Number((cur * 100n) / cap).toFixed(2)}%`
  } catch {
    return '—'
  }
}

export default async function TradeDetailPage({ params }: TradeDetailPageProps): Promise<React.ReactElement> {
  const { id } = await params

  const agent = await prisma.tradeableAgent.findFirst({
    where: {
      OR: [
        { id },
        { onChainAgentId: isNaN(Number(id)) ? undefined : Number(id) },
      ],
    },
    include: {
      trades: {
        orderBy: { createdAt: 'desc' },
        take: 100,
      },
    },
  })

  if (!agent) notFound()

  const currentPriceNum = parseFloat(formatUnits(BigInt(agent.currentPrice || '0'), TIP20_DECIMALS))
  const reserveNum = parseFloat(formatUnits(BigInt(agent.reserveBalance || '0'), TIP20_DECIMALS))
  const supplyNum = parseFloat(formatUnits(BigInt(agent.currentSupply || '0'), 18))
  const capNum = parseFloat(formatUnits(BigInt(agent.supplyCap || '1'), 18))
  const marketCap = currentPriceNum * supplyNum
  const supplyPct = formatSupplyPct(agent.currentSupply, agent.supplyCap)

  const agentStats = [
    { label: 'Current Price', value: `$${currentPriceNum.toFixed(6)}` },
    { label: 'Market Cap', value: `$${marketCap.toFixed(2)}` },
    { label: '24h Volume', value: `$${parseFloat(agent.totalVolume || '0').toFixed(2)}` },
    { label: 'Holders', value: agent.holders.toLocaleString() },
    { label: 'Reserve', value: `$${reserveNum.toFixed(2)}` },
    { label: 'Creator Fee', value: `${(agent.creatorFeeBps / 100).toFixed(2)}%` },
  ]

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      {/* Agent header */}
      <div className="mb-6 flex items-start gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-secondary text-lg font-bold">
          {agent.imageUrl ? (
            <img src={agent.imageUrl} alt={agent.name} className="h-full w-full rounded-xl object-cover" />
          ) : (
            agent.symbol.slice(0, 2)
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">{agent.name}</h1>
            <Badge variant="secondary" className="font-mono text-sm">{agent.symbol}</Badge>
            <Badge
              variant={agent.status === 'ACTIVE' ? 'default' : 'warning'}
              className="text-xs"
            >
              {STATUS_LABELS[agent.status] ?? agent.status}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            By{' '}
            <a
              href={`/profile/${agent.creator}`}
              className="font-mono hover:text-foreground"
            >
              {shortenAddress(agent.creator)}
            </a>
          </p>
        </div>
      </div>

      {/* Main layout */}
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Left column */}
        <div className="min-w-0 flex-1 space-y-6">
          {/* Price chart */}
          <PriceChart
            trades={agent.trades.map((t) => ({ ...t, createdAt: t.createdAt.toISOString() }))}
            currentPrice={agent.currentPrice}
            priceChange24h={agent.priceChange24h}
          />

          {/* Trade history */}
          <div className="rounded-xl border border-border bg-card">
            <div className="border-b border-border px-5 py-4">
              <h3 className="text-sm font-semibold">Trade History</h3>
            </div>
            {agent.trades.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                No trades yet. Be the first.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {['Type', 'Amount', 'Shares', 'Price', 'Trader', 'Time'].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {agent.trades.map((trade) => (
                      <tr key={trade.id} className="border-b border-border/50 hover:bg-accent/20">
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold ${trade.type === 'BUY' ? 'text-emerald-500' : 'text-red-500'}`}>
                            {trade.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">
                          ${parseFloat(formatUnits(BigInt(trade.stableAmount || '0'), TIP20_DECIMALS)).toFixed(4)}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">
                          {parseFloat(formatUnits(BigInt(trade.shareAmount || '0'), 18)).toFixed(4)}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">
                          ${parseFloat(formatUnits(BigInt(trade.pricePerShare || '0'), TIP20_DECIMALS)).toFixed(6)}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          {shortenAddress(trade.trader)}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {new Date(trade.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="mb-3 text-sm font-semibold">About</h3>
            <p className="text-sm text-muted-foreground">{agent.description}</p>
          </div>
        </div>

        {/* Right column (sticky) */}
        <div className="w-full space-y-4 lg:w-80 lg:shrink-0">
          {/* BuySellPanel reads vault balance via client hook */}
          <BuySellPanel
            agentId={agent.id}
            onChainAgentId={agent.onChainAgentId}
            currentPrice={agent.currentPrice}
            vaultBalance="0"
          />

          {/* Agent stats */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="mb-3 text-sm font-semibold">Stats</h3>
            <div className="space-y-3">
              {agentStats.map((s) => (
                <div key={s.label} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{s.label}</span>
                  <span className="font-medium">{s.value}</span>
                </div>
              ))}

              {/* Supply progress */}
              <div>
                <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                  <span>Supply</span>
                  <span>{supplyPct} of cap</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-foreground/60"
                    style={{ width: supplyPct }}
                  />
                </div>
                <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                  <span>{supplyNum.toLocaleString()} shares</span>
                  <span>{capNum.toLocaleString()} cap</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bonding curve visualization */}
          <BondingCurveChart
            currentSupply={agent.currentSupply}
            supplyCap={agent.supplyCap}
            currentPrice={agent.currentPrice}
          />
        </div>
      </div>
    </div>
  )
}
