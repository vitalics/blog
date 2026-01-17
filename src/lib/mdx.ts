import { compile } from '@mdx-js/mdx'
import rehypeExternalLinks from 'rehype-external-links'
import rehypeKatex from 'rehype-katex'
import rehypePrettyCode from 'rehype-pretty-code'
import rehypeSlug from 'rehype-slug'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import fs from 'fs'
import path from 'path'

const contentDir = path.join(process.cwd(), 'content')

export async function getMDXContent(type: 'blog' | 'authors' | 'projects', slug: string) {
  const extension = type === 'blog' ? 'mdx' : 'md'
  const filePath = path.join(contentDir, type, `${slug}.${extension}`)
  const source = fs.readFileSync(filePath, 'utf8')

  const compiled = await compile(source, {
    outputFormat: 'function-body',
    development: false,
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
            dark: 'github-dark-dimmed',
            light: 'github-light',
          },
        },
      ],
    ],
  })

  return String(compiled)
}
