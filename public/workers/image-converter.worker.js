/**
 * Image Converter Web Worker
 * Converts and resizes images using OffscreenCanvas.
 * Runs entirely off the main thread — no network requests.
 *
 * Accepted message:
 *   {
 *     imageData: ArrayBuffer,
 *     targetFormat: 'webp' | 'png' | 'jpeg' | 'gif',
 *     sourceType?: string,     // MIME type of the source file (e.g. 'image/gif')
 *     outputWidth?: number,    // defaults to source width
 *     outputHeight?: number,   // defaults to source height
 *     bgColor?: string | null  // CSS color string, null = transparent
 *     quality?: number         // 0–1, default 0.92
 *   }
 *
 * Posted message (success): { result: Blob, format: string }
 * Posted message (error):   { error: string }
 *
 * GIF note:
 *   The Canvas API cannot encode animated images. When the target format is
 *   'gif' the source bytes are returned as-is (passthrough). For any other
 *   target format only the first frame of an animated GIF will be used.
 */

const MIME_MAP = {
  webp: 'image/webp',
  png: 'image/png',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  gif: 'image/gif',
}

self.onmessage = async function (event) {
  const {
    imageData,
    targetFormat = 'webp',
    sourceType,
    outputWidth,
    outputHeight,
    bgColor = null,
    quality = 0.92,
  } = event.data

  try {
    const fmt = targetFormat.toLowerCase()
    const mimeType = MIME_MAP[fmt]
    if (!mimeType) {
      self.postMessage({ error: `Unsupported target format: ${targetFormat}` })
      return
    }

    // GIF passthrough — Canvas cannot encode animated GIFs.
    // If a resize is requested, decode the first frame and re-encode as PNG
    // (GIF encoder is not available in the browser without a library).
    if (fmt === 'gif') {
      const sourceBlob = new Blob([imageData], { type: 'image/gif' })
      const bitmap = await createImageBitmap(sourceBlob)
      const srcW = bitmap.width
      const srcH = bitmap.height
      const destW = outputWidth ?? srcW
      const destH = outputHeight ?? srcH
      const needsResize = destW !== srcW || destH !== srcH

      if (!needsResize) {
        // No resize needed — return original bytes unchanged (preserves animation)
        bitmap.close()
        const resultBlob = new Blob([imageData], { type: 'image/gif' })
        self.postMessage({ result: resultBlob, format: 'gif' })
        return
      }

      // Resize requested — browser cannot re-encode animated GIF, so we
      // render the first frame at the new size and emit as PNG instead.
      const canvas = new OffscreenCanvas(destW, destH)
      const ctx = canvas.getContext('2d')
      if (bgColor) {
        ctx.fillStyle = bgColor
        ctx.fillRect(0, 0, destW, destH)
      }
      ctx.drawImage(bitmap, 0, 0, destW, destH)
      bitmap.close()
      const resultBlob = await canvas.convertToBlob({ type: 'image/png' })
      self.postMessage({ result: resultBlob, format: 'png', formatOverride: true })
      return
    }

    // For all raster targets, decode source (only first frame for animated GIFs)
    const sourceBlob = new Blob([imageData], { type: sourceType || 'image/png' })
    const bitmap = await createImageBitmap(sourceBlob)

    const destW = outputWidth ?? bitmap.width
    const destH = outputHeight ?? bitmap.height

    const canvas = new OffscreenCanvas(destW, destH)
    const ctx = canvas.getContext('2d')

    if (bgColor) {
      ctx.fillStyle = bgColor
      ctx.fillRect(0, 0, destW, destH)
    }

    ctx.drawImage(bitmap, 0, 0, destW, destH)
    bitmap.close()

    const resultBlob = await canvas.convertToBlob({ type: mimeType, quality })
    self.postMessage({ result: resultBlob, format: fmt })
  } catch (err) {
    self.postMessage({ error: err instanceof Error ? err.message : String(err) })
  }
}
