'use client'

import { useState, useTransition, useCallback } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import * as Dialog from '@radix-ui/react-dialog'
import {
  Plus,
  Upload,
  Package,
  Search,
  LayoutGrid,
  List,
  X,
  Edit,
  Trash2,
  Eye,
  Image as ImageIcon,
  ChevronDown,
  Loader2,
  IndianRupee,
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { cn, formatCurrency } from '@/lib/utils'
import { FURNITURE_CATEGORIES, PRODUCT_TYPES } from '@/lib/constants'
import { createProduct, updateProduct, deleteProduct } from '@/lib/actions/inventory'
import { ProductForm } from '@/components/inventory/product-form'
import { CsvImport } from '@/components/inventory/csv-import'
import { StockBadge } from '@/components/inventory/stock-badge'
import type { Product } from '@/lib/types/database'
import type { ProductFormValues } from '@/lib/validations'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InventoryStats {
  totalProducts: number
  inventoryValue: number
  outOfStockCount: number
  lowStockCount: number
}

interface InventoryClientProps {
  products: Product[]
  count: number
  stats: InventoryStats
  isAdmin: boolean
  isAdminOrManager: boolean
  currentFilters: {
    category?: string
    type?: string
    stockStatus?: string
    search?: string
  }
}

// ---------------------------------------------------------------------------
// Dialog wrapper
// ---------------------------------------------------------------------------
function DialogModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  size = 'md',
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: React.ReactNode
  size?: 'md' | 'lg'
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
            'bg-white rounded-2xl shadow-xl border border-zinc-200',
            'max-h-[90vh] overflow-y-auto',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]',
            'data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]',
            'w-full mx-4',
            size === 'lg' ? 'max-w-2xl' : 'max-w-xl',
          )}
        >
          <div className="flex items-start justify-between p-6 border-b border-zinc-100">
            <div>
              <Dialog.Title className="text-base font-semibold text-zinc-900">
                {title}
              </Dialog.Title>
              {description && (
                <Dialog.Description className="mt-0.5 text-sm text-zinc-500">
                  {description}
                </Dialog.Description>
              )}
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
          <div className="p-6">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// ---------------------------------------------------------------------------
// Stats card
// ---------------------------------------------------------------------------
function StatItem({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string
  sub?: string
  accent?: string
}) {
  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-4">
      <p className="text-xs font-medium text-zinc-500 mb-1">{label}</p>
      <p className={cn('text-xl font-bold tabular-nums', accent ?? 'text-zinc-900')}>
        {value}
      </p>
      {sub && <p className="text-xs text-zinc-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Client Component
// ---------------------------------------------------------------------------
export function InventoryClient({
  products,
  count,
  stats,
  isAdmin,
  isAdminOrManager,
  currentFilters,
}: InventoryClientProps) {
  const router = useRouter()
  const pathname = usePathname()

  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table')
  const [addOpen, setAddOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const [isPending, startTransition] = useTransition()
  const [formLoading, setFormLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // ── URL filter helpers ────────────────────────────────────────────────────
  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams()
    if (currentFilters.category) params.set('category', currentFilters.category)
    if (currentFilters.type) params.set('type', currentFilters.type)
    if (currentFilters.stockStatus) params.set('stockStatus', currentFilters.stockStatus)
    if (currentFilters.search) params.set('search', currentFilters.search)

    if (value && value !== 'all') {
      params.set(key, value)
    } else {
      params.delete(key)
    }

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`)
    })
  }

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleAddSubmit = useCallback(
    async (values: ProductFormValues) => {
      setFormLoading(true)
      try {
        const { error } = await createProduct({
          ...values,
          barcode: values.barcode || null,
          image_url: values.image_url || null,
          description: values.description || null,
          category: values.category || null,
          subcategory: values.subcategory || null,
          family: values.family || null,
          type: values.type || null,
          cost: values.cost ?? null,
          margin_pct: values.margin_pct ?? null,
          metadata: null,
        })
        if (error) {
          toast.error(error)
        } else {
          toast.success('Product created successfully')
          setAddOpen(false)
          startTransition(() => router.refresh())
        }
      } finally {
        setFormLoading(false)
      }
    },
    [router],
  )

  const handleEditSubmit = useCallback(
    async (values: ProductFormValues) => {
      if (!editProduct) return
      setFormLoading(true)
      try {
        const { error } = await updateProduct(editProduct.id, {
          ...values,
          barcode: values.barcode || null,
          image_url: values.image_url || null,
          description: values.description || null,
          category: values.category || null,
          subcategory: values.subcategory || null,
          family: values.family || null,
          type: values.type || null,
          cost: values.cost ?? null,
          margin_pct: values.margin_pct ?? null,
          metadata: null,
        })
        if (error) {
          toast.error(error)
        } else {
          toast.success('Product updated successfully')
          setEditProduct(null)
          startTransition(() => router.refresh())
        }
      } finally {
        setFormLoading(false)
      }
    },
    [editProduct, router],
  )

  const handleDelete = useCallback(async () => {
    if (!deleteId) return
    setDeleteLoading(true)
    try {
      const { error } = await deleteProduct(deleteId)
      if (error) {
        toast.error(error)
      } else {
        toast.success('Product deleted')
        setDeleteId(null)
        startTransition(() => router.refresh())
      }
    } finally {
      setDeleteLoading(false)
    }
  }, [deleteId, router])

  const handleImportComplete = useCallback(
    (count: number) => {
      setImportOpen(false)
      startTransition(() => router.refresh())
    },
    [router],
  )

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">
            Inventory &amp; Products
          </h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            {count.toLocaleString()} product{count !== 1 ? 's' : ''}
          </p>
        </div>

        {isAdminOrManager && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-zinc-700 border border-zinc-300 bg-white hover:bg-zinc-50 transition-colors"
            >
              <Upload className="w-4 h-4" />
              Import CSV
            </button>

            <button
              type="button"
              onClick={() => router.push('/scan?mode=custom')}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-amber-700 border border-amber-300 bg-amber-50 hover:bg-amber-100 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Customised
            </button>

            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 active:bg-blue-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2"
            >
              <Plus className="w-4 h-4" />
              Add Product
            </button>
          </div>
        )}
      </div>

      {/* ── Stats row ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatItem
          label="Total Products"
          value={stats.totalProducts.toLocaleString()}
        />
        <StatItem
          label="Inventory Value"
          value={formatCurrency(stats.inventoryValue)}
          sub="at selling price"
        />
        <StatItem
          label="Out of Stock"
          value={String(stats.outOfStockCount)}
          accent={stats.outOfStockCount > 0 ? 'text-red-600' : undefined}
        />
        <StatItem
          label="Low Stock"
          value={String(stats.lowStockCount)}
          accent={stats.lowStockCount > 0 ? 'text-amber-600' : undefined}
        />
      </div>

      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
          <input
            type="search"
            placeholder="Search name or SKU…"
            defaultValue={currentFilters.search ?? ''}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                updateFilter('search', (e.target as HTMLInputElement).value)
              }
            }}
            onBlur={(e) => {
              const val = e.target.value
              if (val !== (currentFilters.search ?? '')) {
                updateFilter('search', val)
              }
            }}
            className="block w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-zinc-300 bg-white text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-700 focus:border-blue-700"
          />
        </div>

        {/* Category */}
        <select
          value={currentFilters.category ?? ''}
          onChange={(e) => updateFilter('category', e.target.value)}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-700 focus:border-blue-700"
        >
          <option value="">All Categories</option>
          {FURNITURE_CATEGORIES.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </select>

        {/* Type */}
        <select
          value={currentFilters.type ?? ''}
          onChange={(e) => updateFilter('type', e.target.value)}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-700 focus:border-blue-700"
        >
          <option value="">All Types</option>
          {PRODUCT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>

        {/* Stock status */}
        <select
          value={currentFilters.stockStatus ?? ''}
          onChange={(e) => updateFilter('stockStatus', e.target.value)}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-700 focus:border-blue-700"
        >
          <option value="">All Stock</option>
          <option value="in">In Stock</option>
          <option value="low">Low Stock</option>
          <option value="out">Out of Stock</option>
        </select>

        {/* View toggle */}
        <div className="flex items-center gap-1 rounded-lg border border-zinc-200 p-1 bg-white ml-auto">
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={cn(
              'p-1.5 rounded',
              viewMode === 'table'
                ? 'bg-zinc-100 text-zinc-900'
                : 'text-zinc-400 hover:text-zinc-600',
            )}
          >
            <List className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={cn(
              'p-1.5 rounded',
              viewMode === 'grid'
                ? 'bg-zinc-100 text-zinc-900'
                : 'text-zinc-400 hover:text-zinc-600',
            )}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Loading indicator ────────────────────────────────────────────── */}
      {isPending && (
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading…
        </div>
      )}

      {/* ── Product list / grid ───────────────────────────────────────────── */}
      {products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-zinc-200">
          <div className="w-14 h-14 rounded-2xl bg-zinc-100 flex items-center justify-center mb-4">
            <Package className="w-7 h-7 text-zinc-400" />
          </div>
          <p className="text-sm font-semibold text-zinc-900">No products found</p>
          <p className="text-sm text-zinc-500 mt-1">
            {Object.values(currentFilters).some(Boolean)
              ? 'Try adjusting your filters'
              : 'Add your first product to get started'}
          </p>
          {isAdminOrManager && !Object.values(currentFilters).some(Boolean) && (
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Product
            </button>
          )}
        </div>
      ) : viewMode === 'table' ? (
        <TableView
          products={products}
          isAdmin={isAdmin}
          isAdminOrManager={isAdminOrManager}
          onEdit={setEditProduct}
          onDelete={setDeleteId}
        />
      ) : (
        <GridView
          products={products}
          isAdmin={isAdmin}
          isAdminOrManager={isAdminOrManager}
          onEdit={setEditProduct}
          onDelete={setDeleteId}
        />
      )}

      {/* ── Add Product Dialog ────────────────────────────────────────────── */}
      <DialogModal
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Add Product"
        description="Fill in the product details below"
        size="lg"
      >
        <ProductForm
          onSubmit={handleAddSubmit}
          onCancel={() => setAddOpen(false)}
          loading={formLoading}
          isAdmin={isAdmin}
        />
      </DialogModal>

      {/* ── Edit Product Dialog ───────────────────────────────────────────── */}
      <DialogModal
        open={editProduct !== null}
        onOpenChange={(open) => { if (!open) setEditProduct(null) }}
        title="Edit Product"
        description={editProduct?.name ?? ''}
        size="lg"
      >
        {editProduct && (
          <ProductForm
            product={editProduct}
            onSubmit={handleEditSubmit}
            onCancel={() => setEditProduct(null)}
            loading={formLoading}
            isAdmin={isAdmin}
          />
        )}
      </DialogModal>

      {/* ── Import CSV Dialog ─────────────────────────────────────────────── */}
      <DialogModal
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Import Products from CSV"
        description="Upload a CSV file to bulk-import products"
        size="lg"
      >
        <CsvImport onComplete={handleImportComplete} />
      </DialogModal>

      {/* ── Delete Confirm Dialog ─────────────────────────────────────────── */}
      <Dialog.Root
        open={deleteId !== null}
        onOpenChange={(open) => { if (!open) setDeleteId(null) }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-xl border border-zinc-200 w-full max-w-sm mx-4 p-6">
            <Dialog.Title className="text-base font-semibold text-zinc-900 mb-1">
              Delete Product
            </Dialog.Title>
            <Dialog.Description className="text-sm text-zinc-500 mb-5">
              This action cannot be undone. The product will be permanently removed
              from inventory.
            </Dialog.Description>
            <div className="flex items-center justify-end gap-3">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 transition-colors"
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteLoading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleteLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Delete
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Table view
// ---------------------------------------------------------------------------
function TableView({
  products,
  isAdmin,
  isAdminOrManager,
  onEdit,
  onDelete,
}: {
  products: Product[]
  isAdmin: boolean
  isAdminOrManager: boolean
  onEdit: (p: Product) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-100 bg-zinc-50/80">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                Product
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                SKU
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                Category
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                Stock
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                Price
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                GST%
              </th>
              {isAdmin && (
                <>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                    Cost
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                    Margin%
                  </th>
                </>
              )}
              <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                Type
              </th>
              {isAdminOrManager && (
                <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {products.map((product) => (
              <tr
                key={product.id}
                className="hover:bg-zinc-50/60 transition-colors"
              >
                {/* Image + Name */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-zinc-100 flex-shrink-0 flex items-center justify-center border border-zinc-200">
                      {product.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="w-4 h-4 text-zinc-300" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <Link
                        href={`/inventory/${product.id}`}
                        className="text-sm font-medium text-zinc-900 hover:text-blue-700 transition-colors line-clamp-1"
                      >
                        {product.name}
                      </Link>
                    </div>
                  </div>
                </td>

                <td className="px-4 py-3">
                  <span className="text-xs font-mono text-zinc-600 bg-zinc-100 px-1.5 py-0.5 rounded">
                    {product.sku}
                  </span>
                </td>

                <td className="px-4 py-3">
                  <span className="text-sm text-zinc-600">
                    {product.category ?? '—'}
                  </span>
                </td>

                <td className="px-4 py-3">
                  <StockBadge stock={product.stock} reorderLevel={product.reorder_level} />
                </td>

                <td className="px-4 py-3 text-right">
                  <span className="text-sm font-medium text-zinc-900 tabular-nums">
                    {formatCurrency(product.price)}
                  </span>
                </td>

                <td className="px-4 py-3 text-center">
                  <span className="text-sm text-zinc-600">{product.gst_pct}%</span>
                </td>

                {isAdmin && (
                  <>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm text-zinc-600 tabular-nums">
                        {product.cost != null ? formatCurrency(product.cost) : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm text-zinc-600 tabular-nums">
                        {product.margin_pct != null
                          ? `${product.margin_pct.toFixed(1)}%`
                          : '—'}
                      </span>
                    </td>
                  </>
                )}

                <td className="px-4 py-3">
                  {product.type && (
                    <span className="text-xs text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-full">
                      {product.type}
                    </span>
                  )}
                </td>

                {isAdminOrManager && (
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/inventory/${product.id}`}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors"
                        title="View details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => onEdit(product)}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors"
                        title="Edit"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => onDelete(product.id)}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Grid view
// ---------------------------------------------------------------------------
function GridView({
  products,
  isAdmin,
  isAdminOrManager,
  onEdit,
  onDelete,
}: {
  products: Product[]
  isAdmin: boolean
  isAdminOrManager: boolean
  onEdit: (p: Product) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((product) => (
        <div
          key={product.id}
          className="bg-white rounded-xl border border-zinc-200 overflow-hidden hover:shadow-sm transition-shadow group"
        >
          {/* Image */}
          <div className="aspect-square bg-zinc-100 relative overflow-hidden">
            {product.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.image_url}
                alt={product.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ImageIcon className="w-12 h-12 text-zinc-300" />
              </div>
            )}

            {/* Overlay actions */}
            {isAdminOrManager && (
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={() => onEdit(product)}
                  className="w-7 h-7 rounded-lg bg-white/90 backdrop-blur-sm flex items-center justify-center text-zinc-600 hover:text-zinc-900 shadow-sm transition-colors"
                >
                  <Edit className="w-3.5 h-3.5" />
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => onDelete(product.id)}
                    className="w-7 h-7 rounded-lg bg-white/90 backdrop-blur-sm flex items-center justify-center text-red-600 hover:text-red-700 shadow-sm transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="p-4 space-y-2">
            <div>
              <Link
                href={`/inventory/${product.id}`}
                className="text-sm font-semibold text-zinc-900 hover:text-blue-700 transition-colors line-clamp-2 leading-snug"
              >
                {product.name}
              </Link>
              <p className="text-xs text-zinc-500 mt-0.5 font-mono">{product.sku}</p>
            </div>

            {product.category && (
              <p className="text-xs text-zinc-500 truncate">{product.category}</p>
            )}

            <StockBadge
              stock={product.stock}
              reorderLevel={product.reorder_level}
              size="sm"
            />

            <div className="flex items-center justify-between pt-1">
              <span className="text-sm font-bold text-zinc-900">
                {formatCurrency(product.price)}
              </span>
              <span className="text-xs text-zinc-400">+{product.gst_pct}% GST</span>
            </div>

            {isAdmin && product.margin_pct != null && (
              <p className="text-xs text-amber-700 font-medium">
                Margin: {product.margin_pct.toFixed(1)}%
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
