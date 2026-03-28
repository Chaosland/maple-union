import { useEffect, useRef, useState } from 'react'
import { useAppStore } from './store/appStore'
import { useTheme } from './hooks/useTheme'
import ApiKeyScreen from './screens/ApiKeyScreen'
import CharacterListScreen from './screens/CharacterListScreen'
import UnionPlacerScreen from './screens/UnionPlacerScreen'
import FeedbackModal from './components/FeedbackModal'
import { DISCORD_INVITE_URL } from './config/discord'

type Page = 'union-status' | 'union-placer'

type UpdaterStatus = 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
interface UpdaterState {
  status: UpdaterStatus
  version?: string
  percent?: number
  error?: string
}

const NAV_ITEMS: { id: Page; icon: string; label: string }[] = [
  { id: 'union-status', icon: '🏆', label: '서버별 유니온 현황' },
  { id: 'union-placer', icon: '🗺️', label: '유니온 배치기' },
]

export default function App() {
  const { status, initialize, error, clearError } = useAppStore()
  const { theme, toggleTheme } = useTheme()

  const [sidebarOpen, setSidebarOpen]   = useState(false)
  const [page, setPage]                 = useState<Page>('union-status')
  const [updater, setUpdater]           = useState<UpdaterState>({ status: 'idle' })
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const isManualCheck = useRef(false)

  useEffect(() => { initialize() }, [])

  // updater:state 이벤트 구독
  useEffect(() => {
    if (!window.api?.updates?.onState) return
    const unsub = window.api.updates.onState(state => {
      setUpdater(state)
      // 자동 체크(not-available/error)는 조용히 idle로
      if (!isManualCheck.current && (state.status === 'not-available' || state.status === 'error')) {
        setUpdater({ status: 'idle' })
      }
      if (state.status === 'not-available' || state.status === 'available' ||
          state.status === 'downloaded' || state.status === 'error') {
        isManualCheck.current = false
      }
    })
    return unsub
  }, [])

  const handleCheckUpdate = () => {
    if (!window.api?.updates?.check || updater.status === 'checking' || updater.status === 'downloading') return
    isManualCheck.current = true
    window.api.updates.check()
  }

  const handleDownload = () => {
    if (!window.api?.updates?.download) return
    window.api.updates.download()
  }

  const handleInstall = () => {
    window.api?.updates?.install?.()
  }

  // ── 초기화 중 ────────────────────────────────────────────────────────────
  if (status === 'init') {
    return (
      <div className="min-h-screen bg-bg-dark flex flex-col items-center justify-center gap-4">
        <span className="animate-spin text-accent text-4xl">⟳</span>
        <p className="text-white font-bold text-lg">메이플 유니온 도우미</p>
        <p className="text-muted text-sm">초기화 중...</p>
      </div>
    )
  }

  // ── API 키 미설정 또는 로그아웃 ─────────────────────────────────────────
  if (status === 'no-key') {
    return <ApiKeyScreen />
  }

  // ── 메인 레이아웃 ─────────────────────────────────────────────────────────
  return (
    <div className="h-screen bg-bg-dark flex overflow-hidden">

      {/* ── 사이드바 오버레이 (배경 클릭 시 닫힘) ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── 사이드바 ──────────────────────────────────────────────────────── */}
      <aside
        className={`fixed left-0 top-0 h-full w-60 z-50 flex flex-col
                    bg-bg-card border-r border-bg-deep shadow-2xl
                    transition-transform duration-200
                    ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* 사이드바 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-bg-deep">
          <span className="text-white font-bold text-sm">메이플 유니온 도우미</span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1 rounded-lg hover:bg-bg-deep text-muted hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* 네비게이션 메뉴 */}
        <nav className="flex-1 py-3 px-2 flex flex-col gap-1">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => { setPage(item.id); setSidebarOpen(false) }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                          transition-colors text-left
                          ${page === item.id
                            ? 'bg-accent/10 text-accent'
                            : 'text-muted hover:bg-bg-deep hover:text-white'}`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        {/* 사이드바 하단: 테마 토글 */}
        <div className="px-3 py-3 border-t border-bg-deep">
          <button
            onClick={handleCheckUpdate}
            disabled={updater.status === 'checking' || updater.status === 'downloading'}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-muted
                       hover:bg-bg-deep hover:text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            title="업데이트 확인"
          >
            <span className="inline-flex w-5 shrink-0 items-center justify-center text-base leading-none">
              {updater.status === 'checking' || updater.status === 'downloading' ? '⟳' : '⬆'}
            </span>
            <span className="flex-1 text-left">
              {updater.status === 'checking'   ? '확인 중...'
              : updater.status === 'downloading' ? `다운로드 ${updater.percent ?? 0}%`
              : updater.status === 'downloaded'  ? '설치 준비 완료'
              : updater.status === 'available'   ? `v${updater.version} 업데이트`
              : '업데이트 체크'}
            </span>
          </button>
          <button
            onClick={toggleTheme}
            className="mt-2 w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-muted
                       hover:bg-bg-deep hover:text-white transition-colors"
          >
            <span className="inline-flex w-5 shrink-0 items-center justify-center text-base leading-none">
              {theme === 'dark' ? '☀️' : '🌙'}
            </span>
            <span className="flex-1 text-left">{theme === 'dark' ? '라이트 모드' : '다크 모드'}</span>
          </button>
          <button
            onClick={() => window.open('https://ko-fi.com/chaosland', '_blank', 'noopener,noreferrer')}
            className="mt-2 w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-muted
                       hover:bg-bg-deep hover:text-white transition-colors"
          >
            <span className="inline-flex w-5 shrink-0 items-center justify-center text-base leading-none">☕</span>
            <span className="flex-1 text-left">후원하기</span>
          </button>
          <button
            onClick={() => { setFeedbackOpen(true); setSidebarOpen(false) }}
            className="mt-2 w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-muted
                       hover:bg-bg-deep hover:text-white transition-colors"
          >
            <span className="inline-flex w-5 shrink-0 items-center justify-center text-base leading-none">📝</span>
            <span className="flex-1 text-left">버그 / 개선 제안</span>
          </button>
          <button
            onClick={() => window.open(DISCORD_INVITE_URL, '_blank', 'noopener,noreferrer')}
            className="mt-2 w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-muted
                       hover:bg-bg-deep hover:text-white transition-colors"
          >
            <span className="inline-flex w-5 shrink-0 items-center justify-center text-base leading-none">
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" xmlns="http://www.w3.org/2000/svg">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
            </span>
            <span className="flex-1 text-left">Discord 커뮤니티</span>
          </button>
        </div>
      </aside>

      {/* ── 피드백 모달 ──────────────────────────────────────────────────── */}
      {feedbackOpen && <FeedbackModal onClose={() => setFeedbackOpen(false)} />}

      {/* ── API 에러 모달 ────────────────────────────────────────────────── */}
      {error && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70">
          <div className="bg-bg-card border border-red-700/60 rounded-2xl shadow-2xl p-6 w-96 flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-red-400 font-bold text-base">오류가 발생했습니다</p>
              <button
                onClick={clearError}
                className="p-1 rounded-lg hover:bg-bg-deep text-muted hover:text-white transition-colors shrink-0"
                title="닫기"
              >
                ✕
              </button>
            </div>
            <pre className="text-red-300 text-xs whitespace-pre-wrap break-all bg-bg-deep rounded-lg p-3 max-h-60 overflow-y-auto">
              {error}
            </pre>
            <div className="flex justify-end">
              <button
                onClick={clearError}
                className="px-4 py-2 rounded-lg text-sm bg-red-700 hover:bg-red-600 text-white transition-colors"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 업데이트 모달 ────────────────────────────────────────────────── */}
      {(updater.status === 'available' || updater.status === 'downloading' || updater.status === 'downloaded' || updater.status === 'error') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-bg-card border border-bg-deep rounded-2xl shadow-2xl p-6 w-80 flex flex-col gap-4">
            {updater.status === 'available' && (
              <>
                <p className="text-white font-bold text-base">업데이트가 있습니다</p>
                <p className="text-muted text-sm">v{updater.version} 버전이 출시됐습니다. 지금 다운로드할까요?</p>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setUpdater({ status: 'idle' })}
                    className="px-4 py-2 rounded-lg text-sm text-muted hover:bg-bg-deep transition-colors">
                    나중에
                  </button>
                  <button onClick={handleDownload}
                    className="px-4 py-2 rounded-lg text-sm bg-accent text-white hover:opacity-90 transition-opacity">
                    다운로드
                  </button>
                </div>
              </>
            )}
            {updater.status === 'downloading' && (
              <>
                <p className="text-white font-bold text-base">다운로드 중...</p>
                <div className="w-full bg-bg-deep rounded-full h-2">
                  <div className="bg-accent h-2 rounded-full transition-all duration-300"
                    style={{ width: `${updater.percent ?? 0}%` }} />
                </div>
                <p className="text-muted text-sm text-right">{updater.percent ?? 0}%</p>
              </>
            )}
            {updater.status === 'downloaded' && (
              <>
                <p className="text-white font-bold text-base">설치 준비 완료</p>
                <p className="text-muted text-sm">v{updater.version} 다운로드 완료. 앱을 재시작하면 자동 설치됩니다.</p>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setUpdater({ status: 'idle' })}
                    className="px-4 py-2 rounded-lg text-sm text-muted hover:bg-bg-deep transition-colors">
                    나중에
                  </button>
                  <button onClick={handleInstall}
                    className="px-4 py-2 rounded-lg text-sm bg-accent text-white hover:opacity-90 transition-opacity">
                    지금 재시작
                  </button>
                </div>
              </>
            )}
            {updater.status === 'error' && (
              <>
                <p className="text-white font-bold text-base">업데이트 실패</p>
                <p className="text-muted text-sm">{updater.error}</p>
                <div className="flex justify-end">
                  <button onClick={() => setUpdater({ status: 'idle' })}
                    className="px-4 py-2 rounded-lg text-sm text-muted hover:bg-bg-deep transition-colors">
                    확인
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── 메인 컨텐츠 ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {page === 'union-status' && (
          <CharacterListScreen
            onOpenSidebar={() => setSidebarOpen(true)}
          />
        )}
        {page === 'union-placer' && (
          <div className="h-screen bg-bg-dark flex flex-col overflow-hidden">
            {/* 유니온 배치기 헤더 */}
            <header className="bg-bg-card border-b border-bg-deep px-4 py-2 flex items-center gap-3 shrink-0">
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-1.5 rounded-lg hover:bg-bg-deep text-muted hover:text-white transition-colors"
                title="메뉴"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <h1 className="text-white font-bold text-base">유니온 배치기</h1>
            </header>
            <UnionPlacerScreen />
          </div>
        )}
      </div>
    </div>
  )
}
