'use client'

import { useEffect, useRef, useState } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ImageOff, Upload, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  FURNITURE_CATEGORIES,
  SUBCATEGORIES_BY_CATEGORY,
  FAMILY_MATERIALS,
  PRODUCT_TYPES,
  GST_RATES,
  DEFAULT_GST_RATE,
} from '@/lib/constants'
import { productSchema, type ProductFormValues } from '@/lib/validations'
import { createClient } from '@/lib/supabase/client'
import type { Product } from '@/lib/types/database'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface ProductFormProps {
  product?: Product
  onSubmit: (values: ProductFormValues) => Promise<void>
  onCancel: () => void
  loading: boolean
  isAdmin: boolean
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function ProductForm({
  product,
  onSubmit,
  onCancel,
  loading,
  isAdmin,
}: ProductFormProps) {
  const supabase = createClient()

  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(
    product?.image_url ?? null,
  )
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema) as Resolver<ProductFormValues>,
    defaultValues: {
      sku: product?.sku ?? '',
      barcode: product?.barcode ?? '',
      name: product?.name ?? '',
      category: product?.category ?? '',
      subcategory: product?.subcategory ?? '',
      family: product?.family ?? '',
      type: product?.type ?? undefined,
      cost: product?.cost ?? undefined,
      price: product?.price ?? ('' as unknown as number),
      gst_pct: product?.gst_pct ?? DEFAULT_GST_RATE,
      margin_pct: product?.margin_pct ?? undefined,
      stock: product?.stock ?? 0,
      reorder_level: product?.reorder_level ?? 5,
      image_url: product?.image_url ?? '',
      description: product?.description ?? '',
    },
  })

  const watchedCategory = watch('category')
  const watchedPrice = watch('price')
  const watchedCost = watch('cost')

  // Auto-update subcategories when category changes
  const subcategories = watchedCategory
    ? (SUBCATEGORIES_BY_CATEGORY[watchedCategory] ?? [])
    : []

  // Auto-fill GST rate based on category
  useEffect(() => {
    if (watchedCategory && GST_RATES[watchedCategory] != null) {
      setValue('gst_pct', GST_RATES[watchedCategory])
    }
  }, [watchedCategory, setValue])

  // Auto-calculate margin_pct when cost + price are both entered (admin only)
  useEffect(() => {
    if (!isAdmin) return
    const price = Number(watchedPrice)
    const cost = Number(watchedCost)
    if (price > 0 && cost > 0 && cost < price) {
      const margin = ((price - cost) / price) * 100
      setValue('margin_pct', parseFloat(margin.toFixed(2)))
    }
  }, [watchedPrice, watchedCost, isAdmin, setValue])

  // Handle file selection
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be smaller than 5 MB')
      return
    }

    setImageFile(file)
    const objectUrl = URL.createObjectURL(file)
    setImagePreview(objectUrl)
  }

  function handleRemoveImage() {
    setImageFile(null)
    setImagePreview(null)
    setValue('image_url', '')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function uploadImage(file: File): Promise<string | null> {
    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `products/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    const { error } = await supabase.storage
      .from('product-images')
      .upload(path, file, { cacheControl: '3600', upsert: false })

    if (error) {
      toast.error(`Image upload failed: ${error.message}`)
      return null
    }

    const { data } = supabase.storage.from('product-images').getPublicUrl(path)
    return data.publicUrl
  }

  async function handleFormSubmit(values: ProductFormValues) {
    let imageUrl = values.image_url ?? ''

    if (imageFile) {
      setUploading(true)
      const uploaded = await uploadImage(imageFile)
      setUploading(false)

      if (uploaded === null) return // toast already shown
      imageUrl = uploaded
    }

    await onSubmit({ ...values, image_url: imageUrl })
  }

  const isLoading = loading || uploading

  // ── Field styles ──────────────────────────────────────────────────────────

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
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-5">
      {/* ── Image Upload ────────────────────────────────────────────────── */}
      <div>
        <label className={labelCls}>Product Image</label>
        <div className="flex items-start gap-4">
          {imagePreview ? (
            <div className="relative w-24 h-24 flex-shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imagePreview}
                alt="Product preview"
                className="w-24 h-24 rounded-xl object-cover border border-zinc-200"
              />
              <button
                type="button"
                onClick={handleRemoveImage}
                className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <div className="w-24 h-24 rounded-xl border-2 border-dashed border-zinc-300 flex items-center justify-center flex-shrink-0 bg-zinc-50">
              <ImageOff className="w-8 h-8 text-zinc-300" />
            </div>
          )}

          <div className="flex-1">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
              id="product-image-input"
            />
            <label
              htmlFor="product-image-input"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-zinc-700 border border-zinc-300 bg-white hover:bg-zinc-50 cursor-pointer transition-colors"
            >
              <Upload className="w-4 h-4" />
              {imagePreview ? 'Change Image' : 'Upload Image'}
            </label>
            <p className="mt-1.5 text-xs text-zinc-500">PNG, JPG, WebP up to 5 MB</p>
          </div>
        </div>
      </div>

      {/* ── Name + SKU ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className={labelCls}>
            Product Name <span className="text-red-500">*</span>
          </label>
          <input
            id="name"
            type="text"
            placeholder="e.g. Comfort Sofa 3-Seater"
            {...register('name')}
            className={inputCls(!!errors.name)}
          />
          {errors.name && <p className={errorCls}>{errors.name.message}</p>}
        </div>

        <div>
          <label htmlFor="sku" className={labelCls}>
            SKU <span className="text-red-500">*</span>
          </label>
          <input
            id="sku"
            type="text"
            placeholder="e.g. LR-SOF-0001"
            {...register('sku')}
            className={inputCls(!!errors.sku)}
          />
          {errors.sku && <p className={errorCls}>{errors.sku.message}</p>}
        </div>
      </div>

      {/* ── Barcode ─────────────────────────────────────────────────────── */}
      <div>
        <label htmlFor="barcode" className={labelCls}>Barcode</label>
        <input
          id="barcode"
          type="text"
          placeholder="EAN-13 or custom barcode"
          {...register('barcode')}
          className={inputCls(!!errors.barcode)}
        />
        {errors.barcode && <p className={errorCls}>{errors.barcode.message}</p>}
      </div>

      {/* ── Category / Subcategory / Family ──────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="category" className={labelCls}>
            Category <span className="text-red-500">*</span>
          </label>
          <select
            id="category"
            {...register('category')}
            className={inputCls(!!errors.category)}
          >
            <option value="">Select category</option>
            {FURNITURE_CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
          {errors.category && <p className={errorCls}>{errors.category.message}</p>}
        </div>

        <div>
          <label htmlFor="subcategory" className={labelCls}>Subcategory</label>
          <select
            id="subcategory"
            {...register('subcategory')}
            className={inputCls(!!errors.subcategory)}
            disabled={subcategories.length === 0}
          >
            <option value="">Select subcategory</option>
            {subcategories.map((sub) => (
              <option key={sub} value={sub}>
                {sub}
              </option>
            ))}
          </select>
          {errors.subcategory && (
            <p className={errorCls}>{errors.subcategory.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="family" className={labelCls}>Material / Family</label>
          <select
            id="family"
            {...register('family')}
            className={inputCls(!!errors.family)}
          >
            <option value="">Select material</option>
            {FAMILY_MATERIALS.map((fam) => (
              <option key={fam} value={fam}>
                {fam}
              </option>
            ))}
          </select>
          {errors.family && <p className={errorCls}>{errors.family.message}</p>}
        </div>
      </div>

      {/* ── Type ─────────────────────────────────────────────────────────── */}
      <div>
        <label htmlFor="type" className={labelCls}>Product Type</label>
        <select
          id="type"
          {...register('type')}
          className={inputCls(!!errors.type)}
        >
          <option value="">Select type</option>
          {PRODUCT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>
        {errors.type && <p className={errorCls}>{errors.type.message}</p>}
      </div>

      {/* ── Price / GST ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="price" className={labelCls}>
            Selling Price (₹) <span className="text-red-500">*</span>
          </label>
          <input
            id="price"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            {...register('price')}
            className={inputCls(!!errors.price)}
          />
          {errors.price && <p className={errorCls}>{errors.price.message}</p>}
        </div>

        <div>
          <label htmlFor="gst_pct" className={labelCls}>GST Rate (%)</label>
          <select
            id="gst_pct"
            {...register('gst_pct')}
            className={inputCls(!!errors.gst_pct)}
          >
            <option value={12}>12%</option>
            <option value={18}>18%</option>
          </select>
          {errors.gst_pct && <p className={errorCls}>{errors.gst_pct.message}</p>}
        </div>
      </div>

      {/* ── Cost + Margin (Admin Only) ────────────────────────────────────── */}
      {isAdmin && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 rounded-xl border border-dashed border-amber-300 bg-amber-50/50 p-4">
          <div className="col-span-2 -mb-1">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
              Admin Only
            </p>
          </div>
          <div>
            <label htmlFor="cost" className={labelCls}>Cost Price (₹)</label>
            <input
              id="cost"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              {...register('cost')}
              className={inputCls(!!errors.cost)}
            />
            {errors.cost && <p className={errorCls}>{errors.cost.message}</p>}
          </div>

          <div>
            <label htmlFor="margin_pct" className={labelCls}>
              Margin %
              <span className="ml-1 text-xs text-zinc-400 font-normal">(auto-calculated)</span>
            </label>
            <input
              id="margin_pct"
              type="number"
              min="0"
              max="100"
              step="0.01"
              placeholder="0.00"
              {...register('margin_pct')}
              className={inputCls(!!errors.margin_pct)}
              readOnly
            />
            {errors.margin_pct && (
              <p className={errorCls}>{errors.margin_pct.message}</p>
            )}
          </div>
        </div>
      )}

      {/* ── Stock / Reorder ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="stock" className={labelCls}>Current Stock</label>
          <input
            id="stock"
            type="number"
            min="0"
            step="1"
            {...register('stock')}
            className={inputCls(!!errors.stock)}
          />
          {errors.stock && <p className={errorCls}>{errors.stock.message}</p>}
        </div>

        <div>
          <label htmlFor="reorder_level" className={labelCls}>Reorder Level</label>
          <input
            id="reorder_level"
            type="number"
            min="0"
            step="1"
            {...register('reorder_level')}
            className={inputCls(!!errors.reorder_level)}
          />
          {errors.reorder_level && (
            <p className={errorCls}>{errors.reorder_level.message}</p>
          )}
        </div>
      </div>

      {/* ── Description ──────────────────────────────────────────────────── */}
      <div>
        <label htmlFor="description" className={labelCls}>Description</label>
        <textarea
          id="description"
          rows={3}
          placeholder="Product details, dimensions, features..."
          {...register('description')}
          className={inputCls(!!errors.description)}
        />
        {errors.description && (
          <p className={errorCls}>{errors.description.message}</p>
        )}
      </div>

      {/* ── Actions ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-end gap-3 pt-2 border-t border-zinc-100">
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 active:bg-zinc-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>

        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-green-700 hover:bg-green-800 active:bg-green-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700 focus-visible:ring-offset-2"
        >
          {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
          {product ? 'Update Product' : 'Create Product'}
        </button>
      </div>
    </form>
  )
}
