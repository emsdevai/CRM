import Link from 'next/link'
import {
  TrendingUp,
  Target,
  BarChart3,
  ArrowUpRight,
  ArrowRight,
  Package,
} from 'lucide-react'
import { StatCard } from '@/components/shared/stat-card'
import { SalesChart } from '@/components/analytics/sales-chart'
import { CategoryPie } from '@/components/analytics/category-pie'
import { PendingApprovalsBanner } from '@/components/shared/pending-approvals-banner'
import { PageHeader } from '@/components/shared/page-header'
import { StageBadge, PaymentBadge } from '@/components/shared/status-badge'
import {
  getDashboardKPIs,
  getRecentLeads,
  getRecentInvoices,
  getBestSellers,
  getSalesTrend,
  getRevenueByCategory,
  getCurrentProfile,
} from '@/lib/actions/dashboard'
import { getPendingApprovalsCount } from '@/lib/actions/analytics'
import { formatCurrency, formatDate, formatRelativeTime, getInitials } from '@/lib/utils'
import type { Lead, Invoice, Profile, Product } from '@/lib/types/database'

// ---------------------------------------------------------------------------
// Category fill colours matching FURNITURE_CATEGORIES
// ---------------------------------------------------------------------------
const CATEGORY_COLORS: Record<string, string> = {
  'Living Room': '#10b981',
  Bedroom:       '#3b82f6',
  Dining:        '#f59e0b',
  Office:        '#8b5cf6',
  Outdoor:       '#06b6d4',
  Storage:       '#ec4899',
  Decor:         '#f97316',
  Uncategorized: '#a1a1aa',
}

// ---------------------------------------------------------------------------
// Time-aware greeting
// ---------------------------------------------------------------------------
function getGreeting(name: string | null): string {
  const hour = new Date().getHours()
  const first = name?.split(' ')[0] ?? 'there'
  if (hour < 12) return `Good morning, ${first}`
  if (hour < 17) return `Good afternoon, ${first}`
  return `Good evening, ${first}`
}

// ---------------------------------------------------------------------------
// Recent Leads Table
// ---------------------------------------------------------------------------
function RecentLeadsTable({
  leads,
}: {
  leads: (Lead & { assignee: Profile | null })[]
}) {
  return (
    <div className="bg-white rounded-xl border border-zinc-200 flex flex-col">
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <h3 className="text-sm font-semibold text-zinc-900">Recent Leads</h3>
        <Link
          href="/leads"
          className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 font-medium"
        >
          View All <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100">
              <th className="text-left px-5 py-2 text-xs font-medium text-zinc-400">Name</th>
              <th className="text-left px-5 py-2 text-xs font-medium text-zinc-400 hidden sm:table-cell">Source</th>
              <th className="text-left px-5 py-2 text-xs font-medium text-zinc-400">Stage</th>
              <th className="text-right px-5 py-2 text-xs font-medium text-zinc-400 hidden md:table-cell">
                Added
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50">
            {leads.slice(0, 8).map((lead) => (
              <tr key={lead.id} className="hover:bg-zinc-50/50 transition-colors">
                <td className="px-5 py-2.5">
                  <div>
                    <Link
                      href={`/leads/${lead.id}`}
                      className="text-sm font-medium text-zinc-900 hover:text-green-600 transition-colors"
                    >
                      {lead.name}
                    </Link>
                    <p className="text-xs text-zinc-400">{lead.phone}</p>
                  </div>
                </td>
                <td className="px-5 py-2.5 hidden sm:table-cell">
                  <span className="text-xs text-zinc-500">{lead.source ?? '—'}</span>
                </td>
                <td className="px-5 py-2.5">
                  <StageBadge stage={lead.stage} />
                </td>
                <td className="px-5 py-2.5 text-right hidden md:table-cell">
                  <span className="text-xs text-zinc-400">
                    {formatRelativeTime(lead.created_at)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {leads.length === 0 && (
          <p className="px-5 py-8 text-center text-sm text-zinc-400">No leads yet</p>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Recent Invoices Table
// ---------------------------------------------------------------------------
function RecentInvoicesTable({
  invoices,
}: {
  invoices: (Invoice & { customer: { name: string; phone: string | null } | null })[]
}) {
  return (
    <div className="bg-white rounded-xl border border-zinc-200 flex flex-col">
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <h3 className="text-sm font-semibold text-zinc-900">Recent Invoices</h3>
        <Link
          href="/invoices"
          className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 font-medium"
        >
          View All <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100">
              <th className="text-left px-5 py-2 text-xs font-medium text-zinc-400">Invoice</th>
              <th className="text-left px-5 py-2 text-xs font-medium text-zinc-400 hidden sm:table-cell">
                Customer
              </th>
              <th className="text-right px-5 py-2 text-xs font-medium text-zinc-400">Amount</th>
              <th className="text-left px-5 py-2 text-xs font-medium text-zinc-400">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50">
            {invoices.slice(0, 8).map((inv) => (
              <tr key={inv.id} className="hover:bg-zinc-50/50 transition-colors">
                <td className="px-5 py-2.5">
                  <Link
                    href={`/invoices/${inv.id}`}
                    className="text-sm font-medium text-zinc-900 hover:text-green-600 transition-colors"
                  >
                    {inv.invoice_no}
                  </Link>
                  <p className="text-xs text-zinc-400">{formatDate(inv.invoice_date)}</p>
                </td>
                <td className="px-5 py-2.5 hidden sm:table-cell">
                  <span className="text-sm text-zinc-600">{inv.customer?.name ?? '—'}</span>
                </td>
                <td className="px-5 py-2.5 text-right">
                  <span className="text-sm font-semibold text-zinc-900 tabular-nums">
                    {formatCurrency(inv.grand_total ?? 0)}
                  </span>
                </td>
                <td className="px-5 py-2.5">
                  <PaymentBadge status={inv.payment_status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {invoices.length === 0 && (
          <p className="px-5 py-8 text-center text-sm text-zinc-400">No invoices yet</p>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Best Sellers Table
// ---------------------------------------------------------------------------
function BestSellersTable({ products }: { products: Product[] }) {
  return (
    <div className="bg-white rounded-xl border border-zinc-200">
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <h3 className="text-sm font-semibold text-zinc-900">Best Sellers</h3>
        <Link
          href="/inventory"
          className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 font-medium"
        >
          View Inventory <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100">
              <th className="text-left px-5 py-2 text-xs font-medium text-zinc-400">#</th>
              <th className="text-left px-5 py-2 text-xs font-medium text-zinc-400">Product</th>
              <th className="text-left px-5 py-2 text-xs font-medium text-zinc-400 hidden sm:table-cell">
                Category
              </th>
              <th className="text-right px-5 py-2 text-xs font-medium text-zinc-400">Price</th>
              <th className="text-right px-5 py-2 text-xs font-medium text-zinc-400">Units Sold</th>
              <th className="text-right px-5 py-2 text-xs font-medium text-zinc-400 hidden md:table-cell">
                Stock
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50">
            {products.map((product, idx) => (
              <tr key={product.id} className="hover:bg-zinc-50/50 transition-colors">
                <td className="px-5 py-3">
                  <span className="text-xs font-bold text-zinc-400 tabular-nums">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Package className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-900 leading-tight">
                        {product.name}
                      </p>
                      <p className="text-xs text-zinc-400">{product.sku}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3 hidden sm:table-cell">
                  <span className="text-sm text-zinc-500">{product.category ?? '—'}</span>
                </td>
                <td className="px-5 py-3 text-right">
                  <span className="text-sm font-semibold text-zinc-900 tabular-nums">
                    {formatCurrency(product.price)}
                  </span>
                </td>
                <td className="px-5 py-3 text-right">
                  <span className="text-sm font-bold text-green-600 tabular-nums">
                    {product.sold_count}
                  </span>
                </td>
                <td className="px-5 py-3 text-right hidden md:table-cell">
                  <span
                    className={
                      product.stock <= 0
                        ? 'text-red-600 font-medium text-sm tabular-nums'
                        : product.stock <= product.reorder_level
                          ? 'text-amber-600 font-medium text-sm tabular-nums'
                          : 'text-zinc-600 text-sm tabular-nums'
                    }
                  >
                    {product.stock}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {products.length === 0 && (
          <p className="px-5 py-8 text-center text-sm text-zinc-400">No products yet</p>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default async function DashboardPage() {
  // Fetch all data in parallel
  const [
    profileResult,
    kpiResult,
    salesTrendResult,
    categoryResult,
    recentLeadsResult,
    recentInvoicesResult,
    bestSellersResult,
    pendingApprovalsResult,
  ] = await Promise.all([
    getCurrentProfile(),
    getDashboardKPIs(),
    getSalesTrend(),
    getRevenueByCategory(),
    getRecentLeads(),
    getRecentInvoices(),
    getBestSellers(),
    getPendingApprovalsCount(),
  ])

  const profile = profileResult.data
  const kpis = kpiResult.data
  const salesTrend = salesTrendResult.data
  const categoryRevenue = categoryResult.data
  const recentLeads = recentLeadsResult.data
  const recentInvoices = recentInvoicesResult.data
  const bestSellers = bestSellersResult.data
  const pendingCount = pendingApprovalsResult.data

  // Format KPIs
  const totalRevenueFormatted = formatCurrency(kpis?.total_revenue ?? 0)
  const avgDealSizeFormatted = formatCurrency(kpis?.avg_deal_size ?? 0)

  // Prepare chart data
  const salesChartData = salesTrend.map((d) => ({
    date: d.date,
    revenue: d.revenue,
  }))

  const pieData = categoryRevenue.map((c) => ({
    category: c.category,
    revenue: c.revenue,
    fill: CATEGORY_COLORS[c.category] ?? '#a1a1aa',
  }))

  // Date string
  const todayStr = new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date())

  const showApprovalsBanner =
    pendingCount > 0 && profile?.role !== 'salesperson'

  return (
    <div className="space-y-5">
      {/* Page header */}
      <PageHeader
        title={getGreeting(profile?.name ?? null)}
        description={todayStr}
      />

      {/* Pending approvals banner */}
      {showApprovalsBanner && (
        <PendingApprovalsBanner count={pendingCount} />
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Revenue"
          value={totalRevenueFormatted}
          change={kpis?.revenue_change_pct}
          icon={TrendingUp}
        />
        <StatCard
          title="Active Leads"
          value={String(kpis?.active_leads ?? 0)}
          change={kpis?.leads_change_pct}
          icon={Target}
        />
        <StatCard
          title="Avg Deal Size"
          value={avgDealSizeFormatted}
          icon={BarChart3}
        />
        <StatCard
          title="Conversion Rate"
          value={`${kpis?.conversion_rate ?? 0}%`}
          icon={ArrowUpRight}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <SalesChart data={salesChartData} title="Sales Trend — Last 30 Days" />
        </div>
        <CategoryPie data={pieData} />
      </div>

      {/* Recent tables row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RecentLeadsTable leads={recentLeads} />
        <RecentInvoicesTable invoices={recentInvoices} />
      </div>

      {/* Best sellers */}
      <BestSellersTable products={bestSellers} />
    </div>
  )
}
