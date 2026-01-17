import { SITE } from '@/config/site'
import type { BlogPost, Author } from './content'

export interface BreadcrumbItem {
  name: string
  url: string
}

// Blog Post Structured Data
export function generateBlogPostStructuredData(post: BlogPost, authors: Author[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    image: `${SITE.URL}/static/twitter-card.png`,
    datePublished: post.date.toISOString(),
    dateModified: post.date.toISOString(),
    author: authors.map((author) => ({
      '@type': 'Person',
      name: author.name,
      url: `${SITE.URL}/authors/${author.slug}`,
    })),
    publisher: {
      '@type': 'Organization',
      name: SITE.TITLE,
      url: SITE.URL,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE.URL}/static/logo.png`,
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${SITE.URL}/blog/${post.slug}`,
    },
    keywords: post.tags.join(', '),
  }
}

// Author/Person Structured Data
export function generateAuthorStructuredData(author: Author) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: author.name,
    description: author.bio || `${author.name}'s profile`,
    url: `${SITE.URL}/authors/${author.slug}`,
    image: author.avatar ? `${SITE.URL}${author.avatar}` : undefined,
    sameAs: [
      author.twitter ? `https://twitter.com/${author.twitter}` : undefined,
      author.github ? `https://github.com/${author.github}` : undefined,
    ].filter(Boolean),
  }
}

// Tag/Category Structured Data
export function generateTagStructuredData(tag: string, postsCount: number) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: tag,
    description: `Articles tagged with ${tag}`,
    url: `${SITE.URL}/tags/${tag}`,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: postsCount,
    },
  }
}

// Breadcrumb Structured Data
export function generateBreadcrumbStructuredData(items: BreadcrumbItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${SITE.URL}${item.url}`,
    })),
  }
}

// Website Structured Data
export function generateWebsiteStructuredData() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE.TITLE,
    description: SITE.DESCRIPTION,
    url: SITE.URL,
    publisher: {
      '@type': 'Organization',
      name: SITE.TITLE,
      url: SITE.URL,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE.URL}/static/logo.png`,
      },
    },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE.URL}/blog?search={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  }
}
