import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Download, Package, Pencil, Phone, Printer } from 'lucide-react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { getInvoiceById } from '@/lib/actions/invoices'
import { PageHeader } from '@/components/shared/page-header'
import { PaymentBadge } from '@/components/shared/status-badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import { PaymentStatusUpdater } from '@/components/invoices/payment-status-updater'
import { InvoiceAdminActions } from '@/components/invoices/invoice-admin-actions'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function InvoiceDetailPage({ params }: PageProps) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profileData } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  const role = profileData?.role ?? 'salesperson'

  const { data: invoice, error } = await getInvoiceById(id)
  if (error || !invoice) notFound()

  const cgst = (invoice.gst_total ?? 0) / 2
  const sgst = (invoice.gst_total ?? 0) / 2

  // Optional columns
  const freightCharges: number   = (invoice as any).freight_charges   ?? 0
  const paymentMode: string      = (invoice as any).payment_method    ?? (invoice as any).payment_mode ?? ''
  const paymentReference: string = (invoice as any).payment_reference ?? ''
  const paymentCardType: string  = (invoice as any).payment_card_type ?? ''
  const cardSurchargePct: number = (invoice as any).card_surcharge_pct ?? 0
  const paymentMeta: Record<string, string> = (invoice as any).payment_meta ?? {}
  const cardSurcharge = cardSurchargePct > 0
    ? (((invoice.subtotal ?? 0) - (invoice.discount_total ?? 0) + (invoice.gst_total ?? 0) + freightCharges) * cardSurchargePct) / 100
    : 0

  const customer = invoice.customer as {
    name: string
    phone?: string | null
    email?: string | null
    address?: string | null
    city?: string | null
    state?: string | null
    gst_number?: string | null
    pincode?: string | null
  } | null

  type ItemWithHsn = {
    id: string
    name: string | null
    sku: string | null
    image_url: string | null
    qty: number | null
    unit_price: number | null
    discount_pct: number | null
    gst_pct: number | null
    line_total: number | null
    product?: { id: string; hsn_code: string | null } | null
    hsn_code?: string | null
  }

  const items = (invoice.items as ItemWithHsn[]) ?? []

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PageHeader
        title={`Invoice ${invoice.invoice_no}`}
        breadcrumb={[
          { label: 'Invoices', href: '/invoices' },
          { label: invoice.invoice_no },
        ]}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/api/invoices/${id}/pdf`}
              target="_blank"
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-zinc-700 dark:text-zinc-300"
            >
              <Download className="w-3.5 h-3.5" />
              Download PDF
            </Link>
            <Link
              href={`/api/invoices/${id}/pdf`}
              target="_blank"
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-zinc-700 dark:text-zinc-300"
            >
              <Printer className="w-3.5 h-3.5" />
              Print
            </Link>
            {role === 'admin' && (
              <>
                <Link
                  href={`/invoices/${id}/edit`}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-zinc-700 dark:text-zinc-300"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit
                </Link>
                <InvoiceAdminActions
                  invoiceId={id}
                  invoiceNo={invoice.invoice_no}
                  afterDelete="list"
                />
              </>
            )}
          </div>
        }
      />

      {/* ── Invoice Document ─────────────────────────────────────────── */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-800/20">
          <div>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Jangid Brothers</h1>
            <p className="text-sm text-zinc-500 mt-0.5">Complete Furniture Retail</p>
          </div>
          <div className="text-right">
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-bold tracking-widest uppercase mb-2">
              Tax Invoice
            </div>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{invoice.invoice_no}</p>
            <p className="text-sm text-zinc-500">Date: {formatDate(invoice.invoice_date)}</p>
          </div>
        </div>

        {/* Billed To / Ship To */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border-b border-zinc-100 dark:border-zinc-800">
          <div className="px-6 py-4 md:border-r border-zinc-100 dark:border-zinc-800">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">Billed To</p>
            {customer ? (
              <div className="space-y-1">
                <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{customer.name}</p>
                {customer.gst_number && <p className="text-xs text-zinc-500">GSTIN: {customer.gst_number}</p>}
                {customer.phone && (
                  <div className="flex items-center gap-1.5 text-sm text-zinc-500">
                    <Phone className="w-3.5 h-3.5" />
                    {customer.phone}
                  </div>
                )}
                {customer.address && <p className="text-sm text-zinc-500">{customer.address}</p>}
                {(customer.city || customer.state || customer.pincode) && (
                  <p className="text-sm text-zinc-500">
                    {[customer.city, customer.state, customer.pincode].filter(Boolean).join(', ')}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-zinc-400">No customer details</p>
            )}
          </div>

          <div className="px-6 py-4">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">Ship To</p>
            {customer ? (
              <div className="space-y-1">
                <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{customer.name}</p>
                {customer.phone && (
                  <div className="flex items-center gap-1.5 text-sm text-zinc-500">
                    <Phone className="w-3.5 h-3.5" />
                    {customer.phone}
                  </div>
                )}
                {customer.address && <p className="text-sm text-zinc-500">{customer.address}</p>}
                {(customer.city || customer.state || customer.pincode) && (
                  <p className="text-sm text-zinc-500">
                    {[customer.city, customer.state, customer.pincode].filter(Boolean).join(', ')}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-zinc-400">—</p>
            )}
          </div>
        </div>

        {/* Payment Status + Mode */}
        <div className="px-6 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/20 dark:bg-zinc-800/10 space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Payment Status:</span>
              <PaymentBadge status={invoice.payment_status} className="text-sm px-3 py-1" />
              {paymentMode && (
                <span className="text-sm text-zinc-600 dark:text-zinc-400">
                  via <span className="font-semibold text-zinc-800 dark:text-zinc-200">{paymentMode}</span>
                  {/* Card */}
                  {paymentCardType && <span className="ml-1 text-zinc-500">({paymentCardType}{paymentMeta.card_last4 ? ` ···${paymentMeta.card_last4}` : ''})</span>}
                  {/* UPI / Bank / Cheque — reference number */}
                  {paymentReference && <span className="ml-1.5 font-mono text-xs text-zinc-400">#{paymentReference}</span>}
                  {/* Bank Transfer extra */}
                  {paymentMeta.bank_name && <span className="ml-1.5 text-zinc-400">· {paymentMeta.bank_name}</span>}
                  {paymentMeta.ifsc && <span className="ml-1 text-zinc-400 font-mono text-xs">({paymentMeta.ifsc})</span>}
                  {/* Cheque date */}
                  {paymentMeta.cheque_date && <span className="ml-1.5 text-zinc-400">· Dt: {paymentMeta.cheque_date}</span>}
                </span>
              )}
            </div>
            <PaymentStatusUpdater invoiceId={id} currentStatus={invoice.payment_status} />
          </div>
          {freightCharges > 0 && (
            <p className="text-sm text-zinc-500">
              Freight Charges: <span className="font-medium text-zinc-800 dark:text-zinc-200">{formatCurrency(freightCharges)}</span>
            </p>
          )}
          {cardSurchargePct > 0 && (
            <p className="text-sm text-zinc-500">
              Card Surcharge ({cardSurchargePct}%): <span className="font-medium text-zinc-800 dark:text-zinc-200">{formatCurrency(cardSurcharge)}</span>
            </p>
          )}
        </div>

        {/* Line items table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/20">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500 w-8">#</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500">Product</th>
                <th className="px-4 py-2.5 text-center text-xs font-medium text-zinc-500">HSN</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500">SKU</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-zinc-500">Qty</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-zinc-500">Unit Price</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-zinc-500">Discount</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-zinc-500">Taxable</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-zinc-500">GST%</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-zinc-500">GST Amt</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-zinc-500">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/60">
              {items.map((item, idx) => {
                const lineBase = (item.qty ?? 0) * (item.unit_price ?? 0)
                const lineDiscount = lineBase * ((item.discount_pct ?? 0) / 100)
                const taxable = lineBase - lineDiscount
                const gstAmt = taxable * ((item.gst_pct ?? 0) / 100)
                const hsnCode = item.product?.hsn_code ?? item.hsn_code ?? ''

                return (
                  <tr key={item.id} className="hover:bg-zinc-50/40 dark:hover:bg-zinc-800/20">
                    <td className="px-4 py-3 text-xs text-zinc-400">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-md bg-zinc-100 dark:bg-zinc-800 overflow-hidden flex-none flex items-center justify-center">
                          {item.image_url ? (
                            <Image src={item.image_url} alt={item.name ?? ''} width={32} height={32} className="object-cover w-full h-full" />
                          ) : (
                            <Package className="w-3.5 h-3.5 text-zinc-400" />
                          )}
                        </div>
                        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{item.name ?? '—'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-xs font-mono text-zinc-500">
                      {hsnCode || '—'}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-zinc-400">{item.sku ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-sm text-zinc-700 dark:text-zinc-300">{item.qty ?? 0}</td>
                    <td className="px-4 py-3 text-right text-sm text-zinc-700 dark:text-zinc-300">{formatCurrency(item.unit_price ?? 0)}</td>
                    <td className="px-4 py-3 text-right">
                      {(item.discount_pct ?? 0) > 0 ? (
                        <span className="text-sm text-red-600">
                          −{formatCurrency(lineDiscount)}
                          <span className="text-xs text-zinc-400 ml-1">({item.discount_pct}%)</span>
                        </span>
                      ) : (
                        <span className="text-sm text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-zinc-700 dark:text-zinc-300">{formatCurrency(taxable)}</td>
                    <td className="px-4 py-3 text-right text-sm text-zinc-500">{item.gst_pct ?? 0}%</td>
                    <td className="px-4 py-3 text-right text-sm text-zinc-700 dark:text-zinc-300">{formatCurrency(gstAmt)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{formatCurrency(item.line_total ?? 0)}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Totals summary */}
        <div className="flex justify-end px-6 py-5 border-t border-zinc-100 dark:border-zinc-800">
          <div className="w-72 text-sm space-y-0 divide-y divide-zinc-100 dark:divide-zinc-800">
            <div className="flex justify-between py-2">
              <span className="text-zinc-500">Subtotal</span>
              <span className="font-medium text-zinc-900 dark:text-zinc-100">{formatCurrency(invoice.subtotal ?? 0)}</span>
            </div>
            {(invoice.discount_total ?? 0) > 0 && (
              <div className="flex justify-between py-2">
                <span className="text-zinc-500">Total Discount</span>
                <span className="font-medium text-red-600">−{formatCurrency(invoice.discount_total ?? 0)}</span>
              </div>
            )}
            <div className="flex justify-between py-2">
              <span className="text-zinc-500">CGST</span>
              <span className="font-medium text-zinc-900 dark:text-zinc-100">{formatCurrency(cgst)}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-zinc-500">SGST</span>
              <span className="font-medium text-zinc-900 dark:text-zinc-100">{formatCurrency(sgst)}</span>
            </div>
            {freightCharges > 0 && (
              <div className="flex justify-between py-2">
                <span className="text-zinc-500">Freight</span>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">{formatCurrency(freightCharges)}</span>
              </div>
            )}
            {cardSurcharge > 0 && (
              <div className="flex justify-between py-2">
                <span className="text-zinc-500">Card Surcharge ({cardSurchargePct}%)</span>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">{formatCurrency(cardSurcharge)}</span>
              </div>
            )}
            <div className="flex justify-between py-3.5 bg-zinc-50 dark:bg-zinc-800/60 rounded-lg px-3 -mx-1 mt-2">
              <span className="font-bold text-zinc-900 dark:text-zinc-100 text-base">Grand Total</span>
              <span className="font-bold text-2xl text-zinc-900 dark:text-zinc-100">{formatCurrency(invoice.grand_total ?? 0)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Quotation link ─────────────────────────────────────────── */}
      {(() => {
        const inv = invoice as unknown as { quotation?: { id: string } | null }
        return inv.quotation ? (
          <div className="text-sm text-zinc-500">
            Converted from{' '}
            <Link href={`/quotations/${inv.quotation.id}`} className="text-blue-600 hover:underline dark:text-blue-400">
              Quotation #{inv.quotation.id.slice(0, 8).toUpperCase()}
            </Link>
          </div>
        ) : null
      })()}
    </div>
  )
}
