import type { MetadataRoute } from 'next'
import { SITE } from '@/config/site'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/_next/'],
      },
    ],
    sitemap: `${SITE.URL}/sitemap.xml`,
    host: SITE.URL,
  }
}
