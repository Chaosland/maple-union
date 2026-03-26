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
  categoryLabel: string
  classType: ClassType
  grade: UnionBlockGrade
  cells: Cell[]
  shapeMatrix: number[][]
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
  iterations: number
  elapsedMs: number
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
  shapeMatrix: number[][]
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

const DEFAULT_PIECE_MATRICES = {
  B: [[2]],
  A: [[2, 2]],
  S_WARRIOR_PIRATE: [
    [1, 0],
    [2, 1],
  ],
  S_MAGE_THIEF_ARCHER: [[1, 2, 1]],
  SS_WARRIOR: [
    [2, 2],
    [2, 2],
  ],
  SS_ARCHER: [[1, 2, 2, 1]],
  SS_THIEF_XENON: [
    [1, 0, 0],
    [1, 2, 1],
  ],
  SS_MAGE: [
    [0, 1, 0],
    [1, 2, 1],
  ],
  SS_PIRATE: [
    [1, 2, 0],
    [0, 2, 1],
  ],
  SSS_WARRIOR: [
    [1, 1, 2],
    [0, 1, 1],
  ],
  SSS_ARCHER: [[1, 1, 2, 1, 1]],
  SSS_THIEF: [
    [0, 0, 1],
    [1, 2, 1],
    [0, 0, 1],
  ],
  SSS_MAGE: [
    [0, 1, 0],
    [1, 2, 1],
    [0, 1, 0],
  ],
  SSS_PIRATE: [
    [1, 2, 0, 0],
    [0, 1, 1, 1],
  ],
  SSS_XENON: [
    [1, 1, 0],
    [0, 2, 0],
    [0, 1, 1],
  ],
} as const

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
  mapleM: {
    B: DEFAULT_PIECES.B,
    A: DEFAULT_PIECES.A,
    S: DEFAULT_PIECES.S_MAGE_THIEF_ARCHER,
    SS: DEFAULT_PIECES.SS_ARCHER,
    SSS: DEFAULT_PIECES.SSS_ARCHER,
  },
}

const SHAPE_MATRICES: Record<string, Record<UnionBlockGrade, number[][]>> = {
  warrior: {
    B: DEFAULT_PIECE_MATRICES.B,
    A: DEFAULT_PIECE_MATRICES.A,
    S: DEFAULT_PIECE_MATRICES.S_WARRIOR_PIRATE,
    SS: DEFAULT_PIECE_MATRICES.SS_WARRIOR,
    SSS: DEFAULT_PIECE_MATRICES.SSS_WARRIOR,
  },
  mage: {
    B: DEFAULT_PIECE_MATRICES.B,
    A: DEFAULT_PIECE_MATRICES.A,
    S: DEFAULT_PIECE_MATRICES.S_MAGE_THIEF_ARCHER,
    SS: DEFAULT_PIECE_MATRICES.SS_MAGE,
    SSS: DEFAULT_PIECE_MATRICES.SSS_MAGE,
  },
  archer: {
    B: DEFAULT_PIECE_MATRICES.B,
    A: DEFAULT_PIECE_MATRICES.A,
    S: DEFAULT_PIECE_MATRICES.S_MAGE_THIEF_ARCHER,
    SS: DEFAULT_PIECE_MATRICES.SS_ARCHER,
    SSS: DEFAULT_PIECE_MATRICES.SSS_ARCHER,
  },
  thief: {
    B: DEFAULT_PIECE_MATRICES.B,
    A: DEFAULT_PIECE_MATRICES.A,
    S: DEFAULT_PIECE_MATRICES.S_MAGE_THIEF_ARCHER,
    SS: DEFAULT_PIECE_MATRICES.SS_THIEF_XENON,
    SSS: DEFAULT_PIECE_MATRICES.SSS_THIEF,
  },
  pirate: {
    B: DEFAULT_PIECE_MATRICES.B,
    A: DEFAULT_PIECE_MATRICES.A,
    S: DEFAULT_PIECE_MATRICES.S_WARRIOR_PIRATE,
    SS: DEFAULT_PIECE_MATRICES.SS_PIRATE,
    SSS: DEFAULT_PIECE_MATRICES.SSS_PIRATE,
  },
  xenon: {
    B: DEFAULT_PIECE_MATRICES.B,
    A: DEFAULT_PIECE_MATRICES.A,
    S: DEFAULT_PIECE_MATRICES.S_MAGE_THIEF_ARCHER,
    SS: DEFAULT_PIECE_MATRICES.SS_THIEF_XENON,
    SSS: DEFAULT_PIECE_MATRICES.SSS_XENON,
  },
  mapleM: {
    B: DEFAULT_PIECE_MATRICES.B,
    A: DEFAULT_PIECE_MATRICES.A,
    S: DEFAULT_PIECE_MATRICES.S_MAGE_THIEF_ARCHER,
    SS: DEFAULT_PIECE_MATRICES.SS_ARCHER,
    SSS: DEFAULT_PIECE_MATRICES.SSS_ARCHER,
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
      const shapeKey = character.character_class === '메이플스토리 M'
        ? 'mapleM'
        : character.character_class.includes('제논') && grade === 'SSS'
          ? 'xenon'
          : classType
      return {
        id: character.ocid,
        character,
        classType,
        grade,
        cells: SHAPES[shapeKey][grade],
        shapeMatrix: SHAPE_MATRICES[shapeKey][grade].map(row => [...row]),
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

export function getPieceInventory(characters: SavedCharacter[], options?: { useAllCharacters?: boolean }): PieceInventoryEntry[] {
  const slotLimit = getSlotLimit(characters)
  const candidates = options?.useAllCharacters ? buildCandidates(characters) : buildCandidates(characters).slice(0, slotLimit)
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
      categoryLabel: candidate.character.character_class === '메이플스토리 M'
        ? '메이플 M'
        : ({
            warrior: '전사',
            mage: '마법사',
            archer: '궁수',
            thief: '도적',
            pirate: '해적',
          } satisfies Record<ClassType, string>)[candidate.classType],
      classType: candidate.classType,
      grade: candidate.grade,
      cells: candidate.cells,
      shapeMatrix: candidate.shapeMatrix.map(row => [...row]),
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

type SolverVariant = 'identity' | 'flip-x' | 'flip-y' | 'flip-both'

interface SolverPoint extends Cell {
  isMiddle?: boolean
}

interface SolverPieceTransform {
  cells: SolverPoint[]
  restricted: boolean
  offCenter: number
}

interface LegionPieceEntry {
  inventoryIndex: number
  key: string
  label: string
  classType: ClassType
  grade: UnionBlockGrade
  count: number
  cellCount: number
  transforms: SolverPieceTransform[]
  restrictedTransforms: SolverPieceTransform[]
}

interface LegionCandidatePlacement {
  inventoryIndex: number
  cells: Cell[]
  longSpaceHits: number
  restrictedHits: number
}

interface LegionSearchResult {
  placements: SolvedPlacement[]
  usedTiles: number
  remainingTiles: number
  success: boolean
  iterations: number
  elapsedMs: number
}

function transformSolverCell(cell: Cell, variant: SolverVariant): Cell {
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

function cloneBoard(board: number[][]): number[][] {
  return board.map(row => [...row])
}

function countBoardEmpty(board: number[][]): number {
  let count = 0
  for (let row = 0; row < BOARD_ROWS; row++) {
    for (let col = 0; col < BOARD_COLS; col++) {
      if (board[row][col] === 0) count++
    }
  }
  return count
}

function getBoardSignature(board: number[][], counts: number[], variant: SolverVariant): string {
  const bits: string[] = []
  let current = 0
  let bitIndex = 0

  for (let row = 0; row < BOARD_ROWS; row++) {
    for (let col = 0; col < BOARD_COLS; col++) {
      if (board[row][col] === 0) current |= 1 << bitIndex
      bitIndex++
      if (bitIndex === 30) {
        bits.push(current.toString(36))
        current = 0
        bitIndex = 0
      }
    }
  }

  if (bitIndex > 0) bits.push(current.toString(36))
  return `${variant}|${bits.join('.')}|${counts.join(',')}`
}

function buildLegionBoard(selectedCells: Cell[]): number[][] {
  const board = Array.from({ length: BOARD_ROWS }, () => Array.from({ length: BOARD_COLS }, () => -1))
  for (const cell of selectedCells) board[cell.y][cell.x] = 0
  return board
}

function getOffCenter(cells: Cell[]): number {
  const topRow = Math.min(...cells.map(cell => cell.y))
  const topCells = cells.filter(cell => cell.y === topRow).sort((a, b) => a.x - b.x)
  return topCells[0]?.x ?? 0
}

function createSolverTransform(cells: Cell[]): SolverPieceTransform {
  const normalized = normalize(cells)
  const keySet = new Set(normalized.map(cell => `${cell.x},${cell.y}`))
  const offCenter = getOffCenter(normalized)
  const points: SolverPoint[] = normalized.map(cell => ({
    x: cell.x,
    y: cell.y,
    isMiddle: keySet.has(`${offCenter},${cell.y}`) && cell.x === offCenter,
  }))
  const restricted = !keySet.has(`${offCenter + 1},0`)
  return { cells: points, restricted, offCenter }
}

function buildSolverTransforms(cells: Cell[]): SolverPieceTransform[] {
  return getShapeTransforms(cells).map(transform => createSolverTransform(transform))
}

function buildLegionPieces(inventoryEntries: PieceInventoryEntry[]): LegionPieceEntry[] {
  return inventoryEntries
    .map((item, inventoryIndex) => ({
      inventoryIndex,
      key: item.key,
      label: item.label,
      classType: item.classType,
      grade: item.grade,
      count: item.count,
      cellCount: item.cells.length,
      transforms: buildSolverTransforms(item.cells),
      restrictedTransforms: buildSolverTransforms(item.cells).filter(transform => transform.restricted),
    }))
    .sort((a, b) => {
      const av = a.count * a.cellCount
      const bv = b.count * b.cellCount
      if (bv !== av) return bv - av
      return b.cellCount - a.cellCount
    })
}

function getRestrictedSpots(board: number[][]): Array<Cell & { spotsFilled: number }> {
  const restricted: Array<Cell & { spotsFilled: number }> = []

  for (let row = 0; row < BOARD_ROWS; row++) {
    for (let col = 0; col < BOARD_COLS; col++) {
      if (board[row][col] !== 0) continue
      let openSides = 0
      if (board[row - 1]?.[col] === 0) openSides++
      if (board[row + 1]?.[col] === 0) openSides++
      if (board[row]?.[col - 1] === 0) openSides++
      if (board[row]?.[col + 1] === 0) openSides++
      if (openSides <= 1) restricted.push({ x: col, y: row, spotsFilled: 4 - openSides })
    }
  }

  restricted.sort((a, b) => b.spotsFilled - a.spotsFilled || a.y - b.y || a.x - b.x)
  return restricted
}

function getLongSpaces(board: number[][]): Cell[] {
  const longSpaces: Cell[] = []

  for (let row = 0; row < BOARD_ROWS; row++) {
    for (let col = 0; col < BOARD_COLS; col++) {
      if (board[row][col] !== 0) continue
      const vertical =
        board[row - 1]?.[col] === 0 &&
        board[row + 1]?.[col] === 0 &&
        board[row]?.[col - 1] !== 0 &&
        board[row]?.[col + 1] !== 0
      const horizontal =
        board[row - 1]?.[col] !== 0 &&
        board[row + 1]?.[col] !== 0 &&
        board[row]?.[col - 1] === 0 &&
        board[row]?.[col + 1] === 0
      if (vertical || horizontal) longSpaces.push({ x: col, y: row })
    }
  }

  return longSpaces
}

function determineDirectionFree(board: number[][], point: Cell): number {
  if (board[point.y - 1]?.[point.x] === 0) return 1
  if (board[point.y]?.[point.x + 1] === 0) return 2
  if (board[point.y + 1]?.[point.x] === 0) return 3
  if (board[point.y]?.[point.x - 1] === 0) return 4
  return 5
}

function determinePlacedPoint(position: Cell, transform: SolverPieceTransform, point: SolverPoint, directionFree: number): Cell {
  if (directionFree === 0 || directionFree === 3 || directionFree === 5) {
    return { x: position.x + point.x - transform.offCenter, y: position.y + point.y }
  }
  if (directionFree === 1) {
    return { x: position.x - point.x + transform.offCenter, y: position.y - point.y }
  }
  if (directionFree === 2) {
    return { x: position.x + point.y, y: position.y + point.x - transform.offCenter }
  }
  return { x: position.x - point.y, y: position.y - point.x + transform.offCenter }
}

function getPlacedCells(position: Cell, transform: SolverPieceTransform, directionFree: number): Cell[] {
  return transform.cells.map(point => determinePlacedPoint(position, transform, point, directionFree))
}

function isTransformPlaceable(board: number[][], position: Cell, transform: SolverPieceTransform, directionFree: number): boolean {
  for (const point of transform.cells) {
    const placed = determinePlacedPoint(position, transform, point, directionFree)
    if (
      placed.y < 0 ||
      placed.y >= board.length ||
      placed.x < 0 ||
      placed.x >= board[0].length ||
      board[placed.y][placed.x] !== 0
    ) {
      return false
    }
  }
  return true
}

function getNextEmpty(board: number[][]): Cell | null {
  for (let row = 0; row < BOARD_ROWS; row++) {
    for (let col = 0; col < BOARD_COLS; col++) {
      if (board[row][col] === 0) return { x: col, y: row }
    }
  }
  return null
}

function collectLegionCandidates(
  board: number[][],
  pieces: LegionPieceEntry[],
  anchor: Cell,
  longSpaces: Cell[],
  restrictedSpots: Array<Cell & { spotsFilled: number }>,
  firstAlgorithm: boolean
): LegionCandidatePlacement[] {
  const longSpaceSet = new Set(longSpaces.map(cell => `${cell.x},${cell.y}`))
  const restrictedSet = new Set(restrictedSpots.map(cell => `${cell.x},${cell.y}`))
  const candidates: LegionCandidatePlacement[] = []
  const seen = new Set<string>()
  const directionFree = firstAlgorithm ? 0 : determineDirectionFree(board, anchor)
  const useRestricted = !firstAlgorithm && restrictedSpots.length > 0 && directionFree !== 5

  for (let pieceIndex = 0; pieceIndex < pieces.length; pieceIndex++) {
    const piece = pieces[pieceIndex]
    if (piece.count <= 0) continue
    const transforms = useRestricted ? piece.restrictedTransforms : piece.transforms

    for (const transform of transforms) {
      if (!isTransformPlaceable(board, anchor, transform, directionFree)) continue
      const placedCells = getPlacedCells(anchor, transform, directionFree)
      const key = `${piece.inventoryIndex}:${placedCells.map(cell => `${cell.x},${cell.y}`).sort().join('|')}`
      if (seen.has(key)) continue
      seen.add(key)

      let longSpaceHits = 0
      let restrictedHits = 0
      for (const cell of placedCells) {
        if (longSpaceSet.has(`${cell.x},${cell.y}`)) longSpaceHits++
        if (restrictedSet.has(`${cell.x},${cell.y}`)) restrictedHits++
      }

      candidates.push({
        inventoryIndex: pieceIndex,
        cells: placedCells,
        longSpaceHits,
        restrictedHits,
      })
    }
  }

  const prioritizeLongSpace = longSpaces.length > 0
  const prioritizeRestricted = !prioritizeLongSpace && restrictedSpots.length > 0

  candidates.sort((a, b) => {
    const pieceA = pieces[a.inventoryIndex]
    const pieceB = pieces[b.inventoryIndex]
    if (prioritizeLongSpace && b.longSpaceHits !== a.longSpaceHits) return b.longSpaceHits - a.longSpaceHits
    if (prioritizeRestricted && b.restrictedHits !== a.restrictedHits) return b.restrictedHits - a.restrictedHits
    if (pieceB.cellCount !== pieceA.cellCount) return pieceB.cellCount - pieceA.cellCount
    return a.inventoryIndex - b.inventoryIndex
  })

  return candidates
}

function solveSelectionLegionStyle(
  selectedCells: Cell[],
  inventoryEntries: PieceInventoryEntry[],
  variants: readonly SolverVariant[],
  maxSteps = 140_000
): LegionSearchResult {
  const startedAt = Date.now()
  if (selectedCells.length === 0) {
    return { placements: [], usedTiles: 0, remainingTiles: 0, success: true, iterations: 0, elapsedMs: 0 }
  }

  let best: LegionSearchResult = {
    placements: [],
    usedTiles: 0,
    remainingTiles: selectedCells.length,
    success: false,
    iterations: 0,
    elapsedMs: 0,
  }
  let totalIterations = 0

  for (const variant of variants) {
    let steps = maxSteps
    const transformedSelected = selectedCells.map(cell => transformSolverCell(cell, variant))
    const board = buildLegionBoard(transformedSelected)
    const pieces = buildLegionPieces(inventoryEntries)
    const placements: SolvedPlacement[] = []
    const memo = new Map<string, number>()

    const remainingCapacity = () => pieces.reduce((sum, piece) => sum + piece.count * piece.cellCount, 0)

    const commitBest = () => {
      const remainingTiles = countBoardEmpty(board)
      const usedTiles = transformedSelected.length - remainingTiles
      if (
        remainingTiles < best.remainingTiles ||
        (remainingTiles === best.remainingTiles && usedTiles > best.usedTiles)
      ) {
        best = {
          placements: placements.map(placement => ({
            ...placement,
            cells: placement.cells.map(cell => transformSolverCell(cell, variant)),
          })),
          usedTiles,
          remainingTiles,
          success: remainingTiles === 0,
          iterations: totalIterations,
          elapsedMs: Date.now() - startedAt,
        }
      }
    }

    const search = (): boolean => {
      totalIterations++
      if (steps-- <= 0) return false
      commitBest()
      if (best.success) return true

      const remainingTiles = countBoardEmpty(board)
      if (remainingTiles === 0) return true
      if (remainingCapacity() < remainingTiles) return false

      const longSpaces = getLongSpaces(board)
      const restrictedSpots = getRestrictedSpots(board)
      const anchor = longSpaces[0] ?? restrictedSpots[0] ?? getNextEmpty(board)
      if (!anchor) return true
      const firstAlgorithm = longSpaces.length > 0

      const state = getBoardSignature(board, pieces.map(piece => piece.count), variant)
      const memoRemaining = memo.get(state)
      if (memoRemaining !== undefined && memoRemaining <= remainingTiles) return false
      memo.set(state, remainingTiles)

      const candidates = collectLegionCandidates(board, pieces, anchor, longSpaces, restrictedSpots, firstAlgorithm)
      if (candidates.length === 0) return false

      for (const candidate of candidates) {
        const piece = pieces[candidate.inventoryIndex]
        piece.count -= 1
        for (const cell of candidate.cells) board[cell.y][cell.x] = candidate.inventoryIndex + 1
        placements.push({
          inventoryKey: piece.key,
          label: piece.label,
          classType: piece.classType,
          grade: piece.grade,
          cells: [...candidate.cells],
        })

        if (search()) return true

        placements.pop()
        for (const cell of candidate.cells) board[cell.y][cell.x] = 0
        piece.count += 1
      }

      return false
    }

    search()
    if (best.success) return best
  }

  best.iterations = totalIterations
  best.elapsedMs = Date.now() - startedAt
  return best
}

const MAX_STEPS = 600_000   // 전체 탐색 스텝 한도 (두 솔버 합산)
const MAX_MEMO  = 30_000    // 메모 항목 최대 수

function solveSelectionRecursive(
  remaining: Set<string>,
  inventory: PieceInventoryEntry[],
  placements: SolvedPlacement[],
  memo: Map<string, SelectionSolution>,
  budget: { steps: number }
): SelectionSolution {
  if (remaining.size === 0) {
    return { placements: [...placements], usedTiles: 0, remainingTiles: 0, success: true, iterations: 0, elapsedMs: 0 }
  }
  if (budget.steps <= 0) {
    return { placements: [...placements], usedTiles: 0, remainingTiles: remaining.size, success: false, iterations: 0, elapsedMs: 0 }
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
    iterations: 0,
    elapsedMs: 0,
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

        budget.steps--
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
          memo,
          budget
        )
        item.count += 1

        const usedTiles = nested.usedTiles + placedCells.length
        const candidate: SelectionSolution = {
          placements: nested.placements,
          usedTiles,
          remainingTiles: nested.remainingTiles,
          success: nested.success && nested.remainingTiles === 0,
          iterations: 0,
          elapsedMs: 0,
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

  if (memo.size < MAX_MEMO) memo.set(key, best)
  return best
}

// ── 알고리즘 설명 ──────────────────────────────────────────────────────────────
// Phase 1 (중앙 브루트포스): 선택 영역 내 중앙 십자 셀이 남아있는 동안은
//   스캔 순서(위→아래, 왼→오른)로 셀을 선택한다. MCV를 쓰면 중앙 배치가
//   특정 순서에 빠르게 수렴해 백트래킹 비용이 폭발하기 때문이다.
// Phase 2 (MCV): 중앙 십자가 덮이면 남은 셀 중 가장 제약이 많은 것(옵션 최소)을
//   먼저 선택해 가지치기 효율을 높인다.
// 4방향 변환 병렬 실행: 각 변환(원본 / flip-x / flip-y / flip-both)을
//   독립적으로 탐색하며, 어느 하나라도 완전 해를 찾으면 즉시 반환한다.
//   가장 먼저 해를 찾은 결과를 원래 좌표계로 역변환해서 돌려준다.
// ──────────────────────────────────────────────────────────────────────────────
function solveSelectionExact(selectedCells: Cell[], inventoryEntries: PieceInventoryEntry[]): SelectionSolution {
  if (selectedCells.length === 0) {
    return { placements: [], usedTiles: 0, remainingTiles: 0, success: true, iterations: 0, elapsedMs: 0 }
  }

  type Variant = 'identity' | 'flip-x' | 'flip-y' | 'flip-both'
  type IndexedPlacement = {
    inventoryIndex: number
    cellIndices: number[]
    criticalCount: number
    centerCount: number   // 중앙 십자 셀에 겹치는 수
    placement: SolvedPlacement
  }

  function transformCell(cell: Cell, variant: Variant): Cell {
    switch (variant) {
      case 'flip-x':   return { x: BOARD_COLS - 1 - cell.x, y: cell.y }
      case 'flip-y':   return { x: cell.x, y: BOARD_ROWS - 1 - cell.y }
      case 'flip-both':return { x: BOARD_COLS - 1 - cell.x, y: BOARD_ROWS - 1 - cell.y }
      default:         return cell
    }
  }
  // flip 연산은 자기 자신의 역함수
  const untransformCell = transformCell

  function solveVariant(variant: Variant, budget: { steps: number }): SelectionSolution {
    const transformedSelected = selectedCells.map(cell => transformCell(cell, variant))
    const cellKeyToIndex = new Map<string, number>()
    const indexToCell: Cell[] = []
    transformedSelected.forEach((cell, index) => {
      cellKeyToIndex.set(`${cell.x},${cell.y}`, index)
      indexToCell[index] = cell
    })

    const selectedSet = new Set(transformedSelected.map(cell => `${cell.x},${cell.y}`))

    // 각 셀의 인접 이웃 수 (선택 영역 내)
    const degreeByCell = new Array<number>(transformedSelected.length).fill(0)
    transformedSelected.forEach((cell, index) => {
      degreeByCell[index] = [
        `${cell.x + 1},${cell.y}`, `${cell.x - 1},${cell.y}`,
        `${cell.x},${cell.y + 1}`, `${cell.x},${cell.y - 1}`,
      ].filter(k => selectedSet.has(k)).length
    })

    // 중앙 십자 셀 집합 (Phase 1 대상)
    const centerCellSet = new Set<number>(
      transformedSelected.flatMap((cell, index) =>
        isCenterCrossCell(cell.y, cell.x) ? [index] : []
      )
    )

    // 저차수(≤2) + 중앙 십자 = 크리티컬 셀 (Phase 2 MCV 우선 후보)
    const criticalCellSet = new Set<number>(
      transformedSelected.flatMap((cell, index) =>
        isCenterCrossCell(cell.y, cell.x) || degreeByCell[index] <= 2 ? [index] : []
      )
    )

    // ── 가능한 배치 후보 사전 계산 ──────────────────────────────────────────
    const placements: IndexedPlacement[] = []
    const placementsByCell = Array.from({ length: transformedSelected.length }, () => [] as number[])

    inventoryEntries.forEach((item, inventoryIndex) => {
      const seen = new Set<string>()
      for (const transform of getShapeTransforms(item.cells)) {
        for (const anchorKey of cellKeyToIndex.keys()) {
          const [anchorX, anchorY] = anchorKey.split(',').map(Number)
          for (const pivot of transform) {
            const dx = anchorX - pivot.x, dy = anchorY - pivot.y
            const placedCells = transform.map(c => ({ x: c.x + dx, y: c.y + dy }))
            const indices: number[] = []
            let valid = true
            for (const c of placedCells) {
              const idx = cellKeyToIndex.get(`${c.x},${c.y}`)
              if (idx === undefined) { valid = false; break }
              indices.push(idx)
            }
            if (!valid) continue
            indices.sort((a, b) => a - b)
            const dedupeKey = `${inventoryIndex}:${indices.join(',')}`
            if (seen.has(dedupeKey)) continue
            seen.add(dedupeKey)

            const pIdx = placements.length
            placements.push({
              inventoryIndex,
              cellIndices: indices,
              criticalCount: indices.filter(i => criticalCellSet.has(i)).length,
              centerCount:   indices.filter(i => centerCellSet.has(i)).length,
              placement: {
                inventoryKey: item.key,
                label: item.label,
                classType: item.classType,
                grade: item.grade,
                cells: indices.map(i => indexToCell[i]),
              },
            })
            indices.forEach(i => placementsByCell[i].push(pIdx))
          }
        }
      }
    })

    // ── 탐색 상태 ─────────────────────────────────────────────────────────────
    const remaining = new Array<boolean>(transformedSelected.length).fill(true)
    const inventoryCounts = inventoryEntries.map(item => item.count)
    const current: IndexedPlacement[] = []
    let best: SelectionSolution = {
      placements: [], usedTiles: 0,
      remainingTiles: transformedSelected.length, success: false,
      iterations: 0,
      elapsedMs: 0,
    }
    const memo = new Map<string, number>()

    function remainingCapacity(): number {
      return inventoryEntries.reduce((sum, item, i) => sum + item.cells.length * inventoryCounts[i], 0)
    }

    function maybeUpdateBest() {
      const usedTiles = current.reduce((s, p) => s + p.cellIndices.length, 0)
      const remainingTiles = transformedSelected.length - usedTiles
      if (
        remainingTiles < best.remainingTiles ||
        (remainingTiles === best.remainingTiles && usedTiles > best.usedTiles)
      ) {
        best = {
          placements: current.map(entry => ({
            ...entry.placement,
            cells: entry.placement.cells.map(c => untransformCell(c, variant)),
          })),
          usedTiles, remainingTiles,
          success: remainingTiles === 0,
          iterations: 0,
          elapsedMs: 0,
        }
      }
    }

    // ── Phase 1 / Phase 2 하이브리드 셀 선택 ─────────────────────────────────
    // Phase 1: 중앙 십자 셀이 남아있으면 스캔 순서(브루트포스)로 선택
    //   → MCV를 쓰면 중앙 한 가지 배열에 일찍 수렴해 되돌아오기 힘들어짐
    // Phase 2: 중앙이 덮이면 크리티컬 우선 + MCV로 최적 분기
    function chooseNextCell(): number {
      const unresolvedCenter = [...centerCellSet].filter(i => remaining[i])
      if (unresolvedCenter.length > 0) {
        // Phase 1: 스캔 순서 (위→아래, 왼→오른) — 브루트포스
        return unresolvedCenter.sort((a, b) => {
          const ca = indexToCell[a], cb = indexToCell[b]
          return ca.y - cb.y || ca.x - cb.x
        })[0]
      }

      // Phase 2: MCV — 크리티컬 셀 우선, 그 중 옵션 최소 셀 선택
      const unresolvedCritical = [...criticalCellSet].filter(i => remaining[i] && !centerCellSet.has(i))
      const candidates = unresolvedCritical.length > 0
        ? unresolvedCritical
        : remaining.flatMap((v, i) => v ? [i] : [])

      let bestCell = -1, bestOptionCount = Infinity, bestDegree = Infinity
      for (const ci of candidates) {
        let optionCount = 0
        for (const pIdx of placementsByCell[ci]) {
          const p = placements[pIdx]
          if (inventoryCounts[p.inventoryIndex] <= 0) continue
          if (p.cellIndices.every(i => remaining[i])) optionCount++
        }
        if (optionCount < bestOptionCount ||
            (optionCount === bestOptionCount && degreeByCell[ci] < bestDegree)) {
          bestOptionCount = optionCount
          bestDegree = degreeByCell[ci]
          bestCell = ci
          if (bestOptionCount <= 1) break
        }
      }
      return bestCell
    }

    function stateKey(nextCell: number): string {
      const bits: string[] = []
      for (let offset = 0; offset < remaining.length; offset += 32) {
        let b = 0
        for (let bit = 0; bit < 32 && offset + bit < remaining.length; bit++) {
          if (remaining[offset + bit]) b |= (1 << bit)
        }
        bits.push(b.toString(36))
      }
      return `${variant}|${nextCell}|${bits.join('.')}|${inventoryCounts.join(',')}`
    }

    function search(): boolean {
      if (budget.steps <= 0) return best.remainingTiles === 0
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

      const inCenterPhase = centerCellSet.has(nextCell)
      const options = placementsByCell[nextCell]
        .map(i => placements[i])
        .filter(p =>
          inventoryCounts[p.inventoryIndex] > 0 &&
          p.cellIndices.every(i => remaining[i])
        )
        .sort((a, b) => {
          // Phase 1(중앙): 중앙 셀을 많이 덮는 큰 조각 우선 (브루트포스 효과)
          if (inCenterPhase) {
            if (b.centerCount !== a.centerCount) return b.centerCount - a.centerCount
            return b.cellIndices.length - a.cellIndices.length
          }
          // Phase 2(MCV): 크리티컬 많이 덮는 것 → 큰 조각 → inventory index 순
          if (b.criticalCount !== a.criticalCount) return b.criticalCount - a.criticalCount
          if (b.cellIndices.length !== a.cellIndices.length) return b.cellIndices.length - a.cellIndices.length
          return a.inventoryIndex - b.inventoryIndex
        })

      for (const p of options) {
        budget.steps--
        inventoryCounts[p.inventoryIndex] -= 1
        p.cellIndices.forEach(i => { remaining[i] = false })
        current.push(p)
        if (search()) return true
        current.pop()
        p.cellIndices.forEach(i => { remaining[i] = true })
        inventoryCounts[p.inventoryIndex] += 1
      }
      return false
    }

    search()
    return best
  }

  // ── 4방향 변환 순차 탐색 (빠른 해를 먼저 찾기 위한 다양성 확보) ─────────────
  // 보드를 뒤집어서 탐색하면 다른 경로로 빠른 해를 찾을 수 있음.
  // 어느 방향이든 완전 해를 발견하면 즉시 반환.
  // budget은 모든 variant가 공유 — 합산 스텝 한도를 초과하면 중단.
  const budget = { steps: MAX_STEPS }
  let best = solveVariant('identity', budget)
  if (!best.success) {
    for (const variant of ['flip-x', 'flip-y', 'flip-both'] as const) {
      if (budget.steps <= 0) break
      const candidate = solveVariant(variant, budget)
      if (
        candidate.remainingTiles < best.remainingTiles ||
        (candidate.remainingTiles === best.remainingTiles && candidate.usedTiles > best.usedTiles)
      ) {
        best = candidate
      }
      if (best.success) break
    }
  }

  return best
}

class SolverPoint {
  constructor(
    public x: number,
    public y: number,
    public isMiddle = false
  ) {}
}

class SolverPiece {
  static nextId = 1
  private _cellCount?: number
  private _pointShape?: SolverPoint[]
  private _offCenter?: number
  private _transformations?: SolverPiece[]
  private _restrictedTransformations?: SolverPiece[]

  constructor(
    public shape: number[][],
    public amount: number,
    public id: number,
    public meta: Omit<SolvedPlacement, 'cells'>
  ) {}

  static create(shape: number[][], amount: number, meta: Omit<SolvedPlacement, 'cells'>) {
    return new SolverPiece(shape, amount, this.nextId++, meta)
  }

  get cellCount(): number {
    if (this._cellCount !== undefined) return this._cellCount
    let count = 0
    for (let row = 0; row < this.shape.length; row++) {
      for (let col = 0; col < this.shape[row].length; col++) {
        if (this.shape[row][col] > 0) count++
      }
    }
    this._cellCount = count
    return count
  }

  get pointShape(): SolverPoint[] {
    if (this._pointShape) return this._pointShape
    const points: SolverPoint[] = []
    for (let row = 0; row < this.shape.length; row++) {
      for (let col = 0; col < this.shape[row].length; col++) {
        if (this.shape[row][col] === 1) points.push(new SolverPoint(col, row, false))
        if (this.shape[row][col] === 2) points.push(new SolverPoint(col, row, true))
      }
    }
    this._pointShape = points
    return points
  }

  get offCenter(): number {
    if (this._offCenter !== undefined) return this._offCenter
    for (let col = 0; col < this.shape[0].length; col++) {
      if (this.shape[0][col] !== 0) {
        this._offCenter = col
        return col
      }
    }
    this._offCenter = 0
    return 0
  }

  get transformations(): SolverPiece[] {
    if (this._transformations) return this._transformations
    const seen = new Set<string>()
    const transforms: SolverPiece[] = []
    let shape = this.shape.map(row => [...row])

    for (let flip = 0; flip < 2; flip++) {
      for (let rotation = 0; rotation < 4; rotation++) {
        const key = shape.map(row => row.join(',')).join(';')
        if (!seen.has(key)) {
          seen.add(key)
          transforms.push(new SolverPiece(shape.map(row => [...row]), this.amount, this.id, this.meta))
        }

        const rotated = new Array(shape[0].length).fill(0).map(() => new Array(shape.length).fill(0))
        for (let row = 0; row < shape.length; row++) {
          for (let col = 0; col < shape[0].length; col++) {
            if (shape[row][col] !== 0) rotated[shape[0].length - 1 - col][row] = shape[row][col]
          }
        }
        shape = rotated
      }

      const flipped = new Array(shape.length).fill(0).map(() => new Array(shape[0].length).fill(0))
      for (let row = 0; row < shape.length; row++) {
        for (let col = 0; col < shape[0].length; col++) {
          if (shape[row][col] !== 0) flipped[shape.length - 1 - row][col] = shape[row][col]
        }
      }
      shape = flipped
    }

    this._transformations = transforms
    return transforms
  }

  get restrictedTransformations(): SolverPiece[] {
    if (this._restrictedTransformations) return this._restrictedTransformations
    this._restrictedTransformations = this.transformations.filter(piece => !piece.shape[0][1 + piece.offCenter])
    return this._restrictedTransformations
  }
}

class RestrictedSolverPoint extends SolverPoint {
  constructor(x: number, y: number, public spotsFilled: number) {
    super(x, y)
  }
}

class PortedLegionSolver {
  board: number[][]
  pieces: SolverPiece[]
  pieceLength: number
  valid = true
  pieceNumber = 0
  transformationNumber = 0
  restrictedPieceNumber = 0
  restrictedTransformationNumber = 0
  directionFree = 0
  success: boolean | undefined
  shouldStop = false
  iterations = 0
  time = Date.now()
  history: SolverPoint[][] = []
  middle: SolverPoint[] = []
  emptySpots: SolverPoint[] = []
  restrictedSpots: RestrictedSolverPoint[] = []
  longSpaces: SolverPoint[] = []
  firstAlgorithm: boolean

  constructor(board: number[][], pieces: SolverPiece[]) {
    this.board = board
    this.pieces = pieces
    this.pieceLength = pieces.length

    for (let row = this.board.length / 2 - 1; row < this.board.length / 2 + 1; row++) {
      for (let col = this.board[0].length / 2 - 1; col < this.board[0].length / 2 + 1; col++) {
        if (this.board[row][col] !== -1) this.middle.push(new SolverPoint(col, row))
      }
    }

    for (let row = 0; row < this.board.length; row++) {
      for (let col = 0; col < this.board[0].length; col++) {
        if (this.board[row][col] === 0) this.emptySpots.push(new SolverPoint(col, row))
        this.searchSurroundings(col, row)
      }
    }

    for (let row = 0; row < this.board.length; row++) {
      for (let col = 0; col < this.board[0].length; col++) {
        const kind = this.checkLongSpace(col, row)
        if (kind === 'horizontal' || kind === 'vertical') this.longSpaces.push(new SolverPoint(col, row))
      }
    }

    this.firstAlgorithm = this.longSpaces.length > 0
  }

  solve(): boolean {
    this.pieces.sort((a, b) => b.amount * b.cellCount - a.amount * a.cellCount)
    this.pieces.push(new SolverPiece([[]], 0, -1, {
      inventoryKey: '__sentinel__',
      label: '',
      classType: 'warrior',
      grade: 'B',
    }))
    this.restrictedSpots.sort((a, b) => b.spotsFilled - a.spotsFilled)
    this.success = this.solveInternal()
    return this.success
  }

  solveInternal(): boolean {
    const stack: Array<[number, number, number, RestrictedSolverPoint[], SolverPoint, number, number, number, SolverPoint[], number, boolean]> = []
    let position = 0

    while (this.pieces[0].amount > 0 || !this.valid) {
      if (this.shouldStop) return false

      if (this.valid && this.restrictedSpots.length !== 0 && this.pieces[this.restrictedPieceNumber].amount && this.directionFree !== 5 && !this.firstAlgorithm) {
        if (this.restrictedPieceNumber !== this.pieceLength) {
          const point = this.restrictedSpots[0]
          const piece = this.pieces[this.restrictedPieceNumber].restrictedTransformations[this.restrictedTransformationNumber]
          this.determineDirectionFree(point)
          if (this.isPlaceable(point, piece)) {
            stack.push([0, 0, this.takeFromList(this.restrictedPieceNumber), [...this.restrictedSpots], point, this.restrictedPieceNumber, this.restrictedTransformationNumber, this.directionFree, [], 0, this.valid])
            this.restrictedSpots.splice(0, 1)
            this.placePiece(point, piece)
            this.isValid()
            this.restrictedPieceNumber = 0
            this.restrictedTransformationNumber = 0
          } else {
            this.changeIndex(true)
          }
        }
      } else if (this.valid && this.pieces[this.pieceNumber].amount && (this.firstAlgorithm || this.restrictedSpots.length === 0) && this.directionFree !== 5) {
        this.directionFree = 0
        if (!this.firstAlgorithm) {
          position = 0
          while (position < this.emptySpots.length && this.board[this.emptySpots[position].y][this.emptySpots[position].x] !== 0) position++
        }
        if (position === this.emptySpots.length) return true
        const point = this.emptySpots[position]
        const piece = this.pieces[this.pieceNumber].transformations[this.transformationNumber]
        if (this.isPlaceable(point, piece)) {
          stack.push([this.pieceNumber, this.transformationNumber, this.takeFromList(this.pieceNumber), [...this.restrictedSpots], point, 0, 0, 0, [...this.longSpaces], position, this.valid])
          this.placePiece(point, piece)
          this.isValid()
          if (this.firstAlgorithm) {
            while (position < this.emptySpots.length && this.board[this.emptySpots[position].y][this.emptySpots[position].x] !== 0) position++
            if (position === this.emptySpots.length) return true
          }
          this.pieceNumber = 0
          this.transformationNumber = 0
        } else {
          this.changeIndex(false)
        }
      } else {
        if (stack.length === 0) return false
        if (!this.valid) this.valid = true

        const [pieceNumber, transformationNumber, spotsMoved, restrictedSpots, point, restrictedPieceNumber, restrictedTransformationNumber, directionFree, longSpaces, restorePosition, valid] = stack.pop()!
        this.pieceNumber = pieceNumber
        this.transformationNumber = transformationNumber
        this.restrictedSpots = restrictedSpots
        this.restrictedPieceNumber = restrictedPieceNumber
        this.restrictedTransformationNumber = restrictedTransformationNumber
        this.directionFree = directionFree
        this.longSpaces = longSpaces
        position = restorePosition
        this.valid = valid

        if (this.directionFree === 0) {
          this.returnToList(this.pieceNumber, spotsMoved)
          this.takeBackPiece(point, this.pieces[this.pieceNumber].transformations[this.transformationNumber])
        } else {
          this.returnToList(this.restrictedPieceNumber, spotsMoved)
          this.takeBackPiece(point, this.pieces[this.restrictedPieceNumber].restrictedTransformations[this.restrictedTransformationNumber])
        }

        this.firstAlgorithm = this.longSpaces.length !== 0
        this.changeIndex(!this.firstAlgorithm && this.restrictedSpots.length !== 0)
      }

      this.iterations++
    }

    return true
  }

  takeFromList(index: number): number {
    this.pieces[index].amount--
    const piece = this.pieces[index]
    let next = index + 1
    while (next < this.pieces.length && piece.amount * piece.cellCount < this.pieces[next].amount * this.pieces[next].cellCount) next++
    this.pieces[index] = this.pieces[next - 1]
    this.pieces[next - 1] = piece
    return next - 1 - index
  }

  returnToList(index: number, spotsMoved: number) {
    const piece = this.pieces[index]
    this.pieces[index] = this.pieces[index + spotsMoved]
    this.pieces[index + spotsMoved] = piece
    this.pieces[index].amount++
  }

  isValid() {
    if (this.middle.length === 0) return
    let normalPieces = 0
    for (const point of this.middle) {
      const value = this.board[point.y][point.x]
      if (value > 0 && value <= this.pieceLength) normalPieces++
    }
    this.valid = normalPieces !== this.middle.length
  }

  isPlaceable(position: SolverPoint, piece?: SolverPiece): boolean {
    if (!piece) return false
    for (const point of piece.pointShape) {
      const [x, y] = this.determinePoint(position, piece, point)
      if (y >= this.board.length || y < 0 || x >= this.board[0].length || x < 0 || this.board[y][x] !== 0) return false
    }
    return true
  }

  placePiece(position: SolverPoint, piece: SolverPiece) {
    const realPoints: SolverPoint[] = []
    this.history.push([])
    for (const point of piece.pointShape) {
      const [x, y] = this.determinePoint(position, piece, point)
      this.board[y][x] = point.isMiddle ? piece.id + 18 : piece.id
      realPoints.push(new SolverPoint(x, y))
      this.history[this.history.length - 1].push(new SolverPoint(x, y))
      this.restrictedSpots = this.restrictedSpots.filter(item => item.x !== x || item.y !== y)
      this.longSpaces = this.longSpaces.filter(item => item.x !== x || item.y !== y)
      if (this.longSpaces.length === 0) this.firstAlgorithm = false
    }

    for (const point of realPoints) {
      this.searchSurroundings(point.x, point.y + 1)
      this.searchSurroundings(point.x, point.y - 1)
      this.searchSurroundings(point.x + 1, point.y)
      this.searchSurroundings(point.x - 1, point.y)
    }

    const deduped = new Map<string, RestrictedSolverPoint>()
    for (const point of this.restrictedSpots) deduped.set(`${point.x},${point.y}`, point)
    this.restrictedSpots = [...deduped.values()].sort((a, b) => b.spotsFilled - a.spotsFilled)
  }

  takeBackPiece(position: SolverPoint, piece?: SolverPiece) {
    if (!piece) return
    this.history.pop()
    for (const point of piece.pointShape) {
      const [x, y] = this.determinePoint(position, piece, point)
      this.board[y][x] = 0
    }
  }

  searchSurroundings(x: number, y: number) {
    let restrictedSpaces = 0
    if (this.board[y]?.[x] === 0) {
      if (this.board[y + 1]?.[x] === 0) restrictedSpaces++
      if (this.board[y - 1]?.[x] === 0) restrictedSpaces++
      if (this.board[y]?.[x + 1] === 0) restrictedSpaces++
      if (this.board[y]?.[x - 1] === 0) restrictedSpaces++
      if (restrictedSpaces <= 1) this.restrictedSpots.push(new RestrictedSolverPoint(x, y, 4 - restrictedSpaces))
    }
  }

  checkLongSpace(x: number, y: number): 'horizontal' | 'vertical' | undefined {
    if (this.board[y + 1]?.[x] === 0 && this.board[y - 1]?.[x] === 0 && this.board[y]?.[x + 1] !== 0 && this.board[y]?.[x - 1] !== 0) return 'vertical'
    if (this.board[y + 1]?.[x] !== 0 && this.board[y - 1]?.[x] !== 0 && this.board[y]?.[x + 1] === 0 && this.board[y]?.[x - 1] === 0) return 'horizontal'
    return undefined
  }

  changeIndex(restricted: boolean) {
    if (restricted) {
      if (this.restrictedTransformationNumber < this.pieces[this.restrictedPieceNumber].restrictedTransformations.length - 1) this.restrictedTransformationNumber++
      else {
        this.restrictedPieceNumber++
        this.restrictedTransformationNumber = 0
      }
      return
    }

    if (this.transformationNumber < this.pieces[this.pieceNumber].transformations.length - 1) this.transformationNumber++
    else {
      this.pieceNumber++
      this.transformationNumber = 0
    }
  }

  determineDirectionFree(point: SolverPoint) {
    if (this.board[point.y - 1]?.[point.x] === 0) this.directionFree = 1
    else if (this.board[point.y]?.[point.x + 1] === 0) this.directionFree = 2
    else if (this.board[point.y + 1]?.[point.x] === 0) this.directionFree = 3
    else if (this.board[point.y]?.[point.x - 1] === 0) this.directionFree = 4
    else this.directionFree = 5
  }

  determinePoint(position: SolverPoint, piece: SolverPiece, point: SolverPoint): [number, number] {
    if (this.directionFree === 0 || this.directionFree === 3 || this.directionFree === 5) {
      return [position.x + point.x - piece.offCenter, position.y + point.y]
    }
    if (this.directionFree === 1) {
      return [position.x - point.x + piece.offCenter, position.y - point.y]
    }
    if (this.directionFree === 2) {
      return [position.x + point.y, position.y + point.x - piece.offCenter]
    }
    return [position.x - point.y, position.y - point.x + piece.offCenter]
  }
}

function rotateBoardRight(board: number[][]): number[][] {
  const rotated: number[][] = []
  for (let row = 0; row < board[0].length; row++) {
    rotated[row] = []
    for (let col = 0; col < board.length; col++) rotated[row][col] = board[board.length - 1 - col][row]
  }
  return rotated
}

function rotateBoard180(board: number[][]): number[][] {
  const rotated: number[][] = []
  for (let row = 0; row < board.length; row++) {
    rotated[row] = []
    for (let col = 0; col < board[0].length; col++) rotated[row][col] = board[board.length - 1 - row][board[0].length - 1 - col]
  }
  return rotated
}

function rotateBoardLeft(board: number[][]): number[][] {
  const rotated: number[][] = []
  for (let row = 0; row < board[0].length; row++) {
    rotated[row] = []
    for (let col = 0; col < board.length; col++) rotated[row][col] = board[col][board[0].length - 1 - row]
  }
  return rotated
}

function unrotatePoint(point: SolverPoint, variant: number): SolverPoint {
  if (variant === 1) return new SolverPoint(point.y, BOARD_COLS - 1 - point.x)
  if (variant === 2) return new SolverPoint(BOARD_COLS - 1 - point.x, BOARD_ROWS - 1 - point.y)
  if (variant === 3) return new SolverPoint(BOARD_ROWS - 1 - point.y, point.x)
  return new SolverPoint(point.x, point.y)
}

function createSolverPieces(inventoryEntries: PieceInventoryEntry[]): SolverPiece[] {
  SolverPiece.nextId = 1
  return inventoryEntries.map(item =>
    SolverPiece.create(item.shapeMatrix.map(row => [...row]), item.count, {
      inventoryKey: item.key,
      label: item.label,
      classType: item.classType,
      grade: item.grade,
    })
  )
}

function convertSelectionBoard(selectedCells: Cell[]): number[][] {
  const board = Array.from({ length: BOARD_ROWS }, () => Array.from({ length: BOARD_COLS }, () => -1))
  for (const cell of selectedCells) board[cell.y][cell.x] = 0
  return board
}

function solveWithPortedSolver(selectedCells: Cell[], inventoryEntries: PieceInventoryEntry[]): SelectionSolution {
  const startedAt = Date.now()
  if (selectedCells.length === 0) return { placements: [], usedTiles: 0, remainingTiles: 0, success: true, iterations: 0, elapsedMs: 0 }

  const baseBoard = convertSelectionBoard(selectedCells)
  const solvers = [new PortedLegionSolver(baseBoard, createSolverPieces(inventoryEntries))]
  if (solvers[0].longSpaces.length !== 0) {
    solvers.push(new PortedLegionSolver(rotateBoardRight(baseBoard), createSolverPieces(inventoryEntries)))
    solvers.push(new PortedLegionSolver(rotateBoard180(baseBoard), createSolverPieces(inventoryEntries)))
    solvers.push(new PortedLegionSolver(rotateBoardLeft(baseBoard), createSolverPieces(inventoryEntries)))
  }

  let bestSolver: PortedLegionSolver | null = null
  let bestVariant = 0
  for (let i = 0; i < solvers.length; i++) {
    const success = solvers[i].solve()
    if (success) {
      bestSolver = solvers[i]
      bestVariant = i
      break
    }
    if (!bestSolver || solvers[i].iterations > bestSolver.iterations) {
      bestSolver = solvers[i]
      bestVariant = i
    }
  }

  const placements = (bestSolver?.history ?? []).map((piece, index) => {
    const sample = bestSolver!.board[piece[0].y][piece[0].x]
    const pieceId = sample > 18 ? sample - 18 : sample
    const meta = bestSolver!.pieces.find(item => item.id === pieceId)?.meta ?? {
      inventoryKey: `unknown:${index}`,
      label: '알 수 없음',
      classType: 'warrior' as ClassType,
      grade: 'B' as UnionBlockGrade,
    }
    return {
      ...meta,
      cells: piece.map(point => {
        const restored = unrotatePoint(point, bestVariant)
        return { x: restored.x, y: restored.y }
      }),
    }
  })

  const usedTiles = placements.reduce((sum, placement) => sum + placement.cells.length, 0)
  const remainingTiles = Math.max(0, selectedCells.length - usedTiles)
  const iterations = solvers.reduce((sum, solver) => sum + solver.iterations, 0)

  return {
    placements,
    usedTiles,
    remainingTiles,
    success: bestSolver?.success === true && remainingTiles === 0,
    iterations,
    elapsedMs: Date.now() - startedAt,
  }
}

export function solveSelectedCells(selectedCells: Cell[], inventoryEntries: PieceInventoryEntry[]): SelectionSolution {
  return solveWithPortedSolver(selectedCells, inventoryEntries)
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
