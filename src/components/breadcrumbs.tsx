import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import type { BreadcrumbItem } from '@/lib/structured-data'

interface BreadcrumbsProps {
  items: BreadcrumbItem[]
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        {items.map((item, index) => {
          const isLast = index === items.length - 1

          return (
            <li key={item.url} className="flex items-center gap-2">
              {!isLast ? (
                <>
                  <Link
                    href={item.url}
                    className="transition-colors hover:text-foreground"
                  >
                    {item.name}
                  </Link>
                  <ChevronRight className="h-4 w-4" />
                </>
              ) : (
                <span className="font-medium text-foreground" aria-current="page">
                  {item.name}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
