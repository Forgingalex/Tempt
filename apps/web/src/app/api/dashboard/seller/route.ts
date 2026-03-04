import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Authentication required' }, { status: 401 })
  }

  try {
    const agents = await prisma.agent.findMany({
      where: { sellerId: session.user.id },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        category: true,
        price: true,
        paymentToken: true,
        licenseType: true,
        status: true,
        totalSales: true,
        totalExecutions: true,
        acceptanceRate: true,
        disputeRate: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    const totalRevenue = agents.reduce((sum, a) => {
      return sum + (a.price * BigInt(a.totalSales))
    }, BigInt(0))

    const totalSales = agents.reduce((sum, a) => sum + a.totalSales, 0)
    const totalExecutions = agents.reduce((sum, a) => sum + a.totalExecutions, 0)

    const agentsWithSales = agents.filter((a) => a.totalSales > 0)
    const avgAcceptanceRate =
      agentsWithSales.length > 0
        ? agentsWithSales.reduce((sum, a) => sum + a.acceptanceRate, 0) / agentsWithSales.length
        : 0

    const activeAgents = agents.filter((a) => a.status === 'LISTED' || a.status === 'APPROVED')

    const serializedAgents = agents.map((a) => ({
      ...a,
      price: String(a.price),
    }))

    return NextResponse.json({
      agents: serializedAgents,
      stats: {
        totalAgents: agents.length,
        activeAgents: activeAgents.length,
        totalSales,
        totalExecutions,
        totalRevenue: String(totalRevenue),
        avgAcceptanceRate,
      },
    })
  } catch (error) {
    console.error('Failed to fetch seller dashboard:', error)
    return NextResponse.json({ message: 'Failed to fetch dashboard data' }, { status: 500 })
  }
}
