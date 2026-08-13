import Link from 'next/link'
import Image from 'next/image'
import { Package } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { SalesChart } from '@/components/analytics/sales-chart'
import { CategoryPie } from '@/components/analytics/category-pie'
import { LeaderboardTable } from '@/components/analytics/leaderboard-table'
import { LeadSourceChart } from '@/components/analytics/lead-source-chart'
import { getRevenueByCategory, getCurrentProfile } from '@/lib/actions/dashboard'
import {
  getSalesTrendForRange,
  getLeaderboard,
  getLeadSourceBreakdown,
  getInventoryStats,
} from '@/lib/actions/analytics'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Category colours
// ---------------------------------------------------------------------------
const CATEGORY_COLORS: Record<string, string> = {
  'Living Room': '#0ea5e9',
  Bedroom:       '#3b82f6',
  Dining:        '#f59e0b',
  Office:        '#8b5cf6',
  Outdoor:       '#06b6d4',
  Storage:       '#ec4899',
  Decor:         '#f97316',
  Uncategorized: '#a1a1aa',
}

const SOURCE_COLORS = [
  '#1D4ED8', '#0ea5e9', '#f59e0b', '#8b5cf6',
  '#06b6d4', '#ec4899', '#f97316', '#a1a1aa',
]

// ---------------------------------------------------------------------------
// Parse range from searchParams
// ---------------------------------------------------------------------------
function parseRange(raw: string | string[] | undefined): number {
  const val = Array.isArray(raw) ? raw[0] : raw
  const map: Record<string, number> = {
    '7d': 7,
    '30d': 30,
    '90d': 90,
    'month': 30,
  }
  return map[val ?? ''] ?? 30
}

function rangeLabel(days: number): string {
  if (days === 7) return 'Last 7 Days'
  if (days === 30) return 'Last 30 Days'
  if (days === 90) return 'Last 90 Days'
  return `Last ${days} Days`
}

// ---------------------------------------------------------------------------
// DateRangeTabs — server-rendered links (no client JS needed)
// ---------------------------------------------------------------------------
function DateRangeTabs({ current }: { current: string }) {
  const options = [
    { label: '7 Days', value: '7d' },
    { label: '30 Days', value: '30d' },
    { label: '90 Days', value: '90d' },
    { label: 'This Month', value: 'month' },
  ]
  const effective = current || '30d'

  return (
    <div className="flex items-center gap-1 bg-zinc-100 rounded-xl p-1 flex-wrap">
      {options.map((opt) => {
        const isActive = effective === opt.value
        return (
          <Link
            key={opt.value}
            href={`/analytics?range=${opt.value}`}
            className={
              isActive
                ? 'px-4 py-2 text-sm font-medium text-zinc-900 bg-white rounded-lg shadow-sm border border-zinc-200'
                : 'px-4 py-2 text-sm font-medium text-zinc-500 hover:text-zinc-700 rounded-lg transition-colors'
            }
          >
            {opt.label}
          </Link>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Inventory section (server component)
// ---------------------------------------------------------------------------
function InventorySection({
  distribution,
  lowStock,
}: {
  distribution: { status: string; count: number }[]
  lowStock: Array<{
    id: string
    name: string
    sku: string
    stock: number
    reorder_level: number
    category: string | null
    image_url: string | null
  }>
}) {
  const STATUS_COLORS: Record<string, string> = {
    'In Stock':    '#10b981',
    'Low Stock':   '#f59e0b',
    'Out of Stock': '#ef4444',
  }
  const total = distribution.reduce((s, d) => s + d.count, 0)

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-zinc-900">Inventory Status</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Distribution */}
        <div className="bg-white rounded-xl border border-zinc-200 p-5">
          <h3 className="text-sm font-semibold text-zinc-900 mb-4">Stock Distribution</h3>
          <div className="space-y-3">
            {distribution.map((d) => {
              const pct = total > 0 ? (d.count / total) * 100 : 0
              return (
                <div key={d.status}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ background: STATUS_COLORS[d.status] ?? '#a1a1aa' }}
                      />
                      <span className="text-sm text-zinc-600">{d.status}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-zinc-900 tabular-nums">
                        {d.count}
                      </span>
                      <span className="text-xs text-zinc-400">({pct.toFixed(0)}%)</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        background: STATUS_COLORS[d.status] ?? '#a1a1aa',
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
          <p className="mt-4 text-xs text-zinc-400">{total} total SKUs tracked</p>
        </div>

        {/* Low stock list */}
        <div className="bg-white rounded-xl border border-zinc-200 flex flex-col overflow-hidden">
          <div className="px-5 pt-5 pb-3 flex-shrink-0">
            <h3 className="text-sm font-semibold text-zinc-900">
              Low / Out of Stock{lowStock.length > 0 ? ` (${lowStock.length})` : ''}
            </h3>
          </div>
          <div className="overflow-y-auto max-h-64 flex-1">
            {lowStock.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-zinc-400">
                All products are well-stocked
              </p>
            ) : (
              <table className="w-full text-sm">
                <tbody className="divide-y divide-zinc-50">
                  {lowStock.map((p) => (
                    <tr key={p.id} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="px-5 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-md overflow-hidden bg-zinc-100 flex-shrink-0 flex items-center justify-center border border-zinc-100">
                            {p.image_url ? (
                              <Image
                                src={p.image_url}
                                alt={p.name}
                                width={32}
                                height={32}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Package className="w-3.5 h-3.5 text-zinc-300" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-zinc-900 leading-tight truncate max-w-[120px]">
                              {p.name}
                            </p>
                            <p className="text-xs text-zinc-400">{p.sku}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-2.5 text-right">
                        <span
                          className={
                            p.stock <= 0
                              ? 'text-xs font-bold text-red-600'
                              : 'text-xs font-bold text-amber-600'
                          }
                        >
                          {p.stock <= 0 ? 'Out of Stock' : `${p.stock} left`}
                        </span>
                        <p className="text-xs text-zinc-400">Reorder at {p.reorder_level}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Best sellers table (top 10) — fetched inline
// ---------------------------------------------------------------------------
async function BestSellersSection() {
  const db = await createClient()
  const { data: products } = await db
    .from('products')
    .select('id, name, sku, category, price, sold_count, stock')
    .order('sold_count', { ascending: false })
    .limit(10)

  return (
    <div className="bg-white rounded-xl border border-zinc-200">
      <div className="px-5 pt-5 pb-3">
        <h3 className="text-sm font-semibold text-zinc-900">Top 10 Best Sellers</h3>
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
              <th className="text-right px-5 py-2 text-xs font-medium text-zinc-400">Sold</th>
              <th className="text-right px-5 py-2 text-xs font-medium text-zinc-400 hidden md:table-cell">
                Stock
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50">
            {(products ?? []).map((p, idx) => (
              <tr key={p.id} className="hover:bg-zinc-50/50 transition-colors">
                <td className="px-5 py-3 text-xs font-bold text-zinc-400 tabular-nums">
                  {String(idx + 1).padStart(2, '0')}
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg overflow-hidden bg-zinc-100 flex-shrink-0 flex items-center justify-center border border-zinc-100">
                      {p.image_url ? (
                        <Image
                          src={p.image_url}
                          alt={p.name}
                          width={36}
                          height={36}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Package className="w-4 h-4 text-zinc-300" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-900">{p.name}</p>
                      <p className="text-xs text-zinc-400">{p.sku}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3 hidden sm:table-cell text-sm text-zinc-500">
                  {p.category ?? '—'}
                </td>
                <td className="px-5 py-3 text-right text-sm font-semibold text-zinc-900 tabular-nums">
                  {formatCurrency(p.price)}
                </td>
                <td className="px-5 py-3 text-right text-sm font-bold text-blue-600 tabular-nums">
                  {p.sold_count}
                </td>
                <td className="px-5 py-3 text-right hidden md:table-cell text-sm text-zinc-600 tabular-nums">
                  {p.stock}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!products || products.length === 0) && (
          <p className="px-5 py-8 text-center text-sm text-zinc-400">No product data</p>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams
  const rangeKey = Array.isArray(params.range) ? params.range[0] : (params.range ?? '')
  const rangeDays = parseRange(rangeKey)

  // Parallel data fetch
  const [
    profileResult,
    salesTrendResult,
    categoryResult,
    leaderboardResult,
    sourceResult,
    inventoryResult,
  ] = await Promise.all([
    getCurrentProfile(),
    getSalesTrendForRange(rangeDays),
    getRevenueByCategory(),
    getLeaderboard(rangeDays),
    getLeadSourceBreakdown(rangeDays),
    getInventoryStats(),
  ])

  const profile = profileResult.data
  const salesTrend = salesTrendResult.data
  const categoryRevenue = categoryResult.data
  const leaderboard = leaderboardResult.data
  const leadSources = sourceResult.data
  const inventory = inventoryResult.data

  const pieData = categoryRevenue.map((c) => ({
    category: c.category,
    revenue: c.revenue,
    fill: CATEGORY_COLORS[c.category] ?? '#a1a1aa',
  }))

  const sourceChartData = leadSources.map((s, i) => ({
    source: s.source,
    count: s.count,
    fill: SOURCE_COLORS[i % SOURCE_COLORS.length],
  }))

  const showLeaderboard = profile?.role !== 'salesperson'

  return (
    <div className="space-y-6">
      {/* Header + date range */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <PageHeader
          title="Analytics"
          description={`Showing data for ${rangeLabel(rangeDays).toLowerCase()}`}
        />
        <DateRangeTabs current={rangeKey} />
      </div>

      {/* Full-width sales trend */}
      <SalesChart
        data={salesTrend.map((d) => ({ date: d.date, revenue: d.revenue }))}
        title={`Sales Trend — ${rangeLabel(rangeDays)}`}
        height={260}
      />

      {/* Revenue by category + Lead source breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CategoryPie data={pieData} />
        <div className="bg-white rounded-xl border border-zinc-200 p-5">
          <h3 className="text-sm font-semibold text-zinc-900 mb-4">Lead Source Breakdown</h3>
          <LeadSourceChart data={sourceChartData} />
        </div>
      </div>

      {/* Leaderboard — manager/admin only */}
      {showLeaderboard && (
        <div className="bg-white rounded-xl border border-zinc-200">
          <div className="px-5 pt-5 pb-3">
            <h2 className="text-sm font-semibold text-zinc-900">Sales Leaderboard</h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Performance for {rangeLabel(rangeDays).toLowerCase()}
            </p>
          </div>
          <div className="px-5 pb-5">
            <LeaderboardTable entries={leaderboard} type="salesperson" />
          </div>
        </div>
      )}

      {/* Inventory section */}
      {inventory && (
        <InventorySection
          distribution={inventory.distribution}
          lowStock={inventory.lowStock}
        />
      )}

      {/* Best sellers */}
      <BestSellersSection />
    </div>
  )
}
