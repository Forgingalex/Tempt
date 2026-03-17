import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { slugify, parseTokenAmount } from '@/lib/utils'
import { createAgentSchema } from '@/lib/validations/agent'
import { encryptPrompt } from '@/lib/encryption'
import { randomBytes } from 'crypto'

// CRITICAL: encryptedPrompt is NEVER included in any select
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

// BigInt → string for JSON serialization
function serializeAgent(agent: Record<string, unknown>): Record<string, unknown> {
  return {
    ...agent,
    price: String(agent.price),
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

  const parsed = createAgentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const data = parsed.data

  const baseSlug = slugify(data.name)
  const suffix = randomBytes(3).toString('hex')
  const slug = `${baseSlug}-${suffix}`

  // Encrypt prompt server-side — never stored as plaintext
  const encrypted = encryptPrompt(data.systemPrompt)
  const priceBigInt = parseTokenAmount(data.price)

  const categoryMap: Record<string, string> = {
    writing: 'WRITING', coding: 'CODING', art: 'ART',
    automation: 'AUTOMATION', research: 'RESEARCH', other: 'OTHER',
  }

  const outputFormatMap: Record<string, string> = {
    text: 'TEXT', markdown: 'MARKDOWN', code: 'CODE',
    json: 'JSON', structured: 'STRUCTURED',
  }

  const licenseTypeMap: Record<string, string> = {
    'one-time': 'ONE_TIME', 'usage-based': 'USAGE_BASED',
  }

  try {
    // Promote BUYER → BOTH when they create their first agent
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    if (user && user.role === 'BUYER') {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { role: 'BOTH' },
      })
    }

    const agent = await prisma.agent.create({
      data: {
        slug,
        name: data.name,
        description: data.description,
        doesNotDo: data.doesNotDo,
        category: categoryMap[data.category] as 'WRITING' | 'CODING' | 'ART' | 'AUTOMATION' | 'RESEARCH' | 'OTHER',
        tags: data.tags,
        encryptedPrompt: encrypted,
        promptTemplate: data.promptTemplate ?? null,
        inputs: data.inputs as unknown as Prisma.InputJsonValue,
        outputFormat: outputFormatMap[data.outputFormat] as 'TEXT' | 'MARKDOWN' | 'CODE' | 'JSON' | 'STRUCTURED',
        demos: data.demos as unknown as Prisma.InputJsonValue,
        price: priceBigInt,
        paymentToken: data.paymentToken,
        licenseType: licenseTypeMap[data.licenseType] as 'ONE_TIME' | 'USAGE_BASED',
        usageLimit: data.usageLimit ?? null,
        llmProvider: data.llmProvider,
        llmModel: data.llmModel,
        maxTokens: data.maxTokens,
        temperature: data.temperature,
        sellerId: session.user.id,
      },
      select: publicAgentSelect,
    })

    return NextResponse.json({ agent: serializeAgent(agent as unknown as Record<string, unknown>) }, { status: 201 })
  } catch (error) {
    console.error('Failed to create agent:', error)
    return NextResponse.json({ message: 'Failed to create agent' }, { status: 500 })
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)

  const category = searchParams.get('category')
  const search = searchParams.get('search')
  const sort = searchParams.get('sort') || 'newest'
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10)))
  const skip = (page - 1) * pageSize

  // Public listing only shows LISTED agents
  const where: Record<string, unknown> = { status: 'LISTED' }

  if (category) {
    const categoryMap: Record<string, string> = {
      writing: 'WRITING', coding: 'CODING', art: 'ART',
      automation: 'AUTOMATION', research: 'RESEARCH', other: 'OTHER',
    }
    if (categoryMap[category]) {
      where.category = categoryMap[category]
    }
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
      { tags: { has: search.toLowerCase() } },
    ]
  }

  let orderBy: Record<string, string>
  switch (sort) {
    case 'price_asc':
      orderBy = { price: 'asc' }
      break
    case 'price_desc':
      orderBy = { price: 'desc' }
      break
    case 'most_used':
      orderBy = { totalExecutions: 'desc' }
      break
    case 'highest_rated':
      orderBy = { acceptanceRate: 'desc' }
      break
    case 'trending':
      orderBy = { totalSales: 'desc' }
      break
    case 'newest':
    default:
      orderBy = { createdAt: 'desc' }
      break
  }

  try {
    const [agents, total] = await Promise.all([
      prisma.agent.findMany({
        where,
        select: publicAgentSelect,
        orderBy,
        skip,
        take: pageSize,
      }),
      prisma.agent.count({ where }),
    ])

    const serialized = agents.map((a) => serializeAgent(a as unknown as Record<string, unknown>))

    return NextResponse.json({
      agents: serialized,
      total,
      page,
      pageSize,
      hasMore: skip + agents.length < total,
    })
  } catch (error) {
    console.error('Failed to list agents:', error)
    return NextResponse.json({ message: 'Failed to fetch agents' }, { status: 500 })
  }
}
