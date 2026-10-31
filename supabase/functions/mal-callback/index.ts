// MAL redirects the browser here. Deploy with --no-verify-jwt. Trust comes from the one-time `state`.
import { createClient } from 'npm:@supabase/supabase-js@2'

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
const app = Deno.env.get('APP_URL')!
const fail = (e: string) => Response.redirect(`${app}/login?error=${e}`, 302)
const placeholderEmail = (malId: number | string) => `mal-${malId}@users.invalid` // MAL shares no email

Deno.serve(async (req) => {
  const q = new URL(req.url).searchParams
  if (q.get('error')) return fail('denied')
  const code = q.get('code'), state = q.get('state')
  if (!code || !state) return fail('error')

  const { data: row } = await admin.from('mal_oauth_states').select('*').eq('state', state).maybeSingle()
  if (!row) return fail('error')
  await admin.from('mal_oauth_states').delete().eq('state', state) // single use
  if (Date.now() - new Date(row.created_at).getTime() > 10 * 60_000) return fail('expired')

  const tokenRes = await fetch('https://myanimelist.net/v1/oauth2/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('MAL_CLIENT_ID')!, client_secret: Deno.env.get('MAL_CLIENT_SECRET')!,
      grant_type: 'authorization_code', code, code_verifier: row.code_verifier,
      redirect_uri: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mal-callback`
    })
  })
  if (!tokenRes.ok) return fail('error')
  const tok = await tokenRes.json()

  const me = await fetch('https://api.myanimelist.net/v2/users/@me', { headers: { Authorization: `Bearer ${tok.access_token}` } })
  if (!me.ok) return fail('error')
  const profile = await me.json() // { id, name, picture? }
  const malId = String(profile.id)

  // Find or create the app user for this MAL identity (never matched by email).
  const { data: link } = await admin.from('linked_accounts').select('user_id').eq('provider', 'mal').eq('provider_user_id', malId).maybeSingle()
  let userId: string | undefined = link?.user_id
  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({
      email: placeholderEmail(malId), email_confirm: true,
      user_metadata: { full_name: profile.name, avatar_url: profile.picture ?? null, mal_id: malId }
    })
    if (error || !data.user) return fail('error')
    userId = data.user.id
    const ins = await admin.from('linked_accounts').insert({ user_id: userId, provider: 'mal', provider_user_id: malId })
    if (ins.error) return fail('error')
  } else {
    await admin.from('profiles').update({ display_name: profile.name, avatar_url: profile.picture ?? null, updated_at: new Date().toISOString() }).eq('id', userId)
  }

  await admin.from('mal_credentials').upsert({
    user_id: userId, access_token: tok.access_token, refresh_token: tok.refresh_token,
    expires_at: new Date(Date.now() + tok.expires_in * 1000).toISOString(), updated_at: new Date().toISOString()
  })

  // One-time token the browser trades for a session (no tokens or secrets in the URL).
  const { data: l, error: le } = await admin.auth.admin.generateLink({ type: 'magiclink', email: placeholderEmail(malId) })
  if (le || !l.properties?.hashed_token) return fail('error')
  return Response.redirect(`${app}/auth/callback?token_hash=${encodeURIComponent(l.properties.hashed_token)}`, 302)
})
