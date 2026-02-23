'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ScanLine, Upload, Copy, Check, X, Camera } from 'lucide-react'
import { Button } from '@/components/ui/button'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScanResult {
  rawValue: string
  format: string
}

type Status = 'idle' | 'scanning' | 'done' | 'error' | 'unsupported'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isUrl(s: string) {
  try { return /^https?:\/\//.test(s) } catch { return false }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function QrExtractorPage() {
  const router = useRouter()

  const [status, setStatus] = useState<Status>('idle')
  const [results, setResults] = useState<ScanResult[]>([])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [cameraActive, setCameraActive] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)

  // Check BarcodeDetector support on mount
  useEffect(() => {
    if (!('BarcodeDetector' in window)) {
      setStatus('unsupported')
    }
  }, [])

  // Cleanup camera on unmount
  useEffect(() => {
    return () => stopCamera()
  }, [])

  // ---------------------------------------------------------------------------
  // Scan image file
  // ---------------------------------------------------------------------------

  const scanImage = useCallback(async (file: File) => {
    setStatus('scanning')
    setResults([])
    setErrorMsg(null)

    try {
      // biome-ignore lint/suspicious/noExplicitAny: BarcodeDetector not yet in TS lib
      const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] })
      const bitmap = await createImageBitmap(file)
      const detected = await detector.detect(bitmap)

      if (detected.length === 0) {
        setErrorMsg('No QR code found in this image.')
        setStatus('error')
      } else {
        setResults(detected.map((d: { rawValue: string; format: string }) => ({ rawValue: d.rawValue, format: d.format })))
        setStatus('done')
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Scan failed.')
      setStatus('error')
    }
  }, [])

  // ---------------------------------------------------------------------------
  // File input / drag-drop
  // ---------------------------------------------------------------------------

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
  // Camera scanning
  // ---------------------------------------------------------------------------

  const stopCamera = () => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    if (streamRef.current) { for (const t of streamRef.current.getTracks()) t.stop(); streamRef.current = null }
    setCameraActive(false)
  }

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      streamRef.current = stream
      const video = videoRef.current
      if (!video) { stopCamera(); return }
      video.srcObject = stream
      await video.play()
      setCameraActive(true)

      // biome-ignore lint/suspicious/noExplicitAny: BarcodeDetector not in TS lib
      const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] })

      const scan = async () => {
        if (!streamRef.current) return
        try {
          const detected = await detector.detect(video)
          if (detected.length > 0) {
            setResults(detected.map((d: { rawValue: string; format: string }) => ({ rawValue: d.rawValue, format: d.format })))
            setStatus('done')
            stopCamera()
            return
          }
        } catch { /* ignore per-frame errors */ }
        rafRef.current = requestAnimationFrame(scan)
      }
      rafRef.current = requestAnimationFrame(scan)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Camera access denied.')
      setStatus('error')
    }
  }

  // ---------------------------------------------------------------------------
  // Copy
  // ---------------------------------------------------------------------------

  const handleCopy = async (value: string) => {
    await navigator.clipboard.writeText(value)
    setCopied(value)
    setTimeout(() => setCopied(null), 2000)
  }

  const handleClear = () => {
    stopCamera()
    setResults([])
    setStatus('idle')
    setErrorMsg(null)
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      {/* Header */}
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label="Go back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <ScanLine className="h-7 w-7 text-muted-foreground" aria-hidden="true" />
          <h1 className="text-4xl font-bold">QR Code Extractor</h1>
        </div>
        <p className="text-muted-foreground">
          Decode QR codes from images or your camera. Runs entirely in your browser.
        </p>
      </div>

      {status === 'unsupported' && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Browser not supported</p>
          <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
            QR code detection requires the <code>BarcodeDetector</code> API, available in Chrome, Edge, and Safari 17+.
          </p>
        </div>
      )}

      {status !== 'unsupported' && (
        <div className="space-y-4">
          {/* Camera preview */}
          {cameraActive && (
            <div className="relative overflow-hidden rounded-xl border">
              {/* biome-ignore lint/a11y/useMediaCaption: live camera stream */}
              <video ref={videoRef} className="w-full" playsInline muted />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-48 w-48 rounded-lg border-4 border-primary/60" />
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="absolute right-2 top-2 gap-1.5"
                onClick={stopCamera}
              >
                <X className="h-3.5 w-3.5" /> Stop
              </Button>
              <p className="absolute bottom-2 left-0 right-0 text-center text-xs text-white drop-shadow">
                Point camera at a QR code
              </p>
            </div>
          )}

          {/* Drop zone */}
          {!cameraActive && (status === 'idle' || status === 'error') && (
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

          {/* Camera button */}
          {!cameraActive && (status === 'idle' || status === 'error') && (
            <Button variant="outline" className="w-full gap-2" onClick={startCamera}>
              <Camera className="h-4 w-4" />
              Scan with camera
            </Button>
          )}

          {/* Scanning */}
          {status === 'scanning' && (
            <div className="flex min-h-48 items-center justify-center rounded-xl border">
              <p className="animate-pulse text-muted-foreground">Scanning…</p>
            </div>
          )}

          {/* Results */}
          {status === 'done' && results.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{results.length} result{results.length !== 1 ? 's' : ''} found</p>
                <Button variant="ghost" size="sm" onClick={handleClear}>
                  <X className="mr-1.5 h-3.5 w-3.5" /> Clear
                </Button>
              </div>
              {results.map((r, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: stable list
                <div key={i} className="rounded-lg border bg-card p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{r.format}</span>
                    <Button variant="ghost" size="sm" className="h-7 gap-1.5" onClick={() => handleCopy(r.rawValue)}>
                      {copied === r.rawValue ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied === r.rawValue ? 'Copied' : 'Copy'}
                    </Button>
                  </div>
                  {isUrl(r.rawValue) ? (
                    <a href={r.rawValue} target="_blank" rel="noopener noreferrer" className="break-all text-sm text-primary underline underline-offset-2">
                      {r.rawValue}
                    </a>
                  ) : (
                    <p className="break-all font-mono text-sm">{r.rawValue}</p>
                  )}
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
