import { useState, useEffect } from 'react'

export type Theme = 'dark' | 'light'

const STORAGE_KEY = 'maple-union-theme'

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    return (localStorage.getItem(STORAGE_KEY) as Theme) ?? 'dark'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  // 초기 적용
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [])

  const toggleTheme = () => setThemeState(t => t === 'dark' ? 'light' : 'dark')

  return { theme, toggleTheme }
}
