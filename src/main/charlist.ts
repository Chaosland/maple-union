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
    headers: { 'x-nxopen-api-key': apiKey }
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
          headers: { 'x-nxopen-api-key': apiKey }
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
