'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Hash, User } from 'lucide-react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { getSearchData } from '@/app/actions/search'
import type { SearchResult } from '@/lib/search'

export function CommandMenu() {
  const [open, setOpen] = React.useState(false)
  const [searchResults, setSearchResults] = React.useState<SearchResult[]>([])
  const [allResults, setAllResults] = React.useState<SearchResult[]>([])
  const router = useRouter()

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  React.useEffect(() => {
    if (open && allResults.length === 0) {
      // Load all searchable content when dialog opens for the first time
      getSearchData().then((data) => {
        setAllResults(data)
        setSearchResults(data)
      })
    } else if (open) {
      setSearchResults(allResults)
    }
  }, [open, allResults])

  const handleSearch = React.useCallback((search: string) => {
    if (!search || search.trim().length === 0) {
      setSearchResults(allResults)
      return
    }

    const lowerQuery = search.toLowerCase()

    const filtered = allResults.filter((item) => {
      const titleMatch = item.title.toLowerCase().includes(lowerQuery)
      const descriptionMatch = item.description?.toLowerCase().includes(lowerQuery)
      return titleMatch || descriptionMatch
    })

    setSearchResults(filtered)
  }, [allResults])

  const handleSelect = React.useCallback(
    (url: string) => {
      setOpen(false)
      router.push(url)
    },
    [router]
  )

  const getIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'post':
        return <FileText className="mr-2 h-4 w-4" />
      case 'tag':
        return <Hash className="mr-2 h-4 w-4" />
      case 'author':
        return <User className="mr-2 h-4 w-4" />
    }
  }

  // Group results by type
  const posts = searchResults.filter((r) => r.type === 'post')
  const tags = searchResults.filter((r) => r.type === 'tag')
  const authors = searchResults.filter((r) => r.type === 'author')

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search posts, tags, and authors..."
        onValueChange={handleSearch}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        
        {posts.length > 0 && (
          <CommandGroup heading="Posts">
            {posts.map((result) => (
              <CommandItem
                key={result.url}
                onSelect={() => handleSelect(result.url)}
                className="cursor-pointer"
              >
                {getIcon(result.type)}
                <div className="flex flex-col">
                  <span>{result.title}</span>
                  {result.description && (
                    <span className="text-xs text-muted-foreground">
                      {result.description}
                    </span>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {tags.length > 0 && (
          <CommandGroup heading="Tags">
            {tags.map((result) => (
              <CommandItem
                key={result.url}
                onSelect={() => handleSelect(result.url)}
                className="cursor-pointer"
              >
                {getIcon(result.type)}
                <span>{result.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {authors.length > 0 && (
          <CommandGroup heading="Authors">
            {authors.map((result) => (
              <CommandItem
                key={result.url}
                onSelect={() => handleSelect(result.url)}
                className="cursor-pointer"
              >
                {getIcon(result.type)}
                <div className="flex flex-col">
                  <span>{result.title}</span>
                  {result.description && (
                    <span className="text-xs text-muted-foreground">
                      {result.description}
                    </span>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  )
}
