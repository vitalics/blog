import { getCollection, getEntry } from 'astro:content'
import { defineAction } from 'astro:actions'
import { z } from 'astro:schema'

import flexSearch from 'flexsearch'

type SearchableBlogDocument = {
  title: string
  content: string
}

type SearchableTagDocument = {
  content: string
}

type SearchableAuthorDocument = {
  title: string
  content: string
  description?: string
}

const blogSearch = new flexSearch.Document<SearchableBlogDocument, true>({
  cache: 100,
  document: {
    id: 'id',
    index: ['title', 'content'],
    store: true,
  },
  context: {
    resolution: 9,
    depth: 2,
    bidirectional: true,
  },
})

const tagSearch = new flexSearch.Document<SearchableTagDocument, true>({
  cache: 100,
  preset: 'match',
  tokenize: 'reverse',
  document: {
    id: 'id',
    index: ['title', 'content'],
    store: true,
  },
  optimize: true,
  context: {
    resolution: 9,
    depth: 2,
    bidirectional: true,
  },
})

const authorSearch = new flexSearch.Document<SearchableAuthorDocument>({
  cache: 100,
  preset: 'performance',
  tokenize: 'forward',
  document: {
    id: 'id',
    index: ['title', 'content', 'description'],
  },
})

type SearchResult = {
  blog: { name: string; slug: string }[]
  tags: { name: string; slug: string }[]
  authors: { name: string; slug: string }[]
}

async function loadFinds() {
  const blogCollection = await getCollection(
    'blog',
    ({ data }) => data.draft !== false,
  )

  blogCollection.forEach(async (collection) => {
    blogSearch.addAsync(collection.slug, {
      content: collection.body,
      title: collection.data.title,
    })
  })
  const tags = blogCollection.flatMap((post) => post.data.tags || [])
  const uniqueTags = Array.from(
    new Set(tags.filter((tag): tag is string => typeof tag === 'string')),
  )

  uniqueTags.forEach((tag) => {
    tagSearch.add(tag, {
      content: tag,
    })
  })

  const authorCollection = await getCollection('authors')

  authorCollection.forEach(async (collection) => {
    authorSearch.addAsync(collection.slug, {
      content: collection.body,
      title: collection.data.name,
      description: collection.data.bio,
    })
  })
}

async function findBlog(
  q: string,
  limit: number = 10,
): Promise<SearchResult['blog']> {
  const searchedResult = await blogSearch.searchAsync(q, {
    limit: limit,
    suggest: true,
  })
  const result: SearchResult['blog'] = []
  const blogSet = new Set<string>()
  searchedResult.forEach((result) => {
    result.result.forEach((slug) => {
      blogSet.add(String(slug))
    })
  })

  for await (const slug of blogSet.values()) {
    const singleEntry = await getEntry('blog', slug)
    if (singleEntry) {
      result.push({
        name: singleEntry.data.title,
        slug: `/blog/${singleEntry?.slug}`,
      })
    }
  }
  return result
}

async function findTags(q: string, limit = 10): Promise<SearchResult['tags']> {
  const findedTags = await tagSearch.searchAsync(q, {
    limit,
    suggest: true,
    enrich: true,
  })
  const result: SearchResult['tags'] = []

  const tagSet = new Set<string>()

  findedTags.map((searchResult) => {
    searchResult.result.forEach((slug) => {
      tagSet.add(String(slug.id))
    })
  })

  for (const slug of tagSet.values()) {
    result.push({
      name: slug,
      slug: `/tags/${slug}`,
    })
  }

  return result
}

async function findAuthors(q: string, limit = 10) {
  const findedAuthors = await authorSearch.searchAsync(q, {
    limit,
    suggest: true,
    enrich: true,
  })
  const authorsSet = new Set<string>()
  const result: SearchResult['authors'] = []

  findedAuthors.map((searchResult) => {
    searchResult.result.forEach((slug) => {
      authorsSet.add(String(slug))
    })
  })

  for await (const slug of authorsSet.values()) {
    const author = await getEntry('authors', slug)
    if (author) {
      result.push({
        name: author.data.name,
        slug: `/authors/${slug}`,
      })
    }
  }
  return result
}

export const server = {
  search: defineAction({
    input: z.object({
      q: z.string(),
      limit: z.number().default(10),
      kind: z.enum(['all', 'blog', 'tags', 'authors']).default('all'),
    }),
    handler: async ({ kind, q, limit }) => {
      await loadFinds()
      const result: SearchResult = {
        blog: [],
        tags: [],
        authors: [],
      }
      if (kind === 'blog') {
        result.blog = await findBlog(q, limit)
      } else if (kind === 'authors') {
        result.authors = await findAuthors(q, limit)
      } else if (kind === 'tags') {
        result.tags = await findTags(q, limit)
      } else if (kind === 'all') {
        result.blog = await findBlog(q, limit)
        result.tags = await findTags(q, limit)
        result.authors = await findAuthors(q, limit)
      }
      return result
    },
  }),
}
