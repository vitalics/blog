import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getPostsByTag, getAllTags } from '@/lib/content'
import { TagIcon } from '@/components/tag-icon'
import { Breadcrumbs } from '@/components/breadcrumbs'
import { StructuredData } from '@/components/structured-data'
import {
  generateTagStructuredData,
  generateBreadcrumbStructuredData,
  type BreadcrumbItem,
} from '@/lib/structured-data'

export async function generateStaticParams() {
  const tags = getAllTags()
  return tags.map(({ tag }) => ({
    slug: tag,
  }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  return {
    title: `Posts tagged with "${slug}"`,
    description: `All posts tagged with ${slug}`,
  }
}

export default async function TagPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const posts = getPostsByTag(slug)

  if (posts.length === 0) {
    notFound()
  }

  // Generate breadcrumbs
  const breadcrumbs: BreadcrumbItem[] = [
    { name: 'Home', url: '/' },
    { name: 'Tags', url: '/tags' },
    { name: slug, url: `/tags/${slug}` },
  ]

  // Generate structured data
  const tagStructuredData = generateTagStructuredData(slug, posts.length)
  const breadcrumbStructuredData = generateBreadcrumbStructuredData(breadcrumbs)

  return (
    <>
      <StructuredData data={tagStructuredData} />
      <StructuredData data={breadcrumbStructuredData} />
      <div className="mx-auto max-w-4xl px-4 py-12">
        <Breadcrumbs items={breadcrumbs} />
        <div className="mb-8 flex items-center gap-4">
        <TagIcon tag={slug} size={48} />
        <h1 className="text-4xl font-bold capitalize">
          {slug}
        </h1>
      </div>
      <p className="mb-8 text-muted-foreground">
        {posts.length} {posts.length === 1 ? 'post' : 'posts'} tagged with "{slug}"
      </p>
      <div className="space-y-6">
        {posts.map((post) => (
          <article key={post.slug} className="border-b pb-6 last:border-0">
            <Link href={`/blog/${post.slug}`} className="group">
              <h2 className="mb-2 text-2xl font-semibold group-hover:underline">
                {post.title}
              </h2>
              <p className="mb-2 text-muted-foreground">{post.description}</p>
              <div className="text-sm text-muted-foreground">
                <time dateTime={post.date.toISOString()}>
                  {post.date.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </time>
                <span> • </span>
                <span>{post.readingTime}</span>
              </div>
            </Link>
          </article>
        ))}
      </div>
    </div>
    </>
  )
}
