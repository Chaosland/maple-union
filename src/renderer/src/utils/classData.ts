import { ClassType } from '../types'

export type StatType =
  | 'STR' | 'DEX' | 'INT' | 'LUK'
  | '최대 HP' | '최대 MP'
  | '공격력' | '마력'
  | '크리티컬 확률' | '크리티컬 데미지'
  | '보스 몬스터 공격 시 데미지'
  | '방어율 무시'
  | '상태이상 내성'
  | '버프 지속시간'
  | '소환수 공격 데미지'
  | '보스 처치 시 획득 메소'

export interface MapleClass {
  name: string
  type: ClassType
  unionStats: StatType[]
}

export const ALL_CLASSES: MapleClass[] = [
  // 전사
  { name: '히어로',       type: 'warrior', unionStats: ['STR', '공격력', '최대 HP'] },
  { name: '팔라딘',       type: 'warrior', unionStats: ['STR', '최대 HP', '공격력'] },
  { name: '다크나이트',   type: 'warrior', unionStats: ['STR', '최대 HP', '보스 몬스터 공격 시 데미지'] },
  { name: '소울마스터',   type: 'warrior', unionStats: ['STR', '공격력', '크리티컬 데미지'] },
  { name: '미하일',       type: 'warrior', unionStats: ['STR', '최대 HP', '공격력'] },
  { name: '블래스터',     type: 'warrior', unionStats: ['STR', '공격력', '최대 HP'] },
  { name: '아델',         type: 'warrior', unionStats: ['STR', '공격력', '보스 몬스터 공격 시 데미지'] },
  { name: '카이저',       type: 'warrior', unionStats: ['STR', '최대 HP', '공격력'] },
  { name: '데몬슬레이어', type: 'warrior', unionStats: ['보스 몬스터 공격 시 데미지', '최대 HP', 'STR'] },
  { name: '데몬어벤저',   type: 'warrior', unionStats: ['최대 HP', '보스 몬스터 공격 시 데미지', 'STR'] },
  { name: '아란',         type: 'warrior', unionStats: ['STR', '최대 HP', '공격력'] },
  { name: '제로',         type: 'warrior', unionStats: ['STR', '공격력', '크리티컬 데미지'] },
  { name: '렌',           type: 'warrior', unionStats: ['STR', '공격력', '최대 HP'] },

  // 마법사
  { name: '아크메이지(불,독)', type: 'mage', unionStats: ['INT', '마력', '방어율 무시'] },
  { name: '아크메이지(썬,콜)', type: 'mage', unionStats: ['INT', '마력', '방어율 무시'] },
  { name: '비숍',         type: 'mage', unionStats: ['INT', '최대 MP', '버프 지속시간'] },
  { name: '배틀메이지',   type: 'mage', unionStats: ['INT', '마력', '최대 MP'] },
  { name: '에반',         type: 'mage', unionStats: ['INT', '마력', '최대 MP'] },
  { name: '루미너스',     type: 'mage', unionStats: ['INT', '마력', '방어율 무시'] },
  { name: '일리움',       type: 'mage', unionStats: ['INT', '마력', '크리티컬 데미지'] },
  { name: '키네시스',     type: 'mage', unionStats: ['INT', '마력', '크리티컬 확률'] },
  { name: '라라',         type: 'mage', unionStats: ['INT', '마력', '소환수 공격 데미지'] },
  { name: '플레임위자드', type: 'mage', unionStats: ['INT', '마력', '최대 MP'] },

  // 궁수
  { name: '보우마스터',   type: 'archer', unionStats: ['DEX', '공격력', '크리티컬 확률'] },
  { name: '신궁',         type: 'archer', unionStats: ['DEX', '크리티컬 데미지', '공격력'] },
  { name: '패스파인더',   type: 'archer', unionStats: ['DEX', '공격력', '방어율 무시'] },
  { name: '와일드헌터',   type: 'archer', unionStats: ['DEX', '공격력', '크리티컬 확률'] },
  { name: '윈드브레이커', type: 'archer', unionStats: ['DEX', '공격력', '크리티컬 확률'] },
  { name: '메르세데스',   type: 'archer', unionStats: ['DEX', '크리티컬 확률', '크리티컬 데미지'] },
  { name: '카인',         type: 'archer', unionStats: ['DEX', '공격력', '방어율 무시'] },

  // 도적
  { name: '나이트로드',   type: 'thief', unionStats: ['LUK', '크리티컬 확률', '크리티컬 데미지'] },
  { name: '섀도어',       type: 'thief', unionStats: ['LUK', '공격력', '보스 처치 시 획득 메소'] },
  { name: '듀얼블레이드', type: 'thief', unionStats: ['LUK', '크리티컬 확률', '공격력'] },
  { name: '팬텀',         type: 'thief', unionStats: ['LUK', '크리티컬 확률', '보스 처치 시 획득 메소'] },
  { name: '호영',         type: 'thief', unionStats: ['LUK', '공격력', '크리티컬 데미지'] },
  { name: '카데나',       type: 'thief', unionStats: ['LUK', '크리티컬 데미지', '공격력'] },
  { name: '칼리',         type: 'thief', unionStats: ['LUK', '공격력', '크리티컬 데미지'] },
  { name: '나이트워커',   type: 'thief', unionStats: ['LUK', '크리티컬 확률', '크리티컬 데미지'] },

  // 해적
  { name: '바이퍼',       type: 'pirate', unionStats: ['STR', '공격력', '최대 HP'] },
  { name: '캡틴',         type: 'pirate', unionStats: ['DEX', '공격력', '소환수 공격 데미지'] },
  { name: '캐논슈터',     type: 'pirate', unionStats: ['STR', '최대 HP', '공격력'] },
  { name: '스트라이커',   type: 'pirate', unionStats: ['STR', '공격력', '크리티컬 데미지'] },
  { name: '메카닉',       type: 'pirate', unionStats: ['DEX', '공격력', '소환수 공격 데미지'] },
  { name: '제논',         type: 'pirate', unionStats: ['STR', 'DEX', 'LUK'] },
  { name: '엔젤릭버스터', type: 'pirate', unionStats: ['DEX', '공격력', '크리티컬 확률'] },
  { name: '은월',         type: 'pirate', unionStats: ['STR', '공격력', '크리티컬 데미지'] },
  { name: '아크',         type: 'pirate', unionStats: ['STR', '공격력', '최대 HP'] },
]

const CLASS_NAME_ALIASES: Record<string, string> = {
  // 모험가 전사
  '검사': '히어로',
  '파이터': '히어로',
  '크루세이더': '히어로',
  '페이지': '팔라딘',
  '나이트': '팔라딘',
  '스피어맨': '다크나이트',
  '버서커(용기사)': '다크나이트',

  // 모험가 마법사
  '매지션': '아크메이지(불,독)',
  '위자드(불,독)': '아크메이지(불,독)',
  '메이지(불,독)': '아크메이지(불,독)',
  '아크메이지(얼,번)': '아크메이지(썬,콜)',
  '위자드(썬,콜)': '아크메이지(썬,콜)',
  '메이지(썬,콜)': '아크메이지(썬,콜)',
  '클레릭': '비숍',
  '프리스트': '비숍',

  // 모험가 궁수
  '아처': '보우마스터',
  '헌터': '보우마스터',
  '레인저': '보우마스터',
  '사수': '신궁',
  '저격수': '신궁',
  '아처(패스파인더)': '패스파인더',
  '에인션트 아처': '패스파인더',
  '체이서': '패스파인더',

  // 모험가 도적
  '로그': '나이트로드',
  '어쌔신': '나이트로드',
  '허밋': '나이트로드',
  '시프': '섀도어',
  '시프마스터': '섀도어',
  '듀얼블레이드': '듀얼블레이드',
  '세미듀어러': '듀얼블레이드',
  '듀어러': '듀얼블레이드',
  '듀얼마스터': '듀얼블레이드',
  '슬래셔': '듀얼블레이드',
  '듀얼블레이더': '듀얼블레이드',
  '카드': '카데나',
  '린': '렌',

  // 모험가 해적
  '해적': '바이퍼',
  '인파이터': '바이퍼',
  '버키니어': '바이퍼',
  '버커니어': '바이퍼',
  '건슬링거': '캡틴',
  '발키리': '캡틴',
  '해적(캐논슈터)': '캐논슈터',
  '캐논슈터': '캐논슈터',
  '캐논블래스터': '캐논슈터',
  '캐논마스터': '캐논슈터',

  // 구칭 / 기타
  '호크아이': '스트라이커',
  '썬더브레이커': '스트라이커',
}

export function findClass(name: string): MapleClass | undefined {
  const resolved = CLASS_NAME_ALIASES[name] ?? name
  return ALL_CLASSES.find(c => c.name === resolved)
    ?? ALL_CLASSES.find(c => resolved.includes(c.name) || c.name.includes(resolved))
}

// 본캐 직업 계열별 스탯 우선순위
export const MAIN_CLASS_PRIORITY: Record<string, StatType[]> = {
  warrior: ['STR', '공격력', '보스 몬스터 공격 시 데미지', '크리티컬 데미지', '방어율 무시', '최대 HP'],
  mage:    ['INT', '마력', '보스 몬스터 공격 시 데미지', '크리티컬 데미지', '방어율 무시', '최대 MP'],
  archer:  ['DEX', '공격력', '크리티컬 확률', '크리티컬 데미지', '보스 몬스터 공격 시 데미지', '방어율 무시'],
  thief:   ['LUK', '공격력', '크리티컬 확률', '크리티컬 데미지', '보스 몬스터 공격 시 데미지', '방어율 무시'],
  pirate:  ['STR', '공격력', '크리티컬 확률', '크리티컬 데미지', '보스 몬스터 공격 시 데미지', '방어율 무시'],
}

export function guessClassType(className: string): ClassType {
  if (className === '메이플스토리 M') return 'archer'
  return findClass(className)?.type ?? 'warrior'
}

export function levelToTileCount(level: number): number {
  if (level >= 250) return 5
  if (level >= 200) return 4
  if (level >= 140) return 3
  if (level >= 100) return 2
  if (level >= 60)  return 1
  return 0
}
