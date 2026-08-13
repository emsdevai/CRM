'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Menu, Search, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn, getInitials } from '@/lib/utils'
import type { Profile } from '@/lib/types/database'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type ResultType = 'lead' | 'customer' | 'product'

interface SearchResult {
  id: string
  name: string
  type: ResultType
  href: string
}

const TYPE_LABELS: Record<ResultType, string> = {
  lead: 'Lead',
  customer: 'Customer',
  product: 'Product',
}

const TYPE_COLORS: Record<ResultType, string> = {
  lead: 'bg-blue-100 text-blue-700',
  customer: 'bg-emerald-100 text-emerald-700',
  product: 'bg-amber-100 text-amber-700',
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface TopbarProps {
  profile: Profile | null
  onMenuToggle: () => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function Topbar({ profile, onMenuToggle }: TopbarProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── ⌘K / Ctrl+K shortcut ────────────────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  // ── Close dropdown on outside pointer-down ───────────────────────────────
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node
      if (
        !inputRef.current?.contains(target) &&
        !dropdownRef.current?.contains(target)
      ) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  // ── Cleanup debounce on unmount ──────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  // ── Supabase search (debounced 300 ms) ───────────────────────────────────
  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim()
    if (trimmed.length < 2) {
      setResults([])
      setShowDropdown(false)
      return
    }

    setSearching(true)
    try {
      const supabase = createClient()
      const pattern = `%${trimmed}%`

      const [leadsRes, customersRes, productsRes] = await Promise.all([
        supabase
          .from('leads')
          .select('id, name')
          .ilike('name', pattern)
          .limit(3),
        supabase
          .from('customers')
          .select('id, name')
          .ilike('name', pattern)
          .limit(3),
        supabase
          .from('products')
          .select('id, name')
          .ilike('name', pattern)
          .limit(3),
      ])

      const combined: SearchResult[] = [
        ...(leadsRes.data ?? []).map((r) => ({
          id: r.id as string,
          name: (r.name as string | null) ?? '',
          type: 'lead' as const,
          href: `/leads/${r.id}`,
        })),
        ...(customersRes.data ?? []).map((r) => ({
          id: r.id as string,
          name: (r.name as string | null) ?? '',
          type: 'customer' as const,
          href: `/customers/${r.id}`,
        })),
        ...(productsRes.data ?? []).map((r) => ({
          id: r.id as string,
          name: (r.name as string | null) ?? '',
          type: 'product' as const,
          href: `/inventory/${r.id}`,
        })),
      ].slice(0, 5)

      setResults(combined)
      setShowDropdown(true)
    } catch {
      // Silently swallow search errors — the search bar is non-critical
      setResults([])
    } finally {
      setSearching(false)
    }
  }, [])

  // ── Input change handler ─────────────────────────────────────────────────
  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setQuery(val)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => runSearch(val), 300)
  }

  function onResultClick(result: SearchResult) {
    setQuery('')
    setResults([])
    setShowDropdown(false)
    router.push(result.href)
  }

  function clearSearch() {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setQuery('')
    setResults([])
    setShowDropdown(false)
    inputRef.current?.focus()
  }

  const userInitials = getInitials(profile?.name)

  return (
    <header className="h-16 bg-white border-b border-zinc-200 flex items-center px-4 gap-3 flex-shrink-0">
      {/* ── Mobile hamburger ────────────────────────────────────────── */}
      <button
        type="button"
        onClick={onMenuToggle}
        className={cn(
          'lg:hidden p-2 rounded-lg',
          'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100',
          'transition-colors focus-visible:outline-none',
          'focus-visible:ring-2 focus-visible:ring-blue-700',
        )}
        aria-label="Open navigation menu"
      >
        <Menu className="w-5 h-5" aria-hidden="true" />
      </button>

      {/* ── Global search ───────────────────────────────────────────── */}
      <div className="relative flex-1 max-w-xl">
        {/* Input wrapper */}
        <div
          className={cn(
            'flex items-center gap-2 px-3 h-9 rounded-lg',
            'bg-zinc-50 border border-zinc-200',
            'focus-within:bg-white focus-within:border-zinc-300',
            'focus-within:ring-2 focus-within:ring-blue-700/20',
            'transition-all',
          )}
        >
          <Search
            className="w-4 h-4 text-zinc-400 flex-shrink-0"
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-label="Search leads, customers, and products"
            aria-expanded={showDropdown}
            aria-autocomplete="list"
            aria-haspopup="listbox"
            aria-controls="global-search-listbox"
            value={query}
            onChange={onInputChange}
            onFocus={() => {
              if (results.length > 0) setShowDropdown(true)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setShowDropdown(false)
                inputRef.current?.blur()
              }
            }}
            placeholder="Search leads, customers, products… (⌘K)"
            className="flex-1 min-w-0 bg-transparent text-sm text-zinc-900 placeholder:text-zinc-400 outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={clearSearch}
              className="flex-shrink-0 text-zinc-400 hover:text-zinc-600 transition-colors focus-visible:outline-none"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* ── Results dropdown ────────────────────────────────────── */}
        {showDropdown && (
          <div
            ref={dropdownRef}
            id="global-search-listbox"
            role="listbox"
            aria-label="Search results"
            className={cn(
              'absolute top-full left-0 right-0 mt-1.5 z-50',
              'bg-white border border-zinc-200 rounded-xl shadow-lg overflow-hidden',
            )}
          >
            {searching ? (
              <div className="px-4 py-3 text-sm text-zinc-500">
                Searching…
              </div>
            ) : results.length > 0 ? (
              <ul role="group">
                {results.map((result) => (
                  <li
                    key={`${result.type}-${result.id}`}
                    role="option"
                    aria-selected="false"
                  >
                    <button
                      type="button"
                      onClick={() => onResultClick(result)}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-2.5 text-left',
                        'hover:bg-zinc-50 transition-colors group',
                      )}
                    >
                      <span
                        className={cn(
                          'inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium flex-shrink-0',
                          TYPE_COLORS[result.type],
                        )}
                      >
                        {TYPE_LABELS[result.type]}
                      </span>
                      <span className="text-sm text-zinc-800 truncate group-hover:text-zinc-600">
                        {result.name}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-4 py-3 text-sm text-zinc-500">
                No results for &ldquo;{query}&rdquo;
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Right actions ────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 ml-auto flex-shrink-0">
        {/* Notification bell */}
        <button
          type="button"
          className={cn(
            'p-2 rounded-lg text-zinc-500',
            'hover:text-zinc-700 hover:bg-zinc-100',
            'transition-colors focus-visible:outline-none',
            'focus-visible:ring-2 focus-visible:ring-blue-700',
          )}
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5" aria-hidden="true" />
        </button>

        {/* User avatar + name */}
        <div className="flex items-center gap-2.5 pl-1">
          <div
            className="w-8 h-8 rounded-full bg-blue-700 flex items-center justify-center flex-shrink-0"
            aria-hidden="true"
          >
            <span className="text-white text-xs font-semibold leading-none">
              {userInitials}
            </span>
          </div>
          <span className="hidden sm:block text-sm font-medium text-zinc-700 max-w-[140px] truncate">
            {profile?.name ?? 'User'}
          </span>
        </div>
      </div>
    </header>
  )
}
