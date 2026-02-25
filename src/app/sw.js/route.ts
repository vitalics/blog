import { NextResponse } from 'next/server'

// Stamped once at module load time (= server startup / new deployment).
// Every deploy gets a fresh string, which causes the SW to install a new
// cache and discard all entries from the previous version.
const BUILD_ID = Date.now().toString(36)

const SW_BODY = `
/**
 * Service Worker — Cache-first for static assets
 * Build: ${BUILD_ID}
 */

const STATIC_VERSION = '${BUILD_ID}'
const STATIC_CACHE   = 'utils-static-' + STATIC_VERSION
const NEXT_CACHE     = 'next-immutable-' + STATIC_VERSION

const PRECACHE_URLS = [
  '/workers/image-converter.worker.js',
]

// ---------------------------------------------------------------------------
// Install — pre-cache shell assets
// ---------------------------------------------------------------------------
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS))
  )
  self.skipWaiting()
})

// ---------------------------------------------------------------------------
// Activate — delete every cache that doesn't belong to this version
// ---------------------------------------------------------------------------
self.addEventListener('activate', (event) => {
  const known = new Set([STATIC_CACHE, NEXT_CACHE])
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !known.has(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

// ---------------------------------------------------------------------------
// Fetch — route requests to the right strategy
// ---------------------------------------------------------------------------
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  // Next.js immutable static chunks — cache-first
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request, NEXT_CACHE))
    return
  }

  // Our static utils assets — cache-first
  if (url.pathname.startsWith('/workers/') || url.pathname.startsWith('/fonts/')) {
    event.respondWith(cacheFirst(request, STATIC_CACHE))
    return
  }

  // Everything else: network only (HTML pages, RSC, API routes)
})

// ---------------------------------------------------------------------------
// Cache-first helper
// ---------------------------------------------------------------------------
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok && response.type === 'basic') cache.put(request, response.clone())
  return response
}
`.trim()

export function GET() {
  return new NextResponse(SW_BODY, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      // Tell the browser never to cache the SW registration response itself.
      // The SW runtime still uses its own byte-for-byte comparison to decide
      // whether to install a new version — this just ensures the fetch always
      // goes to the network so the comparison actually happens.
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  })
}
