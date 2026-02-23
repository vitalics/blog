'use client'

import dynamic from 'next/dynamic'

const BarcodeExtractorClient = dynamic(() => import('./barcode-extractor-client'), { ssr: false })

export default function BarcodeExtractorWrapper() {
  return <BarcodeExtractorClient />
}
