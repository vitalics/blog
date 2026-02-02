import { notFound, redirect } from 'next/navigation'
import { MDXRemote } from 'next-mdx-remote/rsc'
import { getBlogPost, getBlogPosts, getAdjacentPosts } from '@/lib/content'
import { parseAuthors } from '@/lib/authors'
import { extractTableOfContents } from '@/lib/toc'
import { TableOfContents } from '@/components/table-of-contents'
import { BlogNavigation } from '@/components/blog-navigation'
import { PostNavigation } from '@/components/post-navigation'
import { BlogCardWithImage } from '@/components/blog-card-with-image'
import { TagWithIcon } from '@/components/tag-with-icon'
import Link from 'next/link'
import Image from 'next/image'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeSlug from 'rehype-slug'
import rehypeExternalLinks from 'rehype-external-links'
import rehypeKatex from 'rehype-katex'
import rehypePrettyCode from 'rehype-pretty-code'
import { rehypeCodeMeta } from '@/lib/rehype-code-meta'
import { rehypeCodeCopy } from '@/lib/rehype-code-copy'
import { CodeBlockWrapper } from '@/components/code-block-wrapper'
import { getCodeTheme } from '@/config/code-themes'
import { SITE } from '@/config/site'
import { MDXWrapper } from '@/components/mdx-wrapper'
import { Breadcrumbs } from '@/components/breadcrumbs'
import { StructuredData } from '@/components/structured-data'
import {
  generateBlogPostStructuredData,
  generateBreadcrumbStructuredData,
  type BreadcrumbItem,
} from '@/lib/structured-data'
import FileTree, { FileTreeFolder, FileTreeFile } from '@/components/file-tree'
import { Giscus } from '@/components/giscus'

// YouTube embed component
function YouTube({ id }: { id: string }) {
  return (
    <div className="my-6 aspect-video">
      <iframe
        src={`https://www.youtube.com/embed/${id}`}
        title="YouTube video player"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="h-full w-full rounded-lg"
      />
    </div>
  )
}

// Vimeo embed component
function Vimeo({ id }: { id: string}) {
  return (
    <div className="my-6 aspect-video">
      <iframe
        src={`https://player.vimeo.com/video/${id}`}
        title="Vimeo video player"
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
        className="h-full w-full rounded-lg"
      />
    </div>
  )
}

const components = {
  FileTree,
  FileTreeFolder,
  FileTreeFile,
  YouTube,
  Vimeo,
}

// Use default code theme for static generation, client-side will apply user preference

export async function generateStaticParams() {
  const posts = getBlogPosts()
  const totalPages = Math.ceil(posts.length / SITE.POSTS_PER_PAGE)
  
  // Generate params for all blog posts
  const postParams = posts.map((post) => ({
    slugOrPage: post.slug,
  }))
  
  // Generate params for pagination pages (2 and onwards)
  const pageParams = Array.from({ length: totalPages - 1 }, (_, i) => ({
    slugOrPage: String(i + 2),
  }))
  
  return [...postParams, ...pageParams]
}

export async function generateMetadata({ params }: { params: Promise<{ slugOrPage: string }> }) {
  const { slugOrPage } = await params
  
  // Check if it's a page number (pure digits)
  if (/^\d+$/.test(slugOrPage)) {
    return {
      title: `Blog - Page ${slugOrPage}`,
      description: 'All blog posts',
    }
  }
  
  // Otherwise it's a blog post slug
  const post = getBlogPost(slugOrPage)
  if (!post) {
    return {}
  }

  return {
    title: post.title,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      type: 'article',
      publishedTime: post.date.toISOString(),
      authors: post.authors,
      tags: post.tags,
    },
  }
}

export default async function BlogSlugOrPagePage({
  params,
}: {
  params: Promise<{ slugOrPage: string }>
}) {
  const { slugOrPage } = await params
  
  // Check if it's a page number (pure digits)
  if (/^\d+$/.test(slugOrPage)) {
    const currentPage = parseInt(slugOrPage)
    const posts = getBlogPosts()
    const totalPages = Math.ceil(posts.length / SITE.POSTS_PER_PAGE)

    // Page 1 should redirect to /blog
    if (currentPage === 1) {
      redirect('/blog')
    }

    // Check if page is valid
    if (currentPage < 1 || currentPage > totalPages || isNaN(currentPage)) {
      notFound()
    }

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
                href={page === 1 ? '/blog' : `/blog/${page}`}
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

  // Otherwise, it's a blog post slug
  const post = getBlogPost(slugOrPage)

  if (!post) {
    notFound()
  }

  const authors = parseAuthors(post.authors)
  const toc = await extractTableOfContents(post.content)
  const { previousPost, nextPost } = getAdjacentPosts(slugOrPage)

  // Use default code theme for static generation - client JS will handle user preferences
  const codeTheme = getCodeTheme('github')

  // Generate breadcrumbs
  const breadcrumbs: BreadcrumbItem[] = [
    { name: 'Home', url: '/' },
    { name: 'Blog', url: '/blog' },
    { name: post.title, url: `/blog/${post.slug}` },
  ]

  // Generate structured data
  const blogPostStructuredData = generateBlogPostStructuredData(post, authors)
  const breadcrumbStructuredData = generateBreadcrumbStructuredData(breadcrumbs)

  return (
    <>
      <StructuredData data={blogPostStructuredData} />
      <StructuredData data={breadcrumbStructuredData} />
      <div className="mx-auto grid w-full max-w-[1600px] grid-cols-1 gap-8 px-4 py-12 xl:grid-cols-[minmax(0,900px)_280px] xl:px-8">
        <article className="min-w-0 w-full">
          <Breadcrumbs items={breadcrumbs} />
          
          {post.image && (
            <div className="relative mb-8 aspect-video w-full overflow-hidden rounded-lg bg-muted">
              <Image
                src={post.image}
                alt={post.title}
                fill
                className="object-cover"
                priority
              />
            </div>
          )}

          <header className="mb-8">
            <h1 className="mb-4 text-4xl font-bold">{post.title}</h1>
          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
            <time dateTime={post.date.toISOString()}>
              {post.date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </time>
            <span>•</span>
            <span>{post.readingTime}</span>
            <span>•</span>
            <div className="flex gap-2">
              {authors.map((author) => (
                <Link
                  key={author.slug}
                  href={`/authors/${author.slug}`}
                  className="hover:underline"
                >
                  {author.name}
                </Link>
              ))}
            </div>
          </div>
          {post.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <TagWithIcon key={tag} tag={tag} />
              ))}
            </div>
          )}
        </header>

        {/* Mobile/Tablet TOC */}
        <div className="xl:hidden">
          <TableOfContents items={toc} />
        </div>

        <MDXWrapper>
          <div className="prose max-w-none">
            <CodeBlockWrapper />
            <MDXRemote
              source={post.content}
              components={components}
              options={{
              mdxOptions: {
                remarkPlugins: [remarkGfm, remarkMath],
                rehypePlugins: [
                  rehypeSlug,
                  [
                    rehypeExternalLinks,
                    {
                      target: '_blank',
                      rel: ['nofollow', 'noopener', 'noreferrer'],
                    },
                  ],
                  rehypeKatex,
                  [
                    rehypePrettyCode as any,
                    {
                      theme: {
                        light: codeTheme.light,
                        dark: codeTheme.dark,
                      },
                      keepBackground: false,
                      defaultLang: 'plaintext',
                      onVisitLine(node: any) {
                        // Prevent empty lines from collapsing
                        if (node.children.length === 0) {
                          node.children = [{ type: 'text', value: ' ' }]
                        }
                      },
                      onVisitHighlightedLine(node: any) {
                        node.properties.className?.push('highlighted')
                      },
                      onVisitHighlightedChars(node: any) {
                        node.properties.className = ['word']
                      },
                    },
                  ],
                  rehypeCodeMeta,
                  rehypeCodeCopy,
                ],
              },
            }}
            />
          </div>
        </MDXWrapper>

        <PostNavigation prev={previousPost} next={nextPost} />

        <div className="mt-12">
          <Giscus
            repo="vitalics/blog"
            repoId="R_kgDOKPeNuw"
            category="Q&A"
            categoryId="DIC_kwDOKPeNu84C1UX0"
            mapping="pathname"
            strict="0"
            reactionsEnabled="1"
            emitMetadata="0"
            inputPosition="bottom"
            lang="en"
          />
        </div>
      </article>
      <aside className="hidden xl:block">
        <TableOfContents items={toc} />
      </aside>
    </div>
    </>
  )
}
