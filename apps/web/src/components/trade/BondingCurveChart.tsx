'use client'

import { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceDot } from 'recharts'
import { formatUnits } from 'viem'

interface BondingCurveChartProps {
  currentSupply: string
  supplyCap: string
  currentPrice: string
  className?: string
}

export function BondingCurveChart({
  currentSupply,
  supplyCap,
  currentPrice,
  className = '',
}: BondingCurveChartProps): React.ReactElement {
  const data = useMemo(() => {
    const capNum = parseFloat(formatUnits(BigInt(supplyCap || '100000000000000000000000000'), 18))
    const points = 60

    return Array.from({ length: points + 1 }, (_, i) => {
      const supply = (capNum / points) * i
      // Square-root bonding curve: price = reserve/supply
      // With initial reserve=10 (6dec) and initial supply=1000 (18dec)
      // price ≈ (10 + supply * initialPrice) / (1000 + supply), approximation for chart display
      const initialPrice = 0.01 // $0.01 starting price
      const price = initialPrice * (1 + supply / 1000) ** 2 // approximation
      return { supply: supply / 1e6, price } // display in millions
    })
  }, [supplyCap])

  const currentSupplyNum = parseFloat(formatUnits(BigInt(currentSupply || '0'), 18)) / 1e6
  const currentPriceNum = parseFloat(formatUnits(BigInt(currentPrice || '0'), 6))

  return (
    <div className={`rounded-xl border border-border bg-card p-4 ${className}`}>
      <p className="mb-3 text-xs font-medium text-muted-foreground">Bonding Curve</p>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <XAxis
              dataKey="supply"
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `${v.toFixed(0)}M`}
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `$${v.toFixed(3)}`}
              width={48}
            />
            <Tooltip
              contentStyle={{
                background: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '11px',
              }}
              formatter={(v: unknown) => [`$${typeof v === 'number' ? v.toFixed(4) : v}`, 'Price']}
              labelFormatter={(l: unknown) => `Supply: ${typeof l === 'number' ? l.toFixed(2) : l}M`}
            />
            <Line
              type="monotone"
              dataKey="price"
              stroke="hsl(var(--foreground))"
              strokeWidth={2}
              dot={false}
              strokeOpacity={0.7}
            />
            {currentSupplyNum > 0 && (
              <ReferenceDot
                x={currentSupplyNum}
                y={currentPriceNum}
                r={5}
                fill="hsl(var(--foreground))"
                stroke="hsl(var(--background))"
                strokeWidth={2}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-center text-[10px] text-muted-foreground">
        Supply (M shares) → Price ($)
      </p>
    </div>
  )
}
