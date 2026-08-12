'use server'

import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/lib/types/database'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function getCurrentUserProfile() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) return { supabase, user: null, profile: null }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return { supabase, user, profile: profile as Profile | null }
}

async function getScopedUserIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  profile: Profile,
): Promise<string[]> {
  if (profile.role === 'admin') return []

  if (profile.role === 'manager') {
    const { data: teamMembers } = await supabase
      .from('profiles')
      .select('id')
      .eq('manager_id', profile.id)

    const ids = (teamMembers ?? []).map((m: { id: string }) => m.id)
    return [profile.id, ...ids]
  }

  return [profile.id]
}

// ---------------------------------------------------------------------------
// getPendingApprovalsCount
// Returns count of quotations in 'Pending Approval' stage that the
// current user should review (manager = quotations from their team,
// admin = all pending approvals).
// ---------------------------------------------------------------------------
export async function getPendingApprovalsCount(): Promise<{
  data: number
  error: string | null
}> {
  try {
    const { supabase, user, profile } = await getCurrentUserProfile()
    if (!user || !profile) return { data: 0, error: 'Not authenticated' }

    if (profile.role === 'salesperson') return { data: 0, error: null }

    let query = supabase
      .from('quotations')
      .select('id', { count: 'exact', head: true })
      .eq('stage', 'Pending Approval')

    if (profile.role === 'manager') {
      // Only quotations sent to this manager for approval
      query = query.eq('approval_required_from', profile.id)
    }

    const { count, error } = await query
    if (error) return { data: 0, error: error.message }

    return { data: count ?? 0, error: null }
  } catch (err) {
    return { data: 0, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ---------------------------------------------------------------------------
// LeaderboardEntry — what we return per person/team
// ---------------------------------------------------------------------------
export interface LeaderboardEntry {
  profile: { name: string; role: string; id: string; avatar_url: string | null }
  revenue: number
  leads_count: number
  conversion_rate: number
  target: number
  achievement_pct: number
}

// ---------------------------------------------------------------------------
// getLeaderboard
// Returns performance data for salespersons visible to the current user.
// rangeDays: number of days to look back (7, 30, 90, etc.)
// ---------------------------------------------------------------------------
export async function getLeaderboard(rangeDays = 30): Promise<{
  data: LeaderboardEntry[]
  error: string | null
}> {
  try {
    const { supabase, user, profile } = await getCurrentUserProfile()
    if (!user || !profile) return { data: [], error: 'Not authenticated' }

    // Build list of profile IDs to show
    let profileIds: string[] = []

    if (profile.role === 'admin') {
      const { data: allProfiles } = await supabase
        .from('profiles')
        .select('id, name, role, avatar_url, annual_target')
        .in('role', ['salesperson', 'manager'])
      profileIds = (allProfiles ?? []).map((p: { id: string }) => p.id)
    } else if (profile.role === 'manager') {
      const { data: team } = await supabase
        .from('profiles')
        .select('id')
        .eq('manager_id', profile.id)
      profileIds = [profile.id, ...(team ?? []).map((p: { id: string }) => p.id)]
    } else {
      profileIds = [profile.id]
    }

    if (profileIds.length === 0) return { data: [], error: null }

    // Fetch all profiles data
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, role, avatar_url, annual_target')
      .in('id', profileIds)

    if (!profiles || profiles.length === 0) return { data: [], error: null }

    const since = new Date()
    since.setDate(since.getDate() - rangeDays)
    const sinceStr = since.toISOString().slice(0, 10)

    // Fetch invoices for all those salespersons in date range
    const { data: invoices } = await supabase
      .from('invoices')
      .select('salesperson_id, grand_total')
      .in('salesperson_id', profileIds)
      .in('payment_status', ['Paid', 'Partially Paid'])
      .gte('invoice_date', sinceStr)

    // Fetch leads for all those salespersons
    const { data: leads } = await supabase
      .from('leads')
      .select('assigned_to, stage')
      .in('assigned_to', profileIds)
      .gte('created_at', since.toISOString())

    // Build maps
    const revenueByUser: Record<string, number> = {}
    for (const inv of invoices ?? []) {
      const uid = inv.salesperson_id as string
      revenueByUser[uid] = (revenueByUser[uid] ?? 0) + (inv.grand_total ?? 0)
    }

    const leadsByUser: Record<string, { total: number; won: number }> = {}
    for (const lead of leads ?? []) {
      const uid = lead.assigned_to as string
      if (!leadsByUser[uid]) leadsByUser[uid] = { total: 0, won: 0 }
      leadsByUser[uid].total += 1
      if (lead.stage === 'Won') leadsByUser[uid].won += 1
    }

    const entries: LeaderboardEntry[] = profiles.map(
      (p: {
        id: string
        name: string | null
        role: string
        avatar_url: string | null
        annual_target: number
      }) => {
        const revenue = Math.round(revenueByUser[p.id] ?? 0)
        const leadsData = leadsByUser[p.id] ?? { total: 0, won: 0 }
        const conversion_rate =
          leadsData.total > 0
            ? Math.round((leadsData.won / leadsData.total) * 1000) / 10
            : 0

        // Achievement is against the proportional target for the date range
        const dailyTarget = (p.annual_target ?? 0) / 365
        const periodTarget = Math.round(dailyTarget * rangeDays)
        const achievement_pct =
          periodTarget > 0 ? Math.round((revenue / periodTarget) * 1000) / 10 : 0

        return {
          profile: {
            id: p.id,
            name: p.name ?? 'Unknown',
            role: p.role,
            avatar_url: p.avatar_url,
          },
          revenue,
          leads_count: leadsData.total,
          conversion_rate,
          target: periodTarget,
          achievement_pct,
        }
      },
    )

    // Sort by revenue descending
    entries.sort((a, b) => b.revenue - a.revenue)

    return { data: entries, error: null }
  } catch (err) {
    return { data: [], error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ---------------------------------------------------------------------------
// getLeadSourceBreakdown
// Count leads by source within a date range.
// ---------------------------------------------------------------------------
export async function getLeadSourceBreakdown(rangeDays = 30): Promise<{
  data: { source: string; count: number }[]
  error: string | null
}> {
  try {
    const { supabase, user, profile } = await getCurrentUserProfile()
    if (!user || !profile) return { data: [], error: 'Not authenticated' }

    const scopedIds = await getScopedUserIds(supabase, profile)
    const isAll = scopedIds.length === 0

    const since = new Date()
    since.setDate(since.getDate() - rangeDays)

    let query = supabase
      .from('leads')
      .select('source')
      .gte('created_at', since.toISOString())

    if (!isAll) query = query.in('assigned_to', scopedIds)

    const { data, error } = await query
    if (error) return { data: [], error: error.message }

    const counts: Record<string, number> = {}
    for (const row of data ?? []) {
      const src = (row.source as string | null) ?? 'Unknown'
      counts[src] = (counts[src] ?? 0) + 1
    }

    const result = Object.entries(counts)
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count)

    return { data: result, error: null }
  } catch (err) {
    return { data: [], error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ---------------------------------------------------------------------------
// getInventoryStats
// Returns stock status distribution and low-stock products.
// ---------------------------------------------------------------------------
export async function getInventoryStats(): Promise<{
  data: {
    distribution: { status: string; count: number }[]
    lowStock: Array<{
      id: string
      name: string
      sku: string
      stock: number
      reorder_level: number
      category: string | null
    }>
  } | null
  error: string | null
}> {
  try {
    const { supabase, user } = await getCurrentUserProfile()
    if (!user) return { data: null, error: 'Not authenticated' }

    const { data: products, error } = await supabase
      .from('products')
      .select('id, name, sku, stock, reorder_level, category')

    if (error) return { data: null, error: error.message }

    const distribution = [
      { status: 'In Stock', count: 0 },
      { status: 'Low Stock', count: 0 },
      { status: 'Out of Stock', count: 0 },
    ]

    const lowStock: Array<{
      id: string
      name: string
      sku: string
      stock: number
      reorder_level: number
      category: string | null
    }> = []

    for (const p of products ?? []) {
      if (p.stock <= 0) {
        distribution[2].count += 1
        lowStock.push(p)
      } else if (p.stock <= p.reorder_level) {
        distribution[1].count += 1
        lowStock.push(p)
      } else {
        distribution[0].count += 1
      }
    }

    lowStock.sort((a, b) => a.stock - b.stock)

    return { data: { distribution, lowStock: lowStock.slice(0, 20) }, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ---------------------------------------------------------------------------
// getSalesTrendForRange — like getSalesTrend but accepts a custom range
// ---------------------------------------------------------------------------
export async function getSalesTrendForRange(rangeDays = 30): Promise<{
  data: { date: string; revenue: number; count: number }[]
  error: string | null
}> {
  try {
    const { supabase, user, profile } = await getCurrentUserProfile()
    if (!user || !profile) return { data: [], error: 'Not authenticated' }

    const scopedIds = await getScopedUserIds(supabase, profile)
    const isAll = scopedIds.length === 0

    const since = new Date()
    since.setDate(since.getDate() - rangeDays)

    let query = supabase
      .from('invoices')
      .select('invoice_date, grand_total, salesperson_id')
      .in('payment_status', ['Paid', 'Partially Paid'])
      .gte('invoice_date', since.toISOString().slice(0, 10))
      .order('invoice_date', { ascending: true })

    if (!isAll) query = query.in('salesperson_id', scopedIds)

    const { data, error } = await query
    if (error) return { data: [], error: error.message }

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
