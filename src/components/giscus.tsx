'use client'

import { useTheme } from '@/components/theme-provider'
import { getGiscusTheme } from '@/config/giscus-themes'
import { useEffect, useRef } from 'react'

interface GiscusProps {
  repo: string
  repoId: string
  category: string
  categoryId: string
  mapping?: 'pathname' | 'url' | 'title' | 'og:title' | 'specific' | 'number'
  strict?: '0' | '1'
  reactionsEnabled?: '0' | '1'
  emitMetadata?: '0' | '1'
  inputPosition?: 'top' | 'bottom'
  lang?: string
}

export function Giscus({
  repo,
  repoId,
  category,
  categoryId,
  mapping = 'pathname',
  strict = '0',
  reactionsEnabled = '1',
  emitMetadata = '0',
  inputPosition = 'bottom',
  lang = 'en',
}: GiscusProps) {
  const { resolvedTheme, themeName } = useTheme()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return

    // Remove any existing giscus iframe to force reload
    const existingIframe = ref.current.querySelector('iframe.giscus-frame')
    if (existingIframe) {
      existingIframe.remove()
    }

    // Get the appropriate Giscus theme based on blog theme
    const giscusTheme = getGiscusTheme(themeName, resolvedTheme)

    const script = document.createElement('script')
    script.src = 'https://giscus.app/client.js'
    script.setAttribute('data-repo', repo)
    script.setAttribute('data-repo-id', repoId)
    script.setAttribute('data-category', category)
    script.setAttribute('data-category-id', categoryId)
    script.setAttribute('data-mapping', mapping)
    script.setAttribute('data-strict', strict)
    script.setAttribute('data-reactions-enabled', reactionsEnabled)
    script.setAttribute('data-emit-metadata', emitMetadata)
    script.setAttribute('data-input-position', inputPosition)
    script.setAttribute('data-theme', giscusTheme)
    script.setAttribute('data-lang', lang)
    script.setAttribute('crossorigin', 'anonymous')
    script.async = true

    ref.current.appendChild(script)

    return () => {
      if (ref.current) {
        ref.current.innerHTML = ''
      }
    }
  }, [repo, repoId, category, categoryId, mapping, strict, reactionsEnabled, emitMetadata, inputPosition, lang, resolvedTheme, themeName])

  return <div ref={ref} className="giscus" />
}
