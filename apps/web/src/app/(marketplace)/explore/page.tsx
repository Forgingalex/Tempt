import { Search } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

const filterCategories = ['All', 'Writing', 'Coding', 'Art', 'Automation', 'Research']
const sortOptions = ['Trending', 'Newest', 'Price: Low', 'Price: High', 'Most Used']

export default function ExplorePage(): React.ReactElement {
  return (
    <main className="mx-auto max-w-8xl px-6 py-8">
      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search agents by name, category, or creator..."
            className="h-12 w-full rounded-xl border border-input bg-card pl-12 pr-4 text-base placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      {/* Filter Pills + Sort */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {filterCategories.map((category, i) => (
            <button
              key={category}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                i === 0
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border bg-card text-muted-foreground hover:border-foreground/20 hover:text-foreground'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
        <select className="rounded-lg border border-input bg-card px-3 py-2 text-sm text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring">
          {sortOptions.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      </div>

      {/* Agent Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="group rounded-xl border border-border bg-card p-4 transition-colors hover:border-foreground/20"
          >
            <Skeleton className="mb-4 aspect-[4/3] w-full rounded-lg" />
            <Skeleton className="mb-2 h-5 w-3/4" />
            <Skeleton className="mb-1 h-3 w-1/2" />
            <Skeleton className="mb-4 h-3 w-2/3" />
            <div className="flex items-center justify-between border-t border-border pt-3">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-7 w-14 rounded-md" />
            </div>
          </div>
        ))}
      </div>

      <p className="mt-12 text-center text-sm text-muted-foreground">
        Agent listings will appear here once the marketplace is live.
      </p>
    </main>
  )
}
