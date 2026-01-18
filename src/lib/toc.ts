import { remark } from 'remark'
import { visit } from 'unist-util-visit'
import type { Root } from 'mdast'

export interface TocItem {
  id: string
  text: string
  level: number
}

export async function extractTableOfContents(markdown: string): Promise<TocItem[]> {
  const toc: TocItem[] = []

  await remark()
    .use(() => (tree: Root) => {
      visit(tree, 'heading', (node) => {
        if (node.depth >= 2 && node.depth <= 3) {
          const text = node.children
            .filter((child) => child.type === 'text')
            .map((child: any) => child.value)
            .join('')

          if (text) {
            const id = text
              .toLowerCase()
              .replace(/[^a-z0-9\s-]/g, '')
              .replace(/\s+/g, '-')
              .replace(/-+/g, '-')
              .trim()

            toc.push({
              id,
              text,
              level: node.depth,
            })
          }
        }
      })
    })
    .process(markdown)

  return toc
}
