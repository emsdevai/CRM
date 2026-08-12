import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LeadsShell } from '@/components/leads/leads-shell'
import type { LeadWithAssignee, Profile, Role } from '@/lib/types/database'

interface LeadsPageProps {
  searchParams: Promise<{
    view?: string
    stage?: string
    q?: string
    assignee?: string
  }>
}

export default async function LeadsPage({ searchParams }: LeadsPageProps) {
  const params = await searchParams
  const view = params.view === 'pipeline' ? 'pipeline' : 'list'
  const stageFilter = params.stage ?? ''
  const searchQuery = params.q ?? ''
  const assigneeFilter = params.assignee ?? ''

  const supabase = await createClient()

  // ── Auth ──────────────────────────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profileData } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const profile = profileData as Profile | null
  if (!profile) redirect('/login')

  // ── Scope IDs ─────────────────────────────────────────────────────────────
  let scopeIds: string[] = []
  if (profile.role === 'salesperson') {
    scopeIds = [user.id]
  } else if (profile.role === 'manager') {
    const { data: team } = await supabase
      .from('profiles')
      .select('id')
      .eq('manager_id', user.id)
    scopeIds = [user.id, ...((team ?? []).map((t: { id: string }) => t.id))]
  }
  // admin: empty scopeIds = no filter = all leads

  // ── Fetch salespeople for filter + form ───────────────────────────────────
  let salespeopleQuery = supabase
    .from('profiles')
    .select('*')
    .in('role', ['salesperson', 'manager'])
    .order('name')

  if (profile.role === 'manager') {
    salespeopleQuery = salespeopleQuery.in('id', scopeIds)
  }

  const { data: salespeople } = await salespeopleQuery
  const typedSalespeople = (salespeople ?? []) as Profile[]

  // ── Fetch leads ───────────────────────────────────────────────────────────
  let leadsQuery = supabase
    .from('leads')
    .select('*, assignee:profiles!leads_assigned_to_fkey(*)')
    .order('created_at', { ascending: false })

  // Role-based scoping
  if (scopeIds.length > 0) {
    leadsQuery = leadsQuery.in('assigned_to', scopeIds)
  }

  // Filters
  if (stageFilter) {
    leadsQuery = leadsQuery.eq('stage', stageFilter)
  }
  if (searchQuery) {
    leadsQuery = leadsQuery.or(
      `name.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`,
    )
  }
  if (assigneeFilter && profile.role !== 'salesperson') {
    leadsQuery = leadsQuery.eq('assigned_to', assigneeFilter)
  }

  const { data: leadsData } = await leadsQuery

  const leads = (leadsData ?? []) as unknown as LeadWithAssignee[]

  // ── Compute stats (from unfiltered scope) ─────────────────────────────────
  let statsQuery = supabase.from('leads').select('stage, updated_at')
  if (scopeIds.length > 0) {
    statsQuery = statsQuery.in('assigned_to', scopeIds)
  }
  const { data: allLeads } = await statsQuery
  const allLeadsData = (allLeads ?? []) as Array<{
    stage: string
    updated_at: string
  }>

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const stats = {
    newCount: allLeadsData.filter(l => l.stage === 'New').length,
    inProgressCount: allLeadsData.filter(l =>
      ['Contacted', 'Qualified', 'Quotation Sent', 'Negotiation'].includes(
        l.stage,
      ),
    ).length,
    wonThisMonth: allLeadsData.filter(
      l =>
        l.stage === 'Won' && new Date(l.updated_at) >= monthStart,
    ).length,
    lostThisMonth: allLeadsData.filter(
      l =>
        l.stage === 'Lost' && new Date(l.updated_at) >= monthStart,
    ).length,
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-screen-xl mx-auto">
      <LeadsShell
        leads={leads}
        salespeople={typedSalespeople}
        stats={stats}
        currentView={view}
        currentStage={stageFilter}
        currentSearch={searchQuery}
        currentAssignee={assigneeFilter}
        userRole={profile.role as Role}
      />
    </div>
  )
}
