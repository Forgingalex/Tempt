import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MessageSquare } from 'lucide-react'

interface ReviewStats {
  total: number
  acceptanceRate: number
  wouldUseAgainRate: number
  setupClearRate: number
}

interface ReviewSectionProps {
  stats: ReviewStats
}

export function ReviewSection({ stats }: ReviewSectionProps): React.ReactElement {
  if (stats.total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reviews</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <MessageSquare className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No reviews yet.</p>
            <p className="text-xs text-muted-foreground">
              Reviews appear after buyers accept and complete their experience.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  function pct(rate: number): string {
    return `${(rate * 100).toFixed(0)}%`
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span>Reviews</span>
          <span className="text-sm font-normal text-muted-foreground">
            {stats.total} review{stats.total === 1 ? '' : 's'}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-secondary p-4 text-center">
            <div className="text-xl font-bold">{pct(stats.acceptanceRate)}</div>
            <div className="text-xs text-muted-foreground">Did what it claimed</div>
          </div>
          <div className="rounded-lg bg-secondary p-4 text-center">
            <div className="text-xl font-bold">{pct(stats.wouldUseAgainRate)}</div>
            <div className="text-xs text-muted-foreground">Would use again</div>
          </div>
          <div className="rounded-lg bg-secondary p-4 text-center">
            <div className="text-xl font-bold">{pct(stats.setupClearRate)}</div>
            <div className="text-xs text-muted-foreground">Setup was clear</div>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Based on structured outcome reviews, not star ratings.
        </p>
      </CardContent>
    </Card>
  )
}
