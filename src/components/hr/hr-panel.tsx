'use client'

import { useState, useTransition, useEffect } from 'react'
import { format, parseISO, getDaysInMonth, getDay } from 'date-fns'
import { toast } from 'sonner'
import {
  Calendar,
  Clock,
  CheckCircle2,
  LogIn,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Plus,
  Award,
  X,
  AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  applyForLeave,
  cancelLeaveApplication,
  reviewLeaveApplication,
  grantLeaveBalance,
  clockIn,
  clockOut,
  markAttendance,
  getAttendanceHistory,
  getAttendanceSummary,
  getAllLeaveApplications,
  getAllEmployeesTodayAttendance,
} from '@/lib/actions/hr'
import type {
  Profile,
  LeaveType,
  LeaveBalanceFull,
  LeaveApplicationFull,
  AttendanceRecord,
  AttendanceRecordFull,
  AttendanceStatus,
  LeaveStatus,
} from '@/lib/types/database'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  Present:    { label: 'Present',   color: 'text-emerald-700', bg: 'bg-emerald-50', dot: 'bg-emerald-500' },
  Late:       { label: 'Late',      color: 'text-amber-700',   bg: 'bg-amber-50',   dot: 'bg-amber-500'   },
  'Half Day': { label: 'Half Day',  color: 'text-blue-700',    bg: 'bg-blue-50',    dot: 'bg-blue-500'    },
  Absent:     { label: 'Absent',    color: 'text-red-700',     bg: 'bg-red-50',     dot: 'bg-red-500'     },
  'On Leave': { label: 'On Leave',  color: 'text-purple-700',  bg: 'bg-purple-50',  dot: 'bg-purple-500'  },
  Holiday:    { label: 'Holiday',   color: 'text-sky-700',     bg: 'bg-sky-50',     dot: 'bg-sky-500'     },
  'Week Off': { label: 'Week Off',  color: 'text-zinc-600',    bg: 'bg-zinc-50',    dot: 'bg-zinc-400'    },
}

const LEAVE_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  Pending:   { label: 'Pending',   color: 'text-amber-700',   bg: 'bg-amber-50'  },
  Approved:  { label: 'Approved',  color: 'text-emerald-700', bg: 'bg-emerald-50' },
  Rejected:  { label: 'Rejected',  color: 'text-red-700',     bg: 'bg-red-50'    },
  Cancelled: { label: 'Cancelled', color: 'text-zinc-600',    bg: 'bg-zinc-100'  },
}

function formatTime(iso: string | null) {
  if (!iso) return '—'
  try { return format(parseISO(iso), 'hh:mm a') } catch { return '—' }
}

function initials(name: string | null) {
  if (!name) return '?'
  return name.split(' ').slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('')
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface HRPanelProps {
  profile: Profile
  isAdmin: boolean
  leaveTypes: LeaveType[]
  myBalances: LeaveBalanceFull[]
  myApplications: LeaveApplicationFull[]
  todayAttendance: AttendanceRecord | null
  attendanceHistory: AttendanceRecord[]
  attendanceSummary: { present: number; absent: number; late: number; onLeave: number; halfDay: number; totalWorkHours: number } | null
  allPendingApplications: LeaveApplicationFull[]
  todayAllAttendance: AttendanceRecordFull[]
  allEmployeeBalances: Array<{ employee: Profile; balances: LeaveBalanceFull[] }>
}

// ---------------------------------------------------------------------------
// Apply Leave Dialog
// ---------------------------------------------------------------------------
function ApplyLeaveDialog({
  leaveTypes, balances, onClose, onSuccess,
}: {
  leaveTypes: LeaveType[]
  balances: LeaveBalanceFull[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [pending, startT] = useTransition()
  const [form, setForm] = useState({
    leaveTypeId: leaveTypes[0]?.id ?? '',
    startDate: '',
    endDate: '',
    halfDay: false,
    reason: '',
  })
  const [err, setErr] = useState('')

  const selBal = balances.find((b) => b.leave_type_id === form.leaveTypeId)
  const available = selBal ? selBal.available_days : 0

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    if (!form.startDate || (!form.halfDay && !form.endDate)) { setErr('Please fill in all required fields'); return }
    startT(async () => {
      const r = await applyForLeave({
        leaveTypeId: form.leaveTypeId,
        startDate: form.startDate,
        endDate: form.halfDay ? form.startDate : form.endDate,
        halfDay: form.halfDay,
        reason: form.reason || undefined,
      })
      if (r.error) { setErr(r.error); return }
      toast.success('Leave applied! Pending admin approval.')
      onSuccess(); onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <h2 className="text-base font-semibold text-zinc-900">Apply for Leave</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-zinc-400 hover:bg-zinc-100"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Leave Type</label>
            <select className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-700"
              value={form.leaveTypeId} onChange={(e) => setForm((f) => ({ ...f, leaveTypeId: e.target.value }))}>
              {leaveTypes.map((lt) => {
                const b = balances.find((x) => x.leave_type_id === lt.id)
                return <option key={lt.id} value={lt.id}>{lt.name} ({b ? b.available_days : 0} days available)</option>
              })}
            </select>
            {selBal && (
              <div className="mt-1.5 flex gap-3 text-xs text-zinc-500">
                <span>Total: {selBal.total_days}d</span>
                <span>Used: {selBal.used_days}d</span>
                {selBal.pending_days > 0 && <span className="text-amber-600">Pending: {selBal.pending_days}d</span>}
                <span className="font-semibold text-zinc-700">Available: {available}d</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="halfDay" checked={form.halfDay}
              onChange={(e) => setForm((f) => ({ ...f, halfDay: e.target.checked }))}
              className="rounded border-zinc-300 text-blue-600" />
            <label htmlFor="halfDay" className="text-sm text-zinc-700">Half day leave</label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Start Date *</label>
              <input type="date" required value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-700" />
            </div>
            {!form.halfDay && (
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">End Date *</label>
                <input type="date" required min={form.startDate} value={form.endDate}
                  onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                  className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-700" />
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Reason (optional)</label>
            <textarea rows={3} value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              placeholder="Brief reason for leave..."
              className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-700" />
          </div>

          {err && (
            <p className="flex items-start gap-1.5 text-xs text-red-600">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />{err}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-zinc-300 text-sm font-medium text-zinc-700 hover:bg-zinc-50">Cancel</button>
            <button type="submit" disabled={pending || available <= 0}
              className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
              {pending ? 'Submitting...' : 'Apply Leave'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Grant Balance Dialog (Admin)
// ---------------------------------------------------------------------------
function GrantBalanceDialog({
  leaveTypes, employees, onClose, onSuccess,
}: {
  leaveTypes: LeaveType[]
  employees: Array<{ employee: Profile; balances: LeaveBalanceFull[] }>
  onClose: () => void
  onSuccess: () => void
}) {
  const [pending, startT] = useTransition()
  const [form, setForm] = useState({
    employeeId: employees[0]?.employee.id ?? '',
    leaveTypeId: leaveTypes[0]?.id ?? '',
    totalDays: 0,
    year: new Date().getFullYear(),
  })
  const [err, setErr] = useState('')

  useEffect(() => {
    const emp = employees.find((e) => e.employee.id === form.employeeId)
    const bal = emp?.balances.find((b) => b.leave_type_id === form.leaveTypeId)
    setForm((f) => ({ ...f, totalDays: bal?.total_days ?? leaveTypes.find((l) => l.id === f.leaveTypeId)?.default_days ?? 0 }))
  }, [form.employeeId, form.leaveTypeId, employees, leaveTypes])

  function submit(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    startT(async () => {
      const r = await grantLeaveBalance(form)
      if (r.error) { setErr(r.error); return }
      toast.success('Leave balance updated!')
      onSuccess(); onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <h2 className="text-base font-semibold text-zinc-900">Grant Leave Balance</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-zinc-400 hover:bg-zinc-100"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Employee</label>
            <select className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-700"
              value={form.employeeId} onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))}>
              {employees.map(({ employee: emp }) => (
                <option key={emp.id} value={emp.id}>{emp.name ?? emp.email} ({emp.role})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Leave Type</label>
            <select className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-700"
              value={form.leaveTypeId} onChange={(e) => setForm((f) => ({ ...f, leaveTypeId: e.target.value }))}>
              {leaveTypes.map((lt) => <option key={lt.id} value={lt.id}>{lt.name} (default: {lt.default_days}d)</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Total Days Granted</label>
              <input type="number" min={0} max={365} value={form.totalDays}
                onChange={(e) => setForm((f) => ({ ...f, totalDays: Number(e.target.value) }))}
                className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-700" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Year</label>
              <input type="number" min={2024} max={2030} value={form.year}
                onChange={(e) => setForm((f) => ({ ...f, year: Number(e.target.value) }))}
                className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-700" />
            </div>
          </div>
          {err && <p className="text-xs text-red-600">{err}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-zinc-300 text-sm font-medium text-zinc-700 hover:bg-zinc-50">Cancel</button>
            <button type="submit" disabled={pending} className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {pending ? 'Saving...' : 'Save Balance'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Review Dialog (Admin)
// ---------------------------------------------------------------------------
function ReviewDialog({
  application, onClose, onSuccess,
}: {
  application: LeaveApplicationFull
  onClose: () => void
  onSuccess: () => void
}) {
  const [pending, startT] = useTransition()
  const [note, setNote] = useState('')

  function submit(act: 'Approved' | 'Rejected') {
    startT(async () => {
      const r = await reviewLeaveApplication(application.id, act, note || undefined)
      if (r.error) { toast.error(r.error); return }
      toast.success(`Leave ${act.toLowerCase()} successfully`)
      onSuccess(); onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <h2 className="text-base font-semibold text-zinc-900">Review Leave Request</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-zinc-400 hover:bg-zinc-100"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-zinc-50 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-sm font-semibold text-blue-700 flex-shrink-0">
                {initials(application.employee?.name ?? null)}
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-900">{application.employee?.name ?? '—'}</p>
                <p className="text-xs text-zinc-400 capitalize">{application.employee?.role}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-zinc-600">
              <div><span className="font-medium text-zinc-700">Type:</span> {application.leave_type?.name}</div>
              <div><span className="font-medium text-zinc-700">Days:</span> {application.days_requested}{application.half_day ? ' (Half)' : ''}</div>
              <div><span className="font-medium text-zinc-700">From:</span> {format(parseISO(application.start_date), 'dd MMM yyyy')}</div>
              <div><span className="font-medium text-zinc-700">To:</span> {format(parseISO(application.end_date), 'dd MMM yyyy')}</div>
            </div>
            {application.reason && (
              <p className="text-xs text-zinc-600"><span className="font-medium text-zinc-700">Reason:</span> {application.reason}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Note for employee (optional)</label>
            <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note..."
              className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-700" />
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={() => submit('Rejected')} disabled={pending}
              className="flex-1 px-4 py-2 rounded-lg border border-red-300 text-red-600 text-sm font-medium hover:bg-red-50 disabled:opacity-50">
              Reject
            </button>
            <button onClick={() => submit('Approved')} disabled={pending}
              className="flex-1 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
              Approve
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Attendance Calendar
// ---------------------------------------------------------------------------
function AttendanceCalendar({
  employeeId, initialHistory, initialSummary,
}: {
  employeeId?: string
  initialHistory: AttendanceRecord[]
  initialSummary: { present: number; absent: number; late: number; onLeave: number; halfDay: number; totalWorkHours: number } | null
}) {
  const now = new Date()
  const [viewMonth, setViewMonth] = useState(now.getMonth())
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [history, setHistory] = useState(initialHistory)
  const [summary, setSummary] = useState(initialSummary)
  const [loading, setLoading] = useState(false)

  async function loadMonth(year: number, month: number) {
    setLoading(true)
    const [h, s] = await Promise.all([
      getAttendanceHistory(employeeId, year, month + 1),
      getAttendanceSummary(employeeId, year, month + 1),
    ])
    setHistory(h.data); setSummary(s.data); setLoading(false)
  }

  function prevMonth() {
    const d = new Date(viewYear, viewMonth - 1)
    setViewMonth(d.getMonth()); setViewYear(d.getFullYear())
    loadMonth(d.getFullYear(), d.getMonth())
  }
  function nextMonth() {
    const d = new Date(viewYear, viewMonth + 1)
    if (d > now) return
    setViewMonth(d.getMonth()); setViewYear(d.getFullYear())
    loadMonth(d.getFullYear(), d.getMonth())
  }

  const recMap = new Map(history.map((r) => [r.date, r]))
  const daysInMonth = getDaysInMonth(new Date(viewYear, viewMonth, 1))
  const startDow = getDay(new Date(viewYear, viewMonth, 1))

  return (
    <div className="space-y-4">
      {summary && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {[
            { label: 'Present',    value: summary.present,          color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Late',       value: summary.late,             color: 'text-amber-600',   bg: 'bg-amber-50'   },
            { label: 'Half Day',   value: summary.halfDay,          color: 'text-blue-600',    bg: 'bg-blue-50'    },
            { label: 'Absent',     value: summary.absent,           color: 'text-red-600',     bg: 'bg-red-50'     },
            { label: 'On Leave',   value: summary.onLeave,          color: 'text-purple-600',  bg: 'bg-purple-50'  },
            { label: 'Hrs Worked', value: `${summary.totalWorkHours}h`, color: 'text-zinc-700', bg: 'bg-zinc-50'  },
          ].map((s) => (
            <div key={s.label} className={cn('rounded-xl p-3 text-center', s.bg)}>
              <p className={cn('text-xl font-bold tabular-nums', s.color)}>{s.value}</p>
              <p className="text-xs text-zinc-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-100">
          <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-zinc-100 transition-colors">
            <ChevronLeft className="w-4 h-4 text-zinc-500" />
          </button>
          <h3 className="text-sm font-semibold text-zinc-900">
            {format(new Date(viewYear, viewMonth, 1), 'MMMM yyyy')}
          </h3>
          <button onClick={nextMonth} disabled={viewYear === now.getFullYear() && viewMonth === now.getMonth()}
            className="p-1.5 rounded-lg hover:bg-zinc-100 transition-colors disabled:opacity-30">
            <ChevronRight className="w-4 h-4 text-zinc-500" />
          </button>
        </div>

        <div className="p-4">
          <div className="grid grid-cols-7 mb-2">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
              <div key={d} className="text-center text-xs font-medium text-zinc-400 py-1">{d}</div>
            ))}
          </div>
          {loading ? (
            <div className="h-40 flex items-center justify-center text-sm text-zinc-400">Loading...</div>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: startDow }).map((_, i) => <div key={`e-${i}`} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1
                const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const dow = new Date(viewYear, viewMonth, day).getDay()
                const rec = recMap.get(dateStr) ?? null
                const cfg = rec ? STATUS_CONFIG[rec.status] : null
                const isToday = dateStr === now.toISOString().slice(0, 10)
                const isFuture = new Date(viewYear, viewMonth, day) > now
                const isSunday = dow === 0

                return (
                  <div key={day}
                    className={cn(
                      'aspect-square rounded-lg flex flex-col items-center justify-center text-xs',
                      isFuture ? 'opacity-40' : '',
                      cfg ? cfg.bg : isSunday ? 'bg-zinc-50' : '',
                      isToday ? 'ring-2 ring-blue-500 ring-offset-1' : '',
                    )}
                    title={rec?.status ?? (isSunday ? 'Sunday' : '')}
                  >
                    <span className={cn('font-medium', cfg ? cfg.color : 'text-zinc-600')}>{day}</span>
                    {cfg
                      ? <span className={cn('w-1.5 h-1.5 rounded-full mt-0.5', cfg.dot)} />
                      : isSunday
                        ? <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 mt-0.5" />
                        : null}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="px-4 pb-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-zinc-50">
          {(['Present', 'Late', 'Half Day', 'Absent', 'On Leave'] as const).map((k) => (
            <div key={k} className="flex items-center gap-1 text-xs text-zinc-500">
              <span className={cn('w-2 h-2 rounded-full', STATUS_CONFIG[k].dot)} />{k}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Leave Tab
// ---------------------------------------------------------------------------
function LeaveTab({
  isAdmin, leaveTypes, myBalances, myApplications,
  allPendingApplications, allEmployeeBalances, onRefresh,
}: {
  isAdmin: boolean
  leaveTypes: LeaveType[]
  myBalances: LeaveBalanceFull[]
  myApplications: LeaveApplicationFull[]
  allPendingApplications: LeaveApplicationFull[]
  allEmployeeBalances: Array<{ employee: Profile; balances: LeaveBalanceFull[] }>
  onRefresh: () => void
}) {
  const [applyOpen, setApplyOpen] = useState(false)
  const [grantOpen, setGrantOpen] = useState(false)
  const [reviewApp, setReviewApp] = useState<LeaveApplicationFull | null>(null)
  const [filter, setFilter] = useState<LeaveStatus | 'All'>('Pending')
  const [allApps, setAllApps] = useState(allPendingApplications)
  const [filterLoading, setFilterLoading] = useState(false)
  const [, startT] = useTransition()

  async function loadFilter(f: LeaveStatus | 'All') {
    setFilter(f); setFilterLoading(true)
    const r = await getAllLeaveApplications(f === 'All' ? undefined : f)
    setAllApps(r.data as LeaveApplicationFull[])
    setFilterLoading(false)
  }

  const year = new Date().getFullYear()

  return (
    <div className="space-y-6">
      {/* My Balances */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-zinc-900">My Leave Balance — {year}</h2>
          <button onClick={() => setApplyOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700">
            <Plus className="w-3.5 h-3.5" /> Apply Leave
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {myBalances.map((bal) => (
            <div key={bal.leave_type_id} className="bg-white rounded-xl border border-zinc-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: bal.leave_type?.color ?? '#3b82f6' }} />
                <p className="text-sm font-semibold text-zinc-900">{bal.leave_type?.name}</p>
              </div>
              <div className="flex items-end gap-1 mb-2">
                <span className="text-2xl font-bold text-zinc-900 tabular-nums">{bal.available_days}</span>
                <span className="text-sm text-zinc-400 mb-0.5">/ {bal.total_days} days</span>
              </div>
              <div className="w-full bg-zinc-100 rounded-full h-1.5 mb-2 overflow-hidden">
                <div className="h-1.5 rounded-full transition-all"
                  style={{
                    width: bal.total_days > 0 ? `${Math.min(100, (bal.available_days / bal.total_days) * 100)}%` : '0%',
                    background: bal.leave_type?.color ?? '#3b82f6',
                  }} />
              </div>
              <div className="flex justify-between text-xs text-zinc-400">
                <span>{bal.used_days}d used</span>
                {bal.pending_days > 0 && <span className="text-amber-600">{bal.pending_days}d pending approval</span>}
              </div>
            </div>
          ))}
          {myBalances.every((b) => b.total_days === 0) && (
            <div className="col-span-full py-8 text-center text-sm text-zinc-400 bg-white rounded-xl border border-zinc-200 border-dashed">
              No leave balances allocated yet. Contact your admin.
            </div>
          )}
        </div>
      </div>

      {/* Admin: All Leave Requests */}
      {isAdmin && (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h2 className="text-sm font-semibold text-zinc-900">Leave Requests</h2>
            <div className="flex items-center gap-1 flex-wrap">
              {(['Pending', 'Approved', 'Rejected', 'All'] as const).map((f) => (
                <button key={f} onClick={() => loadFilter(f)}
                  className={cn('px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
                    filter === f ? 'bg-blue-600 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200')}>
                  {f}
                </button>
              ))}
              <button onClick={() => setGrantOpen(true)}
                className="ml-1 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700">
                <Award className="w-3 h-3" /> Grant Balance
              </button>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
            {filterLoading ? (
              <div className="py-10 text-center text-sm text-zinc-400">Loading...</div>
            ) : allApps.length === 0 ? (
              <div className="py-10 text-center text-sm text-zinc-400">No {filter !== 'All' ? filter.toLowerCase() + ' ' : ''}leave requests</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 bg-zinc-50/50">
                      <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400">Employee</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400">Type</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400">Dates</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400">Days</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400">Status</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-zinc-400">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50">
                    {allApps.map((app) => {
                      const scfg = LEAVE_STATUS_CONFIG[app.status]
                      return (
                        <tr key={app.id} className="hover:bg-zinc-50/50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-semibold text-blue-700 flex-shrink-0">
                                {initials(app.employee?.name ?? null)}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-zinc-900 leading-tight">{app.employee?.name ?? '—'}</p>
                                <p className="text-xs text-zinc-400 capitalize">{app.employee?.role}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: app.leave_type?.color ?? '#3b82f6' }} />
                              <span className="text-sm text-zinc-700">{app.leave_type?.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-zinc-600 whitespace-nowrap">
                            {format(parseISO(app.start_date), 'dd MMM')} → {format(parseISO(app.end_date), 'dd MMM yy')}
                            {app.half_day && <span className="ml-1 text-xs text-zinc-400">(½)</span>}
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-zinc-900">{app.days_requested}d</td>
                          <td className="px-4 py-3">
                            <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', scfg.bg, scfg.color)}>{scfg.label}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {app.status === 'Pending' ? (
                              <button onClick={() => setReviewApp(app)}
                                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-zinc-100 text-zinc-700 hover:bg-zinc-200 transition-colors">
                                Review
                              </button>
                            ) : app.review_note ? (
                              <span className="text-xs text-zinc-400 italic" title={app.review_note}>{app.review_note.slice(0, 20)}{app.review_note.length > 20 ? '…' : ''}</span>
                            ) : null}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Admin: Employee balances overview */}
      {isAdmin && allEmployeeBalances.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 mb-3">Team Leave Balances — {year}</h2>
          <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50/50">
                    <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400">Employee</th>
                    {leaveTypes.slice(0, 4).map((lt) => (
                      <th key={lt.id} className="text-center px-4 py-3 text-xs font-medium text-zinc-400">
                        <div className="flex flex-col items-center gap-0.5">
                          <div className="w-2 h-2 rounded-full" style={{ background: lt.color }} />
                          {lt.name.split(' ')[0]}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {allEmployeeBalances.map(({ employee: emp, balances }) => (
                    <tr key={emp.id} className="hover:bg-zinc-50/50">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-zinc-900">{emp.name ?? emp.email}</p>
                        <p className="text-xs text-zinc-400 capitalize">{emp.role}</p>
                      </td>
                      {leaveTypes.slice(0, 4).map((lt) => {
                        const b = balances.find((x) => x.leave_type_id === lt.id)
                        const avail = b?.available_days ?? 0
                        const total = b?.total_days ?? 0
                        return (
                          <td key={lt.id} className="px-4 py-3 text-center">
                            <span className={cn('text-sm font-semibold tabular-nums', avail === 0 && total > 0 ? 'text-red-600' : avail <= 2 && total > 0 ? 'text-amber-600' : 'text-zinc-900')}>
                              {avail}
                            </span>
                            <span className="text-xs text-zinc-400">/{total}</span>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* My leave history */}
      <div>
        <h2 className="text-sm font-semibold text-zinc-900 mb-3">My Leave History</h2>
        <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
          {myApplications.length === 0 ? (
            <div className="py-10 text-center text-sm text-zinc-400">No leave applications yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50/50">
                    <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400">Type</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400">Dates</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400">Days</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400">Reason</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400">Status</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-zinc-400">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {myApplications.map((app) => {
                    const scfg = LEAVE_STATUS_CONFIG[app.status]
                    return (
                      <tr key={app.id} className="hover:bg-zinc-50/50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full" style={{ background: app.leave_type?.color ?? '#3b82f6' }} />
                            <span className="text-zinc-700">{app.leave_type?.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-zinc-600 whitespace-nowrap">
                          {format(parseISO(app.start_date), 'dd MMM')} – {format(parseISO(app.end_date), 'dd MMM yy')}
                          {app.half_day && <span className="ml-1 text-xs text-zinc-400">(½)</span>}
                        </td>
                        <td className="px-4 py-3 font-semibold text-zinc-900">{app.days_requested}d</td>
                        <td className="px-4 py-3 text-zinc-500 max-w-[140px] truncate">{app.reason ?? '—'}</td>
                        <td className="px-4 py-3">
                          <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', scfg.bg, scfg.color)}>{scfg.label}</span>
                          {app.review_note && <p className="text-xs text-zinc-400 mt-0.5 italic">{app.review_note}</p>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {app.status === 'Pending' && (
                            <button
                              onClick={() => startT(async () => {
                                const r = await cancelLeaveApplication(app.id)
                                if (r.error) toast.error(r.error)
                                else { toast.success('Leave cancelled'); onRefresh() }
                              })}
                              className="text-xs text-red-500 hover:text-red-700 hover:underline">
                              Cancel
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Dialogs */}
      {applyOpen && <ApplyLeaveDialog leaveTypes={leaveTypes} balances={myBalances} onClose={() => setApplyOpen(false)} onSuccess={onRefresh} />}
      {grantOpen && <GrantBalanceDialog leaveTypes={leaveTypes} employees={allEmployeeBalances} onClose={() => setGrantOpen(false)} onSuccess={onRefresh} />}
      {reviewApp && <ReviewDialog application={reviewApp} onClose={() => setReviewApp(null)} onSuccess={() => { loadFilter(filter); onRefresh() }} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Attendance Tab
// ---------------------------------------------------------------------------
function AttendanceTab({
  isAdmin, todayAttendance: initialToday, attendanceHistory, attendanceSummary, todayAllAttendance: initialTodayAll,
}: {
  isAdmin: boolean
  todayAttendance: AttendanceRecord | null
  attendanceHistory: AttendanceRecord[]
  attendanceSummary: { present: number; absent: number; late: number; onLeave: number; halfDay: number; totalWorkHours: number } | null
  todayAllAttendance: AttendanceRecordFull[]
}) {
  const [todayRecord, setTodayRecord] = useState(initialToday)
  const [todayAll, setTodayAll] = useState(initialTodayAll)
  const [clockPending, startClockT] = useTransition()
  const [, startMarkT] = useTransition()
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  async function refreshToday() {
    const m = await import('@/lib/actions/hr')
    const r = await m.getTodayAttendance()
    setTodayRecord(r.data)
  }

  async function refreshTodayAll() {
    const r = await getAllEmployeesTodayAttendance()
    setTodayAll(r.data as AttendanceRecordFull[])
  }

  const isClockedIn = !!todayRecord?.check_in
  const isClockedOut = !!todayRecord?.check_out
  const workHoursSoFar = todayRecord?.check_in && !todayRecord.check_out
    ? Math.round(((now.getTime() - new Date(todayRecord.check_in).getTime()) / 3_600_000) * 10) / 10
    : todayRecord?.work_hours ?? 0

  return (
    <div className="space-y-6">
      {/* Clock Card */}
      <div className="bg-white rounded-xl border border-zinc-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="flex-1">
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-1">Today</p>
            <p className="text-lg font-semibold text-zinc-900">{format(now, 'EEEE, dd MMMM yyyy')}</p>
            <div className="flex flex-wrap items-center gap-5 mt-4">
              {[
                { label: 'Clock In',     value: formatTime(todayRecord?.check_in ?? null) },
                { label: 'Clock Out',    value: formatTime(todayRecord?.check_out ?? null) },
                { label: 'Hours Worked', value: isClockedIn ? `${workHoursSoFar}h` : '—' },
              ].map((s) => (
                <div key={s.label}>
                  <p className="text-xs text-zinc-400">{s.label}</p>
                  <p className="text-sm font-semibold text-zinc-900 tabular-nums">{s.value}</p>
                </div>
              ))}
              {todayRecord?.status && (
                <div>
                  <p className="text-xs text-zinc-400">Status</p>
                  <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full',
                    STATUS_CONFIG[todayRecord.status]?.bg, STATUS_CONFIG[todayRecord.status]?.color)}>
                    {todayRecord.status}
                  </span>
                </div>
              )}
            </div>
          </div>
          <div>
            {!isClockedIn ? (
              <button onClick={() => startClockT(async () => {
                const r = await clockIn()
                if (r.error) toast.error(r.error)
                else { toast.success('Clocked in! Have a productive day.'); refreshToday() }
              })} disabled={clockPending}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50 shadow-sm transition-colors whitespace-nowrap">
                <LogIn className="w-4 h-4" />{clockPending ? 'Clocking In...' : 'Clock In'}
              </button>
            ) : !isClockedOut ? (
              <button onClick={() => startClockT(async () => {
                const r = await clockOut()
                if (r.error) toast.error(r.error)
                else { toast.success('Clocked out. Have a great evening!'); refreshToday() }
              })} disabled={clockPending}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 disabled:opacity-50 shadow-sm transition-colors whitespace-nowrap">
                <LogOut className="w-4 h-4" />{clockPending ? 'Clocking Out...' : 'Clock Out'}
              </button>
            ) : (
              <div className="flex items-center gap-2 px-6 py-3 rounded-xl bg-zinc-100 text-zinc-500 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Day Complete
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Admin: Team Today */}
      {isAdmin && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-zinc-900">Team Attendance — Today</h2>
            <button onClick={refreshTodayAll} className="text-xs text-blue-600 hover:underline">↻ Refresh</button>
          </div>
          <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50/50">
                    <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400">Employee</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400">Clock In</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400">Clock Out</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-zinc-400">Hours</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-zinc-400">Override</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {todayAll.map((rec) => {
                    const cfg = STATUS_CONFIG[rec.status]
                    return (
                      <tr key={rec.employee_id} className="hover:bg-zinc-50/50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-semibold text-blue-700 flex-shrink-0">
                              {initials(rec.employee?.name ?? null)}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-zinc-900">{rec.employee?.name ?? '—'}</p>
                              <p className="text-xs text-zinc-400">{rec.employee?.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', cfg?.bg, cfg?.color)}>
                            {rec.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-zinc-600 tabular-nums">{formatTime(rec.check_in)}</td>
                        <td className="px-4 py-3 text-sm text-zinc-600 tabular-nums">{formatTime(rec.check_out)}</td>
                        <td className="px-4 py-3 text-right text-sm text-zinc-600 tabular-nums">
                          {rec.work_hours ? `${rec.work_hours}h` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <select defaultValue=""
                            className="text-xs border border-zinc-200 rounded-lg px-2 py-1 bg-white text-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            onChange={async (e) => {
                              const status = e.target.value as AttendanceStatus
                              if (!status) return
                              startMarkT(async () => {
                                const r = await markAttendance({ employeeId: rec.employee_id, date: now.toISOString().slice(0, 10), status })
                                if (r.error) toast.error(r.error)
                                else { toast.success('Attendance updated'); refreshTodayAll() }
                                e.target.value = ''
                              })
                            }}>
                            <option value="">Mark as...</option>
                            {(['Present', 'Absent', 'Half Day', 'Late', 'On Leave', 'Holiday', 'Week Off'] as AttendanceStatus[]).map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* My Calendar */}
      <div>
        <h2 className="text-sm font-semibold text-zinc-900 mb-3">My Attendance History</h2>
        <AttendanceCalendar initialHistory={attendanceHistory} initialSummary={attendanceSummary} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Export
// ---------------------------------------------------------------------------
export function HRPanel({
  profile, isAdmin, leaveTypes, myBalances, myApplications,
  todayAttendance, attendanceHistory, attendanceSummary,
  allPendingApplications, todayAllAttendance, allEmployeeBalances,
}: HRPanelProps) {
  const [tab, setTab] = useState<'leave' | 'attendance'>('leave')
  const [key, setKey] = useState(0)

  const tabs = [
    { id: 'leave' as const,      label: 'Leave Management', icon: Calendar },
    { id: 'attendance' as const, label: 'Attendance',       icon: Clock    },
  ]

  return (
    <div className="space-y-5">
      <div className="flex gap-1 bg-zinc-100 rounded-xl p-1 w-fit">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={cn('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              tab === id ? 'bg-white text-zinc-900 shadow-sm border border-zinc-200' : 'text-zinc-500 hover:text-zinc-700')}>
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>

      {tab === 'leave' ? (
        <LeaveTab key={`leave-${key}`} isAdmin={isAdmin} leaveTypes={leaveTypes}
          myBalances={myBalances} myApplications={myApplications}
          allPendingApplications={allPendingApplications}
          allEmployeeBalances={allEmployeeBalances}
          onRefresh={() => setKey((k) => k + 1)} />
      ) : (
        <AttendanceTab key={`att-${key}`} isAdmin={isAdmin}
          todayAttendance={todayAttendance} attendanceHistory={attendanceHistory}
          attendanceSummary={attendanceSummary} todayAllAttendance={todayAllAttendance} />
      )}
    </div>
  )
}
