import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'

const querySchema = z.object({
  sort: z.enum(['volume', 'price_change', 'market_cap', 'holders', 'newest']).optional().default('volume'),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
})

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const parsed = querySchema.safeParse(Object.fromEntries(searchParams))
  if (!parsed.success) {
    return NextResponse.json({ message: 'Invalid query' }, { status: 400 })
  }
  const { sort, limit } = parsed.data

  const orderBy = {
    volume:       { totalVolume: 'desc' as const },
    price_change: { priceChange24h: 'desc' as const },
    market_cap:   { currentPrice: 'desc' as const },
    holders:      { holders: 'desc' as const },
    newest:       { createdAt: 'desc' as const },
  }[sort]

  const agents = await prisma.tradeableAgent.findMany({
    where: { status: 'ACTIVE' },
    orderBy,
    take: limit,
    select: {
      id: true,
      onChainAgentId: true,
      name: true,
      symbol: true,
      imageUrl: true,
      currentPrice: true,
      priceChange24h: true,
      totalVolume: true,
      holders: true,
      totalTrades: true,
      currentSupply: true,
      supplyCap: true,
      createdAt: true,
    },
  })

  // Compute platform-level stats
  const [totalVolume, totalTrades, totalAgents] = await Promise.all([
    prisma.tradeableAgent.aggregate({ _sum: { totalTrades: true }, where: { status: 'ACTIVE' } }),
    prisma.trade.count(),
    prisma.tradeableAgent.count({ where: { status: 'ACTIVE' } }),
  ])

  return NextResponse.json({
    agents,
    stats: {
      totalAgents,
      totalTrades: totalTrades,
      totalVolume24h: '0',
      totalTradesCount: totalVolume._sum.totalTrades ?? 0,
    },
  })
}
