import { getServiceKey } from './apikey'

const BASE = 'https://open.api.nexon.com'

export interface CharBasic {
  ocid: string
  character_name: string
  world_name: string
  character_class: string
  character_level: number
  character_image?: string
}

// 서비스 API 키로 캐릭터 OCID 목록 조회
async function fetchOcidList(apiKey: string): Promise<string[]> {
  const res = await fetch(`${BASE}/maplestory/v1/character/list`, {
    headers: {
      'x-nxopen-api-key': apiKey,
      'Cache-Control': 'no-store, no-cache',
      Pragma: 'no-cache'
    },
    cache: 'no-store'
  })
  if (!res.ok) {
    const msg = await res.text().catch(() => '')
    throw new Error(`캐릭터 목록 조회 실패 (${res.status}): ${msg}`)
  }
  const json = await res.json() as {
    account_list: Array<{ character_list: Array<{ ocid: string }> }>
  }
  return (json.account_list ?? []).flatMap(a => (a.character_list ?? []).map(c => c.ocid))
}

// 기본 정보 배치 조회 (5개씩 병렬, 속도 제한)
async function fetchBasicBatch(
  ocids: string[],
  apiKey: string,
  onProgress: (done: number, total: number) => void
): Promise<CharBasic[]> {
  const results: CharBasic[] = []
  const BATCH = 5

  for (let i = 0; i < ocids.length; i += BATCH) {
    const chunk = ocids.slice(i, i + BATCH)
    const settled = await Promise.allSettled(
      chunk.map(ocid =>
        fetch(`${BASE}/maplestory/v1/character/basic?ocid=${encodeURIComponent(ocid)}`, {
          headers: {
            'x-nxopen-api-key': apiKey,
            'Cache-Control': 'no-store, no-cache',
            Pragma: 'no-cache'
          },
          cache: 'no-store'
        })
          .then(r => r.json() as Promise<CharBasic>)
          .then(d => ({ ...d, ocid }))
      )
    )
    settled.forEach(r => { if (r.status === 'fulfilled') results.push(r.value) })
    onProgress(Math.min(i + BATCH, ocids.length), ocids.length)
    if (i + BATCH < ocids.length) await new Promise(r => setTimeout(r, 150))
  }
  return results
}

async function verifyById(
  basics: CharBasic[],
  apiKey: string,
  onProgress: (done: number, total: number) => void
): Promise<CharBasic[]> {
  const BATCH = 5
  const next = [...basics]

  for (let i = 0; i < next.length; i += BATCH) {
    const chunk = next.slice(i, i + BATCH)
    const settled = await Promise.allSettled(
      chunk.map(async (c) => {
        const name = c.character_name?.trim()
        if (!name) return c

        const idRes = await fetch(`${BASE}/maplestory/v1/id?character_name=${encodeURIComponent(name)}`, {
          headers: {
            'x-nxopen-api-key': apiKey,
            'Cache-Control': 'no-store, no-cache',
            Pragma: 'no-cache'
          },
          cache: 'no-store'
        })
        if (!idRes.ok) return c

        const idJson = await idRes.json() as { ocid?: string }
        if (!idJson.ocid) return c

        const basicRes = await fetch(`${BASE}/maplestory/v1/character/basic?ocid=${encodeURIComponent(idJson.ocid)}`, {
          headers: {
            'x-nxopen-api-key': apiKey,
            'Cache-Control': 'no-store, no-cache',
            Pragma: 'no-cache'
          },
          cache: 'no-store'
        })
        if (!basicRes.ok) return c

        const basicJson = await basicRes.json() as CharBasic
        return { ...basicJson, ocid: idJson.ocid }
      })
    )

    settled.forEach((r, idx) => {
      if (r.status === 'fulfilled') next[i + idx] = r.value
    })
    onProgress(Math.min(i + BATCH, next.length), next.length)
    if (i + BATCH < next.length) await new Promise(r => setTimeout(r, 150))
  }

  return next
}

// ── 공개 API ──────────────────────────────────────────────────────────────────
export async function loadAllCharacters(
  onProgress: (done: number, total: number) => void
): Promise<CharBasic[]> {
  const apiKey = getServiceKey()
  if (!apiKey) throw new Error('API 키가 설정되지 않았습니다')

  onProgress(0, 1)
  const ocids = await fetchOcidList(apiKey)
  if (ocids.length === 0) return []

  const basics = await fetchBasicBatch(ocids, apiKey, onProgress)
  return verifyById(basics, apiKey, onProgress)
}
