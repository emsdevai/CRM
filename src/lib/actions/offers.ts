'use server'

import { createClient } from '@/lib/supabase/server'
import type { Offer, Profile } from '@/lib/types/database'

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
// getOffers — admin sees all, others see active only
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

    if (profile.role !== 'admin') {
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
// getActiveOffers — now is between start_date and end_date
// ---------------------------------------------------------------------------
export async function getActiveOffers(): Promise<{
  data: Offer[]
  error: string | null
}> {
  try {
    const { supabase, user } = await getCurrentUserProfile()
    if (!user) return { data: [], error: 'Not authenticated' }

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
// createOffer — admin only
// ---------------------------------------------------------------------------
export async function createOffer(data: {
  title: string
  category?: string | null
  discount_type?: 'percentage' | 'flat' | null
  discount_value?: number | null
  start_date?: string | null
  end_date?: string | null
  active?: boolean
}): Promise<{ data: Offer | null; error: string | null }> {
  try {
    const { supabase, user, profile } = await getCurrentUserProfile()
    if (!user || !profile) return { data: null, error: 'Not authenticated' }
    if (profile.role !== 'admin') return { data: null, error: 'Admin access required' }

    const { data: created, error: insertErr } = await supabase
      .from('offers')
      .insert({
        title: data.title,
        category: data.category ?? null,
        discount_type: data.discount_type ?? null,
        discount_value: data.discount_value ?? null,
        start_date: data.start_date ?? null,
        end_date: data.end_date ?? null,
        active: data.active ?? false,
        created_by: user.id,
      })
      .select()
      .single()

    if (insertErr) return { data: null, error: insertErr.message }

    return { data: created as Offer, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ---------------------------------------------------------------------------
// updateOffer — admin only
// ---------------------------------------------------------------------------
export async function updateOffer(
  id: string,
  data: Partial<Omit<Offer, 'id' | 'created_at' | 'updated_at' | 'created_by'>>,
): Promise<{ data: Offer | null; error: string | null }> {
  try {
    const { supabase, user, profile } = await getCurrentUserProfile()
    if (!user || !profile) return { data: null, error: 'Not authenticated' }
    if (profile.role !== 'admin') return { data: null, error: 'Admin access required' }

    const { data: updated, error: updateErr } = await supabase
      .from('offers')
      .update(data)
      .eq('id', id)
      .select()
      .single()

    if (updateErr) return { data: null, error: updateErr.message }

    return { data: updated as Offer, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ---------------------------------------------------------------------------
// deleteOffer — admin only
// ---------------------------------------------------------------------------
export async function deleteOffer(id: string): Promise<{ error: string | null }> {
  try {
    const { supabase, user, profile } = await getCurrentUserProfile()
    if (!user || !profile) return { error: 'Not authenticated' }
    if (profile.role !== 'admin') return { error: 'Admin access required' }

    const { error } = await supabase.from('offers').delete().eq('id', id)
    if (error) return { error: error.message }

    return { error: null }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ---------------------------------------------------------------------------
// toggleOffer — flip active boolean (admin only)
// ---------------------------------------------------------------------------
export async function toggleOffer(id: string): Promise<{
  data: Offer | null
  error: string | null
}> {
  try {
    const { supabase, user, profile } = await getCurrentUserProfile()
    if (!user || !profile) return { data: null, error: 'Not authenticated' }
    if (profile.role !== 'admin') return { data: null, error: 'Admin access required' }

    const { data: existing, error: fetchErr } = await supabase
      .from('offers')
      .select('active')
      .eq('id', id)
      .single()

    if (fetchErr) return { data: null, error: fetchErr.message }

    const { data: updated, error: updateErr } = await supabase
      .from('offers')
      .update({ active: !existing.active })
      .eq('id', id)
      .select()
      .single()

    if (updateErr) return { data: null, error: updateErr.message }

    return { data: updated as Offer, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ---------------------------------------------------------------------------
// getApplicableOffer — first active offer matching a category
// ---------------------------------------------------------------------------
export async function getApplicableOffer(category: string): Promise<{
  data: Offer | null
  error: string | null
}> {
  try {
    const { supabase, user } = await getCurrentUserProfile()
    if (!user) return { data: null, error: 'Not authenticated' }

    const today = new Date().toISOString().slice(0, 10)

    const { data, error } = await supabase
      .from('offers')
      .select('*')
      .eq('active', true)
      .eq('category', category)
      .or(`start_date.is.null,start_date.lte.${today}`)
      .or(`end_date.is.null,end_date.gte.${today}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) return { data: null, error: error.message }

    return { data: (data as Offer) ?? null, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
