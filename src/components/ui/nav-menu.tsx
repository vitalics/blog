'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { NAV_LINKS } from '@/config/site'

const NavMenu = () => {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const handleViewTransitionStart = () => {
      setIsOpen(false)
    }

    document.addEventListener('astro:before-swap', handleViewTransitionStart)

    return () => {
      document.removeEventListener(
        'astro:before-swap',
        handleViewTransitionStart,
      )
    }
  }, [])

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen} modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          title="Menu"
          aria-label="Toggle menu"
          aria-expanded={isOpen}
        >
          <span className="relative flex h-5 w-5 flex-col items-center justify-center gap-[5px]" aria-hidden="true">
            <span className={`block h-0.5 w-5 rounded-full bg-current transition-all duration-200 ${isOpen ? 'translate-y-[7px] rotate-45' : ''}`} />
            <span className={`block h-0.5 w-5 rounded-full bg-current transition-all duration-200 ${isOpen ? 'opacity-0 scale-x-0' : ''}`} />
            <span className={`block h-0.5 w-5 rounded-full bg-current transition-all duration-200 ${isOpen ? '-translate-y-[7px] -rotate-45' : ''}`} />
          </span>
          <span className="sr-only">Toggle menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-background">
        {NAV_LINKS.map((item) => (
          <DropdownMenuItem key={item.href} asChild>
            <a
              href={item.href}
              className="w-full text-lg font-medium capitalize"
              onClick={() => setIsOpen(false)}
            >
              {item.label}
            </a>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default NavMenu
