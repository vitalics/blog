import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { MDXRemote } from 'next-mdx-remote/rsc'
import { getAuthor, getAuthors, getPostsByAuthor } from '@/lib/content'
import { Breadcrumbs } from '@/components/breadcrumbs'
import { StructuredData } from '@/components/structured-data'
import { BlogCardWithImage } from '@/components/blog-card-with-image'
import { AuthorSocialLinks } from '@/components/author-social-links'
import remarkGfm from 'remark-gfm'
import {
  generateAuthorStructuredData,
  generateBreadcrumbStructuredData,
  type BreadcrumbItem,
} from '@/lib/structured-data'

export async function generateStaticParams() {
  const authors = getAuthors()
  return authors.map((author) => ({
    slug: author.slug,
  }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const author = getAuthor(slug)

  if (!author) {
    return {}
  }

  return {
    title: author.name,
    description: author.bio || `Posts by ${author.name}`,
  }
}

export default async function AuthorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const author = getAuthor(slug)

  if (!author) {
    notFound()
  }

  const posts = getPostsByAuthor(slug)

  // Generate breadcrumbs
  const breadcrumbs: BreadcrumbItem[] = [
    { name: 'Home', url: '/' },
    { name: 'Authors', url: '/authors' },
    { name: author.name, url: `/authors/${author.slug}` },
  ]

  // Generate structured data
  const authorStructuredData = generateAuthorStructuredData(author)
  const breadcrumbStructuredData = generateBreadcrumbStructuredData(breadcrumbs)

  return (
    <>
      <StructuredData data={authorStructuredData} />
      <StructuredData data={breadcrumbStructuredData} />
      <div className="mx-auto max-w-4xl px-4 py-12">
        <Breadcrumbs items={breadcrumbs} />
        
        <div className="mb-12 overflow-hidden rounded-lg border bg-card">
          {author.image && (
            <div className="relative aspect-[3/1] w-full overflow-hidden bg-muted">
              <Image
                src={author.image}
                alt={author.name}
                fill
                className="object-cover"
                priority
              />
            </div>
          )}
          <div className="p-8">
            <header className="mb-6">
              <h1 className="mb-2 text-4xl font-bold">{author.name}</h1>
              {author.pronouns && (
                <p className="text-muted-foreground">{author.pronouns}</p>
              )}
            </header>

            <div className="prose prose-neutral dark:prose-invert mb-6 max-w-none">
              <MDXRemote
                source={author.content}
                options={{
                  mdxOptions: {
                    remarkPlugins: [remarkGfm],
                  },
                }}
              />
            </div>

            <AuthorSocialLinks author={author} />
          </div>
        </div>

      <section>
        <h2 className="mb-6 text-2xl font-bold">Posts by {author.name}</h2>
        <div className="space-y-6">
          {posts.map((post) => (
            <BlogCardWithImage key={post.slug} post={post} />
          ))}
        </div>
      </section>
    </div>
    </>
  )
}
