import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Plus, Star } from 'lucide-react'
import type { MalNode, MediaType } from '../lib/mal'
import { callUpdate, STATUS_OPTIONS } from '../lib/malDetail'

const STATUS_LABEL: Record<string, string> = Object.fromEntries([...STATUS_OPTIONS.anime, ...STATUS_OPTIONS.manga])

/** Cover card with a media-type badge, an "on your list" status, and a quick-add button. */
export function ExploreCard({ node, type, listStatus, signedIn }: { node: MalNode; type: MediaType; listStatus?: string; signedIn: boolean }) {
  const qc = useQueryClient()
  const [msg, setMsg] = useState<string | null>(null)
  const add = useMutation({
    mutationFn: () => callUpdate({ action: 'save', type, id: node.id, status: type === 'anime' ? 'plan_to_watch' : 'plan_to_read', score: 0, progress: 0, volumes_read: 0 }),
    onSuccess: (r) => {
      setMsg(r.sync === 'synced' ? null : 'Saved here; not synced to MyAnimeList yet.')
      for (const k of ['listmap', 'mylist', 'stats']) qc.invalidateQueries({ queryKey: [k] })
    },
    onError: () => setMsg('Couldn’t add. Try again.')
  })
  const label = node.media_type?.replace(/_/g, ' ')
  return (
    <div className="group w-36 shrink-0 sm:w-40">
      <div className="relative">
        <Link to={`/${type}/${node.id}`} className="block" tabIndex={-1} aria-hidden>
          <div className="aspect-[2/3] overflow-hidden rounded-xl border border-line bg-surface">
            {node.main_picture && <img src={node.main_picture.medium} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />}
          </div>
        </Link>
        {label && <span className="pointer-events-none absolute left-2 top-2 rounded-md bg-background/85 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">{label}</span>}
        {signedIn && !listStatus && (
          <button onClick={() => add.mutate()} disabled={add.isPending} aria-label={`Add ${node.title} to ${type === 'anime' ? 'Plan to watch' : 'Plan to read'}`}
            title={type === 'anime' ? 'Add to Plan to watch' : 'Add to Plan to read'}
            className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-background shadow disabled:opacity-60">
            <Plus size={18} aria-hidden />
          </button>
        )}
      </div>
      <Link to={`/${type}/${node.id}`} className="mt-2 line-clamp-2 block text-sm font-medium group-hover:text-primary">{node.title}</Link>
      {node.mean != null && <p className="mt-0.5 flex items-center gap-1 text-xs text-muted"><Star size={12} aria-hidden /><span>Score {node.mean.toFixed(2)}</span></p>}
      {listStatus && <p className="mt-1 inline-flex items-center gap-1 rounded-full border border-tertiary/60 px-2 py-0.5 text-[11px] text-tertiary"><Check size={12} aria-hidden />On your list: {STATUS_LABEL[listStatus] ?? listStatus}</p>}
      {msg && <p role="status" className="mt-1 text-xs text-muted">{msg}</p>}
    </div>
  )
}
