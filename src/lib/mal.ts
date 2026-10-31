import { supabase } from './supabase'

export type MediaType = 'anime' | 'manga'
export interface MalNode {
  id: number; title: string; main_picture?: { medium: string; large?: string }
  mean?: number; media_type?: string; start_season?: { year: number; season: string }; genres?: { id: number; name: string }[]
}
export interface MalPage { data: { node: MalNode }[]; paging?: { next?: string } }

const CARD_FIELDS = 'id,title,main_picture,mean,media_type,genres'

/** All MAL catalog calls go through the mal-proxy Edge Function so credentials stay server-side. */
async function malGet<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke('mal-proxy', { body: { path, params } })
  if (error) throw new Error(error.message)
  return data as T
}

export const currentSeason = (d = new Date()) => ({
  year: d.getFullYear(), season: (['winter', 'spring', 'summer', 'fall'] as const)[Math.floor(d.getMonth() / 3)]
})

export const searchMedia = (type: MediaType, q: string, offset = 0, limit = 24, nsfw = false) =>
  malGet<MalPage>(`/${type}`, { q, limit, offset, nsfw: nsfw ? 'true' : 'false', fields: CARD_FIELDS })
export const ranking = (type: MediaType, rankingType: string, limit = 18) =>
  malGet<MalPage>(`/${type}/ranking`, { ranking_type: rankingType, limit, fields: CARD_FIELDS })
export const seasonal = (year: number, season: string, limit = 18, offset = 0) =>
  malGet<MalPage>(`/anime/season/${year}/${season}`, { limit, offset, sort: 'anime_num_list_users', fields: `${CARD_FIELDS},start_season` })
