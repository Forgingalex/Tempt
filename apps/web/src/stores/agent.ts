import { create } from 'zustand'
import type { AgentListItem } from '@tempt/types'

interface AgentFilters {
  category?: string
  minPrice?: string
  maxPrice?: string
  minAcceptanceRate?: number
  sortBy: 'trending' | 'newest' | 'price_asc' | 'price_desc' | 'most_used' | 'highest_rated'
  search?: string
}

interface AgentState {
  // Filters
  filters: AgentFilters
  setFilters: (filters: Partial<AgentFilters>) => void
  resetFilters: () => void

  // Selected agent for purchase flow
  selectedAgent: AgentListItem | null
  setSelectedAgent: (agent: AgentListItem | null) => void

  // Purchase modal
  isPurchaseModalOpen: boolean
  openPurchaseModal: (agent: AgentListItem) => void
  closePurchaseModal: () => void
}

const defaultFilters: AgentFilters = {
  sortBy: 'trending',
}

export const useAgentStore = create<AgentState>((set) => ({
  // Filters
  filters: defaultFilters,
  setFilters: (newFilters) =>
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
    })),
  resetFilters: () => set({ filters: defaultFilters }),

  // Selected agent
  selectedAgent: null,
  setSelectedAgent: (agent) => set({ selectedAgent: agent }),

  // Purchase modal
  isPurchaseModalOpen: false,
  openPurchaseModal: (agent) =>
    set({
      selectedAgent: agent,
      isPurchaseModalOpen: true,
    }),
  closePurchaseModal: () =>
    set({
      isPurchaseModalOpen: false,
      selectedAgent: null,
    }),
}))
