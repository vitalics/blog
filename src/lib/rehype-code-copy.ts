import { visit } from 'unist-util-visit'
import type { Root, Element, ElementContent } from 'hast'

function extractTextFromNode(node: ElementContent): string {
  if (node.type === 'text') {
    return node.value
  }
  if (node.type === 'element' && node.children) {
    return node.children.map(extractTextFromNode).join('')
  }
  return ''
}

export function rehypeCodeCopy() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element) => {
      if (node.tagName === 'pre' && node.children[0]?.type === 'element') {
        const codeEl = node.children[0] as Element
        
        if (codeEl.tagName === 'code') {
          // Extract the text content from the code element
          const codeText = codeEl.children.map(extractTextFromNode).join('')
          
          // Add data attribute with the code content
          if (!node.properties) {
            node.properties = {}
          }
          node.properties['data-code'] = codeText
          
          // Add a class to indicate this pre has copy functionality
          const className = node.properties.className as string[] | undefined
          node.properties.className = [...(className || []), 'code-block-with-copy']
        }
      }
    })
  }
}
