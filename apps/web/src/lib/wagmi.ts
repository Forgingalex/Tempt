import { createConfig, http } from 'wagmi'
import { injected, walletConnect } from 'wagmi/connectors'
import { tempoTestnet } from './tempo'

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || ''

export const wagmiConfig = createConfig({
  chains: [tempoTestnet],
  connectors: [
    injected(),
    ...(projectId
      ? [
          walletConnect({
            projectId,
            metadata: {
              name: 'Tempt',
              description: 'AI Agent Marketplace on Tempo',
              url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
              icons: [],
            },
          }),
        ]
      : []),
  ],
  transports: {
    [tempoTestnet.id]: http(),
  },
  ssr: true,
})

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig
  }
}
