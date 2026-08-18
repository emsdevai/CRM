import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardShell } from '@/components/layout/dashboard-shell'
import type { Profile } from '@/lib/types/database'

// Demo profile used when NEXT_PUBLIC_DEMO_MODE=true
const DEMO_PROFILE: Profile = {
  id: 'demo-admin-id',
  name: 'Prashant Hinger',
  email: 'admin@jangirbros.com',
  role: 'admin',
  manager_id: null,
  phone: '+91 98765 43210',
  annual_target: 5000000,
  max_discount_pct: null,
  avatar_url: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // DEMO MODE: skip Supabase entirely, render with mock admin profile
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    return <DashboardShell profile={DEMO_PROFILE}>{children}</DashboardShell>
  }

  const supabase = await createClient()

  // ── Auth guard ────────────────────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // ── Profile fetch ─────────────────────────────────────────────────────────
  const { data: profileData, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error || !profileData) {
    redirect('/login')
  }

  const profile = profileData as Profile

  return <DashboardShell profile={profile}>{children}</DashboardShell>
}
