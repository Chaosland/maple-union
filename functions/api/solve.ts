// ── 타입 정의 ─────────────────────────────────────────────────────────────────

type ClassType = 'warrior' | 'mage' | 'archer' | 'thief' | 'pirate'
type UnionBlockGrade = 'B' | 'A' | 'S' | 'SS' | 'SSS'

interface Cell {
  x: number
  y: number
}

interface PieceInventoryEntry {
  key: string
  label: string
  categoryLabel: string
  classType: ClassType
  grade: UnionBlockGrade
  cells: Cell[]
  shapeMatrix: number[][]
  count: number
}

interface SolvedPlacement {
  inventoryKey: string
  label: string
  classType: ClassType
  grade: UnionBlockGrade
  cells: Cell[]
}

interface SelectionSolution {
  placements: SolvedPlacement[]
  usedTiles: number
  remainingTiles: number
  success: boolean
  iterations: number
  elapsedMs: number
}

// ── 보드 상수 ─────────────────────────────────────────────────────────────────

const BOARD_COLS = 22
const BOARD_ROWS = 20

// ── 변환 헬퍼 ─────────────────────────────────────────────────────────────────

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

function getShapeTransforms(cells: Cell[]): Cell[][] {
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

// ── 중앙 십자 판정 ────────────────────────────────────────────────────────────

function isCenterCrossCell(row: number, col: number): boolean {
  return row === 9 || row === 10 || col === 10 || col === 11
}

// ── PortedLegionSolver (원본 솔버 포팅) ───────────────────────────────────────

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

const MAX_STEPS = 600_000

function solveSelectionExact(selectedCells: Cell[], inventoryEntries: PieceInventoryEntry[]): SelectionSolution {
  if (selectedCells.length === 0) {
    return { placements: [], usedTiles: 0, remainingTiles: 0, success: true, iterations: 0, elapsedMs: 0 }
  }

  type Variant = 'identity' | 'flip-x' | 'flip-y' | 'flip-both'
  type IndexedPlacement = {
    inventoryIndex: number
    cellIndices: number[]
    criticalCount: number
    centerCount: number
    placement: SolvedPlacement
  }

  function transformCell(cell: Cell, variant: Variant): Cell {
    switch (variant) {
      case 'flip-x': return { x: BOARD_COLS - 1 - cell.x, y: cell.y }
      case 'flip-y': return { x: cell.x, y: BOARD_ROWS - 1 - cell.y }
      case 'flip-both': return { x: BOARD_COLS - 1 - cell.x, y: BOARD_ROWS - 1 - cell.y }
      default: return cell
    }
  }
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
    const degreeByCell = new Array<number>(transformedSelected.length).fill(0)
    transformedSelected.forEach((cell, index) => {
      degreeByCell[index] = [
        `${cell.x + 1},${cell.y}`, `${cell.x - 1},${cell.y}`,
        `${cell.x},${cell.y + 1}`, `${cell.x},${cell.y - 1}`,
      ].filter(k => selectedSet.has(k)).length
    })

    const centerCellSet = new Set<number>(
      transformedSelected.flatMap((cell, index) =>
        isCenterCrossCell(cell.y, cell.x) ? [index] : []
      )
    )

    const criticalCellSet = new Set<number>(
      transformedSelected.flatMap((cell, index) =>
        isCenterCrossCell(cell.y, cell.x) || degreeByCell[index] <= 2 ? [index] : []
      )
    )

    const placements: IndexedPlacement[] = []
    const placementsByCell = Array.from({ length: transformedSelected.length }, () => [] as number[])

    inventoryEntries.forEach((item, inventoryIndex) => {
      const seen = new Set<string>()
      for (const transform of getShapeTransforms(item.cells)) {
        for (const anchorKey of cellKeyToIndex.keys()) {
          const [anchorX, anchorY] = anchorKey.split(',').map(Number)
          for (const pivot of transform) {
            const dx = anchorX - pivot.x
            const dy = anchorY - pivot.y
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
              centerCount: indices.filter(i => centerCellSet.has(i)).length,
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

    const remaining = new Array<boolean>(transformedSelected.length).fill(true)
    const inventoryCounts = inventoryEntries.map(item => item.count)
    const current: IndexedPlacement[] = []
    let iterations = 0
    let best: SelectionSolution = {
      placements: [],
      usedTiles: 0,
      remainingTiles: transformedSelected.length,
      success: false,
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
          usedTiles,
          remainingTiles,
          success: remainingTiles === 0,
          iterations,
          elapsedMs: 0,
        }
      }
    }

    function chooseNextCell(): number {
      const unresolvedCenter = [...centerCellSet].filter(i => remaining[i])
      if (unresolvedCenter.length > 0) {
        return unresolvedCenter.sort((a, b) => {
          const ca = indexToCell[a]
          const cb = indexToCell[b]
          return ca.y - cb.y || ca.x - cb.x
        })[0]
      }

      const unresolvedCritical = [...criticalCellSet].filter(i => remaining[i] && !centerCellSet.has(i))
      const candidates = unresolvedCritical.length > 0
        ? unresolvedCritical
        : remaining.flatMap((v, i) => (v ? [i] : []))

      let bestCell = -1
      let bestOptionCount = Infinity
      let bestDegree = Infinity
      for (const ci of candidates) {
        let optionCount = 0
        for (const pIdx of placementsByCell[ci]) {
          const p = placements[pIdx]
          if (inventoryCounts[p.inventoryIndex] <= 0) continue
          if (p.cellIndices.every(i => remaining[i])) optionCount++
        }
        if (optionCount < bestOptionCount || (optionCount === bestOptionCount && degreeByCell[ci] < bestDegree)) {
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
      iterations++
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
        .filter(p => inventoryCounts[p.inventoryIndex] > 0 && p.cellIndices.every(i => remaining[i]))
        .sort((a, b) => {
          if (inCenterPhase) {
            if (b.centerCount !== a.centerCount) return b.centerCount - a.centerCount
            return b.cellIndices.length - a.cellIndices.length
          }
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

  const startedAt = Date.now()
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
  best.elapsedMs = Date.now() - startedAt
  return best
}

function solveSelectedCells(selectedCells: Cell[], inventoryEntries: PieceInventoryEntry[]): SelectionSolution {
  const ported = solveWithPortedSolver(selectedCells, inventoryEntries)
  if (ported.success) return ported

  const exact = solveSelectionExact(selectedCells, inventoryEntries)
  if (exact.success) return exact

  if (
    exact.remainingTiles < ported.remainingTiles ||
    (exact.remainingTiles === ported.remainingTiles && exact.usedTiles > ported.usedTiles)
  ) {
    return exact
  }
  return ported
}

// ── Cloudflare Pages Function ─────────────────────────────────────────────────

export const onRequestPost: PagesFunction = async (context) => {
  const body = await context.request.json() as { selectedCells: Cell[]; inventoryEntries: PieceInventoryEntry[] }
  const result = solveSelectedCells(body.selectedCells, body.inventoryEntries)
  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' }
  })
}
