'use client'

import dynamic from 'next/dynamic'

const PdfViewerClient = dynamic(() => import('@/components/pdf-viewer/pdf-viewer-client'), { ssr: false })

export default function PdfViewerWrapper() {
  return <PdfViewerClient />
}
