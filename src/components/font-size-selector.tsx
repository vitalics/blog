'use client'

import { Type, Check } from 'lucide-react'
import { useTheme } from './theme-provider'
import { useState } from 'react'
import { FONT_SIZES } from '@/config/font-sizes'

export function FontSizeSelector() {
  const { fontSize, setFontSize } = useTheme()
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="rounded-md p-2 hover:bg-accent"
        aria-label="Select font size"
        title="Select font size"
      >
        <Type className="h-5 w-5" />
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
              Font Size
            </div>
            <div className="space-y-1">
              {FONT_SIZES.map((fontSizeOption) => (
                <button
                  key={fontSizeOption.value}
                  onClick={() => {
                    setFontSize(fontSizeOption.value)
                    setIsOpen(false)
                  }}
                  className="flex w-full items-center justify-between rounded-sm px-2 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                >
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: fontSizeOption.size }}>A</span>
                    <span>{fontSizeOption.label}</span>
                  </div>
                  {fontSize === fontSizeOption.value && (
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
