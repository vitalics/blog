'use client'

import { useState } from 'react'
import { CheckIcon, CopyIcon } from '@radix-ui/react-icons'

export function CodeCopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy code:', err)
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="absolute right-2 top-2 rounded-md border bg-background/80 p-2 backdrop-blur transition-all hover:bg-background hover:shadow-md"
      aria-label="Copy code to clipboard"
      title={copied ? 'Copied!' : 'Copy code'}
    >
      {copied ? (
        <CheckIcon className="h-4 w-4 text-green-600 dark:text-green-400" />
      ) : (
        <CopyIcon className="h-4 w-4 text-muted-foreground" />
      )}
    </button>
  )
}
