import { supabase } from './supabase'
import { fetchAll } from './fetchAll'

export type CustomKind = 'anime' | 'manga' | 'manhwa' | 'manhua'
export type CustomMode = 'include' | 'only' | 'hide'
export const KINDS: [CustomKind, string][] = [['anime', 'Anime'], ['manga', 'Manga'], ['manhwa', 'Manhwa'], ['manhua', 'Manhua']]
export interface CustomEntry { id: string; title: string; kind: CustomKind; cover_path: string | null; coverUrl: string | null
  status: string; score: number; progress: number; volumes_read: number; created_at: string; updated_at: string }
const BUCKET = 'custom-covers'

/** Shrink to at most 600x900 and re-encode, so covers stay small (usually well under 200 KB). */
async function toImage(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, 600 / bmp.width, 900 / bmp.height)
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(bmp.width * scale)); c.height = Math.max(1, Math.round(bmp.height * scale))
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('encode_failed'))), 'image/webp', 0.85))
}

export async function loadCustom(): Promise<CustomEntry[]> {
  const rows = await fetchAll<any>((a, b) => supabase.from('custom_entries').select('*').order('created_at').range(a, b))
  const paths: string[] = rows.map((r) => r.cover_path).filter(Boolean)
  const urls = new Map<string, string>()
  if (paths.length) { // private bucket: images are shown through short-lived signed URLs
    const { data } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600)
    data?.forEach((d) => { if (d.signedUrl && d.path) urls.set(d.path, d.signedUrl) })
  }
  return rows.map((r) => ({ ...r, coverUrl: r.cover_path ? urls.get(r.cover_path) ?? null : null }))
}

export async function createCustom(input: { title: string; kind: CustomKind; file: File | null }): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  const uid = session?.user.id
  if (!uid) throw new Error('unauthorized')
  let path: string | null = null
  if (input.file) {
    const blob = await toImage(input.file)
    const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/jpeg' ? 'jpg' : 'webp'
    path = `${uid}/${crypto.randomUUID()}.${ext}`
    const up = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: blob.type, upsert: false })
    if (up.error) throw new Error('upload_failed')
  }
  const { error } = await supabase.from('custom_entries').insert({
    title: input.title, kind: input.kind, cover_path: path, status: input.kind === 'anime' ? 'plan_to_watch' : 'plan_to_read' })
  if (error) { if (path) await supabase.storage.from(BUCKET).remove([path]); throw new Error('save_failed') } // don't leave an orphan image
}

export async function updateCustom(id: string, p: { status: string; score: number; progress: number; volumes_read: number }): Promise<{ sync: 'synced' | 'failed' }> {
  const { error } = await supabase.from('custom_entries').update({ ...p, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw new Error('save_failed')
  return { sync: 'synced' }
}

/** Permanent: removes the image and the row (server-side, so both go together). */
export async function deleteCustom(id: string): Promise<{ sync: 'synced' | 'failed' }> {
  const { error } = await supabase.functions.invoke('custom-title', { body: { action: 'delete', id } })
  if (error) throw new Error('delete_failed')
  return { sync: 'synced' }
}
