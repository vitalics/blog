import Link from 'next/link'
import { getAllTags } from '@/lib/content'
import { TagIcon } from '@/components/tag-icon'

export const metadata = {
  title: 'Tags',
  description: 'All tags',
}

export default function TagsPage() {
  const tags = getAllTags()

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="mb-8 text-4xl font-bold">Tags</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tags.map(({ tag, count }) => (
          <Link
            key={tag}
            href={`/tags/${tag}`}
            className="group flex items-center gap-3 rounded-lg border p-4 transition-all hover:border-primary hover:bg-accent"
          >
            <TagIcon tag={tag} size={40} />
            <div className="flex-1 overflow-hidden">
              <div className="truncate font-medium capitalize group-hover:text-primary">
                {tag}
              </div>
              <div className="text-sm text-muted-foreground">
                {count} {count === 1 ? 'post' : 'posts'}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
