'use client'

import { useState, useEffect } from 'react'
import { Maximize2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface CodeExpandButtonProps {
  code: string
  preElement: HTMLElement
  language?: string
  title?: string
  caption?: string
}

export function CodeExpandButton({ code, preElement, language, title, caption }: CodeExpandButtonProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [codeHtml, setCodeHtml] = useState<string>('')

  useEffect(() => {
    if (isExpanded && preElement) {
      // Clone the pre element deeply to preserve all syntax highlighting
      const clonedPre = preElement.cloneNode(true) as HTMLElement
      
      // Find and remove the button container
      const buttonContainers = clonedPre.querySelectorAll('div')
      buttonContainers.forEach((div) => {
        const style = div.getAttribute('style')
        if (style && (style.includes('position: absolute') || style.includes('position:absolute'))) {
          div.remove()
        }
      })
      
      // Remove title and caption data attributes to prevent pseudo-elements
      clonedPre.removeAttribute('data-title')
      clonedPre.removeAttribute('data-caption')
      
      // Reset any inline styles that might interfere
      clonedPre.style.position = 'static'
      clonedPre.style.margin = '0'
      
      // Get the HTML content
      setCodeHtml(clonedPre.outerHTML)
    }
  }, [isExpanded, preElement])

  return (
    <>
      <button
        onClick={() => setIsExpanded(true)}
        className="rounded-md border bg-background/80 p-2 backdrop-blur transition-all hover:bg-background hover:shadow-md"
        aria-label="Expand code block"
        title="Expand code block"
      >
        <Maximize2 className="h-4 w-4 text-muted-foreground" />
      </button>

      <Dialog open={isExpanded} onOpenChange={setIsExpanded}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              {title || `Code ${language ? `(${language})` : ''}`}
            </DialogTitle>
          </DialogHeader>
          <div 
            className="prose prose-sm dark:prose-invert max-w-none flex-1 overflow-auto rounded-lg border [&>pre]:m-0 [&>pre]:rounded-none [&>pre]:border-0"
            dangerouslySetInnerHTML={{ __html: codeHtml }}
          />
          {caption && (
            <div className="text-xs text-muted-foreground border-t pt-2">
              {caption}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
