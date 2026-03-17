'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useAccount } from 'wagmi'
import { formatUnits } from 'viem'
import { TrendingUp, TrendingDown, ArrowDownToLine, ArrowUpFromLine, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { DepositWithdrawModal } from '@/components/trade/DepositWithdrawModal'
import { TIP20_DECIMALS } from '@/lib/tempo'
import { shortenAddress } from '@/lib/utils'

interface Holding {
  agentId: string
  agent: { id: string; name: string; symbol: string; imageUrl: string | null; currentPrice: string; priceChange24h: number }
  sharesHeld: string
  currentValue: string
  avgBuyPrice: string
  totalInvested: string
  pnl: string
  pnlPct: number
}

interface VaultBalance {
  id: string
  token: string
  balance: string
}

interface VaultTx {
  id: string
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'TRADE_DEBIT' | 'TRADE_CREDIT'
  amount: string
  token: string
  txHash: string
  agentId: string | null
  createdAt: string
}

interface PortfolioData {
  holdings: Holding[]
  vaultBalances: VaultBalance[]
  recentActivity: VaultTx[]
  createdAgents: Array<{
    id: string
    onChainAgentId: number
    name: string
    symbol: string
    currentPrice: string
    totalVolume: string
    totalTrades: number
    status: string
    creatorFeeBps: number
  }>
}

const TX_TYPE_LABELS: Record<string, string> = {
  DEPOSIT:      'Deposit',
  WITHDRAWAL:   'Withdrawal',
  TRADE_DEBIT:  'Trade Buy',
  TRADE_CREDIT: 'Trade Sell',
}

export default function PortfolioPage(): React.ReactElement {
  const { address } = useAccount()
  const [depositOpen, setDepositOpen] = useState(false)
  const [depositTab, setDepositTab] = useState<'deposit' | 'withdraw'>('deposit')

  const { data, isLoading, refetch } = useQuery<PortfolioData>({
    queryKey: ['portfolio', address],
    queryFn: async () => {
      const res = await fetch('/api/trade/portfolio')
      if (!res.ok) throw new Error('Failed to load portfolio')
      return res.json() as Promise<PortfolioData>
    },
    enabled: !!address,
  })

  if (!address) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <Wallet className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Connect your wallet</h2>
        <p className="text-sm text-muted-foreground">Connect your wallet to view your portfolio.</p>
      </div>
    )
  }

  const totalVaultUSD = data?.vaultBalances.reduce(
    (sum, b) => sum + parseFloat(formatUnits(BigInt(b.balance || '0'), TIP20_DECIMALS)),
    0
  ) ?? 0

  const totalHoldingsUSD = data?.holdings.reduce(
    (sum, h) => sum + parseFloat(formatUnits(BigInt(h.currentValue || '0'), TIP20_DECIMALS)),
    0
  ) ?? 0

  return (
    <>
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">Portfolio</h1>
            <p className="mt-1 text-sm text-muted-foreground font-mono">{shortenAddress(address)}</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => { setDepositTab('deposit'); setDepositOpen(true) }}
            >
              <ArrowDownToLine className="h-4 w-4" />
              Deposit
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => { setDepositTab('withdraw'); setDepositOpen(true) }}
            >
              <ArrowUpFromLine className="h-4 w-4" />
              Withdraw
            </Button>
          </div>
        </div>

        {/* Vault Balances */}
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Trading Balance</h2>
          {isLoading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {[1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {data?.vaultBalances.length === 0 ? (
                <div className="col-span-full rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  No vault balance.{' '}
                  <button className="text-foreground underline" onClick={() => { setDepositTab('deposit'); setDepositOpen(true) }}>
                    Deposit to start trading.
                  </button>
                </div>
              ) : (
                data?.vaultBalances.map((b) => (
                  <div key={b.id} className="rounded-xl border border-border bg-card p-4">
                    <div className="text-xs text-muted-foreground font-mono">{shortenAddress(b.token)}</div>
                    <div className="mt-1 text-xl font-bold">
                      ${parseFloat(formatUnits(BigInt(b.balance || '0'), TIP20_DECIMALS)).toFixed(2)}
                    </div>
                    <div className="text-xs text-muted-foreground">USD</div>
                  </div>
                ))
              )}
              <div className="rounded-xl border border-border bg-secondary/40 p-4">
                <div className="text-xs text-muted-foreground">Total Available</div>
                <div className="mt-1 text-xl font-bold">${totalVaultUSD.toFixed(2)}</div>
              </div>
            </div>
          )}
        </section>

        {/* Holdings */}
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Holdings{data?.holdings.length ? ` (${data.holdings.length})` : ''}
          </h2>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
            </div>
          ) : data?.holdings.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center">
              <p className="text-sm text-muted-foreground">No holdings yet.</p>
              <Link href="/trade" className="mt-3 inline-block text-sm text-foreground underline">Browse agents</Link>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/40">
                    {['Agent', 'Shares', 'Avg Buy', 'Current Value', 'P&L', '24h'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data?.holdings.map((h) => {
                    const pnlNum = parseFloat(formatUnits(BigInt(h.pnl || '0'), TIP20_DECIMALS))
                    const isPositivePnl = pnlNum >= 0
                    const isPositive24h = h.agent.priceChange24h >= 0
                    return (
                      <tr key={h.agentId} className="border-b border-border/50 hover:bg-accent/20">
                        <td className="px-4 py-3">
                          <Link href={`/trade/${h.agentId}`} className="flex items-center gap-2 hover:text-foreground">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-xs font-bold">
                              {h.agent.imageUrl ? (
                                <img src={h.agent.imageUrl} alt={h.agent.name} className="h-full w-full rounded-lg object-cover" />
                              ) : (
                                h.agent.symbol.slice(0, 2)
                              )}
                            </div>
                            <div>
                              <div className="font-medium">{h.agent.name}</div>
                              <div className="text-xs text-muted-foreground font-mono">{h.agent.symbol}</div>
                            </div>
                          </Link>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">
                          {parseFloat(formatUnits(BigInt(h.sharesHeld || '0'), 18)).toFixed(4)}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          ${parseFloat(formatUnits(BigInt(h.avgBuyPrice || '0'), TIP20_DECIMALS)).toFixed(6)}
                        </td>
                        <td className="px-4 py-3 text-xs font-medium">
                          ${parseFloat(formatUnits(BigInt(h.currentValue || '0'), TIP20_DECIMALS)).toFixed(4)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium ${isPositivePnl ? 'text-emerald-500' : 'text-red-500'}`}>
                            {isPositivePnl ? '+' : ''}${pnlNum.toFixed(4)}
                            <br />
                            <span className="text-[10px]">{isPositivePnl ? '+' : ''}{h.pnlPct.toFixed(2)}%</span>
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`flex items-center gap-1 text-xs ${isPositive24h ? 'text-emerald-500' : 'text-red-500'}`}>
                            {isPositive24h ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                            {isPositive24h ? '+' : ''}{h.agent.priceChange24h.toFixed(2)}%
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border bg-secondary/40">
                    <td className="px-4 py-3 text-xs font-medium" colSpan={3}>Total holdings value</td>
                    <td className="px-4 py-3 text-xs font-bold" colSpan={3}>${totalHoldingsUSD.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>

        {/* Created Agents */}
        {(data?.createdAgents.length ?? 0) > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Your Agents</h2>
            <div className="space-y-2">
              {data?.createdAgents.map((a) => (
                <Link
                  key={a.id}
                  href={`/trade/${a.id}`}
                  className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 hover:border-foreground/20"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{a.name}</span>
                      <Badge variant="secondary" className="font-mono text-[10px]">{a.symbol}</Badge>
                      <Badge variant={a.status === 'ACTIVE' ? 'default' : 'warning'} className="text-[10px]">
                        {a.status}
                      </Badge>
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {a.totalTrades} trades · Creator fee: {(a.creatorFeeBps / 100).toFixed(2)}%
                    </div>
                  </div>
                  <div className="ml-auto text-right">
                    <div className="text-sm font-medium">${parseFloat(a.currentPrice || '0').toFixed(6)}</div>
                    <div className="text-xs text-muted-foreground">Vol: ${parseFloat(a.totalVolume || '0').toFixed(2)}</div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Recent Activity */}
        <section>
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Recent Activity</h2>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 rounded-xl" />)}
            </div>
          ) : data?.recentActivity.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No recent activity.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/40">
                    {['Type', 'Amount', 'Token', 'Time'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data?.recentActivity.map((tx) => (
                    <tr key={tx.id} className="border-b border-border/50">
                      <td className="px-4 py-3 text-xs font-medium">{TX_TYPE_LABELS[tx.type] ?? tx.type}</td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {parseFloat(formatUnits(BigInt(tx.amount || '0'), TIP20_DECIMALS)).toFixed(4)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{shortenAddress(tx.token)}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(tx.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <DepositWithdrawModal
        open={depositOpen}
        onOpenChange={setDepositOpen}
        defaultTab={depositTab}
        vaultBalance={data?.vaultBalances[0]?.balance ?? '0'}
        onSuccess={() => { void refetch() }}
      />
    </>
  )
}
