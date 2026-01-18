import Link from 'next/link'
import { getBlogPosts } from '@/lib/content'
import { SITE } from '@/config/site'
import { BlogCardWithImage } from '@/components/blog-card-with-image'

export default function HomePage() {
  const posts = getBlogPosts().slice(0, SITE.NUM_POSTS_ON_HOMEPAGE)

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <header className="mb-12">
        <h1 className="mb-4 text-4xl font-bold">{SITE.TITLE}</h1>
        <div className="space-y-2">
          <h3 className="text-xl font-semibold">Vitali Haradkou</h3>
          <p className="text-muted-foreground">
            Software engineer in Test(SDET).
          </p>
          <p className="text-muted-foreground">
            Certified Node.js Application Developer(JSNAD).
          </p>
          <p className="mt-4 text-muted-foreground">
            I am a SDET enginner and use typescript, node.js to solve every-day tasks!
          </p>
          <p className="text-muted-foreground">
            I build some tools and experiment with new technologies/libraries and share in web!
          </p>
        </div>
      </header>

      <section className="mb-12">
        <h2 className="mb-6 text-2xl font-bold">Latest posts</h2>
        <div className="space-y-6">
          {posts.map((post) => (
            <BlogCardWithImage key={post.slug} post={post} />
          ))}
        </div>
        <div className="mt-8">
          <Link
            href="/blog"
            className="inline-flex items-center text-sm font-medium hover:underline"
          >
            See all posts →
          </Link>
        </div>
      </section>
    </div>
  )
}
