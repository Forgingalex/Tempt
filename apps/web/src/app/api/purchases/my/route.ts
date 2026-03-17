import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Authentication required' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const agentId = searchParams.get('agentId')

  try {
    const where: Record<string, unknown> = { buyerId: session.user.id }
    if (agentId) {
      where.agentId = agentId
    }

    const purchases = await prisma.purchase.findMany({
      where,
      select: {
        id: true,
        escrowId: true,
        txHash: true,
        agentId: true,
        amount: true,
        paymentToken: true,
        status: true,
        usagesRemaining: true,
        autoReleaseAt: true,
        acceptedAt: true,
        disputedAt: true,
        createdAt: true,
        agent: {
          select: {
            name: true,
            slug: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const serialized = purchases.map((p) => ({
      id: p.id,
      escrowId: p.escrowId !== null ? Number(p.escrowId) : null,
      txHash: p.txHash,
      agentId: p.agentId,
      agentName: p.agent.name,
      agentSlug: p.agent.slug,
      buyerId: session.user.id,
      amount: String(p.amount),
      paymentToken: p.paymentToken,
      status: p.status.toLowerCase() as string,
      usagesRemaining: p.usagesRemaining,
      autoReleaseAt: p.autoReleaseAt.toISOString(),
      acceptedAt: p.acceptedAt?.toISOString() ?? null,
      disputedAt: p.disputedAt?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
    }))

    return NextResponse.json({ purchases: serialized })
  } catch (error) {
    console.error('[purchases/my GET] Failed:', error)
    return NextResponse.json({ message: 'Failed to fetch purchases' }, { status: 500 })
  }
}
