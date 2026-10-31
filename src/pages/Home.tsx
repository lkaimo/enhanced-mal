import { Link } from 'react-router-dom'
import { Shelf } from '../components/Shelf'
import { ranking } from '../lib/mal'
import { useAuth } from '../lib/auth'

export default function HomePage() {
  const { session } = useAuth()
  const firstName = (session?.user.user_metadata?.full_name as string | undefined)?.split(' ')[0]
  return (
    <>
      <header className="rounded-2xl border border-line bg-gradient-to-r from-primary/20 to-secondary/20 p-6 md:p-8">
        {session ? (
          <>
            <h1 className="font-display text-3xl font-bold md:text-4xl">Welcome back{firstName ? `, ${firstName}` : ''}</h1>
            <p className="mt-2 max-w-prose text-muted">Your lists and sync settings are one click away.</p>
            <Link to="/mylist" className="mt-5 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-bold text-background hover:opacity-90">Open MyList</Link>
          </>
        ) : (
          <>
            <h1 className="font-display text-3xl font-bold md:text-4xl">Track every series in one place</h1>
            <p className="mt-2 max-w-prose text-muted">Anime, manga, manhwa and manhua, synced with your MyAnimeList account.</p>
            <Link to="/login" className="mt-5 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-bold text-background hover:opacity-90">Sign in</Link>
          </>
        )}
      </header>
      <Shelf title="Popular anime" type="anime" queryKey={['rank', 'anime', 'bypopularity']} fetcher={() => ranking('anime', 'bypopularity')} />
      <Shelf title="Top movies" type="anime" queryKey={['rank', 'anime', 'movie']} fetcher={() => ranking('anime', 'movie')} />
      <Shelf title="Top manga" type="manga" queryKey={['rank', 'manga', 'manga']} fetcher={() => ranking('manga', 'manga')} />
      <Shelf title="Top manhwa" type="manga" queryKey={['rank', 'manga', 'manhwa']} fetcher={() => ranking('manga', 'manhwa')} />
      <Shelf title="Top manhua" type="manga" queryKey={['rank', 'manga', 'manhua']} fetcher={() => ranking('manga', 'manhua')} />
    </>
  )
}
