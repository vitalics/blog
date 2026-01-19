'use client'

import { FileCode, Check } from 'lucide-react'
import { useTheme } from './theme-provider'
import { useState } from 'react'

const CODE_FONT_FAMILIES = [
  { value: 'geist-mono', label: 'Geist Mono', font: 'var(--font-geist-mono), Geist Mono, monospace' },
  { value: 'operator-mono', label: 'Operator Mono', font: 'Operator Mono, monospace' },
  { value: 'jetbrains-mono', label: 'JetBrains Mono', font: 'JetBrains Mono, monospace' },
  { value: 'maple-mono', label: 'Maple Mono', font: 'Maple Mono, monospace' },
  { value: 'mono', label: 'System Mono', font: 'ui-monospace, monospace' },
  { value: 'consolas', label: 'Consolas', font: 'Consolas, monospace' },
  { value: 'courier', label: 'Courier New', font: 'Courier New, monospace' },
] as const

export type CodeFontFamily = typeof CODE_FONT_FAMILIES[number]['value']

export function CodeFontFamilySelector() {
  const { codeFontFamily, setCodeFontFamily } = useTheme()
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="rounded-md p-2 hover:bg-accent"
        aria-label="Select code font family"
        title="Select code font family"
      >
        <FileCode className="h-5 w-5" />
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
              Code Font
            </div>
            <div className="space-y-1">
              {CODE_FONT_FAMILIES.map((fontFamilyOption) => (
                <button
                  key={fontFamilyOption.value}
                  onClick={() => {
                    setCodeFontFamily(fontFamilyOption.value)
                    setIsOpen(false)
                  }}
                  className="flex w-full items-center justify-between rounded-sm px-2 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                >
                  <span style={{ fontFamily: fontFamilyOption.font }}>
                    {fontFamilyOption.label}
                  </span>
                  {codeFontFamily === fontFamilyOption.value && (
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
