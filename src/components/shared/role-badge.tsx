import { cn } from '@/lib/utils'
import type { Role } from '@/lib/types/database'

const ROLE_STYLES: Record<Role, string> = {
  admin:       'bg-purple-100 text-purple-700 ring-purple-300/60',
  manager:     'bg-amber-100 text-amber-700 ring-amber-300/60',
  salesperson: 'bg-blue-100 text-blue-700 ring-blue-300/60',
}

const ROLE_LABELS: Record<Role, string> = {
  admin:       'Admin',
  manager:     'Manager',
  salesperson: 'Salesperson',
}

interface RoleBadgeProps {
  role: Role
  className?: string
}

export function RoleBadge({ role, className }: RoleBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ring-1',
        ROLE_STYLES[role] ?? 'bg-zinc-100 text-zinc-600 ring-zinc-300/60',
        className,
      )}
    >
      {ROLE_LABELS[role] ?? role}
    </span>
  )
}
