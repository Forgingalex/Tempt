import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface AgentPageProps {
  params: Promise<{ slug: string }>
}

export default async function AgentPage({ params }: AgentPageProps): Promise<React.ReactElement> {
  const { slug } = await params

  return (
    <main className="mx-auto max-w-8xl px-6 py-8">
      {/* Breadcrumbs */}
      <nav className="mb-6 flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/explore" className="transition-colors hover:text-foreground">
          Explore
        </Link>
        <ChevronRight className="h-3 w-3" />
        <Link href="/explore?category=coding" className="transition-colors hover:text-foreground">
          Coding
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">{slug}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2">
          {/* Header */}
          <div className="mb-6">
            <div className="mb-3 flex items-center gap-2">
              <Badge variant="secondary">Coding</Badge>
              <Badge variant="success">Verified</Badge>
            </div>
            <h1 className="mb-2 text-3xl font-bold">{slug}</h1>
            <p className="text-sm text-muted-foreground">
              by{' '}
              <Link href="/profile/0x1234" className="text-foreground underline-offset-4 hover:underline">
                0x1234...5678
              </Link>
            </p>
          </div>

          {/* Stats */}
          <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Uses', value: '--' },
              { label: 'Acceptance', value: '--%' },
              { label: 'Disputes', value: '--%' },
              { label: 'Repeat Buyers', value: '--%' },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-lg border border-border bg-card p-3 text-center"
              >
                <div className="text-xl font-bold">{stat.value}</div>
                <div className="text-xs text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Description */}
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="text-base">What This Agent Does</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Agent description will appear here...</p>
            </CardContent>
          </Card>

          {/* What It Does NOT Do */}
          <Card className="mb-4 border-foreground/10">
            <CardHeader>
              <CardTitle className="text-base text-muted-foreground">
                What This Agent Does NOT Do
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Limitations and exclusions will appear here...
              </p>
            </CardContent>
          </Card>

          {/* Demo Section */}
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="text-base">Demo Examples</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="rounded-lg bg-secondary p-4">
                  <div className="mb-1 text-xs font-medium text-muted-foreground">Input</div>
                  <p className="font-mono text-sm">Example input will appear here...</p>
                </div>
                <div className="rounded-lg bg-secondary p-4">
                  <div className="mb-1 text-xs font-medium text-muted-foreground">Output</div>
                  <p className="font-mono text-sm">Example output will appear here...</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Reviews */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Reviews</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-6 grid grid-cols-3 gap-3">
                {[
                  { label: 'Did what it claimed', value: '--%' },
                  { label: 'Would use again', value: '--%' },
                  { label: 'Setup was clear', value: '--%' },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-lg bg-secondary p-4 text-center">
                    <div className="text-xl font-bold">{stat.value}</div>
                    <div className="text-xs text-muted-foreground">{stat.label}</div>
                  </div>
                ))}
              </div>
              <p className="text-center text-sm text-muted-foreground">No reviews yet.</p>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1">
          <Card className="sticky top-24">
            <CardContent className="pt-6">
              <div className="mb-6 text-center">
                <div className="text-3xl font-bold">-- USD</div>
                <div className="text-sm text-muted-foreground">One-time purchase</div>
              </div>
              <Button className="mb-3 w-full" size="lg">
                Purchase Agent
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Payment held in escrow until you accept
              </p>
              <div className="mt-6 border-t border-border pt-4">
                <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Creator
                </h4>
                <Link
                  href="/profile/0x1234"
                  className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-accent"
                >
                  <div className="h-8 w-8 rounded-full bg-secondary" />
                  <div>
                    <div className="text-sm font-medium">0x1234...5678</div>
                    <div className="text-xs text-muted-foreground">-- agents listed</div>
                  </div>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}
