'use client'

import { useTransition } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { LEAD_STAGES } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { setLeadStage } from '@/app/(dashboard)/leads/actions'
import type { LeadStage } from '@/lib/types/database'

interface StageStepperProps {
  leadId: string
  currentStage: LeadStage
}

export function StageStepper({ leadId, currentStage }: StageStepperProps) {
  const [isPending, startTransition] = useTransition()

  const currentIndex = LEAD_STAGES.indexOf(currentStage)

  function handleStageClick(stage: string) {
    if (stage === currentStage || isPending) return

    startTransition(async () => {
      const result = await setLeadStage(leadId, stage as LeadStage)
      if (result.error) {
        toast.error(`Failed to update stage: ${result.error}`)
      } else {
        toast.success(`Stage updated to ${stage}`)
      }
    })
  }

  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-zinc-800">Pipeline Stage</p>
        {isPending && (
          <Loader2 className="w-4 h-4 animate-spin text-green-700" />
        )}
      </div>

      <div className="space-y-1.5">
        {LEAD_STAGES.map((stage, index) => {
          const isCurrent = stage === currentStage
          const isPast =
            currentStage !== 'Lost' && index < currentIndex
          const isWon = stage === 'Won'
          const isLost = stage === 'Lost'

          let stateStyles = ''
          if (isCurrent) {
            if (isWon) {
              stateStyles =
                'bg-emerald-50 border-emerald-400 text-emerald-700 font-semibold'
            } else if (isLost) {
              stateStyles =
                'bg-red-50 border-red-400 text-red-700 font-semibold'
            } else {
              stateStyles =
                'bg-green-50 border-green-400 text-green-700 font-semibold'
            }
          } else if (isPast) {
            stateStyles =
              'bg-zinc-50 border-zinc-200 text-zinc-500'
          } else {
            stateStyles =
              'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50 hover:border-zinc-300'
          }

          return (
            <button
              key={stage}
              type="button"
              disabled={isPending || isCurrent}
              onClick={() => handleStageClick(stage)}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border text-sm transition-colors text-left',
                'disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700',
                stateStyles,
              )}
            >
              {/* Step indicator */}
              <div
                className={cn(
                  'w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-bold',
                  isCurrent && isWon
                    ? 'bg-emerald-500 text-white'
                    : isCurrent && isLost
                    ? 'bg-red-500 text-white'
                    : isCurrent
                    ? 'bg-green-700 text-white'
                    : isPast
                    ? 'bg-zinc-300 text-zinc-600'
                    : 'bg-zinc-100 text-zinc-500',
                )}
              >
                {isPast ? (
                  <Check className="w-3 h-3" />
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>

              <span>{stage}</span>

              {isCurrent && (
                <span className="ml-auto text-[10px] font-semibold uppercase tracking-wider opacity-60">
                  Current
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
