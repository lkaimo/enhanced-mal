import { useInfiniteQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { CardSkeletons, MediaCard } from '../components/MediaCard'
import { currentSeason, seasonal } from '../lib/mal'

const SEASONS = ['winter', 'spring', 'summer', 'fall'] as const
type Season = (typeof SEASONS)[number]
const PAGE = 500 // MAL's maximum, so a whole season normally arrives in one request
const FIRST_YEAR = 1990
const cur = currentSeason()
const field = 'rounded-lg border border-line bg-surface px-3 py-2 text-sm capitalize'

export default function SeasonalPage() {
  const [params, setParams] = useSearchParams()
  const py = Number(params.get('year')), ps = params.get('season') ?? ''
  const year = Number.isInteger(py) && py >= FIRST_YEAR && py <= cur.year + 1 ? py : cur.year
  const season: Season = (SEASONS as readonly string[]).includes(ps) ? (ps as Season) : cur.season
  const years = Array.from({ length: cur.year + 1 - FIRST_YEAR + 1 }, (_, i) => cur.year + 1 - i)
  const pick = (y: number, s: Season) => setParams({ year: String(y), season: s }, { replace: true })
  const isCurrent = year === cur.year && season === cur.season

  const q = useInfiniteQuery({
    queryKey: ['seasonal-premieres', year, season],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => seasonal(year, season, PAGE, pageParam),
    getNextPageParam: (last, all) => (last.paging?.next ? all.length * PAGE : undefined)
  })
  // MAL's season list also holds shows that premiered earlier and are still airing, so keep
  // only titles whose own start_season is the chosen season. De-duplicate by id.
  const premieres = [...new Map(
    (q.data?.pages.flatMap((p) => p.data) ?? [])
      .filter(({ node }) => node.start_season?.year === year && node.start_season?.season === season)
      .map(({ node }) => [node.id, node])
  ).values()]

  return (
    <>
      <h1 className="font-display text-3xl font-bold capitalize">Seasonal anime · {season} {year}</h1>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="sr-only" htmlFor="season">Season</label>
        <select id="season" value={season} onChange={(e) => pick(year, e.target.value as Season)} className={field}>
          {SEASONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <label className="sr-only" htmlFor="year">Year</label>
        <select id="year" value={year} onChange={(e) => pick(Number(e.target.value), season)} className={field}>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        {!isCurrent && <button onClick={() => pick(cur.year, cur.season)} className="text-sm text-tertiary underline">Back to current season</button>}
      </div>
      <p className="mt-3 text-sm text-muted" aria-live="polite">
        {q.isLoading ? 'Loading this season…' : `${premieres.length} new premieres, most popular first. Shows continuing from earlier seasons are not included${q.hasNextPage ? '; more to load.' : '.'}`}
      </p>
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {q.isLoading && <CardSkeletons n={10} fluid />}
        {premieres.map((n) => <MediaCard key={n.id} node={n} type="anime" fluid />)}
      </div>
      {q.error && <p role="alert" className="mt-6 text-muted">Couldn’t load this season. <button onClick={() => q.refetch()} className="text-tertiary underline">Try again</button></p>}
      {!q.isLoading && !q.error && premieres.length === 0 && <p className="mt-6 text-muted">No premieres found for this season.</p>}
      {q.hasNextPage && (
        <button onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage} className="mt-8 rounded-lg border border-line px-5 py-2 text-sm hover:border-primary disabled:opacity-60">
          {q.isFetchingNextPage ? 'Loading…' : 'Load more'}
        </button>
      )}
    </>
  )
}
