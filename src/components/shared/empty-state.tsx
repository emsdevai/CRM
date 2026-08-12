import type React from 'react'
import { type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

type ActionProp =
  | React.ReactNode
  | { label: string; onClick: () => void }

interface EmptyStateProps {
  /** Pass a Lucide icon component (e.g. FileText) or a pre-rendered ReactNode */
  icon: LucideIcon | React.ReactNode
  title: string
  description: string | React.ReactNode
  /** Either a { label, onClick } shorthand or a full ReactNode (e.g. <Link>) */
  action?: ActionProp
  className?: string
}

function isActionObject(
  action: ActionProp,
): action is { label: string; onClick: () => void } {
  return (
    typeof action === 'object' &&
    action !== null &&
    !('$$typeof' in (action as object)) &&
    'label' in (action as object) &&
    'onClick' in (action as object)
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  // Lucide icons are functions; JSX elements are objects
  const isComponent = typeof icon === 'function'
  const Icon = isComponent ? (icon as LucideIcon) : null

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-16 px-6 text-center',
        className,
      )}
    >
      <div className="w-14 h-14 rounded-2xl bg-zinc-100 flex items-center justify-center mb-4">
        {Icon
          ? <Icon className="w-7 h-7 text-zinc-400" />
          : icon as React.ReactNode
        }
      </div>

      <h3 className="text-sm font-semibold text-zinc-900 mb-1">{title}</h3>

      <p className="text-sm text-zinc-500 max-w-xs leading-relaxed">
        {description}
      </p>

      {action != null && (
        isActionObject(action)
          ? (
            <button
              type="button"
              onClick={action.onClick}
              className="mt-6 inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-white bg-green-700 hover:bg-green-800 active:bg-green-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700 focus-visible:ring-offset-2"
            >
              {action.label}
            </button>
          )
          : <div className="mt-6">{action as React.ReactNode}</div>
      )}
    </div>
  )
}
