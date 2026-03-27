// ─── 캐릭터 ───────────────────────────────────────────────────────────────────

export interface Character {
  ocid: string
  character_name: string
  world_name: string
  character_class: string
  character_level: number
  character_image?: string
}

export interface SavedCharacter extends Character {
  addedAt: number
  accountIndex: number
}

// ─── 유니온 ───────────────────────────────────────────────────────────────────

export interface UnionInfo {
  date?: string
  union_level: number
  union_grade: string
  union_artifact_level?: number
  union_artifact_exp?: number
  union_artifact_point?: number
}

export interface UnionBlockPosition {
  x: number
  y: number
}

export interface UnionBlock {
  block_type: string   // '전사' | '마법사' | '궁수' | '도적' | '해적'
  block_class: string
  block_level: string
  block_control_point?: UnionBlockPosition
  block_position: UnionBlockPosition[]
}

export interface UnionInnerStat {
  stat_field_id: string
  stat_field_effect: string
}

/** 실제 Nexon API /maplestory/v1/user/union-raider 응답 */
export interface UnionRaider {
  date?: string
  union_raider_block:       UnionBlock[]      // 현재 배치된 블록
  union_raider_block_total: UnionBlock[]      // 보유한 전체 블록
  union_occupied_stat:      UnionInnerStat[]  // 점령 효과 스탯
  union_inner_stat:         UnionInnerStat[]  // 내부 스탯
  use_preset_no: number
  union_block_count: number
}

// ─── 유니온 직업 유틸리티 ─────────────────────────────────────────────────────

export type ClassType = 'warrior' | 'mage' | 'archer' | 'thief' | 'pirate'

export const CLASS_TYPE_COLORS: Record<ClassType, string> = {
  warrior: '#e53935',
  mage:    '#1565c0',
  archer:  '#388e3c',
  thief:   '#7b1fa2',
  pirate:  '#f57f17'
}

export const BLOCK_TYPE_MAP: Record<string, ClassType> = {
  '전사': 'warrior',
  '마법사': 'mage',
  '궁수': 'archer',
  '도적': 'thief',
  '해적': 'pirate'
}

export const UNION_GRADE_COLORS: Record<string, string> = {
  '시드':         '#8b4513',
  '브론즈':       '#cd7f32',
  '실버':         '#c0c0c0',
  '골드':         '#ffd700',
  '플래티넘':     '#00ced1',
  '다이아몬드':   '#00bfff',
  '마스터':       '#9370db',
  '그랜드마스터': '#ff4500',
  '유니온의 전설':'#ff1493'
}
