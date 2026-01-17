import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import readingTime from 'reading-time'

const contentDir = path.join(process.cwd(), 'content')

export interface BlogPost {
  slug: string
  title: string
  description: string
  date: Date
  image?: string
  tags: string[]
  authors: string[]
  telegram_channel?: string
  draft?: boolean
  readingTime: string
  content: string
}

export interface Author {
  slug: string
  name: string
  pronouns?: string
  avatar?: string
  image?: string
  bio?: string
  website?: string
  github?: string
  twitter?: string
  linkedin?: string
  discord?: string
  telegram?: string
  devto?: string
  medium?: string
  hashnode?: string
  mail?: string
  content: string
}

export interface Project {
  slug: string
  name: string
  description: string
  tags: string[]
  image: string
  link: string
  role: 'author' | 'contributor'
  content: string
}

function parseMarkdownFile<T>(filePath: string, slug: string): T & { content: string } {
  const fileContents = fs.readFileSync(filePath, 'utf8')
  const { data, content } = matter(fileContents)
  return { ...data, slug, content } as unknown as T & { content: string }
}

export function getBlogPosts(): BlogPost[] {
  const blogDir = path.join(contentDir, 'blog')
  const files = fs.readdirSync(blogDir).filter((file) => file.endsWith('.mdx'))

  const posts = files.map((file) => {
    const slug = file.replace(/\.mdx$/, '')
    const filePath = path.join(blogDir, file)
    const post = parseMarkdownFile<Omit<BlogPost, 'slug' | 'readingTime'>>(filePath, slug)
    
    return {
      ...post,
      slug,
      date: new Date(post.date),
      readingTime: readingTime(post.content).text,
    }
  })

  return posts
    .filter((post) => !post.draft)
    .sort((a, b) => b.date.getTime() - a.date.getTime())
}

export function getBlogPost(slug: string): BlogPost | undefined {
  const posts = getBlogPosts()
  return posts.find((post) => post.slug === slug)
}

export function getAuthors(): Author[] {
  const authorsDir = path.join(contentDir, 'authors')
  const files = fs.readdirSync(authorsDir).filter((file) => file.endsWith('.md'))

  return files.map((file) => {
    const slug = file.replace(/\.md$/, '')
    const filePath = path.join(authorsDir, file)
    const author = parseMarkdownFile<Omit<Author, 'slug'>>(filePath, slug)
    return { ...author, slug }
  })
}

export function getAuthor(slug: string): Author | undefined {
  const authors = getAuthors()
  return authors.find((author) => author.slug === slug)
}

export function getProjects(): Project[] {
  const projectsDir = path.join(contentDir, 'projects')
  const files = fs.readdirSync(projectsDir).filter((file) => file.endsWith('.md'))

  return files.map((file) => {
    const slug = file.replace(/\.md$/, '')
    const filePath = path.join(projectsDir, file)
    const project = parseMarkdownFile<Omit<Project, 'slug'>>(filePath, slug)
    return { ...project, slug }
  })
}

export function getAllTags(): { tag: string; count: number }[] {
  const posts = getBlogPosts()
  const tagCounts = new Map<string, number>()

  posts.forEach((post) => {
    post.tags.forEach((tag) => {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)
    })
  })

  return Array.from(tagCounts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
}

export function getPostsByTag(tag: string): BlogPost[] {
  const posts = getBlogPosts()
  return posts.filter((post) => post.tags.includes(tag))
}

export function getPostsByAuthor(authorSlug: string): BlogPost[] {
  const posts = getBlogPosts()
  return posts.filter((post) => post.authors.includes(authorSlug))
}

export function getAdjacentPosts(slug: string): {
  previousPost: BlogPost | null
  nextPost: BlogPost | null
} {
  const posts = getBlogPosts()
  const currentIndex = posts.findIndex((post) => post.slug === slug)

  if (currentIndex === -1) {
    return { previousPost: null, nextPost: null }
  }

  // Previous post is the one before (older)
  const previousPost = currentIndex < posts.length - 1 ? posts[currentIndex + 1] : null
  // Next post is the one after (newer)
  const nextPost = currentIndex > 0 ? posts[currentIndex - 1] : null

  return { previousPost, nextPost }
}
