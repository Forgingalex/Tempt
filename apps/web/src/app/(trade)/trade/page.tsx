import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TradeAgentCard } from '@/components/trade/TradeAgentCard'
import { TradeStatsBar } from '@/components/trade/TradeStatsBar'
import { prisma } from '@/lib/db'

export const revalidate = 30

async function getTradePage(): Promise<{
  agents: Awaited<ReturnType<typeof prisma.tradeableAgent.findMany>>
  stats: { totalAgents: number; totalTrades: number; totalVolume24h: string }
}> {
  const [agents, totalAgents, totalTrades] = await Promise.all([
    prisma.tradeableAgent.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { priceChange24h: 'desc' },
      take: 50,
    }),
    prisma.tradeableAgent.count({ where: { status: 'ACTIVE' } }),
    prisma.trade.count(),
  ])

  return {
    agents,
    stats: { totalAgents, totalTrades, totalVolume24h: '0' },
  }
}

export default async function TradePage(): Promise<React.ReactElement> {
  const { agents, stats } = await getTradePage()

  const newArrivals = [...agents].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  ).slice(0, 6)

  return (
    <div className="min-h-screen">
      {/* Stats bar */}
      <TradeStatsBar
        totalAgents={stats.totalAgents}
        totalTrades={stats.totalTrades}
        totalVolume24h={stats.totalVolume24h}
      />

      <div className="mx-auto max-w-7xl px-6 py-10">
        {/* Hero */}
        <div className="mb-10 flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Agent Shares</h1>
            <p className="mt-1 text-muted-foreground">
              Buy and sell shares of AI agents on bonding curves.
            </p>
          </div>
          <Link href="/trade/register">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Register Agent
            </Button>
          </Link>
        </div>

        {agents.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-24 text-center">
            <div className="mb-4 text-4xl">📈</div>
            <h2 className="text-lg font-semibold">No agents listed for trading yet</h2>
            <p className="mt-1 text-sm text-muted-foreground">Be the first to register an agent and start a market.</p>
            <Link href="/trade/register" className="mt-6">
              <Button>Register Agent</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-12">
            {/* Leaderboard */}
            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Leaderboard</h2>
                <div className="flex gap-1 text-xs">
                  {['Trending', 'Top Volume', 'Top Holders', 'Newest'].map((label) => (
                    <button
                      key={label}
                      className="rounded-md px-3 py-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                {agents.map((agent, i) => (
                  <TradeAgentCard
                    key={agent.id}
                    agent={agent}
                    rank={i + 1}
                  />
                ))}
              </div>
            </section>

            {/* New Arrivals */}
            {newArrivals.length > 0 && (
              <section>
                <h2 className="mb-4 text-lg font-semibold">Recently Listed</h2>
                <div className="flex gap-4 overflow-x-auto pb-2">
                  {newArrivals.map((agent) => (
                    <Link
                      key={agent.id}
                      href={`/trade/${agent.id}`}
                      className="flex w-48 shrink-0 flex-col gap-2 rounded-xl border border-border bg-card p-4 transition-all hover:border-foreground/20"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary text-sm font-bold">
                        {agent.imageUrl ? (
                          <img src={agent.imageUrl} alt={agent.name} className="h-full w-full rounded-lg object-cover" />
                        ) : (
                          agent.symbol.slice(0, 2)
                        )}
                      </div>
                      <div>
                        <div className="truncate text-sm font-semibold">{agent.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{agent.symbol}</div>
                      </div>
                      <div className="text-sm font-medium">
                        ${parseFloat(agent.currentPrice).toFixed(4)}
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
