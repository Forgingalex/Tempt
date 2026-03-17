import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
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
        take: 10,
      },
    },
  })

  if (!agent) {
    return NextResponse.json({ message: 'Agent not found' }, { status: 404 })
  }

  return NextResponse.json({ agent })
}
