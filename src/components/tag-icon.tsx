import Image from 'next/image'
import { Hash } from 'lucide-react'
import { getKnownTag } from '@/config/known-tags'

interface TagIconProps {
  tag: string
  size?: number
  className?: string
}

export function TagIcon({ tag, size = 24, className = '' }: TagIconProps) {
  const knownTag = getKnownTag(tag)

  if (knownTag) {
    return (
      <div className={`relative shrink-0 ${className}`} style={{ width: size, height: size }}>
        <Image
          src={knownTag.image}
          alt={knownTag.name}
          width={size}
          height={size}
          className="rounded"
        />
      </div>
    )
  }

  // Fallback to hash icon for unknown tags
  return (
    <div 
      className={`flex shrink-0 items-center justify-center rounded bg-muted ${className}`}
      style={{ width: size, height: size }}
    >
      <Hash className="h-3/5 w-3/5 text-muted-foreground" />
    </div>
  )
}
