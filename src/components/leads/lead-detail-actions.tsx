'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Trophy, XCircle, FileText, X, Loader2, Trash2 } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { LeadForm } from '@/components/leads/lead-form'
import { setLeadStage, updateLead } from '@/app/(dashboard)/leads/actions'
import { deleteLead } from '@/lib/actions/leads'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import type { Lead, Profile, Role } from '@/lib/types/database'
import type { LeadFormValues } from '@/lib/validations'

interface LeadDetailActionsProps {
  lead: Lead
  salespeople: Profile[]
  userRole: Role
}

export function LeadDetailActions({
  lead,
  salespeople,
  userRole,
}: LeadDetailActionsProps) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [stageLoading, startStageTransition] = useTransition()
  const [editLoading, startEditTransition] = useTransition()
  const [deleteLoading, startDeleteTransition] = useTransition()

  function handleMarkWon() {
    if (lead.stage === 'Won') return
    startStageTransition(async () => {
      const result = await setLeadStage(lead.id, 'Won')
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Lead marked as Won!')
        router.refresh()
      }
    })
  }

  function handleMarkLost() {
    if (lead.stage === 'Lost') return
    startStageTransition(async () => {
      const result = await setLeadStage(lead.id, 'Lost')
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Lead marked as Lost')
        router.refresh()
      }
    })
  }

  function handleDeleteLead() {
    startDeleteTransition(async () => {
      const result = await deleteLead(lead.id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Lead deleted')
        router.push('/leads')
        router.refresh()
      }
    })
  }

  async function handleUpdateLead(data: LeadFormValues) {
    startEditTransition(async () => {
      const result = await updateLead(lead.id, data)
      if (result.error) {
        toast.error(`Failed to update: ${result.error}`)
      } else {
        toast.success('Lead updated')
        setEditOpen(false)
        router.refresh()
      }
    })
  }

  const actionBtn = (
    label: string,
    onClick: () => void,
    Icon: React.ElementType,
    variant: 'default' | 'green' | 'red' = 'default',
    disabled = false,
  ) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || stageLoading}
      className={cn(
        'w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variant === 'green'
          ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
          : variant === 'red'
          ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
          : 'bg-white border-zinc-300 text-zinc-700 hover:bg-zinc-50',
      )}
    >
      {stageLoading && (variant === 'green' || variant === 'red') ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Icon className="w-4 h-4" />
      )}
      {label}
    </button>
  )

  return (
    <>
      <div className="bg-white rounded-xl border border-zinc-200 p-4 space-y-2">
        <p className="text-sm font-semibold text-zinc-800 mb-3">Quick Actions</p>

        {/* Create Quotation */}
        <a
          href={`/quotations/new?lead_id=${lead.id}`}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 transition-colors"
        >
          <FileText className="w-4 h-4" />
          Create Quotation
        </a>

        {/* Edit Lead */}
        <button
          type="button"
          onClick={() => setEditOpen(true)}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 transition-colors"
        >
          <Pencil className="w-4 h-4" />
          Edit Lead
        </button>

        {/* Mark Won */}
        {actionBtn(
          'Mark Won',
          handleMarkWon,
          Trophy,
          'green',
          lead.stage === 'Won',
        )}

        {/* Mark Lost */}
        {actionBtn(
          'Mark Lost',
          handleMarkLost,
          XCircle,
          'red',
          lead.stage === 'Lost',
        )}

        {/* Delete Lead — admin only */}
        {userRole === 'admin' && (
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition-colors mt-2"
          >
            <Trash2 className="w-4 h-4" />
            Delete Lead
          </button>
        )}
      </div>

      {/* ── Delete Confirm ─────────────────────────────────────────────────── */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this lead?"
        description={`"${lead.name}" and all their activities will be permanently removed. This cannot be undone.`}
        confirmLabel="Delete Lead"
        variant="destructive"
        loading={deleteLoading}
        onConfirm={handleDeleteLead}
      />

      {/* ── Edit Dialog ─────────────────────────────────────────────────────── */}
      <Dialog.Root open={editOpen} onOpenChange={setEditOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
          <Dialog.Content
            className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-white shadow-xl flex flex-col overflow-y-auto"
            aria-describedby="edit-lead-desc"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 sticky top-0 bg-white z-10">
              <div>
                <Dialog.Title className="text-base font-semibold text-zinc-900">
                  Edit Lead
                </Dialog.Title>
                <Dialog.Description
                  id="edit-lead-desc"
                  className="text-xs text-zinc-500 mt-0.5"
                >
                  Update lead information below.
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
            <div className="flex-1 px-6 py-6">
              <LeadForm
                lead={lead}
                salespeople={
                  userRole !== 'salesperson' ? salespeople : undefined
                }
                onSubmit={handleUpdateLead}
                onCancel={() => setEditOpen(false)}
                loading={editLoading}
              />
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}
