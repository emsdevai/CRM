'use client'

import React from 'react'
import { ChevronLeft, ChevronRight, ChevronsUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EmptyState } from './empty-state'
import { LoadingSpinner } from './loading-spinner'
import type { LucideIcon } from 'lucide-react'

export interface Column<T> {
  key: string
  label: string
  sortable?: boolean
  className?: string
  headerClassName?: string
  render: (row: T, index: number) => React.ReactNode
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  loading?: boolean
  emptyMessage?: string
  emptyDescription?: string
  emptyIcon?: LucideIcon
  onRowClick?: (row: T) => void
  keyExtractor: (row: T) => string
  // Sorting
  sortKey?: string
  sortDir?: 'asc' | 'desc'
  onSort?: (key: string, dir: 'asc' | 'desc') => void
  // Pagination
  page?: number
  pageSize?: number
  total?: number
  onPageChange?: (page: number) => void
  // Style
  className?: string
  compact?: boolean
}

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-zinc-100 rounded animate-pulse" style={{ width: `${60 + Math.random() * 30}%` }} />
        </td>
      ))}
    </tr>
  )
}

export function DataTable<T>({
  columns,
  data,
  loading = false,
  emptyMessage = 'No data found',
  emptyDescription = '',
  emptyIcon,
  onRowClick,
  keyExtractor,
  sortKey,
  sortDir,
  onSort,
  page = 1,
  pageSize = 20,
  total,
  onPageChange,
  className,
  compact = false,
}: DataTableProps<T>) {
  const totalPages = total ? Math.ceil(total / pageSize) : 1
  const startItem = (page - 1) * pageSize + 1
  const endItem = Math.min(page * pageSize, total ?? data.length)
  const totalCount = total ?? data.length

  function handleSort(key: string) {
    if (!onSort) return
    if (sortKey === key) {
      onSort(key, sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      onSort(key, 'asc')
    }
  }

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Table wrapper with horizontal scroll */}
      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'px-4 text-left font-medium text-zinc-500 select-none whitespace-nowrap',
                    compact ? 'py-2' : 'py-3',
                    col.sortable && onSort ? 'cursor-pointer hover:text-zinc-900' : '',
                    col.headerClassName,
                  )}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    {col.sortable && onSort && (
                      <span className="text-zinc-300">
                        {sortKey === col.key ? (
                          sortDir === 'asc' ? (
                            <ArrowUp className="h-3 w-3 text-zinc-600" />
                          ) : (
                            <ArrowDown className="h-3 w-3 text-zinc-600" />
                          )
                        ) : (
                          <ChevronsUpDown className="h-3 w-3" />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <SkeletonRow key={i} cols={columns.length} />
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>
                  <EmptyState
                    icon={emptyIcon!}
                    title={emptyMessage}
                    description={emptyDescription}
                    className="py-12"
                  />
                </td>
              </tr>
            ) : (
              data.map((row, index) => (
                <tr
                  key={keyExtractor(row)}
                  onClick={() => onRowClick?.(row)}
                  className={cn(
                    'transition-colors',
                    onRowClick ? 'cursor-pointer hover:bg-zinc-50' : '',
                    compact ? 'text-xs' : '',
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        'px-4 text-zinc-700',
                        compact ? 'py-2' : 'py-3',
                        col.className,
                      )}
                    >
                      {col.render(row, index)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!loading && (onPageChange || totalCount > 0) && (
        <div className="flex items-center justify-between mt-3 px-1">
          <p className="text-xs text-zinc-500">
            {totalCount > 0
              ? `Showing ${startItem}–${endItem} of ${totalCount}`
              : 'No results'}
          </p>
          {onPageChange && totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => onPageChange(page - 1)}
                disabled={page <= 1}
                className="p-1.5 rounded-md border border-zinc-200 text-zinc-500 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-2 text-xs text-zinc-600">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => onPageChange(page + 1)}
                disabled={page >= totalPages}
                className="p-1.5 rounded-md border border-zinc-200 text-zinc-500 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
