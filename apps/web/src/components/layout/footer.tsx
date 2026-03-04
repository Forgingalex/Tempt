import Link from 'next/link'
import { TempoMark } from '@/components/icons/tempo-logo'

export function Footer(): React.ReactElement {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-8xl px-6 py-12">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div>
            <div className="mb-4 flex items-center gap-2">
              <TempoMark size={20} />
              <span className="text-lg font-bold italic">TEMPT</span>
            </div>
            <p className="text-sm text-muted-foreground">
              The AI agent marketplace. Buy working AI behaviors with escrowed payments.
            </p>
          </div>

          {/* Marketplace */}
          <div>
            <h4 className="mb-3 text-sm font-semibold">Marketplace</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/explore" className="transition-colors hover:text-foreground">
                  Explore Agents
                </Link>
              </li>
              <li>
                <Link href="/explore?category=writing" className="transition-colors hover:text-foreground">
                  Writing
                </Link>
              </li>
              <li>
                <Link href="/explore?category=coding" className="transition-colors hover:text-foreground">
                  Coding
                </Link>
              </li>
              <li>
                <Link href="/explore?category=automation" className="transition-colors hover:text-foreground">
                  Automation
                </Link>
              </li>
            </ul>
          </div>

          {/* Creators */}
          <div>
            <h4 className="mb-3 text-sm font-semibold">Creators</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/studio" className="transition-colors hover:text-foreground">
                  Sell an Agent
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="transition-colors hover:text-foreground">
                  Dashboard
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="mb-3 text-sm font-semibold">Resources</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <span className="cursor-default">Documentation</span>
              </li>
              <li>
                <span className="cursor-default">Support</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border pt-8 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            Built on{' '}
            <span className="font-semibold text-foreground">TEMPO</span>
          </p>
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Tempt. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
