// Authenticated. { action: 'delete', id } permanently removes a manual title: its cover image AND its database row.
// Deploy with --no-verify-jwt (the user is verified below).
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return json({ error: 'unauthorized' }, 401)

  const b = await req.json().catch(() => ({}))
  if (b.action !== 'delete' || typeof b.id !== 'string') return json({ error: 'invalid' }, 400)

  // Ownership is enforced here: only a row belonging to this user is ever found.
  const { data: row } = await admin.from('custom_entries').select('id, cover_path').eq('id', b.id).eq('user_id', user.id).maybeSingle()
  if (!row) return json({ error: 'not_found' }, 404)

  // Image first. If this fails we keep the row, so nothing is orphaned and a retry works.
  if (row.cover_path) {
    const { error } = await admin.storage.from('custom-covers').remove([row.cover_path])
    if (error) return json({ error: 'storage_failed' }, 500)
  }
  const del = await admin.from('custom_entries').delete().eq('id', row.id).eq('user_id', user.id)
  if (del.error) return json({ error: 'delete_failed' }, 500)
  return json({ ok: true })
})
