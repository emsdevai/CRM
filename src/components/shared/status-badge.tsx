import { cn } from '@/lib/utils'
import type { LeadStage, QuotationStage, PaymentStatus } from '@/lib/types/database'

// ─── Lead stage badge ──────────────────────────────────────────────────────

const STAGE_STYLES: Record<LeadStage, string> = {
  New:             'bg-slate-100  text-slate-700  ring-slate-300/50',
  Contacted:       'bg-blue-100   text-blue-700   ring-blue-300/50',
  Qualified:       'bg-violet-100 text-violet-700 ring-violet-300/50',
  'Quotation Sent':'bg-amber-100  text-amber-700  ring-amber-300/50',
  Negotiation:     'bg-orange-100 text-orange-700 ring-orange-300/50',
  Won:             'bg-emerald-100 text-emerald-700 ring-emerald-300/50',
  Lost:            'bg-red-100    text-red-700    ring-red-300/50',
}

interface StageBadgeProps {
  stage: LeadStage
  className?: string
}

export function StageBadge({ stage, className }: StageBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ring-1',
        STAGE_STYLES[stage] ?? 'bg-zinc-100 text-zinc-600 ring-zinc-300/50',
        className,
      )}
    >
      {stage}
    </span>
  )
}

// ─── Quotation stage badge ─────────────────────────────────────────────────

const QUOTATION_STAGE_STYLES: Record<QuotationStage, string> = {
  Draft:             'bg-slate-100   text-slate-700   ring-slate-300/50',
  'Pending Approval':'bg-yellow-100  text-yellow-700  ring-yellow-300/50',
  Sent:              'bg-blue-100    text-blue-700    ring-blue-300/50',
  Converted:         'bg-emerald-100 text-emerald-700 ring-emerald-300/50',
  Rejected:          'bg-red-100     text-red-700     ring-red-300/50',
}

interface QuotationStageBadgeProps {
  stage: QuotationStage
  className?: string
}

export function QuotationStageBadge({ stage, className }: QuotationStageBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ring-1',
        QUOTATION_STAGE_STYLES[stage] ?? 'bg-zinc-100 text-zinc-600 ring-zinc-300/50',
        className,
      )}
    >
      {stage}
    </span>
  )
}

// ─── Payment status badge ──────────────────────────────────────────────────

const PAYMENT_STYLES: Record<PaymentStatus, string> = {
  Pending:         'bg-amber-100  text-amber-700  ring-amber-300/50',
  'Partially Paid':'bg-blue-100   text-blue-700   ring-blue-300/50',
  Paid:            'bg-emerald-100 text-emerald-700 ring-emerald-300/50',
}

interface PaymentBadgeProps {
  status: PaymentStatus
  className?: string
}

export function PaymentBadge({ status, className }: PaymentBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ring-1',
        PAYMENT_STYLES[status] ?? 'bg-zinc-100 text-zinc-600 ring-zinc-300/50',
        className,
      )}
    >
      {status}
    </span>
  )
}

// ─── Generic text badge ────────────────────────────────────────────────────

interface GenericBadgeProps {
  label: string
  className?: string
}

export function GenericBadge({ label, className }: GenericBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ring-1',
        'bg-zinc-100 text-zinc-700 ring-zinc-300/50',
        className,
      )}
    >
      {label}
    </span>
  )
}
