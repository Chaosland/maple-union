import { useEffect, useState } from 'react'
import { useAppStore } from './store/appStore'
import { useTheme } from './hooks/useTheme'
import ApiKeyScreen from './screens/ApiKeyScreen'
import CharacterListScreen from './screens/CharacterListScreen'
import UnionPlacerScreen from './screens/UnionPlacerScreen'

type Page = 'union-status' | 'union-placer'

const NAV_ITEMS: { id: Page; icon: string; label: string }[] = [
  { id: 'union-status', icon: '🏆', label: '서버별 유니온 현황' },
  { id: 'union-placer', icon: '🗺️', label: '유니온 배치기' },
]

export default function App() {
  const { status, initialize } = useAppStore()
  const { theme, toggleTheme } = useTheme()

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [page, setPage]               = useState<Page>('union-status')

  useEffect(() => { initialize() }, [])

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
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-muted
                       hover:bg-bg-deep hover:text-white transition-colors"
          >
            <span>{theme === 'dark' ? '☀️' : '🌙'}</span>
            {theme === 'dark' ? '라이트 모드' : '다크 모드'}
          </button>
          <button
            onClick={() => window.open('https://ko-fi.com/chaosland', '_blank', 'noopener,noreferrer')}
            className="mt-2 w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-muted
                       hover:bg-bg-deep hover:text-white transition-colors"
          >
            <span>☕</span>
            후원하기
          </button>
        </div>
      </aside>

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
