import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/appStore'
import { UNION_GRADE_COLORS, BLOCK_TYPE_MAP, CLASS_TYPE_COLORS } from '../types'
import UnionBoard from '../components/UnionBoard'

export default function UnionStatusScreen() {
  const navigate = useNavigate()
  const { selectedCharacter, unionInfo, unionRaider, unionLoading, unionError, loadUnionData } = useAppStore()

  if (!selectedCharacter) { navigate('/'); return null }

  const gradeColor = unionInfo ? (UNION_GRADE_COLORS[unionInfo.union_grade] ?? '#888') : '#888'
  const blocks = unionRaider?.union_raider_block ?? []

  return (
    <div className="min-h-screen bg-bg-dark flex flex-col">
      {/* 헤더 */}
      <header className="bg-bg-card border-b border-bg-deep px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')}
            className="text-muted hover:text-white transition-colors p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <p className="text-white font-bold">{selectedCharacter.character_name}</p>
            <p className="text-muted text-xs">
              {selectedCharacter.world_name} · {selectedCharacter.character_class} · Lv.{selectedCharacter.character_level}
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate('/recommend')}
          className="flex items-center gap-1.5 text-accent border border-accent/40 hover:border-accent
                     text-sm font-bold px-3 py-1.5 rounded-lg transition-colors"
        >
          ✨ 배치 추천
        </button>
      </header>

      <main className="flex-1 overflow-auto p-4 space-y-4 max-w-4xl mx-auto w-full">
        {unionLoading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <span className="animate-spin text-accent text-3xl">⟳</span>
            <p className="text-muted text-sm">유니온 정보 로딩 중...</p>
          </div>
        ) : unionError ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <p className="text-muted">유니온 정보를 불러올 수 없습니다</p>
            <p className="text-subtle text-sm">{unionError}</p>
            <button onClick={() => loadUnionData(selectedCharacter)}
              className="bg-accent hover:bg-red-500 text-white px-4 py-2 rounded-lg text-sm transition-colors">
              다시 시도
            </button>
          </div>
        ) : (
          <>
            {/* 유니온 레벨/등급 */}
            {unionInfo && (
              <div className="rounded-2xl p-5 border"
                style={{
                  background: `linear-gradient(135deg, ${gradeColor}22, #16213e)`,
                  borderColor: `${gradeColor}44`
                }}>
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl"
                    style={{ background: `${gradeColor}22` }}>🏅</div>
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="text-white text-3xl font-bold">Lv. {unionInfo.union_level}</span>
                      <span className="px-2.5 py-0.5 rounded-lg text-sm font-bold border"
                        style={{ color: gradeColor, borderColor: gradeColor, background: `${gradeColor}22` }}>
                        {unionInfo.union_grade}
                      </span>
                    </div>
                    {(unionInfo.union_artifact_level ?? 0) > 0 && (
                      <p className="text-muted text-sm mt-1">
                        유니온 아티팩트 Lv.{unionInfo.union_artifact_level}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 점령 효과 스탯 */}
            {unionRaider && (unionRaider.union_occupied_stat?.length ?? 0) > 0 && (
              <Section title="점령 효과" icon="⚡">
                <div className="flex flex-wrap gap-2">
                  {unionRaider.union_occupied_stat.map((s, i) => (
                    <span key={i} className="bg-bg-deep border border-[#1a4a8a] text-text text-xs px-2.5 py-1 rounded-lg">
                      {s.stat_field_effect}
                    </span>
                  ))}
                </div>
              </Section>
            )}

            {/* 내부 스탯 */}
            {unionRaider && (unionRaider.union_inner_stat?.length ?? 0) > 0 && (
              <Section title="유니온 내부 효과" icon="🎯">
                <div className="flex flex-wrap gap-2">
                  {unionRaider.union_inner_stat.map((s, i) => (
                    <span key={i} className="bg-bg-deep border border-[#1a4a8a] text-text text-xs px-2.5 py-1 rounded-lg">
                      {s.stat_field_effect}
                    </span>
                  ))}
                </div>
              </Section>
            )}

            {/* 유니온 보드 */}
            {blocks.length > 0 && (
              <Section title="유니온 배치 현황" icon="🗺️">
                <UnionBoard blocks={blocks} />
              </Section>
            )}

            {/* 레이더 목록 */}
            {blocks.length > 0 && (
              <Section title={`배치된 레이더 (${blocks.length}명)`} icon="👥">
                <RaiderList blocks={blocks} />
              </Section>
            )}
          </>
        )}
      </main>
    </div>
  )
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="bg-bg-card rounded-2xl p-4 border border-bg-deep">
      <div className="flex items-center gap-2 mb-3 pb-3 border-b border-bg-deep">
        <span>{icon}</span>
        <h2 className="text-white font-bold text-sm">{title}</h2>
      </div>
      {children}
    </div>
  )
}

function RaiderList({ blocks }: { blocks: import('../types').UnionBlock[] }) {
  const byType: Record<string, typeof blocks> = {}
  blocks.forEach(b => { (byType[b.block_type] ??= []).push(b) })

  return (
    <div className="space-y-3">
      {Object.entries(byType).map(([type, list]) => {
        const ct = BLOCK_TYPE_MAP[type]
        const color = ct ? CLASS_TYPE_COLORS[ct] : '#888'
        return (
          <div key={type}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
              <span className="text-sm font-bold" style={{ color }}>{type} ({list.length})</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {list.map((b, i) => (
                <span key={i} className="text-xs px-2 py-1 rounded-lg border"
                  style={{ color, borderColor: `${color}44`, background: `${color}18` }}>
                  {b.block_class} Lv.{b.block_level}
                </span>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
