import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

interface RouteParams {
  params: Promise<{ id: string }>
}

const sellSchema = z.object({
  trader: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  stableAmount: z.string().min(1),
  shareAmount: z.string().min(1),
  pricePerShare: z.string().min(1),
  fee: z.string().min(1),
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  newPrice: z.string().min(1),
  newSupply: z.string().min(1),
  newReserve: z.string().min(1),
})

export async function POST(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Authentication required' }, { status: 401 })
  }

  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = sellSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ message: 'Validation failed', details: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  const agent = await prisma.tradeableAgent.findFirst({
    where: { OR: [{ id }, { onChainAgentId: isNaN(Number(id)) ? undefined : Number(id) }] },
    select: { id: true },
  })
  if (!agent) {
    return NextResponse.json({ message: 'Agent not found' }, { status: 404 })
  }

  const { trader, stableAmount, shareAmount, pricePerShare, fee, txHash, newPrice, newSupply, newReserve } = parsed.data

  const existingTrade = await prisma.trade.findUnique({ where: { txHash } })
  if (existingTrade) {
    return NextResponse.json({ message: 'Transaction already recorded' }, { status: 409 })
  }

  const [trade] = await prisma.$transaction([
    prisma.trade.create({
      data: {
        agentId: agent.id,
        trader: trader.toLowerCase(),
        type: 'SELL',
        stableAmount,
        shareAmount,
        pricePerShare,
        fee,
        txHash,
      },
    }),
    prisma.tradeableAgent.update({
      where: { id: agent.id },
      data: {
        currentPrice: newPrice,
        currentSupply: newSupply,
        reserveBalance: newReserve,
        totalTrades: { increment: 1 },
      },
    }),
  ])

  return NextResponse.json({ trade }, { status: 201 })
}
