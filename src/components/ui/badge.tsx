import { cn } from '@/lib/utils'
import { type VariantProps, cva } from 'class-variance-authority'
import { Hash } from 'lucide-react'
import * as React from 'react'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs transition-colors focus:outline-none focus:ring focus:ring-ring',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        blue: 'bg-blue-700 text-blue-200',
        red: 'bg-red-700 text-red-200',
        green:
          'dark:bg-green-700 bg-green-200 dark:text-green-100 text-green-800',
        indigo:
          'dark:bg-indigo-700 dark:text-indigo-200 bg-indigo-200 text-indigo-700',
        yellow: 'bg-yellow-700 text-yellow-200',
        purple: 'bg-purple-700 text-purple-200',
        pink: 'bg-pink-700 text-pink-200',
        'gradient-indigo':
          'bg-gradient-to-r dark:from-blue-600 from-blue-500 dark:to-purple-600 to-purple-500 text-white ',
        'gradient-pink':
          'bg-gradient-to-r dark:from-fuchsia-600 from-fuchsia-500 to-pink-500 dark:to-pink-600 text-white',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80',
        outline: 'text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  showHash?: boolean
}

function Badge({ className, variant, showHash = true, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props}>
      {showHash && <Hash className="size-3 -translate-x-0.5" />}
      {props.children}
    </div>
  )
}

export { Badge, badgeVariants }
