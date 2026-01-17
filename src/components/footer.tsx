'use client'

import Link from 'next/link'
import { SOCIAL_LINKS } from '@/config/site'
import { Github, Mail, Rss } from 'lucide-react'

export function Footer() {
  return (
    <footer className="border-t bg-background">
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <p className="text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} All rights reserved.
          </p>
          
          <div className="flex items-center gap-4">
            <Link
              href={SOCIAL_LINKS.github}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground transition-colors hover:text-foreground"
              aria-label="GitHub"
            >
              <Github className="h-5 w-5" />
            </Link>
            <a
              href={`mailto:${SOCIAL_LINKS.email}`}
              className="text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Email"
            >
              <Mail className="h-5 w-5" />
            </a>
            <Link
              href={SOCIAL_LINKS.rss}
              className="text-muted-foreground transition-colors hover:text-foreground"
              aria-label="RSS Feed"
            >
              <Rss className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
