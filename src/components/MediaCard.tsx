import { Link } from 'react-router-dom'
import { Star } from 'lucide-react'
import type { MalNode, MediaType } from '../lib/mal'

/** `fluid` makes the card fill its grid cell instead of keeping a fixed shelf width. */
export function MediaCard({ node, type, fluid = false }: { node: MalNode; type: MediaType; fluid?: boolean }) {
  return (
    <Link to={`/${type}/${node.id}`} className={`group block ${fluid ? 'w-full' : 'w-36 shrink-0 sm:w-40'}`}>
      <div className="aspect-[2/3] overflow-hidden rounded-xl border border-line bg-surface">
        {node.main_picture && <img src={node.main_picture.medium} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />}
      </div>
      <p className="mt-2 line-clamp-2 text-sm font-medium group-hover:text-primary">{node.title}</p>
      {node.mean != null && <p className="mt-0.5 flex items-center gap-1 text-xs text-muted"><Star size={12} aria-hidden /> <span>Score {node.mean.toFixed(2)}</span></p>}
    </Link>
  )
}

export function CardSkeletons({ n = 8, fluid = false }: { n?: number; fluid?: boolean }) {
  return <>{Array.from({ length: n }, (_, i) => <div key={i} className={fluid ? 'w-full' : 'w-36 shrink-0 sm:w-40'}><div className="aspect-[2/3] animate-pulse rounded-xl bg-surface" /><div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-surface" /></div>)}</>
}
