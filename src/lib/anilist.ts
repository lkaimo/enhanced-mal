import type { MediaType } from './mal'

/** MyAnimeList's API doesn't expose a title's original work, so we ask AniList (free, public, no key), matched by MAL ID. */
export interface Adaptation { malId: number | null; title: string; kind: MediaType; format: string }

const QUERY = `query ($id: Int, $type: MediaType) {
  Media(idMal: $id, type: $type) {
    relations { edges { relationType node { idMal type format title { romaji english } } } }
  }
}`

export async function getAdaptations(type: MediaType, malId: number): Promise<Adaptation[]> {
  try {
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query: QUERY, variables: { id: malId, type: type === 'anime' ? 'ANIME' : 'MANGA' } })
    })
    if (!res.ok) return [] // 404 when AniList doesn't know the title
    const edges: any[] = (await res.json())?.data?.Media?.relations?.edges ?? []
    const other = type === 'anime' ? 'MANGA' : 'ANIME' // an anime's source is a manga/novel; a manga's adaptation is an anime
    return edges
      .filter((e) => (e.relationType === 'ADAPTATION' || e.relationType === 'SOURCE') && e.node?.type === other)
      .map((e) => ({
        malId: e.node.idMal ?? null, title: e.node.title?.english ?? e.node.title?.romaji ?? 'Untitled',
        kind: (other === 'ANIME' ? 'anime' : 'manga') as MediaType, format: String(e.node.format ?? '')
      }))
  } catch {
    return [] // network or rate-limit trouble just hides the extra line
  }
}
