import { Character, CLASS_TYPE_COLORS } from '../types'
import { guessClassType } from '../utils/classData'

interface Props {
  character: Character
  isMain: boolean
  onSetMain: () => void
}

export default function CharacterCard({ character, isMain, onSetMain }: Props) {
  const type  = guessClassType(character.character_class)
  const color = CLASS_TYPE_COLORS[type]

  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
        isMain
          ? 'bg-bg-dark border-accent/30'
          : 'bg-bg-card border-bg-deep'
      }`}
    >
      {/* 캐릭터 이미지 — 배경 고정, 이미지 3배 확대 */}
      <div
        className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 overflow-hidden border"
        style={{ background: `${color}20`, borderColor: `${color}40` }}
      >
        {character.character_image ? (
          <img
            src={character.character_image}
            alt={character.character_name}
            style={{ transform: 'translateY(16px) scale(3)', transformOrigin: 'center 70%', imageRendering: 'pixelated' }}
          />
        ) : (
          <span className="text-lg" style={{ color }}>
            {character.character_class?.[0] ?? '?'}
          </span>
        )}
      </div>

      {/* 이름 / 직업 / 레벨 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          {isMain && <span className="text-accent text-xs">⭐</span>}
          <span className="text-white font-bold text-sm truncate">{character.character_name}</span>
        </div>
        <p className="text-muted text-xs">Lv.{character.character_level} · {character.character_class}</p>
        <p className="text-subtle text-xs">{character.world_name}</p>
      </div>

      {/* 본캐 설정 버튼 */}
      <button
        onClick={e => { e.stopPropagation(); onSetMain() }}
        className="p-1.5 rounded-lg hover:bg-bg-deep transition-colors shrink-0 text-muted hover:text-accent"
        title={isMain ? '본캐' : '본캐로 설정'}
      >
        <svg
          className="w-4 h-4"
          fill={isMain ? 'rgb(var(--accent))' : 'none'}
          stroke={isMain ? 'rgb(var(--accent))' : 'rgb(var(--subtle))'}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
          />
        </svg>
      </button>
    </div>
  )
}
