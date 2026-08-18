'use server'

import { createClient } from '@/lib/supabase/server'
import { createServerClient } from '@supabase/ssr'
import { revalidatePath } from 'next/cache'
import type { Profile, Role } from '@/lib/types/database'

// ---------------------------------------------------------------------------
// Guard: admin only
// ---------------------------------------------------------------------------

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin') throw new Error('Admin access required')
  return { supabase, user }
}

// Service role client for privileged operations (creates users, etc.)
// NOTE: .trim() is essential — Vercel env vars can include a trailing \n which
// causes Headers.append to throw "invalid header value" for the Bearer token.
function createServiceClient() {
  return createServerClient(
    (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim(),
    (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim(),
    {
      cookies: { getAll: () => [], setAll: () => {} },
      auth: { autoRefreshToken: false, persistSession: false },
    },
  )
}

// ---------------------------------------------------------------------------
// Team Management
// ---------------------------------------------------------------------------

export async function getTeamMembers(): Promise<{
  data: Profile[]
  error: string | null
}> {
  try {
    await requireAdmin() // ensure caller is admin
    // Use service client to bypass RLS and read all profiles
    const service = createServiceClient()
    const { data, error } = await service
      .from('profiles')
      .select('*')
      .order('role', { ascending: true })
      .order('name', { ascending: true })

    if (error) return { data: [], error: error.message }
    return { data: (data as Profile[]) ?? [], error: null }
  } catch (err: any) {
    return { data: [], error: err.message }
  }
}

export async function getManagersForAdmin(): Promise<{
  data: Array<{ id: string; name: string | null; role: Role }>
}> {
  try {
    await requireAdmin()
    const service = createServiceClient()
    const { data } = await service
      .from('profiles')
      .select('id, name, role')
      .in('role', ['manager', 'admin'])
      .order('name')
    return { data: (data ?? []) as Array<{ id: string; name: string | null; role: Role }> }
  } catch {
    return { data: [] }
  }
}

export async function createTeamMember(input: {
  name: string
  email: string
  password: string
  role: 'admin' | 'manager' | 'salesperson'
  manager_id?: string | null
  phone?: string
  annual_target?: number
  max_discount_pct?: number | null
}): Promise<{ data: Profile | null; error: string | null }> {
  try {
    await requireAdmin()
    const serviceClient = createServiceClient()

    // Create auth user
    const { data: authData, error: authError } =
      await serviceClient.auth.admin.createUser({
        email: input.email,
        password: input.password,
        email_confirm: true,
        user_metadata: { name: input.name },
      })

    if (authError) return { data: null, error: authError.message }
    if (!authData.user) return { data: null, error: 'User creation failed' }

    // Update profile (auto-created by trigger)
    const { data: profile, error: profileError } = await serviceClient
      .from('profiles')
      .update({
        name: input.name,
        role: input.role,
        manager_id: input.manager_id ?? null,
        phone: input.phone ?? null,
        annual_target: input.annual_target ?? 0,
        max_discount_pct: input.max_discount_pct ?? null,
      })
      .eq('id', authData.user.id)
      .select()
      .single()

    if (profileError) return { data: null, error: profileError.message }

    revalidatePath('/admin')
    return { data: profile as Profile, error: null }
  } catch (err: any) {
    return { data: null, error: err.message }
  }
}

export async function updateTeamMember(
  id: string,
  input: Partial<{
    name: string
    role: 'admin' | 'manager' | 'salesperson'
    manager_id: string | null
    phone: string
    annual_target: number
    max_discount_pct: number | null
  }>,
): Promise<{ error: string | null }> {
  try {
    const { supabase } = await requireAdmin()
    const { error } = await supabase
      .from('profiles')
      .update(input)
      .eq('id', id)

    if (error) return { error: error.message }
    revalidatePath('/admin')
    return { error: null }
  } catch (err: any) {
    return { error: err.message }
  }
}

// ---------------------------------------------------------------------------
// Discount Rules
// ---------------------------------------------------------------------------

export async function getDiscountRules() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('discount_rules')
      .select('*')
      .order('role')
    if (error) return { data: [], error: error.message }
    return { data: data ?? [], error: null }
  } catch {
    return { data: [], error: 'Unexpected error' }
  }
}

export async function updateDiscountRule(
  role: string,
  input: {
    min_pct: number
    max_pct: number
    requires_approval_above: number
  },
): Promise<{ error: string | null }> {
  try {
    const { supabase, user } = await requireAdmin()
    const { error } = await supabase
      .from('discount_rules')
      .update({
        min_pct: input.min_pct,
        max_pct: input.max_pct,
        requires_approval_above: input.requires_approval_above,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('role', role)

    if (error) return { error: error.message }
    revalidatePath('/admin')
    revalidatePath('/quotations')
    return { error: null }
  } catch (err: any) {
    return { error: err.message }
  }
}

// ---------------------------------------------------------------------------
// Business Settings
// ---------------------------------------------------------------------------

export async function getBusinessSettings() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('business_settings')
      .select('*')
      .eq('key', 'company')
      .single()

    if (error) return { data: null, error: error.message }
    return { data: data?.value ?? {}, error: null }
  } catch {
    return { data: null, error: 'Unexpected error' }
  }
}

export async function updateBusinessSettings(
  settings: Record<string, unknown>,
): Promise<{ error: string | null }> {
  try {
    const { supabase, user } = await requireAdmin()
    const { error } = await supabase
      .from('business_settings')
      .update({ value: settings, updated_by: user.id })
      .eq('key', 'company')

    if (error) return { error: error.message }
    revalidatePath('/admin')
    revalidatePath('/invoices')
    return { error: null }
  } catch (err: any) {
    return { error: err.message }
  }
}

// ---------------------------------------------------------------------------
// Leaderboard Analytics
// ---------------------------------------------------------------------------

export async function getSalespersonLeaderboard() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: [], error: 'Unauthorized' }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    // Fetch all profiles (scoped)
    let profileQuery = supabase
      .from('profiles')
      .select('id, name, role, annual_target, manager_id')
      .in('role', ['salesperson', 'manager'])
      .order('name')

    if (profile?.role === 'manager') {
      profileQuery = profileQuery.or(`id.eq.${user.id},manager_id.eq.${user.id}`)
    } else if (profile?.role === 'salesperson') {
      profileQuery = profileQuery.eq('id', user.id)
    }

    const { data: members, error: membersError } = await profileQuery
    if (membersError || !members) return { data: [], error: membersError?.message }

    const ids = members.map((m) => m.id)

    // Fetch invoices for those members
    const { data: invoices } = await supabase
      .from('invoices')
      .select('salesperson_id, grand_total')
      .in('salesperson_id', ids)

    // Fetch leads for those members
    const { data: leads } = await supabase
      .from('leads')
      .select('assigned_to, stage')
      .in('assigned_to', ids)

    const leaderboard = members.map((member) => {
      const memberInvoices = invoices?.filter((i) => i.salesperson_id === member.id) ?? []
      const memberLeads = leads?.filter((l) => l.assigned_to === member.id) ?? []
      const revenue = memberInvoices.reduce((s, i) => s + (i.grand_total ?? 0), 0)
      const leadsCount = memberLeads.length
      const wonLeads = memberLeads.filter((l) => l.stage === 'Won').length
      const conversionRate = leadsCount > 0 ? (wonLeads / leadsCount) * 100 : 0
      const achievementPct =
        member.annual_target > 0 ? (revenue / member.annual_target) * 100 : 0

      return {
        profile: member,
        revenue,
        leads_count: leadsCount,
        conversion_rate: Math.round(conversionRate),
        target: member.annual_target ?? 0,
        achievement_pct: Math.round(achievementPct),
      }
    })

    // Sort by revenue desc
    leaderboard.sort((a, b) => b.revenue - a.revenue)

    return { data: leaderboard, error: null }
  } catch {
    return { data: [], error: 'Unexpected error' }
  }
}

// ---------------------------------------------------------------------------
// Data Export helpers
// ---------------------------------------------------------------------------

export async function exportProductsCsv(): Promise<{
  data: string | null
  error: string | null
}> {
  try {
    const { supabase } = await requireAdmin()
    const { data: products, error } = await supabase
      .from('products')
      .select('*')
      .order('category')

    if (error) return { data: null, error: error.message }

    const headers = [
      'name', 'sku', 'barcode', 'category', 'subcategory', 'family', 'type',
      'price', 'cost', 'gst_pct', 'margin_pct', 'stock', 'reorder_level', 'description',
    ]
    const rows = products?.map((p) =>
      headers.map((h) => JSON.stringify((p as any)[h] ?? '')).join(','),
    )
    const csv = [headers.join(','), ...(rows ?? [])].join('\n')
    return { data: csv, error: null }
  } catch (err: any) {
    return { data: null, error: err.message }
  }
}

export async function exportLeadsCsv(): Promise<{
  data: string | null
  error: string | null
}> {
  try {
    const { supabase } = await requireAdmin()
    const { data: leads, error } = await supabase
      .from('leads')
      .select('*, assignee:profiles!leads_assigned_to_fkey(name)')
      .order('created_at', { ascending: false })

    if (error) return { data: null, error: error.message }

    const headers = ['name', 'email', 'phone', 'city', 'state', 'source', 'stage', 'assigned_to', 'estimated_value', 'created_at']
    const rows = leads?.map((l: any) =>
      [
        l.name, l.email, l.phone, l.city, l.state, l.source, l.stage,
        l.assignee?.name, l.estimated_value, l.created_at,
      ]
        .map((v) => JSON.stringify(v ?? ''))
        .join(','),
    )
    const csv = [headers.join(','), ...(rows ?? [])].join('\n')
    return { data: csv, error: null }
  } catch (err: any) {
    return { data: null, error: err.message }
  }
}

export async function exportInvoicesCsv(): Promise<{
  data: string | null
  error: string | null
}> {
  try {
    const { supabase } = await requireAdmin()
    const { data: invoices, error } = await supabase
      .from('invoices')
      .select('*, customer:customers(name), salesperson:profiles!invoices_salesperson_id_fkey(name)')
      .order('invoice_date', { ascending: false })

    if (error) return { data: null, error: error.message }

    const headers = ['invoice_no', 'customer', 'salesperson', 'subtotal', 'discount_total', 'gst_total', 'grand_total', 'payment_status', 'invoice_date']
    const rows = invoices?.map((i: any) =>
      [
        i.invoice_no, i.customer?.name, i.salesperson?.name,
        i.subtotal, i.discount_total, i.gst_total, i.grand_total,
        i.payment_status, i.invoice_date,
      ]
        .map((v) => JSON.stringify(v ?? ''))
        .join(','),
    )
    const csv = [headers.join(','), ...(rows ?? [])].join('\n')
    return { data: csv, error: null }
  } catch (err: any) {
    return { data: null, error: err.message }
  }
}
