import { useState, useEffect } from 'react'
import { useAppStore } from '../store/appStore'
import { useTheme } from '../hooks/useTheme'
import { ClassType, SavedCharacter } from '../types'
import { effectDisplayStr } from '../utils/unionEffects'
import { guessClassType } from '../utils/classData'
import CharacterCard from '../components/CharacterCard'
import UnionStatsPanel from '../components/UnionStatsPanel'

// ── 스페셜 월드 제외 ──────────────────────────────────────────────
const SPECIAL_WORLDS = ['스페셜', 'Special', '테스트', 'Test', '스페셜월드']

// ── 등급 계산 ─────────────────────────────────────────────────────
const GRADES = ['SSS', 'SS', 'S', 'A', 'B', '미달'] as const
type Grade = typeof GRADES[number]
type GradeFilter = Grade | '전체'

function getGrade(level: number): Grade {
  if (level > 249) return 'SSS'
  if (level > 199) return 'SS'
  if (level > 139) return 'S'
  if (level >  99) return 'A'
  if (level >  59) return 'B'
  return '미달'
}

const GRADE_LEVEL: Record<Grade, number> = {
  SSS: 250, SS: 200, S: 140, A: 100, B: 60, '미달': 0,
}

const GRADE_COLOR: Record<Grade, string> = {
  SSS: '#f59e0b', SS: '#a78bfa', S: '#60a5fa',
  A:   '#34d399', B:  '#9ca3af', '미달': '#6b7280',
}

// ── 뷰 타입 ───────────────────────────────────────────────────────
type ViewMode = 'table' | 'card'
type ClassFilter = '전체' | ClassType

// ── 필터 조건 ─────────────────────────────────────────────────────
type Operator = 'gte' | 'lt'   // 이상 | 미만

interface Props {
  onOpenSidebar?: () => void
}

export default function CharacterListScreen({ onOpenSidebar }: Props) {
  const {
    savedCharacters: allCharacters, mainCharsByWorld, loadingAll,
    clearCredentials, setMainForWorld, loadAllCharacters,
    selectedAccountIndex, accountCount, setSelectedAccount,
  } = useAppStore()
  const { theme, toggleTheme } = useTheme()

  // 현재 선택된 계정 캐릭터만 사용
  const characters = allCharacters.filter(c => (c.accountIndex ?? 0) === selectedAccountIndex)

  const [search, setSearch] = useState('')
  const [worldFilter, setWorldFilter] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [gradeFilter, setGradeFilter] = useState<GradeFilter>('전체')
  const [gradeOp, setGradeOp] = useState<Operator>('gte')
  const [classFilter, setClassFilter] = useState<ClassFilter>('전체')
  const [confirmLogout, setConfirmLogout] = useState(false)

  const worlds = Array.from(
    new Set(
      characters
        .filter(c => c.world_name && !SPECIAL_WORLDS.some(s => c.world_name.includes(s)))
        .map(c => c.world_name)
    )
  )

  useEffect(() => {
    if (worlds.length > 0 && (worldFilter === null || !worlds.includes(worldFilter))) {
      setWorldFilter(worlds[0])
    }
  }, [characters])

  const activeWorld = worldFilter ?? worlds[0] ?? null

  const filtered = characters
    .filter(c => c.world_name && !SPECIAL_WORLDS.some(s => c.world_name.includes(s)))
    .filter(c => !activeWorld || c.world_name === activeWorld)
    .filter(c => {
      if (!search) return true
      const q = search.toLowerCase()
      return c.character_name.toLowerCase().includes(q)
          || c.character_class.toLowerCase().includes(q)
    })
    .filter(c => {
      if (gradeFilter === '전체') return true
      const threshold = GRADE_LEVEL[gradeFilter as Grade]
      return gradeOp === 'gte' ? c.character_level >= threshold : c.character_level < threshold
    })
    .filter(c => classFilter === '전체' || guessClassType(c.character_class) === classFilter)
    .sort((a, b) => b.character_level - a.character_level)

  return (
    <div className="h-screen bg-bg-dark flex flex-col overflow-hidden">

      {/* ── 헤더 ─────────────────────────────────────────────── */}
      <header className="bg-bg-card border-b border-bg-deep px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          {/* 햄버거 메뉴 */}
          <button
            onClick={onOpenSidebar}
            className="p-1.5 rounded-lg hover:bg-bg-deep text-muted hover:text-white transition-colors"
            title="메뉴"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="text-white font-bold text-sm">서버별 유니온 현황</h1>
        </div>
        <div className="flex items-center gap-2">
          {/* 뷰 토글 */}
          <div className="flex rounded-lg border border-bg-deep overflow-hidden">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === 'table' ? 'bg-accent text-white' : 'text-muted hover:text-white'
              }`}
              title="목록 보기"
            >
              ☰ 목록
            </button>
            <button
              onClick={() => setViewMode('card')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === 'card' ? 'bg-accent text-white' : 'text-muted hover:text-white'
              }`}
              title="카드 보기"
            >
              ⊞ 카드
            </button>
          </div>

          {/* 새로고침 */}
          <button
            onClick={loadAllCharacters}
            disabled={loadingAll}
            className="p-1.5 rounded-lg hover:bg-bg-deep transition-colors text-muted hover:text-white"
            title="캐릭터 목록 새로고침"
          >
            <svg className={`w-4 h-4 ${loadingAll ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>

          {/* 로그아웃 */}
          <button
            onClick={() => setConfirmLogout(true)}
            className="text-xs px-3 py-1.5 rounded-lg border border-bg-deep text-muted hover:text-white hover:border-accent/50 transition-colors"
          >
            로그아웃
          </button>
        </div>
      </header>

      {/* ── 계정 탭 (2개 이상일 때만) ────────────────────────── */}
      {accountCount > 1 && (
        <div className="bg-bg-deep border-b border-bg-card px-4 flex gap-1 overflow-x-auto shrink-0">
          {Array.from({ length: accountCount }, (_, i) => {
            const count = allCharacters.filter(c => (c.accountIndex ?? 0) === i).length
            const isActive = selectedAccountIndex === i
            return (
              <button
                key={i}
                onClick={() => setSelectedAccount(i)}
                className={`flex-shrink-0 px-4 py-2 text-sm font-semibold transition-colors border-b-2 ${
                  isActive ? 'border-accent text-accent' : 'border-transparent text-subtle hover:text-white'
                }`}
              >
                계정 {i + 1}
                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                  isActive ? 'bg-accent/20 text-accent' : 'bg-bg-card text-subtle'
                }`}>{count}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* ── 서버 탭 ──────────────────────────────────────────── */}
      <div className="bg-bg-card border-b border-bg-deep px-4 flex gap-1 overflow-x-auto shrink-0">
        {worlds.length === 0 ? (
          <span className="text-subtle text-sm py-2.5 px-2">불러오는 중...</span>
        ) : worlds.map(w => {
          const count   = characters.filter(c => c.world_name === w).length
          const isActive = activeWorld === w
          return (
            <button
              key={w}
              onClick={() => setWorldFilter(w)}
              className={`flex-shrink-0 px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                isActive ? 'border-accent text-white' : 'border-transparent text-muted hover:text-white'
              }`}
            >
              {w}
              <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                isActive ? 'bg-accent/20 text-accent' : 'bg-bg-deep text-subtle'
              }`}>{count}</span>
            </button>
          )
        })}
      </div>

      {/* ── 검색 + 필터 바 ───────────────────────────────────── */}
      <div className="bg-bg-card border-b border-bg-deep px-4 py-2 flex items-center gap-3 shrink-0">
        {/* 검색 */}
        <div className="relative flex-1">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-subtle" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            className="w-full bg-bg-deep border border-bg-deep rounded-lg pl-8 pr-3 py-1.5 text-white text-xs
                       placeholder-subtle focus:outline-none focus:border-accent/50"
            placeholder="캐릭터명 / 직업 검색..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* 등급 필터 */}
        <div className="flex items-center gap-1.5 shrink-0">
          <select
            value={classFilter}
            onChange={e => setClassFilter(e.target.value as ClassFilter)}
            className="bg-bg-deep border border-bg-deep rounded-lg px-2 py-1.5 text-white text-xs
                       focus:outline-none focus:border-accent/50 cursor-pointer"
          >
            <option value="전체">직업군 전체</option>
            <option value="warrior">전사</option>
            <option value="archer">궁수</option>
            <option value="thief">도적</option>
            <option value="mage">마법사</option>
            <option value="pirate">해적</option>
          </select>
          <select
            value={gradeFilter}
            onChange={e => setGradeFilter(e.target.value as GradeFilter)}
            className="bg-bg-deep border border-bg-deep rounded-lg px-2 py-1.5 text-white text-xs
                       focus:outline-none focus:border-accent/50 cursor-pointer"
          >
            <option value="전체">전체</option>
            {GRADES.map(g => (
              <option key={g} value={g}>
                {g} (Lv.{GRADE_LEVEL[g]}{g !== '미달' ? '+' : ''})
              </option>
            ))}
          </select>
          {gradeFilter !== '전체' && (
            <select
              value={gradeOp}
              onChange={e => setGradeOp(e.target.value as Operator)}
              className="bg-bg-deep border border-bg-deep rounded-lg px-2 py-1.5 text-white text-xs
                         focus:outline-none focus:border-accent/50 cursor-pointer"
            >
              <option value="gte">이상</option>
              <option value="lt">미만</option>
            </select>
          )}
          <span className="text-subtle text-xs">{filtered.length}명</span>
        </div>
      </div>

      {/* ── 본문 ─────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* 왼쪽: 캐릭터 목록 */}
        <div className="w-[70%] flex flex-col overflow-hidden min-h-0">
          <div className="flex-1 overflow-y-auto min-h-0">
            {loadingAll ? (
              <div className="flex items-center justify-center h-40">
                <span className="animate-spin text-accent text-3xl">⟳</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-muted gap-2 text-sm">
                <span>😶</span>
                <span>{search ? '검색 결과 없음' : '해당 조건의 캐릭터 없음'}</span>
              </div>
            ) : viewMode === 'table' ? (
              <CharacterTable
                chars={filtered}
                mainCharsByWorld={mainCharsByWorld}
                setMainForWorld={setMainForWorld}
              />
            ) : (
              <div className="p-3 grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
                {filtered.map(c => (
                  <CharacterCard
                    key={c.ocid}
                    character={c}
                    isMain={mainCharsByWorld[c.world_name] === c.ocid}
                    onSetMain={() => setMainForWorld(c.world_name, c.ocid)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 오른쪽: 유니온 통계 패널 */}
        <div className="w-[30%] flex flex-col overflow-hidden min-h-0">
          <div className="flex-1 overflow-y-auto min-h-0">
            {activeWorld ? (
              <UnionStatsPanel world={activeWorld} />
            ) : (
              <div className="h-full flex items-center justify-center text-subtle text-sm">
                서버를 선택하세요
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 로그아웃 모달 ────────────────────────────────────── */}
      {confirmLogout && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-bg-card rounded-2xl p-6 w-80 shadow-xl border border-bg-deep">
            <h3 className="text-white font-bold text-lg mb-2">로그아웃</h3>
            <p className="text-muted text-sm mb-6">
              넥슨 ID 로그아웃 하시겠습니까?<br />저장된 로그인 정보가 삭제됩니다.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmLogout(false)}
                className="px-4 py-2 rounded-lg text-muted hover:text-white text-sm transition-colors"
              >취소</button>
              <button
                onClick={() => { setConfirmLogout(false); clearCredentials() }}
                className="px-4 py-2 rounded-lg bg-accent hover:bg-red-500 text-white text-sm transition-colors"
              >로그아웃</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── 테이블 뷰 컴포넌트 ────────────────────────────────────────────
interface TableProps {
  chars: SavedCharacter[]
  mainCharsByWorld: Record<string, string>
  setMainForWorld: (world: string, ocid: string) => void
}

function CharacterTable({ chars, mainCharsByWorld, setMainForWorld }: TableProps) {
  return (
    <table className="w-full text-xs border-collapse">
      <thead className="sticky top-0 z-10 bg-bg-card">
        <tr className="text-subtle border-b border-bg-deep">
          <th className="text-center px-2 py-2 w-8">#</th>
          <th className="text-left   px-3 py-2">캐릭터명</th>
          <th className="text-left   px-2 py-2">직업</th>
          <th className="text-right  px-2 py-2">레벨</th>
          <th className="text-center px-2 py-2">등급</th>
          <th className="text-left   px-2 py-2">유니온 효과</th>
          <th className="text-center px-2 py-2 w-8">★</th>
        </tr>
      </thead>
      <tbody>
        {chars.map((c, i) => {
          const grade      = getGrade(c.character_level)
          const unionEffect = effectDisplayStr(c.character_class, c.character_level)
          const isMain     = mainCharsByWorld[c.world_name] === c.ocid

          return (
            <tr
              key={c.ocid}
              className={`border-b border-bg-deep/50 hover:bg-bg-deep/30 transition-colors ${
                isMain ? 'bg-accent/5' : ''
              }`}
            >
              {/* 순위 */}
              <td className="text-center px-2 py-1.5 text-subtle">{i + 1}</td>

              {/* 캐릭터명 */}
              <td className="px-3 py-1.5">
                <span className={`font-medium ${isMain ? 'text-accent' : 'text-white'}`}>
                  {isMain && <span className="mr-1">⭐</span>}
                  {c.character_name}
                </span>
              </td>

              {/* 직업 */}
              <td className="px-2 py-1.5 text-muted">{c.character_class}</td>

              {/* 레벨 */}
              <td className="text-right px-2 py-1.5 text-white font-mono">{c.character_level}</td>

              {/* 등급 */}
              <td className="text-center px-2 py-1.5">
                <span
                  className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold"
                  style={{ color: GRADE_COLOR[grade], background: `${GRADE_COLOR[grade]}20` }}
                >
                  {grade}
                </span>
              </td>

              {/* 유니온 효과 */}
              <td className="px-2 py-1.5 text-subtle">{unionEffect}</td>

              {/* 본캐 설정 */}
              <td className="text-center px-2 py-1.5">
                <button
                  onClick={() => setMainForWorld(c.world_name, c.ocid)}
                  className="text-subtle hover:text-accent transition-colors"
                  title={isMain ? '본캐' : '본캐로 설정'}
                >
                  {isMain ? '★' : '☆'}
                </button>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
