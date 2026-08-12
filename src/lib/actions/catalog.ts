'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Offer, Profile, OfferInsert, OfferUpdate, Product } from '@/lib/types/database'

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

// ---------------------------------------------------------------------------
// getOffers — all offers (admin/manager see all; salesperson sees only active)
// ---------------------------------------------------------------------------
export async function getOffers(): Promise<{
  data: Offer[]
  error: string | null
}> {
  try {
    const { supabase, user, profile } = await getCurrentUserProfile()
    if (!user || !profile) return { data: [], error: 'Not authenticated' }

    let query = supabase
      .from('offers')
      .select('*')
      .order('created_at', { ascending: false })

    if (profile.role === 'salesperson') {
      query = query.eq('active', true)
    }

    const { data, error } = await query
    if (error) return { data: [], error: error.message }

    return { data: (data ?? []) as Offer[], error: null }
  } catch (err) {
    return { data: [], error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ---------------------------------------------------------------------------
// getActiveOffers — currently active offers (today within date range)
// ---------------------------------------------------------------------------
export async function getActiveOffers(): Promise<{
  data: Offer[]
  error: string | null
}> {
  try {
    const { supabase, user, profile } = await getCurrentUserProfile()
    if (!user || !profile) return { data: [], error: 'Not authenticated' }

    const today = new Date().toISOString().slice(0, 10)

    const { data, error } = await supabase
      .from('offers')
      .select('*')
      .eq('active', true)
      .or(`start_date.is.null,start_date.lte.${today}`)
      .or(`end_date.is.null,end_date.gte.${today}`)
      .order('created_at', { ascending: false })

    if (error) return { data: [], error: error.message }

    return { data: (data ?? []) as Offer[], error: null }
  } catch (err) {
    return { data: [], error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ---------------------------------------------------------------------------
// getCatalogProducts — products for the catalog view, with active offer info
// ---------------------------------------------------------------------------
export async function getCatalogProducts(category?: string): Promise<{
  data: (Product & { activeOffer: Offer | null })[]
  error: string | null
}> {
  try {
    const { supabase, user, profile } = await getCurrentUserProfile()
    if (!user || !profile) return { data: [], error: 'Not authenticated' }

    let productQuery = supabase
      .from('products')
      .select('*')
      .order('name', { ascending: true })

    if (category && category !== 'all') {
      productQuery = productQuery.eq('category', category)
    }

    const [{ data: productData, error: productErr }, { data: offerData }] =
      await Promise.all([
        productQuery,
        getActiveOffers(),
      ])

    if (productErr) return { data: [], error: productErr.message }

    const activeOffers = (offerData ?? []) as Offer[]

    // Strip cost/margin from salesperson view
    const products = ((productData ?? []) as Product[]).map((p) => {
      if (profile.role === 'salesperson') {
        const { cost: _c, margin_pct: _m, ...rest } = p
        return rest as Product
      }
      return p
    })

    // Match each product to an active offer (null if none)
    const result = products.map((p) => {
      const offer =
        activeOffers.find(
          (o) => o.category === null || o.category === p.category,
        ) ?? null
      return { ...p, activeOffer: offer }
    })

    return { data: result, error: null }
  } catch (err) {
    return { data: [], error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ---------------------------------------------------------------------------
// createOffer
// ---------------------------------------------------------------------------
export async function createOffer(
  payload: Omit<OfferInsert, 'created_by'>,
): Promise<{ data: Offer | null; error: string | null }> {
  try {
    const { supabase, user, profile } = await getCurrentUserProfile()
    if (!user || !profile) return { data: null, error: 'Not authenticated' }

    if (profile.role !== 'admin') {
      return { data: null, error: 'Only admins can create offers' }
    }

    const insert: OfferInsert = {
      ...payload,
      created_by: user.id,
      category: payload.category || null,
      start_date: payload.start_date || null,
      end_date: payload.end_date || null,
      discount_type: payload.discount_type || null,
      discount_value: payload.discount_value ?? null,
    }

    const { data, error } = await supabase
      .from('offers')
      .insert(insert)
      .select()
      .single()

    if (error) return { data: null, error: error.message }

    revalidatePath('/catalog')
    return { data: data as Offer, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ---------------------------------------------------------------------------
// updateOffer
// ---------------------------------------------------------------------------
export async function updateOffer(
  id: string,
  payload: OfferUpdate,
): Promise<{ data: Offer | null; error: string | null }> {
  try {
    const { supabase, user, profile } = await getCurrentUserProfile()
    if (!user || !profile) return { data: null, error: 'Not authenticated' }

    if (profile.role !== 'admin') {
      return { data: null, error: 'Only admins can update offers' }
    }

    const update: OfferUpdate = {
      ...payload,
      category: payload.category || null,
      start_date: payload.start_date || null,
      end_date: payload.end_date || null,
    }

    const { data, error } = await supabase
      .from('offers')
      .update(update)
      .eq('id', id)
      .select()
      .single()

    if (error) return { data: null, error: error.message }

    revalidatePath('/catalog')
    return { data: data as Offer, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ---------------------------------------------------------------------------
// deleteOffer
// ---------------------------------------------------------------------------
export async function deleteOffer(id: string): Promise<{ error: string | null }> {
  try {
    const { supabase, user, profile } = await getCurrentUserProfile()
    if (!user || !profile) return { error: 'Not authenticated' }

    if (profile.role !== 'admin') {
      return { error: 'Only admins can delete offers' }
    }

    const { error } = await supabase.from('offers').delete().eq('id', id)
    if (error) return { error: error.message }

    revalidatePath('/catalog')
    return { error: null }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ---------------------------------------------------------------------------
// toggleOfferActive
// ---------------------------------------------------------------------------
export async function toggleOfferActive(
  id: string,
  active: boolean,
): Promise<{ data: Offer | null; error: string | null }> {
  try {
    const { supabase, user, profile } = await getCurrentUserProfile()
    if (!user || !profile) return { data: null, error: 'Not authenticated' }

    if (profile.role !== 'admin') {
      return { data: null, error: 'Only admins can toggle offers' }
    }

    const { data, error } = await supabase
      .from('offers')
      .update({ active })
      .eq('id', id)
      .select()
      .single()

    if (error) return { data: null, error: error.message }

    revalidatePath('/catalog')
    return { data: data as Offer, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ---------------------------------------------------------------------------
// getPendingQuotations — for "Add to Existing Quote" in scan page
// ---------------------------------------------------------------------------
export async function getPendingQuotations(): Promise<{
  data: { id: string; created_at: string; grand_total: number; stage: string }[]
  error: string | null
}> {
  try {
    const { supabase, user, profile } = await getCurrentUserProfile()
    if (!user || !profile) return { data: [], error: 'Not authenticated' }

    const { data, error } = await supabase
      .from('quotations')
      .select('id, created_at, grand_total, stage')
      .in('stage', ['Draft', 'Pending Approval'])
      .eq('created_by', user.id)
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) return { data: [], error: error.message }

    return {
      data: (data ?? []) as { id: string; created_at: string; grand_total: number; stage: string }[],
      error: null,
    }
  } catch (err) {
    return { data: [], error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
