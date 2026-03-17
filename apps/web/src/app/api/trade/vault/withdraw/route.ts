import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

const withdrawSchema = z.object({
  token: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  amount: z.string().min(1),
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
})

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Authentication required' }, { status: 401 })
  }

  const walletAddress = session.user.walletAddress?.toLowerCase()
  if (!walletAddress) {
    return NextResponse.json({ message: 'No wallet address' }, { status: 400 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = withdrawSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ message: 'Validation failed', details: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  const { token, amount, txHash } = parsed.data

  const existing = await prisma.vaultTransaction.findUnique({ where: { txHash } })
  if (existing) {
    return NextResponse.json({ message: 'Transaction already recorded' }, { status: 409 })
  }

  const tokenLower = token.toLowerCase()
  const amountBig = BigInt(amount)

  // Check sufficient balance
  const vaultBalance = await prisma.vaultBalance.findUnique({
    where: { user_token: { user: walletAddress, token: tokenLower } },
  })
  const currentBalance = BigInt(vaultBalance?.balance ?? '0')
  if (currentBalance < amountBig) {
    return NextResponse.json({ message: 'Insufficient vault balance' }, { status: 400 })
  }

  const newBalance = (currentBalance - amountBig).toString()

  const [tx] = await prisma.$transaction([
    prisma.vaultTransaction.create({
      data: {
        user: walletAddress,
        token: tokenLower,
        amount,
        type: 'WITHDRAWAL',
        txHash,
      },
    }),
    prisma.vaultBalance.update({
      where: { user_token: { user: walletAddress, token: tokenLower } },
      data: { balance: newBalance },
    }),
  ])

  return NextResponse.json({ transaction: tx, newBalance }, { status: 201 })
}
