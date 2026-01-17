import Link from 'next/link'
import { ChevronLeftIcon, ChevronRightIcon } from '@radix-ui/react-icons'
import type { BlogPost } from '@/lib/content'

interface BlogNavigationProps {
  previousPost?: BlogPost | null
  nextPost?: BlogPost | null
}

export function BlogNavigation({ previousPost, nextPost }: BlogNavigationProps) {
  if (!previousPost && !nextPost) {
    return null
  }

  return (
    <nav className="border-y py-8">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Previous Post */}
        <div className="flex">
          {previousPost ? (
            <Link
              href={`/blog/${previousPost.slug}`}
              className="group flex w-full items-start gap-4 rounded-lg border p-4 transition-colors hover:bg-accent"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-background transition-colors group-hover:border-primary">
                <ChevronLeftIcon className="h-5 w-5" />
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-xs font-medium text-muted-foreground">Previous</p>
                <h3 className="mt-1 truncate font-semibold transition-colors group-hover:text-primary">
                  {previousPost.title}
                </h3>
                {previousPost.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {previousPost.description}
                  </p>
                )}
              </div>
            </Link>
          ) : (
            <div className="w-full" />
          )}
        </div>

        {/* Next Post */}
        <div className="flex justify-end">
          {nextPost ? (
            <Link
              href={`/blog/${nextPost.slug}`}
              className="group flex w-full items-start gap-4 rounded-lg border p-4 transition-colors hover:bg-accent"
            >
              <div className="flex-1 overflow-hidden text-right">
                <p className="text-xs font-medium text-muted-foreground">Next</p>
                <h3 className="mt-1 truncate font-semibold transition-colors group-hover:text-primary">
                  {nextPost.title}
                </h3>
                {nextPost.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {nextPost.description}
                  </p>
                )}
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-background transition-colors group-hover:border-primary">
                <ChevronRightIcon className="h-5 w-5" />
              </div>
            </Link>
          ) : (
            <div className="w-full" />
          )}
        </div>
      </div>
    </nav>
  )
}
