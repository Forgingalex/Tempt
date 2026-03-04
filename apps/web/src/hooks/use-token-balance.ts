'use client'

import { useReadContract } from 'wagmi'
import { formatUnits } from 'viem'
import { TIP20_DECIMALS } from '@/lib/tempo'

const TIP20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
] as const

interface UseTokenBalanceResult {
  balance: bigint | undefined
  formattedBalance: string | undefined
  symbol: string | undefined
  isLoading: boolean
  error: Error | null
}

export function useTokenBalance(
  tokenAddress: `0x${string}` | undefined,
  userAddress: `0x${string}` | undefined
): UseTokenBalanceResult {
  const { data: balance, isLoading: balanceLoading, error: balanceError } = useReadContract({
    address: tokenAddress,
    abi: TIP20_ABI,
    functionName: 'balanceOf',
    args: userAddress ? [userAddress] : undefined,
    query: {
      enabled: !!tokenAddress && !!userAddress,
    },
  })

  const { data: symbol, isLoading: symbolLoading } = useReadContract({
    address: tokenAddress,
    abi: TIP20_ABI,
    functionName: 'symbol',
    query: {
      enabled: !!tokenAddress,
    },
  })

  const formattedBalance = balance !== undefined
    ? formatUnits(balance, TIP20_DECIMALS)
    : undefined

  return {
    balance,
    formattedBalance,
    symbol,
    isLoading: balanceLoading || symbolLoading,
    error: balanceError,
  }
}
