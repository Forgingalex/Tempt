import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'

interface RouteParams {
  params: Promise<{ id: string }>
}

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
  type: z.enum(['BUY', 'SELL']).optional(),
})

export async function GET(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params
  const { searchParams } = new URL(request.url)
  const parsed = querySchema.safeParse(Object.fromEntries(searchParams))
  if (!parsed.success) {
    return NextResponse.json({ message: 'Invalid query' }, { status: 400 })
  }
  const { limit, offset, type } = parsed.data

  const agent = await prisma.tradeableAgent.findFirst({
    where: {
      OR: [{ id }, { onChainAgentId: isNaN(Number(id)) ? undefined : Number(id) }],
    },
    select: { id: true },
  })
  if (!agent) {
    return NextResponse.json({ message: 'Agent not found' }, { status: 404 })
  }

  const where = { agentId: agent.id, ...(type ? { type } : {}) }

  const [trades, total] = await Promise.all([
    prisma.trade.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit, skip: offset }),
    prisma.trade.count({ where }),
  ])

  return NextResponse.json({ trades, total, limit, offset })
}
