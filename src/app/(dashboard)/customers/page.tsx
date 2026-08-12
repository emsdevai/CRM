import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Search, Eye, Users, TrendingUp, BarChart3 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Customer, Profile } from '@/lib/types/database'

interface CustomersPageProps {
  searchParams: Promise<{
    q?: string
    page?: string
  }>
}

export default async function CustomersPage({
  searchParams,
}: CustomersPageProps) {
  const params = await searchParams
  const searchQuery = params.q ?? ''
  const page = Math.max(1, parseInt(params.page ?? '1', 10))
  const pageSize = 20
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

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

  // ── Scope IDs ─────────────────────────────────────────────────────────────
  let scopeIds: string[] = []
  if (profile.role === 'salesperson') {
    scopeIds = [user.id]
  } else if (profile.role === 'manager') {
    const { data: team } = await supabase
      .from('profiles')
      .select('id')
      .eq('manager_id', user.id)
    scopeIds = [user.id, ...((team ?? []).map((t: { id: string }) => t.id))]
  }

  // ── Stats – fetch all customer spend for accurate totals ──────────────────
  let statsQuery = supabase
    .from('customers')
    .select('total_spent, id')

  if (scopeIds.length > 0) {
    statsQuery = statsQuery.in('salesperson_id', scopeIds)
  }

  const { data: allCustomers } = await statsQuery
  const statsData = (allCustomers ?? []) as Pick<Customer, 'total_spent' | 'id'>[]

  const totalCustomers = statsData.length
  const totalRevenue = statsData.reduce((sum, c) => sum + (c.total_spent ?? 0), 0)
  const avgSpend = totalCustomers > 0 ? totalRevenue / totalCustomers : 0

  // ── Paginated customer list ───────────────────────────────────────────────
  let listQuery = supabase
    .from('customers')
    .select('*')
    .order('created_at', { ascending: false })
    .range(from, to)

  if (scopeIds.length > 0) {
    listQuery = listQuery.in('salesperson_id', scopeIds)
  }
  if (searchQuery) {
    listQuery = listQuery.or(
      `name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`,
    )
  }

  const { data: customersData } = await listQuery
  const customers = (customersData ?? []) as Customer[]

  // ── Order count per customer ──────────────────────────────────────────────
  // Fetch invoice counts for these customers in one query
  const customerIds = customers.map(c => c.id)
  let orderCounts: Record<string, number> = {}

  if (customerIds.length > 0) {
    const { data: invoiceData } = await supabase
      .from('invoices')
      .select('customer_id')
      .in('customer_id', customerIds)

    orderCounts = (invoiceData ?? []).reduce<Record<string, number>>(
      (acc, inv) => {
        if (inv.customer_id) {
          acc[inv.customer_id] = (acc[inv.customer_id] ?? 0) + 1
        }
        return acc
      },
      {},
    )
  }

  // ── Stat card helper ──────────────────────────────────────────────────────
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
      <div className="bg-white rounded-xl border border-zinc-200 p-4 flex items-center gap-4">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${accent}`}
        >
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs text-zinc-500 mb-0.5">{title}</p>
          <p className="text-xl font-bold text-zinc-900 tabular-nums leading-none">
            {value}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-screen-xl mx-auto">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <PageHeader
        title="Customers"
        description="Customers are created automatically when a lead is marked as Won."
      />

      {/* ── Stats row ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard
          icon={Users}
          title="Total Customers"
          value={totalCustomers.toLocaleString('en-IN')}
          accent="bg-blue-50 text-blue-600"
        />
        <StatCard
          icon={TrendingUp}
          title="Total Revenue"
          value={formatCurrency(totalRevenue)}
          accent="bg-emerald-50 text-emerald-600"
        />
        <StatCard
          icon={BarChart3}
          title="Avg. Spend"
          value={totalCustomers > 0 ? formatCurrency(Math.round(avgSpend)) : '—'}
          accent="bg-violet-50 text-violet-600"
        />
      </div>

      {/* ── Search bar ─────────────────────────────────────────────────────── */}
      <div className="mb-4">
        <form method="GET" action="/customers" className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
          <input
            type="text"
            name="q"
            defaultValue={searchQuery}
            placeholder="Search customers…"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-zinc-300 text-sm text-zinc-900 bg-white outline-none focus:ring-2 focus:ring-green-700/25 focus:border-green-700 transition-shadow"
          />
        </form>
      </div>

      {/* ── Customer Table ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        {/* Header */}
        <div className="hidden sm:grid grid-cols-[auto_2fr_1fr_1fr_auto_auto_auto] items-center gap-4 px-4 py-2.5 bg-zinc-50 border-b border-zinc-200">
          {[
            'Customer#',
            'Name & Email',
            'City',
            'Total Spent',
            'Orders',
            'Since',
            '',
          ].map((col, i) => (
            <span
              key={i}
              className="text-xs font-semibold text-zinc-500 uppercase tracking-wider"
            >
              {col}
            </span>
          ))}
        </div>

        {customers.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No customers yet"
            description="Customers appear here once a lead is marked as Won."
          />
        ) : (
          <div className="divide-y divide-zinc-100">
            {customers.map(customer => (
              <div
                key={customer.id}
                className="grid grid-cols-1 sm:grid-cols-[auto_2fr_1fr_1fr_auto_auto_auto] items-center gap-3 sm:gap-4 px-4 py-3.5 hover:bg-zinc-50 transition-colors"
              >
                {/* Customer number */}
                <div className="hidden sm:block">
                  <span className="text-xs font-mono font-semibold text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded">
                    {customer.customer_number ?? '—'}
                  </span>
                </div>

                {/* Name + Email */}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-900 truncate">
                    {customer.name}
                    {customer.customer_number && (
                      <span className="ml-2 text-xs font-mono text-zinc-400 sm:hidden">
                        {customer.customer_number}
                      </span>
                    )}
                  </p>
                  {customer.email && (
                    <p className="text-xs text-zinc-500 truncate mt-0.5">
                      {customer.email}
                    </p>
                  )}
                </div>

                {/* City */}
                <div className="hidden sm:block">
                  <span className="text-sm text-zinc-600">
                    {customer.city ?? '—'}
                  </span>
                </div>

                {/* Total Spent */}
                <div>
                  <span className="text-sm font-semibold text-zinc-900 tabular-nums">
                    {formatCurrency(customer.total_spent ?? 0)}
                  </span>
                </div>

                {/* Orders */}
                <div className="hidden sm:block text-center">
                  <span className="text-sm text-zinc-700 tabular-nums">
                    {orderCounts[customer.id] ?? 0}
                  </span>
                </div>

                {/* Since */}
                <div className="hidden sm:block">
                  <span className="text-xs text-zinc-400">
                    {formatDate(customer.created_at)}
                  </span>
                </div>

                {/* View */}
                <div className="flex justify-end">
                  <Link
                    href={`/customers/${customer.id}`}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-zinc-700 bg-white border border-zinc-300 rounded-lg hover:bg-zinc-50 transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    View
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Pagination ─────────────────────────────────────────────────────── */}
      {totalCustomers > pageSize && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-zinc-500">
            Showing {from + 1}–{Math.min(from + pageSize, totalCustomers)} of{' '}
            {totalCustomers} customers
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/customers?${new URLSearchParams({ q: searchQuery, page: String(page - 1) }).toString()}`}
                className="px-3 py-1.5 text-sm font-medium text-zinc-700 bg-white border border-zinc-300 rounded-lg hover:bg-zinc-50 transition-colors"
              >
                Previous
              </Link>
            )}
            {from + pageSize < totalCustomers && (
              <Link
                href={`/customers?${new URLSearchParams({ q: searchQuery, page: String(page + 1) }).toString()}`}
                className="px-3 py-1.5 text-sm font-medium text-zinc-700 bg-white border border-zinc-300 rounded-lg hover:bg-zinc-50 transition-colors"
              >
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
