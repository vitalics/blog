'use client'

import { useEffect, useState } from 'react'
import type { TocItem } from '@/lib/toc'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface TableOfContentsProps {
  items: TocItem[]
}

export function TableOfContents({ items }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>('')
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id)
          }
        })
      },
      { rootMargin: '-80px 0px -80% 0px' }
    )

    items.forEach((item) => {
      const element = document.getElementById(item.id)
      if (element) {
        observer.observe(element)
      }
    })

    return () => observer.disconnect()
  }, [items])

  if (items.length === 0) {
    return null
  }

  const TocList = () => (
    <ul className="space-y-2.5 text-sm">
      {items.map((item) => (
        <li
          key={item.id}
          style={{ paddingLeft: `${(item.level - 2) * 0.75}rem` }}
        >
          <a
            href={`#${item.id}`}
            onClick={(e) => {
              e.preventDefault()
              document.getElementById(item.id)?.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
              })
              setIsOpen(false)
            }}
            className={`block py-1 transition-colors hover:text-foreground ${
              activeId === item.id
                ? 'font-medium text-foreground border-l-2 border-primary pl-2 -ml-2'
                : 'text-muted-foreground'
            }`}
          >
            {item.text}
          </a>
        </li>
      ))}
    </ul>
  )

  return (
    <>
      {/* Mobile/Tablet Version */}
      <div className="mb-8 xl:hidden">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <Button
              variant="outline"
              className="flex w-full items-center justify-between"
            >
              <span className="text-sm font-semibold">On This Page</span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${
                  isOpen ? 'rotate-180' : ''
                }`}
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4 rounded-lg border bg-card p-4">
            <TocList />
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Desktop Version */}
      <nav className="sticky top-20 hidden h-fit max-h-[calc(100vh-8rem)] overflow-y-auto rounded-lg border bg-card p-4 xl:block">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          On This Page
        </h2>
        <TocList />
      </nav>
    </>
  )
}
