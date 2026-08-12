'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus, Search, X, LayoutList, LayoutGrid, Filter } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import { toast } from 'sonner'
import { PageHeader } from '@/components/shared/page-header'
import { LeadForm } from '@/components/leads/lead-form'
import { LeadTable } from '@/components/leads/lead-table'
import { LeadPipeline } from '@/components/leads/lead-pipeline'
import { LEAD_STAGES } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { createLead } from '@/app/(dashboard)/leads/actions'
import type { LeadWithAssignee, Profile, Role } from '@/lib/types/database'
import type { LeadFormValues } from '@/lib/validations'

interface LeadStats {
  newCount: number
  inProgressCount: number
  wonThisMonth: number
  lostThisMonth: number
}

interface LeadsShellProps {
  leads: LeadWithAssignee[]
  salespeople: Profile[]
  stats: LeadStats
  currentView: 'list' | 'pipeline'
  currentStage: string
  currentSearch: string
  currentAssignee: string
  userRole: Role
}

export function LeadsShell({
  leads,
  salespeople,
  stats,
  currentView,
  currentStage,
  currentSearch,
  currentAssignee,
  userRole,
}: LeadsShellProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [isSubmitting, startSubmitTransition] = useTransition()

  // ── URL param helpers ─────────────────────────────────────────────────────
  function pushParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    router.push(`/leads?${params.toString()}`)
  }

  // ── Form submit ───────────────────────────────────────────────────────────
  async function handleCreateLead(data: LeadFormValues) {
    startSubmitTransition(async () => {
      const result = await createLead(data)
      if (result.error) {
        toast.error(`Failed to create lead: ${result.error}`)
      } else {
        toast.success('Lead created successfully')
        setDialogOpen(false)
        router.refresh()
      }
    })
  }

  // ── Stat card ─────────────────────────────────────────────────────────────
  function StatPill({
    label,
    value,
    accent,
  }: {
    label: string
    value: number
    accent: string
  }) {
    return (
      <div className="bg-white rounded-xl border border-zinc-200 px-4 py-3 flex items-center gap-3">
        <div className={cn('w-2 h-2 rounded-full flex-shrink-0', accent)} />
        <div>
          <p className="text-2xl font-bold text-zinc-900 leading-none tabular-nums">
            {value}
          </p>
          <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <PageHeader
        title="Leads"
        description="Track and manage your sales pipeline"
        actions={
          <Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}>
            <Dialog.Trigger asChild>
              <button
                className={cn(
                  'inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white',
                  'bg-green-700 hover:bg-green-800 rounded-lg transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700 focus-visible:ring-offset-2',
                )}
              >
                <Plus className="w-4 h-4" />
                Add Lead
              </button>
            </Dialog.Trigger>

            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
              <Dialog.Content
                className={cn(
                  'fixed inset-y-0 right-0 z-50 w-full max-w-xl',
                  'bg-white shadow-xl flex flex-col',
                  'overflow-y-auto',
                )}
                aria-describedby="add-lead-desc"
              >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 sticky top-0 bg-white z-10">
                  <div>
                    <Dialog.Title className="text-base font-semibold text-zinc-900">
                      Add New Lead
                    </Dialog.Title>
                    <Dialog.Description
                      id="add-lead-desc"
                      className="text-xs text-zinc-500 mt-0.5"
                    >
                      Fill in the details to add a new lead to the pipeline.
                    </Dialog.Description>
                  </div>
                  <Dialog.Close asChild>
                    <button
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
                      aria-label="Close"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </Dialog.Close>
                </div>

                {/* Form */}
                <div className="flex-1 px-6 py-6">
                  <LeadForm
                    salespeople={
                      userRole !== 'salesperson' ? salespeople : undefined
                    }
                    onSubmit={handleCreateLead}
                    onCancel={() => setDialogOpen(false)}
                    loading={isSubmitting}
                  />
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        }
      />

      {/* ── Stats row ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatPill label="New" value={stats.newCount} accent="bg-slate-400" />
        <StatPill
          label="In Progress"
          value={stats.inProgressCount}
          accent="bg-blue-500"
        />
        <StatPill
          label="Won This Month"
          value={stats.wonThisMonth}
          accent="bg-emerald-500"
        />
        <StatPill
          label="Lost This Month"
          value={stats.lostThisMonth}
          accent="bg-red-500"
        />
      </div>

      {/* ── Toolbar: Filters + View Toggle ──────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search leads…"
            defaultValue={currentSearch}
            onChange={e => pushParam('q', e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-zinc-300 text-sm text-zinc-900 bg-white outline-none focus:ring-2 focus:ring-green-700/25 focus:border-green-700 transition-shadow"
          />
        </div>

        {/* Stage filter */}
        <div className="relative">
          <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
          <select
            defaultValue={currentStage}
            onChange={e => pushParam('stage', e.target.value)}
            className="pl-8 pr-3 py-2 rounded-lg border border-zinc-300 text-sm text-zinc-900 bg-white outline-none focus:ring-2 focus:ring-green-700/25 focus:border-green-700 transition-shadow appearance-none"
          >
            <option value="">All Stages</option>
            {LEAD_STAGES.map(s => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {/* Assigned To filter (manager/admin only) */}
        {userRole !== 'salesperson' && salespeople.length > 0 && (
          <select
            defaultValue={currentAssignee}
            onChange={e => pushParam('assignee', e.target.value)}
            className="py-2 px-3 rounded-lg border border-zinc-300 text-sm text-zinc-900 bg-white outline-none focus:ring-2 focus:ring-green-700/25 focus:border-green-700 transition-shadow"
          >
            <option value="">All Salespeople</option>
            {salespeople.map(sp => (
              <option key={sp.id} value={sp.id}>
                {sp.name ?? sp.email}
              </option>
            ))}
          </select>
        )}

        {/* View toggle – pushed to the right */}
        <div className="flex items-center gap-1 ml-auto bg-zinc-100 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => pushParam('view', 'list')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              currentView === 'list'
                ? 'bg-white text-zinc-900 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-700',
            )}
          >
            <LayoutList className="w-4 h-4" />
            List
          </button>
          <button
            type="button"
            onClick={() => pushParam('view', 'pipeline')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              currentView === 'pipeline'
                ? 'bg-white text-zinc-900 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-700',
            )}
          >
            <LayoutGrid className="w-4 h-4" />
            Pipeline
          </button>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      {currentView === 'list' ? (
        <LeadTable leads={leads} />
      ) : (
        <LeadPipeline leads={leads} />
      )}
    </>
  )
}
