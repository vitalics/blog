'use server'

import { getBlogPosts } from '@/lib/content'
import { getAllAuthors } from '@/lib/authors'
import type { SearchResult } from '@/lib/search'

export async function getSearchData(): Promise<SearchResult[]> {
  const results: SearchResult[] = []

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
