import { SavedCharacter, ClassType } from '../types'
import { guessClassType } from './classData'
import { getGradeStep } from './unionGrades'

export const BOARD_COLS = 22
export const BOARD_ROWS = 20
export const CENTER_COL_LINE = 11
export const CENTER_ROW_LINE = 10
const INNER_FRAME = {
  left: 5,
  right: 17,
  top: 5,
  bottom: 15,
}

type BorderMap = {
  horizontal: Set<string>
  vertical: Set<string>
}

export type UnionBlockGrade = 'B' | 'A' | 'S' | 'SS' | 'SSS'

export interface Cell {
  x: number
  y: number
}

export interface RecommendedBlock {
  id: string
  character: SavedCharacter
  classType: ClassType
  grade: UnionBlockGrade
  cells: Cell[]
  origin: Cell
}

export interface RecommendedLayout {
  blocks: RecommendedBlock[]
  occupied: Map<string, RecommendedBlock>
  slotLimit: number
  usedSlots: number
  usedTiles: number
  totalCharacters: number
  totalLevel: number
  inventory: Record<string, Record<UnionBlockGrade, number>>
}

export interface PieceInventoryEntry {
  key: string
  label: string
  classType: ClassType
  grade: UnionBlockGrade
  cells: Cell[]
  count: number
}

export interface SolvedPlacement {
  inventoryKey: string
  label: string
  classType: ClassType
  grade: UnionBlockGrade
  cells: Cell[]
}

export interface SelectionSolution {
  placements: SolvedPlacement[]
  usedTiles: number
  remainingTiles: number
  success: boolean
}

export interface SelectableRegion {
  id: string
  label: EffectLabel
  cells: Cell[]
}

interface CandidateBlock {
  id: string
  character: SavedCharacter
  classType: ClassType
  grade: UnionBlockGrade
  cells: Cell[]
  weight: number
  shapeKey: string
}

const GRADE_WEIGHT: Record<UnionBlockGrade, number> = {
  B: 1,
  A: 2,
  S: 3,
  SS: 4,
  SSS: 5,
}

function addHorizontalEdge(horizontal: Set<string>, y: number, x1: number, x2: number) {
  for (let x = x1; x < x2; x++) horizontal.add(`${y},${x}`)
}

function addVerticalEdge(vertical: Set<string>, x: number, y1: number, y2: number) {
  for (let y = y1; y < y2; y++) vertical.add(`${x},${y}`)
}

function buildStairEdges(startX: number, startY: number, stepX: 1 | -1, stepY: 1 | -1, borders: BorderMap) {
  let x = startX
  let y = startY

  for (let i = 0; i < 9; i++) {
    const nextY = y + stepY
    addVerticalEdge(borders.vertical, x, Math.min(y, nextY), Math.max(y, nextY))
    y = nextY

    const nextX = x + stepX
    addHorizontalEdge(borders.horizontal, y, Math.min(x, nextX), Math.max(x, nextX))
    x = nextX
  }

  const finalY = y + stepY
  addVerticalEdge(borders.vertical, x, Math.min(y, finalY), Math.max(y, finalY))
}

function createBorderMap(): BorderMap {
  const horizontal = new Set<string>()
  const vertical = new Set<string>()

  addHorizontalEdge(horizontal, 0, 0, BOARD_COLS)
  addHorizontalEdge(horizontal, BOARD_ROWS, 0, BOARD_COLS)
  addVerticalEdge(vertical, 0, 0, BOARD_ROWS)
  addVerticalEdge(vertical, BOARD_COLS, 0, BOARD_ROWS)

  addHorizontalEdge(horizontal, CENTER_ROW_LINE, 0, BOARD_COLS)
  addVerticalEdge(vertical, CENTER_COL_LINE, 0, BOARD_ROWS)

  addHorizontalEdge(horizontal, INNER_FRAME.top, INNER_FRAME.left, INNER_FRAME.right)
  addHorizontalEdge(horizontal, INNER_FRAME.bottom, INNER_FRAME.left, INNER_FRAME.right)
  addVerticalEdge(vertical, INNER_FRAME.left, INNER_FRAME.top, INNER_FRAME.bottom)
  addVerticalEdge(vertical, INNER_FRAME.right, INNER_FRAME.top, INNER_FRAME.bottom)

  buildStairEdges(1, 0, 1, 1, { horizontal, vertical })
  buildStairEdges(21, 0, -1, 1, { horizontal, vertical })
  buildStairEdges(10, 10, -1, 1, { horizontal, vertical })
  buildStairEdges(12, 10, 1, 1, { horizontal, vertical })

  return { horizontal, vertical }
}

const BORDER_MAP = createBorderMap()

function cellsFromMatrix(matrix: number[][]): Cell[] {
  return matrix.flatMap((row, y) =>
    row.flatMap((value, x) => (value === 0 ? [] : [{ x, y }]))
  )
}

const DEFAULT_PIECES = {
  B: cellsFromMatrix([[2]]),
  A: cellsFromMatrix([[2, 2]]),
  S_WARRIOR_PIRATE: cellsFromMatrix([
    [1, 0],
    [2, 1],
  ]),
  S_MAGE_THIEF_ARCHER: cellsFromMatrix([[1, 2, 1]]),
  SS_WARRIOR: cellsFromMatrix([
    [2, 2],
    [2, 2],
  ]),
  SS_ARCHER: cellsFromMatrix([[1, 2, 2, 1]]),
  SS_THIEF_XENON: cellsFromMatrix([
    [1, 0, 0],
    [1, 2, 1],
  ]),
  SS_MAGE: cellsFromMatrix([
    [0, 1, 0],
    [1, 2, 1],
  ]),
  SS_PIRATE: cellsFromMatrix([
    [1, 2, 0],
    [0, 2, 1],
  ]),
  SSS_WARRIOR: cellsFromMatrix([
    [1, 1, 2],
    [0, 1, 1],
  ]),
  SSS_ARCHER: cellsFromMatrix([[1, 1, 2, 1, 1]]),
  SSS_THIEF: cellsFromMatrix([
    [0, 0, 1],
    [1, 2, 1],
    [0, 0, 1],
  ]),
  SSS_MAGE: cellsFromMatrix([
    [0, 1, 0],
    [1, 2, 1],
    [0, 1, 0],
  ]),
  SSS_PIRATE: cellsFromMatrix([
    [1, 2, 0, 0],
    [0, 1, 1, 1],
  ]),
  SSS_XENON: cellsFromMatrix([
    [1, 1, 0],
    [0, 2, 0],
    [0, 1, 1],
  ]),
}

const SHAPES: Record<string, Record<UnionBlockGrade, Cell[]>> = {
  warrior: {
    B: DEFAULT_PIECES.B,
    A: DEFAULT_PIECES.A,
    S: DEFAULT_PIECES.S_WARRIOR_PIRATE,
    SS: DEFAULT_PIECES.SS_WARRIOR,
    SSS: DEFAULT_PIECES.SSS_WARRIOR,
  },
  mage: {
    B: DEFAULT_PIECES.B,
    A: DEFAULT_PIECES.A,
    S: DEFAULT_PIECES.S_MAGE_THIEF_ARCHER,
    SS: DEFAULT_PIECES.SS_MAGE,
    SSS: DEFAULT_PIECES.SSS_MAGE,
  },
  archer: {
    B: DEFAULT_PIECES.B,
    A: DEFAULT_PIECES.A,
    S: DEFAULT_PIECES.S_MAGE_THIEF_ARCHER,
    SS: DEFAULT_PIECES.SS_ARCHER,
    SSS: DEFAULT_PIECES.SSS_ARCHER,
  },
  thief: {
    B: DEFAULT_PIECES.B,
    A: DEFAULT_PIECES.A,
    S: DEFAULT_PIECES.S_MAGE_THIEF_ARCHER,
    SS: DEFAULT_PIECES.SS_THIEF_XENON,
    SSS: DEFAULT_PIECES.SSS_THIEF,
  },
  pirate: {
    B: DEFAULT_PIECES.B,
    A: DEFAULT_PIECES.A,
    S: DEFAULT_PIECES.S_WARRIOR_PIRATE,
    SS: DEFAULT_PIECES.SS_PIRATE,
    SSS: DEFAULT_PIECES.SSS_PIRATE,
  },
  xenon: {
    B: DEFAULT_PIECES.B,
    A: DEFAULT_PIECES.A,
    S: DEFAULT_PIECES.S_MAGE_THIEF_ARCHER,
    SS: DEFAULT_PIECES.SS_THIEF_XENON,
    SSS: DEFAULT_PIECES.SSS_XENON,
  },
}

const TARGET_RANGES: Array<Array<[number, number]>> = [
  [[0, 0]],
  [[0, 1]],
  [[0, 2]],
  [[0, 3]],
  [[0, 4]],
  [[0, 4]],
  [[0, 4]],
  [[0, 4], [17, 21]],
  [[0, 4], [15, 21]],
  [[0, 4], [12, 21]],
  [[0, 3], [9, 21]],
  [[0, 3], [9, 9], [14, 21]],
  [[0, 4], [5, 9], [15, 21]],
  [[0, 5], [6, 9], [16, 21]],
  [[0, 6], [7, 9], [17, 21]],
  [[0, 7], [8, 9], [18, 21]],
  [[0, 8], [9, 9], [19, 21]],
  [[0, 9], [20, 21]],
  [[0, 8], [21, 21]],
  [[0, 7]],
]

const TARGET_CELLS = new Set(
  TARGET_RANGES.flatMap((ranges, row) =>
    ranges.flatMap(([start, end]) =>
      Array.from({ length: end - start + 1 }, (_, index) => `${row},${start + index}`)
    )
  )
)

export function getInset(row: number): number {
  return row < BOARD_ROWS / 2 ? row : BOARD_ROWS - 1 - row
}

export function isCenterCrossCell(row: number, col: number): boolean {
  return row === 9 || row === 10 || col === 10 || col === 11
}

export function getBoardZone(row: number, col: number): ClassType {
  if (isCenterCrossCell(row, col)) return 'pirate'

  const inset = getInset(row)
  if (col < inset) return 'archer'
  if (col >= BOARD_COLS - inset) return 'mage'
  return row < BOARD_ROWS / 2 ? 'warrior' : 'thief'
}

export function isPreferredCell(row: number, col: number): boolean {
  return TARGET_CELLS.has(`${row},${col}`)
}

export function getWorldTotalLevel(characters: SavedCharacter[]): number {
  const worldChars = [...characters].sort((a, b) => b.character_level - a.character_level)
  return worldChars.slice(0, 42).reduce((sum, character) => sum + character.character_level, 0)
}

function getUnlockedBand(totalLevel: number): number {
  if (totalLevel >= 6000) return 5
  if (totalLevel >= 5000) return 4
  if (totalLevel >= 4000) return 3
  if (totalLevel >= 3000) return 2
  if (totalLevel >= 2000) return 1
  return 0
}

function getCellBand(row: number, col: number): number {
  const edgeDistance = Math.min(row, BOARD_ROWS - 1 - row, col, BOARD_COLS - 1 - col)
  if (edgeDistance >= 4) return 1
  if (edgeDistance === 3) return 2
  if (edgeDistance === 2) return 3
  if (edgeDistance === 1) return 4
  return 5
}

export function isCellUnlocked(row: number, col: number, totalLevel: number): boolean {
  if (isCenterCrossCell(row, col)) return totalLevel >= 2000
  return getCellBand(row, col) <= getUnlockedBand(totalLevel)
}

export const EFFECT_LABEL_ORDER = [
  '상태이상내성',
  '획득경험치',
  '크리티컬데미지',
  '크리티컬확률',
  '방어율무시',
  '보스데미지',
  '버프지속시간',
  '스탠스',
  'STR',
  'DEX',
  'MP',
  'INT',
  'HP',
  'LUK',
  '마력',
  '공격력',
] as const

export type EffectLabel = (typeof EFFECT_LABEL_ORDER)[number]

export function getEffectLabel(row: number, col: number): EffectLabel {
  if (row < INNER_FRAME.top) return col < CENTER_COL_LINE ? '상태이상내성' : '획득경험치'
  if (row >= INNER_FRAME.bottom) return col < CENTER_COL_LINE ? '버프지속시간' : '스탠스'
  if (col < INNER_FRAME.left) return row < CENTER_ROW_LINE ? '크리티컬데미지' : '방어율무시'
  if (col >= INNER_FRAME.right) return row < CENTER_ROW_LINE ? '크리티컬확률' : '보스데미지'

  if (row < 8) return col < CENTER_COL_LINE ? 'STR' : 'DEX'
  if (row < 10) return col < CENTER_COL_LINE ? 'MP' : 'INT'
  if (row < 12) return col < CENTER_COL_LINE ? 'HP' : 'LUK'
  return col < CENTER_COL_LINE ? '마력' : '공격력'
}

export function isInnerEffectLabel(label: EffectLabel): boolean {
  return ![
    '상태이상내성',
    '획득경험치',
    '크리티컬데미지',
    '크리티컬확률',
    '방어율무시',
    '보스데미지',
    '버프지속시간',
    '스탠스',
  ].includes(label)
}

function getBlockGrade(level: number): UnionBlockGrade | null {
  if (level >= 250) return 'SSS'
  if (level >= 200) return 'SS'
  if (level >= 140) return 'S'
  if (level >= 100) return 'A'
  if (level >= 60) return 'B'
  return null
}

function normalize(cells: Cell[]): Cell[] {
  const minX = Math.min(...cells.map(cell => cell.x))
  const minY = Math.min(...cells.map(cell => cell.y))
  return cells
    .map(cell => ({ x: cell.x - minX, y: cell.y - minY }))
    .sort((a, b) => a.y - b.y || a.x - b.x)
}

function rotate90(cells: Cell[]): Cell[] {
  return normalize(cells.map(cell => ({ x: cell.y, y: -cell.x })))
}

function flipHorizontal(cells: Cell[]): Cell[] {
  return normalize(cells.map(cell => ({ x: -cell.x, y: cell.y })))
}

export function getShapeTransforms(cells: Cell[]): Cell[][] {
  const rotations: Cell[][] = []
  const seen = new Set<string>()

  const variants = [normalize(cells), flipHorizontal(cells)]
  for (const variant of variants) {
    let current = variant
    for (let i = 0; i < 4; i++) {
      const key = current.map(cell => `${cell.x},${cell.y}`).join(';')
      if (!seen.has(key)) {
        seen.add(key)
        rotations.push(current)
      }
      current = rotate90(current)
    }
  }

  return rotations
}

function getSlotLimit(characters: SavedCharacter[]): number {
  const totalLevel = getWorldTotalLevel(characters)
  return getGradeStep(totalLevel)?.slots ?? 0
}

function buildCandidates(characters: SavedCharacter[]): CandidateBlock[] {
  return characters
    .map(character => {
      const grade = getBlockGrade(character.character_level)
      if (!grade) return null

      const classType = guessClassType(character.character_class)
      const shapeKey = character.character_class.includes('제논') && grade === 'SSS' ? 'xenon' : classType
      return {
        id: character.ocid,
        character,
        classType,
        grade,
        cells: SHAPES[shapeKey][grade],
        weight: GRADE_WEIGHT[grade],
        shapeKey,
      } satisfies CandidateBlock
    })
    .filter((candidate): candidate is CandidateBlock => candidate !== null)
    .sort((a, b) => {
      if (b.weight !== a.weight) return b.weight - a.weight
      return b.character.character_level - a.character.character_level
    })
}

export function getPieceInventory(characters: SavedCharacter[]): PieceInventoryEntry[] {
  const slotLimit = getSlotLimit(characters)
  const candidates = buildCandidates(characters).slice(0, slotLimit)
  const inventoryMap = new Map<string, PieceInventoryEntry>()

  for (const candidate of candidates) {
    const key = `${candidate.shapeKey}:${candidate.grade}`
    const existing = inventoryMap.get(key)
    if (existing) {
      existing.count += 1
      continue
    }

    inventoryMap.set(key, {
      key,
      label: `${candidate.character.character_class} ${candidate.grade}`,
      classType: candidate.classType,
      grade: candidate.grade,
      cells: candidate.cells,
      count: 1,
    })
  }

  return [...inventoryMap.values()].sort((a, b) => {
    if (b.cells.length !== a.cells.length) return b.cells.length - a.cells.length
    return b.count - a.count
  })
}

function buildInventory(candidates: CandidateBlock[]): Record<string, Record<UnionBlockGrade, number>> {
  const inventory: Record<string, Record<UnionBlockGrade, number>> = {}
  for (const candidate of candidates) {
    const key = candidate.shapeKey
    if (!inventory[key]) inventory[key] = { B: 0, A: 0, S: 0, SS: 0, SSS: 0 }
    inventory[key][candidate.grade]++
  }
  return inventory
}

function cellScore(row: number, col: number, type: ClassType): number {
  const zone = getBoardZone(row, col)
  const preferred = isPreferredCell(row, col)
  if (preferred && zone === type) return 220
  if (preferred) return 180
  if (zone === type) return 80
  if (zone === 'pirate') return 30
  if (type === 'pirate') return 15
  return -40
}

function placementAdjacencyScore(cells: Cell[], occupied: Map<string, RecommendedBlock>, type: ClassType): number {
  let score = 0
  const directions = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ]

  for (const cell of cells) {
    for (const direction of directions) {
      const adjacent = occupied.get(`${cell.y + direction.y},${cell.x + direction.x}`)
      if (!adjacent) continue
      score += adjacent.classType === type ? 8 : 3
    }
  }

  return score
}

function fits(cells: Cell[], occupied: Map<string, RecommendedBlock>, totalLevel: number): boolean {
  return cells.every(cell => {
    if (cell.x < 0 || cell.x >= BOARD_COLS || cell.y < 0 || cell.y >= BOARD_ROWS) return false
    if (!isCellUnlocked(cell.y, cell.x, totalLevel)) return false
    return !occupied.has(`${cell.y},${cell.x}`)
  })
}

function scorePlacement(cells: Cell[], occupied: Map<string, RecommendedBlock>, type: ClassType): number {
  const zoneScore = cells.reduce((sum, cell) => sum + cellScore(cell.y, cell.x, type), 0)
  const compactnessPenalty = Math.max(...cells.map(cell => cell.x)) - Math.min(...cells.map(cell => cell.x))
    + Math.max(...cells.map(cell => cell.y)) - Math.min(...cells.map(cell => cell.y))
  return zoneScore + placementAdjacencyScore(cells, occupied, type) - compactnessPenalty
}

function createRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0xffffffff
  }
}

function getCandidateOrder(candidates: CandidateBlock[], seed: number): CandidateBlock[] {
  const rng = createRng(seed)
  return [...candidates].sort((a, b) => {
    if (b.cells.length !== a.cells.length) return b.cells.length - a.cells.length
    if (b.weight !== a.weight) return b.weight - a.weight
    return rng() - 0.5
  })
}

function choosePlacement(
  candidate: CandidateBlock,
  occupied: Map<string, RecommendedBlock>,
  totalLevel: number,
  seed: number
): { placement: RecommendedBlock | null; score: number } {
  const rng = createRng(seed)
  const placements: Array<{ placement: RecommendedBlock; score: number }> = []

    for (const rotation of getShapeTransforms(candidate.cells)) {
    const maxX = Math.max(...rotation.map(cell => cell.x))
    const maxY = Math.max(...rotation.map(cell => cell.y))

    for (let row = 0; row <= BOARD_ROWS - maxY - 1; row++) {
      for (let col = 0; col <= BOARD_COLS - maxX - 1; col++) {
        const placedCells = rotation.map(cell => ({ x: col + cell.x, y: row + cell.y }))
        if (!fits(placedCells, occupied, totalLevel)) continue

        const score = scorePlacement(placedCells, occupied, candidate.classType)
        placements.push({
          score,
          placement: {
            id: candidate.id,
            character: candidate.character,
            classType: candidate.classType,
            grade: candidate.grade,
            cells: placedCells,
            origin: { x: col, y: row },
          },
        })
      }
    }
  }

  if (placements.length === 0) return { placement: null, score: Number.NEGATIVE_INFINITY }

  placements.sort((a, b) => b.score - a.score)
  const topWindow = Math.min(6, placements.length)
  const chosen = placements[Math.floor(rng() * topWindow)]
  return chosen
}

function selectionKey(cells: Cell[]): string {
  return cells
    .map(cell => `${cell.x},${cell.y}`)
    .sort()
    .join('|')
}

function solveSelectionRecursive(
  remaining: Set<string>,
  inventory: PieceInventoryEntry[],
  placements: SolvedPlacement[],
  memo: Map<string, SelectionSolution>
): SelectionSolution {
  if (remaining.size === 0) {
    return { placements: [...placements], usedTiles: 0, remainingTiles: 0, success: true }
  }

  const key = [...remaining].sort().join('|') + '::' + inventory.map(item => `${item.key}:${item.count}`).join(',')
  const memoized = memo.get(key)
  if (memoized) return memoized

  const [anchor] = [...remaining].sort((a, b) => {
    const [ax, ay] = a.split(',').map(Number)
    const [bx, by] = b.split(',').map(Number)
    return ay - by || ax - bx
  })
  const [anchorX, anchorY] = anchor.split(',').map(Number)

  let best: SelectionSolution = {
    placements: [...placements],
    usedTiles: 0,
    remainingTiles: remaining.size,
    success: false,
  }

  for (const item of inventory) {
    if (item.count <= 0) continue

    for (const transform of getShapeTransforms(item.cells)) {
      for (const pivot of transform) {
        const dx = anchorX - pivot.x
        const dy = anchorY - pivot.y
        const placedCells = transform.map(cell => ({ x: cell.x + dx, y: cell.y + dy }))
        if (!placedCells.some(cell => cell.x === anchorX && cell.y === anchorY)) continue
        if (!placedCells.every(cell => remaining.has(`${cell.x},${cell.y}`))) continue

        const nextRemaining = new Set(remaining)
        for (const cell of placedCells) nextRemaining.delete(`${cell.x},${cell.y}`)

        item.count -= 1
        const nested = solveSelectionRecursive(
          nextRemaining,
          inventory,
          [
            ...placements,
            {
              inventoryKey: item.key,
              label: item.label,
              classType: item.classType,
              grade: item.grade,
              cells: placedCells,
            },
          ],
          memo
        )
        item.count += 1

        const usedTiles = nested.usedTiles + placedCells.length
        const candidate: SelectionSolution = {
          placements: nested.placements,
          usedTiles,
          remainingTiles: nested.remainingTiles,
          success: nested.success && nested.remainingTiles === 0,
        }

        if (
          candidate.remainingTiles < best.remainingTiles ||
          (candidate.remainingTiles === best.remainingTiles && candidate.usedTiles > best.usedTiles)
        ) {
          best = candidate
          if (best.remainingTiles === 0) {
            memo.set(key, best)
            return best
          }
        }
      }
    }
  }

  memo.set(key, best)
  return best
}

function solveSelectionExact(selectedCells: Cell[], inventoryEntries: PieceInventoryEntry[]): SelectionSolution {
  if (selectedCells.length === 0) {
    return { placements: [], usedTiles: 0, remainingTiles: 0, success: true }
  }

  type Variant = 'identity' | 'flip-x' | 'flip-y' | 'flip-both'
  type IndexedPlacement = {
    inventoryIndex: number
    cellIndices: number[]
    criticalCount: number
    placement: SolvedPlacement
  }

  function transformCell(cell: Cell, variant: Variant): Cell {
    switch (variant) {
      case 'flip-x':
        return { x: BOARD_COLS - 1 - cell.x, y: cell.y }
      case 'flip-y':
        return { x: cell.x, y: BOARD_ROWS - 1 - cell.y }
      case 'flip-both':
        return { x: BOARD_COLS - 1 - cell.x, y: BOARD_ROWS - 1 - cell.y }
      default:
        return cell
    }
  }

  function untransformCell(cell: Cell, variant: Variant): Cell {
    return transformCell(cell, variant)
  }

  function solveVariant(variant: Variant): SelectionSolution {
    const transformedSelected = selectedCells.map(cell => transformCell(cell, variant))
    const cellKeyToIndex = new Map<string, number>()
    const indexToCell: Cell[] = []
    transformedSelected.forEach((cell, index) => {
      const key = `${cell.x},${cell.y}`
      cellKeyToIndex.set(key, index)
      indexToCell[index] = cell
    })

    const selectedSet = new Set(transformedSelected.map(cell => `${cell.x},${cell.y}`))
    const degreeByCell = new Array<number>(transformedSelected.length).fill(0)
    transformedSelected.forEach((cell, index) => {
      const neighbors = [
        `${cell.x + 1},${cell.y}`,
        `${cell.x - 1},${cell.y}`,
        `${cell.x},${cell.y + 1}`,
        `${cell.x},${cell.y - 1}`,
      ]
      degreeByCell[index] = neighbors.filter(key => selectedSet.has(key)).length
    })
    const criticalCellSet = new Set<number>(
      transformedSelected.flatMap((cell, index) =>
        isCenterCrossCell(cell.y, cell.x) || degreeByCell[index] <= 2 ? [index] : []
      )
    )

    const placements: IndexedPlacement[] = []
    const placementsByCell = Array.from({ length: transformedSelected.length }, () => [] as number[])

    inventoryEntries.forEach((item, inventoryIndex) => {
      const seen = new Set<string>()
      const selectedKeys = [...cellKeyToIndex.keys()]
      for (const transform of getShapeTransforms(item.cells)) {
        for (const anchorKey of selectedKeys) {
          const [anchorX, anchorY] = anchorKey.split(',').map(Number)
          for (const pivot of transform) {
            const dx = anchorX - pivot.x
            const dy = anchorY - pivot.y
            const placedCells = transform.map(cell => ({ x: cell.x + dx, y: cell.y + dy }))
            const indices: number[] = []
            let valid = true

            for (const cell of placedCells) {
              const index = cellKeyToIndex.get(`${cell.x},${cell.y}`)
              if (index === undefined) {
                valid = false
                break
              }
              indices.push(index)
            }

            if (!valid) continue
            indices.sort((a, b) => a - b)
            const dedupeKey = `${inventoryIndex}:${indices.join(',')}`
            if (seen.has(dedupeKey)) continue
            seen.add(dedupeKey)

            const placementIndex = placements.length
            const criticalCount = indices.filter(index => criticalCellSet.has(index)).length
            placements.push({
              inventoryIndex,
              cellIndices: indices,
              criticalCount,
              placement: {
                inventoryKey: item.key,
                label: item.label,
                classType: item.classType,
                grade: item.grade,
                cells: indices.map(index => indexToCell[index]),
              },
            })

            indices.forEach(index => placementsByCell[index].push(placementIndex))
          }
        }
      }
    })

    const remaining = new Array<boolean>(transformedSelected.length).fill(true)
    const inventoryCounts = inventoryEntries.map(item => item.count)
    const current: IndexedPlacement[] = []
    let best: SelectionSolution = {
      placements: [],
      usedTiles: 0,
      remainingTiles: transformedSelected.length,
      success: false,
    }
    const memo = new Map<string, number>()

    function remainingCapacity(): number {
      return inventoryEntries.reduce((sum, item, index) => sum + item.cells.length * inventoryCounts[index], 0)
    }

    function maybeUpdateBest() {
      const usedTiles = current.reduce((sum, placement) => sum + placement.cellIndices.length, 0)
      const remainingTiles = transformedSelected.length - usedTiles
      if (
        remainingTiles < best.remainingTiles ||
        (remainingTiles === best.remainingTiles && usedTiles > best.usedTiles)
      ) {
        best = {
          placements: current.map(entry => ({
            ...entry.placement,
            cells: entry.placement.cells.map(cell => untransformCell(cell, variant)),
          })),
          usedTiles,
          remainingTiles,
          success: remainingTiles === 0,
        }
      }
    }

    function chooseNextCell(): number {
      const unresolvedCritical = [...criticalCellSet].filter(index => remaining[index])
      const candidates = unresolvedCritical.length > 0 ? unresolvedCritical : remaining.flatMap((value, index) => value ? [index] : [])
      let bestCell = -1
      let bestOptionCount = Number.POSITIVE_INFINITY
      let bestDegree = Number.POSITIVE_INFINITY

      for (const cellIndex of candidates) {
        let optionCount = 0
        for (const placementIndex of placementsByCell[cellIndex]) {
          const placement = placements[placementIndex]
          if (inventoryCounts[placement.inventoryIndex] <= 0) continue
          if (placement.cellIndices.every(index => remaining[index])) optionCount++
        }

        if (
          optionCount < bestOptionCount ||
          (optionCount === bestOptionCount && degreeByCell[cellIndex] < bestDegree)
        ) {
          bestOptionCount = optionCount
          bestDegree = degreeByCell[cellIndex]
          bestCell = cellIndex
          if (bestOptionCount <= 1) break
        }
      }

      return bestCell
    }

    function stateKey(nextCell: number): string {
      const remainingBits: string[] = []
      for (let offset = 0; offset < remaining.length; offset += 32) {
        let bits = 0
        for (let bit = 0; bit < 32 && offset + bit < remaining.length; bit++) {
          if (remaining[offset + bit]) bits |= (1 << bit)
        }
        remainingBits.push(bits.toString(36))
      }
      return `${variant}|${nextCell}|${remainingBits.join('.')}` + `|${inventoryCounts.join(',')}`
    }

    function search() {
      maybeUpdateBest()
      if (best.remainingTiles === 0) return true
      if (remainingCapacity() < best.remainingTiles) return false

      const nextCell = chooseNextCell()
      if (nextCell < 0) return true

      const key = stateKey(nextCell)
      const currentRemaining = remaining.filter(Boolean).length
      const memoBest = memo.get(key)
      if (memoBest !== undefined && memoBest <= currentRemaining) return false
      memo.set(key, currentRemaining)

      const options = placementsByCell[nextCell]
        .map(index => placements[index])
        .filter(placement =>
          inventoryCounts[placement.inventoryIndex] > 0 &&
          placement.cellIndices.every(index => remaining[index])
        )
        .sort((a, b) => {
          if (b.criticalCount !== a.criticalCount) return b.criticalCount - a.criticalCount
          if (b.cellIndices.length !== a.cellIndices.length) return b.cellIndices.length - a.cellIndices.length
          return a.inventoryIndex - b.inventoryIndex
        })

      for (const placement of options) {
        inventoryCounts[placement.inventoryIndex] -= 1
        placement.cellIndices.forEach(index => { remaining[index] = false })
        current.push(placement)

        if (search()) return true

        current.pop()
        placement.cellIndices.forEach(index => { remaining[index] = true })
        inventoryCounts[placement.inventoryIndex] += 1
      }

      return false
    }

    search()
    return best
  }

  let best = solveVariant('identity')
  for (const variant of ['flip-x', 'flip-y', 'flip-both'] as const) {
    if (best.success) break
    const candidate = solveVariant(variant)
    if (
      candidate.remainingTiles < best.remainingTiles ||
      (candidate.remainingTiles === best.remainingTiles && candidate.usedTiles > best.usedTiles)
    ) {
      best = candidate
    }
  }

  return best
}

export function solveSelectedCells(selectedCells: Cell[], inventoryEntries: PieceInventoryEntry[]): SelectionSolution {
  const remaining = new Set(selectedCells.map(cell => `${cell.x},${cell.y}`))
  const inventory = inventoryEntries.map(item => ({ ...item }))
  const recursive = solveSelectionRecursive(remaining, inventory, [], new Map())
  if (recursive.success || selectedCells.length <= 36) return recursive
  return solveSelectionExact(selectedCells, inventoryEntries)
}

export function hasCenterAnchor(cells: Cell[]): boolean {
  return cells.some(cell => (cell.x === 10 || cell.x === 11) && (cell.y === 9 || cell.y === 10))
}

export function isConnectedSelection(cells: Cell[]): boolean {
  if (cells.length === 0) return true
  const set = new Set(cells.map(cell => `${cell.x},${cell.y}`))
  const visited = new Set<string>()
  const stack = [`${cells[0].x},${cells[0].y}`]
  const directions = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]

  while (stack.length > 0) {
    const current = stack.pop()!
    if (visited.has(current)) continue
    visited.add(current)
    const [x, y] = current.split(',').map(Number)
    for (const [dx, dy] of directions) {
      const next = `${x + dx},${y + dy}`
      if (set.has(next) && !visited.has(next)) stack.push(next)
    }
  }

  return visited.size === cells.length
}

export function getCellsForEffectLabel(label: EffectLabel, totalLevel: number): Cell[] {
  const cells: Cell[] = []

  for (let row = 0; row < BOARD_ROWS; row++) {
    for (let col = 0; col < BOARD_COLS; col++) {
      if (!isCellUnlocked(row, col, totalLevel)) continue
      if (getEffectLabel(row, col) === label) {
        cells.push({ x: col, y: row })
      }
    }
  }

  return cells
}

function canMoveBetween(row: number, col: number, nextRow: number, nextCol: number): boolean {
  if (nextRow < 0 || nextRow >= BOARD_ROWS || nextCol < 0 || nextCol >= BOARD_COLS) return false
  if (nextRow === row - 1) return !BORDER_MAP.horizontal.has(`${row},${col}`)
  if (nextRow === row + 1) return !BORDER_MAP.horizontal.has(`${row + 1},${col}`)
  if (nextCol === col - 1) return !BORDER_MAP.vertical.has(`${col},${row}`)
  if (nextCol === col + 1) return !BORDER_MAP.vertical.has(`${col + 1},${row}`)
  return false
}

export function getSelectableRegions(totalLevel: number): SelectableRegion[] {
  const visited = new Set<string>()
  const regions: SelectableRegion[] = []
  const directions = [
    [0, 1],
    [1, 0],
    [0, -1],
    [-1, 0],
  ]

  for (let row = 0; row < BOARD_ROWS; row++) {
    for (let col = 0; col < BOARD_COLS; col++) {
      const key = `${col},${row}`
      if (visited.has(key) || !isCellUnlocked(row, col, totalLevel)) continue

      const label = getEffectLabel(row, col)
      const stack = [{ x: col, y: row }]
      const cells: Cell[] = []
      visited.add(key)

      while (stack.length > 0) {
        const current = stack.pop()!
        cells.push(current)

        for (const [dx, dy] of directions) {
          const nextX = current.x + dx
          const nextY = current.y + dy
          const nextKey = `${nextX},${nextY}`
          if (visited.has(nextKey) || !isCellUnlocked(nextY, nextX, totalLevel)) continue
          if (!canMoveBetween(current.y, current.x, nextY, nextX)) continue
          visited.add(nextKey)
          stack.push({ x: nextX, y: nextY })
        }
      }

      regions.push({
        id: `${label}:${col},${row}`,
        label,
        cells,
      })
    }
  }

  return regions
}

export function buildRecommendedLayout(characters: SavedCharacter[]): RecommendedLayout {
  const totalLevel = getWorldTotalLevel(characters)
  const slotLimit = getSlotLimit(characters)
  const candidates = buildCandidates(characters).slice(0, slotLimit)
  const inventory = buildInventory(candidates)
  let bestBlocks: RecommendedBlock[] = []
  let bestOccupied = new Map<string, RecommendedBlock>()
  let bestScore = Number.NEGATIVE_INFINITY
  let bestTiles = 0

  for (let attempt = 0; attempt < 48; attempt++) {
    const occupied = new Map<string, RecommendedBlock>()
    const blocks: RecommendedBlock[] = []
    let totalScore = 0
    const orderedCandidates = getCandidateOrder(candidates, attempt + 1)

    for (const [index, candidate] of orderedCandidates.entries()) {
      const { placement, score } = choosePlacement(candidate, occupied, totalLevel, (attempt + 1) * 97 + index)
      if (!placement) continue

      blocks.push(placement)
      totalScore += score
      for (const cell of placement.cells) {
        occupied.set(`${cell.y},${cell.x}`, placement)
      }
    }

    const usedTiles = blocks.reduce((sum, block) => sum + block.cells.length, 0)
    if (
      blocks.length > bestBlocks.length ||
      (blocks.length === bestBlocks.length && usedTiles > bestTiles) ||
      (blocks.length === bestBlocks.length && usedTiles === bestTiles && totalScore > bestScore)
    ) {
      bestBlocks = blocks
      bestOccupied = occupied
      bestScore = totalScore
      bestTiles = usedTiles
    }
  }

  return {
    blocks: bestBlocks,
    occupied: bestOccupied,
    slotLimit,
    usedSlots: bestBlocks.length,
    usedTiles: bestTiles,
    totalCharacters: candidates.length,
    totalLevel,
    inventory,
  }
}
