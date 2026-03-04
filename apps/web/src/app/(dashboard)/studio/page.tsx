'use client'

import Link from 'next/link'
import { Plus, Package, DollarSign, BarChart3, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { AgentList } from '@/components/studio/AgentList'
import { useSellerDashboard } from '@/hooks/use-studio'
import { formatTokenAmount } from '@/lib/utils'

export default function StudioPage(): React.ReactElement {
  const { data, isLoading, error } = useSellerDashboard()

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      {/* Page header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Studio</h1>
          <p className="mt-1 text-muted-foreground">Create and manage your AI agents.</p>
        </div>
        <Button asChild>
          <Link href="/studio/create">
            <Plus className="mr-2 h-4 w-4" />
            Create Agent
          </Link>
        </Button>
      </div>

      {/* Stats cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Agents
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{data?.stats.totalAgents ?? 0}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Sales
            </CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{data?.stats.totalSales ?? 0}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Revenue
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">
                {formatTokenAmount(BigInt(data?.stats.totalRevenue ?? '0'))} USD
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg. Acceptance
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">
                {data?.stats.totalSales
                  ? `${(data.stats.avgAcceptanceRate * 100).toFixed(0)}%`
                  : '--'}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Agent list or empty state */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-muted-foreground">Failed to load your agents. Please try again.</p>
          </CardContent>
        </Card>
      ) : !data?.agents.length ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Package className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
            <h2 className="mb-2 text-xl font-semibold">No agents yet</h2>
            <p className="mb-6 text-muted-foreground">
              Create your first AI agent and start earning on the marketplace.
            </p>
            <Button asChild>
              <Link href="/studio/create">
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Agent
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <AgentList agents={data.agents} />
      )}
    </div>
  )
}
