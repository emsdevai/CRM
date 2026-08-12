import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import {
  Building2,
  Calendar,
  FileText,
  Package,
  Phone,
  User,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getQuotationById, convertToInvoice } from '@/lib/actions/quotations'
import { PageHeader } from '@/components/shared/page-header'
import { QuotationStageBadge } from '@/components/shared/status-badge'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils'
import { ApprovalActions } from '@/components/quotations/approval-actions'
import { QuotationStageActions } from '@/components/quotations/quotation-stage-actions'
import type { QuotationItem } from '@/lib/types/database'
import Image from 'next/image'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function QuotationDetailPage({ params }: PageProps) {
  const { id } = await params

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

  const { data: quotation, error } = await getQuotationById(id)
  if (error || !quotation) notFound()

  const recipient = quotation.lead ?? quotation.customer
  const recipientHref = quotation.lead
    ? `/leads/${quotation.lead.id}`
    : quotation.customer
    ? `/customers/${quotation.customer.id}`
    : undefined

  const shortId = quotation.id.slice(0, 8).toUpperCase()

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PageHeader
        title={`Quotation #${shortId}`}
        breadcrumb={[
          { label: 'Quotations', href: '/quotations' },
          { label: `#${shortId}` },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <QuotationStageBadge stage={quotation.stage} />
            {quotation.stage === 'Draft' && (
              <Link
                href={`/quotations/${id}/edit`}
                className="px-3 py-1.5 text-sm font-medium border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-zinc-600 dark:text-zinc-300"
              >
                Edit
              </Link>
            )}
          </div>
        }
      />

      {/* ── Pending Approval banner ────────────────────────────────── */}
      {quotation.stage === 'Pending Approval' && isManagerOrAdmin && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              This quotation is awaiting your approval
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">
              Review the line items and discount levels before approving.
            </p>
          </div>
          <ApprovalActions quotationId={id} />
        </div>
      )}

      {/* ── Rejection banner ───────────────────────────────────────── */}
      {quotation.stage === 'Rejected' && (
        <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 px-5 py-4 space-y-2">
          <p className="text-sm font-semibold text-red-800 dark:text-red-300">
            Quotation Rejected
          </p>
          {quotation.reject_reason && (
            <p className="text-sm text-red-600 dark:text-red-400">
              Reason: {quotation.reject_reason}
            </p>
          )}
          <Link
            href={`/quotations/new${recipientHref ? `?leadId=${quotation.lead?.id ?? ''}&customerId=${quotation.customer?.id ?? ''}` : ''}`}
            className="inline-flex items-center gap-1.5 mt-1 text-sm font-medium text-red-700 dark:text-red-400 hover:underline"
          >
            <FileText className="w-3.5 h-3.5" />
            Create New Quotation
          </Link>
        </div>
      )}

      {/* ── Quotation info ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Recipient card */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-500 uppercase tracking-wide">
            <User className="w-3.5 h-3.5" />
            {quotation.lead ? 'Lead' : 'Customer'}
          </div>
          {recipient ? (
            <div>
              {recipientHref ? (
                <Link
                  href={recipientHref}
                  className="text-base font-semibold text-blue-600 hover:underline dark:text-blue-400"
                >
                  {recipient.name}
                </Link>
              ) : (
                <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  {recipient.name}
                </p>
              )}
              {(quotation.lead as { phone?: string } | null)?.phone && (
                <div className="flex items-center gap-1.5 mt-1.5 text-sm text-zinc-500">
                  <Phone className="w-3.5 h-3.5" />
                  {(quotation.lead as { phone: string }).phone}
                </div>
              )}
              {(quotation.customer as { phone?: string | null } | null)?.phone && (
                <div className="flex items-center gap-1.5 mt-1.5 text-sm text-zinc-500">
                  <Phone className="w-3.5 h-3.5" />
                  {(quotation.customer as { phone: string }).phone}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-zinc-400">No recipient</p>
          )}
        </div>

        {/* Creator card */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-500 uppercase tracking-wide">
            <Building2 className="w-3.5 h-3.5" />
            Created By
          </div>
          <div>
            <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              {quotation.creator?.name ?? 'Unknown'}
            </p>
            {quotation.approver && (
              <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-1">
                Approved by {quotation.approver.name}
              </p>
            )}
          </div>
        </div>

        {/* Date card */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-500 uppercase tracking-wide">
            <Calendar className="w-3.5 h-3.5" />
            Date
          </div>
          <div>
            <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              {formatDate(quotation.created_at)}
            </p>
            <p className="text-xs text-zinc-400 mt-0.5">
              {formatDateTime(quotation.created_at)}
            </p>
          </div>
        </div>
      </div>

      {/* ── Line items ─────────────────────────────────────────────── */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-zinc-100 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Line Items
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500 w-72">Product</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500">SKU</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-zinc-500">Qty</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-zinc-500">Unit Price</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-zinc-500">Disc%</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-zinc-500">GST%</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-zinc-500">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/60">
              {(quotation.items as QuotationItem[]).map((item) => (
                <tr key={item.id} className="hover:bg-zinc-50/40 dark:hover:bg-zinc-800/20">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-md bg-zinc-100 dark:bg-zinc-800 overflow-hidden flex-none flex items-center justify-center">
                        {item.image_url ? (
                          <Image
                            src={item.image_url}
                            alt={item.name}
                            width={36}
                            height={36}
                            className="object-cover w-full h-full"
                          />
                        ) : (
                          <Package className="w-4 h-4 text-zinc-400" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          {item.name}
                        </p>
                        {item.is_custom && (
                          <span className="text-xs text-violet-600 dark:text-violet-400">Custom</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-500 font-mono">
                    {item.sku ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-zinc-700 dark:text-zinc-300">
                    {item.qty}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-zinc-700 dark:text-zinc-300">
                    {formatCurrency(item.unit_price)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {item.discount_pct > 0 ? (
                      <span className="text-sm text-red-600">{item.discount_pct}%</span>
                    ) : (
                      <span className="text-sm text-zinc-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-zinc-500">
                    {item.gst_pct}%
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {formatCurrency(item.line_total ?? 0)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end border-t border-zinc-100 dark:border-zinc-800 p-5">
          <div className="w-64 text-sm divide-y divide-zinc-100 dark:divide-zinc-800">
            <div className="flex justify-between py-2">
              <span className="text-zinc-500">Subtotal</span>
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {formatCurrency(quotation.subtotal)}
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-zinc-500">Total Discount</span>
              <span className="font-medium text-red-600">
                −{formatCurrency(quotation.discount_total)}
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-zinc-500">GST Total</span>
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {formatCurrency(quotation.gst_total)}
              </span>
            </div>
            <div className="flex justify-between py-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg px-3 -mx-1 mt-1">
              <span className="font-bold text-zinc-900 dark:text-zinc-100">Grand Total</span>
              <span className="font-bold text-xl text-zinc-900 dark:text-zinc-100">
                {formatCurrency(quotation.grand_total)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Notes ──────────────────────────────────────────────────── */}
      {quotation.notes && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Notes</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">
            {quotation.notes}
          </p>
        </div>
      )}

      {/* ── Stage-based actions ────────────────────────────────────── */}
      <QuotationStageActions
        quotationId={id}
        stage={quotation.stage}
        userId={user.id}
        createdBy={quotation.created_by ?? ''}
      />
    </div>
  )
}
