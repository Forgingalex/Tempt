import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

const acceptSchema = z.object({
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid transaction hash'),
})

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Authentication required' }, { status: 401 })
  }

  const { id } = await context.params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = acceptSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  try {
    const purchase = await prisma.purchase.findUnique({
      where: { id },
      select: { id: true, buyerId: true, status: true, agentId: true },
    })

    if (!purchase) {
      return NextResponse.json({ message: 'Purchase not found' }, { status: 404 })
    }

    if (purchase.buyerId !== session.user.id) {
      return NextResponse.json({ message: 'Not authorized' }, { status: 403 })
    }

    if (purchase.status !== 'ESCROWED') {
      return NextResponse.json(
        { message: `Cannot accept a purchase with status: ${purchase.status}` },
        { status: 400 }
      )
    }

    // Update purchase to ACCEPTED and update agent stats
    const [updatedPurchase] = await prisma.$transaction([
      prisma.purchase.update({
        where: { id },
        data: {
          status: 'ACCEPTED',
          acceptedAt: new Date(),
        },
        select: { id: true, status: true },
      }),
      // Increment agent acceptance stats
      prisma.$executeRaw`
        UPDATE "Agent"
        SET
          "totalSales" = "totalSales" + 1,
          "acceptanceRate" = (
            SELECT COUNT(*)::float FILTER (WHERE status = 'ACCEPTED' OR status = 'AUTO_RELEASED')
            / NULLIF(COUNT(*), 0)
            FROM "Purchase"
            WHERE "agentId" = ${purchase.agentId}
          )
        WHERE id = ${purchase.agentId}
      `,
    ])

    return NextResponse.json({
      success: true,
      purchase: { id: updatedPurchase.id, status: 'accepted' },
    })
  } catch (error) {
    console.error('[purchases/[id]/accept POST] Failed:', error)
    return NextResponse.json({ message: 'Failed to record acceptance' }, { status: 500 })
  }
}
