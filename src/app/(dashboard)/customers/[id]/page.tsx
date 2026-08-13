import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Phone,
  Mail,
  MapPin,
  User,
  Calendar,
  ShoppingBag,
  TrendingUp,
  BarChart3,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/shared/page-header'
import { PaymentBadge } from '@/components/shared/status-badge'
import { formatCurrency, formatDate, getInitials } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { CustomerAdminActions } from '@/components/customers/customer-admin-actions'
import type { Customer, Invoice, Lead, Profile } from '@/lib/types/database'

interface CustomerDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function CustomerDetailPage({
  params,
}: CustomerDetailPageProps) {
  const { id } = await params

  const supabase = await createClient()

  // ── Auth ──────────────────────────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profileData } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const profile = profileData as Profile | null
  if (!profile) redirect('/login')

  // ── Fetch customer ────────────────────────────────────────────────────────
  const { data: customerData, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !customerData) notFound()
  const customer = customerData as Customer

  // ── Fetch invoices ────────────────────────────────────────────────────────
  const { data: invoicesData } = await supabase
    .from('invoices')
    .select(`
      id,
      invoice_no,
      invoice_date,
      grand_total,
      payment_status,
      created_at
    `)
    .eq('customer_id', id)
    .order('invoice_date', { ascending: false })

  const invoices = (invoicesData ?? []) as Pick<
    Invoice,
    'id' | 'invoice_no' | 'invoice_date' | 'grand_total' | 'payment_status' | 'created_at'
  >[]

  // ── Fetch invoice items for product summary ───────────────────────────────
  const invoiceIds = invoices.map(i => i.id)
  let productsByInvoice: Record<string, string[]> = {}

  if (invoiceIds.length > 0) {
    const { data: itemsData } = await supabase
      .from('invoice_items')
      .select('invoice_id, name')
      .in('invoice_id', invoiceIds)

    ;(itemsData ?? []).forEach((item: { invoice_id: string; name: string | null }) => {
      if (!item.invoice_id) return
      if (!productsByInvoice[item.invoice_id]) {
        productsByInvoice[item.invoice_id] = []
      }
      if (item.name) {
        productsByInvoice[item.invoice_id].push(item.name)
      }
    })
  }

  // ── Fetch salesperson ─────────────────────────────────────────────────────
  let salesperson: Profile | null = null
  if (customer.salesperson_id) {
    const { data: spData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', customer.salesperson_id)
      .single()
    salesperson = spData as Profile | null
  }

  // ── Fetch original lead ───────────────────────────────────────────────────
  let lead: Lead | null = null
  if (customer.lead_id) {
    const { data: leadData } = await supabase
      .from('leads')
      .select('*')
      .eq('id', customer.lead_id)
      .single()
    lead = leadData as Lead | null
  }

  // ── Compute stats ─────────────────────────────────────────────────────────
  const ordersCount = invoices.length
  const totalSpent = customer.total_spent ?? 0
  const avgOrderValue = ordersCount > 0 ? totalSpent / ordersCount : 0

  // ── Demographic ───────────────────────────────────────────────────────────
  const demo = customer.demographic ?? {}
  const hasDemographics = Object.values(demo).some(
    v => v != null && v !== '',
  )

  // ── Interested categories (from original lead) ────────────────────────────
  const interestedCategories = lead?.interested_categories ?? []

  // ── Helpers ───────────────────────────────────────────────────────────────
  function InfoRow({
    icon: Icon,
    label,
    value,
  }: {
    icon: React.ElementType
    label: string
    value: React.ReactNode
  }) {
    return (
      <div className="flex items-start gap-3 py-2 border-b border-zinc-100 last:border-0">
        <Icon className="w-4 h-4 text-zinc-400 mt-0.5 flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-xs text-zinc-500 mb-0.5">{label}</p>
          <div className="text-sm text-zinc-900 break-words">{value}</div>
        </div>
      </div>
    )
  }

  function StatCard({
    icon: Icon,
    title,
    value,
    accent,
  }: {
    icon: React.ElementType
    title: string
    value: string
    accent: string
  }) {
    return (
      <div className="bg-white rounded-xl border border-zinc-200 p-4 flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${accent}`}
        >
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs text-zinc-500">{title}</p>
          <p className="text-lg font-bold text-zinc-900 tabular-nums leading-tight">
            {value}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-screen-xl mx-auto">
      {/* ── Page Header ───────────────────────────────────────────────────── */}
      <PageHeader
        title={customer.name}
        breadcrumb={[
          { label: 'Customers', href: '/customers' },
          { label: customer.name },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {customer.customer_number && (
              <span className="inline-flex items-center px-2.5 py-1 text-xs font-mono font-semibold text-zinc-600 bg-zinc-100 rounded-lg border border-zinc-200">
                {customer.customer_number}
              </span>
            )}
            {profile.role === 'admin' && (
              <CustomerAdminActions customer={customer} />
            )}
          </div>
        }
      />

      {/* ── Stats row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard
          icon={TrendingUp}
          title="Total Spent"
          value={formatCurrency(totalSpent)}
          accent="bg-emerald-50 text-emerald-600"
        />
        <StatCard
          icon={ShoppingBag}
          title="Total Orders"
          value={ordersCount.toLocaleString('en-IN')}
          accent="bg-blue-50 text-blue-600"
        />
        <StatCard
          icon={BarChart3}
          title="Avg. Order Value"
          value={ordersCount > 0 ? formatCurrency(Math.round(avgOrderValue)) : '—'}
          accent="bg-violet-50 text-violet-600"
        />
      </div>

      {/* ── Two-column layout ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left: Info + Purchase History ──────────────────────────────── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Contact Info Card */}
          <div className="bg-white rounded-xl border border-zinc-200">
            <div className="px-4 py-3 border-b border-zinc-200">
              <p className="text-sm font-semibold text-zinc-800">
                Customer Information
              </p>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6">
              <InfoRow icon={User} label="Name" value={customer.name} />
              {customer.phone && (
                <InfoRow
                  icon={Phone}
                  label="Phone"
                  value={
                    <a
                      href={`tel:${customer.phone}`}
                      className="text-blue-700 hover:underline"
                    >
                      {customer.phone}
                    </a>
                  }
                />
              )}
              {customer.email && (
                <InfoRow
                  icon={Mail}
                  label="Email"
                  value={
                    <a
                      href={`mailto:${customer.email}`}
                      className="text-blue-700 hover:underline truncate block"
                    >
                      {customer.email}
                    </a>
                  }
                />
              )}
              {(customer.city || customer.state) && (
                <InfoRow
                  icon={MapPin}
                  label="Location"
                  value={[customer.city, customer.state]
                    .filter(Boolean)
                    .join(', ')}
                />
              )}
              {customer.address && (
                <InfoRow
                  icon={MapPin}
                  label="Address"
                  value={customer.address}
                />
              )}
              {salesperson && (
                <InfoRow
                  icon={User}
                  label="Salesperson"
                  value={
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold flex items-center justify-center">
                        {getInitials(salesperson.name)}
                      </div>
                      <span>
                        {salesperson.name ?? salesperson.email}
                      </span>
                    </div>
                  }
                />
              )}
              <InfoRow
                icon={Calendar}
                label="Member Since"
                value={formatDate(customer.created_at)}
              />
            </div>

            {/* Demographics */}
            {hasDemographics && (
              <div className="px-4 pb-4 border-t border-zinc-100 pt-3">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
                  Customer Profile
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {demo.age_group && (
                    <div>
                      <p className="text-xs text-zinc-500 mb-0.5">Age Group</p>
                      <p className="text-sm font-medium text-zinc-900">
                        {demo.age_group}
                      </p>
                    </div>
                  )}
                  {demo.gender && (
                    <div>
                      <p className="text-xs text-zinc-500 mb-0.5">Gender</p>
                      <p className="text-sm font-medium text-zinc-900">
                        {demo.gender}
                      </p>
                    </div>
                  )}
                  {demo.occupation && (
                    <div>
                      <p className="text-xs text-zinc-500 mb-0.5">Occupation</p>
                      <p className="text-sm font-medium text-zinc-900">
                        {demo.occupation}
                      </p>
                    </div>
                  )}
                  {demo.income && (
                    <div>
                      <p className="text-xs text-zinc-500 mb-0.5">Income</p>
                      <p className="text-sm font-medium text-zinc-900">
                        {demo.income}
                      </p>
                    </div>
                  )}
                  {demo.home_type && (
                    <div>
                      <p className="text-xs text-zinc-500 mb-0.5">Home Type</p>
                      <p className="text-sm font-medium text-zinc-900">
                        {demo.home_type}
                      </p>
                    </div>
                  )}
                  {demo.family_size != null && (
                    <div>
                      <p className="text-xs text-zinc-500 mb-0.5">
                        Family Size
                      </p>
                      <p className="text-sm font-medium text-zinc-900">
                        {demo.family_size}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Purchase History */}
          <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-200">
              <p className="text-sm font-semibold text-zinc-800">
                Purchase History
              </p>
            </div>

            {invoices.length === 0 ? (
              <div className="py-12 text-center">
                <ShoppingBag className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                <p className="text-sm text-zinc-500">No purchases yet</p>
              </div>
            ) : (
              <>
                {/* Table header */}
                <div className="hidden sm:grid grid-cols-[auto_1fr_2fr_1fr_auto] items-center gap-4 px-4 py-2.5 bg-zinc-50 border-b border-zinc-200">
                  {['Invoice #', 'Date', 'Products', 'Amount', 'Status'].map(
                    col => (
                      <span
                        key={col}
                        className="text-xs font-semibold text-zinc-500 uppercase tracking-wider"
                      >
                        {col}
                      </span>
                    ),
                  )}
                </div>

                <div className="divide-y divide-zinc-100">
                  {invoices.map(invoice => {
                    const products = productsByInvoice[invoice.id] ?? []
                    const productSummary =
                      products.length > 0
                        ? products.slice(0, 2).join(', ') +
                          (products.length > 2
                            ? ` +${products.length - 2} more`
                            : '')
                        : '—'

                    return (
                      <Link
                        key={invoice.id}
                        href={`/invoices/${invoice.id}`}
                        className="grid grid-cols-1 sm:grid-cols-[auto_1fr_2fr_1fr_auto] items-center gap-3 sm:gap-4 px-4 py-3.5 hover:bg-zinc-50 transition-colors"
                      >
                        {/* Invoice number */}
                        <div>
                          <span className="text-xs font-mono font-semibold text-blue-700">
                            {invoice.invoice_no}
                          </span>
                        </div>

                        {/* Date */}
                        <div className="hidden sm:block">
                          <span className="text-sm text-zinc-600">
                            {formatDate(invoice.invoice_date)}
                          </span>
                        </div>

                        {/* Products */}
                        <div>
                          <p className="text-sm text-zinc-700 truncate">
                            {productSummary}
                          </p>
                          {/* Mobile: show date inline */}
                          <p className="text-xs text-zinc-400 mt-0.5 sm:hidden">
                            {formatDate(invoice.invoice_date)}
                          </p>
                        </div>

                        {/* Amount */}
                        <div>
                          <span className="text-sm font-semibold text-zinc-900 tabular-nums">
                            {invoice.grand_total != null
                              ? formatCurrency(invoice.grand_total)
                              : '—'}
                          </span>
                        </div>

                        {/* Payment Status */}
                        <div>
                          <PaymentBadge status={invoice.payment_status} />
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Right column: Interested categories + lead link ─────────────── */}
        <div className="space-y-5">

          {/* Interested Categories (from original lead) */}
          {interestedCategories.length > 0 && (
            <div className="bg-white rounded-xl border border-zinc-200 p-4">
              <p className="text-sm font-semibold text-zinc-800 mb-3">
                Interested Categories
              </p>
              <div className="flex flex-wrap gap-2">
                {interestedCategories.map(cat => (
                  <span
                    key={cat}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-50 text-blue-700 border border-blue-200"
                  >
                    {cat}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Original lead link */}
          {lead && (
            <div className="bg-white rounded-xl border border-zinc-200 p-4">
              <p className="text-sm font-semibold text-zinc-800 mb-2">
                Original Lead
              </p>
              <Link
                href={`/leads/${lead.id}`}
                className="flex items-center gap-3 p-3 rounded-lg border border-zinc-200 hover:bg-zinc-50 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-zinc-100 text-zinc-600 text-sm font-bold flex items-center justify-center flex-shrink-0">
                  {getInitials(lead.name)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-900 truncate">
                    {lead.name}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {lead.source ?? 'Unknown source'} ·{' '}
                    {formatDate(lead.created_at)}
                  </p>
                </div>
              </Link>
            </div>
          )}

          {/* Customer number card */}
          <div className="bg-white rounded-xl border border-zinc-200 p-4">
            <p className="text-xs text-zinc-500 mb-2">Customer Number</p>
            <p className="text-lg font-mono font-bold text-zinc-900">
              {customer.customer_number ?? '—'}
            </p>
            <p className="text-xs text-zinc-400 mt-1">
              Member since {formatDate(customer.created_at)}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
