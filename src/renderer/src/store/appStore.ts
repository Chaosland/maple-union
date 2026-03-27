import { create } from 'zustand'
import { SavedCharacter, UnionInfo, UnionRaider } from '../types'
import { calcRecommendation, UnionRecommendation } from '../utils/unionRecommender'

const SAVED_KEY   = 'maple_saved_characters'
const MAINS_KEY   = 'mainCharsByWorld'
const API_KEY_STORAGE = 'maple_api_key'
const MAX_PER_WORLD = 50

// 스페셜 월드 제외 목록
const SPECIAL_WORLDS = new Set(['스페셜', 'Special', '스페셜월드', '테스트', 'Test'])

// ─── localStorage 헬퍼 ───────────────────────────────────────────────────────
function loadSaved(): SavedCharacter[] {
  try { return JSON.parse(localStorage.getItem(SAVED_KEY) ?? '[]') } catch { return [] }
}
function persistSaved(list: SavedCharacter[]): void {
  localStorage.setItem(SAVED_KEY, JSON.stringify(list))
}
function loadSavedMains(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(MAINS_KEY) ?? '{}') } catch { return {} }
}
function persistMains(mains: Record<string, string>): void {
  localStorage.setItem(MAINS_KEY, JSON.stringify(mains))
}

// ─── API 키 헬퍼 ─────────────────────────────────────────────────────────────
function getApiKey(): string | null {
  return localStorage.getItem(API_KEY_STORAGE)
}

function apiHeaders(): HeadersInit {
  const key = getApiKey()
  return key
    ? { 'X-Api-Key': key, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' }
}

type CharLike = {
  ocid: string
  character_name: string
  world_name: string
  character_class: string
  character_level: number
  character_image?: string
}

async function apiFetch(path: string): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  const isElectronRuntime = typeof window !== 'undefined' && !!window.api
  const isPackagedRuntime = typeof window !== 'undefined' && window.location?.protocol === 'file:'

  // Nexon 경로는 Electron에서 fetch(/api/...)로 처리하지 않고 IPC만 사용
  if (path.startsWith('/api/nexon/maplestory/v1/')) {
    if (!(window.api?.nexon)) {
      return { ok: false, error: 'Electron IPC(nexon)가 초기화되지 않았습니다. 앱을 재시작해 주세요.' }
    }
    try {
      const url = new URL(path, 'http://localhost')
      const pathname = url.pathname

      if (pathname === '/api/nexon/maplestory/v1/id') {
        const name = url.searchParams.get('character_name')
        if (!name) return { ok: false, error: 'character_name 누락' }
        return await window.api.nexon.getOcid(name)
      }

      if (pathname === '/api/nexon/maplestory/v1/character/basic') {
        const ocid = url.searchParams.get('ocid')
        if (!ocid) return { ok: false, error: 'ocid 누락' }
        return await window.api.nexon.getCharacterBasic(ocid)
      }

      if (pathname === '/api/nexon/maplestory/v1/user/union') {
        const ocid = url.searchParams.get('ocid')
        if (!ocid) return { ok: false, error: 'ocid 누락' }
        return await window.api.nexon.getUnionInfo(ocid)
      }

      if (pathname === '/api/nexon/maplestory/v1/user/union-raider') {
        const ocid = url.searchParams.get('ocid')
        if (!ocid) return { ok: false, error: 'ocid 누락' }
        return await window.api.nexon.getUnionRaider(ocid)
      }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  }

  // EXE(file://)나 Electron 런타임에서는 상대 /api fetch를 타지 않도록 차단
  if ((isElectronRuntime || isPackagedRuntime) && path.startsWith('/api/')) {
    return { ok: false, error: `IPC 경로가 필요한 요청입니다: ${path}` }
  }

  try {
    const res = await fetch(path, { headers: apiHeaders() })
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` }
    const json = await res.json()
    return { ok: true, data: json }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

function extractCharacterList(payload: unknown): CharLike[] {
  // format A: { ok: true, data: CharLike[] }
  const wrapped = payload as { ok?: boolean; data?: unknown; account_list?: unknown }
  if (wrapped?.ok === true && Array.isArray(wrapped.data)) {
    return wrapped.data as CharLike[]
  }

  // format B: { account_list: [{ character_list: [...] }] }
  if (Array.isArray(wrapped?.account_list)) {
    return wrapped.account_list.flatMap((acc: unknown) => {
      const account = acc as { character_list?: unknown[] }
      if (!Array.isArray(account.character_list)) return []
      return account.character_list as CharLike[]
    })
  }

  return []
}

/** 서버별 본캐 자동 탐지: 최고 레벨, 동레벨 시 이름 가나다 첫 번째 */
function autoDetectMains(chars: SavedCharacter[]): Record<string, string> {
  const byWorld: Record<string, SavedCharacter[]> = {}
  for (const c of chars) {
    if (!c.world_name || SPECIAL_WORLDS.has(c.world_name)) continue
    ;(byWorld[c.world_name] ??= []).push(c)
  }
  const result: Record<string, string> = {}
  for (const [world, list] of Object.entries(byWorld)) {
    const top = [...list].sort(
      (a, b) => b.character_level - a.character_level || a.character_name.localeCompare(b.character_name)
    )[0]
    result[world] = top.ocid
  }
  return result
}

type AppStatus = 'init' | 'no-key' | 'ready'

interface AppStore {
  status: AppStatus
  error: string | null

  savedCharacters: SavedCharacter[]
  /** 서버별 본캐 ocid 맵 — localStorage 영속 */
  mainCharsByWorld: Record<string, string>

  selectedCharacter: SavedCharacter | null
  unionInfo: UnionInfo | null
  unionRaider: UnionRaider | null
  unionLoading: boolean

  loadingAll: boolean
  loadProgress: { done: number; total: number } | null

  recommendation: UnionRecommendation | null

  // actions
  initialize:        () => Promise<void>
  saveCredentials:   (data: { serviceKey: string }) => Promise<boolean>
  clearCredentials:  () => Promise<void>
  searchCharacter:   (name: string) => Promise<SavedCharacter | null>
  loadAllCharacters: () => Promise<void>
  removeCharacter:   (ocid: string) => void
  setMainForWorld:   (world: string, ocid: string) => void
  loadUnionData:     (c: SavedCharacter) => Promise<void>
  clearError:        () => void
}

export const useAppStore = create<AppStore>((set, get) => ({
  status: 'init',
  error: null,
  savedCharacters: [],
  mainCharsByWorld: loadSavedMains(),
  selectedCharacter: null,
  unionInfo: null,
  unionRaider: null,
  unionLoading: false,
  loadingAll: false,
  loadProgress: null,
  recommendation: null,

  initialize: async () => {
    const localKey = getApiKey()
    let hasKey = !!localKey
    if (window.api?.creds?.hasKey) {
      try {
        const ipcHasKey = await window.api.creds.hasKey()
        hasKey = hasKey || ipcHasKey
        // 기존 localStorage 키가 있고 main 저장소 키가 비어있으면 동기화
        if (localKey && !ipcHasKey && window.api?.creds?.save) {
          await window.api.creds.save(localKey)
          hasKey = true
        }
      } catch {
        // ignore: fallback to local key
      }
    }
    const saved  = loadSaved()
    set({ status: hasKey ? 'ready' : 'no-key', savedCharacters: saved })
    // API 키가 있으면 재시작 시 자동으로 전체 불러오기
    if (hasKey) {
      get().loadAllCharacters()
    }
  },

  saveCredentials: async ({ serviceKey }) => {
    const trimmed = serviceKey.trim()
    localStorage.setItem(API_KEY_STORAGE, trimmed)
    if (window.api?.creds?.save) {
      const result = await window.api.creds.save(trimmed)
      if (!result.ok) {
        set({ error: result.error ?? 'API 키 저장 실패' })
        return false
      }
    }
    set({ status: 'ready', error: null })
    // 최초 등록 시 자동 전체 불러오기
    get().loadAllCharacters()
    return true
  },

  clearCredentials: async () => {
    localStorage.removeItem(API_KEY_STORAGE)
    if (window.api?.creds?.clear) {
      await window.api.creds.clear()
    }
    set({
      status: 'no-key', savedCharacters: [], mainCharsByWorld: {},
      selectedCharacter: null, unionInfo: null, unionRaider: null, recommendation: null
    })
  },

  searchCharacter: async (name) => {
    set({ error: null })
    const ocidRes = await apiFetch(`/api/nexon/maplestory/v1/id?character_name=${encodeURIComponent(name)}`)
    if (!ocidRes.ok) { set({ error: ocidRes.error ?? `'${name}' 캐릭터를 찾을 수 없습니다` }); return null }

    const ocidData = ocidRes.data as { ocid: string }
    const ocid = ocidData.ocid

    const basicRes = await apiFetch(`/api/nexon/maplestory/v1/character/basic?ocid=${encodeURIComponent(ocid)}`)
    if (!basicRes.ok) { set({ error: basicRes.error ?? '정보 조회 실패' }); return null }

    const b = basicRes.data as {
      character_name: string; world_name: string
      character_class: string; character_level: number; character_image?: string
    }
    const char: SavedCharacter = {
      ocid, addedAt: Date.now(),
      character_name: b.character_name, world_name: b.world_name,
      character_class: b.character_class, character_level: b.character_level,
      character_image: b.character_image
    }

    const prev      = loadSaved().filter(c => c.ocid !== char.ocid)
    const sameWorld = prev.filter(c => c.world_name === char.world_name).slice(0, MAX_PER_WORLD - 1)
    const others    = prev.filter(c => c.world_name !== char.world_name)
    const next      = [char, ...sameWorld, ...others]
    persistSaved(next)
    set({ savedCharacters: next })
    return char
  },

  loadAllCharacters: async () => {
    set({ loadingAll: true, loadProgress: null, error: null })

    try {
      let rawPayload: unknown = null

      // Electron 경로: main 프로세스에서 직접 Nexon API 호출
      if (window.api?.chars?.loadAll) {
        const result = await window.api.chars.loadAll()
        if (!result.ok) {
          set({ error: result.error ?? '불러오기 실패' })
          return
        }
        rawPayload = { ok: true, data: result.data }
      } else {
        // EXE에서 preload/window.api가 없는 비정상 상태면 즉시 명확한 에러 반환
        if (window.location?.protocol === 'file:') {
          set({ error: 'Electron IPC(chars:loadAll)가 없습니다. 앱을 완전히 종료 후 다시 실행해 주세요.' })
          return
        }
        // 웹/API 경로: /api/charlist
        const res = await fetch('/api/charlist', {
          headers: apiHeaders(),
          cache: 'no-store'
        })
        rawPayload = await res.json()
      }

      const list = extractCharacterList(rawPayload)
        .filter(c => c.character_level >= 60)
        .filter(c => c.world_name && !SPECIAL_WORLDS.has(c.world_name))

      if (list.length === 0) {
        set({ error: '캐릭터 목록이 비어 있거나 응답 형식이 올바르지 않습니다' })
        return
      }

      // 서버별 MAX_PER_WORLD 제한
      const byWorld: Record<string, SavedCharacter[]> = {}
      for (const c of list) {
        if (!byWorld[c.world_name]) byWorld[c.world_name] = []
        if (byWorld[c.world_name].length < MAX_PER_WORLD) {
          byWorld[c.world_name].push({ ...c, addedAt: Date.now() })
        }
      }
      const next = Object.values(byWorld).flat()
        .sort((a, b) => b.character_level - a.character_level)
      persistSaved(next)

      // 저장된 본캐 검증 + 없으면 자동 탐지
      const savedMains = loadSavedMains()
      const autoMains  = autoDetectMains(next)
      const merged: Record<string, string> = { ...autoMains }
      for (const [world, ocid] of Object.entries(savedMains)) {
        if (next.some(c => c.ocid === ocid)) merged[world] = ocid // 수동 설정 우선
      }
      persistMains(merged)
      set({ savedCharacters: next, mainCharsByWorld: merged })
    } catch (e) {
      set({ error: String(e) })
    } finally {
      set({ loadingAll: false, loadProgress: null })
    }
  },

  removeCharacter: (ocid) => {
    const next = get().savedCharacters.filter(c => c.ocid !== ocid)
    persistSaved(next)
    set({ savedCharacters: next })
  },

  setMainForWorld: (world, ocid) => {
    const updated = { ...get().mainCharsByWorld, [world]: ocid }
    persistMains(updated)
    set({ mainCharsByWorld: updated })
  },

  loadUnionData: async (c) => {
    set({ selectedCharacter: c, unionInfo: null, unionRaider: null, unionLoading: true, error: null })
    try {
      const [infoRes, raiderRes] = await Promise.all([
        apiFetch(`/api/nexon/maplestory/v1/user/union?ocid=${encodeURIComponent(c.ocid)}`),
        apiFetch(`/api/nexon/maplestory/v1/user/union-raider?ocid=${encodeURIComponent(c.ocid)}`)
      ])
      if (!infoRes.ok)   throw new Error(infoRes.error)
      if (!raiderRes.ok) throw new Error(raiderRes.error)

      const unionInfo   = infoRes.data   as UnionInfo
      const unionRaider = raiderRes.data as UnionRaider
      set({
        unionInfo, unionRaider,
        recommendation: calcRecommendation(c.character_class, get().savedCharacters, unionRaider)
      })
    } catch (e) {
      set({ error: String(e) })
    } finally {
      set({ unionLoading: false })
    }
  },

  clearError: () => set({ error: null })
}))
