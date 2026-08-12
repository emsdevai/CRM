'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { LeadFormValues } from '@/lib/validations'
import type { LeadStage, Profile } from '@/lib/types/database'

// ---------------------------------------------------------------------------
// Internal helper – get authenticated user + profile
// ---------------------------------------------------------------------------
async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profileData } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return { supabase, user, profile: profileData as Profile | null }
}

// ---------------------------------------------------------------------------
// createLead
// ---------------------------------------------------------------------------
export async function createLead(
  data: LeadFormValues,
): Promise<{ error?: string }> {
  const { supabase, user, profile } = await requireUser()
  if (!profile) return { error: 'Unauthorized' }

  const { data: newLead, error } = await supabase
    .from('leads')
    .insert({
      name: data.name,
      email: data.email || null,
      phone: data.phone,
      address: data.address || null,
      city: data.city || null,
      state: data.state || null,
      stage: data.stage ?? 'New',
      source: data.source || null,
      assigned_to:
        data.assigned_to ||
        (profile.role === 'salesperson' ? user.id : null),
      interested_categories: data.interested_categories ?? [],
      estimated_value: data.estimated_value ?? null,
      demographic: data.demographic ?? {},
      notes: data.notes || null,
      customer_id: null,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  // Log creation activity
  await supabase.from('lead_activities').insert({
    lead_id: newLead.id,
    type: 'created',
    text: 'Lead created',
    by: user.id,
  })

  revalidatePath('/leads')
  return {}
}

// ---------------------------------------------------------------------------
// updateLead
// ---------------------------------------------------------------------------
export async function updateLead(
  id: string,
  data: LeadFormValues,
): Promise<{ error?: string }> {
  const { supabase, user: _user, profile } = await requireUser()
  if (!profile) return { error: 'Unauthorized' }

  const { error } = await supabase
    .from('leads')
    .update({
      name: data.name,
      email: data.email || null,
      phone: data.phone,
      address: data.address || null,
      city: data.city || null,
      state: data.state || null,
      stage: data.stage,
      source: data.source || null,
      assigned_to: data.assigned_to || null,
      interested_categories: data.interested_categories ?? [],
      estimated_value: data.estimated_value ?? null,
      demographic: data.demographic ?? {},
      notes: data.notes || null,
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/leads')
  revalidatePath(`/leads/${id}`)
  return {}
}

// ---------------------------------------------------------------------------
// setLeadStage
// ---------------------------------------------------------------------------
export async function setLeadStage(
  id: string,
  stage: LeadStage,
): Promise<{ error?: string }> {
  const { supabase, user, profile } = await requireUser()
  if (!profile) return { error: 'Unauthorized' }

  const { data: existing } = await supabase
    .from('leads')
    .select('stage')
    .eq('id', id)
    .single()

  const { error } = await supabase
    .from('leads')
    .update({ stage })
    .eq('id', id)

  if (error) return { error: error.message }

  await supabase.from('lead_activities').insert({
    lead_id: id,
    type: 'stage',
    text: `Stage changed from ${existing?.stage ?? 'Unknown'} to ${stage}`,
    by: user.id,
  })

  revalidatePath('/leads')
  revalidatePath(`/leads/${id}`)
  return {}
}

// ---------------------------------------------------------------------------
// addNoteToLead
// ---------------------------------------------------------------------------
export async function addNoteToLead(
  leadId: string,
  note: string,
): Promise<{ error?: string }> {
  const { supabase, user, profile } = await requireUser()
  if (!profile) return { error: 'Unauthorized' }

  if (!note.trim()) return { error: 'Note cannot be empty' }

  const { error } = await supabase.from('lead_activities').insert({
    lead_id: leadId,
    type: 'note',
    text: note.trim(),
    by: user.id,
  })

  if (error) return { error: error.message }

  revalidatePath(`/leads/${leadId}`)
  return {}
}
