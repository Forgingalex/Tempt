import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
  type: z.enum(['DEPOSIT', 'WITHDRAWAL', 'TRADE_DEBIT', 'TRADE_CREDIT']).optional(),
})

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Authentication required' }, { status: 401 })
  }

  const walletAddress = session.user.walletAddress?.toLowerCase()
  if (!walletAddress) {
    return NextResponse.json({ message: 'No wallet address' }, { status: 400 })
  }

  const { searchParams } = new URL(request.url)
  const parsed = querySchema.safeParse(Object.fromEntries(searchParams))
  if (!parsed.success) {
    return NextResponse.json({ message: 'Invalid query' }, { status: 400 })
  }
  const { limit, offset, type } = parsed.data

  const where = { user: walletAddress, ...(type ? { type } : {}) }

  const [transactions, total] = await Promise.all([
    prisma.vaultTransaction.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit, skip: offset }),
    prisma.vaultTransaction.count({ where }),
  ])

  return NextResponse.json({ transactions, total, limit, offset })
}
