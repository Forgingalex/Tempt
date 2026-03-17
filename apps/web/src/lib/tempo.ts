import { defineChain } from 'viem'

/**
 * Tempo Testnet (Moderato) chain configuration
 *
 * Important notes:
 * - Tempo has NO native gas token. Fees are paid in TIP-20 stablecoins
 * - TIP-20 tokens use 6 decimals (not 18)
 * - Use transferWithMemo for payment reconciliation
 */
export const tempoTestnet = defineChain({
  id: 42431,
  name: 'Tempo Testnet',
  nativeCurrency: {
    name: 'USD',
    symbol: 'USD',
    decimals: 18, // Placeholder - Tempo has no real native token
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.moderato.tempo.xyz'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Tempo Explorer',
      url: 'https://explore.tempo.xyz',
    },
  },
  testnet: true,
})

/**
 * Predeployed contract addresses on Tempo Testnet
 */
export const TEMPO_CONTRACTS = {
  TIP20_FACTORY: '0x20Fc000000000000000000000000000000000000' as const,
  MULTICALL3: '0xcA11bde05977b3631167028862bE2a173976CA11' as const,
} as const

/**
 * Testnet stablecoin addresses (available from faucet)
 * These are TIP-20 tokens with 6 decimals
 */
export const TESTNET_TOKENS = {
  pathUSD: '' as `0x${string}`, // To be filled after faucet
  AlphaUSD: '' as `0x${string}`,
  BetaUSD: '' as `0x${string}`,
  ThetaUSD: '' as `0x${string}`,
} as const

/**
 * TIP-20 tokens use 6 decimals (not 18 like most ERC-20s)
 */
export const TIP20_DECIMALS = 6

/**
 * Platform contract addresses (to be filled after deployment)
 */
export const PLATFORM_CONTRACTS = {
  // Marketplace contracts
  AGENT_REGISTRY: (process.env.NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS || '') as `0x${string}`,
  MARKETPLACE_ESCROW: (process.env.NEXT_PUBLIC_MARKETPLACE_ESCROW_ADDRESS || '') as `0x${string}`,
  DEFAULT_PAYMENT_TOKEN: (process.env.NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS || '') as `0x${string}`,
  // Trade system contracts
  TRADE_AGENT_REGISTRY: (process.env.NEXT_PUBLIC_TRADE_AGENT_REGISTRY_ADDRESS || '') as `0x${string}`,
  SHARE_TOKEN_FACTORY: (process.env.NEXT_PUBLIC_SHARE_TOKEN_FACTORY_ADDRESS || '') as `0x${string}`,
  BONDING_CURVE_MARKET: (process.env.NEXT_PUBLIC_BONDING_CURVE_MARKET_ADDRESS || '') as `0x${string}`,
  TRADING_VAULT: (process.env.NEXT_PUBLIC_TRADING_VAULT_ADDRESS || '') as `0x${string}`,
  FEE_ROUTER: (process.env.NEXT_PUBLIC_FEE_ROUTER_ADDRESS || '') as `0x${string}`,
  STAKING_AND_SLASHING: (process.env.NEXT_PUBLIC_STAKING_AND_SLASHING_ADDRESS || '') as `0x${string}`,
} as const

/**
 * Escrow configuration
 */
export const ESCROW_CONFIG = {
  AUTO_RELEASE_DAYS: 7,
  PLATFORM_FEE_BPS: 250, // 2.5%
} as const
