'use client'

import dynamic from 'next/dynamic'

const QrExtractorClient = dynamic(() => import('./qr-extractor-client'), { ssr: false })

export default function QrExtractorWrapper() {
  return <QrExtractorClient />
}
