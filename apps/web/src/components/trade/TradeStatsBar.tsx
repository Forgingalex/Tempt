interface TradeStatsBarProps {
  totalAgents: number
  totalTrades: number
  totalVolume24h: string
  totalHolders?: number
}

export function TradeStatsBar({ totalAgents, totalTrades, totalVolume24h }: TradeStatsBarProps): React.ReactElement {
  const stats = [
    { label: 'Total Volume (24h)', value: `$${Number(totalVolume24h || 0).toFixed(2)}` },
    { label: 'Total Agents', value: totalAgents.toLocaleString() },
    { label: 'Total Trades', value: totalTrades.toLocaleString() },
  ]

  return (
    <div className="flex flex-wrap items-center gap-6 border-b border-border bg-secondary/40 px-6 py-3">
      {stats.map((s, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">{s.label}</span>
          <span className="font-semibold">{s.value}</span>
        </div>
      ))}
    </div>
  )
}
