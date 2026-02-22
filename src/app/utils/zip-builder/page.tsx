'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Archive, Upload, Download, X, Copy, Check, FolderOpen, List, GitBranch, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { FileTreeFolder, FileTreeFile } from '@/components/file-tree'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FileEntry {
  id: string
  file: File
  /** Relative path inside the archive, e.g. "src/utils/foo.ts" */
  path: string
}

type OS = 'windows-ps' | 'windows-cmd' | 'mac' | 'linux'
type ArchiveFormat = 'zip' | 'tar.gz' | 'gz'

// ---------------------------------------------------------------------------
// Format definitions
// ---------------------------------------------------------------------------

interface FormatDef {
  value: ArchiveFormat
  label: string
  ext: string
  mime: string
  multiFile: boolean
  description: string
}

const FORMATS: FormatDef[] = [
  {
    value: 'zip',
    label: 'ZIP',
    ext: '.zip',
    mime: 'application/zip',
    multiFile: true,
    description: 'Universal archive, supported everywhere',
  },
  {
    value: 'tar.gz',
    label: 'TAR.GZ',
    ext: '.tar.gz',
    mime: 'application/gzip',
    multiFile: true,
    description: 'Common on Linux/macOS, preserves permissions',
  },
  {
    value: 'gz',
    label: 'GZip',
    ext: '.gz',
    mime: 'application/gzip',
    multiFile: false,
    description: 'Single-file compression only',
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function detectOS(): OS {
  const ua = navigator.userAgent
  if (/Win/i.test(ua)) return 'windows-ps'
  if (/Mac/i.test(ua)) return 'mac'
  return 'linux'
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function extractCommand(archiveName: string, os: OS, format: ArchiveFormat): string {
  const isTar = format === 'tar.gz'
  const isGz = format === 'gz'

  switch (os) {
    case 'windows-ps':
      if (isTar) return `tar -xzf "${archiveName}"`
      if (isGz) return `(New-Object System.IO.Compression.GzipStream([IO.File]::OpenRead("${archiveName}"), [IO.Compression.CompressionMode]::Decompress)).CopyTo([IO.File]::Create("${archiveName.replace(/\.gz$/, '')}"))`
      return `Expand-Archive -Path "${archiveName}" -DestinationPath .`
    case 'windows-cmd':
      if (isTar) return `tar -xzf "${archiveName}"`
      if (isGz) return `tar -xzf "${archiveName}"`
      return `tar -xf "${archiveName}"`
    case 'mac':
      if (isGz) return `gunzip "${archiveName}"`
      return `tar -xzf "${archiveName}"`
    case 'linux':
      if (isGz) return `gunzip "${archiveName}"`
      return `tar -xzf "${archiveName}"`
  }
}

const OS_TABS: { value: OS; label: string }[] = [
  { value: 'windows-ps',  label: 'PowerShell' },
  { value: 'windows-cmd', label: 'CMD' },
  { value: 'mac',         label: 'macOS' },
  { value: 'linux',       label: 'Linux' },
]

// ---------------------------------------------------------------------------
// Directory traversal via File and Directory Entries API
// ---------------------------------------------------------------------------

/** Recursively collect all files from a FileSystemDirectoryEntry. */
function readDirectoryEntry(
  entry: FileSystemDirectoryEntry,
  prefix = '',
): Promise<{ file: File; path: string }[]> {
  return new Promise((resolve) => {
    const reader = entry.createReader()
    const results: { file: File; path: string }[] = []
    const dirPath = prefix ? `${prefix}/${entry.name}` : entry.name

    // readEntries may return results in batches — call until empty
    const readBatch = () => {
      reader.readEntries(async (entries) => {
        if (entries.length === 0) {
          resolve(results)
          return
        }
        for (const e of entries) {
          if (e.isFile) {
            const file = await new Promise<File>((res) => (e as FileSystemFileEntry).file(res))
            results.push({ file, path: `${dirPath}/${e.name}` })
          } else if (e.isDirectory) {
            const nested = await readDirectoryEntry(e as FileSystemDirectoryEntry, dirPath)
            results.push(...nested)
          }
        }
        readBatch()
      })
    }
    readBatch()
  })
}

/** Extract flat file+path pairs from a DataTransfer drop event. */
async function extractDroppedEntries(
  dataTransfer: DataTransfer,
): Promise<{ file: File; path: string }[]> {
  const results: { file: File; path: string }[] = []

  const items = Array.from(dataTransfer.items)
  for (const item of items) {
    const entry = item.webkitGetAsEntry?.()
    if (!entry) {
      // Fallback: no entry API — treat as flat file
      const file = item.getAsFile()
      if (file) results.push({ file, path: file.name })
      continue
    }
    if (entry.isFile) {
      const file = await new Promise<File>((res) => (entry as FileSystemFileEntry).file(res))
      results.push({ file, path: file.name })
    } else if (entry.isDirectory) {
      const nested = await readDirectoryEntry(entry as FileSystemDirectoryEntry)
      results.push(...nested)
    }
  }
  return results
}

// ---------------------------------------------------------------------------
// fflate — lazy import (code-split, loaded only when building)
// ---------------------------------------------------------------------------

let fflateCache: typeof import('fflate') | null = null

async function loadFflate(): Promise<typeof import('fflate')> {
  if (!fflateCache) fflateCache = await import('fflate')
  return fflateCache
}

// ---------------------------------------------------------------------------
// TAR builder (POSIX ustar, no external dep)
// ---------------------------------------------------------------------------

function buildTar(entries: { name: string; data: Uint8Array }[]): Uint8Array {
  const blocks: Uint8Array[] = []

  for (const { name, data } of entries) {
    const header = new Uint8Array(512)
    const enc = new TextEncoder()

    // name (100 bytes)
    header.set(enc.encode(name.slice(0, 100)), 0)
    // mode (8 bytes) — 0644
    header.set(enc.encode('0000644\0'), 100)
    // uid, gid (8 bytes each) — 0
    header.set(enc.encode('0000000\0'), 108)
    header.set(enc.encode('0000000\0'), 116)
    // size (12 bytes, octal)
    header.set(enc.encode(data.byteLength.toString(8).padStart(11, '0') + '\0'), 124)
    // mtime (12 bytes, octal) — seconds since epoch
    const mtime = Math.floor(Date.now() / 1000)
    header.set(enc.encode(mtime.toString(8).padStart(11, '0') + '\0'), 136)
    // checksum placeholder (8 spaces)
    header.set(enc.encode('        '), 148)
    // type flag: '0' = regular file
    header[156] = 0x30
    // magic "ustar  \0"
    header.set(enc.encode('ustar  \0'), 257)

    // compute checksum
    let checksum = 0
    for (const byte of header) checksum += byte
    header.set(enc.encode(checksum.toString(8).padStart(6, '0') + '\0 '), 148)

    blocks.push(header)

    // file data padded to 512-byte boundary
    const padded = Math.ceil(data.byteLength / 512) * 512
    const dataBlock = new Uint8Array(padded)
    dataBlock.set(data)
    blocks.push(dataBlock)
  }

  // two 512-byte zero blocks = end-of-archive
  blocks.push(new Uint8Array(1024))

  const total = blocks.reduce((n, b) => n + b.byteLength, 0)
  const tar = new Uint8Array(total)
  let offset = 0
  for (const b of blocks) {
    tar.set(b, offset)
    offset += b.byteLength
  }
  return tar
}

// ---------------------------------------------------------------------------
// Tree builder — converts flat paths into a nested structure for FileTree
// ---------------------------------------------------------------------------

interface TreeDir {
  type: 'dir'
  name: string
  children: TreeNode[]
}
interface TreeFile {
  type: 'file'
  name: string
}
type TreeNode = TreeDir | TreeFile

function buildTree(entries: FileEntry[]): TreeNode[] {
  const root: TreeDir = { type: 'dir', name: '', children: [] }

  for (const entry of entries) {
    const parts = entry.path.split('/')
    let current = root
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]
      let dir = current.children.find((n): n is TreeDir => n.type === 'dir' && n.name === part)
      if (!dir) {
        dir = { type: 'dir', name: part, children: [] }
        current.children.push(dir)
      }
      current = dir
    }
    current.children.push({ type: 'file', name: parts[parts.length - 1] })
  }

  return root.children
}

function RenderTree({ nodes }: { nodes: TreeNode[] }) {
  return (
    <>
      {nodes.map((node, i) => {
        const key = `${node.type}-${node.name}-${i}`
        if (node.type === 'dir') {
          return (
            <FileTreeFolder key={key} name={node.name} defaultOpen>
              <RenderTree nodes={node.children} />
            </FileTreeFolder>
          )
        }
        return <FileTreeFile key={key} name={node.name} />
      })}
    </>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ArchiveBuilderPage() {
  const router = useRouter()

  const [files, setFiles] = useState<FileEntry[]>([])
  const [format, setFormat] = useState<ArchiveFormat>('zip')
  const [archiveName, setArchiveName] = useState('archive.zip')
  const [isDragOver, setIsDragOver] = useState(false)
  const [status, setStatus] = useState<'idle' | 'building' | 'done' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [resultSize, setResultSize] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)
  const [os, setOs] = useState<OS>('linux')
  const [listMode, setListMode] = useState<'flat' | 'tree'>('flat')
  const inputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const resultUrlRef = useRef<string | null>(null)

  useEffect(() => {
    setOs(detectOS())
  }, [])

  // Revoke object URL on unmount
  // biome-ignore lint/correctness/useExhaustiveDependencies: ref used for cleanup only
  useEffect(() => {
    return () => {
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current)
    }
  }, [])

  // When format changes, update archive name extension and reset result
  const handleFormatChange = (f: ArchiveFormat) => {
    setFormat(f)
    setStatus('idle')
    setErrorMsg(null)
    if (resultUrlRef.current) {
      URL.revokeObjectURL(resultUrlRef.current)
      resultUrlRef.current = null
    }
    setResultUrl(null)
    setResultSize(null)
    const def = FORMATS.find((d) => d.value === f)!
    setArchiveName((prev) => {
      const base = prev.replace(/\.(zip|tar\.gz|gz)$/, '')
      return base + def.ext
    })
  }

  const addFiles = useCallback((incoming: { file: File; path: string }[]) => {
    setStatus('idle')
    setErrorMsg(null)
    if (resultUrlRef.current) {
      URL.revokeObjectURL(resultUrlRef.current)
      resultUrlRef.current = null
    }
    setResultUrl(null)
    setResultSize(null)
    setFiles((prev) => {
      const existingPaths = new Set(prev.map((e) => e.path))
      const fresh = incoming
        .filter(({ path }) => !existingPaths.has(path))
        .map(({ file, path }) => ({ id: `${path}-${file.size}-${file.lastModified}`, file, path }))
      return [...prev, ...fresh]
    })
  }, [])

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((e) => e.id !== id))
    setStatus('idle')
    setErrorMsg(null)
  }

  const handleDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragOver(false)
      const entries = await extractDroppedEntries(e.dataTransfer)
      if (entries.length) addFiles(entries)
    },
    [addFiles],
  )

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? [])
    const entries = selected.map((f) => ({
      file: f,
      path: f.webkitRelativePath || f.name,
    }))
    if (entries.length) addFiles(entries)
    e.target.value = ''
  }

  const handleFolderInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? [])
    const entries = selected.map((f) => ({
      file: f,
      // webkitRelativePath is always set for directory picks, e.g. "src/utils/foo.ts"
      path: f.webkitRelativePath || f.name,
    }))
    if (entries.length) addFiles(entries)
    e.target.value = ''
  }

  const handleBuild = async () => {
    if (!files.length) return
    const def = FORMATS.find((d) => d.value === format)!

    if (!def.multiFile && files.length > 1) {
      setErrorMsg(`${def.label} supports a single file only. Remove extra files or switch to ZIP / TAR.GZ.`)
      setStatus('error')
      return
    }

    setStatus('building')
    setErrorMsg(null)
    if (resultUrlRef.current) {
      URL.revokeObjectURL(resultUrlRef.current)
      resultUrlRef.current = null
    }
    setResultUrl(null)
    setResultSize(null)

    try {
      const fflate = await loadFflate()
      let output: Uint8Array

      if (format === 'zip') {
        const entries: Record<string, Uint8Array> = {}
        for (const entry of files) {
          const buf = await entry.file.arrayBuffer()
          entries[entry.path] = new Uint8Array(buf)
        }
        output = fflate.zipSync(entries)
      } else if (format === 'tar.gz') {
        const tarEntries: { name: string; data: Uint8Array }[] = []
        for (const entry of files) {
          const buf = await entry.file.arrayBuffer()
          tarEntries.push({ name: entry.path, data: new Uint8Array(buf) })
        }
        const tar = buildTar(tarEntries)
        output = fflate.gzipSync(tar)
      } else {
        // gz — single file
        const buf = await files[0].file.arrayBuffer()
        output = fflate.gzipSync(new Uint8Array(buf), { filename: files[0].file.name })
      }

      const blob = new Blob([new Uint8Array(output).buffer as ArrayBuffer], { type: def.mime })
      const url = URL.createObjectURL(blob)
      resultUrlRef.current = url
      setResultUrl(url)
      setResultSize(blob.size)
      setStatus('done')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err))
      setStatus('error')
    }
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(extractCommand(archiveName, os, format))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const totalSize = files.reduce((sum, e) => sum + e.file.size, 0)
  const command = extractCommand(archiveName, os, format)
  const compressionRatio = resultSize !== null && totalSize > 0
    ? Math.round(((totalSize - resultSize) / totalSize) * 100)
    : null
  const currentFormat = FORMATS.find((d) => d.value === format)!

  return (
    <TooltipProvider>
      <div className="mx-auto max-w-3xl px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <div className="mb-2 flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label="Go back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Archive className="h-7 w-7 text-muted-foreground" aria-hidden="true" />
            <h1 className="text-4xl font-bold">Archive Builder</h1>
          </div>
          <p className="text-muted-foreground">
            Pack files into a compressed archive entirely in your browser. Nothing is uploaded.
          </p>
        </div>

        <div className="space-y-6">
          {/* Format picker */}
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Format</p>
            <div className="grid grid-cols-3 gap-2">
              {FORMATS.map((f) => {
                const isDisabled = !f.multiFile && files.length > 1
                return (
                  <button
                    key={f.value}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => handleFormatChange(f.value)}
                    aria-disabled={isDisabled}
                    className={[
                      'rounded-lg border p-3 text-left transition-colors',
                      format === f.value
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50 hover:bg-accent/30',
                      isDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
                    ].join(' ')}
                  >
                    <p className="text-sm font-semibold">{f.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{f.description}</p>
                    {!f.multiFile && <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Single file only</p>}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Drop zone */}
          {/* biome-ignore lint/a11y/useSemanticElements: drop zone needs div for drag events */}
          <div
            role="button"
            tabIndex={0}
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
            onDragLeave={() => setIsDragOver(false)}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click() } }}
            aria-label="Add files: drag and drop or press Enter to browse"
            className={[
              'flex min-h-36 cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 text-center transition-colors',
              isDragOver
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50 hover:bg-accent/30',
            ].join(' ')}
          >
            <Upload className="h-7 w-7 text-muted-foreground" aria-hidden="true" />
            <div>
              <p className="font-medium">Drop files or folders here</p>
              <p className="text-sm text-muted-foreground">
                or use the buttons below{!currentFormat.multiFile ? ' — single file only' : ''}
              </p>
            </div>
            <div className="flex gap-2" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-sm hover:bg-accent transition-colors"
              >
                <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                Files
              </button>
              {currentFormat.multiFile && (
                <button
                  type="button"
                  onClick={() => folderInputRef.current?.click()}
                  className="flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-sm hover:bg-accent transition-colors"
                >
                  <FolderOpen className="h-3.5 w-3.5" aria-hidden="true" />
                  Folder
                </button>
              )}
            </div>
          </div>
          <input
            ref={inputRef}
            type="file"
            multiple={currentFormat.multiFile}
            className="hidden"
            aria-hidden="true"
            tabIndex={-1}
            onChange={handleFileInput}
          />
          <input
            ref={folderInputRef}
            type="file"
            // @ts-expect-error — webkitdirectory is non-standard but widely supported
            webkitdirectory=""
            multiple
            className="hidden"
            aria-hidden="true"
            tabIndex={-1}
            onChange={handleFolderInput}
          />

          {/* File list */}
          {files.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{files.length} file{files.length !== 1 ? 's' : ''} &middot; {formatBytes(totalSize)} total</p>
                <div className="flex items-center gap-3">
                  {/* Flat / Tree toggle */}
                  <div className="flex rounded-md border text-xs overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setListMode('flat')}
                      aria-pressed={listMode === 'flat'}
                      className={[
                        'flex items-center gap-1 px-2.5 py-1 transition-colors',
                        listMode === 'flat'
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground hover:bg-accent',
                      ].join(' ')}
                    >
                      <List className="h-3 w-3" aria-hidden="true" />
                      Flat
                    </button>
                    <button
                      type="button"
                      onClick={() => setListMode('tree')}
                      aria-pressed={listMode === 'tree'}
                      className={[
                        'flex items-center gap-1 px-2.5 py-1 transition-colors',
                        listMode === 'tree'
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground hover:bg-accent',
                      ].join(' ')}
                    >
                      <GitBranch className="h-3 w-3" aria-hidden="true" />
                      Tree
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setFiles([]); setStatus('idle'); setErrorMsg(null) }}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Clear all
                  </button>
                </div>
              </div>

              {listMode === 'flat' ? (
                <ul className="w-full divide-y rounded-lg border" aria-label="Files to archive">
                  {files.map((entry) => (
                    <li key={entry.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                      <span className="flex-1 min-w-0 truncate font-mono text-xs" title={entry.path}>{entry.path}</span>
                      <span className="shrink-0 text-muted-foreground">{formatBytes(entry.file.size)}</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => removeFile(entry.id)}
                            className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive transition-colors"
                            aria-label={`Remove ${entry.file.name}`}
                          >
                            <X className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>Remove</TooltipContent>
                      </Tooltip>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="overflow-x-auto rounded-lg border bg-card p-3 font-mono text-sm">
                  <RenderTree nodes={buildTree(files)} />
                </div>
              )}
            </div>
          )}

          {/* Archive name */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="archive-name">Archive name</label>
            <Input
              id="archive-name"
              value={archiveName}
              onChange={(e) => setArchiveName(e.target.value || `archive${currentFormat.ext}`)}
              placeholder={`archive${currentFormat.ext}`}
            />
          </div>

          {/* Build button */}
          <Button
            type="button"
            onClick={handleBuild}
            disabled={files.length === 0 || status === 'building'}
            className="w-full gap-2"
          >
            {status === 'building'
              ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" /><span>Building…</span></>
              : <><Archive className="h-4 w-4" aria-hidden="true" /><span>Build {currentFormat.label}</span></>}
          </Button>

          {status === 'error' && errorMsg && (
            <p role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {errorMsg}
            </p>
          )}

          {/* Result */}
          {status === 'done' && resultUrl && resultSize !== null && (
            <div className="space-y-4 rounded-lg border p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{archiveName}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatBytes(totalSize)} → {formatBytes(resultSize)}
                    {compressionRatio !== null && compressionRatio > 0 && (
                      <span className="ml-1 text-green-600 dark:text-green-400">({compressionRatio}% smaller)</span>
                    )}
                    {compressionRatio !== null && compressionRatio <= 0 && (
                      <span className="ml-1">(no reduction)</span>
                    )}
                  </p>
                </div>
                <a href={resultUrl} download={archiveName}>
                  <Button type="button" variant="outline" className="gap-2">
                    <Download className="h-4 w-4" aria-hidden="true" />
                    Download
                  </Button>
                </a>
              </div>

              {/* Extract command */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Extract command</p>
                  <div className="flex rounded-md border text-xs overflow-hidden">
                    {OS_TABS.map((tab) => (
                      <button
                        key={tab.value}
                        type="button"
                        onClick={() => setOs(tab.value)}
                        className={[
                          'px-2.5 py-1 transition-colors',
                          os === tab.value
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:text-foreground hover:bg-accent',
                        ].join(' ')}
                        aria-pressed={os === tab.value}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
                  <code className="flex-1 truncate font-mono text-xs">{command}</code>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={handleCopy}
                        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="Copy extract command"
                      >
                        {copied
                          ? <Check className="h-4 w-4 text-green-500" aria-hidden="true" />
                          : <Copy className="h-4 w-4" aria-hidden="true" />}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{copied ? 'Copied!' : 'Copy command'}</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}
