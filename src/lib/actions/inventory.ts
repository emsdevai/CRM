'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Product, Profile, ProductInsert, ProductUpdate } from '@/lib/types/database'

// ---------------------------------------------------------------------------
// Helpers
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

function sanitizeForRole(products: Product[], role: Profile['role']): Product[] {
  if (role !== 'salesperson') return products
  return products.map((p) => {
    const { cost: _cost, margin_pct: _margin, ...rest } = p
    return rest as Product
  })
}

// ---------------------------------------------------------------------------
// getProducts — list with filters
// ---------------------------------------------------------------------------
export async function getProducts(filters: {
  category?: string
  type?: string
  stockStatus?: string
  search?: string
  page?: number
  pageSize?: number
} = {}): Promise<{
  data: Product[]
  count: number
  stats: {
    totalProducts: number
    inventoryValue: number
    outOfStockCount: number
    lowStockCount: number
  }
  error: string | null
}> {
  const emptyStats = {
    totalProducts: 0,
    inventoryValue: 0,
    outOfStockCount: 0,
    lowStockCount: 0,
  }

  try {
    const { supabase, user, profile } = await getCurrentUserProfile()
    if (!user || !profile) {
      return { data: [], count: 0, stats: emptyStats, error: 'Not authenticated' }
    }

    // ── Fetch ALL products for stats (no pagination, minimal columns) ──────
    let allQuery = supabase.from('products').select('id, stock, reorder_level, price')

    if (filters.category && filters.category !== 'all') {
      allQuery = allQuery.eq('category', filters.category)
    }
    if (filters.type && filters.type !== 'all') {
      allQuery = allQuery.eq('type', filters.type)
    }
    if (filters.search) {
      allQuery = allQuery.or(
        `name.ilike.%${filters.search}%,sku.ilike.%${filters.search}%`,
      )
    }

    const { data: allRaw } = await allQuery

    const all = (allRaw ?? []) as Pick<Product, 'id' | 'stock' | 'reorder_level' | 'price'>[]

    let filtered = all
    if (filters.stockStatus === 'out') {
      filtered = all.filter((p) => p.stock <= 0)
    } else if (filters.stockStatus === 'low') {
      filtered = all.filter((p) => p.stock > 0 && p.stock <= p.reorder_level)
    } else if (filters.stockStatus === 'in') {
      filtered = all.filter((p) => p.stock > p.reorder_level)
    }

    const stats = {
      totalProducts: all.length,
      inventoryValue: Math.round(
        all.reduce((s, p) => s + p.price * Math.max(0, p.stock), 0),
      ),
      outOfStockCount: all.filter((p) => p.stock <= 0).length,
      lowStockCount: all.filter((p) => p.stock > 0 && p.stock <= p.reorder_level).length,
    }

    // ── Paginated list of full product rows ───────────────────────────────
    const page = filters.page ?? 1
    const pageSize = filters.pageSize ?? 50
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const filteredIds = filtered.map((p) => p.id)

    if (filteredIds.length === 0) {
      return { data: [], count: 0, stats, error: null }
    }

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .in('id', filteredIds)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) {
      return { data: [], count: filtered.length, stats, error: error.message }
    }

    const products = sanitizeForRole((data ?? []) as Product[], profile.role)

    return {
      data: products,
      count: filtered.length,
      stats,
      error: null,
    }
  } catch (err) {
    return {
      data: [],
      count: 0,
      stats: emptyStats,
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}

// ---------------------------------------------------------------------------
// getProduct — single product by ID
// ---------------------------------------------------------------------------
export async function getProduct(id: string): Promise<{
  data: Product | null
  error: string | null
}> {
  try {
    const { supabase, user, profile } = await getCurrentUserProfile()
    if (!user || !profile) return { data: null, error: 'Not authenticated' }

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single()

    if (error) return { data: null, error: error.message }

    const product = sanitizeForRole([data as Product], profile.role)[0]
    return { data: product, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ---------------------------------------------------------------------------
// getProductByBarcode — lookup by barcode OR SKU (for scan page)
// ---------------------------------------------------------------------------
export async function getProductByBarcode(code: string): Promise<{
  data: Product | null
  error: string | null
}> {
  try {
    const { supabase, user, profile } = await getCurrentUserProfile()
    if (!user || !profile) return { data: null, error: 'Not authenticated' }

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .or(`barcode.eq.${code},sku.eq.${code}`)
      .limit(1)
      .maybeSingle()

    if (error) return { data: null, error: error.message }
    if (!data) return { data: null, error: 'Product not found' }

    const product = sanitizeForRole([data as Product], profile.role)[0]
    return { data: product, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ---------------------------------------------------------------------------
// createCustomizedProduct — no barcode, stores extra fields in metadata
// ---------------------------------------------------------------------------
import type { CustomizedProductMeta } from '@/lib/types/database'

export async function createCustomizedProduct(payload: {
  name: string
  category?: string | null
  subcategory?: string | null
  family?: string | null
  description?: string | null
  price: number
  cost?: number | null
  gst_pct: number
  metadata: CustomizedProductMeta
}): Promise<{ data: Product | null; error: string | null }> {
  try {
    const { supabase, user, profile } = await getCurrentUserProfile()
    if (!user || !profile) return { data: null, error: 'Not authenticated' }

    if (profile.role === 'salesperson') {
      return { data: null, error: 'Insufficient permissions' }
    }

    // Generate a SKU like CUST-260813-001
    const today = new Date()
    const datePart = today.toISOString().slice(2, 10).replace(/-/g, '')
    const { count } = await supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('type', 'customized')
    const seq = String((count ?? 0) + 1).padStart(3, '0')
    const sku = `CUST-${datePart}-${seq}`

    const insert = {
      sku,
      barcode: null,
      name: payload.name,
      category: payload.category || null,
      subcategory: payload.subcategory || null,
      family: payload.family || null,
      type: 'customized' as const,
      price: payload.price,
      cost: payload.cost ?? null,
      gst_pct: payload.gst_pct,
      margin_pct: null,
      stock: 0,
      reorder_level: 0,
      image_url: null,
      description: payload.description || null,
      metadata: payload.metadata,
      created_by: user.id,
    }

    const { data, error } = await supabase
      .from('products')
      .insert(insert)
      .select()
      .single()

    if (error) return { data: null, error: error.message }

    revalidatePath('/inventory')
    return { data: data as Product, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ---------------------------------------------------------------------------
// createProduct
// ---------------------------------------------------------------------------
export async function createProduct(payload: Omit<ProductInsert, 'created_by'>): Promise<{
  data: Product | null
  error: string | null
}> {
  try {
    const { supabase, user, profile } = await getCurrentUserProfile()
    if (!user || !profile) return { data: null, error: 'Not authenticated' }

    if (profile.role === 'salesperson') {
      return { data: null, error: 'Insufficient permissions' }
    }

    const insert: ProductInsert = {
      ...payload,
      created_by: user.id,
      barcode: payload.barcode || null,
      image_url: payload.image_url || null,
      description: payload.description || null,
      category: payload.category || null,
      subcategory: payload.subcategory || null,
      family: payload.family || null,
      type: payload.type || null,
      cost: payload.cost ?? null,      // already checked role !== 'salesperson' above
      margin_pct: payload.margin_pct ?? null,
      metadata: payload.metadata ?? null,
    }

    const { data, error } = await supabase
      .from('products')
      .insert(insert)
      .select()
      .single()

    if (error) return { data: null, error: error.message }

    revalidatePath('/inventory')
    return { data: data as Product, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ---------------------------------------------------------------------------
// updateProduct
// ---------------------------------------------------------------------------
export async function updateProduct(
  id: string,
  payload: ProductUpdate,
): Promise<{ data: Product | null; error: string | null }> {
  try {
    const { supabase, user, profile } = await getCurrentUserProfile()
    if (!user || !profile) return { data: null, error: 'Not authenticated' }

    if (profile.role === 'salesperson') {
      return { data: null, error: 'Insufficient permissions' }
    }

    // Salesperson-scoped fields never updated via form (isAdmin guard on form)
    const update: ProductUpdate = {
      ...payload,
      barcode: payload.barcode || null,
      image_url: payload.image_url || null,
      description: payload.description || null,
      category: payload.category || null,
      subcategory: payload.subcategory || null,
      family: payload.family || null,
    }

    // role is already confirmed non-salesperson by the guard above;
    // cost/margin are allowed for admin and manager
    const mutableUpdate = update as Record<string, unknown>
    if (payload.cost !== undefined) mutableUpdate.cost = payload.cost
    if (payload.margin_pct !== undefined) mutableUpdate.margin_pct = payload.margin_pct

    const { data, error } = await supabase
      .from('products')
      .update(update)
      .eq('id', id)
      .select()
      .single()

    if (error) return { data: null, error: error.message }

    revalidatePath('/inventory')
    revalidatePath(`/inventory/${id}`)
    return { data: data as Product, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ---------------------------------------------------------------------------
// deleteProduct
// ---------------------------------------------------------------------------
export async function deleteProduct(id: string): Promise<{ error: string | null }> {
  try {
    const { supabase, user, profile } = await getCurrentUserProfile()
    if (!user || !profile) return { error: 'Not authenticated' }

    if (profile.role !== 'admin') {
      return { error: 'Only admins can delete products' }
    }

    const { error } = await supabase.from('products').delete().eq('id', id)
    if (error) return { error: error.message }

    revalidatePath('/inventory')
    return { error: null }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ---------------------------------------------------------------------------
// adjustStock — add or subtract stock with a reason
// ---------------------------------------------------------------------------
export async function adjustStock(
  id: string,
  delta: number,
  reason: string,
): Promise<{ data: Product | null; error: string | null }> {
  try {
    const { supabase, user, profile } = await getCurrentUserProfile()
    if (!user || !profile) return { data: null, error: 'Not authenticated' }

    if (profile.role === 'salesperson') {
      return { data: null, error: 'Insufficient permissions' }
    }

    // Fetch current stock first
    const { data: current, error: fetchErr } = await supabase
      .from('products')
      .select('stock')
      .eq('id', id)
      .single()

    if (fetchErr || !current) {
      return { data: null, error: fetchErr?.message ?? 'Product not found' }
    }

    const newStock = Math.max(0, (current as { stock: number }).stock + delta)

    const { data, error } = await supabase
      .from('products')
      .update({ stock: newStock })
      .eq('id', id)
      .select()
      .single()

    if (error) return { data: null, error: error.message }

    revalidatePath('/inventory')
    revalidatePath(`/inventory/${id}`)
    return { data: data as Product, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ---------------------------------------------------------------------------
// bulkImportProducts — CSV import
// ---------------------------------------------------------------------------
export interface BulkImportRow {
  name: string
  sku: string
  category?: string
  subcategory?: string
  family?: string
  type?: string
  price: number
  cost?: number
  gst_pct?: number
  stock?: number
  reorder_level?: number
  description?: string
}

export async function bulkImportProducts(rows: BulkImportRow[]): Promise<{
  imported: number
  errors: { row: number; message: string }[]
  error: string | null
}> {
  try {
    const { supabase, user, profile } = await getCurrentUserProfile()
    if (!user || !profile) {
      return { imported: 0, errors: [], error: 'Not authenticated' }
    }

    if (profile.role === 'salesperson') {
      return { imported: 0, errors: [], error: 'Insufficient permissions' }
    }

    const errors: { row: number; message: string }[] = []
    const validRows: ProductInsert[] = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]

      if (!row.name?.trim()) {
        errors.push({ row: i + 1, message: 'Name is required' })
        continue
      }
      if (!row.sku?.trim()) {
        errors.push({ row: i + 1, message: 'SKU is required' })
        continue
      }
      if (!row.price || isNaN(Number(row.price)) || Number(row.price) <= 0) {
        errors.push({ row: i + 1, message: 'Valid price is required' })
        continue
      }

      validRows.push({
        name: row.name.trim(),
        sku: row.sku.trim().toUpperCase(),
        barcode: null,
        category: row.category?.trim() || null,
        subcategory: row.subcategory?.trim() || null,
        family: row.family?.trim() || null,
        type: (row.type as Product['type']) || null,
        price: Number(row.price),
        cost: row.cost != null ? Number(row.cost) : null,
        gst_pct: row.gst_pct != null ? Number(row.gst_pct) : 18,
        margin_pct: null,
        stock: row.stock != null ? Math.max(0, Math.floor(Number(row.stock))) : 0,
        reorder_level: row.reorder_level != null ? Math.max(0, Math.floor(Number(row.reorder_level))) : 5,
        image_url: null,
        description: row.description?.trim() || null,
        metadata: null,
        created_by: user.id,
      })
    }

    if (validRows.length === 0) {
      return { imported: 0, errors, error: null }
    }

    // Upsert by SKU to handle duplicates gracefully
    const { data, error } = await supabase
      .from('products')
      .upsert(validRows, { onConflict: 'sku', ignoreDuplicates: false })
      .select('id')

    if (error) {
      return { imported: 0, errors, error: error.message }
    }

    revalidatePath('/inventory')
    return {
      imported: (data ?? []).length,
      errors,
      error: null,
    }
  } catch (err) {
    return {
      imported: 0,
      errors: [],
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}
