'use client'

import { Code, Check } from 'lucide-react'
import { useTheme } from './theme-provider'
import { getAllCodeThemes } from '@/config/code-themes'
import { useState, useEffect } from 'react'

export function CodeThemeSelector() {
  const { codeTheme, setCodeTheme } = useTheme()
  const [isOpen, setIsOpen] = useState(false)
  const themes = getAllCodeThemes()



  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="rounded-md p-2 hover:bg-accent"
        aria-label="Select code theme"
        title="Select code theme"
      >
        <Code className="h-5 w-5" />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute right-0 top-full z-50 mt-2 w-48 rounded-md border bg-popover p-2 shadow-lg">
            <div className="mb-2 px-2 text-sm font-semibold text-muted-foreground">
              Code Theme
            </div>
            <div className="max-h-80 space-y-1 overflow-y-auto">
              {themes.map((theme) => (
                <button
                  key={theme.name}
                  onClick={() => {
                    setCodeTheme(theme.name)
                    // Also set a cookie for server-side rendering
                    document.cookie = `blog-code-theme=${theme.name}; path=/; max-age=31536000; SameSite=Lax`
                    setIsOpen(false)
                    // Reload the page to apply new theme
                    window.location.reload()
                  }}
                  className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                >
                  <span>{theme.label}</span>
                  {codeTheme === theme.name && (
                    <Check className="h-4 w-4 shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
