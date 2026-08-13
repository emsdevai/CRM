import Link from 'next/link'
import { redirect } from 'next/navigation'
import { FileText, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getQuotations, getPendingApprovals } from '@/lib/actions/quotations'
import { PageHeader } from '@/components/shared/page-header'
import { QuotationStageBadge } from '@/components/shared/status-badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import { ApprovalActions } from '@/components/quotations/approval-actions'
import type { QuotationStage } from '@/lib/types/database'

const STAGE_TABS = [
  { label: 'All', value: 'all' },
  { label: 'Draft', value: 'Draft' },
  { label: 'Pending Approval', value: 'Pending Approval' },
  { label: 'Sent', value: 'Sent' },
  { label: 'Converted', value: 'Converted' },
  { label: 'Rejected', value: 'Rejected' },
] as const

interface PageProps {
  searchParams: Promise<{ stage?: string; page?: string }>
}

export default async function QuotationsPage({ searchParams }: PageProps) {
  const { stage = 'all', page = '1' } = await searchParams

  // Auth check
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role ?? 'salesperson'
  const isManagerOrAdmin = role === 'admin' || role === 'manager'

  const currentPage = parseInt(page) || 1

  // Parallel fetches
  const [quotationsResult, pendingResult] = await Promise.all([
    getQuotations({
      stage: stage !== 'all' ? stage : undefined,
      page: currentPage,
      pageSize: 20,
    }),
    isManagerOrAdmin ? getPendingApprovals() : Promise.resolve({ data: [], error: null }),
  ])

  const quotations = quotationsResult.data ?? []
  const totalCount = quotationsResult.count ?? 0
  const pendingApprovals = (pendingResult.data ?? []) as Array<{
    id: string
    grand_total: number
    discount_total: number
    created_at: string
    stage: QuotationStage
    creator: { name: string | null } | null
    lead: { id: string; name: string } | null
    customer: { id: string; name: string } | null
  }>

  const showPendingSection = isManagerOrAdmin && pendingApprovals.length > 0 && stage === 'all'

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quotations"
        description="Manage all quotations and approvals"
        actions={
          <Link
            href="/quotations/new"
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Quotation
          </Link>
        }
      />

      {/* ── Pending Approvals (manager / admin only) ──────────────── */}
      {showPendingSection && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/10 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-amber-200 dark:border-amber-900/40 flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-white text-xs font-bold">
              {pendingApprovals.length}
            </span>
            <h2 className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              Pending Approvals
            </h2>
          </div>
          <div className="divide-y divide-amber-100 dark:divide-amber-900/20">
            {pendingApprovals.map((q) => {
              const recipient = q.lead ?? q.customer
              return (
                <div
                  key={q.id}
                  className="flex items-center gap-4 px-5 py-3.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {recipient?.name ?? '—'}
                    </p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      By {q.creator?.name ?? 'Unknown'} ·{' '}
                      {formatDate(q.created_at)}
                    </p>
                  </div>
                  <div className="text-right flex-none">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {formatCurrency(q.grand_total)}
                    </p>
                    {q.discount_total > 0 && (
                      <p className="text-xs text-zinc-400">
                        Disc: {formatCurrency(q.discount_total)}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-none">
                    <Link
                      href={`/quotations/${q.id}`}
                      className="px-3 py-1.5 text-xs font-medium border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-white dark:hover:bg-zinc-800 transition-colors text-zinc-600 dark:text-zinc-300"
                    >
                      View
                    </Link>
                    <ApprovalActions quotationId={q.id} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Stage tabs ────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {STAGE_TABS.map((tab) => (
          <Link
            key={tab.value}
            href={`/quotations?stage=${tab.value}`}
            className={`
              px-3 py-1.5 text-sm font-medium rounded-lg whitespace-nowrap transition-colors
              ${stage === tab.value
                ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'}
            `}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {/* ── Quotations table ──────────────────────────────────────── */}
      {quotations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
          <div className="w-14 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
            <FileText className="w-7 h-7 text-zinc-400" />
          </div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1">No quotations found</h3>
          <p className="text-sm text-zinc-500 max-w-xs">
            {stage === 'all' ? 'Create your first quotation to get started.' : `No ${stage} quotations.`}
          </p>
          <Link
            href="/quotations/new"
            className="mt-5 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Quotation
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden bg-white dark:bg-zinc-900">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30">
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Lead / Customer</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500">Items</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500">Grand Total</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500">Discount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Created By</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Date</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
                {(quotations as Array<{
                  id: string
                  grand_total: number
                  discount_total: number
                  created_at: string
                  stage: QuotationStage
                  creator: { name: string | null } | null
                  lead: { id: string; name: string } | null
                  customer: { id: string; name: string } | null
                  item_count: number
                }>).map((q) => {
                  const recipient = q.lead ?? q.customer
                  const recipientHref = q.lead
                    ? `/leads/${q.lead.id}`
                    : q.customer
                    ? `/customers/${q.customer.id}`
                    : undefined

                  return (
                    <tr
                      key={q.id}
                      className="group hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span className="text-xs font-mono text-zinc-400">
                          {q.id.slice(0, 8).toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {recipient && recipientHref ? (
                          <Link
                            href={recipientHref}
                            className="text-sm font-medium text-zinc-900 dark:text-zinc-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                          >
                            {recipient.name}
                          </Link>
                        ) : (
                          <span className="text-sm text-zinc-400">—</span>
                        )}
                        {q.lead && (
                          <span className="ml-1.5 text-xs text-zinc-400">Lead</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm text-zinc-600 dark:text-zinc-400">
                          {q.item_count}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                          {formatCurrency(q.grand_total)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {q.discount_total > 0 ? (
                          <span className="text-sm text-red-600">
                            −{formatCurrency(q.discount_total)}
                          </span>
                        ) : (
                          <span className="text-sm text-zinc-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <QuotationStageBadge stage={q.stage} />
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-zinc-600 dark:text-zinc-400">
                          {q.creator?.name ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-zinc-500">
                          {formatDate(q.created_at)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/quotations/${q.id}`}
                          className="px-3 py-1.5 text-xs font-medium border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  )
                })}
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
                    href={`/quotations?stage=${stage}&page=${currentPage - 1}`}
                    className="px-3 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs"
                  >
                    Previous
                  </Link>
                )}
                {currentPage * 20 < totalCount && (
                  <Link
                    href={`/quotations?stage=${stage}&page=${currentPage + 1}`}
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
