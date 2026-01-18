'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { CodeCopyButton } from './code-copy-button'
import { CodeExpandButton } from './code-expand-button'

interface CodeBlock {
  code: string
  container: HTMLElement
  preElement: HTMLElement
  language?: string
  title?: string
  caption?: string
}

export function CodeBlockWrapper() {
  const [codeBlocks, setCodeBlocks] = useState<CodeBlock[]>([])

  useEffect(() => {
    // Find all code blocks with the copy functionality
    const blocks = document.querySelectorAll('pre.code-block-with-copy')
    
    const foundBlocks: CodeBlock[] = []
    
    blocks.forEach((pre) => {
      const preElement = pre as HTMLElement
      const codeContent = preElement.getAttribute('data-code')
      const language = preElement.getAttribute('data-language')
      const title = preElement.getAttribute('data-title')
      const caption = preElement.getAttribute('data-caption')

      if (!codeContent) return

      // Make pre element relative positioned
      preElement.style.position = 'relative'

      // Create a container for the buttons
      const buttonContainer = document.createElement('div')
      buttonContainer.style.position = 'absolute'
      buttonContainer.style.top = '0'
      buttonContainer.style.right = '0'
      buttonContainer.style.zIndex = '10'
      buttonContainer.style.display = 'flex'
      buttonContainer.style.gap = '0.5rem'
      buttonContainer.style.padding = '0.5rem'
      preElement.appendChild(buttonContainer)

      foundBlocks.push({
        code: codeContent,
        container: buttonContainer,
        preElement: preElement,
        language: language || undefined,
        title: title || undefined,
        caption: caption || undefined,
      })
    })

    setCodeBlocks(foundBlocks)

    // Cleanup
    return () => {
      foundBlocks.forEach(({ container }) => {
        container.remove()
      })
    }
  }, [])

  return (
    <>
      {codeBlocks.map((block, index) => 
        createPortal(
          <>
            <CodeExpandButton 
              code={block.code}
              preElement={block.preElement}
              language={block.language}
              title={block.title}
              caption={block.caption}
            />
            <CodeCopyButton code={block.code} />
          </>,
          block.container,
          `code-buttons-${index}`
        )
      )}
    </>
  )
}
