import {
  Cell,
  PieceInventoryEntry,
  SelectionSolution,
  SolverVariant,
  solveSelectedCells,
  solveSelectedCellsVariant,
} from '../utils/unionAutoPlacer'

type SolveRequest = {
  selectedCells: Cell[]
  inventoryEntries: PieceInventoryEntry[]
  variant?: SolverVariant
}

self.onmessage = (event: MessageEvent<SolveRequest>) => {
  const { selectedCells, inventoryEntries, variant } = event.data
  const result: SelectionSolution = typeof variant === 'number'
    ? solveSelectedCellsVariant(selectedCells, inventoryEntries, variant)
    : solveSelectedCells(selectedCells, inventoryEntries)
  self.postMessage(result)
}
