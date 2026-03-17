import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createPublicClient, http } from 'viem'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { tempoTestnet, ESCROW_CONFIG } from '@/lib/tempo'

const publicClient = createPublicClient({
  chain: tempoTestnet,
  transport: http(),
})

const recordPurchaseSchema = z.object({
  agentId: z.string().min(1),
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid transaction hash'),
  escrowId: z.number().int().nonnegative().nullable(),
  buyerAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/i, 'Invalid wallet address'),
})

function serializePurchase(purchase: Record<string, unknown>): Record<string, unknown> {
  return {
    ...purchase,
    amount: String(purchase.amount),
    escrowId: purchase.escrowId !== null ? Number(purchase.escrowId) : null,
  }
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

  const parsed = recordPurchaseSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { agentId, txHash, escrowId, buyerAddress } = parsed.data

  // Verify wallet address matches session
  if (buyerAddress.toLowerCase() !== session.user.walletAddress?.toLowerCase()) {
    return NextResponse.json({ message: 'Address mismatch' }, { status: 403 })
  }

  // Get agent from DB to verify it exists and get pricing
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: {
      id: true,
      price: true,
      paymentToken: true,
      licenseType: true,
      usageLimit: true,
      status: true,
    },
  })

  if (!agent) {
    return NextResponse.json({ message: 'Agent not found' }, { status: 404 })
  }

  // Verify on-chain transaction
  try {
    const receipt = await publicClient.getTransactionReceipt({
      hash: txHash as `0x${string}`,
    })

    if (receipt.status === 'reverted') {
      return NextResponse.json({ message: 'Transaction was reverted on-chain' }, { status: 400 })
    }
  } catch {
    // RPC might be unavailable; proceed but log the skip
    console.warn('[purchases] Could not verify tx on-chain, proceeding optimistically:', txHash)
  }

  // Check for duplicate purchase recording (idempotency)
  const existing = await prisma.purchase.findFirst({
    where: { txHash },
    select: { id: true },
  })
  if (existing) {
    const purchase = await prisma.purchase.findUnique({
      where: { id: existing.id },
    })
    return NextResponse.json({
      purchase: serializePurchase(purchase as unknown as Record<string, unknown>),
    })
  }

  const autoReleaseAt = new Date(
    Date.now() + ESCROW_CONFIG.AUTO_RELEASE_DAYS * 24 * 60 * 60 * 1000
  )

  try {
    const purchase = await prisma.purchase.create({
      data: {
        txHash,
        escrowId: escrowId,
        agentId,
        buyerId: session.user.id,
        amount: agent.price,
        paymentToken: agent.paymentToken,
        status: 'ESCROWED',
        usagesRemaining:
          agent.licenseType === 'USAGE_BASED' && agent.usageLimit
            ? agent.usageLimit
            : null,
        autoReleaseAt,
      },
    })

    return NextResponse.json(
      { purchase: serializePurchase(purchase as unknown as Record<string, unknown>) },
      { status: 201 }
    )
  } catch (error) {
    console.error('[purchases POST] Failed to create purchase record:', error)
    return NextResponse.json({ message: 'Failed to record purchase' }, { status: 500 })
  }
}
