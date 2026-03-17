import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { updateAgentSchema } from '@/lib/validations/agent'
import { parseTokenAmount } from '@/lib/utils'

// CRITICAL: encryptedPrompt is NEVER included
const publicAgentSelect = {
  id: true,
  onChainId: true,
  slug: true,
  name: true,
  description: true,
  doesNotDo: true,
  category: true,
  tags: true,
  inputs: true,
  outputFormat: true,
  demos: true,
  price: true,
  paymentToken: true,
  licenseType: true,
  usageLimit: true,
  llmProvider: true,
  llmModel: true,
  maxTokens: true,
  temperature: true,
  status: true,
  totalSales: true,
  totalExecutions: true,
  acceptanceRate: true,
  disputeRate: true,
  repeatBuyerRate: true,
  sellerId: true,
  createdAt: true,
  updatedAt: true,
  seller: {
    select: {
      id: true,
      walletAddress: true,
      displayName: true,
      avatarUrl: true,
    },
  },
} as const

function serializeAgent(agent: Record<string, unknown>): Record<string, unknown> {
  return {
    ...agent,
    price: String(agent.price),
  }
}

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(
  _request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const { id } = await context.params

  try {
    const agent = await prisma.agent.findFirst({
      where: {
        OR: [{ slug: id }, { id }],
      },
      select: publicAgentSelect,
    })

    if (!agent) {
      return NextResponse.json({ message: 'Agent not found' }, { status: 404 })
    }

    return NextResponse.json({ agent: serializeAgent(agent as unknown as Record<string, unknown>) })
  } catch (error) {
    console.error('Failed to fetch agent:', error)
    return NextResponse.json({ message: 'Failed to fetch agent' }, { status: 500 })
  }
}

export async function PUT(
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

  const parsed = updateAgentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  try {
    const existing = await prisma.agent.findUnique({
      where: { id },
      select: { sellerId: true },
    })

    if (!existing) {
      return NextResponse.json({ message: 'Agent not found' }, { status: 404 })
    }

    if (existing.sellerId !== session.user.id) {
      return NextResponse.json({ message: 'Not authorized to update this agent' }, { status: 403 })
    }

    const data = parsed.data
    const updateData: Record<string, unknown> = {}

    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description
    if (data.doesNotDo !== undefined) updateData.doesNotDo = data.doesNotDo
    if (data.tags !== undefined) updateData.tags = data.tags
    if (data.demos !== undefined) updateData.demos = data.demos
    if (data.maxTokens !== undefined) updateData.maxTokens = data.maxTokens
    if (data.temperature !== undefined) updateData.temperature = data.temperature

    if (data.category !== undefined) {
      const categoryMap: Record<string, string> = {
        writing: 'WRITING', coding: 'CODING', art: 'ART',
        automation: 'AUTOMATION', research: 'RESEARCH', other: 'OTHER',
      }
      updateData.category = categoryMap[data.category]
    }

    if (data.price !== undefined) {
      updateData.price = parseTokenAmount(data.price)
    }

    const agent = await prisma.agent.update({
      where: { id },
      data: updateData,
      select: publicAgentSelect,
    })

    return NextResponse.json({ agent: serializeAgent(agent as unknown as Record<string, unknown>) })
  } catch (error) {
    console.error('Failed to update agent:', error)
    return NextResponse.json({ message: 'Failed to update agent' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Authentication required' }, { status: 401 })
  }

  const { id } = await context.params

  try {
    const existing = await prisma.agent.findUnique({
      where: { id },
      select: { sellerId: true, status: true },
    })

    if (!existing) {
      return NextResponse.json({ message: 'Agent not found' }, { status: 404 })
    }

    if (existing.sellerId !== session.user.id && session.user.role !== 'ADMIN') {
      return NextResponse.json({ message: 'Not authorized to delist this agent' }, { status: 403 })
    }

    if (existing.status === 'DELISTED') {
      return NextResponse.json({ message: 'Agent is already delisted' }, { status: 400 })
    }

    await prisma.agent.update({
      where: { id },
      data: { status: 'DELISTED' },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delist agent:', error)
    return NextResponse.json({ message: 'Failed to delist agent' }, { status: 500 })
  }
}
