'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

export function ViewTransitions() {
  const pathname = usePathname()

  useEffect(() => {
    // Check if the browser supports View Transitions API
    if (!document.startViewTransition) {
      return
    }

    // Trigger view transition on route change
    const handleRouteChange = () => {
      if (document.startViewTransition) {
        document.startViewTransition(() => {
          // The browser will handle the transition automatically
        })
      }
    }

    // Listen for popstate (browser back/forward)
    window.addEventListener('popstate', handleRouteChange)

    return () => {
      window.removeEventListener('popstate', handleRouteChange)
    }
  }, [pathname])

  return null
}
