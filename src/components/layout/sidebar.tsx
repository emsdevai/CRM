'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Target,
  FileText,
  Users,
  UserCheck,
  Package,
  Tag,
  Scan,
  Receipt,
  BarChart3,
  Settings,
  LayoutGrid,
  LogOut,
  X,
  type LucideIcon,
} from 'lucide-react'
import { cn, getInitials } from '@/lib/utils'
import { NAV_ITEMS } from '@/lib/constants'
import { RoleBadge } from '@/components/shared/role-badge'
import { logout } from '@/app/(auth)/login/action'
import type { Profile } from '@/lib/types/database'

// ---------------------------------------------------------------------------
// Icon registry — covers every icon string used in NAV_ITEMS
// ---------------------------------------------------------------------------
const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  Target,
  FileText,
  Users,
  UserCheck,
  Package,
  Tag,
  Scan,
  Receipt,
  BarChart3,
  Settings,
  LayoutGrid,
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface SidebarProps {
  profile: Profile | null
  isOpen: boolean
  onClose: () => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function Sidebar({ profile, isOpen, onClose }: SidebarProps) {
  const pathname = usePathname()

  const filteredNavItems = NAV_ITEMS.filter((item) => {
    if (item.adminOnly && profile?.role !== 'admin') return false
    if (item.managerUp && profile?.role === 'salesperson') return false
    return true
  })

  const userInitials = getInitials(profile?.name)

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          aria-hidden="true"
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-zinc-950',
          'transition-transform duration-300 ease-in-out',
          // Desktop: always visible, not fixed
          'lg:static lg:z-auto lg:translate-x-0',
          // Mobile: slide in/out
          isOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-label="Sidebar navigation"
      >
        {/* ── Brand header ───────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-[18px] border-b border-zinc-800 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span
              className="text-2xl leading-none select-none"
              aria-hidden="true"
              role="img"
            >
              🛋
            </span>
            <div className="min-w-0">
              <p className="text-white font-bold text-sm leading-tight truncate">
                Jangir Brothers
              </p>
              <p className="text-zinc-400 text-xs leading-tight mt-0.5">
                CRM Suite
              </p>
            </div>
          </div>

          {/* Close button — mobile only */}
          <button
            type="button"
            onClick={onClose}
            className={cn(
              'lg:hidden flex-shrink-0 p-1.5 rounded-lg',
              'text-zinc-400 hover:text-white hover:bg-zinc-800',
              'transition-colors focus-visible:outline-none',
              'focus-visible:ring-2 focus-visible:ring-green-500',
            )}
            aria-label="Close navigation"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Navigation ─────────────────────────────────────────────── */}
        <nav
          className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5"
          aria-label="Main"
        >
          {filteredNavItems.map((item) => {
            const Icon = ICON_MAP[item.icon] ?? LayoutDashboard
            // Dashboard is an exact match; everything else is prefix
            const isActive =
              item.href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname.startsWith(item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium',
                  'transition-colors focus-visible:outline-none',
                  'focus-visible:ring-2 focus-visible:ring-green-500',
                  isActive
                    ? 'bg-zinc-800 text-green-400'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50',
                )}
              >
                <Icon
                  size={16}
                  className={cn(
                    'flex-shrink-0',
                    isActive ? 'text-green-400' : 'text-zinc-400',
                  )}
                  aria-hidden="true"
                />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* ── User section ───────────────────────────────────────────── */}
        <div className="border-t border-zinc-800 px-3 py-4 flex-shrink-0">
          {/* Avatar + name + role */}
          <div className="flex items-center gap-3 px-2 mb-3">
            <div
              className="w-9 h-9 rounded-full bg-green-700 flex items-center justify-center flex-shrink-0"
              aria-hidden="true"
            >
              <span className="text-white text-sm font-semibold leading-none">
                {userInitials}
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-white text-sm font-medium leading-tight truncate">
                {profile?.name ?? 'Unknown User'}
              </p>
              {profile?.role && (
                <div className="mt-1">
                  <RoleBadge role={profile.role} />
                </div>
              )}
            </div>
          </div>

          {/* Sign out */}
          <form action={logout}>
            <button
              type="submit"
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-lg',
                'text-sm font-medium text-zinc-400',
                'hover:text-white hover:bg-zinc-800/50',
                'transition-colors focus-visible:outline-none',
                'focus-visible:ring-2 focus-visible:ring-green-500',
              )}
            >
              <LogOut size={16} className="flex-shrink-0" aria-hidden="true" />
              Sign out
            </button>
          </form>
        </div>
      </aside>
    </>
  )
}
