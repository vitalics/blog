'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import { Search } from 'lucide-react'
import { NAV_LINKS, SITE } from '@/config/site'
import MobileMenu from '@/components/ui/mobile-menu'
import { PrefetchLink } from '@/components/prefetch-link'

const ThemeToggle = dynamic(() => import('@/components/theme-toggle').then(mod => ({ default: mod.ThemeToggle })), {
  ssr: false,
  loading: () => <div className="h-9 w-9" />,
})

const ThemeSelector = dynamic(() => import('@/components/theme-selector').then(mod => ({ default: mod.ThemeSelector })), {
  ssr: false,
  loading: () => <div className="h-9 w-9" />,
})

const CodeThemeSelector = dynamic(() => import('@/components/code-theme-selector').then(mod => ({ default: mod.CodeThemeSelector })), {
  ssr: false,
  loading: () => <div className="h-9 w-9" />,
})

export function Header() {
  const handleSearchClick = () => {
    const event = new KeyboardEvent('keydown', {
      key: 'k',
      metaKey: true,
      bubbles: true,
    })
    document.dispatchEvent(event)
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <svg
              className="h-6 w-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
            </svg>
            <span className="hidden sm:inline-block">{SITE.TITLE}</span>
          </Link>
        </div>

        <nav className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link) => (
            <PrefetchLink
              key={link.href}
              href={link.href}
              className="text-sm font-medium capitalize transition-colors hover:text-foreground/80"
            >
              {link.label}
            </PrefetchLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSearchClick}
            className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            aria-label="Search"
          >
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline">Search</span>
            <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
              <span className="text-xs">⌘</span>K
            </kbd>
          </button>
          <CodeThemeSelector />
          <ThemeSelector />
          <ThemeToggle />
          <MobileMenu />
        </div>
      </div>
    </header>
  )
}
