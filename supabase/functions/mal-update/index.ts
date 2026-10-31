// Authenticated. { action: 'save' | 'remove', type, id, status?, score?, progress?, volumes_read? }
// Saves locally first, then pushes to MAL; sync_status records the outcome. Deploy with --no-verify-jwt (user verified below).
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
class ReauthError extends Error {}
const STATUSES = {
  anime: ['watching', 'completed', 'on_hold', 'dropped', 'plan_to_watch'],
  manga: ['reading', 'completed', 'on_hold', 'dropped', 'plan_to_read']
} as const

async function getAccessToken(userId: string): Promise<string> {
  const { data: c } = await admin.from('mal_credentials').select('*').eq('user_id', userId).maybeSingle()
  if (!c) throw new ReauthError('no credentials')
  if (new Date(c.expires_at).getTime() - Date.now() > 120_000) return c.access_token
  const res = await fetch('https://myanimelist.net/v1/oauth2/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: Deno.env.get('MAL_CLIENT_ID')!, client_secret: Deno.env.get('MAL_CLIENT_SECRET')!,
      grant_type: 'refresh_token', refresh_token: c.refresh_token })
  })
  if (!res.ok) throw new ReauthError('refresh failed')
  const t = await res.json()
  await admin.from('mal_credentials').upsert({ user_id: userId, access_token: t.access_token, refresh_token: t.refresh_token,
    expires_at: new Date(Date.now() + t.expires_in * 1000).toISOString(), updated_at: new Date().toISOString() })
  return t.access_token
}

async function malFetch(url: string, token: string, init: RequestInit = {}): Promise<Response> {
  for (let i = 0; i < 3; i++) { // bounded retry with backoff
    const res = await fetch(url, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` } })
    if (res.status === 401) throw new ReauthError('unauthorized')
    if (res.status === 429 || res.status >= 500) { await new Promise((r) => setTimeout(r, 500 * 2 ** i)); continue }
    return res
  }
  throw new Error('MAL unavailable')
}
const date = (d?: string) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null)
const int = (v: unknown, max = 100000) => (Number.isInteger(v) && (v as number) >= 0 && (v as number) <= max ? (v as number) : null)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return json({ error: 'unauthorized' }, 401)

  const b = await req.json().catch(() => ({}))
  const type = b.type as 'anime' | 'manga', id = b.id as number
  if ((type !== 'anime' && type !== 'manga') || !Number.isInteger(id) || id <= 0) return json({ error: 'invalid' }, 400)
  const base = `https://api.myanimelist.net/v2/${type}/${id}`

  try {
    const token = await getAccessToken(user.id)

    if (b.action === 'remove') {
      const res = await malFetch(`${base}/my_list_status`, token, { method: 'DELETE' })
      if (!res.ok && res.status !== 404) return json({ sync: 'failed' }) // keep the local row so nothing is lost
      await admin.from('list_entries').delete().eq('user_id', user.id).eq('media_type', type).eq('mal_id', id)
      return json({ sync: 'synced' })
    }
    if (b.action !== 'save') return json({ error: 'invalid' }, 400)

    const status = b.status as string, score = int(b.score, 10), progress = int(b.progress), volumes = type === 'manga' ? int(b.volumes_read ?? 0) : null
    if (!(STATUSES[type] as readonly string[]).includes(status) || score === null || progress === null || (type === 'manga' && volumes === null)) return json({ error: 'invalid' }, 400)

    // Cache catalog metadata from MAL itself (never from the browser, since this table is readable by all users).
    const f = type === 'anime' ? 'title,main_picture,genres,media_type,num_episodes' : 'title,main_picture,genres,media_type,num_chapters,num_volumes'
    const dRes = await malFetch(`${base}?fields=${f}`, token)
    if (!dRes.ok) return json({ error: 'invalid' }, 400)
    const d = await dRes.json()
    await admin.from('catalog_items').upsert({ mal_id: id, media_type: type, title: d.title, cover_image_url: d.main_picture?.large ?? d.main_picture?.medium ?? null,
      genres: d.genres ?? [], metadata: { media_type: d.media_type, num_episodes: d.num_episodes, num_chapters: d.num_chapters, num_volumes: d.num_volumes },
      cached_at: new Date().toISOString() }, { onConflict: 'mal_id,media_type' })

    // 1) Local first
    const local = { user_id: user.id, mal_id: id, media_type: type, status, score, progress, volumes_read: volumes,
      is_manhwa: type === 'manga' ? d.media_type === 'manhwa' : null, sync_status: 'pending', updated_at: new Date().toISOString() }
    const up = await admin.from('list_entries').upsert(local, { onConflict: 'user_id,media_type,mal_id' })
    if (up.error) return json({ error: 'save_failed' }, 500)

    // 2) Push to MAL
    const form = new URLSearchParams({ status, score: String(score) })
    if (type === 'anime') form.set('num_watched_episodes', String(progress))
    else { form.set('num_chapters_read', String(progress)); form.set('num_volumes_read', String(volumes)) }
    const res = await malFetch(`${base}/my_list_status`, token, { method: 'PATCH', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form })
    if (!res.ok) {
      await admin.from('list_entries').update({ sync_status: 'failed' }).eq('user_id', user.id).eq('media_type', type).eq('mal_id', id)
      return json({ sync: 'failed' })
    }
    // 3) Mirror MAL's authoritative response (e.g. it may complete progress when status = completed)
    const ls = await res.json()
    await admin.from('list_entries').update({
      status: ls.status, score: ls.score ?? 0, progress: (type === 'anime' ? ls.num_episodes_watched : ls.num_chapters_read) ?? progress,
      volumes_read: type === 'manga' ? ls.num_volumes_read ?? volumes : null, started_at: date(ls.start_date), completed_at: date(ls.finish_date),
      updated_at: ls.updated_at ?? new Date().toISOString(), sync_status: 'synced', last_synced_at: new Date().toISOString()
    }).eq('user_id', user.id).eq('media_type', type).eq('mal_id', id)
    return json({ sync: 'synced' })
  } catch (e) {
    if (e instanceof ReauthError) return json({ error: 'reauth' }, 401)
    return json({ error: 'failed' }, 500)
  }
})
