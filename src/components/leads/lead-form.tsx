'use client'

import { useState } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { leadSchema } from '@/lib/validations'
import {
  LEAD_SOURCES,
  FURNITURE_CATEGORIES,
  OCCUPATIONS,
  AGE_GROUPS,
  INCOME_BRACKETS,
  HOME_TYPES,
  GENDER_OPTIONS,
  INDIAN_STATES,
} from '@/lib/constants'
import type { Lead, Profile } from '@/lib/types/database'
import type { LeadFormValues } from '@/lib/validations'
import { cn } from '@/lib/utils'

// Make source required in the form (DB allows null but UX enforces selection)
const leadFormSchema = leadSchema.extend({
  source: z.string().min(1, 'Source is required'),
})

type FormValues = z.infer<typeof leadFormSchema>

interface LeadFormProps {
  lead?: Lead
  onSubmit: (data: LeadFormValues) => Promise<void>
  onCancel: () => void
  loading?: boolean
  salespeople?: Profile[]
}

export function LeadForm({
  lead,
  onSubmit,
  onCancel,
  loading,
  salespeople,
}: LeadFormProps) {
  const [showDemographics, setShowDemographics] = useState(
    lead != null && Object.keys(lead.demographic ?? {}).some(k => {
      const d = lead.demographic as Record<string, unknown>
      return d[k] != null && d[k] !== ''
    }),
  )

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<FormValues>({
    resolver: zodResolver(leadFormSchema) as Resolver<FormValues>,
    defaultValues: {
      name: lead?.name ?? '',
      email: lead?.email ?? '',
      phone: lead?.phone ?? '',
      address: lead?.address ?? '',
      city: lead?.city ?? '',
      state: lead?.state ?? '',
      stage: lead?.stage ?? 'New',
      source: lead?.source ?? '',
      assigned_to: lead?.assigned_to ?? null,
      interested_categories: lead?.interested_categories ?? [],
      estimated_value: lead?.estimated_value ?? undefined,
      demographic: {
        age_group: lead?.demographic?.age_group ?? '',
        gender: lead?.demographic?.gender ?? '',
        occupation: lead?.demographic?.occupation ?? '',
        income: lead?.demographic?.income ?? '',
        family_size: lead?.demographic?.family_size ?? undefined,
        home_type: lead?.demographic?.home_type ?? '',
      },
      notes: lead?.notes ?? '',
    },
  })

  const selectedCategories = watch('interested_categories') ?? []

  function toggleCategory(value: string) {
    if (selectedCategories.includes(value)) {
      setValue(
        'interested_categories',
        selectedCategories.filter(c => c !== value),
        { shouldValidate: true },
      )
    } else {
      setValue('interested_categories', [...selectedCategories, value], {
        shouldValidate: true,
      })
    }
  }

  async function onValid(data: FormValues) {
    const clean: LeadFormValues = {
      ...data,
      email: data.email || undefined,
      address: data.address || undefined,
      city: data.city || undefined,
      state: data.state || undefined,
      notes: data.notes || undefined,
      assigned_to: data.assigned_to || null,
      estimated_value:
        data.estimated_value != null && data.estimated_value > 0
          ? data.estimated_value
          : null,
      demographic: {
        age_group: data.demographic?.age_group || undefined,
        gender: data.demographic?.gender || undefined,
        occupation: data.demographic?.occupation || undefined,
        income: data.demographic?.income || undefined,
        family_size: data.demographic?.family_size,
        home_type: data.demographic?.home_type || undefined,
      },
    }
    await onSubmit(clean)
  }

  // ── Style helpers ────────────────────────────────────────────────────────
  const inp = (hasError?: boolean) =>
    cn(
      'w-full px-3 py-2 rounded-lg border text-sm text-zinc-900',
      'placeholder:text-zinc-400 bg-white outline-none transition-shadow',
      'focus:ring-2 focus:ring-green-700/25 focus:border-green-700',
      hasError
        ? 'border-red-400 focus:ring-red-400/25 focus:border-red-500'
        : 'border-zinc-300',
    )

  const lbl = 'block text-sm font-medium text-zinc-700 mb-1'
  const err = (msg?: string) =>
    msg ? <p className="mt-1 text-xs text-red-600">{msg}</p> : null

  const sectionTitle = (title: string) => (
    <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
      {title}
    </p>
  )

  return (
    <form onSubmit={handleSubmit(onValid)} className="space-y-6">

      {/* ── Basic Info ─────────────────────────────────────────────────────── */}
      <div>
        {sectionTitle('Basic Information')}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Name */}
          <div className="sm:col-span-2">
            <label htmlFor="lf-name" className={lbl}>
              Name <span className="text-red-500">*</span>
            </label>
            <input
              id="lf-name"
              type="text"
              placeholder="Full name"
              {...register('name')}
              className={inp(!!errors.name)}
            />
            {err(errors.name?.message)}
          </div>

          {/* Phone */}
          <div>
            <label htmlFor="lf-phone" className={lbl}>
              Phone <span className="text-red-500">*</span>
            </label>
            <input
              id="lf-phone"
              type="tel"
              placeholder="+91 98765 43210"
              {...register('phone')}
              className={inp(!!errors.phone)}
            />
            {err(errors.phone?.message)}
          </div>

          {/* Source */}
          <div>
            <label htmlFor="lf-source" className={lbl}>
              Source <span className="text-red-500">*</span>
            </label>
            <select
              id="lf-source"
              {...register('source')}
              className={inp(!!errors.source)}
            >
              <option value="">Select source…</option>
              {LEAD_SOURCES.map(s => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            {err(errors.source?.message)}
          </div>
        </div>
      </div>

      {/* ── Contact Details ─────────────────────────────────────────────────── */}
      <div>
        {sectionTitle('Contact Details')}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Email */}
          <div>
            <label htmlFor="lf-email" className={lbl}>
              Email
            </label>
            <input
              id="lf-email"
              type="email"
              placeholder="customer@email.com"
              {...register('email')}
              className={inp(!!errors.email)}
            />
            {err(errors.email?.message)}
          </div>

          {/* Estimated Value */}
          <div>
            <label htmlFor="lf-value" className={lbl}>
              Estimated Value (₹)
            </label>
            <input
              id="lf-value"
              type="number"
              min={0}
              step={1000}
              placeholder="0"
              {...register('estimated_value')}
              className={inp(!!errors.estimated_value)}
            />
          </div>

          {/* City */}
          <div>
            <label htmlFor="lf-city" className={lbl}>
              City
            </label>
            <input
              id="lf-city"
              type="text"
              placeholder="Udaipur"
              {...register('city')}
              className={inp()}
            />
          </div>

          {/* State */}
          <div>
            <label htmlFor="lf-state" className={lbl}>
              State
            </label>
            <select
              id="lf-state"
              {...register('state')}
              className={inp()}
            >
              <option value="">Select state…</option>
              {INDIAN_STATES.map(s => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Address */}
          <div className="sm:col-span-2">
            <label htmlFor="lf-address" className={lbl}>
              Address
            </label>
            <input
              id="lf-address"
              type="text"
              placeholder="Street / area / landmark"
              {...register('address')}
              className={inp()}
            />
          </div>
        </div>
      </div>

      {/* ── Assigned To (admin / manager only) ──────────────────────────────── */}
      {salespeople && salespeople.length > 0 && (
        <div>
          {sectionTitle('Assignment')}
          <label htmlFor="lf-assignee" className={lbl}>
            Assigned To
          </label>
          <select
            id="lf-assignee"
            {...register('assigned_to')}
            className={inp()}
          >
            <option value="">Unassigned</option>
            {salespeople.map(sp => (
              <option key={sp.id} value={sp.id}>
                {sp.name ?? sp.email ?? sp.id}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* ── Interested Categories ──────────────────────────────────────────── */}
      <div>
        {sectionTitle('Interested Categories')}
        <div className="flex flex-wrap gap-2">
          {FURNITURE_CATEGORIES.map(cat => {
            const active = selectedCategories.includes(cat.value)
            return (
              <button
                key={cat.value}
                type="button"
                onClick={() => toggleCategory(cat.value)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
                  active
                    ? 'bg-green-700 text-white border-green-700'
                    : 'bg-white text-zinc-600 border-zinc-300 hover:border-green-600 hover:text-green-700',
                )}
              >
                {cat.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Notes ─────────────────────────────────────────────────────────── */}
      <div>
        <label htmlFor="lf-notes" className={lbl}>
          Notes
        </label>
        <textarea
          id="lf-notes"
          rows={3}
          placeholder="Any additional notes about this lead…"
          {...register('notes')}
          className={cn(inp(!!errors.notes), 'resize-none')}
        />
      </div>

      {/* ── Demographics (expandable) ──────────────────────────────────────── */}
      <div className="border border-zinc-200 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowDemographics(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 bg-zinc-50 hover:bg-zinc-100 transition-colors"
          aria-expanded={showDemographics}
        >
          <span className="text-sm font-medium text-zinc-700">
            Customer Profile <span className="text-zinc-400 font-normal">(optional)</span>
          </span>
          {showDemographics ? (
            <ChevronUp className="w-4 h-4 text-zinc-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-zinc-400" />
          )}
        </button>

        {showDemographics && (
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Age Group */}
            <div>
              <label htmlFor="lf-age" className={lbl}>
                Age Group
              </label>
              <select
                id="lf-age"
                {...register('demographic.age_group')}
                className={inp()}
              >
                <option value="">Select…</option>
                {AGE_GROUPS.map(a => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>

            {/* Gender */}
            <div>
              <label htmlFor="lf-gender" className={lbl}>
                Gender
              </label>
              <select
                id="lf-gender"
                {...register('demographic.gender')}
                className={inp()}
              >
                <option value="">Select…</option>
                {GENDER_OPTIONS.map(g => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            {/* Occupation */}
            <div>
              <label htmlFor="lf-occupation" className={lbl}>
                Occupation
              </label>
              <select
                id="lf-occupation"
                {...register('demographic.occupation')}
                className={inp()}
              >
                <option value="">Select…</option>
                {OCCUPATIONS.map(o => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>

            {/* Income */}
            <div>
              <label htmlFor="lf-income" className={lbl}>
                Income Bracket
              </label>
              <select
                id="lf-income"
                {...register('demographic.income')}
                className={inp()}
              >
                <option value="">Select…</option>
                {INCOME_BRACKETS.map(i => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </select>
            </div>

            {/* Home Type */}
            <div>
              <label htmlFor="lf-home" className={lbl}>
                Home Type
              </label>
              <select
                id="lf-home"
                {...register('demographic.home_type')}
                className={inp()}
              >
                <option value="">Select…</option>
                {HOME_TYPES.map(h => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            {/* Family Size */}
            <div>
              <label htmlFor="lf-family" className={lbl}>
                Family Size
              </label>
              <input
                id="lf-family"
                type="number"
                min={1}
                max={10}
                placeholder="e.g. 4"
                {...register('demographic.family_size')}
                className={inp()}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Form Actions ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-end gap-3 pt-2 border-t border-zinc-100">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-zinc-700 bg-white border border-zinc-300 rounded-lg hover:bg-zinc-50 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className={cn(
            'flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white',
            'bg-green-700 hover:bg-green-800 rounded-lg transition-colors',
            'disabled:opacity-60 disabled:cursor-not-allowed',
          )}
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {lead ? 'Update Lead' : 'Create Lead'}
        </button>
      </div>
    </form>
  )
}
