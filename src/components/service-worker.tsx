'use client'

import { useEffect } from 'react'

export function ServiceWorker() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      // updateViaCache:'none' forces the browser to always re-fetch /sw.js
      // from the network (bypassing HTTP cache) so version changes are picked
      // up immediately without waiting for the HTTP cache to expire.
      navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => {
        // SW registration failure is non-fatal — app works without it
      })
    }
  }, [])

  return null
}
