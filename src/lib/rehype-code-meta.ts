import { visit } from 'unist-util-visit'
import type { Root, Element } from 'hast'

export function rehypeCodeMeta() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element, index, parent) => {
      if (node.tagName === 'pre' && node.children[0]?.type === 'element') {
        const codeEl = node.children[0] as Element
        
        if (codeEl.tagName === 'code') {
          const meta = codeEl.data?.meta as string | undefined
          
          if (!meta) return

          // Parse meta string for various attributes
          const metaParts = meta.split(' ')
          
          for (const part of metaParts) {
            // Handle title="..." or title:"..."
            const titleMatch = part.match(/title=["'](.+?)["']/) || part.match(/title:["'](.+?)["']/)
            if (titleMatch) {
              node.properties = node.properties || {}
              node.properties['data-title'] = titleMatch[1]
            }
            
            // Handle caption="..." or caption:"..."
            const captionMatch = part.match(/caption=["'](.+?)["']/) || part.match(/caption:["'](.+?)["']/)
            if (captionMatch) {
              node.properties = node.properties || {}
              node.properties['data-caption'] = captionMatch[1]
            }
            
            // Handle showLineNumbers or showlinenumbers
            if (part === 'showLineNumbers' || part === 'showlinenumbers') {
              codeEl.properties = codeEl.properties || {}
              codeEl.properties['data-line-numbers'] = true
            }
            
            // Handle line highlighting {1-3,5}
            const highlightMatch = part.match(/\{(.+?)\}/)
            if (highlightMatch) {
              node.properties = node.properties || {}
              node.properties['data-highlight-lines'] = highlightMatch[1]
            }
          }
        }
      }
    })
  }
}
