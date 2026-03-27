import { useState, useEffect } from 'react'
import { useAppStore } from '../store/appStore'
import {
  UNION_GRADE_TABLE,
  GRADE_COLORS,
  getGradeStep,
  getNextStep,
  getProgress,
} from '../utils/unionGrades'
import { calcUnionEffects } from '../utils/unionEffects'

// 등급 한글명 → 이미지 파일 prefix
const GRADE_IMG_PREFIX: Record<string, string> = {
  '노비스':       'novis',
  '베테랑':       'veteran',
  '마스터':       'master',
  '그랜드마스터': 'grandmaster',
  '슈프림':       'supreme',
}
function gradeImgSrc(grade: string, step: number): string {
  const prefix = GRADE_IMG_PREFIX[grade]
  if (!prefix) return ''
  return `./union_grades/${prefix}${step}.webp`
}

const LS_M_KEY = (world: string) => `mapleM_level_${world}`

function loadMLevel(world: string): number | null {
  const v = localStorage.getItem(LS_M_KEY(world))
  return v ? parseInt(v, 10) : null
}
function saveMLevel(world: string, level: number | null) {
  if (level === null) localStorage.removeItem(LS_M_KEY(world))
  else localStorage.setItem(LS_M_KEY(world), String(level))
}

interface Props { world: string }

export default function UnionStatsPanel({ world }: Props) {
  const { savedCharacters: allCharacters, mainCharsByWorld, selectedAccountIndex } = useAppStore()
  const characters = allCharacters.filter(c => (c.accountIndex ?? 0) === selectedAccountIndex)

  // 메이플스토리 M 최고 레벨 캐릭터 (레벨만 입력, 합산에 미반영)
  const [mLevel, setMLevelState] = useState<number | null>(() => loadMLevel(world))
  const [mInput, setMInput] = useState<string>(() => {
    const v = loadMLevel(world)
    return v !== null ? String(v) : ''
  })

  useEffect(() => {
    const v = loadMLevel(world)
    setMLevelState(v)
    setMInput(v !== null ? String(v) : '')
  }, [world])

  function saveMChar() {
    const lvl = mInput.trim() === '' ? null : parseInt(mInput, 10)
    if (lvl !== null && (isNaN(lvl) || lvl < 1 || lvl > 300)) return
    setMLevelState(lvl)
    saveMLevel(world, lvl)
  }

  function clearMChar() {
    setMLevelState(null)
    setMInput('')
    saveMLevel(world, null)
  }

  // 해당 서버 캐릭터 (레벨 내림차순, 상위 42개)
  const worldChars = (characters ?? [])
    .filter(c => c.world_name === world)
    .sort((a, b) => b.character_level - a.character_level)

  // 레벨 합산: 상위 42캐릭 (메이플스토리 M은 반영 안됨)
  const TOP_N = 42
  const levelSum = worldChars.slice(0, TOP_N).reduce((s, c) => s + c.character_level, 0)

  const current  = getGradeStep(levelSum)
  const next     = getNextStep(current)
  const progress = getProgress(levelSum, current, next)
  const gradeColor = current ? (GRADE_COLORS[current.grade] ?? '#fff') : '#6b7280'

  const mainOcid = mainCharsByWorld[world]
  const mainChar = worldChars.find(c => c.ocid === mainOcid)

  // 유니온 효과 합산 (상위 42캐릭)
  const unionEffects = calcUnionEffects(worldChars.slice(0, TOP_N))

  // 주능치 / 보조 스탯 분리
  const PRIMARY_KEYS = new Set(['STR','DEX','LUK','INT','HP_PCT','MP_PCT','HP_FLAT'])
  const primaryEffects   = unionEffects.filter(e => PRIMARY_KEYS.has(e.key))
  const secondaryEffects = unionEffects.filter(e => !PRIMARY_KEYS.has(e.key))

  return (
    <div className="flex flex-col gap-4 p-4 bg-bg-card border-l border-bg-deep min-h-full">

      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-bold text-base">{world} 유니온</h2>
          <p className="text-subtle text-xs mt-0.5">레벨 합산 기준 (상위 42캐릭, M 미반영)</p>
        </div>
        {mainChar && (
          <div className="text-right">
            <p className="text-xs text-subtle mb-0.5">본캐</p>
            <p className="text-white text-sm font-bold">{mainChar.character_name}</p>
            <p className="text-muted text-xs">Lv.{mainChar.character_level} {mainChar.character_class}</p>
          </div>
        )}
      </div>

      {/* 현재 등급 카드 */}
      <div className="bg-bg-deep rounded-xl p-4 flex flex-col gap-3">
        <div className="flex items-center gap-4">
          {/* 등급 이미지 */}
          {current ? (
            <img
              src={gradeImgSrc(current.grade, current.step)}
              alt={`${current.grade} ${current.step}단계`}
              className="w-20 h-20 object-contain shrink-0"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          ) : (
            <div className="w-20 h-20 rounded-xl bg-bg-card flex items-center justify-center text-subtle text-xs shrink-0">
              미달성
            </div>
          )}

          <div className="flex-1">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs text-subtle mb-0.5">현재 등급</div>
                <div className="text-xl font-bold leading-tight" style={{ color: gradeColor }}>
                  {current ? `${current.grade}` : '미달성'}
                </div>
                <div className="text-sm" style={{ color: gradeColor }}>
                  {current ? `${current.step}단계` : ''}
                </div>
                <div className="text-xs text-muted mt-1">
                  슬롯 <span className="text-white font-semibold">{current?.slots ?? 0}개</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-subtle mb-0.5">레벨 합산</div>
                <div className="text-xl font-bold text-white">{levelSum.toLocaleString()}</div>
                <div className="text-xs text-subtle mt-0.5">상위 {TOP_N}캐릭</div>
              </div>
            </div>
          </div>
        </div>

        {next ? (
          <>
            <div className="flex justify-between text-xs text-subtle">
              <span>다음: {next.grade} {next.step}단계</span>
              <span>{next.minLevel.toLocaleString()} ({(next.minLevel - levelSum).toLocaleString()} 부족)</span>
            </div>
            <div className="h-2 bg-bg-card rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progress * 100}%`, backgroundColor: gradeColor }}
              />
            </div>
          </>
        ) : (
          <div className="text-xs text-yellow-400 font-semibold">최고 등급 달성!</div>
        )}
      </div>

      {/* 메이플스토리 M */}
      <div className="bg-bg-deep rounded-xl p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-white text-sm font-bold">메이플스토리 M</span>
            <span className="text-xs text-subtle bg-bg-card px-2 py-0.5 rounded-full">레벨 합산 미반영</span>
          </div>
          {mLevel !== null && (
            <button onClick={clearMChar} className="text-subtle hover:text-red-400 text-xs transition-colors">✕ 제거</button>
          )}
        </div>

        <div className="flex gap-2 items-center">
          <input
            type="number"
            min={1} max={300}
            placeholder="최고 레벨 입력 (1~300)"
            className="flex-1 bg-bg-card border border-bg-deep rounded-lg px-3 py-1.5 text-white text-xs
                       placeholder-subtle focus:outline-none focus:border-accent/50"
            value={mInput}
            onChange={e => setMInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && saveMChar()}
          />
          <button
            onClick={saveMChar}
            className="bg-accent/80 hover:bg-accent text-white text-xs px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
          >저장</button>
        </div>

        {mLevel !== null ? (
          <div className="flex items-center justify-between bg-bg-card rounded-lg px-3 py-2">
            <span className="text-subtle text-xs">M 연동 캐릭터</span>
            <span className="text-white text-sm font-bold">Lv.{mLevel}</span>
          </div>
        ) : (
          <p className="text-subtle text-xs text-center">M 캐릭터 미연동</p>
        )}
      </div>

      {/* 적용 중인 유니온 효과 합산 */}
      {unionEffects.length > 0 && (
        <div className="bg-bg-deep rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-bg-card flex items-center justify-between">
            <span className="text-white text-sm font-bold">적용 중인 유니온 효과</span>
            <span className="text-subtle text-xs">상위 {TOP_N}캐릭 기준</span>
          </div>

          {/* 주능치 그리드 */}
          {primaryEffects.length > 0 && (
            <div className="grid grid-cols-2 gap-px bg-bg-card p-px">
              {primaryEffects.map(e => (
                <div key={e.key} className="bg-bg-deep flex items-center justify-between px-3 py-1.5">
                  <span className="text-subtle text-xs">{e.label}</span>
                  <span className="text-white text-xs font-bold">
                    {e.prefix ?? '+'}{e.total.toLocaleString()}{e.unit}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* 보조 스탯 */}
          {secondaryEffects.length > 0 && (
            <div className="border-t border-bg-card">
              {secondaryEffects.map(e => (
                <div key={e.key} className="flex items-center justify-between px-4 py-1.5 border-b border-bg-card/50 last:border-0">
                  <span className="text-subtle text-xs">{e.label}</span>
                  <span className="text-white text-xs font-semibold">
                    {e.prefix ?? '+'}{e.total.toLocaleString()}{e.unit}
                  </span>
                </div>
              ))}
            </div>
          )}

          <p className="text-subtle text-[10px] px-4 py-2 border-t border-bg-card">
            * 각 직업의 주 유니온 효과 합산 (실제 배치에 따라 다를 수 있음)
          </p>
        </div>
      )}

      {/* 등급 기준표 */}
      <div className="bg-bg-deep rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-bg-card">
          <span className="text-white text-sm font-bold">등급 기준표</span>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-subtle border-b border-bg-card">
              <th className="px-2 py-2 w-8"></th>
              <th className="text-left px-2 py-2">등급</th>
              <th className="text-right px-3 py-2">레벨 합산</th>
              <th className="text-right px-4 py-2">슬롯</th>
            </tr>
          </thead>
          <tbody>
            {UNION_GRADE_TABLE.map((g, i) => {
              const isCurrent = current?.grade === g.grade && current?.step === g.step
              const isNext    = next?.grade === g.grade && next?.step === g.step
              const achieved  = levelSum >= g.minLevel
              return (
                <tr key={i} className={`border-b border-bg-card/50 ${isCurrent ? 'bg-accent/10' : ''}`}>
                  <td className="px-2 py-1 text-center">
                    <img
                      src={gradeImgSrc(g.grade, g.step)}
                      alt=""
                      className="w-7 h-7 object-contain mx-auto"
                      style={{ opacity: achieved ? 1 : 0.25 }}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <span className="font-medium" style={{ color: achieved ? (GRADE_COLORS[g.grade] ?? 'rgb(var(--text-primary))') : 'rgb(75 85 99)' }}>
                      {g.grade} {g.step}
                      {isCurrent && <span className="ml-1 text-[10px] text-accent">◀ 현재</span>}
                      {isNext    && <span className="ml-1 text-[10px] text-yellow-400">◀ 다음</span>}
                    </span>
                  </td>
                  <td className="text-right px-3 py-1.5 text-muted">{g.minLevel.toLocaleString()}</td>
                  <td className="text-right px-4 py-1.5 text-muted">{g.slots}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
