'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useAccount } from 'wagmi'
import { Search, Wallet, Mail, User, Settings, LogOut, Menu, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { TempoMark } from '@/components/icons/tempo-logo'
import { shortenAddress } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'

export function Header(): React.ReactElement {
  const { address } = useAccount()
  const { session, isAuthenticated, isLoading, signIn, signOut, error } = useAuth()
  const [signInOpen, setSignInOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const displayAddress = session?.user?.walletAddress || address || ''

  async function handleWalletConnect(): Promise<void> {
    await signIn()
    setSignInOpen(false)
  }

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-16 max-w-8xl items-center justify-between gap-4 px-6">
          {/* Left: Logo + Nav */}
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2">
              <TempoMark size={24} />
              <span className="text-lg font-bold italic tracking-tight">TEMPT</span>
            </Link>

            <div className="hidden h-6 w-px bg-border md:block" />

            <nav className="hidden items-center gap-1 md:flex">
              <Link
                href="/explore"
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                Explore
              </Link>
              <Link
                href="/studio"
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                Create
              </Link>
              <Link
                href="/trade"
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                Trade
              </Link>
            </nav>
          </div>

          {/* Center: Search */}
          <div className="hidden max-w-md flex-1 md:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                placeholder="Search agents..."
                className="h-9 w-full rounded-lg border border-input bg-secondary pl-9 pr-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          {/* Right: Auth */}
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <div className="h-2 w-2 rounded-full bg-foreground" />
                    {shortenAddress(displayAddress)}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel className="font-normal">
                    <span className="text-xs text-muted-foreground">{shortenAddress(displayAddress)}</span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href={`/profile/${displayAddress}`} className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard" className="flex items-center gap-2">
                      <Wallet className="h-4 w-4" />
                      Dashboard
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/settings" className="flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => signOut()}
                    className="flex items-center gap-2 text-muted-foreground"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button size="sm" onClick={() => setSignInOpen(true)} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>
            )}

            {/* Mobile menu toggle */}
            <button
              className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="border-t border-border px-6 py-4 md:hidden">
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="search"
                  placeholder="Search agents..."
                  className="h-9 w-full rounded-lg border border-input bg-secondary pl-9 pr-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>
            <nav className="flex flex-col gap-1">
              <Link
                href="/explore"
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                onClick={() => setMobileMenuOpen(false)}
              >
                Explore
              </Link>
              <Link
                href="/studio"
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                onClick={() => setMobileMenuOpen(false)}
              >
                Create
              </Link>
              <Link
                href="/trade"
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                onClick={() => setMobileMenuOpen(false)}
              >
                Trade
              </Link>
            </nav>
          </div>
        )}
      </header>

      {/* Sign In Dialog */}
      <Dialog open={signInOpen} onOpenChange={setSignInOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sign in to Tempt</DialogTitle>
            <DialogDescription>
              Choose how you want to connect to the marketplace.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 flex flex-col gap-3">
            {error && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* Wallet — functional */}
            <button
              onClick={handleWalletConnect}
              disabled={isLoading}
              className="flex items-center gap-4 rounded-lg border border-border p-4 text-left transition-colors hover:bg-accent disabled:opacity-50"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Wallet className="h-5 w-5" />
                )}
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold">
                  {isLoading ? 'Connecting...' : 'Connect Wallet'}
                </div>
                <div className="text-xs text-muted-foreground">MetaMask, WalletConnect, etc.</div>
              </div>
            </button>

            {/* Twitter — coming soon */}
            <button
              disabled
              className="flex cursor-not-allowed items-center gap-4 rounded-lg border border-border p-4 text-left opacity-50"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  Twitter
                  <Badge variant="warning" className="text-[10px]">Soon</Badge>
                </div>
                <div className="text-xs text-muted-foreground">Sign in with your X account</div>
              </div>
            </button>

            {/* Email — coming soon */}
            <button
              disabled
              className="flex cursor-not-allowed items-center gap-4 rounded-lg border border-border p-4 text-left opacity-50"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                <Mail className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  Email
                  <Badge variant="warning" className="text-[10px]">Soon</Badge>
                </div>
                <div className="text-xs text-muted-foreground">Sign in with email address</div>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
