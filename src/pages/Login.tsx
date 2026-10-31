import { useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

const ERRORS: Record<string, string> = {
  denied: 'You canceled on MyAnimeList, so nothing was signed in.',
  expired: 'That sign-in attempt expired. Start again.',
  error: 'Signing in with MyAnimeList failed. Try again.'
}

export default function LoginPage() {
  const { session, loading: authLoading } = useAuth()
  const [params] = useSearchParams()
  const [error, setError] = useState<string | null>(ERRORS[params.get('error') ?? ''] ?? null)
  const [loading, setLoading] = useState(false)
  if (!authLoading && session) return <Navigate to="/" replace />

  async function signIn() {
    setLoading(true); setError(null)
    const { data, error } = await supabase.functions.invoke('mal-login')
    if (error || !data?.url) { setError('Could not reach MyAnimeList sign-in. Try again.'); setLoading(false); return }
    window.location.href = data.url
  }
  return (
    <div className="mx-auto mt-16 max-w-md rounded-2xl border border-line bg-surface p-8">
      <h1 className="font-display text-3xl font-bold">Enhanced <span className="text-primary">MAL</span></h1>
      <p className="mt-2 text-muted">Sign in with your MyAnimeList account to track anime, manga and manhwa.</p>
      <button onClick={signIn} disabled={loading} className="mt-6 w-full rounded-lg bg-primary px-4 py-2.5 font-bold text-background disabled:opacity-60">
        {loading ? 'Redirecting…' : 'Sign in with MyAnimeList'}
      </button>
      <p className="mt-4 text-xs text-muted">You approve access on myanimelist.net. We never see your MAL password.</p>
      {error && <p role="alert" className="mt-4 text-sm text-primary">{error}</p>}
    </div>
  )
}
