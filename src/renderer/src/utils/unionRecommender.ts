import { Character, UnionBlock, UnionRaider } from '../types'
import {
  StatType, findClass, guessClassType, levelToTileCount, MAIN_CLASS_PRIORITY
} from './classData'

export interface RecommendedRaider {
  character: Character
  providedStats: StatType[]
  score: number
  tileCount: number
  reason: string
  isPlaced: boolean
}

export interface PlacementFeedback {
  block: UnionBlock
  score: number
  feedback: string
  isUseful: boolean
}

export interface UnionRecommendation {
  mainCharacterClass: string
  statPriority: StatType[]
  recommended: RecommendedRaider[]
  currentFeedback: PlacementFeedback[]
}

export function calcRecommendation(
  mainCharacterClass: string,
  allCharacters: Character[],
  currentRaider?: UnionRaider | null
): UnionRecommendation {
  const type = guessClassType(mainCharacterClass)
  const priority = MAIN_CLASS_PRIORITY[type] ?? MAIN_CLASS_PRIORITY.warrior

  const placedClasses = new Set(currentRaider?.union_raider_block.map(b => b.block_class) ?? [])

  const recommended: RecommendedRaider[] = allCharacters
    .filter(c => c.character_level >= 60)
    .map(c => {
      const cls = findClass(c.character_class)
      const stats = cls?.unionStats ?? inferStats(c.character_class)
      const tiles = levelToTileCount(c.character_level)
      const score = calcScore(stats, priority, tiles)
      return {
        character: c,
        providedStats: stats,
        score,
        tileCount: tiles,
        reason: buildReason(stats, priority, tiles, c.character_level),
        isPlaced: placedClasses.has(c.character_class) || placedClasses.has(c.character_name)
      }
    })
    .sort((a, b) => b.score - a.score)

  const currentFeedback: PlacementFeedback[] = (currentRaider?.union_raider_block ?? [])
    .map(block => {
      const cls = findClass(block.block_class)
      const stats = cls?.unionStats ?? inferStatsByBlockType(block.block_type)
      const tiles = levelToTileCount(parseInt(block.block_level) || 0)
      const score = calcScore(stats, priority, tiles)
      const matching = stats.filter(s => priority.includes(s))
      return {
        block,
        score,
        isUseful: matching.length > 0,
        feedback: matching.length > 0
          ? `유용 스탯: ${matching.join(', ')}`
          : '본캐에 직접적인 스탯 시너지 없음 — 교체 고려'
      }
    })
    .sort((a, b) => b.score - a.score)

  return { mainCharacterClass, statPriority: priority, recommended, currentFeedback }
}

function calcScore(stats: StatType[], priority: StatType[], tiles: number): number {
  let score = 0
  stats.forEach((stat, i) => {
    const pi = priority.indexOf(stat)
    if (pi >= 0) {
      score += (stats.length - i) * (priority.length - pi) * 2
    }
  })
  return score + tiles * 5
}

function buildReason(stats: StatType[], priority: StatType[], tiles: number, level: number): string {
  const matching = stats.filter(s => priority.includes(s))
  if (!matching.length) return '본캐에 유용한 스탯 없음'
  return `${matching.join(', ')} / 블록 ${tiles}칸 (Lv.${level})`
}

function inferStats(className: string): StatType[] {
  if (/나이트|블레이더|팬텀|어쌔신/.test(className)) return ['LUK', '크리티컬 확률', '공격력']
  if (/메이지|마법사|위자드|비숍/.test(className)) return ['INT', '마력', '최대 MP']
  if (/아처|헌터|슈터|레인저/.test(className)) return ['DEX', '공격력', '크리티컬 확률']
  return ['STR', '공격력', '최대 HP']
}

function inferStatsByBlockType(blockType: string): StatType[] {
  switch (blockType) {
    case '전사': return ['STR', '최대 HP', '공격력']
    case '마법사': return ['INT', '마력', '최대 MP']
    case '궁수': return ['DEX', '공격력', '크리티컬 확률']
    case '도적': return ['LUK', '크리티컬 확률', '공격력']
    case '해적': return ['STR', 'DEX', '공격력']
    default: return ['STR', '공격력', '최대 HP']
  }
}
