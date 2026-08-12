import Link from 'next/link'
import { redirect } from 'next/navigation'
import { IndianRupee, Receipt } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getInvoices, getInvoiceStats } from '@/lib/actions/invoices'
import { PageHeader } from '@/components/shared/page-header'
import { PaymentBadge } from '@/components/shared/status-badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { PaymentStatus } from '@/lib/types/database'

const PAYMENT_TABS = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'Pending' },
  { label: 'Partially Paid', value: 'Partially Paid' },
  { label: 'Paid', value: 'Paid' },
] as const

interface PageProps {
  searchParams: Promise<{
    status?: string
    search?: string
    page?: string
  }>
}

export default async function InvoicesPage({ searchParams }: PageProps) {
  const { status = 'all', search = '', page = '1' } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const currentPage = parseInt(page) || 1

  const [invoicesResult, statsResult] = await Promise.all([
    getInvoices({
      paymentStatus: status !== 'all' ? status : undefined,
      search: search || undefined,
      page: currentPage,
      pageSize: 20,
    }),
    getInvoiceStats(),
  ])

  const invoices = invoicesResult.data ?? []
  const totalCount = invoicesResult.count ?? 0
  const stats = statsResult.data

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        description="Track all invoices and payment status"
      />

      {/* ── Stats row ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="col-span-2 md:col-span-1 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5">
          <div className="flex items-center gap-2 mb-2">
            <IndianRupee className="w-4 h-4 text-zinc-500" />
            <p className="text-xs font-medium text-zinc-500">Total Revenue</p>
          </div>
          <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">
            {formatCurrency(stats?.total_revenue ?? 0)}
          </p>
        </div>
        <div className="rounded-xl border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/10 p-5">
          <div className="flex items-center gap-2 mb-2">
            <Receipt className="w-4 h-4 text-emerald-600" />
            <p className="text-xs font-medium text-zinc-500">Paid</p>
          </div>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
            {stats?.paid ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-950/10 p-5">
          <div className="flex items-center gap-2 mb-2">
            <Receipt className="w-4 h-4 text-blue-600" />
            <p className="text-xs font-medium text-zinc-500">Partially Paid</p>
          </div>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 tabular-nums">
            {stats?.partially_paid ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-amber-100 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/10 p-5">
          <div className="flex items-center gap-2 mb-2">
            <Receipt className="w-4 h-4 text-amber-600" />
            <p className="text-xs font-medium text-zinc-500">Pending</p>
          </div>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">
            {stats?.pending ?? 0}
          </p>
        </div>
      </div>

      {/* ── Filters ───────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {/* Payment status tabs */}
        <div className="flex items-center gap-1">
          {PAYMENT_TABS.map((tab) => (
            <Link
              key={tab.value}
              href={`/invoices?status=${tab.value}${search ? `&search=${encodeURIComponent(search)}` : ''}`}
              className={`
                px-3 py-1.5 text-sm font-medium rounded-lg whitespace-nowrap transition-colors
                ${status === tab.value
                  ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'}
              `}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        {/* Search */}
        <form method="GET" action="/invoices" className="flex-1 max-w-xs">
          <input type="hidden" name="status" value={status} />
          <input
            type="search"
            name="search"
            defaultValue={search}
            placeholder="Search invoice number..."
            className="w-full px-3 py-1.5 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </form>
      </div>

      {/* ── Invoices table ────────────────────────────────────────── */}
      {invoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
          <div className="w-14 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
            <Receipt className="w-7 h-7 text-zinc-400" />
          </div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1">No invoices found</h3>
          <p className="text-sm text-zinc-500">Invoices are created when a quotation is converted.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden bg-white dark:bg-zinc-900">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30">
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Invoice #</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Date</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500">Items</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500">Grand Total</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Payment</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Salesperson</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
                {(invoices as Array<{
                  id: string
                  invoice_no: string
                  invoice_date: string
                  grand_total: number | null
                  payment_status: PaymentStatus
                  customer: { id: string; name: string } | null
                  salesperson: { id: string; name: string | null } | null
                  item_count: number
                }>).map((inv) => (
                  <tr
                    key={inv.id}
                    className="group hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="text-sm font-mono font-medium text-zinc-900 dark:text-zinc-100">
                        {inv.invoice_no}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {inv.customer ? (
                        <Link
                          href={`/customers/${inv.customer.id}`}
                          className="text-sm font-medium text-zinc-900 dark:text-zinc-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        >
                          {inv.customer.name}
                        </Link>
                      ) : (
                        <span className="text-sm text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-zinc-500">
                        {formatDate(inv.invoice_date)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm text-zinc-600 dark:text-zinc-400">
                        {inv.item_count}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {formatCurrency(inv.grand_total ?? 0)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <PaymentBadge status={inv.payment_status} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-zinc-600 dark:text-zinc-400">
                        {inv.salesperson?.name ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Link
                          href={`/invoices/${inv.id}`}
                          className="px-3 py-1.5 text-xs font-medium border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-colors"
                        >
                          View
                        </Link>
                        <Link
                          href={`/api/invoices/${inv.id}/pdf`}
                          target="_blank"
                          className="px-3 py-1.5 text-xs font-medium border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-colors"
                        >
                          PDF
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalCount > 20 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-100 dark:border-zinc-800 text-sm text-zinc-500">
              <span>
                Showing {((currentPage - 1) * 20) + 1}–{Math.min(currentPage * 20, totalCount)} of {totalCount}
              </span>
              <div className="flex gap-2">
                {currentPage > 1 && (
                  <Link
                    href={`/invoices?status=${status}&search=${search}&page=${currentPage - 1}`}
                    className="px-3 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs"
                  >
                    Previous
                  </Link>
                )}
                {currentPage * 20 < totalCount && (
                  <Link
                    href={`/invoices?status=${status}&search=${search}&page=${currentPage + 1}`}
                    className="px-3 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs"
                  >
                    Next
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
