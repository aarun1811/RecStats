import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  CommandIcon,
  Database,
  FileBarChart,
  LayoutDashboard,
  SearchIcon,
  Clock,
  Settings,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api-client'
import type { SearchResponse, SearchResult } from '@/types/api'
import { navItems } from './nav-main'

const RECENT_SEARCHES_KEY = 'recviz-recent-searches'
const MAX_RECENT = 5

function getRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveRecentSearch(query: string) {
  const recent = getRecentSearches().filter((q) => q !== query)
  recent.unshift(query)
  localStorage.setItem(
    RECENT_SEARCHES_KEY,
    JSON.stringify(recent.slice(0, MAX_RECENT)),
  )
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

const typeIcons: Record<string, React.ElementType> = {
  dashboard: LayoutDashboard,
  chart: FileBarChart,
  dataset: Database,
}

const typeRoutes: Record<string, (id: string | number) => string> = {
  dashboard: (id) => `/dashboards/${id}`,
  chart: (id) => `/dashboards/${id}`,
  dataset: () => `/explorer`,
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const navigate = useNavigate()
  const debouncedQuery = useDebounce(query, 300)

  // Keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  // Load recent searches when opening
  useEffect(() => {
    if (open) {
      setRecentSearches(getRecentSearches())
      setQuery('')
      setResults([])
    }
  }, [open])

  // Debounced API search
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([])
      return
    }

    let cancelled = false
    setIsSearching(true)

    api
      .post<SearchResponse>('/api/search', { query: debouncedQuery })
      .then((res) => {
        if (!cancelled) {
          setResults(res.results ?? [])
        }
      })
      .catch(() => {
        if (!cancelled) setResults([])
      })
      .finally(() => {
        if (!cancelled) setIsSearching(false)
      })

    return () => {
      cancelled = true
    }
  }, [debouncedQuery])

  const handleSelect = useCallback(
    (href: string, searchQuery?: string) => {
      setOpen(false)
      if (searchQuery) saveRecentSearch(searchQuery)
      navigate({ to: href })
    },
    [navigate],
  )

  const handleRecentSelect = useCallback(
    (recentQuery: string) => {
      setQuery(recentQuery)
    },
    [],
  )

  // Group API results by type
  const grouped = results.reduce<Record<string, SearchResult[]>>(
    (acc, item) => {
      const key = item.type
      if (!acc[key]) acc[key] = []
      acc[key].push(item)
      return acc
    },
    {},
  )

  const groupLabels: Record<string, string> = {
    dashboard: 'Dashboards',
    chart: 'Charts',
    dataset: 'Datasets',
  }

  return (
    <div className="lg:flex-1">
      {/* Desktop: inline search input */}
      <div className="relative hidden max-w-sm flex-1 lg:block">
        <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <Input
          className="h-9 w-full cursor-pointer rounded-md border pr-4 pl-10 text-sm shadow-xs"
          placeholder="Search..."
          type="search"
          onFocus={() => setOpen(true)}
          readOnly
        />
        <div className="absolute top-1/2 right-2 hidden -translate-y-1/2 items-center gap-0.5 rounded-sm bg-zinc-200 p-1 font-mono text-xs font-medium sm:flex dark:bg-neutral-700">
          <CommandIcon className="size-3" />
          <span>k</span>
        </div>
      </div>
      {/* Mobile: icon button */}
      <div className="block lg:hidden">
        <Button size="icon" variant="ghost" onClick={() => setOpen(true)}>
          <SearchIcon />
        </Button>
      </div>

      <CommandDialog open={open} onOpenChange={setOpen} shouldFilter={false}>
        <CommandInput
          placeholder="Search dashboards, charts, datasets..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>
            {isSearching ? 'Searching...' : 'No results found.'}
          </CommandEmpty>

          {/* Recent searches (shown when no query) */}
          {!query.trim() && recentSearches.length > 0 && (
            <>
              <CommandGroup heading="Recent Searches">
                {recentSearches.map((recent) => (
                  <CommandItem
                    key={recent}
                    onSelect={() => handleRecentSelect(recent)}
                  >
                    <Clock className="mr-2 size-4 text-muted-foreground" />
                    <span>{recent}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
            </>
          )}

          {/* API search results (shown when query has results) */}
          {query.trim() &&
            Object.entries(grouped).map(([type, items]) => (
              <React.Fragment key={type}>
                <CommandGroup heading={groupLabels[type] ?? type}>
                  {items.map((item) => {
                    const Icon = typeIcons[item.type] ?? FileBarChart
                    const href =
                      typeRoutes[item.type]?.(item.id) ?? '/dashboards'
                    return (
                      <CommandItem
                        key={`${item.type}-${item.id}`}
                        onSelect={() => handleSelect(href, query)}
                      >
                        <Icon className="mr-2 size-4" />
                        <span>{item.name}</span>
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
                <CommandSeparator />
              </React.Fragment>
            ))}

          {/* Static pages (always shown) */}
          {!query.trim() && (
            <>
              {navItems.map((group) => (
                <React.Fragment key={group.title}>
                  <CommandGroup heading={group.title}>
                    {group.items.map((item) => (
                      <CommandItem
                        key={item.href}
                        onSelect={() => handleSelect(item.href)}
                      >
                        {item.icon && <item.icon className="mr-2 size-4" />}
                        <span>{item.title}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </React.Fragment>
              ))}

              <CommandGroup heading="Actions">
                <CommandItem
                  onSelect={() => handleSelect('/settings')}
                >
                  <Settings className="mr-2 size-4" />
                  <span>Settings</span>
                </CommandItem>
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>
    </div>
  )
}
