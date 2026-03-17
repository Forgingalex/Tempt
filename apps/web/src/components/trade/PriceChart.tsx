'use client'

import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { formatUnits } from 'viem'
import { TIP20_DECIMALS } from '@/lib/tempo'

interface PricePoint {
  time: string
  price: number
}

interface PriceChartProps {
  trades: Array<{
    createdAt: string
    pricePerShare: string
    type: string
  }>
  currentPrice: string
  priceChange24h: number
}

const TIME_RANGES = ['1H', '24H', '7D', '30D', 'All'] as const
type TimeRange = (typeof TIME_RANGES)[number]

function filterByRange(trades: PriceChartProps['trades'], range: TimeRange): PricePoint[] {
  const now = Date.now()
  const cutoffs: Record<TimeRange, number> = {
    '1H':  now - 60 * 60 * 1000,
    '24H': now - 24 * 60 * 60 * 1000,
    '7D':  now - 7 * 24 * 60 * 60 * 1000,
    '30D': now - 30 * 24 * 60 * 60 * 1000,
    'All': 0,
  }
  const cutoff = cutoffs[range]

  return trades
    .filter((t) => new Date(t.createdAt).getTime() >= cutoff)
    .map((t) => ({
      time: new Date(t.createdAt).toLocaleString(),
      price: parseFloat(formatUnits(BigInt(t.pricePerShare || '0'), TIP20_DECIMALS)),
    }))
}

export function PriceChart({ trades, currentPrice, priceChange24h }: PriceChartProps): React.ReactElement {
  const [range, setRange] = useState<TimeRange>('24H')
  const data = filterByRange(trades, range)
  const currentPriceNum = parseFloat(formatUnits(BigInt(currentPrice || '0'), TIP20_DECIMALS))
  const isPositive = priceChange24h >= 0

  if (data.length === 0) {
    data.push({ time: 'Now', price: currentPriceNum })
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div>
          <div className="text-2xl font-bold">${currentPriceNum.toFixed(6)}</div>
          <div className={`mt-0.5 text-sm font-medium ${isPositive ? 'text-emerald-500' : 'text-red-500'}`}>
            {isPositive ? '+' : ''}{priceChange24h.toFixed(2)}% (24h)
          </div>
        </div>
        {/* Time range toggles */}
        <div className="flex rounded-lg border border-border p-0.5">
          {TIME_RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                range === r ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <XAxis
              dataKey="time"
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
              hide={data.length < 3}
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `$${v.toFixed(4)}`}
              width={52}
              domain={['auto', 'auto']}
            />
            <Tooltip
              contentStyle={{
                background: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '11px',
              }}
              formatter={(v: unknown) => [`$${typeof v === 'number' ? v.toFixed(6) : v}`, 'Price']}
            />
            <Line
              type="monotone"
              dataKey="price"
              stroke={isPositive ? '#10b981' : '#ef4444'}
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
