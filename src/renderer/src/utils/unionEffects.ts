// ── 스프레드시트 정확 수치 기반 유니온 효과 ──────────────────────────────
// 출처: 메이플스토리 내 캐릭터 육성현황 관리시트 ver2.1

export type CharGrade = 'SSS' | 'SS' | 'S' | 'A' | 'B'

export interface UnionEffect {
  key: string                           // 집계 키 (동일 스탯끼리 합산)
  label: string                         // 표시 이름
  values: Record<CharGrade, number>     // 등급별 수치
  unit: string                          // '' | '%'
  prefix?: string                       // e.g. '-' (스킬 재사용 감소)
}

// 한 직업이 복수 효과를 줄 수 있음 (제논: STR+DEX+LUK)
export type EffectDef = UnionEffect | UnionEffect[]

// ── 공통 효과 정의 ───────────────────────────────────────────────
const STR: UnionEffect = { key: 'STR', label: 'STR', values: { SSS:100, SS:80, S:40, A:20, B:10 }, unit:'' }
const DEX: UnionEffect = { key: 'DEX', label: 'DEX', values: { SSS:100, SS:80, S:40, A:20, B:10 }, unit:'' }
const INT: UnionEffect = { key: 'INT', label: 'INT', values: { SSS:100, SS:80, S:40, A:20, B:10 }, unit:'' }
const LUK: UnionEffect = { key: 'LUK', label: 'LUK', values: { SSS:100, SS:80, S:40, A:20, B:10 }, unit:'' }

const HP_PCT:  UnionEffect = { key:'HP_PCT',  label:'최대HP', values:{SSS:6,  SS:5,  S:4,  A:3, B:2}, unit:'%' }
const MP_PCT:  UnionEffect = { key:'MP_PCT',  label:'최대MP', values:{SSS:6,  SS:5,  S:4,  A:3, B:2}, unit:'%' }
const HP_FLAT: UnionEffect = { key:'HP_FLAT', label:'최대HP', values:{SSS:2500,SS:2000,S:1000,A:500,B:250}, unit:'' }

const CRIT_RATE: UnionEffect = { key:'CRIT_RATE', label:'크리티컬 확률',  values:{SSS:5,SS:4,S:3,A:2,B:1}, unit:'%' }
const CRIT_DMG:  UnionEffect = { key:'CRIT_DMG',  label:'크리티컬 데미지', values:{SSS:6,SS:5,S:3,A:2,B:1}, unit:'%' }
const BOSS_DMG:  UnionEffect = { key:'BOSS_DMG',  label:'보스 데미지',     values:{SSS:6,SS:5,S:3,A:2,B:1}, unit:'%' }
const IED:       UnionEffect = { key:'IED',        label:'방어율 무시',     values:{SSS:6,SS:5,S:3,A:2,B:1}, unit:'%' }
const BUFF_DUR:  UnionEffect = { key:'BUFF_DUR',   label:'버프지속시간',    values:{SSS:25,SS:20,S:15,A:10,B:5}, unit:'%' }
const SUMMON:    UnionEffect = { key:'SUMMON',     label:'소환수 지속시간', values:{SSS:12,SS:10,S:8,A:6,B:4}, unit:'%' }
const STATUS_RES:UnionEffect = { key:'STATUS_RES', label:'상태이상 저항',   values:{SSS:5,SS:4,S:3,A:2,B:1}, unit:'' }
const COOLDOWN:  UnionEffect = { key:'COOLDOWN',   label:'스킬 재사용대기시간', values:{SSS:6,SS:5,S:4,A:3,B:2}, unit:'%', prefix:'-' }
const MESO:      UnionEffect = { key:'MESO',       label:'메소 획득량',     values:{SSS:5,SS:4,S:3,A:2,B:1}, unit:'%' }
const HP_REGEN:  UnionEffect = { key:'HP_REGEN',   label:'타격시 최대HP 회복', values:{SSS:10,SS:8,S:6,A:4,B:2}, unit:'%' }
const MP_REGEN:  UnionEffect = { key:'MP_REGEN',   label:'타격시 최대MP 회복', values:{SSS:10,SS:8,S:6,A:4,B:2}, unit:'%' }
const PROB_DMG:  UnionEffect = { key:'PROB_DMG',   label:'공격시 확률 데미지', values:{SSS:20,SS:15,S:12,A:8,B:4}, unit:'%' }
const EXP_RATE:  UnionEffect = { key:'EXP_RATE',   label:'경험치 획득량',   values:{SSS:12,SS:10,S:8,A:6,B:4}, unit:'%' }
const MOVE_SPD:  UnionEffect = { key:'MOVE_SPD',   label:'이동속도',         values:{SSS:10,SS:8,S:6,A:4,B:2}, unit:'' }

// 제논 전용: STR+DEX+LUK 동시
const XENON_SDL: UnionEffect[] = [
  { key:'STR', label:'STR', values:{SSS:50,SS:40,S:20,A:10,B:5}, unit:'' },
  { key:'DEX', label:'DEX', values:{SSS:50,SS:40,S:20,A:10,B:5}, unit:'' },
  { key:'LUK', label:'LUK', values:{SSS:50,SS:40,S:20,A:10,B:5}, unit:'' },
]

// ── 직업명 → 유니온 효과 매핑 ────────────────────────────────────
// 키: Nexon API 반환 직업명 (또는 통용 약칭)
export const CLASS_UNION_EFFECTS: Record<string, EffectDef> = {
  // ── 모험가 전사 ──────────────
  '히어로':                STR,
  '팔라딘':                STR,
  '다크나이트':            HP_PCT,

  // ── 모험가 마법사 ────────────
  '아크메이지(불,독)':     MP_PCT,   // 불독
  '아크메이지(얼,번)':     INT,      // 썬콜
  '비숍':                  INT,

  // ── 모험가 궁수 ──────────────
  '신궁':                  CRIT_RATE,
  '보우마스터':            DEX,
  '패스파인더':            DEX,

  // ── 모험가 도적 ──────────────
  '나이트로드':            CRIT_RATE,
  '섀도어':                LUK,
  '듀얼블레이드':          LUK,
  '듀얼블레이더':          LUK,  // API 반환명 대응

  // ── 모험가 해적 ──────────────
  '캡틴':                  SUMMON,
  '바이퍼':                STR,
  '캐논슈터':              STR,

  // ── 시그너스 기사단 ──────────
  '미하일':                HP_FLAT,
  '소울마스터':            HP_FLAT,
  '플레임위자드':          INT,
  '윈드브레이커':          DEX,
  '나이트워커':            LUK,
  '스트라이커':            STR,
  '썬더브레이커':          STR,  // 스트라이커 구칭

  // ── 영웅 ─────────────────────
  '아란':                  HP_REGEN,
  '에반':                  MP_REGEN,
  '루미너스':              INT,
  '메르세데스':            COOLDOWN,
  '팬텀':                  MESO,
  '은월':                  CRIT_DMG,

  // ── 레지스탕스 ───────────────
  '블래스터':              IED,
  '배틀메이지':            INT,
  '와일드헌터':            PROB_DMG,
  '메카닉':                BUFF_DUR,
  '제논':                  XENON_SDL,

  // ── 데몬 ─────────────────────
  '데몬슬레이어':          STATUS_RES,
  '데몬어벤져':            BOSS_DMG,
  '데몬어벤저':            BOSS_DMG,  // API 반환명 대응

  // ── 노바 ─────────────────────
  '카이저':                STR,
  '카인':                  DEX,
  '카데나':                LUK,
  '엔젤릭버스터':          DEX,

  // ── 아니마 ───────────────────
  '렌':                    MOVE_SPD,
  '호영':                  LUK,
  '라라':                  INT,

  // ── 레프 ─────────────────────
  '아크':                  STR,
  '아델':                  STR,
  '일리움':                INT,
  '칼리':                  LUK,

  // ── 프렌즈월드 ───────────────
  '키네시스':              INT,

  // ── 초월자 ───────────────────
  '제로':                  EXP_RATE,

  // ── 기타 (classData 기재 직업) ──
  '버키니어':              STR,
  '호크아이':              DEX,
  '스트링어':              DEX,
  '린':                    MOVE_SPD,  // 렌 구칭
  '카나':                  INT,
  '카드':                  LUK,
}

// ── 모험가 직업 전직 단계 → 최종 전직명 매핑 ──────────────────────────────
// 키: Nexon API 가 반환하는 1~3차 직업명  /  값: 4차(최종) 직업명
export const CLASS_ALIAS_MAP: Record<string, string> = {
  // ── 모험가 전사 ──────────────────────────────────────────
  '검사':           '히어로',           // 1차 (히어로/팔라딘/다크나이트 공통, STR 기본)
  '파이터':         '히어로',           // 2차
  '크루세이더':     '히어로',           // 3차
  '페이지':         '팔라딘',           // 2차
  '화이트나이트':   '팔라딘',           // 3차
  '스피어맨':       '다크나이트',       // 2차
  '드래곤나이트':   '다크나이트',       // 3차

  // ── 모험가 마법사 ────────────────────────────────────────
  '위자드(불,독)':          '아크메이지(불,독)',   // 2차
  '파이어메이지(불,독)':    '아크메이지(불,독)',   // 3차
  '위자드(얼,번)':          '아크메이지(얼,번)',   // 2차
  '아이스메이지(얼,번)':    '아크메이지(얼,번)',   // 3차
  '아이스라이트닝메이지':   '아크메이지(얼,번)',   // 3차 통칭
  '클레릭':                 '비숍',               // 2차
  '프리스트':               '비숍',               // 3차

  // ── 모험가 궁수 ──────────────────────────────────────────
  '아처':           '보우마스터',       // 1차 (보우마스터/신궁 공통, DEX 기본)
  '헌터':           '보우마스터',       // 2차
  '레인저':         '보우마스터',       // 3차
  '사수':           '신궁',             // 2차
  '사냥꾼':         '신궁',             // 3차

  // ── 모험가 도적 ──────────────────────────────────────────
  '로그':           '나이트로드',       // 1차 (나이트로드/섀도어 공통, LUK 기본)
  '어쌔신':         '나이트로드',       // 2차
  '허밋':           '나이트로드',       // 3차
  '밴딧':           '섀도어',           // 2차
  '치프밴딧':       '섀도어',           // 3차

  // ── 모험가 해적 ──────────────────────────────────────────
  '해적':           '바이퍼',           // 1차 (바이퍼/캡틴 공통, STR 기본)
  '인파이터':       '바이퍼',           // 2차
  '버커니어':       '바이퍼',           // 3차
  '버키니어':       '바이퍼',           // 오기 대응
  '건슬링어':       '캡틴',             // 2차
  '발키리':         '캡틴',             // 3차
  '해적(캐논슈터)': '캐논슈터',         // 1차(캐논슈터)
  '캐논슈터':       '캐논슈터',         // 2차
  '캐논블래스터':   '캐논슈터',         // 3차
  '캐논마스터':     '캐논슈터',         // 4차 구명칭 대응
}

// ── 헬퍼: 직업명 → 효과 배열 반환 ──────────────────────────────
export function getClassEffects(className: string): UnionEffect[] {
  // 별칭 해소 (1~3차 전직명 → 4차 최종명)
  const resolved = CLASS_ALIAS_MAP[className] ?? className

  // 정확 매칭
  let def = CLASS_UNION_EFFECTS[resolved] ?? CLASS_UNION_EFFECTS[className]
  if (!def) {
    // 부분 매칭 (e.g. "(불,독)" 포함 체크)
    const key = Object.keys(CLASS_UNION_EFFECTS).find(
      k => resolved.includes(k) || k.includes(resolved)
    )
    if (key) def = CLASS_UNION_EFFECTS[key]
  }
  if (!def) return []
  return Array.isArray(def) ? def : [def]
}

// ── 레벨 → 개인 등급 ────────────────────────────────────────────
export function charGrade(level: number): CharGrade | null {
  if (level > 249) return 'SSS'
  if (level > 199) return 'SS'
  if (level > 139) return 'S'
  if (level >  99) return 'A'
  if (level >  59) return 'B'
  return null // 미달
}

// ── 표시 문자열 생성 ─────────────────────────────────────────────
export function effectDisplayStr(className: string, level: number): string {
  const grade = charGrade(level)
  if (!grade) return '등급미달'
  const effects = getClassEffects(className)
  if (!effects.length) return '-'

  return effects.map(e => {
    const v = e.values[grade]
    const sign = e.prefix ?? '+'
    if (e.unit === '%') return `${e.label} ${sign}${v}%`
    return `${e.label} ${sign}${v}`
  }).join(' / ')
}

// ── 집계 ─────────────────────────────────────────────────────────
export interface StatTotal {
  key: string
  label: string
  total: number
  unit: string
  prefix?: string
}

export const EFFECT_DISPLAY_ORDER = [
  'STR','DEX',
  'LUK','INT',
  'HP_PCT','MP_PCT',
  'HP_FLAT',
  'CRIT_RATE','CRIT_DMG',
  'BOSS_DMG','IED',
  'BUFF_DUR','COOLDOWN',
  'STATUS_RES',
  'SUMMON','PROB_DMG',
  'MESO','EXP_RATE','MOVE_SPD',
  'HP_REGEN','MP_REGEN',
]

export function calcUnionEffects(
  chars: { character_class: string; character_level: number }[]
): StatTotal[] {
  // ── Step 1: 별칭 해소 후 동일 직업 중복 제거 (최고 레벨만 유지) ─────────
  const canonical: Record<string, { character_class: string; character_level: number }> = {}
  for (const c of chars) {
    const cls = CLASS_ALIAS_MAP[c.character_class] ?? c.character_class
    if (!canonical[cls] || c.character_level > canonical[cls].character_level) {
      canonical[cls] = { character_class: cls, character_level: c.character_level }
    }
  }

  // ── Step 2: 효과 집계 ────────────────────────────────────────────────────
  const totals: Record<string, { label: string; total: number; unit: string; prefix?: string }> = {}

  for (const c of Object.values(canonical)) {
    const grade = charGrade(c.character_level)
    if (!grade) continue
    const effects = getClassEffects(c.character_class)
    for (const e of effects) {
      const v = e.values[grade]
      if (!totals[e.key]) {
        totals[e.key] = { label: e.label, total: 0, unit: e.unit, prefix: e.prefix }
      }
      totals[e.key].total += v
    }
  }

  return EFFECT_DISPLAY_ORDER
    .filter(k => totals[k]?.total)
    .map(k => ({ key: k, ...totals[k] }))
}
