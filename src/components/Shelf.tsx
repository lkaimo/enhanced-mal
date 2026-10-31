import { useQuery } from '@tanstack/react-query'
import { CardSkeletons, MediaCard } from './MediaCard'
import type { MalPage, MediaType } from '../lib/mal'

export function Shelf({ title, type, queryKey, fetcher }: { title: string; type: MediaType; queryKey: unknown[]; fetcher: () => Promise<MalPage> }) {
  const { data, isLoading, error, refetch } = useQuery({ queryKey, queryFn: fetcher })
  return (
    <section aria-label={title} className="mt-10">
      <h2 className="mb-4 font-display text-xl font-bold">{title}</h2>
      {error ? (
        <p role="alert" className="text-sm text-muted">Couldn’t load this section. <button onClick={() => refetch()} className="text-tertiary underline">Try again</button></p>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-3">
          {isLoading ? <CardSkeletons /> : data?.data.map(({ node }) => <MediaCard key={node.id} node={node} type={type} />)}
        </div>
      )}
    </section>
  )
}
