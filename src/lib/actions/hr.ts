'use server'

import { createClient } from '@/lib/supabase/server'
import { createServerClient } from '@supabase/ssr'
import { revalidatePath } from 'next/cache'
import type {
  LeaveType,
  LeaveBalance,
  LeaveBalanceFull,
  LeaveApplication,
  LeaveApplicationFull,
  AttendanceRecord,
  AttendanceRecordFull,
  LeaveStatus,
  AttendanceStatus,
  Profile,
  StoreSettings,
} from '@/lib/types/database'

// ---------------------------------------------------------------------------
// Service client (bypasses RLS)
// ---------------------------------------------------------------------------
// NOTE: .trim() is essential — Vercel env vars can include a trailing \n which
// causes Headers.append to throw "invalid header value" for the Bearer token.
function createServiceClient() {
  return createServerClient(
    (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim(),
    (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim(),
    { cookies: { getAll: () => [], setAll: () => {} }, auth: { autoRefreshToken: false, persistSession: false } },
  )
}

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------
async function getCurrentUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  return { supabase, user, profile: profile as Profile }
}

function isAdminOrManager(profile: Profile) {
  return profile.role === 'admin' || profile.role === 'manager'
}

// ---------------------------------------------------------------------------
// STORE SETTINGS (geofence config)
// ---------------------------------------------------------------------------

export async function getStoreSettings(): Promise<{ data: StoreSettings | null; error: string | null }> {
  try {
    const service = createServiceClient()
    const { data, error } = await service
      .from('store_settings')
      .select('*')
      .eq('id', 1)
      .single()
    if (error) return { data: null, error: error.message }
    return { data: data as StoreSettings, error: null }
  } catch (err: any) {
    return { data: null, error: err.message }
  }
}

export async function saveStoreSettings(input: {
  geo_check_enabled: boolean
  geo_strict_mode: boolean
  store_latitude: number | null
  store_longitude: number | null
  radius_meters: number
}): Promise<{ error: string | null }> {
  try {
    const { user, profile } = await getCurrentUser()
    if (profile.role !== 'admin') throw new Error('Admin only')

    const service = createServiceClient()
    const { error } = await service
      .from('store_settings')
      .upsert(
        {
          id: 1,
          ...input,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      )
    if (error) return { error: error.message }
    revalidatePath('/hr')
    return { error: null }
  } catch (err: any) {
    return { error: err.message }
  }
}

// ---------------------------------------------------------------------------
// LEAVE TYPES
// ---------------------------------------------------------------------------
export async function getLeaveTypes(): Promise<{ data: LeaveType[]; error: string | null }> {
  try {
    const service = createServiceClient()
    const { data, error } = await service.from('leave_types').select('*').order('name')
    if (error) return { data: [], error: error.message }
    return { data: (data as LeaveType[]) ?? [], error: null }
  } catch (err: any) {
    return { data: [], error: err.message }
  }
}

// ---------------------------------------------------------------------------
// LEAVE BALANCES
// ---------------------------------------------------------------------------
export async function getMyLeaveBalances(year?: number): Promise<{ data: LeaveBalanceFull[]; error: string | null }> {
  try {
    const { user } = await getCurrentUser()
    const targetYear = year ?? new Date().getFullYear()
    const service = createServiceClient()

    const { data: types } = await service.from('leave_types').select('*').order('name')
    const { data: balances, error } = await service
      .from('leave_balances')
      .select('*')
      .eq('employee_id', user.id)
      .eq('year', targetYear)

    if (error) return { data: [], error: error.message }

    const leaveTypes = (types ?? []) as LeaveType[]
    const existingBalances = (balances ?? []) as LeaveBalance[]

    const result: LeaveBalanceFull[] = leaveTypes.map((lt) => {
      const bal = existingBalances.find((b) => b.leave_type_id === lt.id)
      return {
        id: bal?.id ?? '',
        employee_id: user.id,
        leave_type_id: lt.id,
        year: targetYear,
        total_days: bal?.total_days ?? 0,
        used_days: bal?.used_days ?? 0,
        pending_days: bal?.pending_days ?? 0,
        created_at: bal?.created_at ?? '',
        updated_at: bal?.updated_at ?? '',
        leave_type: lt,
        available_days: (bal?.total_days ?? 0) - (bal?.used_days ?? 0) - (bal?.pending_days ?? 0),
      }
    })

    return { data: result, error: null }
  } catch (err: any) {
    return { data: [], error: err.message }
  }
}

export async function getAllEmployeesLeaveBalances(year?: number): Promise<{
  data: Array<{ employee: Profile; balances: LeaveBalanceFull[] }>; error: string | null
}> {
  try {
    const { profile } = await getCurrentUser()
    if (!isAdminOrManager(profile)) throw new Error('Access denied')

    const targetYear = year ?? new Date().getFullYear()
    const service = createServiceClient()

    const { data: employees } = await service.from('profiles').select('*').order('name')
    const { data: types } = await service.from('leave_types').select('*').order('name')
    const { data: balances } = await service.from('leave_balances').select('*').eq('year', targetYear)

    const leaveTypes = (types ?? []) as LeaveType[]
    const allBalances = (balances ?? []) as LeaveBalance[]

    const result = ((employees ?? []) as Profile[]).map((emp) => {
      const empBalances: LeaveBalanceFull[] = leaveTypes.map((lt) => {
        const bal = allBalances.find((b) => b.employee_id === emp.id && b.leave_type_id === lt.id)
        return {
          id: bal?.id ?? '',
          employee_id: emp.id,
          leave_type_id: lt.id,
          year: targetYear,
          total_days: bal?.total_days ?? 0,
          used_days: bal?.used_days ?? 0,
          pending_days: bal?.pending_days ?? 0,
          created_at: bal?.created_at ?? '',
          updated_at: bal?.updated_at ?? '',
          leave_type: lt,
          available_days: (bal?.total_days ?? 0) - (bal?.used_days ?? 0) - (bal?.pending_days ?? 0),
        }
      })
      return { employee: emp, balances: empBalances }
    })

    return { data: result, error: null }
  } catch (err: any) {
    return { data: [], error: err.message }
  }
}

export async function grantLeaveBalance(input: {
  employeeId: string
  leaveTypeId: string
  totalDays: number
  year: number
}): Promise<{ error: string | null }> {
  try {
    const { profile } = await getCurrentUser()
    if (profile.role !== 'admin') throw new Error('Admin only')

    const service = createServiceClient()
    const { error } = await service.from('leave_balances').upsert(
      {
        employee_id: input.employeeId,
        leave_type_id: input.leaveTypeId,
        year: input.year,
        total_days: input.totalDays,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'employee_id,leave_type_id,year', ignoreDuplicates: false },
    )
    if (error) return { error: error.message }
    revalidatePath('/hr')
    return { error: null }
  } catch (err: any) {
    return { error: err.message }
  }
}

// ---------------------------------------------------------------------------
// LEAVE APPLICATIONS
// ---------------------------------------------------------------------------

// Calculate working days between two dates (Mon–Sat, excludes Sundays)
function calcWorkingDays(start: Date, end: Date): number {
  let count = 0
  const cur = new Date(start)
  while (cur <= end) {
    if (cur.getDay() !== 0) count++ // 0 = Sunday
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

export async function applyForLeave(input: {
  leaveTypeId: string
  startDate: string
  endDate: string
  halfDay?: boolean
  reason?: string
}): Promise<{ error: string | null }> {
  try {
    const { user, profile } = await getCurrentUser()
    const service = createServiceClient()
    const year = new Date(input.startDate).getFullYear()

    const start = new Date(input.startDate)
    const end = new Date(input.endDate)
    if (end < start) return { error: 'End date must be after start date' }

    const daysRequested = input.halfDay ? 0.5 : calcWorkingDays(start, end)
    if (daysRequested <= 0) return { error: 'No working days in selected range' }

    // Check balance
    const { data: bal } = await service
      .from('leave_balances')
      .select('*')
      .eq('employee_id', user.id)
      .eq('leave_type_id', input.leaveTypeId)
      .eq('year', year)
      .single()

    if (!bal) return { error: 'No leave balance allocated for this leave type. Please contact admin.' }

    const available = (bal.total_days as number) - (bal.used_days as number) - (bal.pending_days as number)
    if (daysRequested > available) {
      return { error: `Insufficient balance. You have ${available} day(s) available.` }
    }

    // Check for overlapping application
    const { data: overlap } = await service
      .from('leave_applications')
      .select('id')
      .eq('employee_id', user.id)
      .in('status', ['Pending', 'Approved'])
      .lte('start_date', input.endDate)
      .gte('end_date', input.startDate)
      .limit(1)

    if (overlap && overlap.length > 0) {
      return { error: 'You already have a leave application overlapping these dates.' }
    }

    // Insert application
    const { error: appErr } = await service.from('leave_applications').insert({
      employee_id: user.id,
      leave_type_id: input.leaveTypeId,
      start_date: input.startDate,
      end_date: input.endDate,
      days_requested: daysRequested,
      half_day: input.halfDay ?? false,
      reason: input.reason ?? null,
      status: 'Pending',
    })
    if (appErr) return { error: appErr.message }

    // Deduct from pending_days immediately
    const { error: balErr } = await service
      .from('leave_balances')
      .update({ pending_days: (bal.pending_days as number) + daysRequested, updated_at: new Date().toISOString() })
      .eq('id', bal.id)

    if (balErr) return { error: balErr.message }

    revalidatePath('/hr')
    return { error: null }
  } catch (err: any) {
    return { error: err.message }
  }
}

export async function cancelLeaveApplication(id: string): Promise<{ error: string | null }> {
  try {
    const { user } = await getCurrentUser()
    const service = createServiceClient()

    const { data: app, error: fetchErr } = await service
      .from('leave_applications')
      .select('*')
      .eq('id', id)
      .eq('employee_id', user.id)
      .single()

    if (fetchErr || !app) return { error: 'Application not found' }
    if ((app.status as string) !== 'Pending') return { error: 'Only pending applications can be cancelled' }

    const year = new Date(app.start_date as string).getFullYear()

    // Update status
    await service.from('leave_applications').update({ status: 'Cancelled', updated_at: new Date().toISOString() }).eq('id', id)

    // Refund pending_days
    const { data: bal } = await service
      .from('leave_balances')
      .select('*')
      .eq('employee_id', user.id)
      .eq('leave_type_id', app.leave_type_id as string)
      .eq('year', year)
      .single()

    if (bal) {
      const refunded = Math.max(0, (bal.pending_days as number) - (app.days_requested as number))
      await service.from('leave_balances').update({ pending_days: refunded, updated_at: new Date().toISOString() }).eq('id', bal.id)
    }

    revalidatePath('/hr')
    return { error: null }
  } catch (err: any) {
    return { error: err.message }
  }
}

export async function reviewLeaveApplication(
  id: string,
  action: 'Approved' | 'Rejected',
  note?: string,
): Promise<{ error: string | null }> {
  try {
    const { user, profile } = await getCurrentUser()
    if (!isAdminOrManager(profile)) throw new Error('Access denied')

    const service = createServiceClient()

    const { data: app, error: fetchErr } = await service
      .from('leave_applications')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchErr || !app) return { error: 'Application not found' }
    if ((app.status as string) !== 'Pending') return { error: 'Application is no longer pending' }

    const year = new Date(app.start_date as string).getFullYear()

    // Update application
    await service.from('leave_applications').update({
      status: action,
      reviewed_by: user.id,
      review_note: note ?? null,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', id)

    // Update balance
    const { data: bal } = await service
      .from('leave_balances')
      .select('*')
      .eq('employee_id', app.employee_id as string)
      .eq('leave_type_id', app.leave_type_id as string)
      .eq('year', year)
      .single()

    if (bal) {
      const pendingRefund = Math.max(0, (bal.pending_days as number) - (app.days_requested as number))
      if (action === 'Approved') {
        // Move from pending to used
        await service.from('leave_balances').update({
          used_days: (bal.used_days as number) + (app.days_requested as number),
          pending_days: pendingRefund,
          updated_at: new Date().toISOString(),
        }).eq('id', bal.id)
      } else {
        // Rejected: just refund pending
        await service.from('leave_balances').update({
          pending_days: pendingRefund,
          updated_at: new Date().toISOString(),
        }).eq('id', bal.id)
      }
    }

    revalidatePath('/hr')
    return { error: null }
  } catch (err: any) {
    return { error: err.message }
  }
}

export async function getMyLeaveApplications(): Promise<{ data: LeaveApplicationFull[]; error: string | null }> {
  try {
    const { user } = await getCurrentUser()
    const service = createServiceClient()

    const { data, error } = await service
      .from('leave_applications')
      .select('*')
      .eq('employee_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) return { data: [], error: error.message }

    const apps = (data ?? []) as LeaveApplication[]
    const { data: types } = await service.from('leave_types').select('*')
    const leaveTypes = (types ?? []) as LeaveType[]

    const result: LeaveApplicationFull[] = apps.map((a) => ({
      ...a,
      employee: null,
      leave_type: leaveTypes.find((lt) => lt.id === a.leave_type_id) ?? null,
      reviewer: null,
    }))

    return { data: result, error: null }
  } catch (err: any) {
    return { data: [], error: err.message }
  }
}

export async function getAllLeaveApplications(status?: LeaveStatus): Promise<{ data: LeaveApplicationFull[]; error: string | null }> {
  try {
    const { profile } = await getCurrentUser()
    if (!isAdminOrManager(profile)) throw new Error('Access denied')

    const service = createServiceClient()
    let query = service.from('leave_applications').select('*').order('created_at', { ascending: false }).limit(200)
    if (status) query = query.eq('status', status)

    const { data, error } = await query
    if (error) return { data: [], error: error.message }

    const apps = (data ?? []) as LeaveApplication[]
    const [{ data: employees }, { data: types }] = await Promise.all([
      service.from('profiles').select('id, name, email, role'),
      service.from('leave_types').select('*'),
    ])

    const empMap = new Map(((employees ?? []) as Profile[]).map((e) => [e.id, e]))
    const typeMap = new Map(((types ?? []) as LeaveType[]).map((t) => [t.id, t]))

    const result: LeaveApplicationFull[] = apps.map((a) => {
      const emp = empMap.get(a.employee_id)
      return {
        ...a,
        employee: emp ? { id: emp.id, name: emp.name, email: emp.email, role: emp.role } : null,
        leave_type: typeMap.get(a.leave_type_id) ?? null,
        reviewer: a.reviewed_by ? (empMap.get(a.reviewed_by) ? { id: a.reviewed_by, name: empMap.get(a.reviewed_by)!.name } : null) : null,
      }
    })

    return { data: result, error: null }
  } catch (err: any) {
    return { data: [], error: err.message }
  }
}

// ---------------------------------------------------------------------------
// ATTENDANCE
// ---------------------------------------------------------------------------

export async function getTodayAttendance(): Promise<{ data: AttendanceRecord | null; error: string | null }> {
  try {
    const { user } = await getCurrentUser()
    const service = createServiceClient()
    const today = new Date().toISOString().slice(0, 10)

    const { data, error } = await service
      .from('attendance_records')
      .select('*')
      .eq('employee_id', user.id)
      .eq('date', today)
      .single()

    if (error && error.code !== 'PGRST116') return { data: null, error: error.message }
    return { data: data as AttendanceRecord | null, error: null }
  } catch (err: any) {
    return { data: null, error: err.message }
  }
}

export async function clockIn(): Promise<{ error: string | null }> {
  try {
    const { user } = await getCurrentUser()
    const service = createServiceClient()
    const now = new Date()
    const today = now.toISOString().slice(0, 10)

    // Check if on approved leave today
    const { data: onLeave } = await service
      .from('leave_applications')
      .select('id')
      .eq('employee_id', user.id)
      .eq('status', 'Approved')
      .lte('start_date', today)
      .gte('end_date', today)
      .limit(1)

    if (onLeave && onLeave.length > 0) {
      return { error: 'You have an approved leave today. Cannot clock in.' }
    }

    // Check if already clocked in
    const { data: existing } = await service
      .from('attendance_records')
      .select('*')
      .eq('employee_id', user.id)
      .eq('date', today)
      .single()

    if (existing?.check_in) return { error: 'Already clocked in today' }

    // Determine status: Late if after 09:30
    const hours = now.getHours()
    const mins = now.getMinutes()
    const isLate = hours > 9 || (hours === 9 && mins > 30)

    if (existing) {
      await service.from('attendance_records').update({
        check_in: now.toISOString(),
        status: isLate ? 'Late' : 'Present',
        updated_at: now.toISOString(),
      }).eq('id', existing.id)
    } else {
      await service.from('attendance_records').insert({
        employee_id: user.id,
        date: today,
        check_in: now.toISOString(),
        status: isLate ? 'Late' : 'Present',
      })
    }

    revalidatePath('/hr')
    return { error: null }
  } catch (err: any) {
    return { error: err.message }
  }
}

export async function clockOut(): Promise<{ error: string | null }> {
  try {
    const { user } = await getCurrentUser()
    const service = createServiceClient()
    const now = new Date()
    const today = now.toISOString().slice(0, 10)

    const { data: record } = await service
      .from('attendance_records')
      .select('*')
      .eq('employee_id', user.id)
      .eq('date', today)
      .single()

    if (!record) return { error: 'No clock-in found for today' }
    if (!record.check_in) return { error: 'Please clock in first' }
    if (record.check_out) return { error: 'Already clocked out today' }

    const checkIn = new Date(record.check_in as string)
    const workHours = Math.round(((now.getTime() - checkIn.getTime()) / 3_600_000) * 100) / 100

    // Half day if worked < 4 hours
    let status = record.status as string
    if (workHours < 4 && status === 'Present') status = 'Half Day'
    if (workHours < 4 && status === 'Late') status = 'Half Day'

    await service.from('attendance_records').update({
      check_out: now.toISOString(),
      work_hours: workHours,
      status,
      updated_at: now.toISOString(),
    }).eq('id', record.id)

    revalidatePath('/hr')
    return { error: null }
  } catch (err: any) {
    return { error: err.message }
  }
}

export async function getAttendanceHistory(
  employeeId?: string,
  year?: number,
  month?: number,
): Promise<{ data: AttendanceRecord[]; error: string | null }> {
  try {
    const { user, profile } = await getCurrentUser()
    const service = createServiceClient()

    const targetId = (isAdminOrManager(profile) && employeeId) ? employeeId : user.id
    const now = new Date()
    const targetYear = year ?? now.getFullYear()
    const targetMonth = month ?? now.getMonth() + 1

    const startDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`
    const endDate = new Date(targetYear, targetMonth, 0).toISOString().slice(0, 10)

    const { data, error } = await service
      .from('attendance_records')
      .select('*')
      .eq('employee_id', targetId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false })

    if (error) return { data: [], error: error.message }
    return { data: (data ?? []) as AttendanceRecord[], error: null }
  } catch (err: any) {
    return { data: [], error: err.message }
  }
}

export async function markAttendance(input: {
  employeeId: string
  date: string
  status: AttendanceStatus
  notes?: string
}): Promise<{ error: string | null }> {
  try {
    const { user, profile } = await getCurrentUser()
    if (!isAdminOrManager(profile)) throw new Error('Access denied')

    const service = createServiceClient()

    const { data: existing } = await service
      .from('attendance_records')
      .select('id')
      .eq('employee_id', input.employeeId)
      .eq('date', input.date)
      .single()

    if (existing) {
      await service.from('attendance_records').update({
        status: input.status,
        notes: input.notes ?? null,
        marked_by: user.id,
        updated_at: new Date().toISOString(),
      }).eq('id', existing.id)
    } else {
      await service.from('attendance_records').insert({
        employee_id: input.employeeId,
        date: input.date,
        status: input.status,
        notes: input.notes ?? null,
        marked_by: user.id,
      })
    }

    revalidatePath('/hr')
    return { error: null }
  } catch (err: any) {
    return { error: err.message }
  }
}

export async function getAllEmployeesTodayAttendance(): Promise<{
  data: AttendanceRecordFull[]; error: string | null
}> {
  try {
    const { profile } = await getCurrentUser()
    if (!isAdminOrManager(profile)) throw new Error('Access denied')

    const service = createServiceClient()
    const today = new Date().toISOString().slice(0, 10)

    const [{ data: employees }, { data: records }] = await Promise.all([
      service.from('profiles').select('id, name, email, role').order('name'),
      service.from('attendance_records').select('*').eq('date', today),
    ])

    const recMap = new Map(((records ?? []) as AttendanceRecord[]).map((r) => [r.employee_id, r]))

    const result: AttendanceRecordFull[] = ((employees ?? []) as Profile[]).map((emp) => {
      const rec = recMap.get(emp.id)
      return rec
        ? { ...rec, employee: { id: emp.id, name: emp.name, email: emp.email } }
        : {
            id: '',
            employee_id: emp.id,
            date: today,
            check_in: null,
            check_out: null,
            status: 'Absent' as AttendanceStatus,
            work_hours: null,
            notes: null,
            marked_by: null,
            created_at: '',
            updated_at: '',
            employee: { id: emp.id, name: emp.name, email: emp.email },
          }
    })

    return { data: result, error: null }
  } catch (err: any) {
    return { data: [], error: err.message }
  }
}

export async function getAttendanceSummary(
  employeeId?: string,
  year?: number,
  month?: number,
): Promise<{
  data: { present: number; absent: number; late: number; onLeave: number; halfDay: number; totalWorkHours: number } | null
  error: string | null
}> {
  try {
    const { user, profile } = await getCurrentUser()
    const service = createServiceClient()

    const targetId = (isAdminOrManager(profile) && employeeId) ? employeeId : user.id
    const now = new Date()
    const targetYear = year ?? now.getFullYear()
    const targetMonth = month ?? now.getMonth() + 1

    const startDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`
    const endDate = new Date(targetYear, targetMonth, 0).toISOString().slice(0, 10)

    const { data, error } = await service
      .from('attendance_records')
      .select('status, work_hours')
      .eq('employee_id', targetId)
      .gte('date', startDate)
      .lte('date', endDate)

    if (error) return { data: null, error: error.message }

    const records = (data ?? []) as { status: string; work_hours: number | null }[]
    const summary = {
      present: records.filter((r) => r.status === 'Present').length,
      absent: records.filter((r) => r.status === 'Absent').length,
      late: records.filter((r) => r.status === 'Late').length,
      onLeave: records.filter((r) => r.status === 'On Leave').length,
      halfDay: records.filter((r) => r.status === 'Half Day').length,
      totalWorkHours: Math.round(records.reduce((s, r) => s + (r.work_hours ?? 0), 0) * 10) / 10,
    }

    return { data: summary, error: null }
  } catch (err: any) {
    return { data: null, error: err.message }
  }
}

// ---------------------------------------------------------------------------
// Delete attendance record (admin only — for demo/testing purposes)
// ---------------------------------------------------------------------------

export async function deleteAttendanceRecord(id: string): Promise<{ error: string | null }> {
  try {
    const { profile } = await getCurrentUser()
    if (profile.role !== 'admin') return { error: 'Admin access required' }

    const service = createServiceClient()
    const { error } = await service.from('attendance_records').delete().eq('id', id)
    if (error) return { error: error.message }

    revalidatePath('/hr')
    return { error: null }
  } catch (err: any) {
    return { error: err.message }
  }
}
