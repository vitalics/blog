import Link from 'next/link'
import { getAuthors } from '@/lib/content'

export const metadata = {
  title: 'Authors',
  description: 'All authors',
}

export default function AuthorsPage() {
  const authors = getAuthors()

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="mb-8 text-4xl font-bold">Authors</h1>
      <div className="grid gap-6 md:grid-cols-2">
        {authors.map((author) => (
          <Link
            key={author.slug}
            href={`/authors/${author.slug}`}
            className="group rounded-lg border p-6 hover:border-primary"
          >
            <h2 className="mb-2 text-xl font-semibold group-hover:underline">
              {author.name}
            </h2>
            {author.pronouns && (
              <p className="mb-2 text-sm text-muted-foreground">{author.pronouns}</p>
            )}
            {author.bio && <p className="text-muted-foreground">{author.bio}</p>}
          </Link>
        ))}
      </div>
    </div>
  )
}
