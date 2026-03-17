import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

const disputeSchema = z.object({
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid transaction hash'),
  reason: z.string().min(10, 'Reason must be at least 10 characters').max(2000),
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

  const parsed = disputeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { reason } = parsed.data

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
        { message: `Cannot dispute a purchase with status: ${purchase.status}` },
        { status: 400 }
      )
    }

    // Update purchase to DISPUTED and create Dispute record
    const [, dispute] = await prisma.$transaction([
      prisma.purchase.update({
        where: { id },
        data: {
          status: 'DISPUTED',
          disputedAt: new Date(),
        },
      }),
      prisma.dispute.create({
        data: {
          purchaseId: id,
          buyerId: session.user.id,
          reason,
          status: 'OPEN',
        },
        select: {
          id: true,
          reason: true,
          status: true,
          createdAt: true,
        },
      }),
    ])

    return NextResponse.json({
      success: true,
      dispute: {
        ...dispute,
        createdAt: dispute.createdAt.toISOString(),
      },
    })
  } catch (error) {
    console.error('[purchases/[id]/dispute POST] Failed:', error)
    return NextResponse.json({ message: 'Failed to record dispute' }, { status: 500 })
  }
}
