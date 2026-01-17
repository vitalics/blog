export interface KnownTag {
  name: string
  image: string
  color?: string
}

export const KNOWN_TAGS: Record<string, KnownTag> = {
  typescript: {
    name: 'TypeScript',
    image: '/tags/typescript.svg',
    color: '#3178C6',
  },
  javascript: {
    name: 'JavaScript',
    image: '/tags/javascript.svg',
    color: '#F7DF1E',
  },
  nodejs: {
    name: 'Node.js',
    image: '/tags/nodejs.svg',
    color: '#339933',
  },
  react: {
    name: 'React',
    image: '/tags/react.svg',
    color: '#61DAFB',
  },
  nextjs: {
    name: 'Next.js',
    image: '/tags/nextjs.svg',
    color: '#000000',
  },
  playwright: {
    name: 'Playwright',
    image: '/tags/playwright.svg',
    color: '#2EAD33',
  },
  bun: {
    name: 'Bun',
    image: '/tags/bun.svg',
    color: '#FBF0DF',
  },
  github: {
    name: 'GitHub',
    image: '/tags/github.svg',
    color: '#181717',
  },
  ts: {
    name: 'TypeScript',
    image: '/tags/typescript.svg',
    color: '#3178C6',
  },
  preact: {
    name: 'Preact',
    image: '/tags/preact.svg',
    color: '#673AB8',
  },
  telegram: {
    name: 'Telegram',
    image: '/tags/telegram.svg',
    color: '#26A5E4',
  },
  zod: {
    name: 'Zod',
    image: '/tags/zod.svg',
    color: '#3E67B1',
  },
  ajv: {
    name: 'AJV',
    image: '/tags/ajv.svg',
    color: '#23282D',
  },
  k6: {
    name: 'k6',
    image: '/tags/k6.svg',
    color: '#7D64FF',
  },
}

export function isKnownTag(tag: string): boolean {
  return tag in KNOWN_TAGS
}

export function getKnownTag(tag: string): KnownTag | null {
  return KNOWN_TAGS[tag] || null
}
