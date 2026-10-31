// Public: starts "Sign in with MyAnimeList". Deploy with --no-verify-jwt.
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const b64url = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const state = b64url(crypto.getRandomValues(new Uint8Array(24)))
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(64))) // MAL supports PKCE "plain" only
  await admin.from('mal_oauth_states').delete().lt('created_at', new Date(Date.now() - 3600_000).toISOString())
  const { error } = await admin.from('mal_oauth_states').insert({ state, code_verifier: verifier })
  if (error) return json({ error: 'Could not start sign-in' }, 500)
  const url = new URL('https://myanimelist.net/v1/oauth2/authorize')
  url.search = new URLSearchParams({
    response_type: 'code', client_id: Deno.env.get('MAL_CLIENT_ID')!, state,
    code_challenge: verifier, code_challenge_method: 'plain',
    redirect_uri: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mal-callback`
  }).toString()
  return json({ url: url.toString() })
})
