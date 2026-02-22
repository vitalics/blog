'use server'

import { getBlogPosts } from '@/lib/content'
import { getAllAuthors } from '@/lib/authors'
import type { SearchResult } from '@/lib/search'

const UTILS_TOOLS: SearchResult[] = [
  {
    type: 'tool',
    title: 'Image Converter',
    description: 'Convert images between formats (PNG → WebP and more) entirely in your browser.',
    url: '/utils/image-converter',
  },
  {
    type: 'tool',
    title: 'Archive Builder',
    description: 'Pack files into ZIP, TAR.GZ, or GZip archives in your browser.',
    url: '/utils/zip-builder',
  },
]

export async function getSearchData(): Promise<SearchResult[]> {
  const results: SearchResult[] = []

  // Add utility tools
  results.push(...UTILS_TOOLS)

  // Add blog posts
  const posts = getBlogPosts()
  posts.forEach((post) => {
    results.push({
      type: 'post',
      title: post.title,
      description: post.description,
      url: `/blog/${post.slug}`,
    })
  })

  // Add tags (unique from all posts)
  const allTags = new Set<string>()
  posts.forEach((post) => {
    post.tags.forEach((tag) => allTags.add(tag))
  })
  
  Array.from(allTags).forEach((tag) => {
    results.push({
      type: 'tag',
      title: tag,
      description: `View all posts tagged with ${tag}`,
      url: `/tags/${tag}`,
    })
  })

  // Add authors
  const authors = getAllAuthors()
  authors.forEach((author) => {
    results.push({
      type: 'author',
      title: author.name,
      description: author.bio || `View posts by ${author.name}`,
      url: `/authors/${author.slug}`,
    })
  })

  return results
}
