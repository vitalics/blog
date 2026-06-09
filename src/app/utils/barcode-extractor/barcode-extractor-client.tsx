'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Barcode, Upload, Copy, Check, X, Camera,
  FlipHorizontal, Aperture, ChevronDown, ChevronUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ensureBarcodeDetector } from '@/lib/barcode-detector-polyfill'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScanResult {
  rawValue: string
  format: string
  id: string // for stable keys
}

type Status = 'idle' | 'scanning' | 'done' | 'error' | 'unsupported'

const BARCODE_FORMATS = [
  'aztec', 'code_128', 'code_39', 'code_93', 'codabar',
  'data_matrix', 'ean_13', 'ean_8', 'itf', 'pdf417',
  'upc_a', 'upc_e',
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BarcodeExtractorPage() {
  const router = useRouter()

  // ---- file-scan state ----
  const [status, setStatus] = useState<Status>('idle')
  const [fileResults, setFileResults] = useState<ScanResult[]>([])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [supportedFormats, setSupportedFormats] = useState<string[]>([])

  // ---- camera state ----
  const [cameraActive, setCameraActive] = useState(false)
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')
  const [capturing, setCapturing] = useState(false) // shutter flash + freeze
  const [latestScan, setLatestScan] = useState<ScanResult | null>(null)
  const [history, setHistory] = useState<ScanResult[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)

  // ---- copy state ----
  const [copied, setCopied] = useState<string | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const pauseRef = useRef(false) // pause scanning for 2s after detection

  // ---------------------------------------------------------------------------
  // Init polyfill + supported formats
  // ---------------------------------------------------------------------------

  useEffect(() => {
    ensureBarcodeDetector()
      .then(() => {
        // biome-ignore lint/suspicious/noExplicitAny: BarcodeDetector not in TS lib
        return (globalThis as any).BarcodeDetector.getSupportedFormats()
      })
      .then((formats: string[]) => {
        const filtered = formats.filter((f) => BARCODE_FORMATS.includes(f))
        setSupportedFormats(filtered.length > 0 ? filtered : BARCODE_FORMATS)
      })
      .catch(() => setStatus('unsupported'))
  }, [])

  useEffect(() => { return () => stopCamera() }, [])

  // ---------------------------------------------------------------------------
  // Camera helpers
  // ---------------------------------------------------------------------------

  const stopCamera = () => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    if (streamRef.current) { for (const t of streamRef.current.getTracks()) t.stop(); streamRef.current = null }
    setCameraActive(false)
    pauseRef.current = false
  }

  const addScan = useCallback((raw: string, format: string) => {
    const result: ScanResult = { rawValue: raw, format, id: `${format}::${raw}` }
    setLatestScan(result)
    setHistory((prev) => {
      // deduplicate by value
      if (prev.some((r) => r.rawValue === raw)) return prev
      return [result, ...prev]
    })
  }, [])

  const buildDetector = useCallback(() => {
    const formats = supportedFormats.length > 0 ? supportedFormats : BARCODE_FORMATS
    // biome-ignore lint/suspicious/noExplicitAny: BarcodeDetector not in TS lib
    return new (globalThis as any).BarcodeDetector({ formats })
  }, [supportedFormats])

  const startCamera = useCallback(async (mode: 'environment' | 'user') => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    if (streamRef.current) { for (const t of streamRef.current.getTracks()) t.stop(); streamRef.current = null }

    const video = videoRef.current
    if (!video) return

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: mode } },
      })
      streamRef.current = stream
      video.srcObject = stream
      await video.play()
      setCameraActive(true)

      const detector = buildDetector()

      const scan = async () => {
        if (!streamRef.current) return
        if (!pauseRef.current) {
          try {
            const detected = await detector.detect(video)
            if (detected.length > 0) {
              const d = detected[0]
              addScan(d.rawValue, d.format)
              // pause 2 s before re-detecting the same barcode
              pauseRef.current = true
              setTimeout(() => { pauseRef.current = false }, 2000)
            }
          } catch { /* ignore per-frame errors */ }
        }
        rafRef.current = requestAnimationFrame(scan)
      }
      rafRef.current = requestAnimationFrame(scan)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Camera access denied.')
      setStatus('error')
    }
  }, [buildDetector, addScan])

  const handleStartCamera = () => startCamera(facingMode)

  const handleFlipCamera = () => {
    const next = facingMode === 'environment' ? 'user' : 'environment'
    setFacingMode(next)
    startCamera(next)
  }

  // Capture current video frame: freeze video, flash, scan, then resume
  const handleCapture = async () => {
    const video = videoRef.current
    if (!video || !streamRef.current || capturing) return

    // 1. Pause RAF loop so auto-scan doesn't interfere
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }

    // 2. Freeze the video + trigger shutter flash
    video.pause()
    setCapturing(true)

    // 3. Draw frozen frame to canvas
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (ctx) ctx.drawImage(video, 0, 0)

    // 4. Scan the frozen frame
    try {
      const detector = buildDetector()
      const bitmap = await createImageBitmap(canvas)
      const detected = await detector.detect(bitmap)
      if (detected.length > 0) {
        addScan(detected[0].rawValue, detected[0].format)
      } else {
        const orig = latestScan
        setLatestScan({ rawValue: 'No barcode found in frame', format: '', id: '__none__' })
        setTimeout(() => setLatestScan(orig), 1500)
      }
    } catch { /* ignore */ }

    // 5. After 700 ms resume video and restart scan loop
    setTimeout(() => {
      setCapturing(false)
      if (!streamRef.current) return
      video.play().then(() => {
        const detector = buildDetector()
        const scan = async () => {
          if (!streamRef.current) return
          if (!pauseRef.current) {
            try {
              const detected = await detector.detect(video)
              if (detected.length > 0) {
                addScan(detected[0].rawValue, detected[0].format)
                pauseRef.current = true
                setTimeout(() => { pauseRef.current = false }, 2000)
              }
            } catch { /* ignore */ }
          }
          rafRef.current = requestAnimationFrame(scan)
        }
        rafRef.current = requestAnimationFrame(scan)
      }).catch(() => {})
    }, 700)
  }

  // ---------------------------------------------------------------------------
  // File scan
  // ---------------------------------------------------------------------------

  const scanImage = useCallback(async (file: File) => {
    setStatus('scanning')
    setFileResults([])
    setErrorMsg(null)
    try {
      const detector = buildDetector()
      const bitmap = await createImageBitmap(file)
      const detected = await detector.detect(bitmap)
      if (detected.length === 0) {
        setErrorMsg('No barcode found in this image.')
        setStatus('error')
      } else {
        setFileResults(detected.map((d: { rawValue: string; format: string }, i: number) => ({
          rawValue: d.rawValue, format: d.format, id: `file-${i}`,
        })))
        setStatus('done')
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Scan failed.')
      setStatus('error')
    }
  }, [buildDetector])

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select an image file.')
      setStatus('error')
      return
    }
    scanImage(file)
  }, [scanImage])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  // ---------------------------------------------------------------------------
  // Copy
  // ---------------------------------------------------------------------------

  const handleCopy = async (value: string) => {
    await navigator.clipboard.writeText(value)
    setCopied(value)
    setTimeout(() => setCopied(null), 2000)
  }

  const handleClear = () => {
    setFileResults([])
    setStatus('idle')
    setErrorMsg(null)
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const showDropZone = !cameraActive && (status === 'idle' || status === 'error')

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      {/* Header */}
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label="Go back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Barcode className="h-7 w-7 text-muted-foreground" aria-hidden="true" />
          <h1 className="text-4xl font-bold">Barcode Extractor</h1>
        </div>
        <p className="text-muted-foreground">
          Decode barcodes (EAN-13, Code 128, UPC, PDF417, and more) from images or your camera. Runs in your browser.
        </p>
      </div>

      {status === 'unsupported' && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Browser not supported</p>
          <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
            Barcode detection requires the <code>BarcodeDetector</code> API or WebAssembly support. Please use a modern browser.
          </p>
        </div>
      )}

      {status !== 'unsupported' && (
        <div className="space-y-4">

          {/* ── Camera section ─────────────────────────────────────────── */}
          {/* Video always in DOM so ref is always valid */}
          <div className={cameraActive ? 'overflow-hidden rounded-xl border' : 'hidden'}>
            {/* biome-ignore lint/a11y/useMediaCaption: live camera stream */}
            <div className="relative">
              {/* biome-ignore lint/a11y/useMediaCaption: live camera stream */}
              <video ref={videoRef} className="w-full" playsInline autoPlay muted />
              {/* Shutter flash overlay */}
              {capturing && (
                <div className="pointer-events-none absolute inset-0 animate-shutter bg-white" />
              )}
              {/* Viewfinder */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-24 w-64 rounded border-4 border-primary/60" />
              </div>
              <p className="absolute bottom-2 left-0 right-0 text-center text-xs text-white drop-shadow">
                Point camera at a barcode
              </p>
            </div>

            {/* Camera controls */}
            <div className="flex items-center justify-between gap-2 border-t bg-muted/40 px-3 py-2">
              <Button variant="ghost" size="sm" className="gap-1.5" aria-label="Flip camera" onClick={handleFlipCamera}>
                <FlipHorizontal className="h-4 w-4" />
                <span className="hidden sm:inline">Flip</span>
              </Button>

              {/* Shutter / capture */}
              <Button
                variant="default"
                size="icon"
                className="h-12 w-12 rounded-full"
                aria-label="Capture frame"
                onClick={handleCapture}
              >
                <Aperture className="h-6 w-6" />
              </Button>

              <Button variant="ghost" size="sm" className="gap-1.5 text-destructive hover:text-destructive" onClick={stopCamera}>
                <X className="h-4 w-4" />
                <span className="hidden sm:inline">Stop</span>
              </Button>
            </div>

            {/* Latest scan result — slides in below controls */}
            {latestScan && (
              <div
                className="animate-in slide-in-from-bottom-2 border-t px-4 py-3 duration-200"
              >
                {latestScan.id === '__none__' ? (
                  <p className="text-sm text-muted-foreground">{latestScan.rawValue}</p>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <span className="mb-1 inline-block rounded-full bg-secondary px-2 py-0.5 text-xs font-mono">
                        {latestScan.format.replace(/_/g, '-').toUpperCase()}
                      </span>
                      <p className="break-all font-mono text-sm">{latestScan.rawValue}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 shrink-0 gap-1.5"
                      onClick={() => handleCopy(latestScan.rawValue)}
                    >
                      {copied === latestScan.rawValue
                        ? <Check className="h-3.5 w-3.5 text-green-500" />
                        : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Scan history */}
            {history.length > 1 && (
              <div className="border-t">
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-4 py-2 text-left text-xs text-muted-foreground hover:bg-muted/50"
                  onClick={() => setHistoryOpen((v) => !v)}
                >
                  <span>History ({history.length} scanned)</span>
                  {historyOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
                {historyOpen && (
                  <ul className="max-h-48 divide-y overflow-y-auto">
                    {history.map((r) => (
                      <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-2">
                        <div className="min-w-0 flex-1">
                          <span className="text-xs text-muted-foreground font-mono">
                            {r.format.replace(/_/g, '-').toUpperCase()}
                          </span>
                          <p className="truncate text-sm font-mono">{r.rawValue}</p>
                        </div>
                        <Button variant="ghost" size="sm" className="h-7 shrink-0 gap-1.5" onClick={() => handleCopy(r.rawValue)}>
                          {copied === r.rawValue ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* ── Drop zone ──────────────────────────────────────────────── */}
          {showDropZone && (
            <div
              role="button"
              tabIndex={0}
              aria-label="Drop an image here or click to select"
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
              onDragLeave={() => setIsDragOver(false)}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click() } }}
              className={[
                'flex min-h-48 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors',
                isDragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50',
              ].join(' ')}
            >
              <Upload className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
              <div>
                <p className="font-medium">Drop an image here</p>
                <p className="text-sm text-muted-foreground">or click to browse</p>
              </div>
              {status === 'error' && errorMsg && (
                <p className="text-sm text-destructive">{errorMsg}</p>
              )}
            </div>
          )}

          {/* ── Camera button ──────────────────────────────────────────── */}
          {showDropZone && (
            <Button variant="outline" className="w-full gap-2" onClick={handleStartCamera}>
              <Camera className="h-4 w-4" />
              Scan with camera
            </Button>
          )}

          {/* ── Supported formats note ─────────────────────────────────── */}
          {status === 'idle' && !cameraActive && supportedFormats.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Supported formats: {supportedFormats.map((f) => f.replace(/_/g, '-').toUpperCase()).join(', ')}
            </p>
          )}

          {/* ── File scanning spinner ──────────────────────────────────── */}
          {status === 'scanning' && (
            <div className="flex min-h-48 items-center justify-center rounded-xl border">
              <p className="animate-pulse text-muted-foreground">Scanning…</p>
            </div>
          )}

          {/* ── File scan results ──────────────────────────────────────── */}
          {status === 'done' && fileResults.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  {fileResults.length} result{fileResults.length !== 1 ? 's' : ''} found
                </p>
                <Button variant="ghost" size="sm" onClick={handleClear}>
                  <X className="mr-1.5 h-3.5 w-3.5" /> Clear
                </Button>
              </div>
              {fileResults.map((r) => (
                <div key={r.id} className="rounded-lg border bg-card p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-mono">
                      {r.format.replace(/_/g, '-').toUpperCase()}
                    </span>
                    <Button variant="ghost" size="sm" className="h-7 gap-1.5" onClick={() => handleCopy(r.rawValue)}>
                      {copied === r.rawValue ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied === r.rawValue ? 'Copied' : 'Copy'}
                    </Button>
                  </div>
                  <p className="break-all font-mono text-sm">{r.rawValue}</p>
                </div>
              ))}
              <Button variant="outline" className="w-full" onClick={handleClear}>Scan another</Button>
            </div>
          )}
        </div>
      )}

      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleInputChange} />
    </div>
  )
}
