'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  HexColorPicker,
  RgbStringColorPicker,
  HslStringColorPicker,
} from 'react-colorful'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

// EyeDropper is not in standard TS lib yet
declare global {
  interface Window {
    EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> }
  }
}

// ---------------------------------------------------------------------------
// IndexedDB — color-picker DB (favorites + recents)
// ---------------------------------------------------------------------------

const CP_DB = 'color-picker'
const CP_DB_VERSION = 1
const CP_FAVORITES_STORE = 'favorites'
const CP_RECENTS_STORE = 'recents'
const MAX_RECENTS = 10
const MAX_FAVORITES = 20

interface StoredColor {
  hex: string       // keyPath — e.g. "#ff0000"
  addedAt: number   // Date.now()
}

let cpDbPromise: Promise<IDBDatabase> | null = null

function openCpDb(): Promise<IDBDatabase> {
  if (cpDbPromise) return cpDbPromise
  cpDbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(CP_DB, CP_DB_VERSION)
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(CP_FAVORITES_STORE)) {
        db.createObjectStore(CP_FAVORITES_STORE, { keyPath: 'hex' })
      }
      if (!db.objectStoreNames.contains(CP_RECENTS_STORE)) {
        db.createObjectStore(CP_RECENTS_STORE, { keyPath: 'hex' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => { cpDbPromise = null; reject(req.error) }
  })
  return cpDbPromise
}

async function cpGetAll(store: string): Promise<StoredColor[]> {
  const db = await openCpDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly')
    const req = tx.objectStore(store).getAll()
    req.onsuccess = () => resolve((req.result as StoredColor[]) ?? [])
    req.onerror = () => reject(req.error)
  })
}

async function cpPut(store: string, hex: string): Promise<void> {
  const db = await openCpDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite')
    tx.objectStore(store).put({ hex, addedAt: Date.now() } satisfies StoredColor)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function cpDelete(store: string, hex: string): Promise<void> {
  const db = await openCpDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite')
    tx.objectStore(store).delete(hex)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/** Add to recents, evicting oldest if over MAX_RECENTS. */
async function cpAddRecent(hex: string): Promise<StoredColor[]> {
  await cpPut(CP_RECENTS_STORE, hex)
  const all = await cpGetAll(CP_RECENTS_STORE)
  const sorted = all.sort((a, b) => b.addedAt - a.addedAt)
  // Evict oldest beyond limit
  for (const old of sorted.slice(MAX_RECENTS)) {
    await cpDelete(CP_RECENTS_STORE, old.hex)
  }
  return sorted.slice(0, MAX_RECENTS)
}

// ---------------------------------------------------------------------------
// Color conversion helpers
// ---------------------------------------------------------------------------

function hexToRgbString(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return 'rgb(0, 0, 0)'
  return `rgb(${r}, ${g}, ${b})`
}

function rgbStringToHex(rgb: string): string {
  const m = rgb.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/)
  if (!m) return '#000000'
  return (
    '#' +
    [m[1], m[2], m[3]]
      .map((n) => Number(n).toString(16).padStart(2, '0'))
      .join('')
  )
}

function hexToHslString(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  if ([r, g, b].some(Number.isNaN)) return 'hsl(0, 0%, 0%)'
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }
  return `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`
}

function hslStringToHex(hsl: string): string {
  const m = hsl.match(/hsl\(\s*(\d+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*\)/)
  if (!m) return '#000000'
  const h = Number(m[1]) / 360
  const s = Number(m[2]) / 100
  const l = Number(m[3]) / 100
  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t
    if (tt < 0) tt += 1
    if (tt > 1) tt -= 1
    if (tt < 1 / 6) return p + (q - p) * 6 * tt
    if (tt < 1 / 2) return q
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6
    return p
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const r = hue2rgb(p, q, h + 1 / 3)
  const g = hue2rgb(p, q, h)
  const b = hue2rgb(p, q, h - 1 / 3)
  return (
    '#' +
    [r, g, b]
      .map((n) => Math.round(n * 255).toString(16).padStart(2, '0'))
      .join('')
  )
}

// ---------------------------------------------------------------------------
// Color swatch helper
// ---------------------------------------------------------------------------

interface SwatchProps {
  hex: string
  isFavorite: boolean
  showFavoriteAlways?: boolean
  title?: string
  onClick: () => void
  onToggleFavorite: () => void
}

function Swatch({ hex, isFavorite, showFavoriteAlways, title, onClick, onToggleFavorite }: SwatchProps) {
  return (
    <div className="group flex flex-col items-center gap-0.5">
      <button
        type="button"
        title={title ?? hex}
        onClick={onClick}
        className="h-6 w-6 rounded border border-border transition-transform hover:scale-110 focus:outline-none focus:ring-1 focus:ring-ring"
        style={{ background: hex }}
      />
      <button
        type="button"
        title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        onClick={(e) => { e.stopPropagation(); onToggleFavorite() }}
        className={cn(
          'flex h-3.5 w-3.5 items-center justify-center rounded-full border text-[8px] leading-none transition-opacity',
          isFavorite
            ? 'border-yellow-400 bg-yellow-400 text-yellow-900 opacity-100'
            : showFavoriteAlways
            ? 'border-border bg-background text-muted-foreground opacity-100'
            : 'border-border bg-background text-muted-foreground opacity-0 group-hover:opacity-100',
        )}
      >
        ★
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ColorSchema = 'hex' | 'rgb' | 'hsl' | 'oklch'

const SCHEMAS: { value: ColorSchema; label: string }[] = [
  { value: 'hex', label: 'HEX' },
  { value: 'rgb', label: 'RGB' },
  { value: 'hsl', label: 'HSL' },
  { value: 'oklch', label: 'OKLCH' },
]

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ColorPickerProps {
  /** Hex color string, e.g. "#ff0000" */
  value: string
  onChange: (hex: string) => void
  onBlur?: (hex: string) => void
  disabled?: boolean
  className?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ColorPicker({ value, onChange, onBlur, disabled, className }: ColorPickerProps) {
  const [schema, setSchema] = useState<ColorSchema>('hex')
  const [inputText, setInputText] = useState<string>(value)
  const [open, setOpen] = useState(false)
  const [eyedropperSupported, setEyedropperSupported] = useState(false)
  const [picking, setPicking] = useState(false)

  const [recents, setRecents] = useState<string[]>([])
  const [favorites, setFavorites] = useState<string[]>([])

  // Keep a ref to the latest onChange so the eyedropper callback is never stale
  const onChangeRef = useRef(onChange)
  useEffect(() => { onChangeRef.current = onChange }, [onChange])

  useEffect(() => {
    setEyedropperSupported(typeof window !== 'undefined' && 'EyeDropper' in window)
  }, [])

  // Load recents + favorites from IDB on mount and whenever the popover opens
  const loadPalette = useCallback(() => {
    cpGetAll(CP_RECENTS_STORE)
      .then((all) => setRecents(all.sort((a, b) => b.addedAt - a.addedAt).map((c) => c.hex)))
      .catch(() => {})
    cpGetAll(CP_FAVORITES_STORE)
      .then((all) => setFavorites(all.sort((a, b) => b.addedAt - a.addedAt).map((c) => c.hex)))
      .catch(() => {})
  }, [])

  useEffect(() => { loadPalette() }, [loadPalette])
  useEffect(() => { if (open) loadPalette() }, [open, loadPalette])

  // Keep inputText in sync when popover opens or value changes externally
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) setInputText(schemaValue(value, schema))
      else onBlur?.(value)
      setOpen(nextOpen)
    },
    [value, schema, onBlur],
  )

  // Convert hex → current schema string for display
  function schemaValue(hex: string, s: ColorSchema): string {
    if (s === 'hex') return hex
    if (s === 'rgb') return hexToRgbString(hex)
    if (s === 'hsl') return hexToHslString(hex)
    return hex // oklch — start from hex text, user types manually
  }

  // Convert schema string → hex for storage
  function schemaToHex(text: string, s: ColorSchema): string {
    if (s === 'hex') return text.startsWith('#') ? text : `#${text}`
    if (s === 'rgb') return rgbStringToHex(text)
    if (s === 'hsl') return hslStringToHex(text)
    return text // oklch — not converted; upstream should handle CSS natively
  }

  /** Commit a hex color: fire onChange + add to recents. */
  const commitHex = useCallback((hex: string) => {
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return
    onChange(hex)
    cpAddRecent(hex)
      .then((updated) => setRecents(updated.map((c) => c.hex)))
      .catch(() => {})
  }, [onChange])

  // Called by react-colorful pickers (they always give the full schema value)
  const handlePickerChange = useCallback(
    (pickerValue: string) => {
      const hex = schemaToHex(pickerValue, schema)
      setInputText(pickerValue)
      onChange(hex)
    },
    [schema, onChange],
  )

  // Called when user releases the picker (pointerup equivalent via onBlur on the picker wrapper)
  const handlePickerCommit = useCallback(() => {
    const hex = /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000'
    cpAddRecent(hex)
      .then((updated) => setRecents(updated.map((c) => c.hex)))
      .catch(() => {})
  }, [value])

  // Called when user switches schema tabs
  const handleSchemaChange = useCallback(
    (s: ColorSchema) => {
      setSchema(s)
      setInputText(schemaValue(value, s))
    },
    [value],
  )

  // Text input commit
  const commitInputText = useCallback(() => {
    const hex = schemaToHex(inputText, schema)
    commitHex(hex)
  }, [inputText, schema, commitHex])

  const toggleFavorite = useCallback((hex: string) => {
    if (favorites.includes(hex)) {
      cpDelete(CP_FAVORITES_STORE, hex).catch(() => {})
      setFavorites((prev) => prev.filter((c) => c !== hex))
    } else {
      if (favorites.length >= MAX_FAVORITES) return
      cpPut(CP_FAVORITES_STORE, hex).catch(() => {})
      setFavorites((prev) => [hex, ...prev])
    }
  }, [favorites])

  const displayHex = /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000'

  // Which picker component to show
  const pickerValue = schemaValue(displayHex, schema)

  // EyeDropper — must close the popover first so it doesn't block the overlay
  const handleEyedropper = useCallback(() => {
    if (!window.EyeDropper) return
    setOpen(false)
    setPicking(true)
    const dropper = new window.EyeDropper()
    dropper.open().then(({ sRGBHex }) => {
      const hex = sRGBHex.toLowerCase()
      onChangeRef.current(hex)
      setInputText(schemaValue(hex, schema))
      cpAddRecent(hex).then((updated) => setRecents(updated.map((c) => c.hex))).catch(() => {})
    }).catch(() => {
      // user cancelled — no-op
    }).finally(() => {
      setPicking(false)
    })
  }, [schema])

  const hasPalette = recents.length > 0 || favorites.length > 0

  return (
    <Popover open={open} onOpenChange={disabled ? undefined : handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label="Pick color"
          className={cn(
            'flex h-8 w-10 cursor-pointer items-center justify-center rounded border bg-background p-0.5 transition-opacity disabled:cursor-not-allowed disabled:opacity-30',
            picking && 'ring-2 ring-ring ring-offset-1',
            className,
          )}
        >
          <span
            className={cn('h-full w-full rounded-sm', picking && 'animate-pulse')}
            style={{ background: displayHex }}
          />
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-64 p-0 lg:w-72" align="start">
        <div className="max-h-[min(480px,80svh)] overflow-y-auto p-3 lg:p-4">
        {/* Schema tabs */}
        <div className="mb-3 flex gap-1 lg:mb-4 lg:gap-1.5">
          {SCHEMAS.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => handleSchemaChange(s.value)}
              className={cn(
                'flex-1 rounded px-1 py-0.5 text-xs font-medium transition-colors lg:py-1',
                schema === s.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80',
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Color picker — oklch has no visual slider, just text input */}
        {/* biome-ignore lint/a11y/noStaticElementInteractions: commit recents on picker release */}
        <div
          className="mb-3 [&_.react-colorful]:w-full [&_.react-colorful\_\_saturation]:rounded-t-md [&_.react-colorful\_\_hue]:rounded-b-md lg:mb-4"
          onPointerUp={handlePickerCommit}
        >
          {schema === 'hex' && (
            <HexColorPicker color={displayHex} onChange={handlePickerChange} />
          )}
          {schema === 'rgb' && (
            <RgbStringColorPicker color={pickerValue} onChange={handlePickerChange} />
          )}
          {schema === 'hsl' && (
            <HslStringColorPicker color={pickerValue} onChange={handlePickerChange} />
          )}
          {schema === 'oklch' && (
            <div className="flex h-10 items-center justify-center rounded-md border bg-muted/40 text-xs text-muted-foreground lg:h-12">
              Enter OKLCH value below
            </div>
          )}
        </div>

        {/* Text input + eyedropper + swatch */}
        <div className="mb-3 flex gap-2 lg:mb-4">
          <Input
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onBlur={commitInputText}
            onKeyDown={(e) => e.key === 'Enter' && commitInputText()}
            className="h-8 font-mono text-xs lg:h-9"
            spellCheck={false}
          />
          {eyedropperSupported && (
            <button
              type="button"
              title="Pick color from screen"
              aria-label="Eyedropper"
              onClick={handleEyedropper}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:h-9 lg:w-9"
            >
              {/* Pipette / eyedropper SVG — no extra icon dependency */}
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 2a4 4 0 0 1 4 4c0 1.5-.5 2.8-1.4 3.8L6 18.4V22H2v-4l8.6-8.6A4 4 0 0 1 12 2z" />
                <line x1="18" y1="6" x2="20" y2="4" />
              </svg>
            </button>
          )}
          {/* Live preview swatch */}
          <span
            className="h-8 w-8 shrink-0 rounded border lg:h-9 lg:w-9"
            style={{ background: displayHex }}
          />
        </div>

        {/* Recent + Favorite swatches */}
        {hasPalette && (
          <div className="space-y-2 border-t pt-2 lg:space-y-3 lg:pt-3">
            {favorites.length > 0 && (
              <div>
                <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground lg:mb-1.5">Favorites</p>
                <div className="flex flex-wrap gap-1.5 lg:gap-2">
                  {favorites.map((hex) => (
                    <Swatch
                      key={hex}
                      hex={hex}
                      isFavorite
                      onClick={() => commitHex(hex)}
                      onToggleFavorite={() => toggleFavorite(hex)}
                    />
                  ))}
                </div>
              </div>
            )}
            {recents.length > 0 && (
              <div>
                <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground lg:mb-1.5">Recent</p>
                <div className="flex flex-wrap gap-1.5 lg:gap-2">
                  {recents.map((hex) => (
                    <Swatch
                      key={hex}
                      hex={hex}
                      isFavorite={favorites.includes(hex)}
                      showFavoriteAlways
                      onClick={() => commitHex(hex)}
                      onToggleFavorite={() => toggleFavorite(hex)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
