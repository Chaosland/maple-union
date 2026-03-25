import { useState, useMemo, useEffect, useRef } from 'react'
import { useAppStore } from '../store/appStore'
import { ClassType, CLASS_TYPE_COLORS } from '../types'
import { guessClassType, levelToTileCount } from '../utils/classData'
import { getGradeStep } from '../utils/unionGrades'
import { CLASS_ALIAS_MAP } from '../utils/unionEffects'

// ── Board constants ───────────────────────────────────────────────────────────
const ROWS = 20
const COLS = 22

// ── Types ─────────────────────────────────────────────────────────────────────
type Grade = 'B' | 'A' | 'S' | 'SS' | 'SSS'
type Shape = [number, number][]
type Board = (string | null)[][]   // null = empty, string = blockId

interface PlaceableBlock {
  id:        string
  classType: ClassType
  grade:     Grade
  cells:     number
  charName:  string
  charClass: string
  level:     number
  shape:     Shape
}

const SPECIAL_WORLDS = new Set(['스페셜', 'Special', '스페셜월드', '테스트', 'Test'])

// ── Grade mapping ─────────────────────────────────────────────────────────────
function levelToGrade(level: number): Grade | null {
  if (level >= 250) return 'SSS'
  if (level >= 200) return 'SS'
  if (level >= 140) return 'S'
  if (level >= 100) return 'A'
  if (level >= 60)  return 'B'
  return null
}

// ── Block shapes per class × grade ───────────────────────────────────────────
// 이미지 참고: 등급/직업 별 블록 모양
// 제논 → thief 모양, 메이플스토리 M → archer 모양
const BLOCK_SHAPES: Record<ClassType, Record<Grade, Shape>> = {
  warrior: {                                      // ─┐ 형 L
    B:   [[0,0]],
    A:   [[0,0],[0,1]],
    S:   [[0,0],[0,1],[1,1]],
    SS:  [[0,0],[0,1],[1,1],[2,1]],
    SSS: [[0,0],[1,0],[2,0],[2,1],[2,2]],
  },
  mage: {                                         // + 십자형
    B:   [[0,0]],
    A:   [[0,0],[0,1]],
    S:   [[0,0],[0,1],[1,0]],
    SS:  [[0,1],[1,0],[1,1],[1,2]],
    SSS: [[0,1],[1,0],[1,1],[1,2],[2,1]],
  },
  archer: {                                       // ─── 수평 막대 (메이플M 동일)
    B:   [[0,0]],
    A:   [[0,0],[0,1]],
    S:   [[0,0],[0,1],[0,2]],
    SS:  [[0,0],[0,1],[0,2],[0,3]],
    SSS: [[0,0],[0,1],[0,2],[0,3],[0,4]],
  },
  thief: {                                        // ⊤ T형 (제논 동일)
    B:   [[0,0]],
    A:   [[0,0],[0,1]],
    S:   [[0,0],[0,1],[1,0]],
    SS:  [[0,0],[0,1],[1,1],[2,1]],
    SSS: [[0,0],[0,1],[0,2],[1,1],[2,1]],
  },
  pirate: {                                       // J형
    B:   [[0,0]],
    A:   [[0,0],[0,1]],
    S:   [[0,0],[1,0],[1,1]],
    SS:  [[0,0],[1,0],[1,1],[1,2]],
    SSS: [[0,2],[1,2],[2,0],[2,1],[2,2]],
  },
}

// 제논 특별 처리: 해적 직업이지만 도적 모양
function getBlockType(charClass: string): ClassType {
  const resolved = CLASS_ALIAS_MAP[charClass] ?? charClass
  if (resolved === '제논') return 'thief'
  return guessClassType(resolved)
}

// ── Shape rotation ────────────────────────────────────────────────────────────
function normalizeShape(s: Shape): Shape {
  const minR = Math.min(...s.map(([r]) => r))
  const minC = Math.min(...s.map(([,c]) => c))
  return s.map(([r,c]) => [r - minR, c - minC])
}

function rotate90(s: Shape): Shape {
  return normalizeShape(s.map(([r,c]) => [c, -r]))
}

function uniqueRotations(base: Shape): Shape[] {
  const seen = new Set<string>()
  const result: Shape[] = []
  let cur = normalizeShape(base)
  for (let i = 0; i < 4; i++) {
    const key = [...cur].sort((a,b) => a[0]-b[0]||a[1]-b[1]).map(([r,c]) => `${r},${c}`).join('|')
    if (!seen.has(key)) { seen.add(key); result.push(cur) }
    cur = rotate90(cur)
  }
  return result
}

// ── Board helpers ─────────────────────────────────────────────────────────────
function makeBoard(): Board {
  return Array.from({ length: ROWS }, () => new Array<string | null>(COLS).fill(null))
}
function cloneBoard(b: Board): Board { return b.map(r => [...r]) }
function canPlace(board: Board, shape: Shape, r0: number, c0: number): boolean {
  for (const [dr,dc] of shape) {
    const r = r0+dr, c = c0+dc
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS || board[r][c] !== null) return false
  }
  return true
}
function doPlace(board: Board, shape: Shape, r0: number, c0: number, id: string) {
  for (const [dr,dc] of shape) board[r0+dr][c0+dc] = id
}
function doRemove(board: Board, shape: Shape, r0: number, c0: number) {
  for (const [dr,dc] of shape) board[r0+dr][c0+dc] = null
}

// ── Zone map ──────────────────────────────────────────────────────────────────
type ZoneLabel =
  '상태이상내성' | '획득경험치' |
  '크리티컬 데미지' | '크리티컬 확률' |
  '방어율무시' | '보스데미지' |
  '버프지속시간' | '일반데미지' |
  'STR' | 'DEX' | 'INT' | 'LUK' | 'HP' | 'MP' | '마력' | '공격력' | 'inner'

const ZONE_BG: Record<ZoneLabel, string> = {
  '상태이상내성':    'rgba(52,211,153,0.13)',
  '획득경험치':      'rgba(251,191,36,0.13)',
  '크리티컬 데미지': 'rgba(251,146,60,0.13)',
  '크리티컬 확률':   'rgba(251,146,60,0.13)',
  '방어율무시':      'rgba(248,113,113,0.13)',
  '보스데미지':      'rgba(248,113,113,0.13)',
  '버프지속시간':    'rgba(96,165,250,0.13)',
  '일반데미지':      'rgba(96,165,250,0.13)',
  STR: 'rgba(239,68,68,0.09)', DEX: 'rgba(59,130,246,0.09)',
  INT: 'rgba(139,92,246,0.09)', LUK: 'rgba(234,179,8,0.09)',
  HP:  'rgba(239,68,68,0.09)', MP:  'rgba(59,130,246,0.09)',
  '마력':  'rgba(139,92,246,0.09)', '공격력': 'rgba(234,179,8,0.09)',
  inner: 'transparent',
}

function getZone(r: number, c: number): ZoneLabel {
  const dTL = r + c, dTR = r + (21-c)
  const dBL = (19-r) + c, dBR = (19-r) + (21-c)
  if (dTL <= 6) return '상태이상내성'
  if (dTR <= 6) return '획득경험치'
  if (dBL <= 6) return '버프지속시간'
  if (dBR <= 6) return '일반데미지'
  if (r <= 3 && c >= 4 && c <= 17) return c < 11 ? '상태이상내성' : '획득경험치'
  if (r >= 16 && c >= 4 && c <= 17) return c < 11 ? '버프지속시간' : '일반데미지'
  if (c <= 3) return r < 10 ? '크리티컬 데미지' : '방어율무시'
  if (c >= 18) return r < 10 ? '크리티컬 확률' : '보스데미지'
  if (c >= 4 && c <= 6) return r < 10 ? '크리티컬 데미지' : '방어율무시'
  if (c >= 15 && c <= 17) return r < 10 ? '크리티컬 확률' : '보스데미지'
  if (r >= 5 && r <= 12 && c >= 7 && c <= 14) {
    const si = Math.floor((r - 5) / 2)
    const L: ZoneLabel[] = ['STR','MP','HP','마력']
    const R: ZoneLabel[] = ['DEX','INT','LUK','공격력']
    return si < 4 ? (c < 11 ? L[si] : R[si]) : 'inner'
  }
  return 'inner'
}

const ZONE_MAP: ZoneLabel[][] = Array.from({ length: ROWS }, (_, r) =>
  Array.from({ length: COLS }, (_, c) => getZone(r, c))
)

// ── Async backtracking solver ────────────────────────────────────────────────
async function solveStep(
  board: Board,
  remaining: PlaceableBlock[],
  steps: { n: number },
  cancelled: { v: boolean },
  onUpdate: (b: Board, s: number) => void,
): Promise<boolean> {
  if (cancelled.v) return false
  if (remaining.length === 0) return true

  // MCV: 가장 큰 블록(배치 어려운 것) 먼저
  const sorted = [...remaining].sort((a, b) => b.cells - a.cells)

  for (const block of sorted) {
    const rest = sorted.filter(b => b.id !== block.id)
    for (const rot of uniqueRotations(block.shape)) {
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (!canPlace(board, rot, r, c)) continue
          doPlace(board, rot, r, c, block.id)
          steps.n++
          if (steps.n % 400 === 0) {
            onUpdate(cloneBoard(board), steps.n)
            await new Promise<void>(res => setTimeout(res, 0))
            if (cancelled.v) return false
          }
          if (await solveStep(board, rest, steps, cancelled, onUpdate)) return true
          doRemove(board, rot, r, c)
        }
      }
    }
  }
  return false
}

async function runSolver(
  blocks: PlaceableBlock[],
  onUpdate: (b: Board, s: number) => void,
  onDone:   (b: Board, ok: boolean) => void,
  cancelRef: { current: boolean }
) {
  const board = makeBoard()
  const steps = { n: 0 }
  const cancelled = { v: false }
  const timer = setInterval(() => { if (cancelRef.current) cancelled.v = true }, 50)

  let ok = await solveStep(board, blocks, steps, cancelled, onUpdate)

  // 실패 시 역순으로 재시도 (다른 탐색 경로)
  if (!ok && !cancelled.v) {
    const board2 = makeBoard()
    steps.n = 0
    cancelled.v = false
    cancelRef.current = false
    ok = await solveStep(board2, [...blocks].reverse(), steps, cancelled, onUpdate)
    clearInterval(timer)
    onDone(cloneBoard(board2), ok)
  } else {
    clearInterval(timer)
    onDone(cloneBoard(board), ok)
  }
}

// ── Color helper ──────────────────────────────────────────────────────────────
function hexRgba(hex: string, a: number) {
  return `rgba(${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)},${a})`
}

// ── Component ─────────────────────────────────────────────────────────────────
const CLASS_LABEL: Record<ClassType, string> = {
  warrior:'전사', mage:'마법사', archer:'궁수', thief:'도적', pirate:'해적',
}
const CLASS_TYPES: ClassType[] = ['warrior','mage','archer','thief','pirate']

export default function UnionPlacerScreen() {
  const { savedCharacters } = useAppStore()

  const worlds = useMemo(() =>
    [...new Set(savedCharacters.map(c => c.world_name).filter(w => w && !SPECIAL_WORLDS.has(w)))].sort()
  , [savedCharacters])

  const [world, setWorld] = useState('')
  useEffect(() => { if (worlds.length > 0 && !world) setWorld(worlds[0]) }, [worlds])

  // ── 블록 목록 계산 ───────────────────────────────────────────────
  const { blocks, slotCount, totalCells } = useMemo(() => {
    if (!world) return { blocks: [], slotCount: 0, totalCells: 0 }
    const worldChars = savedCharacters
      .filter(c => c.world_name === world && c.character_level >= 60)
      .sort((a, b) => b.character_level - a.character_level)
    const levelSum = worldChars.slice(0, 42).reduce((s, c) => s + c.character_level, 0)
    const gradeStep = getGradeStep(levelSum)
    const slots = gradeStep?.slots ?? 0
    const result: PlaceableBlock[] = worldChars.slice(0, slots).flatMap((ch, i) => {
      const grade = levelToGrade(ch.character_level)
      if (!grade) return []
      return [{
        id: `${ch.ocid}_${i}`,
        classType: getBlockType(ch.character_class),
        grade,
        cells: levelToTileCount(ch.character_level),
        charName: ch.character_name,
        charClass: ch.character_class,
        level: ch.character_level,
        shape: BLOCK_SHAPES[getBlockType(ch.character_class)][grade],
      }]
    })
    return { blocks: result, slotCount: slots, totalCells: result.reduce((s,b) => s+b.cells, 0) }
  }, [world, savedCharacters])

  // ── Solver state ─────────────────────────────────────────────────
  const [board, setBoard] = useState<Board>(makeBoard)
  const [solving, setSolving] = useState(false)
  const [solved, setSolved] = useState<boolean | null>(null)
  const [steps, setSteps] = useState(0)
  const cancelRef = useRef(false)

  const blockMap = useMemo(() => Object.fromEntries(blocks.map(b => [b.id, b])), [blocks])

  function handleSolve() {
    if (solving) { cancelRef.current = true; setSolving(false); return }
    cancelRef.current = false
    setBoard(makeBoard())
    setSolving(true)
    setSolved(null)
    setSteps(0)
    runSolver(
      blocks,
      (b, s) => { setBoard(b); setSteps(s) },
      (b, ok) => { setBoard(b); setSolving(false); setSolved(ok) },
      cancelRef
    )
  }

  function handleReset() {
    cancelRef.current = true
    setSolving(false)
    setSolved(null)
    setBoard(makeBoard())
    setSteps(0)
  }

  // Grade/type summary
  const gradeCounts = useMemo(() => {
    const c: Record<Grade, number> = { B:0, A:0, S:0, SS:0, SSS:0 }
    blocks.forEach(b => c[b.grade]++)
    return c
  }, [blocks])

  const CELL = 26   // px per cell

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0">
      {/* Header */}
      <div className="bg-bg-card border-b border-bg-deep px-4 py-2 flex flex-wrap items-center gap-3 shrink-0">
        <select
          value={world}
          onChange={e => { setWorld(e.target.value); handleReset() }}
          className="bg-bg-deep border border-bg-deep rounded-lg px-2.5 py-1.5 text-white text-xs
                     focus:outline-none focus:border-accent/50"
        >
          {worlds.map(w => <option key={w} value={w}>{w}</option>)}
        </select>

        {world && (
          <span className="text-subtle text-xs">
            슬롯 <strong className="text-white">{slotCount}</strong>개 ·
            블록 <strong className="text-white">{blocks.length}</strong>개 ·
            총 <strong className="text-white">{totalCells}</strong>칸 /
            <span className="ml-1">{ROWS*COLS}</span>칸
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {solving && (
            <span className="text-subtle text-xs animate-pulse">{steps.toLocaleString()} steps</span>
          )}
          {solved !== null && !solving && (
            <span className={`text-xs font-semibold ${solved ? 'text-green-400' : 'text-yellow-400'}`}>
              {solved ? '✓ 배치 완료' : '⚠ 일부 미배치'}
            </span>
          )}
          <button onClick={handleReset} disabled={solving}
            className="bg-bg-deep border border-bg-deep text-muted text-xs px-3 py-1.5 rounded-lg
                       hover:text-white transition-colors disabled:opacity-40">초기화</button>
          <button onClick={handleSolve} disabled={blocks.length === 0}
            className={`text-white text-xs px-4 py-1.5 rounded-lg font-medium transition-colors
                        disabled:opacity-40 ${solving ? 'bg-red-500/80 hover:bg-red-500' : 'bg-accent/80 hover:bg-accent'}`}>
            {solving ? '중지' : '자동 배치'}
          </button>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* Board */}
        <div className="flex-1 overflow-auto flex flex-col items-center justify-start p-4 gap-3 min-w-0">
          {/* Legend */}
          <div className="flex flex-wrap gap-3 items-center text-[11px]">
            {CLASS_TYPES.map(t => (
              <div key={t} className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-sm"
                  style={{ backgroundColor: hexRgba(CLASS_TYPE_COLORS[t], 0.85) }} />
                <span className="text-muted">{CLASS_LABEL[t]}</span>
              </div>
            ))}
            <div className="border-l border-bg-deep pl-3 flex gap-2 text-subtle">
              {(['B','A','S','SS','SSS'] as Grade[]).map(g => (
                <span key={g}>{g}:{gradeCounts[g]}</span>
              ))}
            </div>
          </div>

          {/* 22×20 Grid */}
          <div
            className="border border-bg-deep/60 rounded-lg overflow-hidden shadow-xl flex-shrink-0"
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${COLS}, ${CELL}px)`,
              gridTemplateRows: `repeat(${ROWS}, ${CELL}px)`,
              gap: '1px',
              backgroundColor: '#0d1b2a',
            }}
          >
            {ZONE_MAP.map((row, ri) =>
              row.map((zone, ci) => {
                const id = board[ri]?.[ci]
                const blk = id ? blockMap[id] : null
                const bc = blk ? CLASS_TYPE_COLORS[blk.classType] : null
                return (
                  <div
                    key={`${ri}-${ci}`}
                    style={{
                      width: CELL, height: CELL,
                      backgroundColor: bc ? hexRgba(bc, 0.72) : ZONE_BG[zone],
                      boxShadow: bc
                        ? `inset 0 0 0 0.5px ${hexRgba(bc, 0.95)}`
                        : 'inset 0 0 0 0.5px rgba(255,255,255,0.06)',
                    }}
                  />
                )
              })
            )}
          </div>

          {/* Zone legend */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-subtle max-w-2xl">
            {[
              ['상태이상내성','rgba(52,211,153,0.6)'],
              ['획득경험치','rgba(251,191,36,0.6)'],
              ['크리티컬 데미지/확률','rgba(251,146,60,0.6)'],
              ['방어율무시/보스데미지','rgba(248,113,113,0.6)'],
              ['버프지속시간/일반데미지','rgba(96,165,250,0.6)'],
            ].map(([label, color]) => (
              <div key={label} className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color as string }} />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Block list panel */}
        <div className="w-56 shrink-0 border-l border-bg-deep flex flex-col overflow-hidden">
          <div className="px-3 py-2 border-b border-bg-deep bg-bg-card sticky top-0">
            <span className="text-white text-xs font-bold">블록 목록</span>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-bg-deep/40">
            {blocks.length === 0 ? (
              <div className="flex items-center justify-center h-32 p-4">
                <p className="text-subtle text-xs text-center leading-relaxed">
                  서버를 선택하면<br/>블록 목록이 표시됩니다
                </p>
              </div>
            ) : blocks.map(b => {
              const placed = board.some(row => row.includes(b.id))
              return (
                <div key={b.id}
                  className={`flex items-center gap-2 px-3 py-1.5 ${placed ? 'opacity-50' : ''}`}>
                  <div className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: CLASS_TYPE_COLORS[b.classType] }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-[11px] truncate">{b.charName}</div>
                    <div className="text-subtle text-[10px]">{b.charClass}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[10px] font-bold"
                      style={{ color: CLASS_TYPE_COLORS[b.classType] }}>{b.grade}</div>
                    <div className="text-subtle text-[10px]">{b.cells}칸</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
