import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

export default function SettingsPage() {
  const { session } = useAuth()
  const meta = session?.user.user_metadata as { full_name?: string; avatar_url?: string; mal_id?: string } | undefined
  return (
    <>
      <h1 className="font-display text-3xl font-bold">Settings</h1>
      <section className="mt-8 rounded-xl border border-line bg-surface p-5">
        <h2 className="font-display text-lg font-bold">MyAnimeList account</h2>
        <div className="mt-3 flex items-center gap-4">
          {meta?.avatar_url && <img src={meta.avatar_url} alt="" className="h-14 w-14 rounded-full border border-line object-cover" />}
          <div>
            <p className="font-medium">{meta?.full_name ?? 'MAL user'}</p>
            <p className="text-sm text-muted">Status: Connected (MAL user ID {meta?.mal_id})</p>
          </div>
        </div>
        <button onClick={() => supabase.auth.signOut()} className="mt-5 rounded-lg border border-line px-4 py-2 text-sm hover:border-primary">Sign out</button>
        <p className="mt-3 text-xs text-muted">To revoke this app’s access completely, remove it in your MyAnimeList account settings.</p>
      </section>
    </>
  )
}
