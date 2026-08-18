'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type {
  Quotation,
  QuotationWithItems,
  QuotationFull,
  QuotationStage,
  Invoice,
  Lead,
  Customer,
  Product,
} from '@/lib/types/database'

// ---------------------------------------------------------------------------
// Search helpers (used by QuotationBuilder client component)
// ---------------------------------------------------------------------------

export async function searchLeads(query: string): Promise<Lead[]> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, id')
      .eq('id', user.id)
      .single()

    const role = profile?.role ?? 'salesperson'

    let q = supabase
      .from('leads')
      .select('id, name, phone, stage, email, assigned_to')
      .neq('stage', 'Won')
      .neq('stage', 'Lost')
      .order('name', { ascending: true })
      .limit(20)

    if (role === 'salesperson') {
      q = q.eq('assigned_to', user.id)
    } else if (role === 'manager') {
      const { data: team } = await supabase
        .from('profiles')
        .select('id')
        .or(`id.eq.${user.id},manager_id.eq.${user.id}`)
      const ids = team?.map((p: { id: string }) => p.id) ?? [user.id]
      q = q.in('assigned_to', ids)
    }

    const trimmed = query.trim()
    if (trimmed) {
      // Phone-first: if query looks like a phone number, exact-match phone first
      const isPhone = /^[\d\s+\-()]{7,}$/.test(trimmed)
      if (isPhone) {
        q = q.or(`phone.ilike.%${trimmed}%,name.ilike.%${trimmed}%`)
      } else {
        q = q.or(`name.ilike.%${trimmed}%,phone.ilike.%${trimmed}%,email.ilike.%${trimmed}%`)
      }
    }

    const { data } = await q
    if (!data) return []
    // Phone exact-match rows bubble to top
    const trimmed2 = query.trim()
    if (trimmed2 && /^[\d\s+\-()]{7,}$/.test(trimmed2)) {
      const digits = trimmed2.replace(/\D/g, '')
      return (data as Lead[]).sort((a, b) => {
        const aMatch = a.phone.replace(/\D/g, '').includes(digits) ? 0 : 1
        const bMatch = b.phone.replace(/\D/g, '').includes(digits) ? 0 : 1
        return aMatch - bMatch
      })
    }
    return (data ?? []) as Lead[]
  } catch {
    return []
  }
}

export async function searchCustomers(query: string): Promise<Customer[]> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, id')
      .eq('id', user.id)
      .single()

    const role = profile?.role ?? 'salesperson'

    let q = supabase
      .from('customers')
      .select('id, name, phone, customer_number, email, salesperson_id, address, city, state, pincode, gst_number')
      .order('name', { ascending: true })
      .limit(20)

    // Salespersons can see ALL customers so they can create quotations for
    // any existing client (not just ones previously assigned to them).
    if (role === 'manager') {
      const { data: team } = await supabase
        .from('profiles')
        .select('id')
        .or(`id.eq.${user.id},manager_id.eq.${user.id}`)
      const ids = team?.map((p: { id: string }) => p.id) ?? [user.id]
      q = q.in('salesperson_id', ids)
    }

    const trimmed = query.trim()
    if (trimmed) {
      const isPhone = /^[\d\s+\-()]{7,}$/.test(trimmed)
      if (isPhone) {
        q = q.or(`phone.ilike.%${trimmed}%,name.ilike.%${trimmed}%`)
      } else {
        q = q.or(`name.ilike.%${trimmed}%,phone.ilike.%${trimmed}%,customer_number.ilike.%${trimmed}%`)
      }
    }

    const { data } = await q
    if (!data) return []
    // Phone matches first
    const trimmed2 = query.trim()
    if (trimmed2 && /^[\d\s+\-()]{7,}$/.test(trimmed2)) {
      const digits = trimmed2.replace(/\D/g, '')
      return (data as Customer[]).sort((a, b) => {
        const aMatch = (a.phone ?? '').replace(/\D/g, '').includes(digits) ? 0 : 1
        const bMatch = (b.phone ?? '').replace(/\D/g, '').includes(digits) ? 0 : 1
        return aMatch - bMatch
      })
    }
    return (data ?? []) as Customer[]
  } catch {
    return []
  }
}

export async function searchProducts(query: string): Promise<Product[]> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    let q = supabase
      .from('products')
      .select('id, sku, name, price, gst_pct, stock, image_url, category, barcode')
      .order('name', { ascending: true })
      .limit(30)

    if (query.trim()) {
      q = q.or(`name.ilike.%${query}%,sku.ilike.%${query}%,barcode.ilike.%${query}%`)
    }

    const { data } = await q
    return (data ?? []) as Product[]
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getScopedQuotationIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  role: string,
) {
  if (role === 'admin') return null // no filter needed

  if (role === 'manager') {
    const { data: team } = await supabase
      .from('profiles')
      .select('id')
      .or(`id.eq.${userId},manager_id.eq.${userId}`)
    return team?.map((p) => p.id) ?? [userId]
  }

  return [userId]
}

// ---------------------------------------------------------------------------
// READ
// ---------------------------------------------------------------------------

export async function getQuotations(filters: {
  stage?: string
  leadId?: string
  page?: number
  pageSize?: number
}) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { data: [], count: 0, error: 'Unauthorized' }

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
      .from('quotations')
      .select(
        `
        *,
        creator:profiles!quotations_created_by_fkey(id, name, role),
        lead:leads(id, name, phone),
        customer:customers(id, name, customer_number)
      `,
        { count: 'exact' },
      )
      .order('created_at', { ascending: false })
      .range(from, to)

    // Role scoping
    if (role !== 'admin') {
      const scopeIds = await getScopedQuotationIds(supabase, user.id, role)
      if (scopeIds) query = query.in('created_by', scopeIds)
    }

    if (filters.stage && filters.stage !== 'all') {
      query = query.eq('stage', filters.stage)
    }
    if (filters.leadId) {
      query = query.eq('lead_id', filters.leadId)
    }

    const { data, count, error } = await query
    if (error) return { data: [], count: 0, error: error.message }

    return { data: data ?? [], count: count ?? 0, error: null }
  } catch (err) {
    return { data: [], count: 0, error: 'Unexpected error' }
  }
}

export async function getQuotationById(id: string): Promise<{
  data: QuotationFull | null
  error: string | null
}> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: null, error: 'Unauthorized' }

    const { data, error } = await supabase
      .from('quotations')
      .select(
        `
        *,
        items:quotation_items(*, product:products(id, hsn_code)),
        creator:profiles!quotations_created_by_fkey(id, name, role, phone),
        approver:profiles!quotations_approval_required_from_fkey(id, name, role),
        lead:leads(id, name, phone, email, stage),
        customer:customers(id, name, customer_number, phone, email, address)
      `,
      )
      .eq('id', id)
      .single()

    if (error) return { data: null, error: error.message }
    return { data: data as QuotationFull, error: null }
  } catch {
    return { data: null, error: 'Unexpected error' }
  }
}

export async function getPendingApprovals() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: [], error: 'Unauthorized' }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = profile?.role ?? 'salesperson'
    if (role === 'salesperson') return { data: [], error: null }

    let query = supabase
      .from('quotations')
      .select(
        `
        *,
        creator:profiles!quotations_created_by_fkey(id, name),
        lead:leads(id, name),
        items:quotation_items(id, name, qty, unit_price, discount_pct, line_total)
      `,
      )
      .eq('stage', 'Pending Approval')
      .order('created_at', { ascending: true })

    if (role === 'manager') {
      query = query.eq('approval_required_from', user.id)
    }

    const { data, error } = await query
    if (error) return { data: [], error: error.message }
    return { data: data ?? [], error: null }
  } catch {
    return { data: [], error: 'Unexpected error' }
  }
}

export async function getDiscountRule(role: string) {
  const supabase = await createClient()

  // Check for per-person override on the current user's profile
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('max_discount_pct')
      .eq('id', user.id)
      .single()
    if (profile?.max_discount_pct != null) {
      const max = profile.max_discount_pct as number
      return { min_pct: 0, max_pct: max, requires_approval_above: max }
    }
  }

  const { data } = await supabase
    .from('discount_rules')
    .select('*')
    .eq('role', role)
    .single()
  return data ?? { min_pct: 0, max_pct: role === 'admin' ? 100 : role === 'manager' ? 15 : 10, requires_approval_above: 100 }
}

// ---------------------------------------------------------------------------
// CREATE
// ---------------------------------------------------------------------------

export interface QuotationItemInput {
  product_id?: string | null
  is_custom?: boolean
  custom_description?: string
  name: string
  sku?: string
  image_url?: string
  qty: number
  unit_price: number
  discount_pct: number
  gst_pct: number
}

export async function createQuotation(input: {
  lead_id?: string | null
  customer_id?: string | null
  items: QuotationItemInput[]
  notes?: string
  freight_charges?: number
  /** true = always save as Draft regardless of discount */
  asDraft?: boolean
}): Promise<{ data: Quotation | null; error: string | null }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: null, error: 'Unauthorized' }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, manager_id')
      .eq('id', user.id)
      .single()

    const role = profile?.role ?? 'salesperson'

    // Calculate line items
    const calculatedItems = input.items.map((item) => {
      const line_base = item.unit_price * item.qty
      const line_discount = line_base * (item.discount_pct / 100)
      const taxable = line_base - line_discount
      const gst_amt = taxable * (item.gst_pct / 100)
      const line_total = taxable + gst_amt
      return { ...item, line_base, line_discount, taxable, gst_amt, line_total }
    })

    const subtotal = calculatedItems.reduce((s, i) => s + i.line_base, 0)
    const discount_total = calculatedItems.reduce((s, i) => s + i.line_discount, 0)
    const gst_total = calculatedItems.reduce((s, i) => s + i.gst_amt, 0)
    const freight_charges = input.freight_charges ?? 0
    const grand_total = calculatedItems.reduce((s, i) => s + i.line_total, 0) + freight_charges

    // Determine if approval is needed
    const maxDiscount = Math.max(...input.items.map((i) => i.discount_pct), 0)
    const rule = await getDiscountRule(role)
    let stage: QuotationStage = input.asDraft ? 'Draft' : 'Sent'
    let approval_required_from: string | null = null

    if (!input.asDraft && role !== 'admin' && maxDiscount > rule.requires_approval_above) {
      stage = 'Pending Approval'
      if (role === 'salesperson' && maxDiscount <= 15) {
        // Find manager
        if (profile?.manager_id) {
          approval_required_from = profile.manager_id
        } else {
          const { data: mgrs } = await supabase
            .from('profiles')
            .select('id')
            .eq('role', 'manager')
            .limit(1)
          approval_required_from = mgrs?.[0]?.id ?? null
        }
      } else {
        // Needs admin
        const { data: admins } = await supabase
          .from('profiles')
          .select('id')
          .eq('role', 'admin')
          .limit(1)
        approval_required_from = admins?.[0]?.id ?? null
      }
    }

    // Insert quotation
    const { data: quotation, error: qError } = await supabase
      .from('quotations')
      .insert({
        lead_id: input.lead_id ?? null,
        customer_id: input.customer_id ?? null,
        stage,
        subtotal,
        discount_total,
        gst_total,
        freight_charges,
        grand_total,
        notes: input.notes ?? null,
        created_by: user.id,
        approval_required_from,
      })
      .select()
      .single()

    if (qError) return { data: null, error: qError.message }

    // Insert line items
    const itemRows = calculatedItems.map((item, idx) => ({
      quotation_id: quotation.id,
      product_id: item.product_id ?? null,
      is_custom: item.is_custom ?? false,
      custom_description: item.custom_description ?? null,
      name: item.name,
      sku: item.sku ?? '',
      image_url: item.image_url ?? null,
      qty: item.qty,
      unit_price: item.unit_price,
      discount_pct: item.discount_pct,
      gst_pct: item.gst_pct,
      line_base: item.line_base,
      line_discount: item.line_discount,
      taxable: item.taxable,
      gst_amt: item.gst_amt,
      line_total: item.line_total,
      sort_order: idx,
    }))

    const { error: itemsError } = await supabase
      .from('quotation_items')
      .insert(itemRows)

    if (itemsError) return { data: null, error: itemsError.message }

    // Log lead activity
    if (input.lead_id) {
      await supabase.from('lead_activities').insert({
        lead_id: input.lead_id,
        type: 'quote',
        text: `Quotation created — ₹${Math.round(grand_total).toLocaleString('en-IN')} (${stage})`,
        by: user.id,
      })

      if (stage === 'Sent' || stage === 'Pending Approval') {
        await supabase
          .from('leads')
          .update({ stage: 'Quotation Sent' })
          .eq('id', input.lead_id)
      }
    }

    revalidatePath('/quotations')
    revalidatePath('/leads')
    return { data: quotation, error: null }
  } catch (err) {
    return { data: null, error: 'Unexpected error creating quotation' }
  }
}

// ---------------------------------------------------------------------------
// APPROVE / REJECT
// ---------------------------------------------------------------------------

export async function approveQuotation(
  id: string,
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

    if (!profile || profile.role === 'salesperson') {
      return { error: 'Insufficient permissions' }
    }

    const { data: quotation } = await supabase
      .from('quotations')
      .select('lead_id, grand_total')
      .eq('id', id)
      .single()

    const { error } = await supabase
      .from('quotations')
      .update({
        stage: 'Sent',
        approved_by: user.id,
        approval_required_from: null,
      })
      .eq('id', id)

    if (error) return { error: error.message }

    if (quotation?.lead_id) {
      await supabase.from('lead_activities').insert({
        lead_id: quotation.lead_id,
        type: 'approval',
        text: `Quotation approved — ₹${Math.round(quotation.grand_total ?? 0).toLocaleString('en-IN')}`,
        by: user.id,
      })
    }

    revalidatePath('/quotations')
    revalidatePath('/dashboard')
    return { error: null }
  } catch {
    return { error: 'Unexpected error' }
  }
}

export async function rejectQuotation(
  id: string,
  reason: string,
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

    if (!profile || profile.role === 'salesperson') {
      return { error: 'Insufficient permissions' }
    }

    const { data: quotation } = await supabase
      .from('quotations')
      .select('lead_id')
      .eq('id', id)
      .single()

    const { error } = await supabase
      .from('quotations')
      .update({
        stage: 'Rejected',
        rejected_by: user.id,
        reject_reason: reason,
      })
      .eq('id', id)

    if (error) return { error: error.message }

    if (quotation?.lead_id) {
      await supabase.from('lead_activities').insert({
        lead_id: quotation.lead_id,
        type: 'approval',
        text: `Quotation rejected — ${reason || 'No reason given'}`,
        by: user.id,
      })
    }

    revalidatePath('/quotations')
    return { error: null }
  } catch {
    return { error: 'Unexpected error' }
  }
}

// ---------------------------------------------------------------------------
// CONVERT TO INVOICE
// ---------------------------------------------------------------------------

export async function convertToInvoice(
  quotationId: string,
): Promise<{ data: Invoice | null; error: string | null }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: null, error: 'Unauthorized' }

    // Fetch full quotation
    const { data: quotation, error: qError } = await supabase
      .from('quotations')
      .select('*, items:quotation_items(*), lead:leads(*)')
      .eq('id', quotationId)
      .single()

    if (qError || !quotation) return { data: null, error: qError?.message ?? 'Quotation not found' }
    if (quotation.stage !== 'Sent') return { data: null, error: 'Quotation must be in Sent stage to convert' }

    // Auto-generate invoice number
    const year = new Date().getFullYear()
    const { count } = await supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
    const invoiceNo = `JB/${year}/${String((count ?? 0) + 1001).padStart(4, '0')}`

    // Ensure customer exists
    let customerId = quotation.customer_id
    if (!customerId && quotation.lead_id && quotation.lead) {
      const lead = quotation.lead as any
      // Check if customer already exists for this lead
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id')
        .eq('lead_id', quotation.lead_id)
        .maybeSingle()

      if (existingCustomer) {
        customerId = existingCustomer.id
      } else {
        // Create new customer from lead
        const custNum = `JB-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 9000) + 1000}`
        const { data: newCustomer, error: custError } = await supabase
          .from('customers')
          .insert({
            lead_id: quotation.lead_id,
            customer_number: custNum,
            name: lead.name,
            email: lead.email ?? null,
            phone: lead.phone,
            address: lead.address ?? null,
            city: lead.city ?? null,
            state: lead.state ?? null,
            demographic: lead.demographic ?? {},
            total_spent: 0,
            salesperson_id: quotation.created_by,
          })
          .select()
          .single()

        if (custError) return { data: null, error: custError.message }
        customerId = newCustomer.id
      }
    }

    // Create invoice
    const { data: invoice, error: invError } = await supabase
      .from('invoices')
      .insert({
        invoice_no: invoiceNo,
        quotation_id: quotationId,
        customer_id: customerId,
        lead_id: quotation.lead_id ?? null,
        subtotal: quotation.subtotal,
        discount_total: quotation.discount_total,
        gst_total: quotation.gst_total,
        grand_total: quotation.grand_total,
        payment_status: 'Pending',
        salesperson_id: quotation.created_by,
      })
      .select()
      .single()

    if (invError) return { data: null, error: invError.message }

    // Copy items to invoice_items
    const items = (quotation.items as any[]) ?? []
    if (items.length > 0) {
      const invoiceItems = items.map((item: any) => ({
        invoice_id: invoice.id,
        product_id: item.product_id ?? null,
        name: item.name,
        sku: item.sku ?? '',
        image_url: item.image_url ?? null,
        qty: item.qty,
        unit_price: item.unit_price,
        discount_pct: item.discount_pct,
        gst_pct: item.gst_pct,
        line_total: item.line_total,
      }))
      await supabase.from('invoice_items').insert(invoiceItems)

      // Deduct stock for regular products
      for (const item of items) {
        if (item.product_id) {
          // Try RPC first; fall back to manual fetch-and-update
          const { error: rpcErr } = await supabase.rpc('decrement_stock', {
            p_product_id: item.product_id,
            p_qty: item.qty,
          })
          if (rpcErr) {
            // RPC not available — fallback
            const { data: p } = await supabase
              .from('products')
              .select('stock, sold_count')
              .eq('id', item.product_id)
              .single()
            if (p) {
              await supabase
                .from('products')
                .update({
                  stock: Math.max(0, p.stock - item.qty),
                  sold_count: (p.sold_count ?? 0) + item.qty,
                })
                .eq('id', item.product_id)
            }
          }
        }
      }
    }

    // Mark quotation as converted
    await supabase
      .from('quotations')
      .update({ stage: 'Converted' })
      .eq('id', quotationId)

    // Update lead stage to Won
    if (quotation.lead_id) {
      await supabase
        .from('leads')
        .update({ stage: 'Won', customer_id: customerId })
        .eq('id', quotation.lead_id)

      await supabase.from('lead_activities').insert({
        lead_id: quotation.lead_id,
        type: 'order',
        text: `Converted to Invoice ${invoiceNo} — ₹${Math.round(quotation.grand_total).toLocaleString('en-IN')}`,
        by: user.id,
      })
    }

    // Update customer total spent
    if (customerId) {
      const { data: cust } = await supabase
        .from('customers')
        .select('total_spent')
        .eq('id', customerId)
        .single()
      await supabase
        .from('customers')
        .update({ total_spent: (cust?.total_spent ?? 0) + quotation.grand_total })
        .eq('id', customerId)
    }

    revalidatePath('/quotations')
    revalidatePath('/invoices')
    revalidatePath('/leads')
    revalidatePath('/dashboard')
    return { data: invoice, error: null }
  } catch (err) {
    console.error('convertToInvoice error:', err)
    return { data: null, error: 'Unexpected error converting quotation' }
  }
}

// ---------------------------------------------------------------------------
// DELETE (admin only)
// ---------------------------------------------------------------------------

export async function deleteQuotation(id: string): Promise<{ error: string | null }> {
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
      return { error: 'Only admins can delete quotations' }
    }

    const { data: quotation } = await supabase
      .from('quotations')
      .select('lead_id')
      .eq('id', id)
      .single()

    // Items cascade on delete; belt-and-suspenders delete anyway
    await supabase.from('quotation_items').delete().eq('quotation_id', id)

    const { error } = await supabase.from('quotations').delete().eq('id', id)
    if (error) return { error: error.message }

    revalidatePath('/quotations')
    if (quotation?.lead_id) revalidatePath(`/leads/${quotation.lead_id}`)
    revalidatePath('/dashboard')
    return { error: null }
  } catch {
    return { error: 'Unexpected error' }
  }
}

export async function updateQuotationStage(
  id: string,
  stage: QuotationStage,
): Promise<{ error: string | null }> {
  try {
    const supabase = await createClient()
    const { error } = await supabase
      .from('quotations')
      .update({ stage })
      .eq('id', id)

    if (error) return { error: error.message }
    revalidatePath('/quotations')
    return { error: null }
  } catch {
    return { error: 'Unexpected error' }
  }
}

// ---------------------------------------------------------------------------
// UPDATE META (title, notes, stage) — admin or draft owner
// ---------------------------------------------------------------------------
export async function updateQuotationMeta(
  id: string,
  input: {
    title?: string | null
    notes?: string | null
    stage?: QuotationStage
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

    const { data: quotation } = await supabase
      .from('quotations')
      .select('created_by, stage')
      .eq('id', id)
      .single()

    if (!quotation) return { error: 'Quotation not found' }

    const isAdmin = profile?.role === 'admin'
    const isOwnerAndDraft = quotation.created_by === user.id && quotation.stage === 'Draft'

    if (!isAdmin && !isOwnerAndDraft) {
      return { error: 'Only admins or the owner of a Draft quotation can edit it' }
    }

    const updatePayload: Record<string, unknown> = {}
    if (input.title !== undefined) updatePayload.title = input.title || null
    if (input.notes !== undefined) updatePayload.notes = input.notes || null
    if (input.stage !== undefined && isAdmin) updatePayload.stage = input.stage

    const { error } = await supabase
      .from('quotations')
      .update(updatePayload)
      .eq('id', id)

    if (error) return { error: error.message }
    revalidatePath('/quotations')
    revalidatePath(`/quotations/${id}`)
    return { error: null }
  } catch {
    return { error: 'Unexpected error' }
  }
}

// ---------------------------------------------------------------------------
// UPDATE FULL (all fields + items) — admin or owner of Draft
// ---------------------------------------------------------------------------
export async function updateQuotationFull(
  id: string,
  input: {
    lead_id?: string | null
    customer_id?: string | null
    title?: string | null
    notes?: string | null
    stage?: QuotationStage
    freight_charges?: number
    items: QuotationItemInput[]
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

    const { data: quotation } = await supabase
      .from('quotations')
      .select('created_by, stage')
      .eq('id', id)
      .single()

    if (!quotation) return { error: 'Quotation not found' }

    const isAdmin = profile?.role === 'admin'
    const isOwnerAndDraft = quotation.created_by === user.id && quotation.stage === 'Draft'
    if (!isAdmin && !isOwnerAndDraft) {
      return { error: 'Only admins or the owner of a Draft quotation can edit it' }
    }

    if (input.items.length === 0) return { error: 'Add at least one item' }

    // Recalculate line items
    const calculatedItems = input.items.map((item) => {
      const line_base = item.unit_price * item.qty
      const line_discount = line_base * (item.discount_pct / 100)
      const taxable = line_base - line_discount
      const gst_amt = taxable * (item.gst_pct / 100)
      const line_total = taxable + gst_amt
      return { ...item, line_base, line_discount, taxable, gst_amt, line_total }
    })

    const subtotal       = calculatedItems.reduce((s, i) => s + i.line_base,     0)
    const discount_total = calculatedItems.reduce((s, i) => s + i.line_discount, 0)
    const gst_total      = calculatedItems.reduce((s, i) => s + i.gst_amt,       0)
    const freight_charges = input.freight_charges ?? 0
    const grand_total    = calculatedItems.reduce((s, i) => s + i.line_total,    0) + freight_charges

    const headerUpdate: Record<string, unknown> = {
      subtotal, discount_total, gst_total, freight_charges, grand_total,
    }
    if (input.title      !== undefined) headerUpdate.title       = input.title || null
    if (input.notes      !== undefined) headerUpdate.notes       = input.notes || null
    if (input.lead_id    !== undefined) headerUpdate.lead_id     = input.lead_id
    if (input.customer_id !== undefined) headerUpdate.customer_id = input.customer_id
    if (input.stage      !== undefined && isAdmin) headerUpdate.stage = input.stage

    const { error: headerErr } = await supabase
      .from('quotations')
      .update(headerUpdate)
      .eq('id', id)
    if (headerErr) return { error: headerErr.message }

    // Replace all items
    await supabase.from('quotation_items').delete().eq('quotation_id', id)

    const { error: itemsErr } = await supabase.from('quotation_items').insert(
      calculatedItems.map((item, idx) => ({
        quotation_id: id,
        product_id: item.product_id ?? null,
        is_custom: item.is_custom ?? false,
        custom_description: item.custom_description ?? null,
        name: item.name,
        sku: item.sku ?? '',
        image_url: item.image_url ?? null,
        qty: item.qty,
        unit_price: item.unit_price,
        discount_pct: item.discount_pct,
        gst_pct: item.gst_pct,
        line_base: item.line_base,
        line_discount: item.line_discount,
        taxable: item.taxable,
        gst_amt: item.gst_amt,
        line_total: item.line_total,
        sort_order: idx + 1,
      })),
    )
    if (itemsErr) return { error: itemsErr.message }

    revalidatePath('/quotations')
    revalidatePath(`/quotations/${id}`)
    return { error: null }
  } catch (err: unknown) {
    return { error: (err as Error).message ?? 'Unexpected error' }
  }
}
