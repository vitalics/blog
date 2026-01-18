'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ComponentProps } from 'react'
import { useEffect, useRef } from 'react'

type PrefetchLinkProps = ComponentProps<typeof Link> & {
  prefetchOnHover?: boolean
}

export function PrefetchLink({ 
  href, 
  children, 
  prefetchOnHover = true,
  ...props 
}: PrefetchLinkProps) {
  const router = useRouter()
  const prefetched = useRef(false)

  const handleMouseEnter = () => {
    if (prefetchOnHover && !prefetched.current && typeof href === 'string') {
      // Check if it's an internal link
      const isExternal = href.startsWith('http') || href.startsWith('mailto')
      
      if (!isExternal) {
        router.prefetch(href)
        prefetched.current = true
      }
    }
  }

  const handleTouchStart = () => {
    // Also prefetch on touch for mobile devices
    if (prefetchOnHover && !prefetched.current && typeof href === 'string') {
      const isExternal = href.startsWith('http') || href.startsWith('mailto')
      
      if (!isExternal) {
        router.prefetch(href)
        prefetched.current = true
      }
    }
  }

  return (
    <Link 
      href={href} 
      onMouseEnter={handleMouseEnter}
      onTouchStart={handleTouchStart}
      prefetch={false} // Disable automatic prefetch
      {...props}
    >
      {children}
    </Link>
  )
}
