'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { userApi, agentApi } from '@/lib/api'
import type { CreateAgentInput } from '@/lib/validations/agent'

interface SellerAgent {
  id: string
  slug: string
  name: string
  description: string
  category: string
  price: string
  paymentToken: string
  licenseType: string
  status: string
  totalSales: number
  totalExecutions: number
  acceptanceRate: number
  disputeRate: number
  createdAt: string
  updatedAt: string
}

interface SellerStats {
  totalAgents: number
  activeAgents: number
  totalSales: number
  totalExecutions: number
  totalRevenue: string
  avgAcceptanceRate: number
}

interface SellerDashboardData {
  agents: SellerAgent[]
  stats: SellerStats
}

export function useSellerDashboard(): ReturnType<typeof useQuery<SellerDashboardData>> {
  return useQuery<SellerDashboardData>({
    queryKey: ['seller-dashboard'],
    queryFn: () =>
      userApi.sellerDashboard() as Promise<SellerDashboardData>,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })
}

export function useCreateAgent(): ReturnType<typeof useMutation<{ agent: Record<string, unknown> }, Error, CreateAgentInput>> {
  const queryClient = useQueryClient()

  return useMutation<{ agent: Record<string, unknown> }, Error, CreateAgentInput>({
    mutationFn: (data: CreateAgentInput) =>
      agentApi.create(data) as Promise<{ agent: Record<string, unknown> }>,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller-dashboard'] })
    },
  })
}
