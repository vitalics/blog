import Link from 'next/link'
import { getBlogPosts } from '@/lib/content'
import { SITE } from '@/config/site'
import { BlogCardWithImage } from '@/components/blog-card-with-image'

export const metadata = {
  title: 'Blog',
  description: 'All blog posts',
}

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { page: pageParam } = await searchParams
  const currentPage = pageParam ? parseInt(pageParam) : 1
  
  const posts = getBlogPosts()
  const totalPages = Math.ceil(posts.length / SITE.POSTS_PER_PAGE)

  const startIndex = (currentPage - 1) * SITE.POSTS_PER_PAGE
  const endIndex = startIndex + SITE.POSTS_PER_PAGE
  const displayedPosts = posts.slice(startIndex, endIndex)

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="mb-8 text-4xl font-bold">Blog</h1>
      <div className="space-y-6">
        {displayedPosts.map((post) => (
          <BlogCardWithImage key={post.slug} post={post} />
        ))}
      </div>
      
      {totalPages > 1 && (
        <div className="mt-12 flex justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <Link
              key={page}
              href={page === 1 ? '/blog' : `/blog?page=${page}`}
              className={`rounded px-4 py-2 ${
                page === currentPage
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary hover:bg-secondary/80'
              }`}
            >
              {page}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
