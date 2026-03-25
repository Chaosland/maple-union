export interface GradeStep {
  grade: string
  step: number
  minLevel: number
  slots: number
}

export const UNION_GRADE_TABLE: GradeStep[] = [
  { grade: '노비스',       step: 1, minLevel:   500, slots:  9 },
  { grade: '노비스',       step: 2, minLevel:  1000, slots: 10 },
  { grade: '노비스',       step: 3, minLevel:  1500, slots: 11 },
  { grade: '노비스',       step: 4, minLevel:  2000, slots: 12 },
  { grade: '노비스',       step: 5, minLevel:  2500, slots: 13 },
  { grade: '베테랑',       step: 1, minLevel:  3000, slots: 18 },
  { grade: '베테랑',       step: 2, minLevel:  3500, slots: 19 },
  { grade: '베테랑',       step: 3, minLevel:  4000, slots: 20 },
  { grade: '베테랑',       step: 4, minLevel:  4500, slots: 21 },
  { grade: '베테랑',       step: 5, minLevel:  5000, slots: 22 },
  { grade: '마스터',       step: 1, minLevel:  5500, slots: 27 },
  { grade: '마스터',       step: 2, minLevel:  6000, slots: 28 },
  { grade: '마스터',       step: 3, minLevel:  6500, slots: 29 },
  { grade: '마스터',       step: 4, minLevel:  7000, slots: 30 },
  { grade: '마스터',       step: 5, minLevel:  7500, slots: 31 },
  { grade: '그랜드마스터', step: 1, minLevel:  8000, slots: 36 },
  { grade: '그랜드마스터', step: 2, minLevel:  8500, slots: 37 },
  { grade: '그랜드마스터', step: 3, minLevel:  9000, slots: 38 },
  { grade: '그랜드마스터', step: 4, minLevel:  9500, slots: 39 },
  { grade: '그랜드마스터', step: 5, minLevel: 10000, slots: 40 },
  { grade: '슈프림',       step: 1, minLevel: 10500, slots: 41 },
  { grade: '슈프림',       step: 2, minLevel: 11000, slots: 42 },
  { grade: '슈프림',       step: 3, minLevel: 11500, slots: 43 },
  { grade: '슈프림',       step: 4, minLevel: 12000, slots: 44 },
  { grade: '슈프림',       step: 5, minLevel: 12500, slots: 45 },
]

export const GRADE_COLORS: Record<string, string> = {
  '노비스':       '#9ca3af',
  '베테랑':       '#34d399',
  '마스터':       '#60a5fa',
  '그랜드마스터': '#a78bfa',
  '슈프림':       '#f59e0b',
}

/** 레벨 합산으로 현재 등급/단계 반환 (해당 없으면 null) */
export function getGradeStep(totalLevel: number): GradeStep | null {
  let result: GradeStep | null = null
  for (const g of UNION_GRADE_TABLE) {
    if (totalLevel >= g.minLevel) result = g
  }
  return result
}

/** 다음 단계 반환 */
export function getNextStep(current: GradeStep | null): GradeStep | null {
  if (!current) return UNION_GRADE_TABLE[0]
  const idx = UNION_GRADE_TABLE.findIndex(
    g => g.grade === current.grade && g.step === current.step
  )
  return idx < UNION_GRADE_TABLE.length - 1 ? UNION_GRADE_TABLE[idx + 1] : null
}

/** 현재 → 다음 단계 진행률 (0~1). 최고 단계면 1 */
export function getProgress(
  totalLevel: number,
  current: GradeStep | null,
  next: GradeStep | null
): number {
  if (!next) return 1
  const from = current ? current.minLevel : 0
  return Math.min(1, (totalLevel - from) / (next.minLevel - from))
}
