'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, Download, ImageIcon, X, ArrowRight, Lock, Unlock, Sparkles, Eye, EyeOff, RefreshCw, ChevronsUpDown, Check, ArrowLeft, Share2 } from 'lucide-react'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { ColorPicker } from '@/components/ui/color-picker'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { PROVIDER_LIST, getProvider, type AiModel } from '@/lib/ai-providers'

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

type ConvertStatus = 'idle' | 'converting' | 'done' | 'error'

interface FormatOption {
  value: string
  label: string
  /** Only shown when the source file matches this predicate */
  onlyFor?: (sourceType: string) => boolean
}

const ALL_FORMAT_OPTIONS: FormatOption[] = [
  { value: 'webp', label: 'WebP' },
  { value: 'png', label: 'PNG' },
  { value: 'jpeg', label: 'JPG' },
  // GIF passthrough — only meaningful when the source is already a GIF
  {
    value: 'gif',
    label: 'GIF',
    onlyFor: (t) => t === 'image/gif',
  },
]

const IDB_DB = 'image-converter'
const IDB_STORE = 'ai-settings'
const IDB_KEY = 'settings'
const IDB_KEY_V2 = 'settings-v2'

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const aiSchema = z.object({
  provider: z.string().min(1, 'Select a provider'),
  apiKey: z.string().min(1, 'API key is required').min(10, 'API key seems too short'),
  model: z.string().min(1, 'Select or enter a model'),
  prompt: z.string().optional(),
})

type AiFields = z.infer<typeof aiSchema>
type AiErrors = Partial<Record<keyof AiFields, string>>

// ---------------------------------------------------------------------------
// IndexedDB helpers
// ---------------------------------------------------------------------------

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbGet<T>(key: IDBValidKey): Promise<T | undefined> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly')
    const req = tx.objectStore(IDB_STORE).get(key)
    req.onsuccess = () => resolve(req.result as T)
    req.onerror = () => reject(req.error)
  })
}

async function idbSet(key: IDBValidKey, value: unknown): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite')
    tx.objectStore(IDB_STORE).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function fileExtension(format: string): string {
  return format === 'jpeg' ? 'jpg' : format
}

/** Returns e.g. "sk-or-••••••••1a2b" */
function maskApiKey(key: string): string {
  if (key.length <= 10) return '•'.repeat(key.length)
  return `${key.slice(0, 6)}${'•'.repeat(Math.max(4, key.length - 10))}${key.slice(-4)}`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ImageConverterPage() {
  const router = useRouter()

  // --- source image ---
  const [sourceFile, setSourceFile] = useState<File | null>(null)
  const [sourcePreview, setSourcePreview] = useState<string | null>(null)
  const [sourceDimensions, setSourceDimensions] = useState<{ w: number; h: number } | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // --- conversion settings ---
  const [targetFormat, setTargetFormat] = useState('webp')
  const [width, setWidth] = useState<number | ''>('')
  const [height, setHeight] = useState<number | ''>('')
  const [lockAspect, setLockAspect] = useState(true)
  const [bgColor, setBgColor] = useState('#000000')
  const [bgTransparent, setBgTransparent] = useState(true)
  const aspectRef = useRef<number>(1)

  // --- conversion result ---
  const [status, setStatus] = useState<ConvertStatus>('idle')
  const [resultBlob, setResultBlob] = useState<Blob | null>(null)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [resultFormat, setResultFormat] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [customName, setCustomName] = useState<string | null>(null)
  const [canShare, setCanShare] = useState(false)

  // --- AI enhancer ---
  const [aiEnabled, setAiEnabled] = useState(false)
  const [aiProvider, setAiProvider] = useState('openrouter')
  const [aiApiKey, setAiApiKey] = useState('')
  const [aiModel, setAiModel] = useState('')
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiErrors, setAiErrors] = useState<AiErrors>({})
  const [aiStatus, setAiStatus] = useState<'idle' | 'enhancing' | 'done' | 'error'>('idle')
  const [aiErrorMsg, setAiErrorMsg] = useState<string | null>(null)
  const [enhancedUrl, setEnhancedUrl] = useState<string | null>(null)
  const [enhancedBlob, setEnhancedBlob] = useState<Blob | null>(null)
  // API key display
  const [apiKeyFocused, setApiKeyFocused] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  // Model fetching
  const [models, setModels] = useState<AiModel[]>([])
  const [modelsFetching, setModelsFetching] = useState(false)
  const [modelsError, setModelsError] = useState<string | null>(null)

  // ---------------------------------------------------------------------------
  // Derived: visible format options depend on source type
  // ---------------------------------------------------------------------------

  const sourceType = sourceFile?.type ?? ''
  const visibleFormats = ALL_FORMAT_OPTIONS.filter(
    (opt) => !opt.onlyFor || opt.onlyFor(sourceType),
  )
  const isSourceGif = sourceType === 'image/gif'

  // ---------------------------------------------------------------------------
  // Load AI settings from IndexedDB on mount
  // ---------------------------------------------------------------------------

  // Per-provider API keys: { provider, apiKeys: { [providerId]: string }, model, prompt }
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({})

  useEffect(() => {
    ;(async () => {
      try {
        const saved = await idbGet<{ provider?: string; apiKeys?: Record<string, string>; model: string; prompt: string }>(IDB_KEY_V2)
        if (saved) {
          if (saved.provider) setAiProvider(saved.provider)
          if (saved.apiKeys) {
            setApiKeys(saved.apiKeys)
            setAiApiKey(saved.apiKeys[saved.provider ?? 'openrouter'] ?? '')
          }
          if (saved.model) setAiModel(saved.model)
          if (saved.prompt) setAiPrompt(saved.prompt)
          return
        }
        // Migrate from v1
        const v1 = await idbGet<{ provider: string; apiKey: string; model: string; prompt: string }>(IDB_KEY)
        if (!v1) return
        if (v1.provider) setAiProvider(v1.provider)
        if (v1.apiKey) {
          const migrated = { [v1.provider ?? 'openrouter']: v1.apiKey }
          setApiKeys(migrated)
          setAiApiKey(v1.apiKey)
        }
        if (v1.model) setAiModel(v1.model)
        if (v1.prompt) setAiPrompt(v1.prompt)
      } catch {
        // ignore
      }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persist AI settings whenever they change
  useEffect(() => {
    idbSet(IDB_KEY_V2, { provider: aiProvider, apiKeys, model: aiModel, prompt: aiPrompt }).catch(() => {})
  }, [aiProvider, apiKeys, aiModel, aiPrompt])

  // When provider changes: fill API key from stored keys (or clear), reset models
  useEffect(() => {
    setAiApiKey(apiKeys[aiProvider] ?? '')
    setModels([])
    setModelsError(null)
    setAiModel('')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiProvider])

  // ---------------------------------------------------------------------------
  // File loading
  // ---------------------------------------------------------------------------

  const loadFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith('image/')) return
      setResultBlob(null)
      if (resultUrl) URL.revokeObjectURL(resultUrl)
      setResultUrl(null)
      if (enhancedUrl) URL.revokeObjectURL(enhancedUrl)
      setEnhancedUrl(null)
      setEnhancedBlob(null)
      setStatus('idle')
      setAiStatus('idle')
      setErrorMsg(null)
      setAiErrorMsg(null)
      setResultFormat(null)
      setCustomName(null)
      setSourceFile(file)
      setTargetFormat(file.type === 'image/gif' ? 'webp' : 'webp')

      const reader = new FileReader()
      reader.onload = (e) => {
        const src = e.target?.result as string
        setSourcePreview(src)
        const img = new Image()
        img.onload = () => {
          setSourceDimensions({ w: img.naturalWidth, h: img.naturalHeight })
          aspectRef.current = img.naturalWidth / img.naturalHeight
          setWidth(img.naturalWidth)
          setHeight(img.naturalHeight)
        }
        img.src = src
      }
      reader.readAsDataURL(file)
    },
    // biome-ignore lint/correctness/useExhaustiveDependencies: resultUrl/enhancedUrl tracked via closure
    [resultUrl, enhancedUrl],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) loadFile(file)
    },
    [loadFile],
  )

  const handleDropZoneKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      inputRef.current?.click()
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) loadFile(file)
    e.target.value = ''
  }

  const handleClear = () => {
    setSourceFile(null)
    setSourcePreview(null)
    setSourceDimensions(null)
    setResultBlob(null)
    if (resultUrl) URL.revokeObjectURL(resultUrl)
    setResultUrl(null)
    if (enhancedUrl) URL.revokeObjectURL(enhancedUrl)
    setEnhancedUrl(null)
    setEnhancedBlob(null)
    setStatus('idle')
    setAiStatus('idle')
    setErrorMsg(null)
    setAiErrorMsg(null)
    setResultFormat(null)
    setCustomName(null)
    setWidth('')
    setHeight('')
    setTargetFormat('webp')
  }

  // ---------------------------------------------------------------------------
  // Resize helpers
  // ---------------------------------------------------------------------------

  const handleWidthChange = (val: string) => {
    const n = val === '' ? '' : Math.max(1, parseInt(val, 10) || 1)
    setWidth(n)
    if (lockAspect && n !== '') setHeight(Math.max(1, Math.round((n as number) / aspectRef.current)))
  }

  const handleHeightChange = (val: string) => {
    const n = val === '' ? '' : Math.max(1, parseInt(val, 10) || 1)
    setHeight(n)
    if (lockAspect && n !== '') setWidth(Math.max(1, Math.round((n as number) * aspectRef.current)))
  }

  // ---------------------------------------------------------------------------
  // Convert (worker)
  // ---------------------------------------------------------------------------

  const handleConvert = async () => {
    if (!sourceFile) return
    setStatus('converting')
    setErrorMsg(null)
    setResultFormat(null)
    setCustomName(null)

    const arrayBuffer = await sourceFile.arrayBuffer()
    const worker = new Worker('/workers/image-converter.worker.js')

    worker.onmessage = (e: MessageEvent) => {
      worker.terminate()
      if (e.data.error) { setErrorMsg(e.data.error); setStatus('error'); return }
      const blob: Blob = e.data.result
      setResultBlob(blob)
      setResultUrl(URL.createObjectURL(blob))
      setResultFormat(e.data.format ?? targetFormat)
      setStatus('done')
      // Test with the real blob — desktop Chrome has navigator.share but returns
      // false for canShare({ files }) so the button stays hidden there
      setCanShare(
        !!navigator.share &&
        !!navigator.canShare &&
        navigator.canShare({ files: [new File([blob], 'test', { type: blob.type })] })
      )
    }

    worker.onerror = (e) => {
      worker.terminate()
      setErrorMsg(e.message || 'Worker error')
      setStatus('error')
    }

    worker.postMessage(
      {
        imageData: arrayBuffer,
        sourceType: sourceFile.type,
        targetFormat,
        outputWidth: width !== '' ? (width as number) : undefined,
        outputHeight: height !== '' ? (height as number) : undefined,
        bgColor: bgTransparent ? null : bgColor,
      },
      [arrayBuffer],
    )
  }

  // ---------------------------------------------------------------------------
  // Fetch models
  // ---------------------------------------------------------------------------

  const handleFetchModels = async () => {
    if (!aiApiKey) return
    const adapter = getProvider(aiProvider)
    setModelsFetching(true)
    setModelsError(null)
    setModels([])
    try {
      const list = await adapter.fetchModels(aiApiKey)
      setModels(list)
      if (list.length > 0 && !list.find((m) => m.id === aiModel)) {
        setAiModel(list[0].id)
      }
    } catch (err) {
      setModelsError(err instanceof Error ? err.message : 'Failed to fetch models')
    } finally {
      setModelsFetching(false)
    }
  }

  // ---------------------------------------------------------------------------
  // AI Enhance
  // ---------------------------------------------------------------------------

  const validateAi = (): boolean => {
    const result = aiSchema.safeParse({ provider: aiProvider, apiKey: aiApiKey, model: aiModel, prompt: aiPrompt || undefined })
    if (result.success) { setAiErrors({}); return true }
    const errs: AiErrors = {}
    for (const issue of result.error.issues) {
      const key = issue.path[0] as keyof AiFields
      if (!errs[key]) errs[key] = issue.message
    }
    setAiErrors(errs)
    return false
  }

  const handleAiEnhance = async () => {
    if (!resultBlob) return
    if (!validateAi()) return

    setAiStatus('enhancing')
    setAiErrorMsg(null)
    if (enhancedUrl) URL.revokeObjectURL(enhancedUrl)
    setEnhancedUrl(null)
    setEnhancedBlob(null)

    try {
      const adapter = getProvider(aiProvider)
      const blob = await adapter.enhance({
        imageBlob: resultBlob,
        prompt: aiPrompt,
        apiKey: aiApiKey,
        model: aiModel,
      })
      setEnhancedBlob(blob)
      setEnhancedUrl(URL.createObjectURL(blob))
      setAiStatus('done')
    } catch (err) {
      setAiErrorMsg(err instanceof Error ? err.message : String(err))
      setAiStatus('error')
    }
  }

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------

  const effectiveFormat = resultFormat ?? targetFormat
  const defaultOutputName = sourceFile
    ? `${sourceFile.name.replace(/\.[^.]+$/, '')}.${fileExtension(effectiveFormat)}`
    : `converted.${fileExtension(effectiveFormat)}`
  const outputName = customName ?? defaultOutputName

  const enhancedName = outputName.replace(/(\.[^.]+)$/, '-enhanced$1')

  const aspectLabel = sourceDimensions
    ? (() => {
        const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
        const d = gcd(sourceDimensions.w, sourceDimensions.h)
        return `${sourceDimensions.w / d}:${sourceDimensions.h / d}`
      })()
    : null

  const [providerOpen, setProviderOpen] = useState(false)

  const currentAdapter = getProvider(aiProvider)
  const isCustomProvider = aiProvider === 'custom'
  const showModelDropdown = !isCustomProvider && models.length > 0
  const showModelTextInput = isCustomProvider

  const handleShare = (blob: Blob, filename: string) => {
    const file = new File([blob], filename, { type: blob.type })
    // Call share() synchronously within the user gesture — no awaited work before it
    // to preserve transient activation (required by Safari).
    // Only pass `files` — mixing `title` with `files` causes some platforms
    // (macOS Safari) to share only text and drop the file attachment.
    navigator.share({ files: [file] }).catch(() => {})
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <TooltipProvider>
      <div className="mx-auto max-w-4xl px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <div className="mb-2 flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label="Go back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <ImageIcon className="h-7 w-7 text-muted-foreground" aria-hidden="true" />
            <h1 className="text-4xl font-bold">Image Converter</h1>
          </div>
          <p className="text-muted-foreground">
            Convert and resize images entirely in your browser. Nothing is uploaded — runs in a Web Worker.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* ---------------------------------------------------------------- */}
          {/* Left: Drop zone                                                   */}
          {/* ---------------------------------------------------------------- */}
          <div className="space-y-4">
            <h2 className="font-semibold">Source image</h2>

            {!sourceFile ? (
              // biome-ignore lint/a11y/useSemanticElements: drop zone needs div for drag events
              <div
                role="button"
                tabIndex={0}
                onDrop={handleDrop}
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
                onDragLeave={() => setIsDragOver(false)}
                onClick={() => inputRef.current?.click()}
                onKeyDown={handleDropZoneKeyDown}
                aria-label="Upload image: drag and drop or press Enter to browse"
                className={[
                  'flex min-h-48 cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 text-center transition-colors',
                  isDragOver
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50 hover:bg-accent/30',
                ].join(' ')}
              >
                <Upload className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
                <div>
                  <p className="font-medium">Drop an image here</p>
                  <p className="text-sm text-muted-foreground">or click to browse</p>
                </div>
                <p className="text-xs text-muted-foreground">PNG, JPG, WebP, GIF, BMP…</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative overflow-hidden rounded-lg border">
                  {/* biome-ignore lint/performance/noImgElement: next/image not suitable for dynamic blobs */}
                  <img
                    src={sourcePreview!}
                    alt={`Source preview: ${sourceFile.name}`}
                    className="max-h-64 w-full object-contain bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiI+PHJlY3Qgd2lkdGg9IjgiIGhlaWdodD0iOCIgZmlsbD0iI2NjYyIvPjxyZWN0IHg9IjgiIHk9IjgiIHdpZHRoPSI4IiBoZWlnaHQ9IjgiIGZpbGw9IiNjY2MiLz48L3N2Zz4=')]"
                  />
                  <button
                    type="button"
                    onClick={handleClear}
                    className="absolute right-2 top-2 rounded-full border bg-background/80 p-1 hover:bg-background"
                    aria-label="Remove image"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
                <p className="text-sm text-muted-foreground">
                  {sourceFile.name} &middot; {formatBytes(sourceFile.size)}
                  {sourceDimensions && (
                    <span> &middot; {sourceDimensions.w}&times;{sourceDimensions.h}px</span>
                  )}
                </p>
              </div>
            )}

            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              aria-hidden="true"
              tabIndex={-1}
              onChange={handleFileInput}
            />
          </div>

          {/* ---------------------------------------------------------------- */}
          {/* Right: Settings + Result                                          */}
          {/* ---------------------------------------------------------------- */}
          <div className="space-y-5">
            {/* Format */}
            <div className="space-y-2">
              <h2 className="font-semibold" id="format-label">Convert to</h2>
              <div className="flex flex-wrap gap-2" role="group" aria-labelledby="format-label">
                {visibleFormats.map((opt) => (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() => setTargetFormat(opt.value)}
                    aria-pressed={targetFormat === opt.value}
                    className={[
                      'rounded-md border px-4 py-2 text-sm font-medium transition-colors',
                      targetFormat === opt.value
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'hover:border-primary/50 hover:bg-accent',
                    ].join(' ')}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {/* GIF animation warning */}
              {isSourceGif && targetFormat !== 'gif' && (
                <p className="text-xs text-amber-600 dark:text-amber-400" role="note">
                  Browser canvas cannot encode animated images — only the first frame will be exported.
                  Choose <strong>GIF</strong> to keep animation (resize will export as PNG instead).
                </p>
              )}
            </div>

            {/* Resize */}
            <fieldset className="space-y-2 border-0 p-0 m-0">
              <legend className="font-semibold">Resize</legend>
              <div className="flex items-center gap-2">
                <div className="flex flex-1 flex-col gap-1">
                  <label className="text-xs text-muted-foreground" htmlFor="resize-width">Width (px)</label>
                  <input
                    id="resize-width"
                    type="number"
                    min={1}
                    value={width}
                    onChange={(e) => handleWidthChange(e.target.value)}
                    placeholder={sourceDimensions ? String(sourceDimensions.w) : 'auto'}
                    className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setLockAspect((v) => !v)}
                      aria-label={lockAspect ? 'Unlock aspect ratio' : 'Lock aspect ratio'}
                      aria-pressed={lockAspect}
                      className="mt-5 rounded-md border p-1.5 hover:bg-accent transition-colors"
                    >
                      {lockAspect
                        ? <Lock className="h-4 w-4" aria-hidden="true" />
                        : <Unlock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    {lockAspect
                      ? <>Aspect ratio locked{aspectLabel ? ` (${aspectLabel})` : ''}. Click to unlock.</>
                      : 'Aspect ratio unlocked. Width and height are independent.'}
                  </TooltipContent>
                </Tooltip>

                <div className="flex flex-1 flex-col gap-1">
                  <label className="text-xs text-muted-foreground" htmlFor="resize-height">Height (px)</label>
                  <input
                    id="resize-height"
                    type="number"
                    min={1}
                    value={height}
                    onChange={(e) => handleHeightChange(e.target.value)}
                    placeholder={sourceDimensions ? String(sourceDimensions.h) : 'auto'}
                    className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            </fieldset>

            {/* Background */}
            <fieldset className="space-y-2 border-0 p-0 m-0">
              <legend className="font-semibold">Background</legend>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex cursor-pointer select-none items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={bgTransparent}
                    onChange={(e) => setBgTransparent(e.target.checked)}
                    className="h-4 w-4 rounded"
                  />
                  Transparent
                </label>
                {!bgTransparent && (
                  <div className="flex items-center gap-2">
                    <ColorPicker value={bgColor} onChange={setBgColor} />
                    <span className="font-mono text-xs text-muted-foreground">{bgColor}</span>
                  </div>
                )}
                {!bgTransparent && targetFormat === 'jpeg' && (
                  <p className="text-xs text-amber-600 dark:text-amber-400" role="note">
                    JPG doesn&apos;t support transparency — background color will be used.
                  </p>
                )}
              </div>
            </fieldset>

            {/* Convert button */}
            <Button
              type="button"
              onClick={handleConvert}
              disabled={!sourceFile || status === 'converting'}
              className="w-full gap-2"
            >
              {status === 'converting'
                ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" /><span>Converting…</span></>
                : <><ArrowRight className="h-4 w-4" aria-hidden="true" /><span>Convert</span></>}
            </Button>

            {status === 'error' && (
              <p role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {errorMsg}
              </p>
            )}

            {/* Conversion result */}
            {status === 'done' && resultUrl && resultBlob && (
              <div className="space-y-3">
                <div className="overflow-hidden rounded-lg border">
                  {/* biome-ignore lint/performance/noImgElement: next/image not suitable for dynamic blobs */}
                  <img
                    src={resultUrl}
                    alt={`Converted preview: ${outputName}`}
                    className="max-h-64 w-full object-contain bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiI+PHJlY3Qgd2lkdGg9IjgiIGhlaWdodD0iOCIgZmlsbD0iI2NjYyIvPjxyZWN0IHg9IjgiIHk9IjgiIHdpZHRoPSI4IiBoZWlnaHQ9IjgiIGZpbGw9IiNjY2MiLz48L3N2Zz4=')]"
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  {outputName} &middot; {formatBytes(resultBlob.size)}
                  {sourceFile && (
                    <span className="ml-1 text-green-600 dark:text-green-400">
                      ({((1 - resultBlob.size / sourceFile.size) * 100).toFixed(1)}% smaller)
                    </span>
                  )}
                </p>
                {resultFormat && resultFormat !== targetFormat && (
                  <p className="text-xs text-amber-600 dark:text-amber-400" role="note">
                    GIF resize exported as PNG — browser cannot re-encode animated GIF after resize.
                  </p>
                )}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground" htmlFor="output-filename">Output filename</label>
                  <input
                    id="output-filename"
                    type="text"
                    value={outputName}
                    onChange={(e) => setCustomName(e.target.value || defaultOutputName)}
                    className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                    aria-label="Output filename"
                  />
                </div>
                <div className="flex gap-2">
                  <a href={resultUrl} download={outputName} className="flex-1">
                    <Button type="button" variant="outline" className="w-full gap-2">
                      <Download className="h-4 w-4" aria-hidden="true" />
                      Download
                    </Button>
                  </a>
                  {canShare && (
                    <Button type="button" variant="outline" size="icon" aria-label="Share" onClick={() => handleShare(resultBlob, outputName)}>
                      <Share2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* AI Enhancer                                                         */}
        {/* ------------------------------------------------------------------ */}
        <section className="mt-10 rounded-lg border" aria-labelledby="ai-enhancer-heading">
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              <h2 id="ai-enhancer-heading" className="font-semibold">AI Enhancer</h2>
              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">experimental</span>
            </div>
            <Switch
              checked={aiEnabled}
              onCheckedChange={setAiEnabled}
              aria-labelledby="ai-enhancer-heading"
            />
          </div>

          {aiEnabled && (
            <div className="border-t px-5 py-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                Sends the converted image to an AI model via your own API key. Settings are saved locally (IndexedDB). Enhance is only available after converting.
              </p>

              {/* Provider */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="ai-provider-trigger">Provider</label>
                <div className="relative">
                  <button
                    id="ai-provider-trigger"
                    type="button"
                    role="combobox"
                    aria-expanded={providerOpen}
                    aria-haspopup="listbox"
                    onClick={() => setProviderOpen((v) => !v)}
                    className={[
                      'flex w-full items-center justify-between rounded-md border bg-background px-3 py-2 text-sm transition-colors hover:bg-accent focus:outline-none focus:ring-1 focus:ring-primary',
                      aiErrors.provider ? 'border-destructive' : '',
                    ].join(' ')}
                  >
                    <span>{currentAdapter.label}</span>
                    <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  </button>
                  {providerOpen && (
                    <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
                      <Command>
                        <CommandInput placeholder="Search provider…" />
                        <CommandList>
                          <CommandEmpty>No provider found.</CommandEmpty>
                          <CommandGroup>
                            {PROVIDER_LIST.map((p) => (
                              <CommandItem
                                key={p.id}
                                value={p.label}
                                onSelect={() => {
                                  setAiProvider(p.id)
                                  setProviderOpen(false)
                                }}
                              >
                                <Check
                                  className={['h-4 w-4 shrink-0', aiProvider === p.id ? 'opacity-100' : 'opacity-0'].join(' ')}
                                  aria-hidden="true"
                                />
                                {p.label}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </div>
                  )}
                </div>
                {aiErrors.provider && <p role="alert" className="text-xs text-destructive">{aiErrors.provider}</p>}
              </div>

              {/* API Key */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="ai-api-key">
                  API Key <span className="text-destructive" aria-hidden="true">*</span>
                  <span className="sr-only">(required)</span>
                </label>
                <div className="relative">
                  <Input
                    id="ai-api-key"
                    value={apiKeyFocused || showApiKey ? aiApiKey : (aiApiKey ? maskApiKey(aiApiKey) : '')}
                    onChange={(e) => {
                      setAiApiKey(e.target.value)
                      setApiKeys((prev) => ({ ...prev, [aiProvider]: e.target.value }))
                    }}
                    onFocus={() => setApiKeyFocused(true)}
                    onBlur={() => setApiKeyFocused(false)}
                    placeholder={currentAdapter.apiKeyPlaceholder}
                    autoComplete="off"
                    aria-describedby="ai-api-key-hint"
                    aria-invalid={!!aiErrors.apiKey}
                    className={[
                      'pr-9 font-mono',
                      !apiKeyFocused && !showApiKey && aiApiKey ? 'tracking-wider' : '',
                      aiErrors.apiKey ? 'border-destructive focus-visible:ring-destructive' : '',
                    ].join(' ')}
                  />
                  {aiApiKey && (
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setShowApiKey((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
                    >
                      {showApiKey
                        ? <EyeOff className="h-4 w-4" aria-hidden="true" />
                        : <Eye className="h-4 w-4" aria-hidden="true" />}
                    </button>
                  )}
                </div>
                {aiErrors.apiKey
                  ? <p id="ai-api-key-hint" role="alert" className="text-xs text-destructive">{aiErrors.apiKey}</p>
                  : <p id="ai-api-key-hint" className="text-xs text-muted-foreground">
                      {!aiApiKey || apiKeyFocused || showApiKey
                        ? currentAdapter.apiKeyHint
                        : 'Key is masked. Click the field or eye icon to view.'}
                    </p>
                }
              </div>

              {/* Model selection */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="ai-model">
                  Model <span className="text-destructive" aria-hidden="true">*</span>
                  <span className="sr-only">(required)</span>
                </label>

                {showModelTextInput ? (
                  <Input
                    id="ai-model"
                    value={aiModel}
                    onChange={(e) => setAiModel(e.target.value)}
                    placeholder="https://my-provider.com/v1/chat/completions::model-id"
                    aria-invalid={!!aiErrors.model}
                    className={aiErrors.model ? 'border-destructive focus-visible:ring-destructive' : ''}
                  />
                ) : showModelDropdown ? (
                  <div className="flex gap-2">
                    <select
                      id="ai-model"
                      value={aiModel}
                      onChange={(e) => setAiModel(e.target.value)}
                      aria-invalid={!!aiErrors.model}
                      className={[
                        'flex-1 rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary',
                        aiErrors.model ? 'border-destructive' : '',
                      ].join(' ')}
                    >
                      {models.map((m) => (
                        <option key={m.id} value={m.id}>{m.label}</option>
                      ))}
                    </select>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={handleFetchModels}
                          disabled={modelsFetching || !aiApiKey}
                          className="rounded-md border p-1.5 hover:bg-accent transition-colors disabled:opacity-50"
                          aria-label="Refresh model list"
                        >
                          <RefreshCw className={['h-4 w-4', modelsFetching ? 'animate-spin' : ''].join(' ')} aria-hidden="true" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Refresh model list</TooltipContent>
                    </Tooltip>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleFetchModels}
                      disabled={modelsFetching || !aiApiKey}
                      className="gap-2"
                    >
                      {modelsFetching
                        ? <><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" /><span>Fetching models…</span></>
                        : <><RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /><span>Fetch available models</span></>}
                    </Button>
                    <Input
                      id="ai-model"
                      value={aiModel}
                      onChange={(e) => setAiModel(e.target.value)}
                      placeholder="Or type a model ID manually, e.g. google/gemini-2.0-flash"
                      aria-invalid={!!aiErrors.model}
                      className={aiErrors.model ? 'border-destructive focus-visible:ring-destructive' : ''}
                    />
                  </div>
                )}

                {aiErrors.model && <p role="alert" className="text-xs text-destructive">{aiErrors.model}</p>}
                {modelsError && (
                  <p role="note" className="text-xs text-amber-600 dark:text-amber-400">
                    Could not fetch models: {modelsError}. You can still type a model ID manually.
                  </p>
                )}
              </div>

              {/* Prompt */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="ai-prompt">
                  Prompt <span className="text-muted-foreground text-xs">(optional)</span>
                </label>
                <Input
                  id="ai-prompt"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="Enhance sharpness and contrast, remove noise…"
                />
              </div>

              {/* Enhance button */}
              <Button
                type="button"
                onClick={handleAiEnhance}
                disabled={status !== 'done' || aiStatus === 'enhancing'}
                variant="secondary"
                className="w-full gap-2"
                aria-describedby={status !== 'done' ? 'ai-enhance-hint' : undefined}
              >
                {aiStatus === 'enhancing'
                  ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" /><span>Enhancing…</span></>
                  : <><Sparkles className="h-4 w-4" aria-hidden="true" /><span>Enhance with AI</span></>}
              </Button>

              {status !== 'done' && (
                <p id="ai-enhance-hint" className="text-center text-xs text-muted-foreground">
                  Convert an image first to enable AI enhancement.
                </p>
              )}

              {aiStatus === 'error' && aiErrorMsg && (
                <p role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {aiErrorMsg}
                </p>
              )}

              {aiStatus === 'done' && enhancedUrl && enhancedBlob && (
                <div className="space-y-3">
                  <div className="overflow-hidden rounded-lg border">
                    {/* biome-ignore lint/performance/noImgElement: next/image not suitable for dynamic blobs */}
                    <img
                      src={enhancedUrl}
                      alt={`AI enhanced preview: ${enhancedName}`}
                      className="max-h-64 w-full object-contain bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiI+PHJlY3Qgd2lkdGg9IjgiIGhlaWdodD0iOCIgZmlsbD0iI2NjYyIvPjxyZWN0IHg9IjgiIHk9IjgiIHdpZHRoPSI4IiBoZWlnaHQ9IjgiIGZpbGw9IiNjY2MiLz48L3N2Zz4=')]"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {enhancedName} &middot; {formatBytes(enhancedBlob.size)}
                  </p>
                  <div className="flex gap-2">
                    <a href={enhancedUrl} download={enhancedName} className="flex-1">
                      <Button type="button" variant="outline" className="w-full gap-2">
                        <Download className="h-4 w-4" aria-hidden="true" />
                        Download {enhancedName}
                      </Button>
                    </a>
                    {canShare && (
                      <Button type="button" variant="outline" size="icon" aria-label="Share" onClick={() => handleShare(enhancedBlob, enhancedName)}>
                        <Share2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </TooltipProvider>
  )
}
