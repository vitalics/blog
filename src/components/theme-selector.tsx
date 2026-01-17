'use client'

import { Palette, Check } from 'lucide-react'
import { useTheme } from './theme-provider'
import { getAllThemes } from '@/config/themes'
import { useState } from 'react'

export function ThemeSelector() {
  const { themeName, setThemeName, resolvedTheme } = useTheme()
  const [isOpen, setIsOpen] = useState(false)
  const themes = getAllThemes()

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="rounded-md p-2 hover:bg-accent"
        aria-label="Select theme"
        title="Select theme"
      >
        <Palette className="h-5 w-5" />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-md border bg-popover p-2 shadow-lg">
            <div className="mb-2 px-2 text-sm font-semibold text-muted-foreground">
              Select Theme
            </div>
            <div className="space-y-1">
              {themes.map((theme) => {
                const colors = resolvedTheme === 'dark' ? theme.dark : theme.light
                return (
                  <button
                    key={theme.name}
                    onClick={() => {
                      setThemeName(theme.name)
                      setIsOpen(false)
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded-sm px-2 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                  >
                    <div className="flex items-center gap-2">
                      {/* Color Preview Dots */}
                      <div className="flex gap-0.5">
                        <div
                          className="h-3 w-3 rounded-full border border-border/50"
                          style={{ backgroundColor: colors.primary }}
                          title="Primary"
                        />
                        <div
                          className="h-3 w-3 rounded-full border border-border/50"
                          style={{ backgroundColor: colors.secondary }}
                          title="Secondary"
                        />
                        <div
                          className="h-3 w-3 rounded-full border border-border/50"
                          style={{ backgroundColor: colors.accent }}
                          title="Accent"
                        />
                        <div
                          className="h-3 w-3 rounded-full border border-border/50"
                          style={{ backgroundColor: colors.muted }}
                          title="Muted"
                        />
                      </div>
                      <span>{theme.label}</span>
                    </div>
                    {themeName === theme.name && (
                      <Check className="h-4 w-4 shrink-0" />
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
