import * as React from 'react'

import {
  Users,
  Tags,
  Archive,
  Sun,
  Moon,
  Laptop,
  FileText,
  Tag,
  User,
} from 'lucide-react'

import {
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  Command,
} from '@/components/ui/command'

import { Input } from '@/components/ui/input'
import { useModeToggle } from './ui/mode-toggle'
import { cn } from '@/lib/utils'
import debounce from '@/lib/debounce'

type SearchResult = {
  blog: { name: string; slug: string }[]
  tags: { name: string; slug: string }[]
  authors: { name: string; slug: string }[]
}

function Slot({
  children,
  ...props
}: React.HTMLAttributes<HTMLElement> & {
  children?: React.ReactNode
}) {
  if (React.isValidElement(children)) {
    return React.cloneElement(children, {
      ...props,
      ...children.props,
      style: {
        ...props.style,
        ...children.props.style,
      },
      className: cn(props.className, children.props.className),
    })
  }
  if (React.Children.count(children) > 1) {
    React.Children.only(null)
  }
  return null
}

type CommandItemProps = {
  className?: string
  asChild?: boolean
  id: string
}
function CustomCommandItem({
  children,
  className,
  asChild,
  id,
}: React.PropsWithChildren<CommandItemProps>) {
  const Comp = asChild ? Slot : 'div'
  return (
    <Comp
      className={cn(
        'relative',
        'flex',
        'cursor-pointer',
        'select-none',
        'items-center',
        'gap-2',
        'rounded-sm',
        'px-2',
        'py-3',
        'text-sm',
        'outline-none',
        'data-[disabled=true]:pointer-events-none',
        'data-[selected=true]:bg-accent',
        'data-[selected=true]:text-accent-foreground',
        'data-[disabled=true]:opacity-50',
        '[&_svg]:pointer-events-none',
        '[&_svg]:size-4',
        '[&_svg]:shrink-0',
        className,
      )}
      id={id}
      cmdk-item
      role="option"
      onMouseEnter={(e) => {
        e.currentTarget.dataset.selected = 'true'
        e.currentTarget.ariaSelected = 'true'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.dataset.selected = 'false'
        e.currentTarget.ariaSelected = 'false'
      }}
      aria-disabled="false"
      aria-selected="false"
      data-disabled="false"
      data-selected="false"
      data-value={id}
    >
      {children}
    </Comp>
  )
}

export function SearchComponent() {
  const [open, setOpen] = React.useState(false)
  const { theme, setTheme } = useModeToggle()

  const [inputValue, setInputValue] = React.useState('')
  const [fetchResult, setFetchResult] = React.useState<SearchResult>()

  async function fetchData(searchString: string): Promise<SearchResult> {
    const responsePromise = fetch(`/search?q=${searchString}`)
    const response = await responsePromise
    const responseJSON = await response.json()
    setFetchResult(responseJSON)
    return responseJSON
  }

  const down = React.useCallback((e: KeyboardEvent) => {
    if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      setOpen((open) => !open)
    }
  }, [])
  React.useEffect(() => {
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  const themes = (
    [
      {
        kind: 'dark',
        Icon: Moon,
        text: 'Use color dark scheme',
      },
      {
        kind: 'theme-light',
        Icon: Sun,
        text: 'Use color light scheme',
      },
      {
        kind: 'system',
        Icon: Laptop,
        text: 'Use System theme',
      },
    ] as const
  ).filter((t) => t.kind !== theme)

  const navigates = [
    {
      href: '/blog',
      Icon: Archive,
      text: 'Go to Blog posts',
    },
    {
      href: '/authors',
      Icon: Users,
      text: 'Go to Users',
    },
    {
      href: '/tags',
      Icon: Tags,
      text: 'Go to Tags',
    },
  ] as const

  const findedBlogs = React.useMemo(() => {
    return inputValue === ''
      ? []
      : fetchResult?.blog.map((b) => ({
          href: b.slug,
          Icon: FileText,
          text: b.name,
        })) || []
  }, [fetchResult, inputValue])

  const findedTags = React.useMemo(() => {
    return inputValue === ''
      ? []
      : fetchResult?.tags.map((t) => ({
          href: t.slug,
          Icon: Tag,
          text: t.name,
        })) || []
  }, [fetchResult, inputValue])

  const findedAuthors = React.useMemo(() => {
    return inputValue === ''
      ? []
      : fetchResult?.authors.map((a) => ({
          href: a.slug,
          Icon: User,
          text: a.name,
        })) || []
  }, [fetchResult, inputValue])

  const debouncedSetSearchTerm = React.useMemo(
    () =>
      debounce((value) => {
        if (value) fetchData(value)
      }, 1000),
    [],
  )

  return (
    <>
      <Input
        placeholder={'Search or ⌘K'}
        value={inputValue}
        onChange={(e) => {
          debouncedSetSearchTerm(e.currentTarget.value)
          setInputValue((prev) => prev + e.target.value)
          setOpen((prev) => !prev)
        }}
        onClick={() => {
          setOpen(true)
        }}
      />

      <CommandDialog open={open} onOpenChange={setOpen}>
        <Command>
          <CommandInput
            onChangeCapture={(e) => {
              debouncedSetSearchTerm(e.currentTarget.value)
              setInputValue(e.currentTarget.value)
            }}
            value={inputValue}
            placeholder="Type a command or search..."
          />
          <CommandList>
            <CommandGroup heading="Navigate">
              {navigates.map((nav) => (
                <CommandItem asChild key={nav.href}>
                  <a href={nav.href} className="flex flex-1 cursor-pointer">
                    {<nav.Icon />}
                    <span>{nav.text}</span>
                  </a>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Theme">
              {themes.map(({ Icon, kind, text }) => (
                <CommandItem key={kind} className="cursor-pointer">
                  <Icon />
                  <span className="flex flex-1" onClick={() => setTheme(kind)}>
                    {text}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            {findedBlogs?.length > 0 && (
              <>
                <div
                  aria-labelledby="Blogs"
                  role="group"
                  cmdk-group
                  data-value="Blogs"
                  className={cn(
                    'overflow-hidden p-1 text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground',
                  )}
                >
                  <div cmdk-group-heading="" aria-hidden="true" id="Blogs">
                    Blogs
                  </div>
                  {findedBlogs?.map((b) => (
                    <CustomCommandItem id="Blogs" asChild>
                      <a href={b.href} className="flex flex-1 cursor-pointer">
                        {<b.Icon />}
                        <span>{b.text}</span>
                      </a>
                    </CustomCommandItem>
                  ))}
                </div>
                <CommandSeparator />
              </>
            )}
            {findedAuthors?.length > 0 && (
              <>
                <div
                  aria-labelledby="Auhors"
                  role="group"
                  cmdk-group
                  data-value="Auhors"
                  className={cn(
                    'overflow-hidden p-1 text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground',
                  )}
                >
                  <div cmdk-group-heading="" aria-hidden="true" id="Auhors">
                    Authors
                  </div>
                  {findedAuthors?.map((a) => (
                    <CustomCommandItem id="Auhors" asChild>
                      <a href={a.href} className="flex flex-1 cursor-pointer">
                        {<a.Icon />}
                        <span>{a.text}</span>
                      </a>
                    </CustomCommandItem>
                  ))}
                </div>
                <CommandSeparator />
              </>
            )}
            {findedTags?.length > 0 && (
              <>
                <div
                  aria-labelledby="Tags"
                  role="group"
                  cmdk-group
                  data-value="Tags"
                  className={cn(
                    'overflow-hidden p-1 text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground',
                  )}
                >
                  <div cmdk-group-heading="" aria-hidden="true" id="Tags">
                    Tags
                  </div>
                  {findedTags?.map((t) => (
                    <CustomCommandItem id="Tags" asChild>
                      <a href={t.href} className="flex flex-1 cursor-pointer">
                        {<t.Icon />}
                        <span>{t.text}</span>
                      </a>
                    </CustomCommandItem>
                  ))}
                </div>
                <CommandSeparator />
              </>
            )}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}
