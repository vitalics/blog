'use client'

import dynamic from 'next/dynamic'

const QrCodeClient = dynamic(() => import('./qr-code-client'), { ssr: false })

export default function QrCodeWrapper() {
  return <QrCodeClient />
}
