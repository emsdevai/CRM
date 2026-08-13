export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/shared/page-header'
import { AdminPanel } from '@/components/admin/admin-panel'
import { getCurrentProfile } from '@/lib/actions/dashboard'
import {
  getTeamMembers,
  getDiscountRules,
  getBusinessSettings,
  getManagersForAdmin,
} from '@/lib/actions/admin'
import type { Role } from '@/lib/types/database'

export default async function AdminPage() {
  // Auth + role guard
  const profileResult = await getCurrentProfile()
  if (!profileResult.data) redirect('/login')
  if (profileResult.data.role !== 'admin') redirect('/dashboard')

  const currentUserId = profileResult.data.id

  // Parallel data fetches
  const [teamResult, discountResult, settingsResult, managersResult] =
    await Promise.all([
      getTeamMembers(),
      getDiscountRules(),
      getBusinessSettings(),
      getManagersForAdmin(),
    ])

  const teamMembers = teamResult.data
  const discountRules = discountResult.data
  const businessSettings = (settingsResult.data as Record<string, unknown>) ?? {}
  const managers = managersResult.data

  return (
    <div className="space-y-5">
      <PageHeader
        title="Admin Panel"
        description="Manage your team, discount policies, and business settings"
      />

      <AdminPanel
        teamMembers={teamMembers as any}
        discountRules={discountRules as any}
        businessSettings={businessSettings}
        currentUserId={currentUserId}
        managers={managers}
      />
    </div>
  )
}
