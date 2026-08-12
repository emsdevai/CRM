'use client'

import { useState, useEffect, useCallback, useTransition } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import * as Tabs from '@radix-ui/react-tabs'
import * as Switch from '@radix-ui/react-switch'
import {
  Plus,
  Edit,
  Trash2,
  X,
  Tag,
  Loader2,
  Image as ImageIcon,
  Percent,
  IndianRupee,
  CalendarDays,
  Package,
  BadgeCheck,
  LayoutGrid,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import { FURNITURE_CATEGORIES } from '@/lib/constants'
import { useUser } from '@/hooks/use-user'
import {
  getOffers,
  getCatalogProducts,
  createOffer,
  updateOffer,
  deleteOffer,
  toggleOfferActive,
} from '@/lib/actions/catalog'
import { OfferForm } from '@/components/catalog/offer-form'
import { StockBadge } from '@/components/inventory/stock-badge'
import type { Offer, Product } from '@/lib/types/database'
import type { OfferFormValues } from '@/lib/validations'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type CatalogProduct = Product & { activeOffer: Offer | null }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatDiscount(offer: Offer): string {
  if (!offer.discount_type || offer.discount_value == null) return '—'
  if (offer.discount_type === 'percentage') {
    return `${offer.discount_value}% off`
  }
  return `₹${offer.discount_value.toLocaleString('en-IN')} off`
}

function OfferDateRange({ offer }: { offer: Offer }) {
  const start = offer.start_date ? formatDate(offer.start_date) : null
  const end = offer.end_date ? formatDate(offer.end_date) : null

  if (!start && !end) return <span className="text-zinc-400 text-xs">No date limit</span>

  return (
    <span className="flex items-center gap-1 text-xs text-zinc-500">
      <CalendarDays className="w-3 h-3" />
      {start && end ? `${start} – ${end}` : start ? `From ${start}` : `Until ${end}`}
    </span>
  )
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
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-xl border border-zinc-200 w-full max-w-xl mx-4 max-h-[90vh] overflow-y-auto data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
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
// Page
// ---------------------------------------------------------------------------
export default function CatalogPage() {
  const { profile, isAdmin, canSeeMargin, loading: userLoading } = useUser()

  // Data
  const [products, setProducts] = useState<CatalogProduct[]>([])
  const [offers, setOffers] = useState<Offer[]>([])
  const [dataLoading, setDataLoading] = useState(true)

  // Filters
  const [categoryFilter, setCategoryFilter] = useState('')

  // Dialog state
  const [createOfferOpen, setCreateOfferOpen] = useState(false)
  const [editOffer, setEditOffer] = useState<Offer | null>(null)
  const [deleteOfferId, setDeleteOfferId] = useState<string | null>(null)
  const [formLoading, setFormLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  // ── Load data ─────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setDataLoading(true)
    const [productsRes, offersRes] = await Promise.all([
      getCatalogProducts(categoryFilter || undefined),
      getOffers(),
    ])
    if (productsRes.data) setProducts(productsRes.data)
    if (offersRes.data) setOffers(offersRes.data)
    setDataLoading(false)
  }, [categoryFilter])

  useEffect(() => {
    loadData()
  }, [loadData])

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleCreateOffer = useCallback(async (values: OfferFormValues) => {
    setFormLoading(true)
    try {
      const { error } = await createOffer({
        title: values.title,
        category: values.category || null,
        discount_type: values.discount_type || null,
        discount_value: values.discount_value ?? null,
        start_date: values.start_date || null,
        end_date: values.end_date || null,
        active: values.active,
      })
      if (error) {
        toast.error(error)
      } else {
        toast.success('Offer created')
        setCreateOfferOpen(false)
        loadData()
      }
    } finally {
      setFormLoading(false)
    }
  }, [loadData])

  const handleEditOffer = useCallback(async (values: OfferFormValues) => {
    if (!editOffer) return
    setFormLoading(true)
    try {
      const { error } = await updateOffer(editOffer.id, {
        title: values.title,
        category: values.category || null,
        discount_type: values.discount_type || null,
        discount_value: values.discount_value ?? null,
        start_date: values.start_date || null,
        end_date: values.end_date || null,
        active: values.active,
      })
      if (error) {
        toast.error(error)
      } else {
        toast.success('Offer updated')
        setEditOffer(null)
        loadData()
      }
    } finally {
      setFormLoading(false)
    }
  }, [editOffer, loadData])

  const handleDeleteOffer = useCallback(async () => {
    if (!deleteOfferId) return
    setDeleteLoading(true)
    try {
      const { error } = await deleteOffer(deleteOfferId)
      if (error) {
        toast.error(error)
      } else {
        toast.success('Offer deleted')
        setDeleteOfferId(null)
        loadData()
      }
    } finally {
      setDeleteLoading(false)
    }
  }, [deleteOfferId, loadData])

  const handleToggleOffer = useCallback(async (id: string, active: boolean) => {
    setTogglingId(id)
    try {
      const { error } = await toggleOfferActive(id, active)
      if (error) {
        toast.error(error)
      } else {
        setOffers((prev) =>
          prev.map((o) => (o.id === id ? { ...o, active } : o)),
        )
      }
    } finally {
      setTogglingId(null)
    }
  }, [])

  // ── Render ────────────────────────────────────────────────────────────────

  if (userLoading || dataLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    )
  }

  const isAdminOrManager = profile?.role === 'admin' || profile?.role === 'manager'
  const activeOffersCount = offers.filter((o) => o.active).length

  return (
    <div className="space-y-5">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Catalog &amp; Offers</h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            {products.length} products &bull;{' '}
            {activeOffersCount} active offer{activeOffersCount !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <Tabs.Root defaultValue="catalog" className="space-y-5">
        <Tabs.List className="flex gap-1 bg-zinc-100 rounded-xl p-1 w-fit">
          <Tabs.Trigger
            value="catalog"
            className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-600 data-[state=active]:bg-white data-[state=active]:text-zinc-900 data-[state=active]:shadow-sm transition-all"
          >
            <span className="flex items-center gap-1.5">
              <LayoutGrid className="w-3.5 h-3.5" />
              Product Catalog
            </span>
          </Tabs.Trigger>
          <Tabs.Trigger
            value="offers"
            className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-600 data-[state=active]:bg-white data-[state=active]:text-zinc-900 data-[state=active]:shadow-sm transition-all"
          >
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Active Offers
              {activeOffersCount > 0 && (
                <span className="ml-0.5 bg-green-700 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {activeOffersCount}
                </span>
              )}
            </span>
          </Tabs.Trigger>
        </Tabs.List>

        {/* ── Product Catalog tab ────────────────────────────────────────── */}
        <Tabs.Content value="catalog" className="space-y-4">
          {/* Category filter */}
          <div className="flex items-center gap-3">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-green-700 focus:border-green-700"
            >
              <option value="">All Categories</option>
              {FURNITURE_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-zinc-200">
              <div className="w-14 h-14 rounded-2xl bg-zinc-100 flex items-center justify-center mb-4">
                <Package className="w-7 h-7 text-zinc-400" />
              </div>
              <p className="text-sm font-semibold text-zinc-900">No products found</p>
              <p className="text-sm text-zinc-500 mt-1">
                {categoryFilter ? 'No products in this category' : 'Add products in Inventory'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  canSeeMargin={canSeeMargin}
                />
              ))}
            </div>
          )}
        </Tabs.Content>

        {/* ── Offers tab ────────────────────────────────────────────────── */}
        <Tabs.Content value="offers" className="space-y-4">
          {isAdmin && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-zinc-500">
                {offers.length} total offer{offers.length !== 1 ? 's' : ''}
              </p>
              <button
                type="button"
                onClick={() => setCreateOfferOpen(true)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-white bg-green-700 hover:bg-green-800 active:bg-green-900 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create Offer
              </button>
            </div>
          )}

          {offers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-zinc-200">
              <div className="w-14 h-14 rounded-2xl bg-zinc-100 flex items-center justify-center mb-4">
                <Sparkles className="w-7 h-7 text-zinc-400" />
              </div>
              <p className="text-sm font-semibold text-zinc-900">No offers yet</p>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setCreateOfferOpen(true)}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-green-700 hover:bg-green-800 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Create First Offer
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {offers.map((offer) => (
                <OfferCard
                  key={offer.id}
                  offer={offer}
                  isAdmin={isAdmin}
                  toggling={togglingId === offer.id}
                  onEdit={() => setEditOffer(offer)}
                  onDelete={() => setDeleteOfferId(offer.id)}
                  onToggle={(active) => handleToggleOffer(offer.id, active)}
                />
              ))}
            </div>
          )}
        </Tabs.Content>
      </Tabs.Root>

      {/* ── Create Offer Dialog ───────────────────────────────────────────── */}
      <DialogModal
        open={createOfferOpen}
        onOpenChange={setCreateOfferOpen}
        title="Create Offer"
        description="Set up a discount offer for your products"
      >
        <OfferForm
          onSubmit={handleCreateOffer}
          onCancel={() => setCreateOfferOpen(false)}
          loading={formLoading}
        />
      </DialogModal>

      {/* ── Edit Offer Dialog ────────────────────────────────────────────── */}
      <DialogModal
        open={editOffer !== null}
        onOpenChange={(open) => { if (!open) setEditOffer(null) }}
        title="Edit Offer"
        description={editOffer?.title}
      >
        {editOffer && (
          <OfferForm
            offer={editOffer}
            onSubmit={handleEditOffer}
            onCancel={() => setEditOffer(null)}
            loading={formLoading}
          />
        )}
      </DialogModal>

      {/* ── Delete Offer Confirm ──────────────────────────────────────────── */}
      <Dialog.Root
        open={deleteOfferId !== null}
        onOpenChange={(open) => { if (!open) setDeleteOfferId(null) }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-xl border border-zinc-200 w-full max-w-sm mx-4 p-6">
            <Dialog.Title className="text-base font-semibold text-zinc-900 mb-1">
              Delete Offer
            </Dialog.Title>
            <Dialog.Description className="text-sm text-zinc-500 mb-5">
              This offer will be permanently deleted. This action cannot be undone.
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
                onClick={handleDeleteOffer}
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
// Product Card
// ---------------------------------------------------------------------------
function ProductCard({
  product,
  canSeeMargin,
}: {
  product: CatalogProduct
  canSeeMargin: boolean
}) {
  const hasOffer = product.activeOffer !== null

  return (
    <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden hover:shadow-sm transition-shadow relative">
      {/* Offer badge */}
      {hasOffer && (
        <div className="absolute top-2 left-2 z-10 inline-flex items-center gap-1 bg-amber-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-sm">
          <Sparkles className="w-2.5 h-2.5" />
          {formatDiscount(product.activeOffer!)}
        </div>
      )}

      {/* Image */}
      <div className="aspect-square bg-zinc-100 overflow-hidden">
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="w-10 h-10 text-zinc-300" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4 space-y-2">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 line-clamp-2 leading-snug">
            {product.name}
          </h3>
          {product.category && (
            <p className="text-xs text-zinc-400 mt-0.5 flex items-center gap-1">
              <Tag className="w-2.5 h-2.5" />
              {product.subcategory
                ? `${product.category} › ${product.subcategory}`
                : product.category}
            </p>
          )}
        </div>

        <StockBadge
          stock={product.stock}
          reorderLevel={product.reorder_level}
          size="sm"
        />

        <div className="flex items-center justify-between pt-1">
          <div>
            <p className="text-sm font-bold text-zinc-900">
              {formatCurrency(product.price)}
            </p>
            <p className="text-xs text-zinc-400">+{product.gst_pct}% GST</p>
          </div>

          {canSeeMargin && product.margin_pct != null && (
            <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
              {product.margin_pct.toFixed(1)}% margin
            </span>
          )}
        </div>

        {hasOffer && product.activeOffer && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1.5 text-xs text-amber-800">
            <span className="font-semibold">{product.activeOffer.title}</span>
            {product.activeOffer.end_date && (
              <span className="text-amber-600 ml-1">
                · until {formatDate(product.activeOffer.end_date)}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Offer Card
// ---------------------------------------------------------------------------
function OfferCard({
  offer,
  isAdmin,
  toggling,
  onEdit,
  onDelete,
  onToggle,
}: {
  offer: Offer
  isAdmin: boolean
  toggling: boolean
  onEdit: () => void
  onDelete: () => void
  onToggle: (active: boolean) => void
}) {
  return (
    <div
      className={cn(
        'bg-white rounded-xl border p-5 space-y-3 transition-shadow hover:shadow-sm',
        offer.active ? 'border-green-200' : 'border-zinc-200 opacity-70',
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-zinc-900 truncate">
            {offer.title}
          </h3>
          {offer.category ? (
            <p className="text-xs text-zinc-500 flex items-center gap-1 mt-0.5">
              <Tag className="w-3 h-3" />
              {offer.category}
            </p>
          ) : (
            <p className="text-xs text-zinc-400 mt-0.5">All categories</p>
          )}
        </div>

        {offer.active && (
          <span className="flex-shrink-0 inline-flex items-center gap-1 text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
            <BadgeCheck className="w-3 h-3" />
            Active
          </span>
        )}
      </div>

      {/* Discount */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
          {offer.discount_type === 'flat' ? (
            <IndianRupee className="w-4 h-4 text-amber-700" />
          ) : (
            <Percent className="w-4 h-4 text-amber-700" />
          )}
        </div>
        <div>
          <p className="text-base font-bold text-zinc-900">
            {formatDiscount(offer)}
          </p>
          <p className="text-xs text-zinc-400 capitalize">
            {offer.discount_type ?? 'discount'}
          </p>
        </div>
      </div>

      {/* Date range */}
      <OfferDateRange offer={offer} />

      {/* Footer: toggle + actions */}
      {isAdmin ? (
        <div className="flex items-center justify-between pt-1 border-t border-zinc-100">
          <div className="flex items-center gap-2">
            <Switch.Root
              checked={offer.active}
              onCheckedChange={(checked) => onToggle(checked)}
              disabled={toggling}
              className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700 focus-visible:ring-offset-2 data-[state=checked]:bg-green-600 data-[state=unchecked]:bg-zinc-300 disabled:opacity-50"
            >
              <Switch.Thumb className="block h-4 w-4 rounded-full bg-white shadow-sm transition-transform data-[state=checked]:translate-x-[18px] data-[state=unchecked]:translate-x-[2px]" />
            </Switch.Root>
            <span className="text-xs text-zinc-500">
              {toggling ? 'Updating…' : offer.active ? 'Enabled' : 'Disabled'}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onEdit}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors"
            >
              <Edit className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        /* Non-admin: read-only, no management controls */
        <div className="pt-1 border-t border-zinc-100">
          <span
            className={cn(
              'text-xs font-medium',
              offer.active ? 'text-green-700' : 'text-zinc-400',
            )}
          >
            {offer.active ? 'Currently active' : 'Not active'}
          </span>
        </div>
      )}
    </div>
  )
}
