import Link from 'next/link'
import { ArrowRight, Code, Pen, Palette, Zap, BookOpen, Layers } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

const categories = [
  { name: 'Writing', slug: 'writing', icon: Pen, count: '--' },
  { name: 'Coding', slug: 'coding', icon: Code, count: '--' },
  { name: 'Art', slug: 'art', icon: Palette, count: '--' },
  { name: 'Automation', slug: 'automation', icon: Zap, count: '--' },
  { name: 'Research', slug: 'research', icon: BookOpen, count: '--' },
  { name: 'Other', slug: 'other', icon: Layers, count: '--' },
]

export default function HomePage(): React.ReactElement {
  return (
    <main>
      {/* Hero */}
      <section className="border-b border-border px-6 py-20 md:py-28">
        <div className="mx-auto max-w-8xl">
          <div className="max-w-3xl">
            <Badge variant="outline" className="mb-6">
              Built on Tempo Testnet
            </Badge>
            <h1 className="mb-6 text-4xl font-bold italic tracking-tight sm:text-5xl md:text-6xl">
              AI Agents That
              <br />
              Just Work.
            </h1>
            <p className="mb-10 max-w-xl text-lg text-muted-foreground">
              Discover, purchase, and use AI agents powered by hidden prompts. Transparent escrowed
              payments. Sellers protect their IP. Buyers get working tools.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/explore"
                className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Explore Agents
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link
                href="/studio"
                className="inline-flex h-11 items-center justify-center rounded-lg border border-border px-6 text-sm font-medium transition-colors hover:bg-accent"
              >
                Start Selling
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="border-b border-border px-6 py-6">
        <div className="mx-auto flex max-w-8xl flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-8">
            <div>
              <span className="text-2xl font-bold">--</span>
              <span className="ml-2 text-sm text-muted-foreground">Agents</span>
            </div>
            <div className="h-6 w-px bg-border" />
            <div>
              <span className="text-2xl font-bold">--</span>
              <span className="ml-2 text-sm text-muted-foreground">Transactions</span>
            </div>
            <div className="hidden h-6 w-px bg-border sm:block" />
            <div className="hidden sm:block">
              <span className="text-2xl font-bold">--</span>
              <span className="ml-2 text-sm text-muted-foreground">Creators</span>
            </div>
            <div className="hidden h-6 w-px bg-border md:block" />
            <div className="hidden md:block">
              <span className="text-2xl font-bold">--%</span>
              <span className="ml-2 text-sm text-muted-foreground">Acceptance Rate</span>
            </div>
          </div>
        </div>
      </section>

      {/* Trending Agents */}
      <section className="border-b border-border px-6 py-16">
        <div className="mx-auto max-w-8xl">
          <div className="mb-8 flex items-center justify-between">
            <h2 className="text-2xl font-bold">Trending</h2>
            <Link
              href="/explore?sort=trending"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              View all
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="group rounded-xl border border-border bg-card p-4 transition-colors hover:border-foreground/20"
              >
                <Skeleton className="mb-4 aspect-[4/3] w-full rounded-lg" />
                <Skeleton className="mb-2 h-5 w-3/4" />
                <Skeleton className="mb-3 h-3 w-1/2" />
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-7 w-14 rounded-md" />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Agents will appear here once the marketplace is live.
          </p>
        </div>
      </section>

      {/* Categories */}
      <section className="border-b border-border px-6 py-16">
        <div className="mx-auto max-w-8xl">
          <h2 className="mb-8 text-2xl font-bold">Browse by Category</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((category) => {
              const Icon = category.icon
              return (
                <Link
                  key={category.slug}
                  href={`/explore?category=${category.slug}`}
                  className="group flex items-center gap-4 rounded-xl border border-border bg-card p-5 transition-colors hover:border-foreground/20"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                    <Icon className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-foreground" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{category.name}</div>
                    <div className="text-xs text-muted-foreground">{category.count} agents</div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="border-b border-border px-6 py-16">
        <div className="mx-auto max-w-8xl">
          <h2 className="mb-8 text-2xl font-bold">How It Works</h2>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-lg font-bold">
                1
              </div>
              <h3 className="mb-2 text-base font-semibold">Browse &amp; Try</h3>
              <p className="text-sm text-muted-foreground">
                Explore AI agents by category. View demos and see exactly what each agent does
                before you buy.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-lg font-bold">
                2
              </div>
              <h3 className="mb-2 text-base font-semibold">Purchase Securely</h3>
              <p className="text-sm text-muted-foreground">
                Pay with TIP-20 tokens. Your payment is held in escrow until you confirm the agent
                works as described.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-lg font-bold">
                3
              </div>
              <h3 className="mb-2 text-base font-semibold">Use &amp; Accept</h3>
              <p className="text-sm text-muted-foreground">
                Run the agent with your inputs. When satisfied, release payment. If not, raise a
                dispute.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-8xl text-center">
          <h2 className="mb-4 text-3xl font-bold italic">Sell Your AI Expertise</h2>
          <p className="mx-auto mb-8 max-w-lg text-muted-foreground">
            Turn your prompts into products. Protect your IP while earning from your AI skills.
          </p>
          <Link
            href="/studio"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Create Your First Agent
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </div>
      </section>
    </main>
  )
}
