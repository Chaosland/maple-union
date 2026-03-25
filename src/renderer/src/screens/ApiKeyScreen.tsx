import { useState } from 'react'
import { useAppStore } from '../store/appStore'

export default function ApiKeyScreen() {
  const { saveCredentials, error } = useAppStore()
  const [key,     setKey]     = useState('')
  const [loading, setLoading] = useState(false)
  const [show,    setShow]    = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!key.trim()) return
    setLoading(true)
    await saveCredentials({ serviceKey: key.trim() })
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-bg-dark flex items-center justify-center p-4">
      <div className="bg-bg-card rounded-2xl p-8 w-full max-w-md shadow-2xl border border-bg-deep">

        <div className="flex justify-center mb-5">
          <div className="w-14 h-14 bg-bg-deep rounded-2xl flex items-center justify-center">
            <svg className="w-7 h-7 text-accent" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3 3h7v7H3V3zm0 11h7v7H3v-7zm11-11h7v7h-7V3zm0 11h7v7h-7v-7z"/>
            </svg>
          </div>
        </div>

        <h1 className="text-white text-xl font-bold text-center mb-1">메이플 유니온 도우미</h1>
        <p className="text-muted text-xs text-center mb-6">넥슨 Open API 키를 입력하면 모든 캐릭터를 자동으로 불러옵니다</p>

        {/* 발급 안내 */}
        <div className="bg-bg-deep rounded-xl p-4 mb-5 text-xs text-muted space-y-1.5">
          <p className="text-text font-semibold mb-1">📌 API Key 발급 방법</p>
          <ol className="list-decimal list-inside space-y-1 leading-relaxed">
            <li><span className="text-accent font-medium">openapi.nexon.com</span> 접속 → 로그인</li>
            <li>마이페이지 → API Key 발급 또는 확인</li>
            <li><span className="text-white">API Key</span> 복사 후 아래에 붙여넣기</li>
          </ol>
          <p className="text-subtle pt-1.5 border-t border-bg-card">
            API Key는 계정에 귀속되어 있어 로그인 연동 없이도 모든 캐릭터를 불러올 수 있습니다
          </p>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 mb-4 text-red-300 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <input
              type={show ? 'text' : 'password'}
              value={key}
              onChange={e => setKey(e.target.value)}
              placeholder="live_xxxxxxxxxxxxxxxx..."
              autoComplete="off"
              className="w-full bg-bg-deep border border-bg-deep rounded-xl px-4 py-3 pr-11
                         text-white text-sm placeholder-subtle font-mono
                         focus:outline-none focus:border-accent/60 transition-colors"
            />
            <button type="button" onClick={() => setShow(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-subtle hover:text-white transition-colors">
              {show ? '🙈' : '👁️'}
            </button>
          </div>

          <button type="submit" disabled={!key.trim() || loading}
            className="w-full py-3 bg-accent hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed
                       text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors">
            {loading ? <span className="animate-spin text-xl">⟳</span> : '시작하기'}
          </button>
        </form>

        <p className="text-subtle text-xs text-center mt-4">API 키는 이 기기에만 암호화 저장됩니다</p>
      </div>
    </div>
  )
}
