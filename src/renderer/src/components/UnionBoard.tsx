import { useEffect, useRef } from 'react'
import { UnionBlock, BLOCK_TYPE_MAP, CLASS_TYPE_COLORS } from '../types'

const RANGE = 9
const CELL = 14

export default function UnionBoard({ blocks }: { blocks: UnionBlock[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const size = RANGE * 2 + 1
  const px = size * CELL

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, px, px)

    // 배경 그리드
    for (let cx = -RANGE; cx <= RANGE; cx++) {
      for (let cy = -RANGE; cy <= RANGE; cy++) {
        const x = (cx + RANGE) * CELL
        const y = (-cy + RANGE) * CELL
        const isInner = Math.abs(cx) <= 4 && Math.abs(cy) <= 4
        ctx.fillStyle = isInner ? '#0f346088' : '#0a1a3a66'
        ctx.fillRect(x, y, CELL, CELL)
        ctx.strokeStyle = '#1a4a8a44'
        ctx.lineWidth = 0.5
        ctx.strokeRect(x, y, CELL, CELL)
      }
    }

    // 내부 영역 테두리
    ctx.strokeStyle = '#2a5a9a'
    ctx.lineWidth = 1.5
    ctx.strokeRect((-4 + RANGE) * CELL, (-4 + RANGE) * CELL, 9 * CELL, 9 * CELL)

    // 블록 채우기
    for (const block of blocks) {
      const ct = BLOCK_TYPE_MAP[block.block_type]
      const hex = ct ? CLASS_TYPE_COLORS[ct] : '#888888'
      for (const pos of block.block_position) {
        if (Math.abs(pos.x) > RANGE || Math.abs(pos.y) > RANGE) continue
        const x = (pos.x + RANGE) * CELL + 1
        const y = (-pos.y + RANGE) * CELL + 1
        const w = CELL - 2, h = CELL - 2
        ctx.fillStyle = hex + 'cc'
        ctx.beginPath()
        ctx.roundRect(x, y, w, h, 2)
        ctx.fill()
        ctx.strokeStyle = hex
        ctx.lineWidth = 1
        ctx.stroke()
      }
    }

    // 중심점
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.beginPath()
    ctx.arc(RANGE * CELL + CELL / 2, RANGE * CELL + CELL / 2, 2.5, 0, Math.PI * 2)
    ctx.fill()
  }, [blocks, px])

  const legend = Object.entries(CLASS_TYPE_COLORS) as [keyof typeof CLASS_TYPE_COLORS, string][]
  const labels: Record<string, string> = {
    warrior: '전사', mage: '마법사', archer: '궁수', thief: '도적', pirate: '해적'
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {/* 범례 */}
      <div className="flex flex-wrap justify-center gap-3">
        {legend.map(([type, color]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ background: color }} />
            <span className="text-muted text-xs">{labels[type]}</span>
          </div>
        ))}
      </div>
      {/* 보드 */}
      <canvas ref={canvasRef} width={px} height={px} className="rounded-lg" />
    </div>
  )
}
