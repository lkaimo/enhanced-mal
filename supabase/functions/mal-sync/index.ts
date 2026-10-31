// Imports MAL anime + manga lists into list_entries / catalog_items.
//  - Browser call: signed-in user's own list.   - Cron call (x-cron-secret header): every connected user, throttled.
// Deploy with --no-verify-jwt (the user, or the cron secret, is verified below).
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret' }
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
class ReauthError extends Error {}

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

async function malGet(url: string, token: string) {
  for (let i = 0; i < 3; i++) { // bounded retry with backoff
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (res.status === 401) throw new ReauthError('unauthorized')
    if (res.status === 429 || res.status >= 500) { await new Promise((r) => setTimeout(r, 500 * 2 ** i)); continue }
    if (!res.ok) throw new Error(`MAL ${res.status}`)
    return await res.json()
  }
  throw new Error('MAL unavailable')
}

const date = (d?: string) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null)

async function importList(userId: string, type: 'anime' | 'manga', token: string) {
  const fields = type === 'anime' ? 'list_status,media_type,num_episodes,genres' : 'list_status,media_type,num_chapters,num_volumes,genres'
  let url: string | undefined = `https://api.myanimelist.net/v2/users/@me/${type}list?limit=1000&nsfw=true&fields=${fields}`
  const entries: Record<string, unknown>[] = [], catalog: Record<string, unknown>[] = [], seen = new Set<number>()
  const now = new Date().toISOString()

  // Never overwrite local edits that haven't reached MAL yet.
  const { data: held } = await admin.from('list_entries').select('mal_id').eq('user_id', userId).eq('media_type', type).in('sync_status', ['pending', 'failed'])
  const protectedIds = new Set((held ?? []).map((r) => r.mal_id as number))

  while (url) {
    const page = await malGet(url, token)
    for (const it of page.data) {
      const n = it.node, ls = it.list_status
      seen.add(n.id)
      catalog.push({ mal_id: n.id, media_type: type, title: n.title, cover_image_url: n.main_picture?.large ?? n.main_picture?.medium ?? null,
        genres: n.genres ?? [], metadata: { media_type: n.media_type, num_episodes: n.num_episodes, num_chapters: n.num_chapters, num_volumes: n.num_volumes }, cached_at: now })
      if (protectedIds.has(n.id)) continue
      entries.push({
        user_id: userId, mal_id: n.id, media_type: type, status: ls.status, score: ls.score ?? 0,
        progress: (type === 'anime' ? ls.num_episodes_watched : ls.num_chapters_read) ?? 0,
        volumes_read: type === 'manga' ? ls.num_volumes_read ?? 0 : null,
        started_at: date(ls.start_date), completed_at: date(ls.finish_date),
        is_manhwa: type === 'manga' ? n.media_type === 'manhwa' : null,
        updated_at: ls.updated_at ?? now, sync_status: 'synced', last_synced_at: now
      })
    }
    url = page.paging?.next
  }
  for (let i = 0; i < catalog.length; i += 500) {
    const e = await admin.from('catalog_items').upsert(catalog.slice(i, i + 500), { onConflict: 'mal_id,media_type' })
    if (e.error) throw new Error(e.error.message)
  }
  for (let i = 0; i < entries.length; i += 500) {
    const e = await admin.from('list_entries').upsert(entries.slice(i, i + 500), { onConflict: 'user_id,media_type,mal_id' })
    if (e.error) throw new Error(e.error.message)
  }

  // Mirror removals made on MAL (only synced rows; skipped entirely if MAL returned nothing).
  let removed = 0
  if (seen.size > 0) {
    const local: number[] = []
    for (let from = 0; ; from += 1000) {
      const { data } = await admin.from('list_entries').select('mal_id').eq('user_id', userId).eq('media_type', type).eq('sync_status', 'synced').range(from, from + 999)
      local.push(...(data ?? []).map((r) => r.mal_id as number))
      if (!data || data.length < 1000) break
    }
    const gone = local.filter((id) => !seen.has(id))
    for (let i = 0; i < gone.length; i += 200) {
      await admin.from('list_entries').delete().eq('user_id', userId).eq('media_type', type).in('mal_id', gone.slice(i, i + 200))
    }
    removed = gone.length
  }
  return { count: entries.length, removed }
}

async function syncUser(userId: string) {
  const { data: job } = await admin.from('sync_jobs').insert({ user_id: userId, job_type: 'import', status: 'running', started_at: new Date().toISOString() }).select('id').single()
  try {
    const token = await getAccessToken(userId)
    const anime = await importList(userId, 'anime', token)
    const manga = await importList(userId, 'manga', token)
    await admin.from('sync_jobs').update({ status: 'completed', finished_at: new Date().toISOString(), metadata: { anime: anime.count, manga: manga.count, removed: anime.removed + manga.removed } }).eq('id', job?.id)
    return { anime: anime.count, manga: manga.count, removed: anime.removed + manga.removed }
  } catch (e) {
    await admin.from('sync_jobs').update({ status: 'failed', finished_at: new Date().toISOString(), error_message: (e as Error).message }).eq('id', job?.id)
    throw e
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  // Scheduled run: all connected users, skipping anyone synced in the last 50 minutes, within a time budget.
  const secret = Deno.env.get('CRON_SECRET')
  if (secret && req.headers.get('x-cron-secret') === secret) {
    const start = Date.now(), since = new Date(Date.now() - 50 * 60_000).toISOString()
    const { data: creds } = await admin.from('mal_credentials').select('user_id')
    let done = 0
    for (const c of creds ?? []) {
      if (Date.now() - start > 100_000) break
      const { data: recent } = await admin.from('sync_jobs').select('id').eq('user_id', c.user_id).eq('status', 'completed').gt('finished_at', since).limit(1)
      if (recent?.length) continue
      try { await syncUser(c.user_id); done++ } catch { /* failure is recorded in sync_jobs */ }
    }
    return json({ users: done })
  }

  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return json({ error: 'unauthorized' }, 401)
  try { return json(await syncUser(user.id)) } catch (e) {
    const reauth = e instanceof ReauthError
    return json({ error: reauth ? 'reauth' : 'sync_failed' }, reauth ? 401 : 500)
  }
})
