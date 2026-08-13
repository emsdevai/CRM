'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Customer, CustomerWithInvoices, Profile } from '@/lib/types/database'

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------
async function getCurrentUserProfile() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { supabase, user: null, profile: null }

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
// getCustomers
// ---------------------------------------------------------------------------
export async function getCustomers(filters: {
  search?: string
  page?: number
  pageSize?: number
}): Promise<{
  data: Customer[]
  count: number
  error: string | null
}> {
  try {
    const { supabase, user, profile } = await getCurrentUserProfile()
    if (!user || !profile) return { data: [], count: 0, error: 'Not authenticated' }

    const page = filters.page ?? 1
    const pageSize = filters.pageSize ?? 20
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const scopedIds = await getScopedUserIds(supabase, profile)
    const isAll = scopedIds.length === 0

    let query = supabase
      .from('customers')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (!isAll) query = query.in('salesperson_id', scopedIds)
    if (filters.search) {
      query = query.or(
        `name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%,email.ilike.%${filters.search}%,customer_number.ilike.%${filters.search}%`,
      )
    }

    const { data, count, error } = await query
    if (error) return { data: [], count: 0, error: error.message }

    return { data: (data ?? []) as Customer[], count: count ?? 0, error: null }
  } catch (err) {
    return { data: [], count: 0, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ---------------------------------------------------------------------------
// getCustomerById
// ---------------------------------------------------------------------------
export async function getCustomerById(id: string): Promise<{
  data: CustomerWithInvoices | null
  error: string | null
}> {
  try {
    const { supabase, user, profile } = await getCurrentUserProfile()
    if (!user || !profile) return { data: null, error: 'Not authenticated' }

    const { data: customer, error: custErr } = await supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .single()

    if (custErr) return { data: null, error: custErr.message }

    // Access check
    const scopedIds = await getScopedUserIds(supabase, profile)
    const isAll = scopedIds.length === 0
    if (!isAll && customer.salesperson_id && !scopedIds.includes(customer.salesperson_id)) {
      return { data: null, error: 'Access denied' }
    }

    const { data: invoices, error: invErr } = await supabase
      .from('invoices')
      .select('*')
      .eq('customer_id', id)
      .order('created_at', { ascending: false })

    if (invErr) return { data: null, error: invErr.message }

    return {
      data: { ...(customer as Customer), invoices: invoices ?? [] } as CustomerWithInvoices,
      error: null,
    }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ---------------------------------------------------------------------------
// updateCustomer
// ---------------------------------------------------------------------------
export async function updateCustomer(
  id: string,
  data: Partial<Omit<Customer, 'id' | 'created_at' | 'updated_at' | 'customer_number'>>,
): Promise<{ data: Customer | null; error: string | null }> {
  try {
    const { supabase, user, profile } = await getCurrentUserProfile()
    if (!user || !profile) return { data: null, error: 'Not authenticated' }

    const { data: existing, error: fetchErr } = await supabase
      .from('customers')
      .select('salesperson_id')
      .eq('id', id)
      .single()

    if (fetchErr) return { data: null, error: fetchErr.message }

    const scopedIds = await getScopedUserIds(supabase, profile)
    const isAll = scopedIds.length === 0
    if (!isAll && existing.salesperson_id && !scopedIds.includes(existing.salesperson_id)) {
      return { data: null, error: 'Access denied' }
    }

    const { data: updated, error: updateErr } = await supabase
      .from('customers')
      .update(data)
      .eq('id', id)
      .select()
      .single()

    if (updateErr) return { data: null, error: updateErr.message }

    return { data: updated as Customer, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ---------------------------------------------------------------------------
// deleteCustomer (admin only)
// ---------------------------------------------------------------------------
export async function deleteCustomer(id: string): Promise<{ error: string | null }> {
  try {
    const { supabase, user, profile } = await getCurrentUserProfile()
    if (!user || !profile) return { error: 'Not authenticated' }

    if (profile.role !== 'admin') {
      return { error: 'Only admins can delete customers' }
    }

    const { error } = await supabase.from('customers').delete().eq('id', id)
    if (error) return { error: error.message }

    revalidatePath('/customers')
    revalidatePath('/dashboard')
    return { error: null }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ---------------------------------------------------------------------------
// getCustomerStats
// ---------------------------------------------------------------------------
export async function getCustomerStats(): Promise<{
  data: { totalCustomers: number; totalRevenue: number; avgSpend: number } | null
  error: string | null
}> {
  try {
    const { supabase, user, profile } = await getCurrentUserProfile()
    if (!user || !profile) return { data: null, error: 'Not authenticated' }

    const scopedIds = await getScopedUserIds(supabase, profile)
    const isAll = scopedIds.length === 0

    let query = supabase.from('customers').select('total_spent, salesperson_id')
    if (!isAll) query = query.in('salesperson_id', scopedIds)

    const { data, error } = await query
    if (error) return { data: null, error: error.message }

    const customers = data ?? []
    const totalCustomers = customers.length
    const totalRevenue = customers.reduce(
      (sum: number, c: { total_spent: number }) => sum + (c.total_spent ?? 0),
      0,
    )
    const avgSpend = totalCustomers > 0 ? totalRevenue / totalCustomers : 0

    return {
      data: {
        totalCustomers,
        totalRevenue: Math.round(totalRevenue),
        avgSpend: Math.round(avgSpend),
      },
      error: null,
    }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ---------------------------------------------------------------------------
// createWalkInCustomer — used from the Scan & Quote page for walk-in sales
// ---------------------------------------------------------------------------
export async function createWalkInCustomer(input: {
  name: string
  phone: string
  email?: string
  city?: string
  state?: string
}): Promise<{ data: { id: string; name: string } | null; error: string | null }> {
  try {
    const { supabase, user, profile } = await getCurrentUserProfile()
    if (!user || !profile) return { data: null, error: 'Not authenticated' }

    // Generate a customer number
    const { count } = await supabase
      .from('customers')
      .select('id', { count: 'exact', head: true })

    const custNum = `JB-WI-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}${String((count ?? 0) + 1).padStart(3, '0')}`

    const { data, error } = await supabase
      .from('customers')
      .insert({
        customer_number: custNum,
        name: input.name.trim(),
        phone: input.phone.trim(),
        email: input.email?.trim() || null,
        city: input.city?.trim() || null,
        state: input.state?.trim() || null,
        total_spent: 0,
        salesperson_id: user.id,
      })
      .select('id, name')
      .single()

    if (error) return { data: null, error: error.message }
    return { data: data as { id: string; name: string }, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
