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
        salesperson:profiles!invoices_salesperson_id_fkey(id, name),
        items:invoice_items(id)
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
        items:invoice_items(*, product:products(id, hsn_code)),
        customer:customers(id, name, customer_number, phone, email, address, city, state, gst_number, pincode),
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
// UPDATE — admin full edit
// ---------------------------------------------------------------------------

export interface InvoiceItemInput {
  product_id?: string | null
  name: string
  sku?: string | null
  image_url?: string | null
  qty: number
  unit_price: number
  discount_pct: number
  gst_pct: number
}

export async function updateInvoiceFull(
  id: string,
  input: {
    customer_id?: string | null
    invoice_date?: string
    notes?: string | null
    payment_method?: string | null
    payment_card_type?: string | null
    card_surcharge_pct?: number
    payment_reference?: string | null
    payment_meta?: Record<string, string> | null
    billed_to?: Record<string, string> | null
    shipped_to?: Record<string, string> | null
    items: InvoiceItemInput[]
  },
): Promise<{ error: string | null }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Unauthorized' }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') return { error: 'Admin access required' }

    // Recalculate totals
    const calculated = input.items.map((item) => {
      const lineBase = item.qty * item.unit_price
      const lineDiscount = lineBase * (item.discount_pct / 100)
      const taxable = lineBase - lineDiscount
      const gstAmt = taxable * (item.gst_pct / 100)
      return { ...item, lineBase, lineDiscount, taxable, gstAmt, lineTotal: taxable + gstAmt }
    })

    const subtotal      = calculated.reduce((s, i) => s + i.lineBase,     0)
    const discountTotal = calculated.reduce((s, i) => s + i.lineDiscount, 0)
    const gstTotal      = calculated.reduce((s, i) => s + i.gstAmt,       0)
    const itemsGrand    = calculated.reduce((s, i) => s + i.lineTotal,    0)
    // Card surcharge applies on the pre-surcharge total
    const surchargePct  = input.card_surcharge_pct ?? 0
    const surchargeAmt  = surchargePct > 0 ? itemsGrand * surchargePct / 100 : 0
    const grandTotal    = itemsGrand + surchargeAmt

    // Update invoice header
    const headerUpdate: Record<string, unknown> = {
      subtotal, discount_total: discountTotal, gst_total: gstTotal, grand_total: grandTotal,
    }
    if (input.customer_id        !== undefined) headerUpdate.customer_id        = input.customer_id
    if (input.invoice_date)                     headerUpdate.invoice_date        = input.invoice_date
    if (input.payment_method     !== undefined) headerUpdate.payment_method      = input.payment_method
    if (input.payment_card_type  !== undefined) headerUpdate.payment_card_type   = input.payment_card_type
    if (input.card_surcharge_pct !== undefined) headerUpdate.card_surcharge_pct  = surchargePct
    if (input.payment_reference  !== undefined) headerUpdate.payment_reference   = input.payment_reference
    if (input.payment_meta       !== undefined) headerUpdate.payment_meta        = input.payment_meta ?? {}
    if (input.billed_to          !== undefined) headerUpdate.billed_to           = input.billed_to
    if (input.shipped_to         !== undefined) headerUpdate.shipped_to          = input.shipped_to

    const { error: invErr } = await supabase.from('invoices').update(headerUpdate).eq('id', id)
    if (invErr) return { error: invErr.message }

    // Replace line items
    await supabase.from('invoice_items').delete().eq('invoice_id', id)

    if (calculated.length > 0) {
      const { error: itemsErr } = await supabase.from('invoice_items').insert(
        calculated.map((item) => ({
          invoice_id: id,
          product_id: item.product_id ?? null,
          name: item.name,
          sku: item.sku ?? '',
          image_url: item.image_url ?? null,
          qty: item.qty,
          unit_price: item.unit_price,
          discount_pct: item.discount_pct,
          gst_pct: item.gst_pct,
          line_total: item.lineTotal,
        })),
      )
      if (itemsErr) return { error: itemsErr.message }
    }

    revalidatePath('/invoices')
    revalidatePath(`/invoices/${id}`)
    return { error: null }
  } catch (err: any) {
    return { error: err.message ?? 'Unexpected error' }
  }
}

// ---------------------------------------------------------------------------
// DELETE (admin only)
// ---------------------------------------------------------------------------

export async function deleteInvoice(id: string): Promise<{ error: string | null }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Unauthorized' }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return { error: 'Only admins can delete invoices' }
    }

    await supabase.from('invoice_items').delete().eq('invoice_id', id)

    const { error } = await supabase.from('invoices').delete().eq('id', id)
    if (error) return { error: error.message }

    revalidatePath('/invoices')
    revalidatePath('/dashboard')
    return { error: null }
  } catch {
    return { error: 'Unexpected error' }
  }
}

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
