'use client'

import { useQuery } from '@tanstack/react-query'
import { agentApi, reviewApi } from '@/lib/api'

export function useAgents(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['agents', params],
    queryFn: () => agentApi.list(params),
  })
}

export function useAgent(slug: string) {
  return useQuery({
    queryKey: ['agent', slug],
    queryFn: () => agentApi.get(slug),
    enabled: !!slug,
  })
}

export function useTrendingAgents() {
  return useQuery({
    queryKey: ['agents', 'trending'],
    queryFn: () => agentApi.trending(),
  })
}

export function useFeaturedAgents() {
  return useQuery({
    queryKey: ['agents', 'featured'],
    queryFn: () => agentApi.featured(),
  })
}

export function useAgentReviews(agentSlug: string) {
  return useQuery({
    queryKey: ['agent', agentSlug, 'reviews'],
    queryFn: () => reviewApi.list(agentSlug),
    enabled: !!agentSlug,
  })
}
