import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { MediaType } from '../lib/mal'
import { callUpdate, getDetail, STATUS_OPTIONS } from '../lib/malDetail'
import { getAdaptations } from '../lib/anilist'

function ListPanel({ type, id, entry, total, volumes }: { type: MediaType; id: number; entry: any; total: number | null; volumes: number | null }) {
  const qc = useQueryClient()
  const [status, setStatus] = useState<string>(entry?.status ?? STATUS_OPTIONS[type][STATUS_OPTIONS[type].length - 1][0])
  const [progress, setProgress] = useState<number>(entry?.progress ?? 0)
  const [vols, setVols] = useState<number>(entry?.volumes_read ?? 0)
  const [score, setScore] = useState<number>(entry?.score ?? 0)
  const [msg, setMsg] = useState<string | null>(null)
  const done = () => { qc.invalidateQueries({ queryKey: ['entry', type, id] }); qc.invalidateQueries({ queryKey: ['mylist'] }); qc.invalidateQueries({ queryKey: ['stats'] }) }
  const onError = (e: Error) => setMsg(e.message === 'reauth' ? 'MyAnimeList access expired. Sign out and sign in again.' : 'Something went wrong. Try again.')
  const save = useMutation({
    mutationFn: () => callUpdate({ action: 'save', type, id, status, score, progress, volumes_read: vols }),
    onSuccess: (r) => { setMsg(r.sync === 'synced' ? 'Saved and synced to MyAnimeList.' : 'Saved here, but MyAnimeList did not accept the update. Use Retry.'); done() }, onError
  })
  const remove = useMutation({
    mutationFn: () => callUpdate({ action: 'remove', type, id }),
    onSuccess: (r) => { setMsg(r.sync === 'synced' ? 'Removed from your list.' : 'Could not remove it on MyAnimeList. Your entry was kept. Try again.'); done() }, onError
  })
  const busy = save.isPending || remove.isPending
  const field = 'mt-1 w-full rounded-lg border border-line bg-background px-3 py-2 text-sm'
  return (
    <section aria-label="Your list" className="rounded-xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="font-display text-lg font-bold">{entry ? 'Your list entry' : 'Add to your list'}</h2>
        <p className="text-xs text-muted">Sync status: {entry ? ({ synced: 'Synced with MyAnimeList', pending: 'Pending', failed: 'Not synced (failed)', local_only: 'Local only' } as Record<string, string>)[entry.sync_status] : 'Not on your list'}</p>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(12rem,1fr))]">
        <label className="text-sm text-muted">Status
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={field}>{STATUS_OPTIONS[type].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <label className="text-sm text-muted">Score
          <select value={score} onChange={(e) => setScore(Number(e.target.value))} className={field}>
            <option value={0}>Not scored</option>{Array.from({ length: 10 }, (_, i) => 10 - i).map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
        <label className="text-sm text-muted">{type === 'anime' ? 'Episodes watched' : 'Chapters read'}{total ? ` (of ${total})` : ''}
          <input type="number" min={0} max={total ?? undefined} value={progress} onChange={(e) => setProgress(Math.max(0, Math.floor(Number(e.target.value) || 0)))} className={field} /></label>
        {type === 'manga' && <label className="text-sm text-muted">Volumes read{volumes ? ` (of ${volumes})` : ''}
          <input type="number" min={0} max={volumes ?? undefined} value={vols} onChange={(e) => setVols(Math.max(0, Math.floor(Number(e.target.value) || 0)))} className={field} /></label>}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button onClick={() => save.mutate()} disabled={busy} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-background disabled:opacity-60">{save.isPending ? 'Saving…' : entry ? 'Save changes' : 'Add to list'}</button>
        {entry && <button onClick={() => remove.mutate()} disabled={busy} className="rounded-lg border border-line px-4 py-2 text-sm hover:border-primary disabled:opacity-60">Remove</button>}
        {entry?.sync_status === 'failed' && <button onClick={() => save.mutate()} disabled={busy} className="rounded-lg border border-primary px-4 py-2 text-sm text-primary">Retry sync</button>}
      </div>
      {msg && <p role="status" className="mt-3 text-sm">{msg}</p>}
    </section>
  )
}

function Mini({ items, type, title }: { items: any[]; type: MediaType; title: string }) {
  if (!items?.length) return null
  return (
    <section className="mt-8"><h2 className="mb-3 font-display text-lg font-bold">{title}</h2>
      <div className="flex gap-3 overflow-x-auto pb-2">{items.slice(0, 12).map((x) => (
        <Link key={x.node.id} to={`/${x.kind ?? type}/${x.node.id}`} className="w-28 shrink-0">
          <div className="aspect-[2/3] overflow-hidden rounded-lg border border-line bg-surface">{x.node.main_picture && <img src={x.node.main_picture.medium} alt="" loading="lazy" className="h-full w-full object-cover" />}</div>
          <p className="mt-1 line-clamp-2 text-xs hover:text-primary">{x.node.title}</p>
          {x.relation_type_formatted && <p className="text-xs capitalize text-muted">{x.relation_type_formatted}{x.kind && x.kind !== type ? ` (${x.kind})` : ''}</p>}
        </Link>))}</div></section>
  )
}

export default function DetailPage({ type }: { type: MediaType }) {
  const { id } = useParams()
  const mid = Number(id)
  const { session } = useAuth()
  const valid = Number.isInteger(mid) && mid > 0
  const detail = useQuery({ queryKey: ['detail', type, mid], queryFn: () => getDetail(type, mid), enabled: valid })
  const entry = useQuery({
    queryKey: ['entry', type, mid], enabled: valid && !!session,
    queryFn: async () => (await supabase.from('list_entries').select('*').eq('media_type', type).eq('mal_id', mid).maybeSingle()).data
  })
  // MAL's API leaves related_manga empty, so the original work comes from AniList (cached for a day).
  const aniAdaptations = useQuery({ queryKey: ['adaptations', type, mid], queryFn: () => getAdaptations(type, mid), enabled: valid, staleTime: 24 * 3600_000, retry: 0 })
  if (!valid) return <p className="text-muted">That title ID isn’t valid.</p>
  if (detail.isLoading) return <p className="text-muted" role="status">Loading…</p>
  if (detail.error || !detail.data) return <p role="alert" className="text-muted">Couldn’t load this title. It may not exist, or MyAnimeList is unreachable. <button className="text-tertiary underline" onClick={() => detail.refetch()}>Try again</button></p>
  const d = detail.data
  const total: number | null = (type === 'anime' ? d.num_episodes : d.num_chapters) || null
  const alt = [d.alternative_titles?.en, d.alternative_titles?.ja, ...(d.alternative_titles?.synonyms ?? [])].filter(Boolean)
  const facts: [string, string | number | undefined][] = [
    ['Type', d.media_type?.replace(/_/g, ' ')], ['Status', d.status?.replace(/_/g, ' ')],
    ...(type === 'anime' && d.source ? [['Source', d.source.replace(/_/g, ' ')] as [string, string]] : []),
    [type === 'anime' ? 'Episodes' : 'Chapters', total ?? 'Unknown'], ...(type === 'manga' ? [['Volumes', d.num_volumes || 'Unknown'] as [string, string | number]] : []),
    ['Started', d.start_date], ['Ended', d.end_date], ['Score', d.mean?.toFixed(2)], ['Rank', d.rank ? `#${d.rank}` : undefined], ['Popularity', d.popularity ? `#${d.popularity}` : undefined],
    ...(d.authors?.length ? [['Authors', d.authors.map((a: any) => `${a.node.first_name} ${a.node.last_name}`.trim()).join(', ')] as [string, string]] : [])
  ]
  // The original work for an anime (its manga or novel), or the anime adaptation for a manga.
  const otherKind: MediaType = type === 'anime' ? 'manga' : 'anime'
  const adaptations: any[] = ((type === 'anime' ? d.related_manga : d.related_anime) ?? []).filter((x: any) => x.relation_type === 'adaptation')
  const adaptationLinks: { key: string; title: string; to?: string; label: string }[] = adaptations.length > 0
    ? adaptations.map((a) => ({ key: String(a.node.id), title: a.node.title, to: `/${otherKind}/${a.node.id}`, label: '' }))
    : (aniAdaptations.data ?? []).slice(0, 3).map((a) => ({
        key: `${a.kind}-${a.malId ?? a.title}`, title: a.title, to: a.malId ? `/${a.kind}/${a.malId}` : undefined, label: a.format.replace(/_/g, ' ').toLowerCase() }))
  // One Related list across both catalogs, adaptations first.
  const related = [
    ...(d.related_anime ?? []).map((x: any) => ({ ...x, kind: 'anime' })),
    ...(d.related_manga ?? []).map((x: any) => ({ ...x, kind: 'manga' }))
  ].sort((a, b) => Number(b.relation_type === 'adaptation') - Number(a.relation_type === 'adaptation'))
  return (
    <>
      <div className="grid gap-8 md:grid-cols-[220px_1fr]">
        <div>{d.main_picture && <img src={d.main_picture.large ?? d.main_picture.medium} alt={`Cover of ${d.title}`} className="w-full rounded-xl border border-line" />}</div>
        <div>
          <h1 className="font-display text-3xl font-bold">{d.title}</h1>
          {alt.length > 0 && <p className="mt-1 text-sm text-muted">{alt.slice(0, 4).join(' · ')}</p>}
          <div className="mt-3 flex flex-wrap gap-2">{d.genres?.map((g: any) => <span key={g.id} className="rounded-full border border-secondary/60 bg-secondary/15 px-3 py-0.5 text-xs text-ink">{g.name}</span>)}</div>
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
            {facts.filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => <div key={k}><dt className="text-xs text-muted">{k}</dt><dd className="capitalize">{v}</dd></div>)}
          </dl>
          {adaptationLinks.length > 0 && (
            <p className="mt-3 text-sm">
              <span className="text-xs text-muted">{type === 'anime' ? 'Adapted from' : 'Anime adaptation'}</span>{' '}
              {adaptationLinks.map((a, i) => (
                <span key={a.key}>{i > 0 && ', '}
                  {a.to ? <Link to={a.to} className="text-tertiary underline">{a.title}</Link> : <span>{a.title}</span>}
                  {a.label && <span className="text-xs capitalize text-muted"> ({a.label})</span>}
                </span>
              ))}
            </p>
          )}
          <p className="mt-4 max-w-prose whitespace-pre-line text-sm leading-relaxed">{d.synopsis || 'No synopsis available.'}</p>
        </div>
      </div>
      <div className="mt-8">
        {!session ? <p className="rounded-xl border border-line bg-surface p-5 text-sm text-muted"><Link to="/login" className="text-tertiary underline">Sign in</Link> to add this to your list.</p>
          : entry.isLoading ? <p className="text-muted">Loading your list entry…</p>
          : <ListPanel key={entry.data?.updated_at ?? 'new'} type={type} id={mid} entry={entry.data} total={total} volumes={d.num_volumes || null} />}
      </div>
      <Mini items={related} type={type} title="Related" />
      <Mini items={d.recommendations} type={type} title="Recommended" />
    </>
  )
}
