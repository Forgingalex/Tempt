const API_BASE = process.env.NEXT_PUBLIC_APP_URL || ''

class ApiClient {
  private baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}/api${endpoint}`

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }))
      throw new Error(error.message || `HTTP ${response.status}`)
    }

    return response.json()
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' })
  }

  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  async put<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' })
  }
}

export const api = new ApiClient(API_BASE)

export const agentApi = {
  list: (params?: Record<string, string>) => {
    const query = params ? `?${new URLSearchParams(params)}` : ''
    return api.get<{ agents: unknown[]; total: number }>(`/agents${query}`)
  },

  get: (slug: string) => api.get<{ agent: unknown }>(`/agents/${slug}`),

  trending: () => api.get<{ agents: unknown[] }>('/agents/trending'),

  featured: () => api.get<{ agents: unknown[] }>('/agents/featured'),

  create: (data: unknown) => api.post<{ agent: unknown }>('/agents', data),

  update: (id: string, data: unknown) => api.put<{ agent: unknown }>(`/agents/${id}`, data),

  delete: (id: string) => api.delete<{ success: boolean }>(`/agents/${id}`),

  execute: (id: string, input: Record<string, unknown>) =>
    api.post<{ output: string; executionId: string }>(`/agents/${id}/execute`, { input }),
}

export const purchaseApi = {
  create: (agentId: string, txHash: string) =>
    api.post<{ purchase: unknown }>('/purchases', { agentId, txHash }),

  accept: (id: string) =>
    api.post<{ success: boolean }>(`/purchases/${id}/accept`),

  dispute: (id: string, reason: string) =>
    api.post<{ dispute: unknown }>(`/purchases/${id}/dispute`, { reason }),
}

export const reviewApi = {
  create: (purchaseId: string, data: Record<string, unknown>) =>
    api.post<{ review: unknown }>('/reviews', { purchaseId, ...data }),

  list: (agentSlug: string) =>
    api.get<{ reviews: unknown[] }>(`/agents/${agentSlug}/reviews`),
}

export const userApi = {
  profile: (address: string) =>
    api.get<{ user: unknown }>(`/users/${address}`),

  buyerDashboard: () =>
    api.get<{ purchases: unknown[]; stats: unknown }>('/dashboard/buyer'),

  sellerDashboard: () =>
    api.get<{ agents: unknown[]; stats: unknown }>('/dashboard/seller'),
}
