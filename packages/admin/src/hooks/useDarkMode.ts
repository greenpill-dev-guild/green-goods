import { useEffect, useState } from 'react'

export type ThemeMode = 'light' | 'dark' | 'system'

export function useDarkMode() {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'system'
    const stored = localStorage.getItem('themeMode') as ThemeMode | null
    return stored || 'system'
  })

  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined') return false
    const stored = localStorage.getItem('themeMode')
    if (stored === 'dark') return true
    if (stored === 'light') return false
    // System preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    const updateTheme = () => {
      const root = document.documentElement
      let shouldBeDark = false

      if (themeMode === 'dark') {
        shouldBeDark = true
      } else if (themeMode === 'light') {
        shouldBeDark = false
      } else {
        // System mode
        shouldBeDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      }

      if (shouldBeDark) {
        root.classList.add('dark')
      } else {
        root.classList.remove('dark')
      }

      setIsDark(shouldBeDark)
      localStorage.setItem('themeMode', themeMode)
    }

    updateTheme()

    // Listen for system theme changes when in system mode
    if (themeMode === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handleChange = () => updateTheme()
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }
  }, [themeMode])

  const toggleTheme = () => {
    if (themeMode === 'light') {
      setThemeMode('dark')
    } else if (themeMode === 'dark') {
      setThemeMode('system')
    } else {
      setThemeMode('light')
    }
  }

  return {
    isDark,
    themeMode,
    setThemeMode,
    toggleTheme
  } as const
}
