import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO } from 'date-fns'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number, currency = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatDate(dateStr: string): string {
  try {
    // parseISO is locale-agnostic → same output on server (Node) and client (browser)
    return format(parseISO(dateStr), 'dd MMM yyyy')
  } catch {
    return dateStr
  }
}

export function getInitials(name: string | null | undefined): string {
  if (!name) return '?'
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

/** Alias kept for compatibility */
export const initials = getInitials

export function formatDateTime(date: string | Date): string {
  try {
    const d = typeof date === 'string' ? parseISO(date) : date
    return format(d, 'dd MMM yyyy, hh:mm a')
  } catch {
    return String(date)
  }
}

export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const diffMs = Date.now() - d.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  const diffHr = Math.floor(diffMs / 3_600_000)
  const diffDays = Math.floor(diffMs / 86_400_000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return typeof date === 'string' ? formatDate(date) : formatDate(date.toISOString())
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Generates a SKU: e.g. LR-SOF-0001
 * (category = 'Living Room', subcategory = 'Sofas', counter = 1)
 */
export function generateSKU(
  category: string,
  subcategory: string,
  counter: number,
): string {
  const catCode = category
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 3)
  const subCode = subcategory
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 3)
  return `${catCode}-${subCode}-${String(counter).padStart(4, '0')}`
}

export function stockStatus(
  stock: number,
  reorderLevel: number,
): 'in-stock' | 'low-stock' | 'out-of-stock' {
  if (stock <= 0) return 'out-of-stock'
  if (stock <= reorderLevel) return 'low-stock'
  return 'in-stock'
}

export function getStageColor(stage: string): string {
  const map: Record<string, string> = {
    New: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
    Contacted: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    Qualified: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
    'Quotation Sent': 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    Negotiation: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
    Won: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    Lost: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    Draft: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
    'Pending Approval': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
    Sent: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    Converted: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    Rejected: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    Pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    'Partially Paid': 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    Paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  }
  return map[stage] ?? 'bg-slate-100 text-slate-600'
}

export function getRoleColor(role: string): string {
  const map: Record<string, string> = {
    admin: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    manager: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    salesperson: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  }
  return map[role] ?? 'bg-slate-100 text-slate-600'
}

export function getStockStatusColor(
  status: 'in-stock' | 'low-stock' | 'out-of-stock',
): string {
  const map = {
    'in-stock': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    'low-stock': 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    'out-of-stock': 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  }
  return map[status]
}

export interface LineItemCalc {
  line_base: number
  line_discount: number
  taxable: number
  gst_amt: number
  line_total: number
}

export function calcLineItem(
  qty: number,
  unitPrice: number,
  discountPct: number,
  gstPct: number,
): LineItemCalc {
  const round2 = (n: number) => Math.round(n * 100) / 100
  const line_base = qty * unitPrice
  const line_discount = (line_base * discountPct) / 100
  const taxable = line_base - line_discount
  const gst_amt = (taxable * gstPct) / 100
  return {
    line_base: round2(line_base),
    line_discount: round2(line_discount),
    taxable: round2(taxable),
    gst_amt: round2(gst_amt),
    line_total: round2(taxable + gst_amt),
  }
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? `${count} ${singular}` : `${count} ${plural ?? singular + 's'}`
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function pct(part: number, total: number, decimals = 1): number {
  if (total === 0) return 0
  return parseFloat(((part / total) * 100).toFixed(decimals))
}
