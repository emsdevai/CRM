'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Download, Edit2, Plus, Save, X, Check, Package, Users, Percent, Building2, Trash2 } from 'lucide-react'
import * as Tabs from '@radix-ui/react-tabs'
import * as Dialog from '@radix-ui/react-dialog'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { cn, formatCurrency, getInitials, getRoleColor } from '@/lib/utils'
import { RoleBadge } from '@/components/shared/role-badge'
import { TeamMemberForm } from '@/components/admin/team-member-form'
import {
  updateDiscountRule,
  updateBusinessSettings,
  exportProductsCsv,
  exportLeadsCsv,
  exportInvoicesCsv,
  deleteTeamMember,
} from '@/lib/actions/admin'
import type { Profile, DiscountRule, Role } from '@/lib/types/database'

// ---------------------------------------------------------------------------
// Types passed from server
// ---------------------------------------------------------------------------
interface AdminPanelProps {
  teamMembers: Array<Profile & { manager?: { id: string; name: string | null } | null; total_sales?: number }>
  discountRules: DiscountRule[]
  businessSettings: Record<string, unknown>
  currentUserId: string
  managers: Array<{ id: string; name: string | null; role: Role }>
}

// ---------------------------------------------------------------------------
// Business Settings form schema
// ---------------------------------------------------------------------------
const settingsSchema = z.object({
  company_name: z.string().min(1, 'Required'),
  gst_number: z.string().optional(),
  pan_number: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  logo_url: z.string().optional(),
})
type SettingsFormValues = z.infer<typeof settingsSchema>

// ---------------------------------------------------------------------------
// Discount row edit state
// ---------------------------------------------------------------------------
interface DiscountEditState {
  min_pct: string
  max_pct: string
  requires_approval_above: string
}

// ---------------------------------------------------------------------------
// Helper input class
// ---------------------------------------------------------------------------
const inputCls = cn(
  'w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm',
  'placeholder:text-zinc-400 text-zinc-900',
  'focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600',
  'disabled:opacity-50',
)

// ---------------------------------------------------------------------------
// TabTrigger
// ---------------------------------------------------------------------------
function TabTrigger({ value, icon: Icon, label }: { value: string; icon: React.ElementType; label: string }) {
  return (
    <Tabs.Trigger
      value={value}
      className={cn(
        'flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors',
        'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100',
        'data-[state=active]:bg-white data-[state=active]:text-zinc-900',
        'data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-zinc-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
      )}
    >
      <Icon className="w-4 h-4" aria-hidden="true" />
      {label}
    </Tabs.Trigger>
  )
}

// ---------------------------------------------------------------------------
// TeamTab
// ---------------------------------------------------------------------------
function TeamTab({
  members,
  managers,
  currentUserId,
}: {
  members: AdminPanelProps['teamMembers']
  managers: AdminPanelProps['managers']
  currentUserId: string
}) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editMember, setEditMember] = useState<(typeof members)[0] | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  function openCreate() {
    setEditMember(null)
    setDialogOpen(true)
  }

  function openEdit(m: (typeof members)[0]) {
    setEditMember(m)
    setDialogOpen(true)
  }

  function handleSuccess() {
    setDialogOpen(false)
    setEditMember(null)
  }

  async function handleDelete(id: string) {
    setDeleting(true)
    const { error } = await deleteTeamMember(id)
    setDeleting(false)
    setConfirmDeleteId(null)
    if (error) toast.error(error)
    else toast.success('Team member deleted')
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">
          {members.length} team member{members.length !== 1 ? 's' : ''}
        </p>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Team Member
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50/50">
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400">Member</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400">Role</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 hidden md:table-cell">Manager</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 hidden lg:table-cell">Phone</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-zinc-400">Target</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-zinc-400 hidden md:table-cell">Total Sales</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-zinc-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {members.map((member) => (
                <tr key={member.id} className="hover:bg-zinc-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-semibold text-blue-700">
                          {getInitials(member.name)}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-zinc-900 leading-tight">
                          {member.name ?? '—'}
                        </p>
                        <p className="text-xs text-zinc-400 truncate">{member.email ?? '—'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <RoleBadge role={member.role} />
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-sm text-zinc-600">
                      {managers.find((m) => m.id === member.manager_id)?.name ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="text-sm text-zinc-600">{member.phone ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm tabular-nums text-zinc-700">
                      {formatCurrency(member.annual_target ?? 0)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right hidden md:table-cell">
                    <span className="text-sm tabular-nums text-zinc-700">
                      {formatCurrency((member as any).total_sales ?? 0)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(member)}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
                        title="Edit member"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {member.id !== currentUserId && (
                        confirmDeleteId === member.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDelete(member.id)}
                              disabled={deleting}
                              className="px-2 py-1 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                            >
                              {deleting ? '...' : 'Confirm'}
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-100 transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(member.id)}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Delete member"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dialog */}
      <Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
          <Dialog.Content
            className={cn(
              'fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
              'w-full max-w-md bg-white rounded-2xl shadow-xl p-6',
              'focus:outline-none',
            )}
          >
            <div className="flex items-center justify-between mb-5">
              <Dialog.Title className="text-base font-semibold text-zinc-900">
                {editMember ? 'Edit Team Member' : 'Add Team Member'}
              </Dialog.Title>
              <Dialog.Close asChild>
                <button className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </Dialog.Close>
            </div>

            <TeamMemberForm
              mode={editMember ? 'edit' : 'create'}
              member={editMember ?? undefined}
              managers={managers}
              currentUserId={currentUserId}
              onSuccess={handleSuccess}
              onCancel={() => setDialogOpen(false)}
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}

// ---------------------------------------------------------------------------
// DiscountTab
// ---------------------------------------------------------------------------
function DiscountTab({ rules }: { rules: DiscountRule[] }) {
  const [editId, setEditId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<DiscountEditState>({
    min_pct: '',
    max_pct: '',
    requires_approval_above: '',
  })
  const [saving, setSaving] = useState(false)

  function startEdit(rule: DiscountRule) {
    setEditId(rule.id)
    setEditValues({
      min_pct: String(rule.min_pct),
      max_pct: String(rule.max_pct),
      requires_approval_above: String(rule.requires_approval_above),
    })
  }

  async function saveEdit(rule: DiscountRule) {
    setSaving(true)
    try {
      const { error } = await updateDiscountRule(rule.role, {
        min_pct: Number(editValues.min_pct),
        max_pct: Number(editValues.max_pct),
        requires_approval_above: Number(editValues.requires_approval_above),
      })
      if (error) {
        toast.error(error)
        return
      }
      toast.success('Discount rule updated')
      setEditId(null)
    } finally {
      setSaving(false)
    }
  }

  const ROLE_LABELS: Record<string, string> = {
    admin: 'Admin',
    manager: 'Manager',
    salesperson: 'Salesperson',
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-500">
        Configure discount limits for each role. Exceeding the approval threshold requires manager sign-off.
      </p>

      {/* Admin note */}
      <div className="bg-purple-50 border border-purple-100 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Percent className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-purple-900">Admin Discount</p>
            <p className="text-xs text-purple-600 mt-0.5">
              Admins have unlimited discount authority (0–100%) and never require approval.
            </p>
          </div>
        </div>
      </div>

      {rules
        .filter((r) => r.role !== 'admin')
        .map((rule) => {
          const isEditing = editId === rule.id
          return (
            <div key={rule.id} className="bg-white rounded-xl border border-zinc-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className={cn(
                    'px-2 py-0.5 rounded-md text-xs font-medium',
                    getRoleColor(rule.role),
                  )}>
                    {ROLE_LABELS[rule.role] ?? rule.role}
                  </span>
                  <h3 className="text-sm font-semibold text-zinc-900">Discount Rules</h3>
                </div>
                {!isEditing ? (
                  <button
                    onClick={() => startEdit(rule)}
                    className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-700 px-3 py-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Edit
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditId(null)}
                      disabled={saving}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => saveEdit(rule)}
                      disabled={saving}
                      className="flex items-center gap-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Save
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5">
                    Min Discount (%)
                  </label>
                  {isEditing ? (
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={editValues.min_pct}
                      onChange={(e) =>
                        setEditValues((v) => ({ ...v, min_pct: e.target.value }))
                      }
                      className={inputCls}
                    />
                  ) : (
                    <p className="text-lg font-bold text-zinc-900">{rule.min_pct}%</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5">
                    Max Discount (%)
                  </label>
                  {isEditing ? (
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={editValues.max_pct}
                      onChange={(e) =>
                        setEditValues((v) => ({ ...v, max_pct: e.target.value }))
                      }
                      className={inputCls}
                    />
                  ) : (
                    <p className="text-lg font-bold text-zinc-900">{rule.max_pct}%</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5">
                    Approval Above (%)
                  </label>
                  {isEditing ? (
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={editValues.requires_approval_above}
                      onChange={(e) =>
                        setEditValues((v) => ({
                          ...v,
                          requires_approval_above: e.target.value,
                        }))
                      }
                      className={inputCls}
                    />
                  ) : (
                    <p className="text-lg font-bold text-amber-600">
                      {rule.requires_approval_above}%
                    </p>
                  )}
                </div>
              </div>

              {!isEditing && (
                <p className="mt-3 text-xs text-zinc-400">
                  Discounts above {rule.requires_approval_above}% require approval from a{' '}
                  {rule.role === 'salesperson' ? 'manager' : 'admin'}.
                </p>
              )}
            </div>
          )
        })}

      {/* Explanation table */}
      <div className="bg-zinc-50 rounded-xl border border-zinc-200 p-4">
        <h3 className="text-sm font-semibold text-zinc-700 mb-3">How Discounts Work</h3>
        <div className="space-y-2">
          {[
            { who: 'Salesperson', can: '0–10%', needs: 'Approval > 10%' },
            { who: 'Manager', can: '0–15%', needs: 'Approval > 15%' },
            { who: 'Admin', can: '0–100%', needs: 'No approval needed' },
          ].map((row) => (
            <div key={row.who} className="flex items-center justify-between text-xs">
              <span className="text-zinc-500">{row.who}</span>
              <span className="text-zinc-700 font-medium">Can apply: {row.can}</span>
              <span className="text-amber-600">{row.needs}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SettingsTab
// ---------------------------------------------------------------------------
function SettingsTab({ settings }: { settings: Record<string, unknown> }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      company_name: String(settings.company_name ?? 'Jangid Brothers'),
      gst_number: String(settings.gst_number ?? ''),
      pan_number: String(settings.pan_number ?? ''),
      address: String(settings.address ?? ''),
      phone: String(settings.phone ?? ''),
      logo_url: String(settings.logo_url ?? ''),
    },
  })

  async function onSubmit(values: SettingsFormValues) {
    const { error } = await updateBusinessSettings(values)
    if (error) {
      toast.error(error)
      return
    }
    toast.success('Business settings saved')
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="bg-white rounded-xl border border-zinc-200 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-zinc-900">Company Information</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-zinc-700">
              Company Name <span className="text-red-500">*</span>
            </label>
            <input
              {...register('company_name')}
              type="text"
              className={inputCls}
              placeholder="Jangid Brothers"
            />
            {errors.company_name && (
              <p className="text-xs text-red-600">{errors.company_name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-zinc-700">GST Number</label>
            <input
              {...register('gst_number')}
              type="text"
              className={inputCls}
              placeholder="29ABCDE1234F1Z5"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-zinc-700">PAN Number</label>
            <input
              {...register('pan_number')}
              type="text"
              className={inputCls}
              placeholder="ABCDE1234F"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-zinc-700">Company Phone</label>
            <input
              {...register('phone')}
              type="tel"
              className={inputCls}
              placeholder="+91 98765 43210"
            />
          </div>

          <div className="md:col-span-2 space-y-1.5">
            <label className="block text-sm font-medium text-zinc-700">Address</label>
            <textarea
              {...register('address')}
              rows={3}
              className={cn(inputCls, 'resize-none')}
              placeholder="123 Main Street, City, State - 000000"
            />
          </div>

          <div className="md:col-span-2 space-y-1.5">
            <label className="block text-sm font-medium text-zinc-700">Logo URL</label>
            <input
              {...register('logo_url')}
              type="url"
              className={inputCls}
              placeholder="https://example.com/logo.png"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
        >
          {isSubmitting ? (
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Save Settings
        </button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// DataTab
// ---------------------------------------------------------------------------
function DataTab() {
  const [loading, setLoading] = useState<string | null>(null)

  async function handleExport(type: 'products' | 'leads' | 'invoices') {
    setLoading(type)
    try {
      let result: { data: string | null; error: string | null }
      let filename: string

      if (type === 'products') {
        result = await exportProductsCsv()
        filename = 'products.csv'
      } else if (type === 'leads') {
        result = await exportLeadsCsv()
        filename = 'leads.csv'
      } else {
        result = await exportInvoicesCsv()
        filename = 'invoices.csv'
      }

      if (result.error || !result.data) {
        toast.error(result.error ?? 'Export failed')
        return
      }

      // Trigger browser download
      const blob = new Blob([result.data], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success(`${filename} downloaded`)
    } finally {
      setLoading(null)
    }
  }

  const exports = [
    {
      id: 'products',
      label: 'Export Products',
      description: 'All products with pricing, stock, and category information',
      icon: Package,
    },
    {
      id: 'leads',
      label: 'Export Leads',
      description: 'All leads with stage, source, and assignment details',
      icon: Users,
    },
    {
      id: 'invoices',
      label: 'Export Invoices',
      description: 'All invoices with customer, salesperson, and payment details',
      icon: Download,
    },
  ] as const

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-500">
        Download complete data exports in CSV format for offline analysis or reporting.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {exports.map(({ id, label, description, icon: Icon }) => (
          <div key={id} className="bg-white rounded-xl border border-zinc-200 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
                <Icon className="w-4 h-4 text-blue-700" />
              </div>
              <h3 className="text-sm font-semibold text-zinc-900">{label}</h3>
            </div>
            <p className="text-xs text-zinc-400 mb-4 leading-relaxed">{description}</p>
            <button
              onClick={() => handleExport(id)}
              disabled={loading !== null}
              className={cn(
                'w-full flex items-center justify-center gap-2',
                'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                'border border-zinc-300 text-zinc-700 hover:bg-zinc-50',
                'disabled:opacity-50',
              )}
            >
              {loading === id ? (
                <span className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Download CSV
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// AdminPanel — main export
// ---------------------------------------------------------------------------
export function AdminPanel({
  teamMembers,
  discountRules,
  businessSettings,
  currentUserId,
  managers,
}: AdminPanelProps) {
  return (
    <Tabs.Root defaultValue="team" className="space-y-5">
      {/* Tab list */}
      <Tabs.List className="bg-zinc-100 rounded-xl p-1 inline-flex gap-1 flex-wrap">
        <TabTrigger value="team" icon={Users} label="Team Management" />
        <TabTrigger value="discounts" icon={Percent} label="Discount Rules" />
        <TabTrigger value="settings" icon={Building2} label="Business Settings" />
        <TabTrigger value="data" icon={Download} label="Data & Reports" />
      </Tabs.List>

      {/* Team */}
      <Tabs.Content value="team" className="focus:outline-none">
        <TeamTab
          members={teamMembers}
          managers={managers}
          currentUserId={currentUserId}
        />
      </Tabs.Content>

      {/* Discounts */}
      <Tabs.Content value="discounts" className="focus:outline-none">
        <DiscountTab rules={discountRules} />
      </Tabs.Content>

      {/* Settings */}
      <Tabs.Content value="settings" className="focus:outline-none">
        <SettingsTab settings={businessSettings} />
      </Tabs.Content>

      {/* Data */}
      <Tabs.Content value="data" className="focus:outline-none">
        <DataTab />
      </Tabs.Content>
    </Tabs.Root>
  )
}
