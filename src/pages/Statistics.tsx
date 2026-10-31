import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { fetchAll } from '../lib/fetchAll'
import { LineChart } from '../components/LineChart'

type Group = 'anime' | 'manga' | 'manhwa' | 'manhua'
const GROUPS: [Group, string][] = [['anime', 'Anime'], ['manga', 'Manga'], ['manhwa', 'Manhwa'], ['manhua', 'Manhua']]
const LABEL: Record<string, string> = { watching: 'Watching', reading: 'Reading', completed: 'Completed', on_hold: 'On hold', dropped: 'Dropped', plan_to_watch: 'Plan to watch', plan_to_read: 'Plan to read' }
const ORDER: Record<Group, string[]> = {
  anime: ['watching', 'completed', 'on_hold', 'dropped', 'plan_to_watch'],
  manga: ['reading', 'completed', 'on_hold', 'dropped', 'plan_to_read'], manhwa: ['reading', 'completed', 'on_hold', 'dropped', 'plan_to_read'], manhua: ['reading', 'completed', 'on_hold', 'dropped', 'plan_to_read']
}

/** Horizontal bars with a wide label column. Used for the wider genre and score cards. */
function Bars({ title, rows, note }: { title: string; rows: [string, number][]; note?: string }) {
  const max = Math.max(1, ...rows.map(([, n]) => n))
  return (
    <section className="min-w-0 rounded-xl border border-line bg-surface p-5">
      <h2 className="font-display text-lg font-bold">{title}</h2>
      {rows.length === 0 ? <p className="mt-2 text-sm text-muted">Not enough data yet.</p> : (
        <ul className="mt-3 space-y-2">{rows.map(([label, n]) => (
          <li key={label} className="grid grid-cols-[5.5rem_1fr_2.5rem] items-center gap-3 text-sm sm:grid-cols-[7rem_1fr_3rem]">
            <span className="truncate text-muted">{label}</span>
            <span className="h-2 rounded-full bg-background"><span className="block h-2 rounded-full bg-gradient-to-r from-primary to-secondary" style={{ width: `${(n / max) * 100}%` }} /></span>
            <span className="text-right tabular-nums">{n}</span>
          </li>))}</ul>)}
      {note && <p className="mt-3 text-xs text-muted">{note}</p>}
    </section>
  )
}

/** Compact status card: label and count on one line, bar underneath, so it stays readable in a narrow column. */
function StatusCard({ title, rows, total }: { title: string; rows: [string, number][]; total: number }) {
  return (
    <section className="min-w-0 rounded-xl border border-line bg-surface p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-bold">{title}</h2>
        <span className="shrink-0 text-xs text-muted">{total} {total === 1 ? 'entry' : 'entries'}</span>
      </div>
      {total === 0 ? <p className="mt-3 text-sm text-muted">No entries yet.</p> : (
        <ul className="mt-4 space-y-3">{rows.map(([label, n]) => (
          <li key={label}>
            <div className="flex justify-between gap-2 text-sm"><span className="truncate text-muted">{label}</span><span className="shrink-0 tabular-nums">{n} · {Math.round((n / total) * 100)}%</span></div>
            <div className="mt-1 h-2 rounded-full bg-background"><div className="h-2 rounded-full bg-gradient-to-r from-primary to-secondary" style={{ width: `${(n / total) * 100}%` }} /></div>
          </li>))}</ul>)}
    </section>
  )
}

const Stat = ({ label, value, sub }: { label: string; value: string | number; sub?: string }) => (
  <div className="min-w-0 rounded-xl border border-line bg-surface p-4"><p className="truncate text-xs text-muted">{label}</p><p className="mt-1 font-display text-2xl font-bold">{value}</p>{sub && <p className="truncate text-xs text-muted">{sub}</p>}</div>)

export default function StatisticsPage() {
  const [includeCustom, setIncludeCustom] = useState(() => { try { return localStorage.getItem('custom-filter') !== 'hide' } catch { return true } })
  const changeInclude = (v: boolean) => { setIncludeCustom(v); try { localStorage.setItem('custom-filter', v ? 'include' : 'hide') } catch { /* storage unavailable */ } }
  const q = useQuery({
    queryKey: ['stats'],
    queryFn: async () => {
      const entries = await fetchAll<any>((a, b) => supabase.from('list_entries').select('mal_id,media_type,status,score,progress,is_manhwa,updated_at').order('media_type').order('mal_id').range(a, b))
      const cat = await fetchAll<any>((a, b) => supabase.from('catalog_items').select('mal_id,media_type,genres,mtype:metadata->>media_type').order('media_type').order('mal_id').range(a, b))
      const genres = new Map(cat.map((c) => [`${c.media_type}:${c.mal_id}`, (c.genres ?? []) as { name: string }[]]))
      const mtype = new Map(cat.map((c) => [`${c.media_type}:${c.mal_id}`, c.mtype as string | null]))
      // MAL files manhwa/manhua under manga; split them by MAL's own media type, as on MyList.
      const official = entries.map((e) => ({ ...e, custom: false,
        group: (e.media_type === 'anime' ? 'anime' : e.is_manhwa ? 'manhwa' : mtype.get(`manga:${e.mal_id}`) === 'manhua' ? 'manhua' : 'manga') as Group }))
      const custom = (await fetchAll<any>((a, b) => supabase.from('custom_entries').select('kind,status,score,progress,updated_at').order('created_at').range(a, b)).catch((): any[] => []))
        .map((c, i) => ({ mal_id: -(i + 1), custom: true, media_type: c.kind === 'anime' ? 'anime' : 'manga', group: c.kind as Group, status: c.status, score: c.score, progress: c.progress, updated_at: c.updated_at }))
      return { entries: [...official, ...custom], genres }
    }
  })
  if (q.isLoading) return <p className="text-muted" role="status">Crunching your numbers…</p>
  if (q.error) return <p role="alert" className="text-muted">Couldn’t load your statistics. Refresh and try again.</p>
  const { entries: allEntries, genres } = q.data!
  const entries = includeCustom ? allEntries : allEntries.filter((e) => !e.custom)
  const toggle = (
    <label className="mt-4 flex items-center gap-2 text-sm text-muted">
      <input type="checkbox" checked={includeCustom} onChange={(e) => changeInclude(e.target.checked)} className="h-4 w-4 accent-[var(--color-primary)]" />
      Include manually added titles ({allEntries.filter((e) => e.custom).length})
    </label>
  )
  if (entries.length === 0) return <><h1 className="font-display text-3xl font-bold">Statistics</h1><p className="mt-3 text-muted">No entries yet. Import your list from the MyList page first.</p>{toggle}</>

  const of = (g: Group) => entries.filter((e) => e.group === g)
  const done = (list: any[]) => list.filter((e) => e.status === 'completed').length
  const sum = (list: any[]) => list.reduce((t, e) => t + (e.progress || 0), 0)
  const rated = entries.filter((e) => e.score > 0)
  const mean = rated.length ? (rated.reduce((t, e) => t + e.score, 0) / rated.length).toFixed(2) : '–'
  const current = entries.filter((e) => e.status === 'watching' || e.status === 'reading').length
  const statusRows = (g: Group): [string, number][] => ORDER[g].map((s) => [LABEL[s], of(g).filter((e) => e.status === s).length])

  const gm: Record<string, number> = {}
  for (const e of entries) for (const g of genres.get(`${e.media_type}:${e.mal_id}`) ?? []) gm[g.name] = (gm[g.name] ?? 0) + 1
  const genreRows = Object.entries(gm).sort((a, b) => b[1] - a[1]).slice(0, 10) as [string, number][]
  const scoreRows: [string, number][] = Array.from({ length: 10 }, (_, i) => 10 - i).map((s) => [String(s), rated.filter((e) => e.score === s).length])
  const months: [string, number][] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    months.push([key, entries.filter((e) => (e.updated_at ?? '').startsWith(key)).length])
  }
  const row = 'grid grid-cols-2 gap-3 md:grid-cols-4'

  return (
    <>
      <h1 className="font-display text-3xl font-bold">Statistics</h1>
      {toggle}
      <section aria-label="Entries" className={`mt-6 ${row}`}>
        {GROUPS.map(([g, l]) => <Stat key={g} label={`${l} entries`} value={of(g).length} sub={`${done(of(g))} completed`} />)}
      </section>
      <section aria-label="Progress" className={`mt-3 ${row}`}>
        <Stat label="Episodes watched" value={sum(of('anime')).toLocaleString()} />
        {GROUPS.filter(([g]) => g !== 'anime').map(([g, l]) => <Stat key={g} label={`Chapters read · ${l}`} value={sum(of(g)).toLocaleString()} />)}
      </section>
      <section aria-label="Overview" className={`mt-3 ${row}`}>
        <Stat label="Total entries" value={entries.length} />
        <Stat label="Watching / reading now" value={current} />
        <Stat label="Mean score" value={mean} sub={`${rated.length} rated`} />
        <Stat label="Completion rate" value={`${Math.round((done(entries) / entries.length) * 100)}%`} sub="of all entries" />
      </section>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 min-[1100px]:grid-cols-4">
        {GROUPS.map(([g, l]) => <StatusCard key={g} title={`${l} by status`} rows={statusRows(g)} total={of(g).length} />)}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Bars title="Top genres" rows={genreRows} note="Counts entries per genre across anime and manga. Manually added titles have no genres, so they are not counted here." />
        <Bars title="Score distribution" rows={scoreRows} note="Only rated entries; unscored titles are excluded." />
      </div>
      <div className="mt-4">
        <LineChart title="Activity, last 12 months" points={months} note="Entries by the month MyAnimeList last updated them. Not a full history." />
      </div>
    </>
  )
}
