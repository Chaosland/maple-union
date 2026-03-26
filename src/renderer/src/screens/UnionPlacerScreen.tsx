import { useEffect, useMemo, useRef, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { CLASS_TYPE_COLORS, ClassType } from '../types'
import { guessClassType } from '../utils/classData'
import { getGradeStep } from '../utils/unionGrades'
import {
  BOARD_COLS,
  BOARD_ROWS,
  CENTER_COL_LINE,
  CENTER_ROW_LINE,
  Cell,
  SelectionSolution,
  getEffectLabel,
  getPieceInventory,
  getSelectableRegions,
  getWorldTotalLevel,
  hasCenterAnchor,
  isCellUnlocked,
  isConnectedSelection,
} from '../utils/unionAutoPlacer'

const CENTER_LEFT_COL = 10
const CENTER_TOP_ROW = 9
const SPECIAL_WORLDS = new Set(['스페셜', 'Special', '스페셜월드', '테스트', 'Test'])
const INNER_FRAME = { left: 5, right: 17, top: 5, bottom: 15 }
const EMPTY: SelectionSolution = { placements: [], usedTiles: 0, remainingTiles: 0, success: true, iterations: 0, elapsedMs: 0 }
const SOLVER_TIMEOUT_MS = 30000
const LS_M_KEY = (world: string) => `mapleM_level_${world}`
const TYPE_LABEL: Record<ClassType, string> = { warrior: '전사', mage: '마법사', archer: '궁수', thief: '도적', pirate: '해적' }
const EFFECT_INFO: Record<string, { perCellText: string; maxText: string; perCellValue: number; unit: string; maxValue: number }> = {
  상태이상내성: { perCellText: '칸당 1', maxText: '최대 40', perCellValue: 1, unit: '', maxValue: 40 },
  획득경험치: { perCellText: '칸당 0.25%', maxText: '최대 10%', perCellValue: 0.25, unit: '%', maxValue: 10 },
  크리티컬데미지: { perCellText: '칸당 0.5%', maxText: '최대 20%', perCellValue: 0.5, unit: '%', maxValue: 20 },
  크리티컬확률: { perCellText: '칸당 1%', maxText: '최대 40%', perCellValue: 1, unit: '%', maxValue: 40 },
  방어율무시: { perCellText: '칸당 1%', maxText: '최대 40%', perCellValue: 1, unit: '%', maxValue: 40 },
  보스데미지: { perCellText: '칸당 1%', maxText: '최대 40%', perCellValue: 1, unit: '%', maxValue: 40 },
  버프지속시간: { perCellText: '칸당 1%', maxText: '최대 40%', perCellValue: 1, unit: '%', maxValue: 40 },
  스탠스: { perCellText: '칸당 1%', maxText: '최대 40%', perCellValue: 1, unit: '%', maxValue: 40 },
  STR: { perCellText: '칸당 5', maxText: '최대 75', perCellValue: 5, unit: '', maxValue: 75 },
  DEX: { perCellText: '칸당 5', maxText: '최대 75', perCellValue: 5, unit: '', maxValue: 75 },
  MP: { perCellText: '칸당 250', maxText: '최대 3750', perCellValue: 250, unit: '', maxValue: 3750 },
  INT: { perCellText: '칸당 5', maxText: '최대 75', perCellValue: 5, unit: '', maxValue: 75 },
  HP: { perCellText: '칸당 250', maxText: '최대 3750', perCellValue: 250, unit: '', maxValue: 3750 },
  LUK: { perCellText: '칸당 5', maxText: '최대 75', perCellValue: 5, unit: '', maxValue: 75 },
  마력: { perCellText: '칸당 1', maxText: '최대 15', perCellValue: 1, unit: '', maxValue: 15 },
  공격력: { perCellText: '칸당 1', maxText: '최대 15', perCellValue: 1, unit: '', maxValue: 15 },
}

type BorderMap = { horizontal: Set<string>; vertical: Set<string> }
function toGrid(gx: number, gy: number): [number, number] { return [CENTER_TOP_ROW - gy, CENTER_LEFT_COL + gx] }
function addH(s: Set<string>, y: number, x1: number, x2: number) { for (let x = x1; x < x2; x++) s.add(`${y},${x}`) }
function addV(s: Set<string>, x: number, y1: number, y2: number) { for (let y = y1; y < y2; y++) s.add(`${x},${y}`) }
function stair(x0: number, y0: number, sx: 1 | -1, sy: 1 | -1, b: BorderMap) {
  let x = x0, y = y0
  for (let i = 0; i < 9; i++) { const ny = y + sy; addV(b.vertical, x, Math.min(y, ny), Math.max(y, ny)); y = ny; const nx = x + sx; addH(b.horizontal, y, Math.min(x, nx), Math.max(x, nx)); x = nx }
  const fy = y + sy; addV(b.vertical, x, Math.min(y, fy), Math.max(y, fy))
}
function borderMap(): BorderMap {
  const horizontal = new Set<string>(), vertical = new Set<string>()
  addH(horizontal, 0, 0, BOARD_COLS); addH(horizontal, BOARD_ROWS, 0, BOARD_COLS); addV(vertical, 0, 0, BOARD_ROWS); addV(vertical, BOARD_COLS, 0, BOARD_ROWS)
  addH(horizontal, CENTER_ROW_LINE, 0, BOARD_COLS); addV(vertical, CENTER_COL_LINE, 0, BOARD_ROWS)
  addH(horizontal, INNER_FRAME.top, INNER_FRAME.left, INNER_FRAME.right); addH(horizontal, INNER_FRAME.bottom, INNER_FRAME.left, INNER_FRAME.right)
  addV(vertical, INNER_FRAME.left, INNER_FRAME.top, INNER_FRAME.bottom); addV(vertical, INNER_FRAME.right, INNER_FRAME.top, INNER_FRAME.bottom)
  stair(1, 0, 1, 1, { horizontal, vertical }); stair(21, 0, -1, 1, { horizontal, vertical }); stair(10, 10, -1, 1, { horizontal, vertical }); stair(12, 10, 1, 1, { horizontal, vertical })
  return { horizontal, vertical }
}
const BORDERS = borderMap()
function baseBorder(row: number, col: number) {
  const t = BORDERS.horizontal.has(`${row},${col}`) ? 3 : 1
  const r = BORDERS.vertical.has(`${col + 1},${row}`) ? 3 : 1
  const b = BORDERS.horizontal.has(`${row + 1},${col}`) ? 3 : 1
  const l = BORDERS.vertical.has(`${col},${row}`) ? 3 : 1
  return [t, r, b, l]
}
function blockBorder(row: number, col: number, occupied: Map<string, { classType: ClassType; placementId: string }>) {
  const current = occupied.get(`${row},${col}`), [t0, r0, b0, l0] = baseBorder(row, col)
  if (!current) return `${t0}px ${r0}px ${b0}px ${l0}px`
  const top = occupied.get(`${row - 1},${col}`), right = occupied.get(`${row},${col + 1}`), bottom = occupied.get(`${row + 1},${col}`), left = occupied.get(`${row},${col - 1}`)
  const t = !top || top.placementId !== current.placementId ? Math.max(t0, 3) : t0
  const r = !right || right.placementId !== current.placementId ? Math.max(r0, 3) : r0
  const b = !bottom || bottom.placementId !== current.placementId ? Math.max(b0, 3) : b0
  const l = !left || left.placementId !== current.placementId ? Math.max(l0, 3) : l0
  return `${t}px ${r}px ${b}px ${l}px`
}
function total(label: string, count: number) {
  const info = EFFECT_INFO[label], raw = Math.min(info.maxValue, count * info.perCellValue)
  const value = Number.isInteger(raw) ? String(raw) : raw.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
  return `${value}${info.unit}`
}
function loadMLevel(world: string): number | null {
  const v = localStorage.getItem(LS_M_KEY(world))
  return v ? parseInt(v, 10) : null
}

export default function UnionPlacerScreen() {
  const { savedCharacters, mainCharsByWorld, loadUnionData, unionRaider, unionInfo, unionLoading, selectedCharacter } = useAppStore()
  const worlds = useMemo(() => [...new Set(savedCharacters.map(c => c.world_name).filter(w => w && !SPECIAL_WORLDS.has(w)))].sort(), [savedCharacters])
  const [selectedWorld, setSelectedWorld] = useState('')
  const [regionSelectMode, setRegionSelectMode] = useState(false)
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set())
  const [selectedBlockCharacters, setSelectedBlockCharacters] = useState<Set<string>>(new Set())
  const [dragMode, setDragMode] = useState<'add' | 'remove' | null>(null)
  const [isPointerDown, setIsPointerDown] = useState(false)
  const [selectionSolution, setSelectionSolution] = useState<SelectionSolution>(EMPTY)
  const [solveStats, setSolveStats] = useState({ iterations: 0, elapsedMs: 0 })
  const [lastSolvedSelectionKey, setLastSolvedSelectionKey] = useState('')
  const [isSolving, setIsSolving] = useState(false)
  const [solveFailed, setSolveFailed] = useState(false)
  const [solveTimedOut, setSolveTimedOut] = useState(false)
  const solverAbortRef = useRef<AbortController | null>(null)

  useEffect(() => { if (worlds.length > 0 && !selectedWorld) setSelectedWorld(worlds[0]) }, [worlds, selectedWorld])
  useEffect(() => {
    if (!selectedWorld) return
    const ocid = mainCharsByWorld[selectedWorld]; if (!ocid) return
    const main = savedCharacters.find(c => c.ocid === ocid); if (main) loadUnionData(main)
  }, [selectedWorld, mainCharsByWorld, savedCharacters, loadUnionData])

  const worldCharacters = useMemo(() => savedCharacters.filter(c => c.world_name === selectedWorld), [savedCharacters, selectedWorld])
  const worldTotalLevel = useMemo(() => getWorldTotalLevel(worldCharacters), [worldCharacters])
  const mapleMLevel = useMemo(() => loadMLevel(selectedWorld), [selectedWorld, unionInfo, savedCharacters])
  const mapleMCharacter = useMemo(() => {
    if (!selectedWorld || !mapleMLevel || mapleMLevel < 60) return null
    return {
      ocid: `maplem:${selectedWorld}`,
      addedAt: 0,
      character_name: '메이플스토리 M',
      world_name: selectedWorld,
      character_class: '메이플스토리 M',
      character_level: mapleMLevel,
    }
  }, [selectedWorld, mapleMLevel])
  const selectableBlockCount = useMemo(() => (getGradeStep(worldTotalLevel)?.slots ?? 0) + (mapleMCharacter ? 1 : 0), [worldTotalLevel, mapleMCharacter])
  const eligibleBlockCharacters = useMemo(
    () => {
      const base = worldCharacters.filter(character => character.character_level >= 60).sort((a, b) => b.character_level - a.character_level)
      return mapleMCharacter ? [...base, mapleMCharacter] : base
    },
    [worldCharacters, mapleMCharacter]
  )
  const selectedBlockCharacterList = useMemo(
    () => eligibleBlockCharacters.filter(character => selectedBlockCharacters.has(character.ocid)),
    [eligibleBlockCharacters, selectedBlockCharacters]
  )
  const pieceInventory = useMemo(() => getPieceInventory(selectedBlockCharacterList, { useAllCharacters: true }), [selectedBlockCharacterList])
  const availableTileCount = useMemo(() => pieceInventory.reduce((sum, item) => sum + item.cells.length * item.count, 0), [pieceInventory])
  const inventorySummary = useMemo(() => {
    const map = new Map<string, { classType: ClassType; categoryLabel: string; grade: string; count: number }>()
    const source = pieceInventory.map(item => ({ classType: item.classType, categoryLabel: item.categoryLabel, grade: item.grade, count: item.count }))
    source.forEach(item => {
      const key = `${item.categoryLabel}:${item.grade}`, prev = map.get(key)
      if (prev) prev.count += item.count
      else map.set(key, { ...item })
    })
    return [...map.values()]
  }, [pieceInventory])

  const plannerCells = useMemo<Cell[]>(() => [...selectedCells].map(key => { const [x, y] = key.split(',').map(Number); return { x, y } }), [selectedCells])
  const plannerSelectionKey = useMemo(() => [...selectedCells].sort().join('|'), [selectedCells])
  const plannerOccupiedMap = useMemo(() => {
    const map = new Map<string, { classType: ClassType; placementId: string }>()
    selectionSolution.placements.forEach((placement, i) => placement.cells.forEach(cell => map.set(`${cell.y},${cell.x}`, { classType: placement.classType, placementId: `${placement.inventoryKey}:${i}` })))
    return map
  }, [selectionSolution])
  const activeOccupiedMap = plannerOccupiedMap
  const selectableRegions = useMemo(() => getSelectableRegions(worldTotalLevel), [worldTotalLevel])
  const effectCounts = useMemo(() => {
    const counts = Object.fromEntries(selectableRegions.map(region => [region.label, 0])) as Record<string, number>
    activeOccupiedMap.forEach((_, key) => { const [row, col] = key.split(',').map(Number); if (isCellUnlocked(row, col, worldTotalLevel)) counts[getEffectLabel(row, col)]++ })
    return counts
  }, [activeOccupiedMap, selectableRegions, worldTotalLevel])
  const selectionWarnings = useMemo(() => {
    const warnings: string[] = []
    if (selectedBlockCharacterList.length !== selectableBlockCount) warnings.push(`배치 블록 캐릭터를 ${selectableBlockCount}명 정확히 선택해야 합니다.`)
    if (plannerCells.length > availableTileCount) warnings.push(`선택 칸 수가 보유 가능 칸 수(${availableTileCount})를 넘었습니다.`)
    if (plannerCells.length < availableTileCount) warnings.push(`선택 칸 수가 보유 가능 칸 수(${availableTileCount})보다 부족합니다.`)
    if (!hasCenterAnchor(plannerCells)) warnings.push('중앙 4칸 중 최소 1칸은 선택되어야 합니다.')
    if (!isConnectedSelection(plannerCells)) warnings.push('선택한 칸은 서로 연결되어 있어야 합니다.')
    return warnings
  }, [plannerCells, availableTileCount, selectedBlockCharacterList.length, selectableBlockCount])

  const hasSelectionChanges = plannerSelectionKey !== lastSolvedSelectionKey
  const solvedTileCount = useMemo(() => selectionSolution.placements.reduce((sum, p) => sum + p.cells.length, 0), [selectionSolution])

  const canRunCalculation = selectedBlockCharacterList.length === selectableBlockCount
    && plannerCells.length === availableTileCount
    && plannerCells.length > 0
    && hasCenterAnchor(plannerCells)
    && isConnectedSelection(plannerCells)

  function setCellSelection(col: number, row: number, active: boolean) {
    if (!isCellUnlocked(row, col, worldTotalLevel)) return
    setSelectedCells(prev => { const next = new Set(prev), key = `${col},${row}`; active ? next.add(key) : next.delete(key); return next })
  }
  function toggleBlockCharacter(ocid: string) {
    setSelectedBlockCharacters(prev => {
      const next = new Set(prev)
      if (next.has(ocid)) {
        next.delete(ocid)
        return next
      }
      if (next.size >= selectableBlockCount) return next
      next.add(ocid)
      return next
    })
  }
  function toggleRegionAtCell(col: number, row: number) {
    const region = selectableRegions.find(item => item.cells.some(cell => cell.x === col && cell.y === row)); if (!region) return
    const keys = region.cells.map(cell => `${cell.x},${cell.y}`)
    setSelectedCells(prev => { const next = new Set(prev), all = keys.every(key => next.has(key)); keys.forEach(key => all ? next.delete(key) : next.add(key)); return next })
  }
  function resetSelection() { setSelectedCells(new Set()); setSelectionSolution(EMPTY); setSolveStats({ iterations: 0, elapsedMs: 0 }); setLastSolvedSelectionKey(''); setSolveFailed(false); setSolveTimedOut(false) }
  async function runPlannerCalculation() {
    if (isSolving || !canRunCalculation) return
    setIsSolving(true)
    setSolveFailed(false)
    setSolveTimedOut(false)
    await new Promise(resolve => setTimeout(resolve, 10)) // React가 로딩 상태를 먼저 렌더링하도록 yield

    // 이전 요청 취소
    solverAbortRef.current?.abort()
    const controller = new AbortController()
    solverAbortRef.current = controller

    const timeout = window.setTimeout(() => {
      controller.abort()
      if (solverAbortRef.current === controller) solverAbortRef.current = null
      setSolveStats({ iterations: 0, elapsedMs: 0 })
      setSelectionSolution(EMPTY)
      setSolveFailed(true)
      setSolveTimedOut(true)
      setLastSolvedSelectionKey(plannerSelectionKey)
      setIsSolving(false)
    }, SOLVER_TIMEOUT_MS)

    try {
      const res = await fetch('/api/solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedCells: plannerCells, inventoryEntries: pieceInventory }),
        signal: controller.signal,
      })

      window.clearTimeout(timeout)
      if (solverAbortRef.current === controller) solverAbortRef.current = null

      const solution: SelectionSolution = await res.json()
      setSolveStats({ iterations: solution.iterations, elapsedMs: solution.elapsedMs })
      const isComplete = solution.success && solution.remainingTiles === 0 && solution.usedTiles === plannerCells.length
      setSelectionSolution(isComplete ? solution : EMPTY)
      setSolveFailed(!isComplete)
      setSolveTimedOut(false)
      setLastSolvedSelectionKey(plannerSelectionKey)
    } catch (e) {
      window.clearTimeout(timeout)
      if (solverAbortRef.current === controller) solverAbortRef.current = null
      if ((e as Error).name === 'AbortError') return // 타임아웃으로 이미 처리됨
      setSolveStats({ iterations: 0, elapsedMs: 0 })
      setSelectionSolution(EMPTY)
      setSolveFailed(true)
      setSolveTimedOut(false)
      setLastSolvedSelectionKey(plannerSelectionKey)
    } finally {
      setIsSolving(false)
    }
  }

  useEffect(() => {
    resetSelection()
    const baseSlotCount = getGradeStep(worldTotalLevel)?.slots ?? 0
    const baseCharacters = eligibleBlockCharacters.filter(character => !character.ocid.startsWith('maplem:')).slice(0, baseSlotCount)
    const next = new Set(baseCharacters.map(character => character.ocid))
    if (mapleMCharacter) next.add(mapleMCharacter.ocid)
    setSelectedBlockCharacters(next)
  }, [selectedWorld, selectableBlockCount, worldTotalLevel, eligibleBlockCharacters, mapleMCharacter])
  useEffect(() => { setSelectionSolution(EMPTY); setSolveStats({ iterations: 0, elapsedMs: 0 }); setLastSolvedSelectionKey(''); setSolveFailed(false); setSolveTimedOut(false) }, [pieceInventory])
  useEffect(() => {
    if (plannerSelectionKey !== lastSolvedSelectionKey) setSelectionSolution(EMPTY)
  }, [plannerSelectionKey, lastSolvedSelectionKey])
  useEffect(() => {
    const clear = () => { setDragMode(null); setIsPointerDown(false) }
    window.addEventListener('mouseup', clear); window.addEventListener('pointerup', clear); window.addEventListener('blur', clear)
    return () => { window.removeEventListener('mouseup', clear); window.removeEventListener('pointerup', clear); window.removeEventListener('blur', clear) }
  }, [])
  useEffect(() => () => { solverAbortRef.current?.abort() }, [])

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0">
      <div className="bg-bg-card border-b border-bg-deep px-4 py-2.5 flex flex-wrap items-center gap-4 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-subtle text-xs">서버</span>
          <select value={selectedWorld} onChange={e => setSelectedWorld(e.target.value)} className="bg-bg-deep border border-bg-deep rounded-lg px-2.5 py-1 text-white text-xs focus:outline-none focus:border-accent/50">
            {worlds.map(world => <option key={world} value={world}>{world}</option>)}
          </select>
        </div>
        {unionInfo && <div className="flex items-center gap-3 border-l border-bg-deep pl-4"><span className="text-subtle text-xs">레벨</span><span className="text-white font-bold text-sm">{unionInfo.union_level.toLocaleString()}</span><span className="text-subtle text-xs ml-1">등급</span><span className="text-accent font-bold text-sm">{unionInfo.union_grade}</span></div>}
        {selectedCharacter && <div className="flex items-center gap-2 border-l border-bg-deep pl-4"><span className="text-subtle text-xs">본캐</span><span className="text-white text-xs font-medium">{selectedCharacter.character_name}</span><span className="text-muted text-xs">Lv.{selectedCharacter.character_level}</span></div>}
        {unionLoading && <span className="text-subtle text-xs animate-pulse ml-auto">불러오는 중...</span>}
      </div>

      <div className="flex-1 flex overflow-hidden min-h-0" onMouseUp={() => setDragMode(null)} onMouseLeave={() => setDragMode(null)}>
        <div className="w-72 shrink-0 border-r border-bg-deep overflow-y-auto flex flex-col gap-4 p-4">
          <div className="bg-bg-deep rounded-xl overflow-hidden">
            <div className="px-3 py-2 border-b border-bg-card"><span className="text-white text-xs font-bold">보유 블록</span><span className="text-subtle text-[10px] ml-1.5">({inventorySummary.reduce((sum, item) => sum + item.count, 0)}개)</span></div>
            <div className="divide-y divide-bg-card/50 max-h-[calc(100vh-180px)] overflow-y-auto">
              {inventorySummary.map(item => (
                <div key={`${item.categoryLabel}:${item.grade}`} className="flex items-center gap-2 px-3 py-1.5">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: CLASS_TYPE_COLORS[item.classType] }} />
                  <span className="text-white text-[11px] flex-1 truncate">{item.categoryLabel}</span>
                  <span className="text-subtle text-[10px] shrink-0">{item.grade}</span>
                  <span className="text-[10px] shrink-0 font-medium" style={{ color: CLASS_TYPE_COLORS[item.classType] }}>{item.count}개</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-start p-4 overflow-auto gap-3 min-w-0">
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-bg-card text-subtle hover:text-white transition-colors cursor-pointer"><input type="checkbox" checked={regionSelectMode} onChange={e => { setRegionSelectMode(e.target.checked); setDragMode(null); setIsPointerDown(false) }} className="accent-[rgb(var(--accent))]" />영역 선택</label>
            <div className="px-3 py-1.5 rounded-lg text-xs font-medium bg-accent text-white">수동 배치</div>
            <button onClick={runPlannerCalculation} disabled={isSolving || !canRunCalculation} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-accent text-white hover:opacity-90 transition-opacity disabled:opacity-50">{isSolving ? '계산 중...' : '배치 계산'}</button>
            <button onClick={resetSelection} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-bg-card text-subtle hover:text-white transition-colors">선택 초기화</button>
          </div>

          <div className="w-full max-w-[760px] grid grid-cols-3 gap-2">
            <div className="bg-bg-card border border-bg-deep rounded-xl px-4 py-3"><div className="text-subtle text-[11px]">배치 가능 총칸</div><div className="text-white text-lg font-bold">{availableTileCount}칸</div></div>
            <div className="bg-bg-card border border-bg-deep rounded-xl px-4 py-3"><div className="text-subtle text-[11px]">선택/드래그한 칸</div><div className="text-white text-lg font-bold">{plannerCells.length}칸</div></div>
            <div className="bg-bg-card border border-bg-deep rounded-xl px-4 py-3"><div className="text-subtle text-[11px]">계산 반영 칸</div><div className="text-white text-lg font-bold">{solvedTileCount}칸</div><div className="text-subtle text-[10px] mt-1">시도 {solveTimedOut ? '-' : solveStats.iterations.toLocaleString()}회</div><div className="text-subtle text-[10px]">{solveTimedOut ? `시간 초과(${SOLVER_TIMEOUT_MS}ms)` : `시간 ${solveStats.elapsedMs}ms`}</div></div>
          </div>

          <div className="w-full max-w-[760px] bg-bg-card border border-bg-deep rounded-xl px-4 py-3 text-[11px] min-h-[72px] flex items-start">
            {isSolving
              ? <div className="text-accent animate-pulse">배치 계산 중...</div>
              : hasSelectionChanges
                ? <div className="text-subtle">캐릭터 선택이나 배치 영역을 바꿨습니다. 다시 `배치 계산`을 눌러 갱신하세요.</div>
                : solveFailed
                  ? <div className="text-yellow-300">{solveTimedOut ? '계산 시간이 초과되어 중단했습니다. 부분 결과는 반영하지 않았습니다.' : '선택한 모든 칸을 동시에 덮는 해를 찾지 못했습니다. 부분 결과는 반영하지 않았습니다.'}</div>
                  : selectionWarnings.length > 0
                    ? selectionWarnings.map((warning, index) => <div key={index} className="text-yellow-300">{warning}</div>)
                    : <div className="text-subtle">선택한 유니온 캐릭터의 블록으로 배치 계산을 수행합니다.</div>
            }
          </div>

          <div className="relative rounded-xl overflow-hidden border border-bg-deep shadow-lg" style={{ height: 'min(calc(100vh - 230px), 690px)', aspectRatio: `${BOARD_COLS} / ${BOARD_ROWS}` }}>
            <table className="w-full h-full border-collapse table-fixed" style={{ borderSpacing: 0, userSelect: 'none' }} onDragStart={e => e.preventDefault()}>
              <tbody>
                {Array.from({ length: BOARD_ROWS }, (_, rowIndex) => (
                  <tr key={rowIndex}>
                    {Array.from({ length: BOARD_COLS }, (_, colIndex) => {
                      const key = `${rowIndex},${colIndex}`, occupiedValue = activeOccupiedMap.get(key), occupiedType = occupiedValue?.classType
                      const unlocked = isCellUnlocked(rowIndex, colIndex, worldTotalLevel), selected = selectedCells.has(`${colIndex},${rowIndex}`)
                      const fill = !unlocked ? '#9ca3af' : occupiedType ? CLASS_TYPE_COLORS[occupiedType] : selected ? '#60a5fa' : '#ffffff'
                      return (
                        <td
                          key={key}
                          className="p-0 align-middle"
                          onPointerDown={event => {
                            event.preventDefault()
                            if (regionSelectMode) { setDragMode(null); setIsPointerDown(false); toggleRegionAtCell(colIndex, rowIndex); return }
                            const nextActive = !selected; setIsPointerDown(true); setDragMode(nextActive ? 'add' : 'remove'); setCellSelection(colIndex, rowIndex, nextActive)
                          }}
                          onPointerEnter={event => {
                            if (regionSelectMode || !dragMode) return
                            if (!isPointerDown || (event.buttons & 1) !== 1) { setDragMode(null); setIsPointerDown(false); return }
                            setCellSelection(colIndex, rowIndex, dragMode === 'add')
                          }}
                          onPointerUp={() => { setDragMode(null); setIsPointerDown(false) }}
                          style={{ background: fill, borderStyle: 'solid', borderColor: '#1f2937', borderWidth: blockBorder(rowIndex, colIndex, activeOccupiedMap), width: `${100 / BOARD_COLS}%`, height: `${100 / BOARD_ROWS}%`, boxShadow: occupiedType ? 'inset 0 0 0 1px rgba(255,255,255,0.28)' : selected ? 'inset 0 0 0 1px rgba(255,255,255,0.55)' : undefined }}
                        ><div className="w-full h-full min-h-[18px]" /></td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="w-80 shrink-0 border-l border-bg-deep overflow-y-auto flex flex-col min-h-0">
          <div className="px-4 py-3 border-b border-bg-deep flex items-center justify-between shrink-0">
            <span className="text-white text-xs font-bold">배치 캐릭터 선택</span>
            <span className="text-subtle text-[10px]">{selectedBlockCharacterList.length}/{selectableBlockCount}명</span>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-bg-card/50">
            {eligibleBlockCharacters.map(character => {
              const selected = selectedBlockCharacters.has(character.ocid)
              const disabled = !selected && selectedBlockCharacterList.length >= selectableBlockCount
              const classType = guessClassType(character.character_class)
              return (
                <button
                  key={character.ocid}
                  onClick={() => toggleBlockCharacter(character.ocid)}
                  disabled={disabled}
                  className={`w-full text-left px-4 py-3 transition-colors ${selected ? 'bg-accent/10' : 'bg-transparent'} ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-bg-card/60'}`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CLASS_TYPE_COLORS[classType] }} />
                    <span className="text-white text-[11px] font-medium flex-1 truncate">{character.character_name}</span>
                    <span className="text-subtle text-[10px]">{character.character_class}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-muted text-[10px]">Lv.{character.character_level}</span>
                    <span className="text-[10px] font-medium" style={{ color: selected ? 'rgb(var(--accent))' : 'rgb(var(--subtle))' }}>{selected ? '선택됨' : '선택 가능'}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
