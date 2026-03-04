import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import './globals.css'
import { Providers } from '@/components/providers'

export const metadata: Metadata = {
  title: 'Tempt - AI Agent Marketplace',
  description:
    'Discover and purchase AI agents powered by hidden prompts. Buy working AI behaviors with escrowed payments on Tempo blockchain.',
  keywords: ['AI', 'agents', 'marketplace', 'prompts', 'blockchain', 'Tempo'],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>): React.ReactElement {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${GeistSans.variable} ${GeistMono.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
