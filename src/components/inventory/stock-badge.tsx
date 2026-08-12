import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react'
import { cn, stockStatus } from '@/lib/utils'

interface StockBadgeProps {
  stock: number
  reorderLevel: number
  showCount?: boolean
  size?: 'sm' | 'md'
  className?: string
}

export function StockBadge({
  stock,
  reorderLevel,
  showCount = true,
  size = 'sm',
  className,
}: StockBadgeProps) {
  const status = stockStatus(stock, reorderLevel)

  const config = {
    'in-stock': {
      label: 'In Stock',
      icon: CheckCircle,
      classes: 'bg-emerald-100 text-emerald-700 ring-emerald-300/50',
    },
    'low-stock': {
      label: 'Low Stock',
      icon: AlertTriangle,
      classes: 'bg-amber-100 text-amber-700 ring-amber-300/50',
    },
    'out-of-stock': {
      label: 'Out of Stock',
      icon: XCircle,
      classes: 'bg-red-100 text-red-700 ring-red-300/50',
    },
  }[status]

  const Icon = config.icon

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-medium ring-1 rounded-md',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
        config.classes,
        className,
      )}
    >
      <Icon className={cn('flex-shrink-0', size === 'sm' ? 'w-3 h-3' : 'w-4 h-4')} />
      {config.label}
      {showCount && (
        <span className="ml-0.5 opacity-75">({stock})</span>
      )}
    </span>
  )
}
