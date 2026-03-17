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

  // All trades by this user grouped by agent
  const buyTrades = await prisma.trade.findMany({
    where: { trader: walletAddress, type: 'BUY' },
    include: { agent: { select: { id: true, name: true, symbol: true, imageUrl: true, currentPrice: true, priceChange24h: true, onChainAgentId: true } } },
    orderBy: { createdAt: 'desc' },
  })

  const sellTrades = await prisma.trade.findMany({
    where: { trader: walletAddress, type: 'SELL' },
    select: { agentId: true, shareAmount: true, stableAmount: true },
  })

  // Compute net shares held per agent
  const holdingsMap = new Map<string, { sharesIn: bigint; sharesOut: bigint; stableIn: bigint; agent: (typeof buyTrades)[0]['agent'] }>()

  for (const t of buyTrades) {
    const existing = holdingsMap.get(t.agentId)
    if (existing) {
      existing.sharesIn += BigInt(t.shareAmount)
      existing.stableIn += BigInt(t.stableAmount)
    } else {
      holdingsMap.set(t.agentId, {
        sharesIn: BigInt(t.shareAmount),
        sharesOut: 0n,
        stableIn: BigInt(t.stableAmount),
        agent: t.agent,
      })
    }
  }

  for (const t of sellTrades) {
    const existing = holdingsMap.get(t.agentId)
    if (existing) {
      existing.sharesOut += BigInt(t.shareAmount)
    }
  }

  const holdings = Array.from(holdingsMap.entries())
    .map(([agentId, data]) => {
      const netShares = data.sharesIn - data.sharesOut
      if (netShares <= 0n) return null

      const currentPrice = BigInt(data.agent.currentPrice ?? '0')
      const currentValue = (netShares * currentPrice) / BigInt(1e18)
      const avgBuyPrice = data.sharesIn > 0n ? (data.stableIn * BigInt(1e18)) / data.sharesIn : 0n
      const pnl = currentValue - data.stableIn

      return {
        agentId,
        agent: data.agent,
        sharesHeld: netShares.toString(),
        currentValue: currentValue.toString(),
        avgBuyPrice: avgBuyPrice.toString(),
        totalInvested: data.stableIn.toString(),
        pnl: pnl.toString(),
        pnlPct: data.stableIn > 0n ? Number((pnl * 10000n) / data.stableIn) / 100 : 0,
      }
    })
    .filter(Boolean)

  // Vault balances
  const vaultBalances = await prisma.vaultBalance.findMany({
    where: { user: walletAddress },
  })

  // Recent vault activity
  const recentActivity = await prisma.vaultTransaction.findMany({
    where: { user: walletAddress },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })

  // Agents this user created
  const createdAgents = await prisma.tradeableAgent.findMany({
    where: { creator: walletAddress },
    select: {
      id: true,
      onChainAgentId: true,
      name: true,
      symbol: true,
      currentPrice: true,
      totalVolume: true,
      totalTrades: true,
      status: true,
      creatorFeeBps: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({
    holdings,
    vaultBalances,
    recentActivity,
    createdAgents,
  })
}
