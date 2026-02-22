/**
 * Service Worker — Cache-first for static utils assets
 *
 * Strategy:
 *   - STATIC_CACHE  : cache-first, versioned. Covers /workers/* and /fonts/*.
 *                     These files never change content without a cache bump.
 *   - NEXT_CACHE    : cache-first for Next.js immutable chunks (/_next/static/**).
 *                     Vercel already sets max-age=31536000 on these, but caching
 *                     them in the SW means they survive across navigations without
 *                     any network hit even if the HTTP cache is cleared.
 *   - Everything else passes through to the network unchanged.
 *
 * On activation the SW deletes any caches from previous versions so stale
 * entries don't accumulate on the user's device.
 */

const STATIC_VERSION = 'v1'
const STATIC_CACHE = `utils-static-${STATIC_VERSION}`
const NEXT_CACHE = `next-immutable-${STATIC_VERSION}`

// Files to pre-cache when the SW installs (shell assets)
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
  // Activate immediately without waiting for old tabs to close
  self.skipWaiting()
})

// ---------------------------------------------------------------------------
// Activate — clean up old cache versions
// ---------------------------------------------------------------------------
self.addEventListener('activate', (event) => {
  const knownCaches = new Set([STATIC_CACHE, NEXT_CACHE])
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => !knownCaches.has(key))
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  )
})

// ---------------------------------------------------------------------------
// Fetch — route requests to the right strategy
// ---------------------------------------------------------------------------
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Only handle GET requests on the same origin
  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  // Next.js immutable static chunks — cache-first, NEXT_CACHE
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request, NEXT_CACHE))
    return
  }

  // Our static utils assets — cache-first, STATIC_CACHE
  if (
    url.pathname.startsWith('/workers/') ||
    url.pathname.startsWith('/fonts/')
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE))
    return
  }

  // Everything else: network only (RSC/HTML pages, API routes, etc.)
})

// ---------------------------------------------------------------------------
// Cache-first helper
// ---------------------------------------------------------------------------
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) return cached

  const response = await fetch(request)
  // Only cache valid responses (status 200, basic = same-origin)
  if (response.ok && response.type === 'basic') {
    cache.put(request, response.clone())
  }
  return response
}
