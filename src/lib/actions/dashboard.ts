'use server'

import { createClient } from '@/lib/supabase/server'
import type {
  DashboardKPIs,
  Profile,
  Lead,
  Invoice,
  Product,
  CategoryRevenue,
} from '@/lib/types/database'

// ---------------------------------------------------------------------------
// Helper: get current user + profile
// ---------------------------------------------------------------------------
async function getCurrentUserProfile() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { supabase, user: null, profile: null }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return { supabase, user, profile: profile as Profile | null }
}

// ---------------------------------------------------------------------------
// Helper: build assignee ID list for role-based scoping
// ---------------------------------------------------------------------------
async function getScopedUserIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  profile: Profile,
): Promise<string[]> {
  if (profile.role === 'admin') return []            // empty means "all"

  if (profile.role === 'manager') {
    const { data: teamMembers } = await supabase
      .from('profiles')
      .select('id')
      .eq('manager_id', profile.id)

    const ids = (teamMembers ?? []).map((m: { id: string }) => m.id)
    return [profile.id, ...ids]
  }

  // salesperson
  return [profile.id]
}

// ---------------------------------------------------------------------------
// getCurrentProfile
// ---------------------------------------------------------------------------
export async function getCurrentProfile(): Promise<{
  data: Profile | null
  error: string | null
}> {
  try {
    const { supabase, user, profile } = await getCurrentUserProfile()
    if (!user) return { data: null, error: 'Not authenticated' }
    if (!profile) return { data: null, error: 'Profile not found' }
    return { data: profile, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ---------------------------------------------------------------------------
// getDashboardKPIs
// ---------------------------------------------------------------------------
export async function getDashboardKPIs(): Promise<{
  data: DashboardKPIs | null
  error: string | null
}> {
  try {
    const { supabase, user, profile } = await getCurrentUserProfile()
    if (!user || !profile) return { data: null, error: 'Not authenticated' }

    const scopedIds = await getScopedUserIds(supabase, profile)
    const isAll = scopedIds.length === 0

    // ---- Revenue (Paid + Partially Paid invoices) ----
    const now = new Date()
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString()

    let invoiceQuery = supabase
      .from('invoices')
      .select('grand_total, payment_status, salesperson_id, invoice_date')
      .in('payment_status', ['Paid', 'Partially Paid'])

    if (!isAll) invoiceQuery = invoiceQuery.in('salesperson_id', scopedIds)

    const { data: invoices, error: invoiceErr } = await invoiceQuery
    if (invoiceErr) return { data: null, error: invoiceErr.message }

    const allInvoices = (invoices ?? []) as Array<{
      grand_total: number
      payment_status: string
      salesperson_id: string | null
      invoice_date: string
    }>

    const totalRevenue = allInvoices.reduce((sum, inv) => sum + (inv.grand_total ?? 0), 0)

    const thisMonthRevenue = allInvoices
      .filter((inv) => inv.invoice_date >= thisMonthStart)
      .reduce((sum, inv) => sum + (inv.grand_total ?? 0), 0)

    const lastMonthRevenue = allInvoices
      .filter((inv) => inv.invoice_date >= lastMonthStart && inv.invoice_date <= lastMonthEnd)
      .reduce((sum, inv) => sum + (inv.grand_total ?? 0), 0)

    const revenueChangePct =
      lastMonthRevenue > 0
        ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
        : thisMonthRevenue > 0 ? 100 : 0

    // ---- Leads ----
    let leadsQuery = supabase
      .from('leads')
      .select('id, stage, created_at, assigned_to', { count: 'exact' })

    if (!isAll) leadsQuery = leadsQuery.in('assigned_to', scopedIds)

    const { data: leads, count: leadsTotal, error: leadsErr } = await leadsQuery
    if (leadsErr) return { data: null, error: leadsErr.message }

    const allLeads = (leads ?? []) as Array<{
      id: string
      stage: string
      created_at: string
      assigned_to: string | null
    }>

    const activeStages = ['New', 'Contacted', 'Qualified', 'Quotation Sent', 'Negotiation']
    const activeLeads = allLeads.filter((l) => activeStages.includes(l.stage)).length
    const wonLeads = allLeads.filter((l) => l.stage === 'Won').length

    const thisMonthLeads = allLeads.filter((l) => l.created_at >= thisMonthStart).length
    const lastMonthLeads = allLeads.filter(
      (l) => l.created_at >= lastMonthStart && l.created_at <= lastMonthEnd,
    ).length

    const leadsChangePct =
      lastMonthLeads > 0
        ? ((thisMonthLeads - lastMonthLeads) / lastMonthLeads) * 100
        : thisMonthLeads > 0 ? 100 : 0

    const conversionRate =
      (leadsTotal ?? 0) > 0 ? (wonLeads / (leadsTotal ?? 1)) * 100 : 0

    // ---- Avg deal size ----
    const wonInvoices = allInvoices.filter((inv) => (inv.grand_total ?? 0) > 0)
    const avgDealSize =
      wonInvoices.length > 0
        ? wonInvoices.reduce((s, inv) => s + inv.grand_total, 0) / wonInvoices.length
        : 0

    // ---- Inventory value (admin-level: all products) ----
    const { data: products } = await supabase
      .from('products')
      .select('price, stock')

    const inventoryValue = (products ?? []).reduce(
      (sum: number, p: { price: number; stock: number }) => sum + p.price * p.stock,
      0,
    )

    const kpis: DashboardKPIs = {
      total_revenue: totalRevenue,
      revenue_change_pct: Math.round(revenueChangePct * 10) / 10,
      total_leads: leadsTotal ?? 0,
      leads_change_pct: Math.round(leadsChangePct * 10) / 10,
      avg_deal_size: Math.round(avgDealSize),
      active_leads: activeLeads,
      inventory_value: inventoryValue,
      conversion_rate: Math.round(conversionRate * 10) / 10,
    }

    return { data: kpis, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ---------------------------------------------------------------------------
// getRecentLeads
// ---------------------------------------------------------------------------
export async function getRecentLeads(): Promise<{
  data: (Lead & { assignee: Profile | null })[]
  error: string | null
}> {
  try {
    const { supabase, user, profile } = await getCurrentUserProfile()
    if (!user || !profile) return { data: [], error: 'Not authenticated' }

    const scopedIds = await getScopedUserIds(supabase, profile)
    const isAll = scopedIds.length === 0

    let query = supabase
      .from('leads')
      .select('*, assignee:profiles!leads_assigned_to_fkey(*)')
      .order('created_at', { ascending: false })
      .limit(10)

    if (!isAll) query = query.in('assigned_to', scopedIds)

    const { data, error } = await query
    if (error) return { data: [], error: error.message }

    return { data: (data ?? []) as (Lead & { assignee: Profile | null })[], error: null }
  } catch (err) {
    return { data: [], error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ---------------------------------------------------------------------------
// getRecentInvoices
// ---------------------------------------------------------------------------
export async function getRecentInvoices(): Promise<{
  data: (Invoice & { customer: { name: string; phone: string | null } | null })[]
  error: string | null
}> {
  try {
    const { supabase, user, profile } = await getCurrentUserProfile()
    if (!user || !profile) return { data: [], error: 'Not authenticated' }

    const scopedIds = await getScopedUserIds(supabase, profile)
    const isAll = scopedIds.length === 0

    let query = supabase
      .from('invoices')
      .select('*, customer:customers(name, phone)')
      .order('created_at', { ascending: false })
      .limit(10)

    if (!isAll) query = query.in('salesperson_id', scopedIds)

    const { data, error } = await query
    if (error) return { data: [], error: error.message }

    return {
      data: (data ?? []) as (Invoice & {
        customer: { name: string; phone: string | null } | null
      })[],
      error: null,
    }
  } catch (err) {
    return { data: [], error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ---------------------------------------------------------------------------
// getBestSellers
// ---------------------------------------------------------------------------
export async function getBestSellers(): Promise<{
  data: Product[]
  error: string | null
}> {
  try {
    const { supabase, user, profile } = await getCurrentUserProfile()
    if (!user || !profile) return { data: [], error: 'Not authenticated' }

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('sold_count', { ascending: false })
      .limit(5)

    if (error) return { data: [], error: error.message }

    // Strip sensitive fields for non-admin roles
    const sanitized = (data ?? []).map((p: Product) => {
      if (profile.role === 'salesperson') {
        const { cost: _cost, margin_pct: _margin, ...rest } = p
        return rest as Product
      }
      return p
    })

    return { data: sanitized, error: null }
  } catch (err) {
    return { data: [], error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ---------------------------------------------------------------------------
// getSalesTrend — daily totals for the last 30 days
// ---------------------------------------------------------------------------
export async function getSalesTrend(): Promise<{
  data: { date: string; revenue: number; count: number }[]
  error: string | null
}> {
  try {
    const { supabase, user, profile } = await getCurrentUserProfile()
    if (!user || !profile) return { data: [], error: 'Not authenticated' }

    const scopedIds = await getScopedUserIds(supabase, profile)
    const isAll = scopedIds.length === 0

    const since = new Date()
    since.setDate(since.getDate() - 30)

    let query = supabase
      .from('invoices')
      .select('invoice_date, grand_total, salesperson_id')
      .in('payment_status', ['Paid', 'Partially Paid'])
      .gte('invoice_date', since.toISOString().slice(0, 10))
      .order('invoice_date', { ascending: true })

    if (!isAll) query = query.in('salesperson_id', scopedIds)

    const { data, error } = await query
    if (error) return { data: [], error: error.message }

    // Aggregate by date
    const grouped: Record<string, { revenue: number; count: number }> = {}
    for (const inv of data ?? []) {
      const date = (inv.invoice_date as string).slice(0, 10)
      if (!grouped[date]) grouped[date] = { revenue: 0, count: 0 }
      grouped[date].revenue += inv.grand_total ?? 0
      grouped[date].count += 1
    }

    const trend = Object.entries(grouped).map(([date, val]) => ({
      date,
      revenue: Math.round(val.revenue),
      count: val.count,
    }))

    return { data: trend, error: null }
  } catch (err) {
    return { data: [], error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ---------------------------------------------------------------------------
// getRevenueByCategory
// ---------------------------------------------------------------------------
export async function getRevenueByCategory(): Promise<{
  data: CategoryRevenue[]
  error: string | null
}> {
  try {
    const { supabase, user, profile } = await getCurrentUserProfile()
    if (!user || !profile) return { data: [], error: 'Not authenticated' }

    const scopedIds = await getScopedUserIds(supabase, profile)
    const isAll = scopedIds.length === 0

    let invoiceQuery = supabase
      .from('invoices')
      .select('id, salesperson_id')
      .in('payment_status', ['Paid', 'Partially Paid'])

    if (!isAll) invoiceQuery = invoiceQuery.in('salesperson_id', scopedIds)

    const { data: invoices, error: invErr } = await invoiceQuery
    if (invErr) return { data: [], error: invErr.message }

    const invoiceIds = (invoices ?? []).map((inv: { id: string }) => inv.id)
    if (invoiceIds.length === 0) return { data: [], error: null }

    const { data: items, error: itemErr } = await supabase
      .from('invoice_items')
      .select('invoice_id, line_total, qty, product_id, products(category)')
      .in('invoice_id', invoiceIds)

    if (itemErr) return { data: [], error: itemErr.message }

    const grouped: Record<string, { revenue: number; units: number }> = {}
    for (const item of items ?? []) {
      const productRef = item.products as unknown as { category: string | null } | null
      const category = productRef?.category ?? 'Uncategorized'
      if (!grouped[category]) grouped[category] = { revenue: 0, units: 0 }
      grouped[category].revenue += item.line_total ?? 0
      grouped[category].units += item.qty ?? 0
    }

    const result: CategoryRevenue[] = Object.entries(grouped)
      .map(([category, val]) => ({
        category,
        revenue: Math.round(val.revenue),
        units: val.units,
      }))
      .sort((a, b) => b.revenue - a.revenue)

    return { data: result, error: null }
  } catch (err) {
    return { data: [], error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
