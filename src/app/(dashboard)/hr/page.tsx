export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/shared/page-header'
import { HRPanel } from '@/components/hr/hr-panel'
import { getCurrentProfile } from '@/lib/actions/dashboard'
import {
  getMyLeaveBalances,
  getAllLeaveApplications,
  getAllEmployeesTodayAttendance,
  getLeaveTypes,
  getAllEmployeesLeaveBalances,
  getMyLeaveApplications,
  getTodayAttendance,
  getAttendanceHistory,
  getAttendanceSummary,
} from '@/lib/actions/hr'

export default async function HRPage() {
  const profileResult = await getCurrentProfile()
  if (!profileResult.data) redirect('/login')
  const profile = profileResult.data
  const isAdmin = profile.role === 'admin' || profile.role === 'manager'

  const [
    leaveTypesResult,
    myBalancesResult,
    myApplicationsResult,
    todayAttendanceResult,
    attendanceHistoryResult,
    attendanceSummaryResult,
  ] = await Promise.all([
    getLeaveTypes(),
    getMyLeaveBalances(),
    getMyLeaveApplications(),
    getTodayAttendance(),
    getAttendanceHistory(),
    getAttendanceSummary(),
  ])

  // Admin-only fetches
  const [allApplicationsResult, todayAllResult, allBalancesResult] = await Promise.all([
    isAdmin ? getAllLeaveApplications('Pending') : Promise.resolve({ data: [] }),
    isAdmin ? getAllEmployeesTodayAttendance() : Promise.resolve({ data: [] }),
    isAdmin ? getAllEmployeesLeaveBalances() : Promise.resolve({ data: [] }),
  ])

  return (
    <div className="space-y-5">
      <PageHeader
        title="HR Management"
        description="Leave management, attendance tracking, and team insights"
      />
      <HRPanel
        profile={profile}
        isAdmin={isAdmin}
        leaveTypes={leaveTypesResult.data}
        myBalances={myBalancesResult.data}
        myApplications={myApplicationsResult.data}
        todayAttendance={todayAttendanceResult.data}
        attendanceHistory={attendanceHistoryResult.data}
        attendanceSummary={attendanceSummaryResult.data}
        allPendingApplications={allApplicationsResult.data as any}
        todayAllAttendance={todayAllResult.data as any}
        allEmployeeBalances={allBalancesResult.data as any}
      />
    </div>
  )
}
