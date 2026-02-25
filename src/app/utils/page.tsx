import Link from 'next/link'
import { ImageIcon, Archive, FileText, QrCode, ScanLine, Barcode } from 'lucide-react'

export const metadata = {
  title: 'Utils',
  description: 'A collection of browser-based utility tools',
}

const TOOLS = [
  {
    href: '/utils/image-converter',
    icon: ImageIcon,
    name: 'Image Converter',
    description: 'Convert images between formats (PNG → WebP and more) entirely in your browser. No uploads, no server.',
    tags: ['images', 'webp', 'png'],
  },
  {
    href: '/utils/zip-builder',
    icon: Archive,
    name: 'Archive Builder',
    description: 'Pack files into ZIP, TAR.GZ, or GZip archives in your browser. Includes the extract command for your OS.',
    tags: ['zip', 'tar', 'gzip', 'archive', 'files'],
  },
  {
    href: '/utils/pdf-viewer',
    icon: FileText,
    name: 'PDF Viewer',
    description: 'View PDF files in your browser. Zoom, paginate, and share — nothing is uploaded.',
    tags: ['pdf', 'viewer', 'documents'],
  },
  {
    href: '/utils/qr-code',
    icon: QrCode,
    name: 'QR Code Generator',
    description: 'Generate QR codes from any text or URL with custom colors and error correction levels.',
    tags: ['qr', 'qrcode', 'generator'],
  },
  {
    href: '/utils/qr-extractor',
    icon: ScanLine,
    name: 'QR Code Extractor',
    description: 'Decode QR codes from images or your camera. Uses the native browser BarcodeDetector API.',
    tags: ['qr', 'scanner', 'decoder', 'camera'],
  },
  {
    href: '/utils/barcode-extractor',
    icon: Barcode,
    name: 'Barcode Extractor',
    description: 'Decode barcodes (EAN-13, Code 128, UPC, PDF417, and more) from images or your camera.',
    tags: ['barcode', 'ean', 'upc', 'scanner', 'decoder'],
  },
]

export default function UtilsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="mb-2 text-4xl font-bold">Utils</h1>
      <p className="mb-8 text-muted-foreground">
        Browser-based tools. Everything runs client-side — nothing is uploaded or sent to any server.
      </p>
      <div className="grid gap-6 md:grid-cols-2">
        {TOOLS.map((tool) => {
          const Icon = tool.icon
          return (
            <Link
              key={tool.href}
              href={tool.href}
              className="group rounded-lg border p-6 hover:border-primary transition-colors"
            >
              <div className="mb-3 flex items-center gap-3">
                <Icon className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
                <h2 className="text-xl font-semibold group-hover:underline">{tool.name}</h2>
              </div>
              <p className="mb-4 text-muted-foreground">{tool.description}</p>
              <div className="flex flex-wrap gap-2">
                {tool.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-secondary px-2 py-1 text-xs">
                    {tag}
                  </span>
                ))}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
