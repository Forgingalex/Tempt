import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

const listSchema = z.object({
  sort: z.enum(['trending', 'newest', 'volume', 'price_asc', 'price_desc', 'holders']).optional().default('trending'),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
  status: z.enum(['ACTIVE', 'PAUSED', 'DELISTED', 'SLASHED']).optional(),
})

const createSchema = z.object({
  onChainAgentId: z.number().int().nonnegative(),
  creator: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  metadataUri: z.string().url(),
  codeHash: z.string().min(1),
  name: z.string().min(1).max(80),
  symbol: z.string().min(1).max(10),
  description: z.string().min(10),
  imageUrl: z.string().url().optional(),
  supplyCap: z.string().min(1),
  bondAmount: z.string().min(1),
  creatorFeeBps: z.number().int().min(0).max(500),
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
})

function serializeAgent(agent: Record<string, unknown>): Record<string, unknown> {
  return {
    ...agent,
    totalVolume: String(agent.totalVolume ?? '0'),
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const parsed = listSchema.safeParse(Object.fromEntries(searchParams))
  if (!parsed.success) {
    return NextResponse.json({ message: 'Invalid query params', details: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  const { sort, limit, offset, status } = parsed.data

  const orderBy = {
    trending:   { priceChange24h: 'desc' as const },
    newest:     { createdAt: 'desc' as const },
    volume:     { totalVolume: 'desc' as const },
    price_asc:  { currentPrice: 'asc' as const },
    price_desc: { currentPrice: 'desc' as const },
    holders:    { holders: 'desc' as const },
  }[sort]

  const where = {
    status: status ?? 'ACTIVE',
  }

  const [agents, total] = await Promise.all([
    prisma.tradeableAgent.findMany({
      where,
      orderBy,
      take: limit,
      skip: offset,
    }),
    prisma.tradeableAgent.count({ where }),
  ])

  return NextResponse.json({
    agents: agents.map((a) => serializeAgent(a as unknown as Record<string, unknown>)),
    total,
    limit,
    offset,
  })
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Authentication required' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ message: 'Validation failed', details: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  const data = parsed.data

  // Check onChainAgentId not already registered
  const existing = await prisma.tradeableAgent.findUnique({
    where: { onChainAgentId: data.onChainAgentId },
  })
  if (existing) {
    return NextResponse.json({ message: 'Agent already registered' }, { status: 409 })
  }

  const agent = await prisma.tradeableAgent.create({
    data: {
      onChainAgentId: data.onChainAgentId,
      creator: data.creator.toLowerCase(),
      metadataUri: data.metadataUri,
      codeHash: data.codeHash,
      name: data.name,
      symbol: data.symbol.toUpperCase(),
      description: data.description,
      imageUrl: data.imageUrl,
      supplyCap: data.supplyCap,
      bondAmount: data.bondAmount,
      creatorFeeBps: data.creatorFeeBps,
    },
  })

  return NextResponse.json({ agent: serializeAgent(agent as unknown as Record<string, unknown>) }, { status: 201 })
}
