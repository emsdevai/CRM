import { cn } from '@/lib/utils'

const sizeMap = {
  sm: 'w-4 h-4 border-2',
  md: 'w-7 h-7 border-2',
  lg: 'w-10 h-10 border-[3px]',
} as const

interface LoadingSpinnerProps {
  size?: keyof typeof sizeMap
  className?: string
}

export function LoadingSpinner({
  size = 'md',
  className,
}: LoadingSpinnerProps) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        'inline-block rounded-full border-zinc-200 border-t-green-700 animate-spin',
        sizeMap[size],
        className,
      )}
      style={{ animationDuration: '0.65s' }}
    />
  )
}

export function PageLoader() {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-zinc-50/80 backdrop-blur-sm"
      role="status"
      aria-live="polite"
      aria-label="Loading page"
    >
      <LoadingSpinner size="lg" />
      <p className="mt-4 text-sm text-zinc-500 animate-pulse">Loading…</p>
    </div>
  )
}

export function InlineLoader({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex items-center justify-center py-12',
        className,
      )}
      role="status"
      aria-label="Loading"
    >
      <LoadingSpinner size="md" />
    </div>
  )
}
