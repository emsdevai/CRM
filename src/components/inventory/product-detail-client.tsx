'use client'

import { useState, useCallback, useTransition } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import {
  ArrowLeft,
  Edit,
  Image as ImageIcon,
  Tag,
  Layers,
  BarChart3,
  Minus,
  Plus,
  X,
  Loader2,
  BadgePercent,
  IndianRupee,
  ShoppingCart,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { cn, formatCurrency, formatDate, stockStatus } from '@/lib/utils'
import { adjustStock, updateProduct } from '@/lib/actions/inventory'
import { ProductForm } from '@/components/inventory/product-form'
import { BarcodeDisplay } from '@/components/inventory/barcode-display'
import { StockBadge } from '@/components/inventory/stock-badge'
import type { Product, Profile } from '@/lib/types/database'
import type { ProductFormValues } from '@/lib/validations'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface ProductDetailClientProps {
  product: Product
  profile: Profile
  isAdmin: boolean
  isAdminOrManager: boolean
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function ProductDetailClient({
  product: initialProduct,
  profile,
  isAdmin,
  isAdminOrManager,
}: ProductDetailClientProps) {
  const router = useRouter()

  const [product, setProduct] = useState<Product>(initialProduct)
  const [editOpen, setEditOpen] = useState(false)
  const [formLoading, setFormLoading] = useState(false)

  const [stockDelta, setStockDelta] = useState(1)
  const [stockReason, setStockReason] = useState('')
  const [stockLoading, setStockLoading] = useState(false)
  const [isPending, startTransition] = useTransition()

  const status = stockStatus(product.stock, product.reorder_level)

  // ── Edit submit ───────────────────────────────────────────────────────────
  const handleEditSubmit = useCallback(
    async (values: ProductFormValues) => {
      setFormLoading(true)
      try {
        const { data, error } = await updateProduct(product.id, {
          ...values,
          barcode: null,
          hsn_code: values.hsn_code || null,
          image_url: values.image_url || null,
          description: values.description || null,
          category: values.category || null,
          subcategory: values.subcategory || null,
          family: values.family || null,
          type: values.type || null,
          cost: values.cost ?? null,
          margin_pct: values.margin_pct ?? null,
        })
        if (error) {
          toast.error(error)
        } else if (data) {
          toast.success('Product updated')
          setEditOpen(false)
          setProduct(data)
          startTransition(() => router.refresh())
        }
      } finally {
        setFormLoading(false)
      }
    },
    [product.id, router],
  )

  // ── Stock adjustment ──────────────────────────────────────────────────────
  async function handleStockAdjust(direction: 'add' | 'sub') {
    const delta = direction === 'add' ? stockDelta : -stockDelta
    if (!stockReason.trim()) {
      toast.error('Please enter a reason for the stock adjustment')
      return
    }
    setStockLoading(true)
    try {
      const { data, error } = await adjustStock(product.id, delta, stockReason)
      if (error) {
        toast.error(error)
      } else if (data) {
        toast.success(
          `Stock ${direction === 'add' ? 'added' : 'reduced'} by ${stockDelta}`,
        )
        setProduct(data)
        setStockReason('')
        startTransition(() => router.refresh())
      }
    } finally {
      setStockLoading(false)
    }
  }

  const inputCls =
    'block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-700 focus:border-blue-700'

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* ── Breadcrumb + actions ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/inventory"
            className="p-2 rounded-lg text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <nav className="flex items-center gap-1 text-sm text-zinc-500">
            <Link href="/inventory" className="hover:text-zinc-700 transition-colors">
              Inventory
            </Link>
            <span>/</span>
            <span className="text-zinc-900 font-medium truncate max-w-[200px]">
              {product.name}
            </span>
          </nav>
        </div>

        {isAdminOrManager && (
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-zinc-700 border border-zinc-300 bg-white hover:bg-zinc-50 transition-colors"
          >
            <Edit className="w-4 h-4" />
            Edit Product
          </button>
        )}
      </div>

      {/* ── Main grid ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ── Left: Image ──────────────────────────────────────────────────── */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
            <div className="aspect-square bg-zinc-100 flex items-center justify-center">
              {product.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <ImageIcon className="w-16 h-16 text-zinc-300" />
              )}
            </div>

            {/* QR code / barcode — always shown; QR uses SKU, linear barcode uses barcode field if available */}
            <div className="p-4 border-t border-zinc-100">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">
                QR Code
              </p>
              <BarcodeDisplay
                value={product.barcode || product.sku}
                sku={product.sku}
                productName={product.name}
                imageUrl={product.image_url}
                showPrintButton
              />
            </div>
          </div>
        </div>

        {/* ── Right: Details ────────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-5">
          {/* Header card */}
          <div className="bg-white rounded-xl border border-zinc-200 p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-zinc-900 leading-tight">
                  {product.name}
                </h1>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className="text-xs font-mono bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded">
                    {product.sku}
                  </span>
                  {product.category && (
                    <span className="inline-flex items-center gap-1 text-xs text-violet-700 bg-violet-100 px-2 py-0.5 rounded-full">
                      <Tag className="w-3 h-3" />
                      {product.category}
                    </span>
                  )}
                  {product.subcategory && (
                    <span className="text-xs text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded-full">
                      {product.subcategory}
                    </span>
                  )}
                  {product.family && (
                    <span className="text-xs text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded-full">
                      {product.family}
                    </span>
                  )}
                  {product.type && (
                    <span className="text-xs text-zinc-500 bg-zinc-50 border border-zinc-200 px-2 py-0.5 rounded-full">
                      {product.type}
                    </span>
                  )}
                </div>
              </div>

              <StockBadge
                stock={product.stock}
                reorderLevel={product.reorder_level}
                size="md"
                className="flex-shrink-0"
              />
            </div>

            {product.description && (
              <p className="mt-4 text-sm text-zinc-600 leading-relaxed border-t border-zinc-100 pt-4">
                {product.description}
              </p>
            )}
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatBlock
              label="Selling Price"
              value={formatCurrency(product.price)}
              icon={IndianRupee}
              accent="text-zinc-900"
            />
            <StatBlock
              label="GST Rate"
              value={`${product.gst_pct}%`}
              icon={BadgePercent}
            />
            <StatBlock
              label="Current Stock"
              value={String(product.stock)}
              icon={Layers}
              accent={
                status === 'out-of-stock'
                  ? 'text-red-600'
                  : status === 'low-stock'
                    ? 'text-amber-600'
                    : 'text-emerald-600'
              }
            />
            <StatBlock
              label="Reorder Level"
              value={String(product.reorder_level)}
              icon={Layers}
            />
            <StatBlock
              label="Sold Count"
              value={String(product.sold_count)}
              icon={ShoppingCart}
            />
            {isAdmin && product.cost != null && (
              <StatBlock
                label="Cost Price"
                value={formatCurrency(product.cost)}
                icon={IndianRupee}
                badge="Admin"
              />
            )}
            {isAdmin && product.margin_pct != null && (
              <StatBlock
                label="Margin"
                value={`${product.margin_pct.toFixed(1)}%`}
                icon={BarChart3}
                badge="Admin"
                accent="text-amber-700"
              />
            )}
          </div>

          {/* Stock adjustment */}
          {isAdminOrManager && (
            <div className="bg-white rounded-xl border border-zinc-200 p-5">
              <h3 className="text-sm font-semibold text-zinc-900 mb-4">
                Adjust Stock
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    Quantity
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setStockDelta((d) => Math.max(1, d - 1))}
                      className="w-9 h-9 rounded-lg border border-zinc-300 flex items-center justify-center text-zinc-600 hover:bg-zinc-50 transition-colors"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <input
                      type="number"
                      min={1}
                      value={stockDelta}
                      onChange={(e) =>
                        setStockDelta(Math.max(1, parseInt(e.target.value) || 1))
                      }
                      className="w-20 text-center rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-700"
                    />
                    <button
                      type="button"
                      onClick={() => setStockDelta((d) => d + 1)}
                      className="w-9 h-9 rounded-lg border border-zinc-300 flex items-center justify-center text-zinc-600 hover:bg-zinc-50 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    Reason <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Received new shipment, Damaged goods..."
                    value={stockReason}
                    onChange={(e) => setStockReason(e.target.value)}
                    className={inputCls}
                  />
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => handleStockAdjust('sub')}
                    disabled={stockLoading}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 transition-colors disabled:opacity-50"
                  >
                    {stockLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Minus className="w-4 h-4" />
                    )}
                    Remove Stock
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStockAdjust('add')}
                    disabled={stockLoading}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                  >
                    {stockLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                    Add Stock
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Meta */}
          <p className="text-xs text-zinc-400 px-1">
            Added {formatDate(product.created_at)} &bull; Last updated{' '}
            {formatDate(product.updated_at)}
          </p>
        </div>
      </div>

      {/* ── Edit Dialog ───────────────────────────────────────────────────── */}
      <Dialog.Root open={editOpen} onOpenChange={setEditOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-xl border border-zinc-200 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
            <div className="flex items-center justify-between p-6 border-b border-zinc-100">
              <div>
                <Dialog.Title className="text-base font-semibold text-zinc-900">
                  Edit Product
                </Dialog.Title>
                <Dialog.Description className="mt-0.5 text-sm text-zinc-500">
                  {product.name}
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </Dialog.Close>
            </div>
            <div className="p-6">
              <ProductForm
                product={product}
                onSubmit={handleEditSubmit}
                onCancel={() => setEditOpen(false)}
                loading={formLoading}
                isAdmin={isAdmin}
              />
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}

// ---------------------------------------------------------------------------
// StatBlock
// ---------------------------------------------------------------------------
function StatBlock({
  label,
  value,
  icon: Icon,
  accent,
  badge,
}: {
  label: string
  value: string
  icon: React.ElementType
  accent?: string
  badge?: string
}) {
  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-zinc-500 leading-tight">{label}</p>
        <div className="flex items-center gap-1.5">
          {badge && (
            <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
              {badge}
            </span>
          )}
          <Icon className="w-4 h-4 text-zinc-300" />
        </div>
      </div>
      <p className={cn('text-xl font-bold tabular-nums', accent ?? 'text-zinc-700')}>
        {value}
      </p>
    </div>
  )
}
