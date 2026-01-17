'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ComponentProps } from 'react'

type TransitionLinkProps = ComponentProps<typeof Link>

export function TransitionLink({ href, children, ...props }: TransitionLinkProps) {
  const router = useRouter()

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Check if it's an external link or special modifier keys are pressed
    const isExternal = typeof href === 'string' && (href.startsWith('http') || href.startsWith('mailto'))
    const isModifiedClick = e.metaKey || e.ctrlKey || e.shiftKey || e.altKey
    
    if (isExternal || isModifiedClick) {
      return // Let the default Link behavior handle it
    }

    // Check if browser supports View Transitions
    if (!document.startViewTransition) {
      return // Let the default Link behavior handle it
    }

    e.preventDefault()

    document.startViewTransition(() => {
      router.push(href.toString())
    })
  }

  return (
    <Link href={href} onClick={handleClick} {...props}>
      {children}
    </Link>
  )
}
