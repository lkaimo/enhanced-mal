import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { Search, X } from 'lucide-react'
import { CardSkeletons } from '../components/MediaCard'
import { ExploreCard } from '../components/ExploreCard'
import { ranking, searchMedia, type MalNode, type MediaType } from '../lib/mal'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { fetchAll } from '../lib/fetchAll'

type Kind = 'anime' | 'manga' | 'manhwa' | 'manhua'
const KINDS: [Kind, string][] = [['anime', 'Anime'], ['manga', 'Manga'], ['manhwa', 'Manhwa'], ['manhua', 'Manhua']]
const apiType = (k: Kind): MediaType => (k === 'anime' ? 'anime' : 'manga')

// MAL has no "trending" endpoint, so these are its rankings. Manhwa/manhua only offer "top rated".
const SHELVES: Record<Kind, [string, string, number][]> = {
  anime: [['Airing now', 'airing', 18], ['Most popular', 'bypopularity', 18], ['Upcoming', 'upcoming', 18], ['Most favorited', 'favorite', 18], ['Top movies', 'movie', 18]],
  manga: [['Most popular', 'bypopularity', 18], ['Top rated', 'manga', 18], ['Most favorited', 'favorite', 18]],
  manhwa: [['Top rated manhwa', 'manhwa', 30]],
  manhua: [['Top rated manhua', 'manhua', 30]]
}
// Search has no manhwa/manhua filter: search manga, then keep the matching media_type.
const keep = (k: Kind, n: MalNode) => k === 'manhwa' ? n.media_type === 'manhwa' : k === 'manhua' ? n.media_type === 'manhua'
  : k === 'manga' ? n.media_type !== 'manhwa' && n.media_type !== 'manhua' : true
const PAGE: Record<Kind, number> = { anime: 48, manga: 48, manhwa: 100, manhua: 100 } // bigger pages where we filter afterwards

function ShelfRow({ title, kind, rankingType, limit, listmap, signedIn }: { title: string; kind: Kind; rankingType: string; limit: number; listmap?: Map<string, string>; signedIn: boolean }) {
  const t = apiType(kind)
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['explore-shelf', t, rankingType, limit], queryFn: () => ranking(t, rankingType, limit) })
  return (
    <section aria-label={title} className="mt-10">
      <h2 className="mb-4 font-display text-xl font-bold">{title}</h2>
      {error ? <p role="alert" className="text-sm text-muted">Couldn’t load this section. <button onClick={() => refetch()} className="text-tertiary underline">Try again</button></p> : (
        <div className="flex gap-4 overflow-x-auto pb-3">
          {isLoading ? <CardSkeletons /> : data?.data.map(({ node }) => <ExploreCard key={node.id} node={node} type={t} listStatus={listmap?.get(`${t}:${node.id}`)} signedIn={signedIn} />)}
        </div>)}
    </section>
  )
}

export default function ExplorePage() {
  const { session } = useAuth()
  const [params, setParams] = useSearchParams()
  const kind = (KINDS.some(([k]) => k === params.get('type')) ? params.get('type') : 'anime') as Kind
  const q = (params.get('q') ?? '').trim()
  const [input, setInput] = useState(q)
  const t = apiType(kind)

  const update = (changes: Record<string, string>) => setParams((prev) => {
    const n = new URLSearchParams(prev)
    for (const [k, v] of Object.entries(changes)) v ? n.set(k, v) : n.delete(k)
    return n
  }, { replace: true })

  useEffect(() => setInput(q), [q]) // keep the box in step with back/forward navigation
  useEffect(() => { // live search: debounce, and only act on 3+ characters (MAL's minimum) or an empty box
    const id = setTimeout(() => { const v = input.trim(); if (v !== q && (v.length >= 3 || v === '')) update({ q: v }) }, 400)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input])

  const listmap = useQuery({
    queryKey: ['listmap'], enabled: !!session, staleTime: 0, refetchOnMount: 'always',
    queryFn: async () => {
      const rows = await fetchAll<any>((a, b) => supabase.from('list_entries').select('mal_id,media_type,status').range(a, b))
      return new Map(rows.map((r) => [`${r.media_type}:${r.mal_id}`, r.status as string]))
    }
  })

  const searching = q.length >= 3
  const results = useInfiniteQuery({
    queryKey: ['explore-search', kind, q], enabled: searching, initialPageParam: 0,
    queryFn: ({ pageParam }) => searchMedia(t, q, pageParam, PAGE[kind], true),
    // Always include titles MAL tags nsfw: its tag is coarse (e.g. PG-13 shows can be 'gray').
    getNextPageParam: (last, all) => (last.paging?.next ? all.length * PAGE[kind] : undefined)
  })
  const items = [...new Map((results.data?.pages.flatMap((p) => p.data) ?? []).map((x) => x.node).filter((n) => keep(kind, n)).map((n) => [n.id, n])).values()]

  return (
    <>
      <h1 className="font-display text-3xl font-bold">Explore</h1>
      <form role="search" onSubmit={(e) => { e.preventDefault(); if (input.trim().length >= 3) update({ q: input.trim() }) }} className="mt-5 flex gap-3">
        <div className="relative min-w-0 flex-1">
          <label className="sr-only" htmlFor="q">Search titles</label>
          <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input id="q" value={input} onChange={(e) => setInput(e.target.value)} placeholder={`Search ${kind} (3+ characters)`}
            className="w-full rounded-lg border border-line bg-surface py-2 pl-9 pr-9 text-sm placeholder:text-muted" />
          {input && <button type="button" aria-label="Clear search" onClick={() => { setInput(''); update({ q: '' }) }} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-ink"><X size={16} aria-hidden /></button>}
        </div>
      </form>
      <div role="group" aria-label="Media type" className="mt-4 flex flex-wrap gap-2">
        {KINDS.map(([k, l]) => (
          <button key={k} aria-pressed={kind === k} onClick={() => update({ type: k === 'anime' ? '' : k })}
            className={`rounded-full border px-4 py-1.5 text-sm ${kind === k ? 'border-primary bg-primary/15 font-bold text-primary' : 'border-line text-muted hover:text-ink'}`}>{l}</button>
        ))}
      </div>
      {input.trim().length > 0 && input.trim().length < 3 && <p className="mt-3 text-xs text-muted">Type at least 3 characters to search.</p>}

      {searching ? (
        <section aria-label="Search results" className="mt-8">
          <p className="text-sm text-muted" aria-live="polite">
            {results.isLoading ? 'Searching…' : `${items.length} result${items.length === 1 ? '' : 's'} for “${q}”${results.hasNextPage ? ' so far' : ''}`}
          </p>
          <div className="mt-4 flex flex-wrap gap-4">
            {results.isLoading && <CardSkeletons n={12} />}
            {results.error && <p role="alert" className="text-muted">Search failed. <button onClick={() => results.refetch()} className="text-tertiary underline">Try again</button></p>}
            {!results.isLoading && !results.error && items.length === 0 && !results.hasNextPage && <p className="text-muted">No {kind} matched “{q}”. Try a different spelling.</p>}
            {items.map((n) => <ExploreCard key={n.id} node={n} type={t} listStatus={listmap.data?.get(`${t}:${n.id}`)} signedIn={!!session} />)}
          </div>
          {results.hasNextPage && (
            <button onClick={() => results.fetchNextPage()} disabled={results.isFetchingNextPage} className="mt-8 rounded-lg border border-line px-5 py-2 text-sm hover:border-primary disabled:opacity-60">
              {results.isFetchingNextPage ? 'Loading…' : 'Load more'}
            </button>
          )}
        </section>
      ) : (
        SHELVES[kind].map(([title, rt, limit]) => <ShelfRow key={`${kind}-${rt}`} title={title} kind={kind} rankingType={rt} limit={limit} listmap={listmap.data} signedIn={!!session} />)
      )}
    </>
  )
}
