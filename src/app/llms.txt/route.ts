import { getBlogPosts } from '@/lib/content'
import { SITE } from '@/config/site'

export async function GET() {
  const posts = getBlogPosts()

  const llmsTxt = `# ${SITE.TITLE}

> ${SITE.DESCRIPTION}

## Site Information

- Title: ${SITE.TITLE}
- URL: ${SITE.URL}
- Description: ${SITE.DESCRIPTION}
- Contact: ${SITE.EMAIL}
- RSS Feed: ${SITE.URL}/rss.xml

## Content

This blog contains ${posts.length} posts covering topics in software engineering, testing, automation, and development tools.

### Recent Blog Posts

${posts
  .slice(0, 10)
  .map(
    (post) => `- [${post.title}](${SITE.URL}/blog/${post.slug})
  Published: ${post.date.toISOString().split('T')[0]}
  Description: ${post.description}
  Tags: ${post.tags.join(', ')}`
  )
  .join('\n\n')}

## Navigation

- Blog: ${SITE.URL}/blog
- Authors: ${SITE.URL}/authors
- Projects: ${SITE.URL}/projects
- Tags: ${SITE.URL}/tags

## Technologies

This site is built with Next.js, React, TypeScript, MDX, and Tailwind CSS.

---

For more information, visit ${SITE.URL}`

  return new Response(llmsTxt, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
