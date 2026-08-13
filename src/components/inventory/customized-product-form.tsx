'use client'

import { useState } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Loader2,
  ChevronDown,
  ChevronUp,
  IndianRupee,
  Ruler,
  Palette,
  Package,
  Truck,
  Wrench,
  Calendar,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  FURNITURE_CATEGORIES,
  FAMILY_MATERIALS,
  SUBCATEGORIES_BY_CATEGORY,
} from '@/lib/constants'

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------
const schema = z.object({
  name:                   z.string().min(1, 'Product name is required'),
  category:               z.string().optional(),
  subcategory:            z.string().optional(),
  family:                 z.string().optional(),
  description:            z.string().optional(),
  // Customisation-specific
  customization_details:  z.string().min(1, 'Describe the customisation'),
  color:                  z.string().optional(),
  finish:                 z.string().optional(),
  dim_l:                  z.coerce.number().min(0).optional(),
  dim_w:                  z.coerce.number().min(0).optional(),
  dim_h:                  z.coerce.number().min(0).optional(),
  dim_unit:               z.enum(['cm', 'inches']).default('cm'),
  // Pricing
  price:                  z.coerce.number().min(0, 'Quoted price required'),
  cost:                   z.coerce.number().min(0).optional(),
  gst_pct:                z.coerce.number().min(0).max(100).default(18),
  pickup_charge:          z.coerce.number().min(0).default(0),
  installation_charge:    z.coerce.number().min(0).default(0),
  // Timeline
  delivery_days:          z.coerce.number().min(1).optional(),
})

export type CustomizedProductFormValues = z.infer<typeof schema>

interface Props {
  onSubmit: (data: CustomizedProductFormValues) => Promise<void>
  onCancel: () => void
  loading?: boolean
  isAdmin?: boolean
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function CustomizedProductForm({ onSubmit, onCancel, loading, isAdmin }: Props) {
  const [showDimensions, setShowDimensions] = useState(false)
  const [showPricingDetails, setShowPricingDetails] = useState(true)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<CustomizedProductFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema) as Resolver<CustomizedProductFormValues>,
    defaultValues: {
      gst_pct: 18,
      pickup_charge: 0,
      installation_charge: 0,
      dim_unit: 'cm',
    },
  })

  const selectedCategory = watch('category')
  const price            = Number(watch('price'))   || 0
  const gstPct           = Number(watch('gst_pct')) || 18
  const pickupCharge     = Number(watch('pickup_charge'))     || 0
  const installCharge    = Number(watch('installation_charge')) || 0
  const gstAmount        = (price * gstPct) / 100
  const grandTotal       = price + gstAmount + pickupCharge + installCharge

  const subcategories = selectedCategory
    ? (SUBCATEGORIES_BY_CATEGORY[selectedCategory] ?? [])
    : []

  // ── style helpers ────────────────────────────────────────────────────────
  const inp = (hasError?: boolean) =>
    cn(
      'w-full px-3 py-2 rounded-lg border text-sm text-zinc-900',
      'placeholder:text-zinc-400 bg-white outline-none transition-shadow',
      'focus:ring-2 focus:ring-blue-700/25 focus:border-blue-700',
      hasError ? 'border-red-400' : 'border-zinc-300',
    )
  const lbl = 'block text-xs font-medium text-zinc-600 mb-1'
  const errMsg = (msg?: string) =>
    msg ? <p className="mt-1 text-xs text-red-600">{msg}</p> : null

  function sectionHead(icon: React.ReactNode, title: string, sub?: string) {
    return (
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center text-blue-700 flex-shrink-0">
          {icon}
        </div>
        <div>
          <p className="text-sm font-semibold text-zinc-800">{title}</p>
          {sub && <p className="text-xs text-zinc-400">{sub}</p>}
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-7">

      {/* ── 1. Basic Info ─────────────────────────────────────────────────── */}
      <section>
        {sectionHead(<Package className="w-3.5 h-3.5" />, 'Product Info', 'Name, category and description')}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Name */}
          <div className="sm:col-span-2">
            <label className={lbl}>Product Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              placeholder="e.g. L-Shape Corner Sofa (Customised)"
              {...register('name')}
              className={inp(!!errors.name)}
              autoFocus
            />
            {errMsg(errors.name?.message)}
          </div>

          {/* Category */}
          <div>
            <label className={lbl}>Category</label>
            <select {...register('category')} className={inp()}>
              <option value="">Select category…</option>
              {FURNITURE_CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* Subcategory */}
          <div>
            <label className={lbl}>Subcategory</label>
            <select {...register('subcategory')} className={inp()} disabled={!selectedCategory}>
              <option value="">Select subcategory…</option>
              {subcategories.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Material / Family */}
          <div>
            <label className={lbl}>Material / Family</label>
            <select {...register('family')} className={inp()}>
              <option value="">Select material…</option>
              {FAMILY_MATERIALS.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div className="sm:col-span-2">
            <label className={lbl}>General Description</label>
            <textarea
              rows={2}
              placeholder="Brief description of the product…"
              {...register('description')}
              className={cn(inp(), 'resize-none')}
            />
          </div>
        </div>
      </section>

      {/* ── 2. Customisation Details ──────────────────────────────────────── */}
      <section>
        {sectionHead(<Palette className="w-3.5 h-3.5" />, 'Customisation', 'What is being customised for this customer')}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Customization details */}
          <div className="sm:col-span-2">
            <label className={lbl}>Customisation Details <span className="text-red-500">*</span></label>
            <textarea
              rows={3}
              placeholder="e.g. Royal blue velvet fabric, solid sheesham frame, customer requested extra-wide seat cushions and chrome legs…"
              {...register('customization_details')}
              className={cn(inp(!!errors.customization_details), 'resize-none')}
            />
            {errMsg(errors.customization_details?.message)}
          </div>

          {/* Color */}
          <div>
            <label className={lbl}>Color / Shade</label>
            <input
              type="text"
              placeholder="e.g. Royal Blue, Off-White, Walnut Brown"
              {...register('color')}
              className={inp()}
            />
          </div>

          {/* Finish */}
          <div>
            <label className={lbl}>Finish / Texture</label>
            <input
              type="text"
              placeholder="e.g. Matte, Glossy, Satin, Antique"
              {...register('finish')}
              className={inp()}
            />
          </div>
        </div>
      </section>

      {/* ── 3. Dimensions (collapsible) ───────────────────────────────────── */}
      <section>
        <button
          type="button"
          onClick={() => setShowDimensions(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 transition-colors"
        >
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 flex-shrink-0">
              <Ruler className="w-3.5 h-3.5" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-zinc-800">Dimensions</p>
              <p className="text-xs text-zinc-400">Length × Width × Height (optional)</p>
            </div>
          </div>
          {showDimensions
            ? <ChevronUp className="w-4 h-4 text-zinc-400" />
            : <ChevronDown className="w-4 h-4 text-zinc-400" />}
        </button>

        {showDimensions && (
          <div className="mt-3 grid grid-cols-4 gap-3">
            <div>
              <label className={lbl}>Length</label>
              <input type="number" min={0} step={0.5} placeholder="0" {...register('dim_l')} className={inp()} />
            </div>
            <div>
              <label className={lbl}>Width</label>
              <input type="number" min={0} step={0.5} placeholder="0" {...register('dim_w')} className={inp()} />
            </div>
            <div>
              <label className={lbl}>Height</label>
              <input type="number" min={0} step={0.5} placeholder="0" {...register('dim_h')} className={inp()} />
            </div>
            <div>
              <label className={lbl}>Unit</label>
              <select {...register('dim_unit')} className={inp()}>
                <option value="cm">cm</option>
                <option value="inches">inches</option>
              </select>
            </div>
          </div>
        )}
      </section>

      {/* ── 4. Pricing ────────────────────────────────────────────────────── */}
      <section>
        <button
          type="button"
          onClick={() => setShowPricingDetails(v => !v)}
          className="w-full flex items-center justify-between mb-3"
        >
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-700 flex-shrink-0">
              <IndianRupee className="w-3.5 h-3.5" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-zinc-800">Pricing &amp; Charges</p>
              <p className="text-xs text-zinc-400">Quoted price, GST, pickup &amp; installation</p>
            </div>
          </div>
          {showPricingDetails
            ? <ChevronUp className="w-4 h-4 text-zinc-400" />
            : <ChevronDown className="w-4 h-4 text-zinc-400" />}
        </button>

        {showPricingDetails && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Quoted price */}
            <div>
              <label className={lbl}>Quoted Price (₹) <span className="text-red-500">*</span></label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">₹</span>
                <input
                  type="number"
                  min={0}
                  step={100}
                  placeholder="0"
                  {...register('price')}
                  className={cn(inp(!!errors.price), 'pl-7')}
                />
              </div>
              {errMsg(errors.price?.message)}
            </div>

            {/* GST % */}
            <div>
              <label className={lbl}>GST Rate (%)</label>
              <select {...register('gst_pct')} className={inp()}>
                {[0, 5, 12, 18, 28].map(r => (
                  <option key={r} value={r}>{r}%</option>
                ))}
              </select>
            </div>

            {/* Pickup charge */}
            <div>
              <label className={lbl}>
                <span className="inline-flex items-center gap-1"><Truck className="w-3 h-3" />Pickup / Delivery Charge (₹)</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">₹</span>
                <input
                  type="number"
                  min={0}
                  step={100}
                  placeholder="0"
                  {...register('pickup_charge')}
                  className={cn(inp(), 'pl-7')}
                />
              </div>
            </div>

            {/* Installation charge */}
            <div>
              <label className={lbl}>
                <span className="inline-flex items-center gap-1"><Wrench className="w-3 h-3" />Installation Charge (₹)</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">₹</span>
                <input
                  type="number"
                  min={0}
                  step={100}
                  placeholder="0"
                  {...register('installation_charge')}
                  className={cn(inp(), 'pl-7')}
                />
              </div>
            </div>

            {/* Cost (admin only) */}
            {isAdmin && (
              <div>
                <label className={lbl}>Cost / Manufacturing Price (₹) <span className="text-amber-500 text-[10px] font-semibold">ADMIN</span></label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">₹</span>
                  <input
                    type="number"
                    min={0}
                    step={100}
                    placeholder="0"
                    {...register('cost')}
                    className={cn(inp(), 'pl-7')}
                  />
                </div>
              </div>
            )}

            {/* Live total preview */}
            <div className={cn('sm:col-span-2 rounded-xl bg-zinc-50 border border-zinc-200 p-4 space-y-2', !isAdmin && 'sm:col-span-2')}>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">Total Breakdown</p>
              <div className="flex justify-between text-sm text-zinc-600">
                <span>Quoted Price</span>
                <span>₹{(price || 0).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-sm text-zinc-600">
                <span>GST ({gstPct}%)</span>
                <span>₹{gstAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
              </div>
              {pickupCharge > 0 && (
                <div className="flex justify-between text-sm text-zinc-600">
                  <span>Pickup / Delivery</span>
                  <span>₹{pickupCharge.toLocaleString('en-IN')}</span>
                </div>
              )}
              {installCharge > 0 && (
                <div className="flex justify-between text-sm text-zinc-600">
                  <span>Installation</span>
                  <span>₹{installCharge.toLocaleString('en-IN')}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-zinc-900 pt-2 border-t border-zinc-200">
                <span>Grand Total</span>
                <span>₹{grandTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── 5. Delivery Timeline ──────────────────────────────────────────── */}
      <section>
        {sectionHead(<Calendar className="w-3.5 h-3.5" />, 'Delivery Timeline', 'Estimated production + delivery days')}
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={1}
            max={365}
            placeholder="e.g. 30"
            {...register('delivery_days')}
            className={cn(inp(), 'w-28')}
          />
          <span className="text-sm text-zinc-500">days from order confirmation</span>
        </div>
        {errors.delivery_days && (
          <p className="mt-1 text-xs text-red-600">{errors.delivery_days.message}</p>
        )}
      </section>

      {/* ── Actions ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100">
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
          className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors disabled:opacity-50"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          Save Customised Product
        </button>
      </div>
    </form>
  )
}
