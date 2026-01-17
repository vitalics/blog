'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { CodeCopyButton } from './code-copy-button'

interface CodeBlock {
  code: string
  container: HTMLElement
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

      if (!codeContent) return

      // Make pre element relative positioned
      preElement.style.position = 'relative'

      // Create a container for the button
      const buttonContainer = document.createElement('div')
      buttonContainer.style.position = 'absolute'
      buttonContainer.style.top = '0'
      buttonContainer.style.right = '0'
      buttonContainer.style.zIndex = '10'
      preElement.appendChild(buttonContainer)

      foundBlocks.push({
        code: codeContent,
        container: buttonContainer,
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
          <CodeCopyButton code={block.code} />,
          block.container,
          `code-copy-${index}`
        )
      )}
    </>
  )
}
