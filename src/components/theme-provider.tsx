'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { getTheme, type Theme as ThemeConfig } from '@/config/themes'

type Theme = 'light' | 'dark' | 'system'

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
  themeNameStorageKey?: string
  codeThemeStorageKey?: string
  fontSizeStorageKey?: string
}

type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme) => void
  resolvedTheme: 'light' | 'dark'
  themeName: string
  setThemeName: (name: string) => void
  codeTheme: string
  setCodeTheme: (name: string) => void
  fontSize: string
  setFontSize: (size: string) => void
}

const ThemeProviderContext = createContext<ThemeProviderState | undefined>(undefined)

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'blog-theme',
  themeNameStorageKey = 'blog-theme-name',
  codeThemeStorageKey = 'blog-code-theme',
  fontSizeStorageKey = 'blog-font-size',
  ...props
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme)
  const [themeName, setThemeNameState] = useState<string>('default')
  const [codeTheme, setCodeThemeState] = useState<string>('github')
  const [fontSize, setFontSizeState] = useState<string>('medium')
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Get theme from localStorage
    const stored = localStorage.getItem(storageKey) as Theme | null
    if (stored) {
      setThemeState(stored)
    }
    
    // Get theme name from localStorage
    const storedName = localStorage.getItem(themeNameStorageKey)
    if (storedName) {
      setThemeNameState(storedName)
    }
    
    // Get code theme from localStorage
    const storedCodeTheme = localStorage.getItem(codeThemeStorageKey)
    if (storedCodeTheme) {
      setCodeThemeState(storedCodeTheme)
    }
    
    // Get font size from localStorage
    const storedFontSize = localStorage.getItem(fontSizeStorageKey)
    if (storedFontSize) {
      setFontSizeState(storedFontSize)
    }
  }, [storageKey, themeNameStorageKey, codeThemeStorageKey, fontSizeStorageKey])

  useEffect(() => {
    if (!mounted) return

    const root = window.document.documentElement
    
    // Remove previous theme classes
    root.classList.remove('light', 'dark')

    let effectiveTheme: 'light' | 'dark' = 'light'

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      effectiveTheme = systemTheme
    } else {
      effectiveTheme = theme
    }

    root.classList.add(effectiveTheme)
    root.setAttribute('data-theme-mode', effectiveTheme)
    setResolvedTheme(effectiveTheme)
    
    // Apply theme colors
    const themeConfig = getTheme(themeName)
    const colors = effectiveTheme === 'dark' ? themeConfig.dark : themeConfig.light
    
    Object.entries(colors).forEach(([key, value]) => {
      const cssVarName = `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`
      root.style.setProperty(cssVarName, value)
    })
  }, [theme, themeName, mounted])
  
  // Update code theme attribute
  useEffect(() => {
    if (!mounted) return
    const root = window.document.documentElement
    root.setAttribute('data-code-theme', codeTheme)
  }, [codeTheme, mounted])
  
  // Update font size
  useEffect(() => {
    if (!mounted) return
    const root = window.document.documentElement
    
    const fontSizeMap: Record<string, string> = {
      small: '14px',
      medium: '16px',
      large: '18px',
      'x-large': '20px',
    }
    
    root.style.setProperty('--base-font-size', fontSizeMap[fontSize] || '16px')
    root.setAttribute('data-font-size', fontSize)
  }, [fontSize, mounted])

  useEffect(() => {
    if (!mounted) return

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    
    const handleChange = () => {
      if (theme === 'system') {
        const systemTheme = mediaQuery.matches ? 'dark' : 'light'
        const root = window.document.documentElement
        root.classList.remove('light', 'dark')
        root.classList.add(systemTheme)
        setResolvedTheme(systemTheme)
      }
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme, mounted])

  const setTheme = (newTheme: Theme) => {
    localStorage.setItem(storageKey, newTheme)
    setThemeState(newTheme)
  }
  
  const setThemeName = (name: string) => {
    localStorage.setItem(themeNameStorageKey, name)
    setThemeNameState(name)
  }
  
  const setCodeTheme = (name: string) => {
    localStorage.setItem(codeThemeStorageKey, name)
    setCodeThemeState(name)
  }
  
  const setFontSize = (size: string) => {
    localStorage.setItem(fontSizeStorageKey, size)
    setFontSizeState(size)
  }

  const value = {
    theme,
    setTheme,
    resolvedTheme,
    themeName,
    setThemeName,
    codeTheme,
    setCodeTheme,
    fontSize,
    setFontSize,
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)

  if (context === undefined)
    throw new Error('useTheme must be used within a ThemeProvider')

  return context
}
