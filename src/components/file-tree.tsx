'use client'

import { File as FileIcon, Folder as FolderIcon, FolderOpen, ChevronRight, ChevronDown } from 'lucide-react'
import { createContext, useContext, ReactNode, useState } from 'react'
import Image from 'next/image'

interface FileTreeContextValue {
  level: number
}

const FileTreeContext = createContext<FileTreeContextValue>({ level: 0 })

interface FileTreeProps {
  children: ReactNode
  title?: string
}

export function FileTree({ children, title }: FileTreeProps) {
  return (
    <div className="not-prose my-6 overflow-hidden rounded-lg border bg-card">
      {title && (
        <div className="border-b bg-muted/50 px-4 py-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <FolderOpen className="h-4 w-4" />
            {title}
          </div>
        </div>
      )}
      <div className="overflow-x-auto p-4 font-mono text-sm">
        <FileTreeContext.Provider value={{ level: 0 }}>
          {children}
        </FileTreeContext.Provider>
      </div>
    </div>
  )
}

interface FolderProps {
  name: string
  children?: ReactNode
  defaultOpen?: boolean
}

function Folder({ name, children, defaultOpen = true }: FolderProps) {
  const { level } = useContext(FileTreeContext)
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <>
      <div
        className="flex items-start gap-1 py-0.5 cursor-pointer hover:bg-muted/50 rounded-sm transition-colors"
        style={{ marginLeft: `${level * 24}px` }}
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        {isOpen ? (
          <FolderOpen className="h-4 w-4 shrink-0 text-amber-500 dark:text-amber-400" />
        ) : (
          <FolderIcon className="h-4 w-4 shrink-0 text-amber-500 dark:text-amber-400" />
        )}
        <span className="select-none">{name}</span>
      </div>
      {isOpen && children && (
        <FileTreeContext.Provider value={{ level: level + 1 }}>
          {children}
        </FileTreeContext.Provider>
      )}
    </>
  )
}

interface FileProps {
  name: string
  comment?: string
}

function FileComponent({ name, comment }: FileProps) {
  const { level } = useContext(FileTreeContext)

  // Get file extension and match with known tags
  const extension = name.split('.').pop()?.toLowerCase()

  const getFileIcon = () => {
    switch (extension) {
      case 'ts':
      case 'tsx':
        return (
          <Image
            src="/tags/typescript.svg"
            alt="TypeScript"
            width={16}
            height={16}
            className="h-4 w-4 shrink-0"
          />
        )
      case 'js':
      case 'jsx':
        return (
          <Image
            src="/tags/javascript.svg"
            alt="JavaScript"
            width={16}
            height={16}
            className="h-4 w-4 shrink-0"
          />
        )
      case 'json':
        return (
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"
              fill="#10B981"
              opacity="0.2"
            />
            <path
              d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"
              stroke="#10B981"
              strokeWidth="2"
            />
            <text
              x="12"
              y="16"
              fontSize="10"
              fontWeight="bold"
              fill="#10B981"
              textAnchor="middle"
            >
              JSON
            </text>
          </svg>
        )
      case 'yml':
      case 'yaml':
        return (
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"
              fill="#EF4444"
              opacity="0.2"
            />
            <path
              d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"
              stroke="#EF4444"
              strokeWidth="2"
            />
            <text
              x="12"
              y="16"
              fontSize="9"
              fontWeight="bold"
              fill="#EF4444"
              textAnchor="middle"
            >
              YAML
            </text>
          </svg>
        )
      case 'md':
      case 'mdx':
        return (
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"
              fill="#F97316"
              opacity="0.2"
            />
            <path
              d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"
              stroke="#F97316"
              strokeWidth="2"
            />
            <text
              x="12"
              y="16"
              fontSize="10"
              fontWeight="bold"
              fill="#F97316"
              textAnchor="middle"
            >
              MD
            </text>
          </svg>
        )
      case 'css':
      case 'scss':
        return (
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"
              fill="#EC4899"
              opacity="0.2"
            />
            <path
              d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"
              stroke="#EC4899"
              strokeWidth="2"
            />
            <text
              x="12"
              y="16"
              fontSize="10"
              fontWeight="bold"
              fill="#EC4899"
              textAnchor="middle"
            >
              CSS
            </text>
          </svg>
        )
      case 'html':
        return (
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"
              fill="#F97316"
              opacity="0.2"
            />
            <path
              d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"
              stroke="#F97316"
              strokeWidth="2"
            />
            <text
              x="12"
              y="16"
              fontSize="9"
              fontWeight="bold"
              fill="#F97316"
              textAnchor="middle"
            >
              HTML
            </text>
          </svg>
        )
      case 'xml':
        return (
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"
              fill="#8B5CF6"
              opacity="0.2"
            />
            <path
              d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"
              stroke="#8B5CF6"
              strokeWidth="2"
            />
            <text
              x="12"
              y="16"
              fontSize="10"
              fontWeight="bold"
              fill="#8B5CF6"
              textAnchor="middle"
            >
              XML
            </text>
          </svg>
        )
      case 'py':
        return (
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"
              fill="#3B82F6"
              opacity="0.2"
            />
            <path
              d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"
              stroke="#3B82F6"
              strokeWidth="2"
            />
            <text
              x="12"
              y="16"
              fontSize="11"
              fontWeight="bold"
              fill="#3B82F6"
              textAnchor="middle"
            >
              PY
            </text>
          </svg>
        )
      case 'go':
        return (
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"
              fill="#06B6D4"
              opacity="0.2"
            />
            <path
              d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"
              stroke="#06B6D4"
              strokeWidth="2"
            />
            <text
              x="12"
              y="16"
              fontSize="11"
              fontWeight="bold"
              fill="#06B6D4"
              textAnchor="middle"
            >
              GO
            </text>
          </svg>
        )
      case 'rs':
        return (
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"
              fill="#F97316"
              opacity="0.2"
            />
            <path
              d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"
              stroke="#F97316"
              strokeWidth="2"
            />
            <text
              x="12"
              y="16"
              fontSize="11"
              fontWeight="bold"
              fill="#F97316"
              textAnchor="middle"
            >
              RS
            </text>
          </svg>
        )
      default:
        return <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
    }
  }

  return (
    <div
      className="flex items-start gap-2 py-0.5"
      style={{ marginLeft: `${level * 24}px` }}
    >
      {getFileIcon()}
      <span className="flex flex-wrap items-baseline gap-2">
        <span className="font-semibold">{name}</span>
        {comment && (
          <span className="text-sm text-muted-foreground">- {comment}</span>
        )}
      </span>
    </div>
  )
}

// Attach sub-components to FileTree
FileTree.Folder = Folder
FileTree.File = FileComponent

// Export sub-components individually for MDX
export const FileTreeFolder = Folder
export const FileTreeFile = FileComponent

// Export default for MDX compatibility
export default FileTree
