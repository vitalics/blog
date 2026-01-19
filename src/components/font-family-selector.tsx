'use client'

import { BookText, Check } from 'lucide-react'
import { useTheme } from './theme-provider'
import { useState } from 'react'

const FONT_FAMILIES = [
  { value: 'geist', label: 'Geist', font: 'var(--font-geist-sans), Geist, sans-serif' },
  { value: 'system', label: 'System Default', font: 'system-ui, -apple-system, sans-serif' },
  { value: 'serif', label: 'Serif', font: 'Georgia, serif' },
  { value: 'arial', label: 'Arial', font: 'Arial, sans-serif' },
  { value: 'verdana', label: 'Verdana', font: 'Verdana, sans-serif' },
  { value: 'tahoma', label: 'Tahoma', font: 'Tahoma, sans-serif' },
] as const

export type FontFamily = typeof FONT_FAMILIES[number]['value']

export function FontFamilySelector() {
  const { fontFamily, setFontFamily } = useTheme()
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="rounded-md p-2 hover:bg-accent"
        aria-label="Select font family"
        title="Select font family"
      >
        <BookText className="h-5 w-5" />
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
              Text Font
            </div>
            <div className="space-y-1">
              {FONT_FAMILIES.map((fontFamilyOption) => (
                <button
                  key={fontFamilyOption.value}
                  onClick={() => {
                    setFontFamily(fontFamilyOption.value)
                    setIsOpen(false)
                  }}
                  className="flex w-full items-center justify-between rounded-sm px-2 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                >
                  <span style={{ fontFamily: fontFamilyOption.font }}>
                    {fontFamilyOption.label}
                  </span>
                  {fontFamily === fontFamilyOption.value && (
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
