/**
 * Ensures BarcodeDetector is available in globalThis.
 * Uses the native API when present (Chrome/Edge/Safari 17+),
 * otherwise loads a WASM-based polyfill (works on iOS Safari and Firefox).
 */
export async function ensureBarcodeDetector(): Promise<void> {
  if ('BarcodeDetector' in globalThis) return
  await import('barcode-detector/polyfill')
}
