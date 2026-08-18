'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { createTeamMember, updateTeamMember } from '@/lib/actions/admin'
import { cn } from '@/lib/utils'
import type { Profile, Role } from '@/lib/types/database'

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------
const baseSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  role: z.enum(['admin', 'manager', 'salesperson']),
  manager_id: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  annual_target: z.coerce.number().min(0, 'Target must be 0 or more'),
  max_discount_pct: z.coerce.number().min(0).max(100).nullable().optional(),
})

const createSchema = baseSchema.extend({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

const editSchema = baseSchema

type CreateFormValues = z.infer<typeof createSchema>
type EditFormValues = z.infer<typeof editSchema>

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface TeamMemberFormProps {
  mode: 'create' | 'edit'
  member?: Profile & { manager?: { id: string; name: string | null } | null }
  managers: Array<{ id: string; name: string | null; role: Role }>
  currentUserId: string
  onSuccess: () => void
  onCancel: () => void
}

// ---------------------------------------------------------------------------
// Field wrapper
// ---------------------------------------------------------------------------
function Field({
  label,
  error,
  required,
  children,
}: {
  label: string
  error?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-zinc-700">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}

const inputCls = cn(
  'w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm',
  'placeholder:text-zinc-400 text-zinc-900',
  'focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600',
  'disabled:opacity-50 disabled:bg-zinc-50',
)

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function TeamMemberForm({
  mode,
  member,
  managers,
  currentUserId,
  onSuccess,
  onCancel,
}: TeamMemberFormProps) {
  const isEdit = mode === 'edit'
  const [submitting, setSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<CreateFormValues>({
    resolver: zodResolver(isEdit ? editSchema : createSchema) as any,
    defaultValues: {
      name: member?.name ?? '',
      email: '',
      password: '',
      role: (member?.role as 'admin' | 'manager' | 'salesperson') ?? 'salesperson',
      manager_id: member?.manager_id ?? undefined,
      phone: member?.phone ?? '',
      annual_target: member?.annual_target ?? 0,
      max_discount_pct: member?.max_discount_pct ?? null,
    },
  })

  const selectedRole = watch('role')

  // Reset on member change
  useEffect(() => {
    if (member) {
      reset({
        name: member.name ?? '',
        role: member.role as 'admin' | 'manager' | 'salesperson',
        manager_id: member.manager_id ?? undefined,
        phone: member.phone ?? '',
        annual_target: member.annual_target ?? 0,
        max_discount_pct: member.max_discount_pct ?? null,
      })
    }
  }, [member, reset])

  async function onSubmit(values: CreateFormValues) {
    setSubmitting(true)
    try {
      if (isEdit && member) {
        const { error } = await updateTeamMember(member.id, {
          name: values.name,
          role: values.role,
          manager_id: values.manager_id || null,   // '' → null (no manager)
          phone: values.phone ?? undefined,
          annual_target: values.annual_target,
          max_discount_pct: values.max_discount_pct ?? null,
        })
        if (error) {
          toast.error(error)
          return
        }
        toast.success('Team member updated successfully')
      } else {
        const { error } = await createTeamMember({
          name: values.name,
          email: values.email ?? '',
          password: values.password ?? '',
          role: values.role,
          manager_id: values.manager_id || null,   // '' → null (no manager)
          phone: values.phone ?? undefined,
          annual_target: values.annual_target,
          max_discount_pct: values.max_discount_pct ?? null,
        })
        if (error) {
          toast.error(error)
          return
        }
        toast.success('Team member added successfully')
      }
      onSuccess()
    } finally {
      setSubmitting(false)
    }
  }

  // Available managers for manager_id field
  const availableManagers = managers.filter(
    (m) => m.role === 'manager' || m.role === 'admin',
  )

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Name */}
      <Field label="Full Name" required error={errors.name?.message}>
        <input
          {...register('name')}
          type="text"
          className={inputCls}
          placeholder="Enter full name"
          disabled={submitting}
        />
      </Field>

      {/* Email — create only */}
      {!isEdit && (
        <Field label="Email Address" required error={(errors as any).email?.message}>
          <input
            {...register('email')}
            type="email"
            className={inputCls}
            placeholder="user@example.com"
            disabled={submitting}
          />
        </Field>
      )}

      {/* Password — create only */}
      {!isEdit && (
        <Field label="Password" required error={(errors as any).password?.message}>
          <input
            {...register('password')}
            type="password"
            className={inputCls}
            placeholder="Minimum 8 characters"
            disabled={submitting}
          />
        </Field>
      )}

      {/* Role */}
      <Field label="Role" required error={errors.role?.message}>
        <select {...register('role')} className={inputCls} disabled={submitting}>
          <option value="salesperson">Salesperson</option>
          <option value="manager">Manager</option>
          <option value="admin">Admin</option>
        </select>
      </Field>

      {/* Manager — shown for salesperson */}
      {selectedRole === 'salesperson' && (
        <Field label="Reports To (Manager)" error={errors.manager_id?.message}>
          <select
            {...register('manager_id')}
            className={inputCls}
            disabled={submitting}
          >
            <option value="">— No Manager —</option>
            {availableManagers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name ?? m.id} ({m.role})
              </option>
            ))}
          </select>
        </Field>
      )}

      {/* Phone */}
      <Field label="Phone Number" error={errors.phone?.message}>
        <input
          {...register('phone')}
          type="tel"
          className={inputCls}
          placeholder="+91 98765 43210"
          disabled={submitting}
        />
      </Field>

      {/* Annual Target */}
      <Field label="Annual Sales Target (₹)" error={errors.annual_target?.message}>
        <input
          {...register('annual_target')}
          type="number"
          min="0"
          step="10000"
          className={inputCls}
          placeholder="5000000"
          disabled={submitting}
        />
      </Field>

      {/* Max Discount % — salesperson only */}
      {selectedRole === 'salesperson' && (
        <Field
          label="Max Discount % Override"
          error={(errors as any).max_discount_pct?.message}
        >
          <input
            {...register('max_discount_pct')}
            type="number"
            min="0"
            max="100"
            step="0.5"
            className={inputCls}
            placeholder="Leave blank to use role default"
            disabled={submitting}
          />
          <p className="text-xs text-zinc-400 mt-1">
            Overrides the role-level discount limit for this person. Leave blank to use the default.
          </p>
        </Field>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2 border-t border-zinc-100">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className={cn(
            'px-4 py-2 text-sm font-medium text-zinc-700 rounded-lg',
            'border border-zinc-300 hover:bg-zinc-50 transition-colors',
            'disabled:opacity-50',
          )}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className={cn(
            'flex items-center gap-2 px-4 py-2 text-sm font-medium',
            'text-white bg-blue-600 hover:bg-blue-700 rounded-lg',
            'transition-colors disabled:opacity-50',
          )}
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          {isEdit ? 'Save Changes' : 'Add Member'}
        </button>
      </div>
    </form>
  )
}
