// Public MAL catalog proxy. The Client ID lives in Supabase secrets, never in the browser.
const ALLOWED = [/^\/anime$/, /^\/anime\/\d+$/, /^\/anime\/ranking$/, /^\/anime\/season\/\d{4}\/(winter|spring|summer|fall)$/,
  /^\/manga$/, /^\/manga\/\d+$/, /^\/manga\/ranking$/]
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const { path, params = {} } = await req.json()
    if (typeof path !== 'string' || !ALLOWED.some((r) => r.test(path))) return json({ error: 'Path not allowed' }, 400)
    const url = new URL(`https://api.myanimelist.net/v2${path}`)
    for (const [k, v] of Object.entries(params as Record<string, unknown>)) url.searchParams.set(k, String(v))
    for (let attempt = 0; attempt < 3; attempt++) { // bounded retry with backoff
      const res = await fetch(url, { headers: { 'X-MAL-CLIENT-ID': Deno.env.get('MAL_CLIENT_ID')! } })
      if (res.status === 429 || res.status >= 500) { await new Promise((r) => setTimeout(r, 400 * 2 ** attempt)); continue }
      return new Response(await res.text(), { status: res.status, headers: { ...cors, 'Content-Type': 'application/json' } })
    }
    return json({ error: 'MAL unavailable' }, 502)
  } catch { return json({ error: 'Bad request' }, 400) }
})
