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
          
          // Extract language from code element's className (e.g., language-typescript)
          const codeClassName = codeEl.properties?.className as string[] | undefined
          if (codeClassName) {
            const languageClass = codeClassName.find((cls) => cls.startsWith('language-'))
            if (languageClass) {
              const language = languageClass.replace('language-', '')
              node.properties['data-language'] = language
            }
          }
          
          // Extract title and caption if they exist
          const title = node.properties['data-title']
          const caption = node.properties['data-caption']
          
          if (title) {
            node.properties['data-title'] = title
          }
          
          if (caption) {
            node.properties['data-caption'] = caption
          }
          
          // Add a class to indicate this pre has copy functionality
          const className = node.properties.className as string[] | undefined
          node.properties.className = [...(className || []), 'code-block-with-copy']
        }
      }
    })
  }
}
