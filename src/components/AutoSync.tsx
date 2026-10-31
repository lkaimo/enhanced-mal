import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

const STALE_MS = 15 * 60_000   // sync if the last completed sync is older than this
const RETRY_MS = 5 * 60_000    // don't hammer MAL after a failed attempt
let running = false
let lastAttempt = 0

/** Background sync: on sign-in and whenever the tab becomes visible again. Renders nothing. */
export default function AutoSync() {
  const { session } = useAuth()
  const qc = useQueryClient()
  const uid = session?.user.id

  useEffect(() => {
    if (!uid) return
    async function check() {
      if (running || document.visibilityState !== 'visible' || Date.now() - lastAttempt < RETRY_MS) return
      running = true
      try {
        const { data } = await supabase.from('sync_jobs').select('finished_at').eq('status', 'completed')
          .order('finished_at', { ascending: false }).limit(1).maybeSingle()
        const last = data?.finished_at ? new Date(data.finished_at).getTime() : 0
        if (Date.now() - last < STALE_MS) return
        lastAttempt = Date.now()
        const { error } = await supabase.functions.invoke('mal-sync')
        if (!error) for (const k of ['mylist', 'stats', 'entry']) qc.invalidateQueries({ queryKey: [k] })
      } finally { running = false }
    }
    check()
    document.addEventListener('visibilitychange', check)
    return () => document.removeEventListener('visibilitychange', check)
  }, [uid, qc])
  return null
}
