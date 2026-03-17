import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/agents/[id]/access
 * Returns whether the current authenticated user has an active purchase for this agent.
 * Used for access control on the usage interface page.
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ hasAccess: false, reason: 'not_authenticated' })
  }

  const { id } = await context.params

  try {
    const purchase = await prisma.purchase.findFirst({
      where: {
        agentId: id,
        buyerId: session.user.id,
        status: { in: ['ESCROWED', 'ACCEPTED', 'AUTO_RELEASED'] },
      },
      select: {
        id: true,
        status: true,
        usagesRemaining: true,
        autoReleaseAt: true,
        escrowId: true,
        paymentToken: true,
        amount: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!purchase) {
      return NextResponse.json({ hasAccess: false, reason: 'no_purchase' })
    }

    return NextResponse.json({
      hasAccess: true,
      purchase: {
        id: purchase.id,
        status: purchase.status.toLowerCase(),
        usagesRemaining: purchase.usagesRemaining,
        autoReleaseAt: purchase.autoReleaseAt.toISOString(),
        escrowId: purchase.escrowId !== null ? Number(purchase.escrowId) : null,
        paymentToken: purchase.paymentToken,
        amount: String(purchase.amount),
      },
    })
  } catch (error) {
    console.error('[agents/[id]/access GET] Failed:', error)
    return NextResponse.json({ hasAccess: false, reason: 'error' })
  }
}
