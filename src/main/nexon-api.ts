import { API_BASE, API } from './constants'
import { getServiceKey } from './apikey'

async function apiFetch(endpoint: string, params?: Record<string, string>): Promise<unknown> {
  const apiKey = getServiceKey()
  if (!apiKey) throw new Error('API 키가 설정되지 않았습니다')

  const url = new URL(`${API_BASE}${endpoint}`)
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))

  const res = await fetch(url.toString(), {
    headers: { 'x-nxopen-api-key': apiKey }
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    let msg = body
    try { msg = JSON.parse(body)?.error?.message ?? body } catch { /* ignore */ }
    throw new Error(`API 오류 ${res.status}: ${msg}`)
  }

  return res.json()
}

export async function getOcid(characterName: string): Promise<string> {
  const data = await apiFetch(API.characterId, { character_name: characterName }) as { ocid: string }
  return data.ocid
}

export async function getCharacterBasic(ocid: string): Promise<unknown> {
  return apiFetch(API.characterBasic, { ocid })
}

export async function getUnionInfo(ocid: string, date?: string): Promise<unknown> {
  const params: Record<string, string> = { ocid }
  if (date) params.date = date
  return apiFetch(API.union, params)
}

export async function getUnionRaider(ocid: string, date?: string): Promise<unknown> {
  const params: Record<string, string> = { ocid }
  if (date) params.date = date
  return apiFetch(API.unionRaider, params)
}
