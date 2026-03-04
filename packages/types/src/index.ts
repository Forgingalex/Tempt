export type AgentCategory = 'writing' | 'coding' | 'art' | 'automation' | 'research' | 'other'

export type OutputFormat = 'text' | 'markdown' | 'code' | 'json' | 'structured'

export type LicenseType = 'one-time' | 'usage-based'

export type AgentStatus = 'pending_review' | 'approved' | 'listed' | 'delisted' | 'rejected'

export interface AgentInput {
  name: string
  label: string
  type: 'text' | 'textarea' | 'select' | 'number'
  placeholder?: string
  required: boolean
  options?: string[]
  maxLength?: number
}

export interface AgentDemo {
  input: Record<string, string>
  output: string
}

export interface Agent {
  id: string
  slug: string
  name: string
  description: string
  doesNotDo: string
  category: AgentCategory
  tags: string[]

  inputs: AgentInput[]
  outputFormat: OutputFormat

  demos: AgentDemo[]

  // Amounts as strings for bigint serialization
  price: string
  paymentToken: string
  licenseType: LicenseType
  usageLimit?: number

  llmProvider: 'openai' | 'anthropic'
  llmModel: string
  maxTokens: number
  temperature: number

  status: AgentStatus

  totalSales: number
  totalExecutions: number
  acceptanceRate: number
  disputeRate: number
  repeatBuyerRate: number

  sellerId: string
  sellerAddress: string
  sellerName?: string
  createdAt: string
  updatedAt: string
}

export interface AgentListItem {
  id: string
  slug: string
  name: string
  description: string
  category: AgentCategory
  price: string
  paymentToken: string
  status: AgentStatus
  totalSales: number
  acceptanceRate: number
  sellerAddress: string
  sellerName?: string
}

export type UserRole = 'buyer' | 'seller' | 'both' | 'admin'

export interface User {
  id: string
  walletAddress: string
  displayName?: string
  bio?: string
  avatarUrl?: string
  role: UserRole
  createdAt: string
}

export interface SellerProfile extends User {
  totalSales: number
  totalAgents: number
  averageAcceptanceRate: number
  averageDisputeRate: number
}

export type PurchaseStatus = 'escrowed' | 'accepted' | 'disputed' | 'refunded' | 'auto_released'

export interface Purchase {
  id: string
  escrowId?: number
  txHash?: string
  agentId: string
  agentName: string
  agentSlug: string
  buyerId: string
  amount: string
  paymentToken: string
  status: PurchaseStatus
  usagesRemaining?: number
  autoReleaseAt: string
  acceptedAt?: string
  disputedAt?: string
  createdAt: string
}

export type ClaimResult = 'yes' | 'partially' | 'no'

export interface Review {
  id: string
  purchaseId: string
  agentId: string
  reviewerId: string
  reviewerAddress: string
  reviewerName?: string

  didWhatItClaimed: ClaimResult
  wasSetupClear: boolean
  wouldUseAgain: boolean

  whatWorked?: string
  whatDidnt?: string

  createdAt: string
}

export interface ReviewStats {
  total: number
  didWhatItClaimedYes: number
  didWhatItClaimedPartially: number
  didWhatItClaimedNo: number
  wasSetupClearYes: number
  wouldUseAgainYes: number
}

export type DisputeStatus = 'open' | 'under_review' | 'resolved' | 'dismissed'

export interface Dispute {
  id: string
  purchaseId: string
  buyerId: string
  reason: string
  evidence?: string
  status: DisputeStatus
  resolution?: string
  refunded: boolean
  createdAt: string
  resolvedAt?: string
}

export interface ExecutionRequest {
  agentId: string
  input: Record<string, unknown>
}

export interface ExecutionResponse {
  output: string
  executionId: string
  durationMs: number
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

export interface ApiError {
  message: string
  code?: string
  details?: unknown
}

export interface EscrowOnChain {
  id: number
  agentId: number
  buyer: string
  seller: string
  amount: bigint
  token: string
  status: number
  createdAt: number
  autoReleaseAt: number
}

export interface AgentOnChain {
  id: number
  seller: string
  metadataCID: string
  price: bigint
  paymentToken: string
  status: number
  totalSales: number
  createdAt: number
}
