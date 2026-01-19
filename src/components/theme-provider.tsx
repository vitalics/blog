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
  fontFamilyStorageKey?: string
  codeFontFamilyStorageKey?: string
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
  fontFamily: string
  setFontFamily: (family: string) => void
  codeFontFamily: string
  setCodeFontFamily: (family: string) => void
}

const ThemeProviderContext = createContext<ThemeProviderState | undefined>(undefined)

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'blog-theme',
  themeNameStorageKey = 'blog-theme-name',
  codeThemeStorageKey = 'blog-code-theme',
  fontSizeStorageKey = 'blog-font-size',
  fontFamilyStorageKey = 'blog-font-family',
  codeFontFamilyStorageKey = 'blog-code-font-family',
  ...props
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme)
  const [themeName, setThemeNameState] = useState<string>('default')
  const [codeTheme, setCodeThemeState] = useState<string>('github')
  const [fontSize, setFontSizeState] = useState<string>('medium')
  const [fontFamily, setFontFamilyState] = useState<string>('system')
  const [codeFontFamily, setCodeFontFamilyState] = useState<string>('mono')
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    
    // Check if this is the user's first visit
    const hasVisitedBefore = localStorage.getItem('blog-has-visited')
    const isFirstVisit = !hasVisitedBefore
    
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
    
    // Get font family from localStorage or set default for first-time users
    const storedFontFamily = localStorage.getItem(fontFamilyStorageKey)
    if (storedFontFamily) {
      setFontFamilyState(storedFontFamily)
    } else if (isFirstVisit) {
      // Set system default for first-time users
      setFontFamilyState('system')
      localStorage.setItem(fontFamilyStorageKey, 'system')
    }
    
    // Get code font family from localStorage or set default for first-time users
    const storedCodeFontFamily = localStorage.getItem(codeFontFamilyStorageKey)
    if (storedCodeFontFamily) {
      setCodeFontFamilyState(storedCodeFontFamily)
    } else if (isFirstVisit) {
      // Set system mono for first-time users
      setCodeFontFamilyState('mono')
      localStorage.setItem(codeFontFamilyStorageKey, 'mono')
    }
    
    // Mark that the user has visited
    if (isFirstVisit) {
      localStorage.setItem('blog-has-visited', 'true')
      console.log('👋 Welcome! Default fonts set to System Default & System Mono for better compatibility.')
    }
  }, [storageKey, themeNameStorageKey, codeThemeStorageKey, fontSizeStorageKey, fontFamilyStorageKey, codeFontFamilyStorageKey])

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
  
  // Update font family
  useEffect(() => {
    if (!mounted) return
    const root = window.document.documentElement
    
    const fontFamilyMap: Record<string, string> = {
      geist: 'var(--font-geist-sans), Geist, sans-serif',
      system: 'system-ui, -apple-system, sans-serif',
      serif: 'Georgia, serif',
      arial: 'Arial, sans-serif',
      verdana: 'Verdana, sans-serif',
      tahoma: 'Tahoma, sans-serif',
    }
    
    root.style.setProperty('--base-font-family', fontFamilyMap[fontFamily] || fontFamilyMap.system)
    root.setAttribute('data-font-family', fontFamily)
  }, [fontFamily, mounted])
  
  // Update code font family
  useEffect(() => {
    if (!mounted) return
    const root = window.document.documentElement
    
    const codeFontFamilyMap: Record<string, string> = {
      'geist-mono': 'var(--font-geist-mono), Geist Mono, monospace',
      'operator-mono': 'Operator Mono, monospace',
      'jetbrains-mono': 'JetBrains Mono, monospace',
      'maple-mono': 'Maple Mono, monospace',
      mono: 'ui-monospace, monospace',
      consolas: 'Consolas, monospace',
      courier: 'Courier New, monospace',
    }
    
    const fontValue = codeFontFamilyMap[codeFontFamily] || codeFontFamilyMap.mono
    console.log('Setting code font family:', codeFontFamily, '→', fontValue)
    root.style.setProperty('--code-font-family', fontValue)
    root.setAttribute('data-code-font-family', codeFontFamily)
    
    // Force a reflow to ensure the change is applied
    root.offsetHeight
  }, [codeFontFamily, mounted])

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
  
  const setFontFamily = (family: string) => {
    localStorage.setItem(fontFamilyStorageKey, family)
    setFontFamilyState(family)
  }
  
  const setCodeFontFamily = (family: string) => {
    localStorage.setItem(codeFontFamilyStorageKey, family)
    setCodeFontFamilyState(family)
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
    fontFamily,
    setFontFamily,
    codeFontFamily,
    setCodeFontFamily,
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
