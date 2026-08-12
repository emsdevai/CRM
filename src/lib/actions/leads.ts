'use server'

import { createClient } from '@/lib/supabase/server'
import type {
  Lead,
  LeadWithActivities,
  LeadStage,
  ActivityType,
  Profile,
  StageCount,
} from '@/lib/types/database'

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
// getLeads
// ---------------------------------------------------------------------------
export async function getLeads(filters: {
  stage?: LeadStage
  search?: string
  assignedTo?: string
  page?: number
  pageSize?: number
}): Promise<{
  data: (Lead & { assignee: Profile | null })[]
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
      .from('leads')
      .select('*, assignee:profiles!leads_assigned_to_fkey(*)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (!isAll) query = query.in('assigned_to', scopedIds)
    if (filters.stage) query = query.eq('stage', filters.stage)
    if (filters.assignedTo) query = query.eq('assigned_to', filters.assignedTo)
    if (filters.search) {
      query = query.or(
        `name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%,email.ilike.%${filters.search}%`,
      )
    }

    const { data, count, error } = await query
    if (error) return { data: [], count: 0, error: error.message }

    return {
      data: (data ?? []) as (Lead & { assignee: Profile | null })[],
      count: count ?? 0,
      error: null,
    }
  } catch (err) {
    return { data: [], count: 0, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ---------------------------------------------------------------------------
// getLeadById
// ---------------------------------------------------------------------------
export async function getLeadById(id: string): Promise<{
  data: LeadWithActivities | null
  error: string | null
}> {
  try {
    const { supabase, user, profile } = await getCurrentUserProfile()
    if (!user || !profile) return { data: null, error: 'Not authenticated' }

    const { data: lead, error: leadErr } = await supabase
      .from('leads')
      .select('*')
      .eq('id', id)
      .single()

    if (leadErr) return { data: null, error: leadErr.message }

    // Role-based access check
    const scopedIds = await getScopedUserIds(supabase, profile)
    const isAll = scopedIds.length === 0
    if (!isAll && lead.assigned_to && !scopedIds.includes(lead.assigned_to)) {
      return { data: null, error: 'Access denied' }
    }

    const { data: activities, error: actErr } = await supabase
      .from('lead_activities')
      .select('*')
      .eq('lead_id', id)
      .order('created_at', { ascending: false })

    if (actErr) return { data: null, error: actErr.message }

    return {
      data: { ...lead, activities: activities ?? [] } as LeadWithActivities,
      error: null,
    }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ---------------------------------------------------------------------------
// createLead
// ---------------------------------------------------------------------------
export async function createLead(data: {
  name: string
  phone: string
  email?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  stage?: LeadStage
  source?: string | null
  assigned_to?: string | null
  interested_categories?: string[]
  estimated_value?: number | null
  demographic?: Record<string, unknown>
  notes?: string | null
}): Promise<{ data: Lead | null; error: string | null }> {
  try {
    const { supabase, user, profile } = await getCurrentUserProfile()
    if (!user || !profile) return { data: null, error: 'Not authenticated' }

    // Salesperson can only assign to themselves
    const assignedTo =
      profile.role === 'salesperson' ? user.id : (data.assigned_to ?? user.id)

    const payload = {
      name: data.name,
      phone: data.phone,
      email: data.email ?? null,
      address: data.address ?? null,
      city: data.city ?? null,
      state: data.state ?? null,
      stage: data.stage ?? 'New',
      source: data.source ?? null,
      assigned_to: assignedTo,
      interested_categories: data.interested_categories ?? [],
      estimated_value: data.estimated_value ?? null,
      demographic: data.demographic ?? {},
      notes: data.notes ?? null,
      customer_id: null,
    }

    const { data: lead, error: insertErr } = await supabase
      .from('leads')
      .insert(payload)
      .select()
      .single()

    if (insertErr) return { data: null, error: insertErr.message }

    // Auto-insert creation activity
    await supabase.from('lead_activities').insert({
      lead_id: lead.id,
      type: 'created' as ActivityType,
      text: 'Lead created',
      by: user.id,
    })

    return { data: lead as Lead, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ---------------------------------------------------------------------------
// updateLead
// ---------------------------------------------------------------------------
export async function updateLead(
  id: string,
  data: Partial<Omit<Lead, 'id' | 'created_at' | 'updated_at'>>,
): Promise<{ data: Lead | null; error: string | null }> {
  try {
    const { supabase, user, profile } = await getCurrentUserProfile()
    if (!user || !profile) return { data: null, error: 'Not authenticated' }

    const { data: existing, error: fetchErr } = await supabase
      .from('leads')
      .select('assigned_to, stage')
      .eq('id', id)
      .single()

    if (fetchErr) return { data: null, error: fetchErr.message }

    const scopedIds = await getScopedUserIds(supabase, profile)
    const isAll = scopedIds.length === 0
    if (!isAll && existing.assigned_to && !scopedIds.includes(existing.assigned_to)) {
      return { data: null, error: 'Access denied' }
    }

    const { data: updated, error: updateErr } = await supabase
      .from('leads')
      .update(data)
      .eq('id', id)
      .select()
      .single()

    if (updateErr) return { data: null, error: updateErr.message }

    // If stage changed, insert activity
    if (data.stage && data.stage !== existing.stage) {
      await supabase.from('lead_activities').insert({
        lead_id: id,
        type: 'stage' as ActivityType,
        text: `Stage changed from "${existing.stage}" to "${data.stage}"`,
        by: user.id,
      })
    }

    return { data: updated as Lead, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ---------------------------------------------------------------------------
// updateLeadStage
// ---------------------------------------------------------------------------
export async function updateLeadStage(
  id: string,
  stage: LeadStage,
): Promise<{ data: Lead | null; error: string | null }> {
  try {
    const { supabase, user, profile } = await getCurrentUserProfile()
    if (!user || !profile) return { data: null, error: 'Not authenticated' }

    const { data: existing, error: fetchErr } = await supabase
      .from('leads')
      .select('assigned_to, stage')
      .eq('id', id)
      .single()

    if (fetchErr) return { data: null, error: fetchErr.message }

    const scopedIds = await getScopedUserIds(supabase, profile)
    const isAll = scopedIds.length === 0
    if (!isAll && existing.assigned_to && !scopedIds.includes(existing.assigned_to)) {
      return { data: null, error: 'Access denied' }
    }

    const { data: updated, error: updateErr } = await supabase
      .from('leads')
      .update({ stage })
      .eq('id', id)
      .select()
      .single()

    if (updateErr) return { data: null, error: updateErr.message }

    // Insert stage activity
    if (existing.stage !== stage) {
      await supabase.from('lead_activities').insert({
        lead_id: id,
        type: 'stage' as ActivityType,
        text: `Stage changed from "${existing.stage}" to "${stage}"`,
        by: user.id,
      })
    }

    return { data: updated as Lead, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ---------------------------------------------------------------------------
// deleteLead
// ---------------------------------------------------------------------------
export async function deleteLead(id: string): Promise<{ error: string | null }> {
  try {
    const { supabase, user, profile } = await getCurrentUserProfile()
    if (!user || !profile) return { error: 'Not authenticated' }

    if (profile.role === 'salesperson') return { error: 'Insufficient permissions' }

    const { error } = await supabase.from('leads').delete().eq('id', id)
    if (error) return { error: error.message }

    return { error: null }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ---------------------------------------------------------------------------
// addLeadActivity
// ---------------------------------------------------------------------------
export async function addLeadActivity(
  leadId: string,
  text: string,
  type: ActivityType,
): Promise<{ error: string | null }> {
  try {
    const { supabase, user, profile } = await getCurrentUserProfile()
    if (!user || !profile) return { error: 'Not authenticated' }

    const { error } = await supabase.from('lead_activities').insert({
      lead_id: leadId,
      type,
      text,
      by: user.id,
    })

    if (error) return { error: error.message }
    return { error: null }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ---------------------------------------------------------------------------
// getLeadStats — counts per stage (scoped)
// ---------------------------------------------------------------------------
export async function getLeadStats(): Promise<{
  data: StageCount[]
  error: string | null
}> {
  try {
    const { supabase, user, profile } = await getCurrentUserProfile()
    if (!user || !profile) return { data: [], error: 'Not authenticated' }

    const scopedIds = await getScopedUserIds(supabase, profile)
    const isAll = scopedIds.length === 0

    let query = supabase.from('leads').select('stage, estimated_value, assigned_to')
    if (!isAll) query = query.in('assigned_to', scopedIds)

    const { data, error } = await query
    if (error) return { data: [], error: error.message }

    const stages: LeadStage[] = [
      'New', 'Contacted', 'Qualified', 'Quotation Sent', 'Negotiation', 'Won', 'Lost',
    ]

    const grouped: Record<string, { count: number; value: number }> = {}
    for (const stage of stages) {
      grouped[stage] = { count: 0, value: 0 }
    }

    for (const lead of data ?? []) {
      if (grouped[lead.stage]) {
        grouped[lead.stage].count += 1
        grouped[lead.stage].value += lead.estimated_value ?? 0
      }
    }

    const result: StageCount[] = stages.map((stage) => ({
      stage,
      count: grouped[stage].count,
      value: grouped[stage].value,
    }))

    return { data: result, error: null }
  } catch (err) {
    return { data: [], error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
