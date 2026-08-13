import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { Phone, Mail, MapPin, User, Calendar, IndianRupee } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/shared/page-header'
import { StageBadge } from '@/components/shared/status-badge'
import { ActivityLog } from '@/components/leads/activity-log'
import { StageStepper } from '@/components/leads/stage-stepper'
import { LeadDetailActions } from '@/components/leads/lead-detail-actions'
import { formatCurrency, formatDate, getInitials } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type {
  Lead,
  LeadActivity,
  Profile,
  Quotation,
  Role,
} from '@/lib/types/database'

interface LeadDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function LeadDetailPage({
  params,
}: LeadDetailPageProps) {
  const { id } = await params

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

  // ── Fetch lead ────────────────────────────────────────────────────────────
  const { data: leadData, error: leadError } = await supabase
    .from('leads')
    .select('*')
    .eq('id', id)
    .single()

  if (leadError || !leadData) notFound()
  const lead = leadData as Lead

  // ── Fetch activities ──────────────────────────────────────────────────────
  const { data: activitiesData } = await supabase
    .from('lead_activities')
    .select('*')
    .eq('lead_id', id)
    .order('created_at', { ascending: false })

  const activities = (activitiesData ?? []) as LeadActivity[]

  // ── Fetch all profiles for name resolution ────────────────────────────────
  const { data: allProfilesData } = await supabase
    .from('profiles')
    .select('*')

  const allProfiles = (allProfilesData ?? []) as Profile[]
  const profileMap = Object.fromEntries(allProfiles.map(p => [p.id, p]))

  const assignee = lead.assigned_to ? profileMap[lead.assigned_to] ?? null : null

  // ── Fetch quotations linked to this lead ──────────────────────────────────
  const { data: quotationsData } = await supabase
    .from('quotations')
    .select('id, stage, grand_total, created_at')
    .eq('lead_id', id)
    .order('created_at', { ascending: false })

  const quotations = (quotationsData ?? []) as Pick<
    Quotation,
    'id' | 'stage' | 'grand_total' | 'created_at'
  >[]

  // ── Salespeople for edit form ─────────────────────────────────────────────
  let salespeopleQuery = supabase
    .from('profiles')
    .select('*')
    .in('role', ['salesperson', 'manager'])
    .order('name')

  if (profile.role === 'manager') {
    const { data: team } = await supabase
      .from('profiles')
      .select('id')
      .eq('manager_id', user.id)
    const teamIds = [user.id, ...((team ?? []).map((t: { id: string }) => t.id))]
    salespeopleQuery = salespeopleQuery.in('id', teamIds)
  }

  const { data: salespeople } = await salespeopleQuery
  const typedSalespeople = (salespeople ?? []) as Profile[]

  // ── Demographic check ─────────────────────────────────────────────────────
  const demo = lead.demographic ?? {}
  const hasDemographics = Object.values(demo).some(
    v => v != null && v !== '',
  )

  // ── Section heading helper ─────────────────────────────────────────────────
  function SectionCard({
    title,
    children,
    className,
  }: {
    title: string
    children: React.ReactNode
    className?: string
  }) {
    return (
      <div className={cn('bg-white rounded-xl border border-zinc-200', className)}>
        <div className="px-4 py-3 border-b border-zinc-200">
          <p className="text-sm font-semibold text-zinc-800">{title}</p>
        </div>
        <div className="p-4">{children}</div>
      </div>
    )
  }

  function InfoRow({
    icon: Icon,
    label,
    value,
  }: {
    icon: React.ElementType
    label: string
    value: React.ReactNode
  }) {
    return (
      <div className="flex items-start gap-3 py-2 border-b border-zinc-100 last:border-0">
        <Icon className="w-4 h-4 text-zinc-400 mt-0.5 flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-xs text-zinc-500 mb-0.5">{label}</p>
          <div className="text-sm text-zinc-900">{value}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-screen-xl mx-auto">
      {/* ── Page Header ───────────────────────────────────────────────────── */}
      <PageHeader
        title={lead.name}
        breadcrumb={[
          { label: 'Leads', href: '/leads' },
          { label: lead.name },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <StageBadge stage={lead.stage} />
          </div>
        }
      />

      {/* ── Two-column layout ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left column (2/3) ──────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Lead Info Card */}
          <SectionCard title="Lead Information">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
              <InfoRow icon={User} label="Name" value={lead.name} />
              <InfoRow
                icon={Phone}
                label="Phone"
                value={
                  <a
                    href={`tel:${lead.phone}`}
                    className="text-blue-700 hover:underline"
                  >
                    {lead.phone}
                  </a>
                }
              />
              {lead.email && (
                <InfoRow
                  icon={Mail}
                  label="Email"
                  value={
                    <a
                      href={`mailto:${lead.email}`}
                      className="text-blue-700 hover:underline truncate block"
                    >
                      {lead.email}
                    </a>
                  }
                />
              )}
              {(lead.city || lead.state) && (
                <InfoRow
                  icon={MapPin}
                  label="Location"
                  value={[lead.city, lead.state].filter(Boolean).join(', ')}
                />
              )}
              {lead.address && (
                <InfoRow
                  icon={MapPin}
                  label="Address"
                  value={<span className="text-zinc-600">{lead.address}</span>}
                />
              )}
              <InfoRow
                icon={User}
                label="Source"
                value={lead.source ?? '—'}
              />
              <InfoRow
                icon={User}
                label="Assigned To"
                value={
                  assignee ? (
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold flex items-center justify-center">
                        {getInitials(assignee.name)}
                      </div>
                      <span>{assignee.name ?? assignee.email}</span>
                    </div>
                  ) : (
                    <span className="text-zinc-400">Unassigned</span>
                  )
                }
              />
              <InfoRow
                icon={Calendar}
                label="Created"
                value={formatDate(lead.created_at)}
              />
            </div>

            {lead.notes && (
              <div className="mt-3 pt-3 border-t border-zinc-100">
                <p className="text-xs text-zinc-500 mb-1">Notes</p>
                <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">
                  {lead.notes}
                </p>
              </div>
            )}
          </SectionCard>

          {/* Demographics */}
          {hasDemographics && (
            <SectionCard title="Customer Profile">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {demo.age_group && (
                  <div>
                    <p className="text-xs text-zinc-500 mb-0.5">Age Group</p>
                    <p className="text-sm font-medium text-zinc-900">
                      {demo.age_group}
                    </p>
                  </div>
                )}
                {demo.gender && (
                  <div>
                    <p className="text-xs text-zinc-500 mb-0.5">Gender</p>
                    <p className="text-sm font-medium text-zinc-900">
                      {demo.gender}
                    </p>
                  </div>
                )}
                {demo.occupation && (
                  <div>
                    <p className="text-xs text-zinc-500 mb-0.5">Occupation</p>
                    <p className="text-sm font-medium text-zinc-900">
                      {demo.occupation}
                    </p>
                  </div>
                )}
                {demo.income && (
                  <div>
                    <p className="text-xs text-zinc-500 mb-0.5">Income</p>
                    <p className="text-sm font-medium text-zinc-900">
                      {demo.income}
                    </p>
                  </div>
                )}
                {demo.home_type && (
                  <div>
                    <p className="text-xs text-zinc-500 mb-0.5">Home Type</p>
                    <p className="text-sm font-medium text-zinc-900">
                      {demo.home_type}
                    </p>
                  </div>
                )}
                {demo.family_size != null && (
                  <div>
                    <p className="text-xs text-zinc-500 mb-0.5">Family Size</p>
                    <p className="text-sm font-medium text-zinc-900">
                      {demo.family_size}
                    </p>
                  </div>
                )}
              </div>
            </SectionCard>
          )}

          {/* Interested Categories */}
          {lead.interested_categories.length > 0 && (
            <SectionCard title="Interested Categories">
              <div className="flex flex-wrap gap-2">
                {lead.interested_categories.map(cat => (
                  <span
                    key={cat}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-50 text-blue-700 border border-blue-200"
                  >
                    {cat}
                  </span>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Activity Log */}
          <ActivityLog
            activities={activities}
            profiles={allProfiles}
            leadId={id}
          />
        </div>

        {/* ── Right column (1/3) ─────────────────────────────────────────── */}
        <div className="space-y-5">

          {/* Estimated Value */}
          {lead.estimated_value != null && (
            <div className="bg-white rounded-xl border border-zinc-200 p-4">
              <p className="text-xs text-zinc-500 mb-1">Estimated Value</p>
              <div className="flex items-center gap-2">
                <IndianRupee className="w-5 h-5 text-blue-700" />
                <p className="text-2xl font-bold text-zinc-900 tabular-nums">
                  {formatCurrency(lead.estimated_value).replace('₹', '')}
                </p>
              </div>
            </div>
          )}

          {/* Stage Stepper */}
          <StageStepper leadId={id} currentStage={lead.stage} />

          {/* Quick Actions */}
          <LeadDetailActions
            lead={lead}
            salespeople={typedSalespeople}
            userRole={profile.role as Role}
          />

          {/* Linked Quotations */}
          <div className="bg-white rounded-xl border border-zinc-200">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200">
              <p className="text-sm font-semibold text-zinc-800">
                Quotations
              </p>
              <span className="text-xs font-medium text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-full">
                {quotations.length}
              </span>
            </div>

            {quotations.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <p className="text-sm text-zinc-500">No quotations yet</p>
                <a
                  href={`/quotations/new?lead_id=${id}`}
                  className="mt-2 inline-flex items-center text-xs font-medium text-blue-700 hover:underline"
                >
                  Create one →
                </a>
              </div>
            ) : (
              <div className="divide-y divide-zinc-100">
                {quotations.map(q => (
                  <Link
                    key={q.id}
                    href={`/quotations/${q.id}`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-zinc-50 transition-colors"
                  >
                    <div>
                      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                        {q.stage}
                      </p>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        {formatDate(q.created_at)}
                      </p>
                    </div>
                    {q.grand_total != null && (
                      <p className="text-sm font-semibold text-zinc-900 tabular-nums">
                        {formatCurrency(q.grand_total)}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
