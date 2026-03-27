import { getServiceKey } from './apikey'

const BASE = 'https://open.api.nexon.com'

export interface CharBasic {
  ocid: string
  character_name: string
  world_name: string
  character_class: string
  character_level: number
  character_image?: string
  accountIndex: number
}

// 서비스 API 키로 캐릭터 OCID 목록 조회 (계정 인덱스 포함)
async function fetchOcidList(apiKey: string): Promise<{ ocid: string; accountIndex: number }[]> {
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
  return (json.account_list ?? []).flatMap((a, accountIndex) =>
    (a.character_list ?? []).map(c => ({ ocid: c.ocid, accountIndex }))
  )
}

async function fetchOneBasic(
  entry: { ocid: string; accountIndex: number },
  apiKey: string,
  retries = 2
): Promise<CharBasic> {
  const { ocid, accountIndex } = entry
  for (let attempt = 0; attempt <= retries; attempt++) {
    const r = await fetch(`${BASE}/maplestory/v1/character/basic?ocid=${encodeURIComponent(ocid)}`, {
      headers: { 'x-nxopen-api-key': apiKey, 'Cache-Control': 'no-store, no-cache', Pragma: 'no-cache' },
      cache: 'no-store'
    })
    if (r.status === 429) {
      if (attempt < retries) await new Promise(res => setTimeout(res, 1000 * (attempt + 1)))
      else throw new Error(`rate-limit ocid=${ocid}`)
      continue
    }
    if (!r.ok) throw new Error(`HTTP ${r.status} ocid=${ocid}`)
    const d = await r.json() as CharBasic
    return { ...d, ocid, accountIndex }
  }
  throw new Error(`failed ocid=${ocid}`)
}

// 기본 정보 배치 조회 (3개씩 병렬, 속도 제한)
async function fetchBasicBatch(
  ocids: { ocid: string; accountIndex: number }[],
  apiKey: string,
  onProgress: (done: number, total: number) => void
): Promise<CharBasic[]> {
  const results: CharBasic[] = []
  const BATCH = 3

  for (let i = 0; i < ocids.length; i += BATCH) {
    const chunk = ocids.slice(i, i + BATCH)
    const settled = await Promise.allSettled(chunk.map(entry => fetchOneBasic(entry, apiKey)))
    settled.forEach(r => { if (r.status === 'fulfilled') results.push(r.value) })
    onProgress(Math.min(i + BATCH, ocids.length), ocids.length)
    if (i + BATCH < ocids.length) await new Promise(r => setTimeout(r, 300))
  }
  return results
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

  return fetchBasicBatch(ocids, apiKey, onProgress)
}
