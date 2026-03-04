'use client'

import { useCallback, useState } from 'react'
import { useSession, signIn as nextAuthSignIn, signOut as nextAuthSignOut } from 'next-auth/react'
import { useAccount, useConnect, useDisconnect, useSignMessage } from 'wagmi'
import { createSiweMessage } from '@/lib/siwe'

interface UseAuthReturn {
  session: ReturnType<typeof useSession>['data']
  status: ReturnType<typeof useSession>['status']
  isAuthenticated: boolean
  isLoading: boolean
  signIn: () => Promise<void>
  signOut: () => Promise<void>
  error: string | null
}

export function useAuth(): UseAuthReturn {
  const { data: session, status } = useSession()
  const { address, isConnected } = useAccount()
  const { connectAsync, connectors } = useConnect()
  const { disconnectAsync } = useDisconnect()
  const { signMessageAsync } = useSignMessage()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const signIn = useCallback(async () => {
    setError(null)
    setIsLoading(true)

    try {
      // Step 1: Connect wallet if not already connected
      let walletAddress = address
      if (!isConnected) {
        const injectedConnector = connectors.find((c) => c.id === 'injected')
        if (!injectedConnector) {
          throw new Error('No wallet found. Please install MetaMask.')
        }
        const result = await connectAsync({ connector: injectedConnector })
        walletAddress = result.accounts[0]
      }

      if (!walletAddress) {
        throw new Error('No wallet address available')
      }

      // Step 2: Fetch nonce from server
      const nonceRes = await fetch('/api/auth/nonce')
      if (!nonceRes.ok) {
        throw new Error('Failed to get authentication nonce')
      }
      const { nonce } = (await nonceRes.json()) as { nonce: string }

      // Step 3: Build SIWE message
      const message = createSiweMessage({
        domain: window.location.host,
        address: walletAddress,
        uri: window.location.origin,
        nonce,
        chainId: 42431,
      })

      // Step 4: Sign with wallet
      const signature = await signMessageAsync({ message })

      // Step 5: Authenticate with NextAuth
      const result = await nextAuthSignIn('siwe', {
        message,
        signature,
        redirect: false,
      })

      if (result?.error) {
        throw new Error('Authentication failed. Please try again.')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign in failed'
      // Don't show error for user-rejected signatures
      if (!message.toLowerCase().includes('user rejected') && !message.toLowerCase().includes('user denied')) {
        setError(message)
      }
    } finally {
      setIsLoading(false)
    }
  }, [address, isConnected, connectors, connectAsync, signMessageAsync])

  const signOut = useCallback(async () => {
    try {
      await nextAuthSignOut({ redirect: false })
      await disconnectAsync()
    } catch {
      // Ignore disconnect errors
    }
  }, [disconnectAsync])

  return {
    session,
    status,
    isAuthenticated: status === 'authenticated',
    isLoading: isLoading || status === 'loading',
    signIn,
    signOut,
    error,
  }
}
