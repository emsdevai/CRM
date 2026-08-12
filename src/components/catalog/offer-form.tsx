'use client'

import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Tag, CalendarDays, Percent, IndianRupee } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FURNITURE_CATEGORIES } from '@/lib/constants'
import { offerSchema, type OfferFormValues } from '@/lib/validations'
import type { Offer } from '@/lib/types/database'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface OfferFormProps {
  offer?: Offer
  onSubmit: (values: OfferFormValues) => Promise<void>
  onCancel: () => void
  loading: boolean
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function OfferForm({ offer, onSubmit, onCancel, loading }: OfferFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<OfferFormValues>({
    resolver: zodResolver(offerSchema) as Resolver<OfferFormValues>,
    defaultValues: {
      title: offer?.title ?? '',
      category: offer?.category ?? '',
      discount_type: offer?.discount_type ?? undefined,
      discount_value: offer?.discount_value ?? undefined,
      start_date: offer?.start_date ?? '',
      end_date: offer?.end_date ?? '',
      active: offer?.active ?? false,
    },
  })

  const watchedDiscountType = watch('discount_type')

  const inputCls = (hasError: boolean) =>
    cn(
      'block w-full rounded-lg border bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400',
      'focus:outline-none focus:ring-2 focus:ring-green-700 focus:ring-offset-0',
      'disabled:opacity-50 disabled:cursor-not-allowed',
      hasError
        ? 'border-red-400 focus:ring-red-500'
        : 'border-zinc-300 focus:border-green-700',
    )

  const labelCls = 'block text-sm font-medium text-zinc-700 mb-1'
  const errorCls = 'mt-1 text-xs text-red-600'

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* ── Title ────────────────────────────────────────────────────────── */}
      <div>
        <label htmlFor="offer-title" className={labelCls}>
          Offer Title <span className="text-red-500">*</span>
        </label>
        <input
          id="offer-title"
          type="text"
          placeholder="e.g. Summer Sale – 15% off Sofas"
          {...register('title')}
          className={inputCls(!!errors.title)}
        />
        {errors.title && <p className={errorCls}>{errors.title.message}</p>}
      </div>

      {/* ── Category ─────────────────────────────────────────────────────── */}
      <div>
        <label htmlFor="offer-category" className={labelCls}>
          <span className="flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5" />
            Applies to Category
          </span>
        </label>
        <select
          id="offer-category"
          {...register('category')}
          className={inputCls(!!errors.category)}
        >
          <option value="">All Categories</option>
          {FURNITURE_CATEGORIES.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </select>
        {errors.category && (
          <p className={errorCls}>{errors.category.message}</p>
        )}
        <p className="mt-1 text-xs text-zinc-500">
          Leave empty to apply to all products
        </p>
      </div>

      {/* ── Discount type (radio) ─────────────────────────────────────────── */}
      <div>
        <label className={labelCls}>Discount Type</label>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              value="percentage"
              {...register('discount_type')}
              className="w-4 h-4 text-green-700 border-zinc-300 focus:ring-green-700"
            />
            <span className="flex items-center gap-1.5 text-sm text-zinc-700">
              <Percent className="w-3.5 h-3.5" />
              Percentage (%)
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              value="flat"
              {...register('discount_type')}
              className="w-4 h-4 text-green-700 border-zinc-300 focus:ring-green-700"
            />
            <span className="flex items-center gap-1.5 text-sm text-zinc-700">
              <IndianRupee className="w-3.5 h-3.5" />
              Flat Amount (₹)
            </span>
          </label>
        </div>
        {errors.discount_type && (
          <p className={errorCls}>{errors.discount_type.message}</p>
        )}
      </div>

      {/* ── Discount value ────────────────────────────────────────────────── */}
      <div>
        <label htmlFor="offer-discount-value" className={labelCls}>
          Discount Value
          {watchedDiscountType === 'percentage' && (
            <span className="ml-1 text-zinc-400 font-normal">(enter %)</span>
          )}
          {watchedDiscountType === 'flat' && (
            <span className="ml-1 text-zinc-400 font-normal">(enter ₹ amount)</span>
          )}
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            {watchedDiscountType === 'flat' ? (
              <IndianRupee className="w-4 h-4 text-zinc-400" />
            ) : (
              <Percent className="w-4 h-4 text-zinc-400" />
            )}
          </div>
          <input
            id="offer-discount-value"
            type="number"
            min="0"
            step="0.01"
            placeholder="0"
            {...register('discount_value')}
            className={cn(inputCls(!!errors.discount_value), 'pl-9')}
          />
        </div>
        {errors.discount_value && (
          <p className={errorCls}>{errors.discount_value.message}</p>
        )}
      </div>

      {/* ── Date range ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="offer-start-date" className={labelCls}>
            <span className="flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5" />
              Start Date
            </span>
          </label>
          <input
            id="offer-start-date"
            type="date"
            {...register('start_date')}
            className={inputCls(!!errors.start_date)}
          />
          {errors.start_date && (
            <p className={errorCls}>{errors.start_date.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="offer-end-date" className={labelCls}>
            <span className="flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5" />
              End Date
            </span>
          </label>
          <input
            id="offer-end-date"
            type="date"
            {...register('end_date')}
            className={inputCls(!!errors.end_date)}
          />
          {errors.end_date && (
            <p className={errorCls}>{errors.end_date.message}</p>
          )}
        </div>
      </div>

      {/* ── Active toggle ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-zinc-900">Active</p>
          <p className="text-xs text-zinc-500 mt-0.5">
            Customers will see this offer on products
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            {...register('active')}
            className="sr-only peer"
          />
          <div className="w-10 h-6 bg-zinc-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-green-700 rounded-full peer peer-checked:bg-green-600 transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-4 after:shadow-sm" />
        </label>
      </div>

      {/* ── Actions ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-end gap-3 pt-2 border-t border-zinc-100">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 active:bg-zinc-300 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-green-700 hover:bg-green-800 active:bg-green-900 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700 focus-visible:ring-offset-2"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {offer ? 'Update Offer' : 'Create Offer'}
        </button>
      </div>
    </form>
  )
}
