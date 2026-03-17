import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(_request: NextRequest): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Authentication required' }, { status: 401 })
  }

  const walletAddress = session.user.walletAddress?.toLowerCase()
  if (!walletAddress) {
    return NextResponse.json({ message: 'No wallet address' }, { status: 400 })
  }

  const balances = await prisma.vaultBalance.findMany({
    where: { user: walletAddress },
  })

  return NextResponse.json({ balances })
}
