import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(
  _request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Authentication required' }, { status: 401 })
  }

  const { id } = await context.params

  try {
    const purchase = await prisma.purchase.findUnique({
      where: { id },
      select: {
        id: true,
        escrowId: true,
        txHash: true,
        agentId: true,
        buyerId: true,
        amount: true,
        paymentToken: true,
        status: true,
        usagesRemaining: true,
        autoReleaseAt: true,
        acceptedAt: true,
        disputedAt: true,
        resolvedAt: true,
        createdAt: true,
        agent: {
          select: {
            name: true,
            slug: true,
          },
        },
        disputes: {
          select: {
            id: true,
            reason: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })

    if (!purchase) {
      return NextResponse.json({ message: 'Purchase not found' }, { status: 404 })
    }

    // Only the buyer can view their own purchase
    if (purchase.buyerId !== session.user.id) {
      return NextResponse.json({ message: 'Not authorized' }, { status: 403 })
    }

    const now = new Date()
    const autoReleaseAt = new Date(purchase.autoReleaseAt)
    const msRemaining = Math.max(0, autoReleaseAt.getTime() - now.getTime())
    const daysRemaining = Math.floor(msRemaining / (1000 * 60 * 60 * 24))
    const hoursRemaining = Math.floor((msRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))

    return NextResponse.json({
      purchase: {
        id: purchase.id,
        escrowId: purchase.escrowId !== null ? Number(purchase.escrowId) : null,
        txHash: purchase.txHash,
        agentId: purchase.agentId,
        agentName: purchase.agent.name,
        agentSlug: purchase.agent.slug,
        buyerId: purchase.buyerId,
        amount: String(purchase.amount),
        paymentToken: purchase.paymentToken,
        status: purchase.status.toLowerCase(),
        usagesRemaining: purchase.usagesRemaining,
        autoReleaseAt: purchase.autoReleaseAt.toISOString(),
        acceptedAt: purchase.acceptedAt?.toISOString() ?? null,
        disputedAt: purchase.disputedAt?.toISOString() ?? null,
        resolvedAt: purchase.resolvedAt?.toISOString() ?? null,
        createdAt: purchase.createdAt.toISOString(),
        countdown: { daysRemaining, hoursRemaining, msRemaining },
        latestDispute: purchase.disputes[0] ?? null,
      },
    })
  } catch (error) {
    console.error('[purchases/[id] GET] Failed:', error)
    return NextResponse.json({ message: 'Failed to fetch purchase' }, { status: 500 })
  }
}
