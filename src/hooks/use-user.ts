'use client'

import { useEffect, useState, useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import type { Profile, Role } from '@/lib/types/database'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface UseUserReturn {
  /** Raw Supabase auth user */
  user: User | null
  /** Profiles row for the current user */
  profile: Profile | null
  /** True while fetching user / profile */
  loading: boolean
  /** Convenience role guards */
  isAdmin: boolean
  isManager: boolean
  isSalesperson: boolean
  /** Only admin and manager can see cost / margin columns */
  canSeeMargin: boolean
  /**
   * Array of profile IDs whose data the current user can access:
   * - admin      → [] (empty means "all" – enforce in queries with no filter)
   * - manager    → [self, ...direct reports]
   * - salesperson → [self]
   */
  scopeIds: string[]
  /** Refresh profile from DB (e.g. after a profile update) */
  refresh: () => Promise<void>
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useUser(): UseUserReturn {
  const supabase = createClient()

  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [scopeIds, setScopeIds] = useState<string[]>([])

  const fetchProfile = useCallback(
    async (authUser: User) => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single()

      if (error || !data) {
        setProfile(null)
        setScopeIds([authUser.id])
        return
      }

      const p = data as Profile
      setProfile(p)

      if (p.role === 'admin') {
        // Admin sees all — empty scopeIds signals "no filter"
        setScopeIds([])
        return
      }

      if (p.role === 'manager') {
        // Manager sees self + all direct reports
        const { data: team } = await supabase
          .from('profiles')
          .select('id')
          .eq('manager_id', p.id)

        const teamIds = (team ?? []).map((t: { id: string }) => t.id)
        setScopeIds([p.id, ...teamIds])
        return
      }

      // Salesperson sees only themselves
      setScopeIds([p.id])
    },
    [supabase]
  )

  const refresh = useCallback(async () => {
    if (!user) return
    await fetchProfile(user)
  }, [user, fetchProfile])

  useEffect(() => {
    let mounted = true

    const init = async () => {
      setLoading(true)

      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()

      if (!mounted) return

      if (authUser) {
        setUser(authUser)
        await fetchProfile(authUser)
      } else {
        setUser(null)
        setProfile(null)
        setScopeIds([])
      }

      setLoading(false)
    }

    init()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return

      if (session?.user) {
        setUser(session.user)
        setLoading(true)
        await fetchProfile(session.user)
        setLoading(false)
      } else {
        setUser(null)
        setProfile(null)
        setScopeIds([])
        setLoading(false)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase, fetchProfile])

  const role: Role | null = profile?.role ?? null

  return {
    user,
    profile,
    loading,
    isAdmin: role === 'admin',
    isManager: role === 'manager',
    isSalesperson: role === 'salesperson',
    canSeeMargin: role === 'admin' || role === 'manager',
    scopeIds,
    refresh,
  }
}
