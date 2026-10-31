import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function AuthCallback() {
  const [params] = useSearchParams()
  const nav = useNavigate()
  const ran = useRef(false) // the token is single-use; guard against StrictMode's double effect
  useEffect(() => {
    if (ran.current) return
    ran.current = true
    const tokenHash = params.get('token_hash')
    if (!tokenHash) { nav('/login?error=error', { replace: true }); return }
    supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' })
      .then(({ error }) => nav(error ? '/login?error=error' : '/', { replace: true }))
  }, [params, nav])
  return <p className="p-8 text-muted" role="status">Signing you in…</p>
}
