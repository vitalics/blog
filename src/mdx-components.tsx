import type { MDXComponents } from 'mdx/types'
import FileTree, { FileTreeFolder, FileTreeFile } from '@/components/file-tree'

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    FileTree,
    FileTreeFolder,
    FileTreeFile,
    ...components,
  }
}
