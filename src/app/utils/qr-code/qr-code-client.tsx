'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, QrCode, Download, Share2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ColorPicker } from '@/components/ui/color-picker'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Status = 'idle' | 'ready' | 'error'
type ErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H'

const EC_LEVELS: { value: ErrorCorrectionLevel; label: string; description: string }[] = [
  { value: 'L', label: 'L — Low', description: '~7% error correction' },
  { value: 'M', label: 'M — Medium', description: '~15% error correction' },
  { value: 'Q', label: 'Q — Quartile', description: '~25% error correction' },
  { value: 'H', label: 'H — High', description: '~30% error correction' },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function QrCodePage() {
  const router = useRouter()

  const [text, setText] = useState('')
  const [fgColor, setFgColor] = useState('#000000')
  const [bgColor, setBgColor] = useState('#ffffff')
  const [size, setSize] = useState(256)
  const [ecLevel, setEcLevel] = useState<ErrorCorrectionLevel>('M')
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [canShare, setCanShare] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Generate QR code whenever inputs change
  useEffect(() => {
    if (!text.trim()) {
      setStatus('idle')
      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext('2d')
        ctx?.clearRect(0, 0, canvas.width, canvas.height)
      }
      return
    }

    let cancelled = false

    ;(async () => {
      try {
        const QRCode = await import('qrcode')
        const canvas = canvasRef.current
        if (!canvas || cancelled) return

        await QRCode.toCanvas(canvas, text.trim(), {
          width: size,
          color: { dark: fgColor, light: bgColor },
          errorCorrectionLevel: ecLevel,
        })

        setStatus('ready')
        setErrorMsg(null)

        // Check share capability with a dummy PNG blob
        canvas.toBlob((blob) => {
          if (!blob) return
          setCanShare(
            !!navigator.share &&
            !!navigator.canShare &&
            navigator.canShare({ files: [new File([blob], 'qr.png', { type: 'image/png' })] })
          )
        })
      } catch (err) {
        if (!cancelled) {
          setStatus('error')
          setErrorMsg(err instanceof Error ? err.message : 'Failed to generate QR code.')
        }
      }
    })()

    return () => { cancelled = true }
  }, [text, fgColor, bgColor, size, ecLevel])

  const handleDownload = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const url = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = 'qr-code.png'
    a.click()
  }

  const handleShare = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.toBlob((blob) => {
      if (!blob) return
      const file = new File([blob], 'qr-code.png', { type: 'image/png' })
      navigator.share({ files: [file] }).catch(() => {})
    })
  }

  const handleClear = () => {
    setText('')
    setStatus('idle')
    setErrorMsg(null)
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      {/* Header */}
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label="Go back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <QrCode className="h-7 w-7 text-muted-foreground" aria-hidden="true" />
          <h1 className="text-4xl font-bold">QR Code Generator</h1>
        </div>
        <p className="text-muted-foreground">
          Generate QR codes from any text or URL. Everything runs in your browser.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Left: controls */}
        <div className="space-y-4">
          {/* Text input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="qr-text" className="text-sm font-medium">Text or URL</label>
              {text && (
                <button type="button" onClick={handleClear} className="text-xs text-muted-foreground hover:text-foreground">
                  <X className="inline h-3 w-3" /> Clear
                </button>
              )}
            </div>
            <textarea
              id="qr-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="https://example.com"
              rows={4}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none font-mono"
            />
          </div>

          {/* Size */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="qr-size" className="text-sm font-medium">Size</label>
              <span className="text-xs text-muted-foreground">{size}×{size}px</span>
            </div>
            <input
              id="qr-size"
              type="range"
              min={128}
              max={512}
              step={32}
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          {/* Error correction */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Error correction</label>
            <div className="grid grid-cols-2 gap-1.5">
              {EC_LEVELS.map((l) => (
                <button
                  key={l.value}
                  type="button"
                  onClick={() => setEcLevel(l.value)}
                  title={l.description}
                  className={[
                    'rounded border px-3 py-1.5 text-left text-xs transition-colors',
                    ecLevel === l.value ? 'border-primary bg-primary/10 font-medium' : 'hover:border-primary/50',
                  ].join(' ')}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          {/* Colors */}
          <div className="flex gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Foreground</label>
              <ColorPicker value={fgColor} onChange={setFgColor} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Background</label>
              <ColorPicker value={bgColor} onChange={setBgColor} />
            </div>
          </div>
        </div>

        {/* Right: preview */}
        <div className="flex flex-col items-center gap-4">
          <div className={[
            'flex items-center justify-center rounded-lg border bg-muted/30 p-4',
            status === 'idle' ? 'min-h-[200px]' : '',
          ].join(' ')}>
            {status === 'idle' && !text && (
              <p className="text-sm text-muted-foreground">Enter text to generate a QR code</p>
            )}
            <canvas
              ref={canvasRef}
              className={status === 'idle' && !text ? 'hidden' : 'rounded'}
              aria-label="QR code preview"
            />
          </div>

          {status === 'error' && errorMsg && (
            <p className="text-sm text-destructive">{errorMsg}</p>
          )}

          {status === 'ready' && (
            <div className="flex gap-2">
              <Button variant="outline" className="gap-2" onClick={handleDownload}>
                <Download className="h-4 w-4" />
                Download PNG
              </Button>
              {canShare && (
                <Button variant="outline" size="icon" onClick={handleShare} aria-label="Share QR code">
                  <Share2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
