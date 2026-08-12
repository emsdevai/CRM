'use client'

import Link from 'next/link'
import { AlertTriangle, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PendingApprovalsBannerProps {
  count: number
  className?: string
}

export function PendingApprovalsBanner({ count, className }: PendingApprovalsBannerProps) {
  if (count === 0) return null

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 rounded-xl px-4 py-3',
        'bg-amber-50 border border-amber-200',
        className,
      )}
      role="alert"
    >
      <div className="flex items-center gap-3 min-w-0">
        <AlertTriangle
          className="w-4 h-4 text-amber-500 flex-shrink-0"
          aria-hidden="true"
        />
        <p className="text-sm font-medium text-amber-800">
          {count === 1
            ? '1 quotation awaiting your approval'
            : `${count} quotations awaiting your approval`}
        </p>
      </div>

      <Link
        href="/quotations?stage=Pending+Approval"
        className={cn(
          'flex items-center gap-1.5 text-xs font-semibold text-amber-700',
          'bg-amber-100 hover:bg-amber-200 transition-colors',
          'px-3 py-1.5 rounded-lg flex-shrink-0',
        )}
      >
        Review Now
        <ArrowRight className="w-3 h-3" aria-hidden="true" />
      </Link>
    </div>
  )
}
