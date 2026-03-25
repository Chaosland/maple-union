import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/appStore'
import { Character, CLASS_TYPE_COLORS } from '../types'
import { RecommendedRaider } from '../utils/unionRecommender'
import { guessClassType } from '../utils/classData'

export default function UnionRecommendationScreen() {
  const navigate = useNavigate()
  const { recommendation, mainCharacter, characters, setMainCharacter } = useAppStore()
  const [showPicker, setShowPicker] = useState(false)

  if (!recommendation) {
    return (
      <div className="min-h-screen bg-bg-dark flex flex-col items-center justify-center gap-4">
        <p className="text-muted">캐릭터를 선택하고 유니온 정보를 불러오면 추천을 확인할 수 있습니다.</p>
        <button onClick={() => navigate('/')}
          className="bg-accent hover:bg-red-500 text-white px-4 py-2 rounded-lg text-sm transition-colors">
          ← 캐릭터 목록으로
        </button>
      </div>
    )
  }

  const typeLabel = { warrior: '전사', mage: '마법사', archer: '궁수', thief: '도적', pirate: '해적' }
  const type = guessClassType(recommendation.mainCharacterClass)

  return (
    <div className="min-h-screen bg-bg-dark flex flex-col">
      <header className="bg-bg-card border-b border-bg-deep px-6 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-muted hover:text-white transition-colors p-1">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-white font-bold">유니온 배치 추천</h1>
      </header>

      <main className="flex-1 overflow-auto p-4 space-y-4 max-w-3xl mx-auto w-full">

        {/* 본캐 헤더 */}
        <div className="bg-bg-card rounded-2xl p-4 border border-accent/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-accent text-xl">⭐</span>
            <div>
              <p className="text-muted text-xs">본캐릭터</p>
              <p className="text-white font-bold">
                {mainCharacter ? `${mainCharacter.character_name} (${mainCharacter.character_class})` : '미설정'}
              </p>
            </div>
          </div>
          <button onClick={() => setShowPicker(true)}
            className="text-accent text-sm hover:underline">변경</button>
        </div>

        {/* 스탯 우선순위 */}
        <div className="bg-bg-card rounded-2xl p-4 border border-bg-deep">
          <h2 className="text-white font-bold text-sm mb-3">
            {typeLabel[type]} 계열 스탯 우선순위
          </h2>
          <div className="flex flex-wrap gap-2">
            {recommendation.statPriority.map((stat, i) => (
              <span key={stat} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs"
                style={{
                  color: i < 3 ? ['#ffd700', '#c0c0c0', '#cd7f32'][i] : '#5a6a8a',
                  borderColor: `${i < 3 ? ['#ffd700', '#c0c0c0', '#cd7f32'][i] : '#1a4a8a'}44`,
                  background: `${i < 3 ? ['#ffd700', '#c0c0c0', '#cd7f32'][i] : '#1a4a8a'}15`
                }}>
                <span className="font-bold">{i + 1}.</span> {stat}
              </span>
            ))}
          </div>
        </div>

        {/* 현재 배치 평가 */}
        {recommendation.currentFeedback.length > 0 && (
          <div className="bg-bg-card rounded-2xl p-4 border border-bg-deep">
            <h2 className="text-white font-bold text-sm mb-3">📊 현재 배치 평가</h2>
            <div className="space-y-3">
              {recommendation.currentFeedback.slice(0, 10).map((fb, i) => {
                const pct = Math.min(fb.score / 80, 1)
                const color = pct > 0.6 ? '#4caf50' : pct > 0.3 ? '#ffc107' : '#e94560'
                return (
                  <div key={i}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-text text-xs">{fb.block.block_class} — {fb.feedback}</span>
                      <span className="text-xs font-bold" style={{ color }}>{fb.score.toFixed(0)}</span>
                    </div>
                    <div className="h-1 bg-bg-deep rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${pct * 100}%`, background: color }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 추천 순위 */}
        <div className="bg-bg-card rounded-2xl p-4 border border-bg-deep">
          <h2 className="text-white font-bold text-sm mb-1">🏆 배치 추천 순위 (상위 20명)</h2>
          <p className="text-subtle text-xs mb-4">본캐 스탯에 유용한 스탯을 제공하는 순서로 정렬됩니다</p>
          <div className="space-y-2">
            {recommendation.recommended.slice(0, 20).map((raider, i) => (
              <RaiderTile key={raider.character.ocid} rank={i + 1} raider={raider} />
            ))}
          </div>
        </div>
      </main>

      {/* 본캐 선택 모달 */}
      {showPicker && (
        <div className="fixed inset-0 bg-black/60 flex items-end justify-center z-50" onClick={() => setShowPicker(false)}>
          <div className="bg-bg-card rounded-t-2xl w-full max-w-lg max-h-[70vh] flex flex-col"
            onClick={e => e.stopPropagation()}>
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-subtle rounded-full" />
            </div>
            <p className="text-white font-bold text-center py-3">본캐릭터 선택</p>
            <div className="overflow-auto flex-1">
              {characters.map(c => (
                <button key={c.ocid} onClick={() => { setMainCharacter(c); setShowPicker(false) }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-bg-deep transition-colors text-left">
                  <div className="w-10 h-10 bg-bg-deep rounded-lg flex items-center justify-center text-muted text-sm font-bold">
                    {c.character_class[0] ?? '?'}
                  </div>
                  <div className="flex-1">
                    <p className="text-white text-sm font-medium">{c.character_name}</p>
                    <p className="text-muted text-xs">{c.character_class} · Lv.{c.character_level}</p>
                  </div>
                  {mainCharacter?.ocid === c.ocid && <span className="text-accent">✓</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function RaiderTile({ rank, raider }: { rank: number; raider: RecommendedRaider }) {
  const type = guessClassType(raider.character.character_class)
  const color = CLASS_TYPE_COLORS[type]
  const rankColor = rank <= 3 ? ['#ffd700', '#c0c0c0', '#cd7f32'][rank - 1] : '#5a6a8a'

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border transition-colors"
      style={{
        background: raider.isPlaced ? `${color}10` : 'transparent',
        borderColor: raider.isPlaced ? `${color}30` : '#1a4a8a44'
      }}>
      {/* 순위 */}
      <span className="w-7 text-sm font-bold text-right shrink-0" style={{ color: rankColor }}>#{rank}</span>

      {/* 색상 바 */}
      <div className="w-1 h-10 rounded-full shrink-0" style={{ background: color }} />

      {/* 정보 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-white font-bold text-sm">{raider.character.character_name}</span>
          {raider.isPlaced && (
            <span className="text-xs px-1.5 py-0.5 rounded font-bold"
              style={{ color, background: `${color}22` }}>배치됨</span>
          )}
        </div>
        <p className="text-muted text-xs">{raider.character.character_class} · Lv.{raider.character.character_level}</p>
        <p className="text-subtle text-xs mt-0.5 truncate">{raider.reason}</p>
      </div>

      {/* 점수 */}
      <div className="text-right shrink-0">
        <p className="text-accent font-bold text-lg leading-none">{raider.score.toFixed(0)}</p>
        <p className="text-subtle text-xs">점</p>
      </div>
    </div>
  )
}
