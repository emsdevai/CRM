'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Invoice, InvoiceWithItems, PaymentStatus } from '@/lib/types/database'

// ---------------------------------------------------------------------------
// READ
// ---------------------------------------------------------------------------

export async function getInvoices(filters: {
  paymentStatus?: string
  search?: string
  page?: number
  pageSize?: number
}) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: [], count: 0, error: 'Unauthorized' }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = profile?.role ?? 'salesperson'
    const page = filters.page ?? 1
    const pageSize = filters.pageSize ?? 20
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let query = supabase
      .from('invoices')
      .select(
        `
        *,
        customer:customers(id, name, customer_number, phone),
        salesperson:profiles!invoices_salesperson_id_fkey(id, name)
      `,
        { count: 'exact' },
      )
      .order('invoice_date', { ascending: false })
      .range(from, to)

    // Role scoping
    if (role === 'salesperson') {
      query = query.eq('salesperson_id', user.id)
    } else if (role === 'manager') {
      const { data: team } = await supabase
        .from('profiles')
        .select('id')
        .or(`id.eq.${user.id},manager_id.eq.${user.id}`)
      const ids = team?.map((p) => p.id) ?? [user.id]
      query = query.in('salesperson_id', ids)
    }

    if (filters.paymentStatus && filters.paymentStatus !== 'all') {
      query = query.eq('payment_status', filters.paymentStatus)
    }
    if (filters.search) {
      query = query.ilike('invoice_no', `%${filters.search}%`)
    }

    const { data, count, error } = await query
    if (error) return { data: [], count: 0, error: error.message }

    return { data: data ?? [], count: count ?? 0, error: null }
  } catch {
    return { data: [], count: 0, error: 'Unexpected error' }
  }
}

export async function getInvoiceById(id: string): Promise<{
  data: InvoiceWithItems | null
  error: string | null
}> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: null, error: 'Unauthorized' }

    const { data, error } = await supabase
      .from('invoices')
      .select(
        `
        *,
        items:invoice_items(*),
        customer:customers(id, name, customer_number, phone, email, address, city, state),
        salesperson:profiles!invoices_salesperson_id_fkey(id, name, phone),
        quotation:quotations(id)
      `,
      )
      .eq('id', id)
      .single()

    if (error) return { data: null, error: error.message }
    return { data: data as InvoiceWithItems, error: null }
  } catch {
    return { data: null, error: 'Unexpected error' }
  }
}

export async function getInvoiceStats() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: null, error: 'Unauthorized' }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = profile?.role ?? 'salesperson'
    let query = supabase.from('invoices').select('grand_total, payment_status')

    if (role === 'salesperson') {
      query = query.eq('salesperson_id', user.id)
    } else if (role === 'manager') {
      const { data: team } = await supabase
        .from('profiles')
        .select('id')
        .or(`id.eq.${user.id},manager_id.eq.${user.id}`)
      const ids = team?.map((p) => p.id) ?? [user.id]
      query = query.in('salesperson_id', ids)
    }

    const { data: invoices, error } = await query
    if (error) return { data: null, error: error.message }

    const stats = {
      total_revenue: 0,
      paid: 0,
      partially_paid: 0,
      pending: 0,
      count: invoices?.length ?? 0,
    }

    for (const inv of invoices ?? []) {
      stats.total_revenue += inv.grand_total ?? 0
      if (inv.payment_status === 'Paid') stats.paid++
      else if (inv.payment_status === 'Partially Paid') stats.partially_paid++
      else stats.pending++
    }

    return { data: stats, error: null }
  } catch {
    return { data: null, error: 'Unexpected error' }
  }
}

// ---------------------------------------------------------------------------
// UPDATE
// ---------------------------------------------------------------------------

export async function updatePaymentStatus(
  id: string,
  status: PaymentStatus,
): Promise<{ error: string | null }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Unauthorized' }

    const { error } = await supabase
      .from('invoices')
      .update({ payment_status: status })
      .eq('id', id)

    if (error) return { error: error.message }

    revalidatePath('/invoices')
    revalidatePath(`/invoices/${id}`)
    revalidatePath('/dashboard')
    return { error: null }
  } catch {
    return { error: 'Unexpected error' }
  }
}
