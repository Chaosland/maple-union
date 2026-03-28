import { useState } from 'react'
import { DISCORD_WEBHOOKS } from '../config/discord'

type Category = 'bug' | 'feature' | 'other'

const CATEGORIES: { id: Category; label: string; emoji: string; color: number }[] = [
  { id: 'bug',     label: '버그 리포트',    emoji: '🐛', color: 0xe74c3c },
  { id: 'feature', label: '기능 개선 제안', emoji: '💡', color: 0x2ecc71 },
  { id: 'other',   label: '기타 문의',      emoji: '💬', color: 0x3498db },
]

interface Props {
  onClose: () => void
}

export default function FeedbackModal({ onClose }: Props) {
  const [category, setCategory] = useState<Category>('bug')
  const [title, setTitle]       = useState('')
  const [body, setBody]         = useState('')
  const [status, setStatus]     = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [errMsg, setErrMsg]     = useState('')

  const selected = CATEGORIES.find(c => c.id === category)!

  const handleSubmit = async () => {
    if (!title.trim() || !body.trim()) return

    const webhookUrl = DISCORD_WEBHOOKS[category]
    if (!webhookUrl || webhookUrl.startsWith('WEBHOOK_URL')) {
      setErrMsg('Discord Webhook URL이 설정되지 않았습니다.\nsrc/renderer/src/config/discord.ts를 확인해주세요.')
      setStatus('error')
      return
    }

    setStatus('sending')
    setErrMsg('')

    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [{
            title: `${selected.emoji} ${title.trim()}`,
            description: body.trim(),
            color: selected.color,
            footer: { text: `메이플 유니온 도우미 · ${selected.label}` },
            timestamp: new Date().toISOString(),
          }]
        })
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setStatus('done')
    } catch (e) {
      setErrMsg(String(e))
      setStatus('error')
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70">
      <div className="bg-bg-card border border-bg-deep rounded-2xl shadow-2xl p-6 w-[440px] flex flex-col gap-4">

        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <p className="text-white font-bold text-base">피드백 보내기</p>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-bg-deep text-muted hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {status === 'done' ? (
          /* 전송 완료 */
          <div className="flex flex-col items-center gap-3 py-4">
            <span className="text-4xl">✅</span>
            <p className="text-white font-bold">전송 완료!</p>
            <p className="text-muted text-sm text-center">소중한 피드백 감사합니다. 빠르게 검토하겠습니다.</p>
            <button
              onClick={onClose}
              className="mt-2 px-6 py-2 rounded-lg text-sm bg-accent text-white hover:opacity-90 transition-opacity"
            >
              닫기
            </button>
          </div>
        ) : (
          <>
            {/* 카테고리 */}
            <div className="flex gap-2">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={`flex-1 py-2 rounded-xl text-xs font-medium transition-colors border
                    ${category === cat.id
                      ? 'bg-accent/10 text-accent border-accent/40'
                      : 'text-muted border-bg-deep hover:bg-bg-deep hover:text-white'}`}
                >
                  {cat.emoji} {cat.label}
                </button>
              ))}
            </div>

            {/* 제목 */}
            <div className="flex flex-col gap-1">
              <label className="text-muted text-xs">제목</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="한 줄로 요약해주세요"
                maxLength={100}
                className="bg-bg-deep border border-bg-deep rounded-xl px-3 py-2 text-sm text-white
                           placeholder-muted focus:outline-none focus:border-accent/50 transition-colors"
              />
            </div>

            {/* 내용 */}
            <div className="flex flex-col gap-1">
              <label className="text-muted text-xs">내용</label>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder={category === 'bug'
                  ? '어떤 상황에서 발생했는지, 재현 방법, 예상 동작 등을 알려주세요.'
                  : category === 'feature'
                  ? '어떤 기능이 있으면 좋겠는지 자유롭게 적어주세요.'
                  : '자유롭게 작성해주세요.'}
                rows={5}
                maxLength={2000}
                className="bg-bg-deep border border-bg-deep rounded-xl px-3 py-2 text-sm text-white
                           placeholder-muted focus:outline-none focus:border-accent/50 transition-colors
                           resize-none"
              />
              <p className="text-muted text-xs text-right">{body.length} / 2000</p>
            </div>

            {/* 에러 */}
            {status === 'error' && (
              <p className="text-red-400 text-xs whitespace-pre-wrap bg-bg-deep rounded-lg p-2">{errMsg}</p>
            )}

            {/* 버튼 */}
            <div className="flex gap-2 justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm text-muted hover:bg-bg-deep transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSubmit}
                disabled={!title.trim() || !body.trim() || status === 'sending'}
                className="px-4 py-2 rounded-lg text-sm bg-accent text-white hover:opacity-90
                           transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {status === 'sending' ? '전송 중...' : '전송하기'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
