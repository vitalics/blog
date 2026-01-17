import Image from 'next/image'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import type { BlogPost } from '@/lib/content'
import { PrefetchLink } from './prefetch-link'

interface PostNavigationProps {
  prev?: BlogPost | null
  next?: BlogPost | null
}

export function PostNavigation({ prev, next }: PostNavigationProps) {
  if (!prev && !next) {
    return null
  }

  return (
    <nav className="mt-12 grid gap-4 border-t pt-8 sm:grid-cols-2">
      {prev && (
        <PrefetchLink
          href={`/blog/${prev.slug}`}
          className="group flex flex-col gap-2 rounded-lg border bg-card p-4 transition-all hover:shadow-md"
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ArrowLeft className="h-4 w-4" />
            <span>Previous post</span>
          </div>
          {prev.image && (
            <div className="relative aspect-video w-full overflow-hidden rounded-md bg-muted">
              <Image
                src={prev.image}
                alt={prev.title}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            </div>
          )}
          <h3 className="font-semibold transition-colors group-hover:text-primary">
            {prev.title}
          </h3>
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {prev.description}
          </p>
        </PrefetchLink>
      )}
      {next && (
        <PrefetchLink
          href={`/blog/${next.slug}`}
          className="group flex flex-col gap-2 rounded-lg border bg-card p-4 transition-all hover:shadow-md sm:col-start-2"
        >
          <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
            <span>Next post</span>
            <ArrowRight className="h-4 w-4" />
          </div>
          {next.image && (
            <div className="relative aspect-video w-full overflow-hidden rounded-md bg-muted">
              <Image
                src={next.image}
                alt={next.title}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            </div>
          )}
          <h3 className="font-semibold transition-colors group-hover:text-primary">
            {next.title}
          </h3>
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {next.description}
          </p>
        </PrefetchLink>
      )}
    </nav>
  )
}
