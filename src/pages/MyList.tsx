import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LayoutGrid, List, Minus, Pencil, Plus, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { fetchAll } from '../lib/fetchAll'
import { callUpdate } from '../lib/malDetail'
import { deleteCustom, loadCustom, updateCustom, type CustomEntry, type CustomMode } from '../lib/custom'
import { AddTitleDialog } from '../components/AddTitleDialog'

type Tab = 'anime' | 'manga' | 'manhwa' | 'manhua'
type View = 'list' | 'cards'
interface Row { custom?: boolean; cid?: string; mal_id: number; status: string; score: number | null; progress: number; volumes_read: number | null; updated_at: string
  sync_status: string; title: string; cover: string | null; total: number | null; volumes: number | null; mediaType: string | null }

const STATUS: Record<Tab, [string, string][]> = {
  anime: [['watching', 'Watching'], ['completed', 'Completed'], ['on_hold', 'On hold'], ['dropped', 'Dropped'], ['plan_to_watch', 'Plan to watch']],
  manga: [['reading', 'Reading'], ['completed', 'Completed'], ['on_hold', 'On hold'], ['dropped', 'Dropped'], ['plan_to_read', 'Plan to read']],
  manhwa: [['reading', 'Reading'], ['completed', 'Completed'], ['on_hold', 'On hold'], ['dropped', 'Dropped'], ['plan_to_read', 'Plan to read']],
  manhua: [['reading', 'Reading'], ['completed', 'Completed'], ['on_hold', 'On hold'], ['dropped', 'Dropped'], ['plan_to_read', 'Plan to read']]
}
/** Manual titles have no MyAnimeList page, so they render as plain text instead of a link. */
function ItemLink({ r, to, className, children }: { r: Row; to: string; className?: string; children: ReactNode }) {
  return r.custom ? <span className={className}>{children}</span> : <Link to={to} className={className}>{children}</Link>
}
const field = 'mt-1 w-full rounded-lg border border-line bg-background px-3 py-2 text-sm'

async function loadOfficial(tab: Tab): Promise<Row[]> {
  const kind = tab === 'anime' ? 'anime' : 'manga'
  const entries = await fetchAll<any>((a, b) => {
    let q = supabase.from('list_entries').select('*').eq('media_type', kind)
    if (tab === 'manga' || tab === 'manhua') q = q.eq('is_manhwa', false)
    if (tab === 'manhwa') q = q.eq('is_manhwa', true)
    return q.range(a, b)
  })
  const catalog = await fetchAll<any>((a, b) => supabase.from('catalog_items').select('mal_id,title,cover_image_url,metadata').eq('media_type', kind).range(a, b))
  const byId = new Map(catalog.map((c) => [c.mal_id, c]))
  const rows: Row[] = entries.map((e) => {
    const c = byId.get(e.mal_id); const m = c?.metadata ?? {}
    return { ...e, title: c?.title ?? `MAL #${e.mal_id}`, cover: c?.cover_image_url ?? null,
      total: (kind === 'anime' ? m.num_episodes : m.num_chapters) || null, volumes: m.num_volumes || null, mediaType: m.media_type ?? null }
  })
  // MAL files manhua under manga (is_manhwa = false), so split them out by MAL's own media type.
  if (tab === 'manga') return rows.filter((r) => r.mediaType !== 'manhua')
  if (tab === 'manhua') return rows.filter((r) => r.mediaType === 'manhua')
  return rows
}

const tabOf = (k: string): Tab => (k === 'anime' ? 'anime' : k === 'manhwa' ? 'manhwa' : k === 'manhua' ? 'manhua' : 'manga')

async function loadRows(tab: Tab, mode: CustomMode): Promise<Row[]> {
  const official = mode === 'only' ? [] : await loadOfficial(tab)
  if (mode === 'hide') return official
  // If manual titles can't be loaded, still show the official list instead of failing the whole page.
  const custom = (await loadCustom().catch((): CustomEntry[] => [])).filter((c) => tabOf(c.kind) === tab).map((c, i): Row => ({
    custom: true, cid: c.id, mal_id: -(i + 1), status: c.status, score: c.score, progress: c.progress, volumes_read: c.volumes_read,
    updated_at: c.updated_at, sync_status: 'synced', title: c.title, cover: c.coverUrl, total: null, volumes: null, mediaType: `${c.kind} (manual)` }))
  return [...official, ...custom]
}

function EditDialog({ row, tab, pending, onClose, onSave, onRemove }: { row: Row; tab: Tab; pending: boolean; onClose: () => void; onSave: (p: Partial<Row>) => void; onRemove: () => void }) {
  const [status, setStatus] = useState(row.status)
  const [score, setScore] = useState(row.score ?? 0)
  const [progress, setProgress] = useState(row.progress)
  const [vols, setVols] = useState(row.volumes_read ?? 0)
  const [confirming, setConfirming] = useState(false)
  useEffect(() => { const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h) }, [onClose])
  const num = (v: string) => Math.max(0, Math.floor(Number(v) || 0))
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/60 p-4 sm:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={`Edit ${row.title}`} onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl border border-line bg-surface p-5">
        <h2 className="font-display text-lg font-bold line-clamp-2">{row.title}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-muted">Status
            <select autoFocus value={status} onChange={(e) => setStatus(e.target.value)} className={field}>{STATUS[tab].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          <label className="text-sm text-muted">Score
            <select value={score} onChange={(e) => setScore(Number(e.target.value))} className={field}><option value={0}>Not scored</option>{Array.from({ length: 10 }, (_, i) => 10 - i).map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
          <label className="text-sm text-muted">{tab === 'anime' ? 'Episodes watched' : 'Chapters read'}{row.total ? ` (of ${row.total})` : ''}
            <input type="number" min={0} max={row.total ?? undefined} value={progress} onChange={(e) => setProgress(num(e.target.value))} className={field} /></label>
          {tab !== 'anime' && <label className="text-sm text-muted">Volumes read{row.volumes ? ` (of ${row.volumes})` : ''}
            <input type="number" min={0} max={row.volumes ?? undefined} value={vols} onChange={(e) => setVols(num(e.target.value))} className={field} /></label>}
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button disabled={pending} onClick={() => onSave({ status, score, progress, volumes_read: tab === 'anime' ? null : vols })} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-background disabled:opacity-60">Save</button>
          <button onClick={onClose} className="rounded-lg border border-line px-4 py-2 text-sm hover:border-primary">Cancel</button>
          {confirming
            ? <button disabled={pending} onClick={onRemove} className="ml-auto rounded-lg border border-primary px-4 py-2 text-sm font-bold text-primary">{row.custom ? 'Confirm: delete data and cover' : 'Confirm remove'}</button>
            : <button onClick={() => setConfirming(true)} className="ml-auto text-sm text-muted underline hover:text-primary">{row.custom ? 'Delete title permanently' : 'Remove from list'}</button>}
        </div>
      </div>
    </div>
  )
}

export default function MyListPage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('anime')
  const [view, setView] = useState<View>(() => { try { return localStorage.getItem('mylist-view') === 'cards' ? 'cards' : 'list' } catch { return 'list' } })
  const [customMode, setCustomMode] = useState<CustomMode>(() => { try { const v = localStorage.getItem('custom-filter'); return v === 'only' || v === 'hide' ? v : 'include' } catch { return 'include' } })
  const changeCustom = (v: CustomMode) => { setCustomMode(v); try { localStorage.setItem('custom-filter', v) } catch { /* storage unavailable */ } }
  const [adding, setAdding] = useState(false)
  const [status, setStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<'updated' | 'title' | 'score'>('updated')
  const [msg, setMsg] = useState<string | null>(null)
  const [editing, setEditing] = useState<Row | null>(null)
  const [busy, setBusy] = useState<Set<number>>(new Set())
  const kind = tab === 'anime' ? 'anime' : 'manga'
  const unit = tab === 'anime' ? 'ep' : 'ch'
  const changeView = (v: View) => { setView(v); try { localStorage.setItem('mylist-view', v) } catch { /* storage unavailable */ } }

  const rows = useQuery({ queryKey: ['mylist', tab, customMode], queryFn: () => loadRows(tab, customMode) })
  const patchRow = (id: number, patch: Partial<Row>) => qc.setQueryData<Row[]>(['mylist', tab, customMode], (old) => old?.map((r) => (r.mal_id === id ? { ...r, ...patch } : r)))
  const setBusyFor = (id: number, on: boolean) => setBusy((s) => { const n = new Set(s); on ? n.add(id) : n.delete(id); return n })
  const errMsg = (e: Error) => setMsg(e.message === 'reauth' ? 'MyAnimeList access expired. Sign out and sign in again.' : 'Couldn’t save that change. Try again.')

  const sync = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('mal-sync')
      if (error) { const body = await (error as any).context?.json?.().catch(() => null); throw new Error(body?.error ?? 'sync_failed') }
      return data as { anime: number; manga: number }
    },
    onSuccess: (d) => { setMsg(`Imported ${d.anime} anime and ${d.manga} manga/manhwa/manhua entries.`); qc.invalidateQueries({ queryKey: ['mylist'] }) },
    onError: (e: Error) => setMsg(e.message === 'reauth' ? 'MyAnimeList access expired. Sign out and sign in again.' : 'Sync failed. Try again in a minute.')
  })

  // Edits save locally, then push to MyAnimeList (mal-update). The row updates instantly; sync_status shows the outcome.
  const commit = useMutation({
    mutationFn: (v: { row: Row; patch: Partial<Row> }) => {
      const m = { ...v.row, ...v.patch }
      if (m.custom) return updateCustom(m.cid!, { status: m.status, score: m.score ?? 0, progress: m.progress, volumes_read: m.volumes_read ?? 0 })
      return callUpdate({ action: 'save', type: kind, id: m.mal_id, status: m.status, score: m.score ?? 0, progress: m.progress, volumes_read: m.volumes_read ?? 0 })
    },
    onMutate: (v) => { setBusyFor(v.row.mal_id, true); patchRow(v.row.mal_id, { ...v.patch, sync_status: 'pending', updated_at: new Date().toISOString() }) },
    onSuccess: async (r, v) => {
      const { data } = v.row.custom ? { data: null } : await supabase.from('list_entries').select('*').eq('media_type', kind).eq('mal_id', v.row.mal_id).maybeSingle()
      if (data) patchRow(v.row.mal_id, { status: data.status, score: data.score, progress: data.progress, volumes_read: data.volumes_read, updated_at: data.updated_at, sync_status: data.sync_status })
      setMsg(r.sync === 'failed' ? 'Saved here, but MyAnimeList did not accept the change. Use Retry on that entry.' : null)
      for (const k of ['stats', 'listmap']) qc.invalidateQueries({ queryKey: [k] })
      setEditing(null)
    },
    onError: (e: Error) => { errMsg(e); qc.invalidateQueries({ queryKey: ['mylist', tab, customMode] }) },
    onSettled: (_d, _e, v) => setBusyFor(v.row.mal_id, false)
  })
  const remove = useMutation({
    mutationFn: (row: Row) => (row.custom ? deleteCustom(row.cid!) : callUpdate({ action: 'remove', type: kind, id: row.mal_id })),
    onMutate: (row) => setBusyFor(row.mal_id, true),
    onSuccess: (r, row) => {
      if (r.sync === 'failed') { setMsg('Couldn’t remove it on MyAnimeList, so it was kept. Try again.'); return }
      qc.setQueryData<Row[]>(['mylist', tab, customMode], (old) => old?.filter((x) => x.mal_id !== row.mal_id))
      for (const k of ['stats', 'listmap']) qc.invalidateQueries({ queryKey: [k] })
      setEditing(null); setMsg(`Removed “${row.title}” from your list.`)
    },
    onError: errMsg,
    onSettled: (_d, _e, row) => setBusyFor(row.mal_id, false)
  })
  const inc = (row: Row, d: number) => {
    const p = Math.min(row.total ?? Infinity, Math.max(0, row.progress + d))
    if (p !== row.progress) commit.mutate({ row, patch: { progress: p } })
  }

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (rows.data ?? []).filter((r) => (status === 'all' || r.status === status) && (!q || r.title.toLowerCase().includes(q)))
      .sort((a, b) => sort === 'title' ? a.title.localeCompare(b.title) : sort === 'score' ? (b.score ?? 0) - (a.score ?? 0) : +new Date(b.updated_at) - +new Date(a.updated_at))
  }, [rows.data, status, search, sort])
  const counts = (s: string) => (rows.data ?? []).filter((r) => r.status === s).length
  const detailPath = (r: Row) => `/${kind}/${r.mal_id}`
  const progressText = (r: Row) => `${r.progress}${r.total ? ` / ${r.total}` : ''} ${unit}${tab !== 'anime' && r.volumes_read ? `, ${r.volumes_read} vol` : ''}`

  const controls = (r: Row) => {
    const b = busy.has(r.mal_id)
    return (
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label={`Status of ${r.title}`} value={r.status} disabled={b} onChange={(e) => commit.mutate({ row: r, patch: { status: e.target.value } })} className="rounded-lg border border-line bg-background px-2 py-1 text-xs disabled:opacity-60">
          {STATUS[tab].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <span className="inline-flex overflow-hidden rounded-lg border border-line">
          <button aria-label={`One less ${tab === 'anime' ? 'episode' : 'chapter'} for ${r.title}`} disabled={b || r.progress <= 0} onClick={() => inc(r, -1)} className="px-2 py-1 hover:bg-background disabled:opacity-40"><Minus size={14} aria-hidden /></button>
          <button aria-label={`One more ${tab === 'anime' ? 'episode' : 'chapter'} for ${r.title}`} disabled={b || (r.total != null && r.progress >= r.total)} onClick={() => inc(r, 1)} className="border-l border-line px-2 py-1 hover:bg-background disabled:opacity-40"><Plus size={14} aria-hidden /></button>
        </span>
        <button aria-label={`Edit ${r.title}`} onClick={() => setEditing(r)} className="rounded-lg border border-line p-1.5 hover:border-primary"><Pencil size={14} aria-hidden /></button>
        {r.sync_status === 'pending' && <span className="text-xs text-muted">Saving…</span>}
        {r.sync_status === 'failed' && <span className="text-xs text-primary">Not synced <button disabled={b} onClick={() => commit.mutate({ row: r, patch: {} })} className="underline">Retry</button></span>}
      </div>
    )
  }

  const tabBtn = (t: Tab) => (
    <button key={t} role="tab" aria-selected={tab === t} onClick={() => { setTab(t); setStatus('all') }} className={`px-4 py-2 text-sm capitalize ${tab === t ? 'border-b-2 border-primary font-bold text-primary' : 'text-muted hover:text-ink'}`}>{t}</button>
  )
  const chip = (v: string, label: string) => <button key={v} onClick={() => setStatus(v)} aria-pressed={status === v} className={`rounded-full border px-3 py-1 text-xs ${status === v ? 'border-primary text-primary' : 'border-line text-muted'}`}>{label}</button>

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold">MyList</h1>
        <button onClick={() => sync.mutate()} disabled={sync.isPending} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-background disabled:opacity-60">
          <RefreshCw size={16} aria-hidden className={sync.isPending ? 'animate-spin' : ''} />{sync.isPending ? 'Importing…' : 'Import from MyAnimeList'}
        </button>
      </div>
      {msg && <p role="status" className="mt-4 rounded-lg border border-line bg-surface p-3 text-sm">{msg}</p>}

      <div role="tablist" className="mt-6 flex gap-2 border-b border-line">{(['anime', 'manga', 'manhwa', 'manhua'] as Tab[]).map(tabBtn)}</div>
      {tab === 'manhwa' && <p className="mt-3 text-xs text-muted">Manhwa are manga entries that MyAnimeList itself classifies as manhwa (its media type field).</p>}
      {tab === 'manhua' && <p className="mt-3 text-xs text-muted">Manhua are manga entries that MyAnimeList itself classifies as manhua (its media type field).</p>}

      <div className="mt-4 flex flex-wrap gap-2">{chip('all', `All (${rows.data?.length ?? 0})`)}{STATUS[tab].map(([v, l]) => chip(v, `${l} (${counts(v)})`))}</div>
      <div className="mt-4 flex flex-wrap gap-3">
        <label className="sr-only" htmlFor="ls">Search your list</label>
        <input id="ls" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search your list" className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm placeholder:text-muted" />
        <select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm">
          <option value="updated">Recently updated</option><option value="title">Title</option><option value="score">Score</option>
        </select>
        <select aria-label="Manually added titles" value={customMode} onChange={(e) => changeCustom(e.target.value as CustomMode)} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm">
          <option value="include">Include manual titles</option><option value="only">Only manual titles</option><option value="hide">Hide manual titles</option>
        </select>
        <button onClick={() => setAdding(true)} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm hover:border-primary"><Plus size={16} aria-hidden />Add title</button>
        <div role="group" aria-label="View" className="inline-flex overflow-hidden rounded-lg border border-line">
          <button aria-pressed={view === 'list'} aria-label="List view" onClick={() => changeView('list')} className={`px-3 py-2 ${view === 'list' ? 'bg-primary/15 text-primary' : 'text-muted hover:text-ink'}`}><List size={16} aria-hidden /></button>
          <button aria-pressed={view === 'cards'} aria-label="Card view" onClick={() => changeView('cards')} className={`border-l border-line px-3 py-2 ${view === 'cards' ? 'bg-primary/15 text-primary' : 'text-muted hover:text-ink'}`}><LayoutGrid size={16} aria-hidden /></button>
        </div>
      </div>

      {rows.isLoading && <p className="mt-6 text-muted">Loading your list…</p>}
      {rows.error && <p role="alert" className="mt-6 text-muted">Couldn’t load your list. Refresh and try again.</p>}
      {rows.data && rows.data.length === 0 && <p className="mt-6 text-muted">Nothing here yet. Click “Import from MyAnimeList” to bring in your list.</p>}
      {rows.data && rows.data.length > 0 && visible.length === 0 && <p className="mt-6 text-muted">No entries match these filters.</p>}

      {view === 'list' ? (
        <ul className="mt-6 divide-y divide-line rounded-xl border border-line bg-surface empty:hidden">
          {visible.map((r) => (
            <li key={r.mal_id} className="flex items-start gap-4 p-3">
              <div className="h-24 w-16 shrink-0 overflow-hidden rounded-md bg-background">{r.cover && <img src={r.cover} alt="" loading="lazy" className="h-full w-full object-cover" />}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <ItemLink r={r} to={detailPath(r)} className="line-clamp-2 font-medium hover:text-primary">{r.title}</ItemLink>
                  <p className="shrink-0 text-sm" aria-label={r.score ? `Score ${r.score} of 10` : 'Not scored'}>{r.score ? `${r.score}/10` : 'Not scored'}</p>
                </div>
                <p className="mt-0.5 text-xs text-muted">{r.mediaType ? `${r.mediaType.replace(/_/g, ' ')} · ` : ''}Progress {progressText(r)}</p>
                <div className="mt-2">{controls(r)}</div>
              </div>
            </li>))}
        </ul>
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {visible.map((r) => (
            <li key={r.mal_id} className="flex flex-col rounded-xl border border-line bg-surface p-2">
              <ItemLink r={r} to={detailPath(r)} className="group relative block">
                <div className="aspect-[2/3] overflow-hidden rounded-lg bg-background">{r.cover && <img src={r.cover} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />}</div>
                {r.score ? <span className="absolute right-2 top-2 rounded-md bg-background/85 px-2 py-0.5 text-xs font-bold" aria-label={`Score ${r.score} of 10`}>{r.score}/10</span> : null}
              </ItemLink>
              <ItemLink r={r} to={detailPath(r)} className="mt-2 line-clamp-2 text-sm font-medium hover:text-primary">{r.title}</ItemLink>
              <p className="mt-0.5 text-xs text-muted">{progressText(r)}</p>
              {r.total ? <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-background" role="progressbar" aria-valuemin={0} aria-valuemax={r.total} aria-valuenow={r.progress} aria-label={`Progress for ${r.title}`}><div className="h-full rounded-full bg-gradient-to-r from-primary to-secondary" style={{ width: `${Math.min(100, (r.progress / r.total) * 100)}%` }} /></div> : null}
              <div className="mt-2">{controls(r)}</div>
            </li>))}
        </ul>
      )}

      {adding && <AddTitleDialog onClose={() => setAdding(false)} onDone={() => { setAdding(false); setMsg('Title added.'); for (const k of ['mylist', 'stats']) qc.invalidateQueries({ queryKey: [k] }) }} />}
      {editing && <EditDialog key={editing.mal_id} row={editing} tab={tab} pending={commit.isPending || remove.isPending} onClose={() => setEditing(null)}
        onSave={(patch) => commit.mutate({ row: editing, patch })} onRemove={() => remove.mutate(editing)} />}
    </>
  )
}
