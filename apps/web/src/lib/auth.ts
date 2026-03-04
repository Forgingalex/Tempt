import NextAuth, { type NextAuthResult } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { verifySiweSignature } from './siwe'
import { nonceStore } from '@/app/api/auth/nonce/store'

import type { DefaultSession } from 'next-auth'

/**
 * Extend NextAuth types to include wallet-specific fields.
 */
declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      walletAddress: string
      role: string
    } & DefaultSession['user']
  }

  interface User {
    walletAddress: string
    role: string
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    walletAddress: string
    userId: string
    role: string
  }
}

function getExpectedDomain(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  try {
    return new URL(url).host
  } catch {
    return 'localhost:3000'
  }
}

const nextAuth = NextAuth({
  providers: [
    Credentials({
      id: 'siwe',
      name: 'SIWE',
      credentials: {
        message: { label: 'Message', type: 'text' },
        signature: { label: 'Signature', type: 'text' },
      },
      async authorize(credentials) {
        const message = credentials?.message as string | undefined
        const signature = credentials?.signature as string | undefined

        if (!message || !signature) {
          return null
        }

        // Extract nonce from the message for validation
        const nonceMatch = message.match(/Nonce: (.+)/)
        const nonce = nonceMatch?.[1]?.trim()
        if (!nonce) {
          return null
        }

        // Consume nonce — single-use
        const nonceValid = nonceStore.consume(nonce)
        if (!nonceValid) {
          return null
        }

        // Verify SIWE signature
        const result = await verifySiweSignature({
          message,
          signature: signature as `0x${string}`,
          expectedDomain: getExpectedDomain(),
          expectedNonce: nonce,
          expectedChainId: 42431,
        })

        if (!result.success || !result.address) {
          return null
        }

        const walletAddress = result.address.toLowerCase()

        // Try to find or create user in database
        let userId = walletAddress
        let role = 'BUYER'

        try {
          const { prisma } = await import('./db')
          const user = await prisma.user.upsert({
            where: { walletAddress },
            update: {},
            create: { walletAddress, role: 'BUYER' },
            select: { id: true, role: true },
          })
          userId = user.id
          role = user.role
        } catch {
          // DB unavailable — fall back to wallet address as ID.
          // Auth still works; features requiring DB will handle missing records.
        }

        return {
          id: userId,
          walletAddress,
          role,
        }
      },
    }),
  ],

  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },

  pages: {
    signIn: '/',
    error: '/',
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.walletAddress = user.walletAddress
        token.userId = user.id ?? ''
        token.role = user.role
      }
      return token
    },

    async session({ session, token }) {
      session.user.id = token.userId
      session.user.walletAddress = token.walletAddress
      session.user.role = token.role
      return session
    },
  },
})

export const handlers = nextAuth.handlers
export const signIn = nextAuth.signIn
export const signOut = nextAuth.signOut
export const auth: NextAuthResult['auth'] = nextAuth.auth
