'use client'

export function MDXWrapper({ children }: { children: React.ReactNode }) {
  // This wrapper is kept for potential future enhancements
  // Currently, code themes switch via page reload (see code-theme-selector.tsx)
  return <>{children}</>
}
