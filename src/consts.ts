export type Site = {
  TITLE: string
  DESCRIPTION: string
  EMAIL: string
  NUM_POSTS_ON_HOMEPAGE: number
  POSTS_PER_PAGE: number
}

export type Link = {
  href: string
  label: string
}

export const SITE: Site = {
  TITLE: 'Haradkou SDET',
  DESCRIPTION: 'Vitali Haradkou`s site - Senior SDET Engineer',
  EMAIL: 'vitalicset@gmail.com',
  NUM_POSTS_ON_HOMEPAGE: 5,
  POSTS_PER_PAGE: 5,
}

export const NAV_LINKS: Link[] = [
  { href: '/blog', label: 'blog' },
  { href: '/authors', label: 'authors' },
  { href: '/projects', label: 'projects' },
  { href: '/tags', label: 'tags' },
]

export const SOCIAL_LINKS: Link[] = [
  { href: 'https://github.com/vitalics', label: 'GitHub' },
  { href: 'vitalicset@gmail.com', label: 'Email' },
  { href: '/rss.xml', label: 'RSS' },
]
