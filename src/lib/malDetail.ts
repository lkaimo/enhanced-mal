import { supabase } from './supabase'
import type { MediaType } from './mal'

const FIELDS: Record<MediaType, string> = {
  anime: 'id,title,main_picture,alternative_titles,start_date,end_date,synopsis,mean,rank,popularity,media_type,status,genres,num_episodes,related_anime,recommendations',
  manga: 'id,title,main_picture,alternative_titles,start_date,end_date,synopsis,mean,rank,popularity,media_type,status,genres,num_chapters,num_volumes,authors{first_name,last_name},related_manga,recommendations'
}
export async function getDetail(type: MediaType, id: number): Promise<any> {
  const { data, error } = await supabase.functions.invoke('mal-proxy', { body: { path: `/${type}/${id}`, params: { fields: FIELDS[type] } } })
  if (error) throw error
  return data
}
export const STATUS_OPTIONS: Record<MediaType, [string, string][]> = {
  anime: [['watching', 'Watching'], ['completed', 'Completed'], ['on_hold', 'On hold'], ['dropped', 'Dropped'], ['plan_to_watch', 'Plan to watch']],
  manga: [['reading', 'Reading'], ['completed', 'Completed'], ['on_hold', 'On hold'], ['dropped', 'Dropped'], ['plan_to_read', 'Plan to read']]
}
export async function callUpdate(body: Record<string, unknown>): Promise<{ sync: 'synced' | 'failed' }> {
  const { data, error } = await supabase.functions.invoke('mal-update', { body })
  if (error) { const b = await (error as any).context?.json?.().catch(() => null); throw new Error(b?.error ?? 'failed') }
  return data
}
