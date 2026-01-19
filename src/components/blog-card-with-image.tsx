import Image from 'next/image'
import type { BlogPost } from '@/lib/content'
import { TagIcon } from './tag-icon'
import { PrefetchLink } from './prefetch-link'

interface BlogCardWithImageProps {
  post: BlogPost
}

export function BlogCardWithImage({ post }: BlogCardWithImageProps) {
  return (
    <article className="group overflow-hidden rounded-lg border bg-card transition-all hover:shadow-lg">
      <PrefetchLink href={`/blog/${post.slug}`} className="flex flex-col sm:flex-row">
        {post.image && (
          <div className="relative aspect-video w-full overflow-hidden bg-muted sm:aspect-auto sm:w-64 sm:shrink-0">
            <Image
              src={post.image}
              alt={post.title}
              fill
              className="object-cover object-center transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 640px) 100vw, 256px"
            />
          </div>
        )}
        <div className="flex flex-1 flex-col p-6">
          <h2 className="mb-2 text-xl font-semibold transition-colors group-hover:text-primary sm:text-2xl">
            {post.title}
          </h2>
          <p className="mb-4 flex-1 text-muted-foreground line-clamp-2">
            {post.description}
          </p>
          
          <div className="mb-4 flex flex-wrap gap-2">
            {post.tags.slice(0, 3).map((tag) => (
              <div
                key={tag}
                className="flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs"
              >
                <TagIcon tag={tag} size={12} />
                <span>{tag}</span>
              </div>
            ))}
            {post.tags.length > 3 && (
              <span className="rounded-full bg-secondary px-3 py-1 text-xs">
                +{post.tags.length - 3}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <time dateTime={post.date.toISOString()}>
              {new Intl.DateTimeFormat('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                timeZone: 'UTC',
              }).format(post.date)}
            </time>
            <span>•</span>
            <span>{post.readingTime}</span>
          </div>
        </div>
      </PrefetchLink>
    </article>
  )
}
