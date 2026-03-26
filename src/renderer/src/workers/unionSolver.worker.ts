import { PieceInventoryEntry, SelectionSolution, solveSelectedCells, Cell } from '../utils/unionAutoPlacer'

type SolveRequest = {
  selectedCells: Cell[]
  inventoryEntries: PieceInventoryEntry[]
}

self.onmessage = (event: MessageEvent<SolveRequest>) => {
  const result: SelectionSolution = solveSelectedCells(event.data.selectedCells, event.data.inventoryEntries)
  self.postMessage(result)
}
