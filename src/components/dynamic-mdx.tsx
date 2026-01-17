'use client'

import { useEffect, useState } from 'react'
import { useTheme } from './theme-provider'
import { getCodeTheme } from '@/config/code-themes'

export function DynamicMDX({ children }: { children: React.ReactNode }) {
  const { codeTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    
    const theme = getCodeTheme(codeTheme)
    const activeTheme = resolvedTheme === 'dark' ? theme.dark : theme.light
    
    // Update data attribute for CSS targeting
    document.documentElement.setAttribute('data-active-code-theme', activeTheme)
  }, [codeTheme, resolvedTheme, mounted])

  return <>{children}</>
}
