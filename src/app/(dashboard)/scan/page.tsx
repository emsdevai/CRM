'use client'

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useTransition,
} from 'react'
import {
  Camera,
  CameraOff,
  Search,
  Package,
  Tag,
  Barcode,
  Loader2,
  Plus,
  FileText,
  AlertCircle,
  CheckCircle,
  X,
  Image as ImageIcon,
  Sparkles,
  ChevronDown,
  IndianRupee,
  Percent,
  Layers,
  ShoppingCart,
} from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import { toast } from 'sonner'
import { cn, formatCurrency, formatDate, stockStatus } from '@/lib/utils'
import { useUser } from '@/hooks/use-user'
import { getProductByBarcode } from '@/lib/actions/inventory'
import { getActiveOffers, getPendingQuotations } from '@/lib/actions/catalog'
import { StockBadge } from '@/components/inventory/stock-badge'
import type { Product, Offer, DiscountRule } from '@/lib/types/database'
import { DEFAULT_DISCOUNT_RULES } from '@/lib/constants'
import { useRouter } from 'next/navigation'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ScanResultProduct extends Product {
  // resolved product
}

interface PendingQuotation {
  id: string
  created_at: string
  grand_total: number
  stage: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatDiscount(offer: Offer): string {
  if (!offer.discount_type || offer.discount_value == null) return '—'
  return offer.discount_type === 'percentage'
    ? `${offer.discount_value}% off`
    : `₹${offer.discount_value.toLocaleString('en-IN')} off`
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function ScanPage() {
  const { profile, loading: userLoading } = useUser()
  const router = useRouter()

  // Scanner state
  const [scannerActive, setScannerActive] = useState(false)
  const [scannerError, setScannerError] = useState<string | null>(null)
  const scannerRef = useRef<{ clear: () => Promise<void> } | null>(null)

  // Manual search
  const [manualCode, setManualCode] = useState('')
  const [searchLoading, setSearchLoading] = useState(false)

  // Product result
  const [product, setProduct] = useState<ScanResultProduct | null>(null)
  const [productError, setProductError] = useState<string | null>(null)

  // Quote controls
  const [quantity, setQuantity] = useState(1)
  const [discountPct, setDiscountPct] = useState(0)

  // Active offers
  const [activeOffers, setActiveOffers] = useState<Offer[]>([])
  const [offersLoading, setOffersLoading] = useState(false)

  // Pending quotations (for "add to existing")
  const [pendingQuotations, setPendingQuotations] = useState<PendingQuotation[]>([])
  const [addToExistingOpen, setAddToExistingOpen] = useState(false)
  const [selectedQuotationId, setSelectedQuotationId] = useState('')

  const [isPending, startTransition] = useTransition()

  // ── Discount limit based on role ──────────────────────────────────────────
  const role = profile?.role ?? 'salesperson'
  const discountRule = DEFAULT_DISCOUNT_RULES[role as keyof typeof DEFAULT_DISCOUNT_RULES]
  const maxDiscount = discountRule?.max_pct ?? 10

  // ── Load active offers ─────────────────────────────────────────────────────
  useEffect(() => {
    setOffersLoading(true)
    getActiveOffers()
      .then(({ data }) => {
        if (data) setActiveOffers(data)
      })
      .finally(() => setOffersLoading(false))
  }, [])

  // ── Scanner init / teardown ────────────────────────────────────────────────
  const startScanner = useCallback(async () => {
    setScannerError(null)

    try {
      const { Html5QrcodeScanner } = await import('html5-qrcode')

      const scanner = new Html5QrcodeScanner(
        'qr-reader',
        {
          fps: 10,
          qrbox: { width: 280, height: 280 },
          rememberLastUsedCamera: true,
        },
        /* verbose= */ false,
      )

      scanner.render(
        async (decodedText) => {
          // Stop scanner after first successful scan
          await scanner.clear().catch(() => {})
          scannerRef.current = null
          setScannerActive(false)
          handleCodeFound(decodedText)
        },
        (errorMsg) => {
          // Ignore transient scan errors (no barcode in frame)
        },
      )

      scannerRef.current = scanner
      setScannerActive(true)
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to start camera'
      setScannerError(msg)
      setScannerActive(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      await scannerRef.current.clear().catch(() => {})
      scannerRef.current = null
    }
    setScannerActive(false)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {})
      }
    }
  }, [])

  // ── Code found handler ─────────────────────────────────────────────────────
  const handleCodeFound = useCallback(async (code: string) => {
    setProductError(null)
    setProduct(null)
    setSearchLoading(true)
    setQuantity(1)
    setDiscountPct(0)

    try {
      const { data, error } = await getProductByBarcode(code.trim())
      if (error || !data) {
        setProductError(error ?? 'Product not found')
        toast.error(error ?? 'Product not found for this code')
      } else {
        setProduct(data)
        toast.success(`Found: ${data.name}`)
      }
    } finally {
      setSearchLoading(false)
    }
  }, [])

  // ── Manual search ─────────────────────────────────────────────────────────
  async function handleManualSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!manualCode.trim()) return
    await stopScanner()
    await handleCodeFound(manualCode.trim())
  }

  // ── "Add to new quote" ───────────────────────────────────────────────────
  function handleAddToNewQuote() {
    if (!product) return
    // Navigate to quotations with prefill params
    const params = new URLSearchParams({
      product: product.id,
      qty: String(quantity),
      discount: String(discountPct),
    })
    router.push(`/quotations/new?${params.toString()}`)
  }

  // ── "Add to existing quote" ────────────────────────────────────────────────
  async function openAddToExisting() {
    const { data } = await getPendingQuotations()
    if (data) setPendingQuotations(data)
    setAddToExistingOpen(true)
  }

  function handleAddToExistingConfirm() {
    if (!product || !selectedQuotationId) return
    const params = new URLSearchParams({
      product: product.id,
      qty: String(quantity),
      discount: String(discountPct),
    })
    router.push(`/quotations/${selectedQuotationId}/edit?${params.toString()}`)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (userLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    )
  }

  const status = product ? stockStatus(product.stock, product.reorder_level) : null

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Scan &amp; Quote</h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          Scan a barcode or enter a SKU to look up a product and add it to a quotation
        </p>
      </div>

      {/* ── Active offers banner ──────────────────────────────────────────── */}
      {activeOffers.length > 0 && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-amber-600" />
            <p className="text-sm font-semibold text-amber-800">
              Active Offers Today
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {activeOffers.map((offer) => (
              <span
                key={offer.id}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-800 bg-amber-100 border border-amber-300 px-2.5 py-1 rounded-full"
              >
                <Tag className="w-3 h-3" />
                {offer.title} — {formatDiscount(offer)}
                {offer.category && (
                  <span className="text-amber-600">({offer.category})</span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Scanner section ───────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        {/* Scanner viewfinder */}
        <div className="bg-zinc-950 relative min-h-[280px] flex items-center justify-center">
          {!scannerActive && !scannerError && (
            <div className="flex flex-col items-center gap-3 text-zinc-500">
              <CameraOff className="w-12 h-12 text-zinc-700" />
              <p className="text-sm text-zinc-600">Camera is not active</p>
            </div>
          )}

          {scannerError && (
            <div className="flex flex-col items-center gap-2 text-red-400 px-4 text-center">
              <AlertCircle className="w-10 h-10" />
              <p className="text-sm">{scannerError}</p>
            </div>
          )}

          {/* html5-qrcode mounts here */}
          <div
            id="qr-reader"
            className={cn(
              'w-full',
              scannerActive ? 'block' : 'hidden',
            )}
          />
        </div>

        {/* Scanner controls */}
        <div className="p-4 flex items-center gap-3">
          {!scannerActive ? (
            <button
              type="button"
              onClick={startScanner}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-green-700 hover:bg-green-800 active:bg-green-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700 focus-visible:ring-offset-2"
            >
              <Camera className="w-4 h-4" />
              Start Scanner
            </button>
          ) : (
            <button
              type="button"
              onClick={stopScanner}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 transition-colors"
            >
              <CameraOff className="w-4 h-4" />
              Stop Scanner
            </button>
          )}
        </div>
      </div>

      {/* ── Manual search ────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-zinc-200 p-5">
        <p className="text-sm font-medium text-zinc-700 mb-3 flex items-center gap-1.5">
          <Barcode className="w-4 h-4 text-zinc-400" />
          Or enter SKU / Barcode manually
        </p>
        <form onSubmit={handleManualSearch} className="flex gap-2">
          <input
            type="text"
            placeholder="e.g. LR-SOF-0001 or 1234567890123"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-green-700 focus:border-green-700"
          />
          <button
            type="submit"
            disabled={searchLoading || !manualCode.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-green-700 hover:bg-green-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {searchLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            Search
          </button>
        </form>
      </div>

      {/* ── Search loading state ──────────────────────────────────────────── */}
      {searchLoading && (
        <div className="flex items-center gap-2 justify-center py-4 text-zinc-500 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Looking up product…
        </div>
      )}

      {/* ── Product not found error ───────────────────────────────────────── */}
      {productError && !searchLoading && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-700">Not found</p>
            <p className="text-xs text-red-600 mt-0.5">{productError}</p>
          </div>
          <button
            type="button"
            onClick={() => setProductError(null)}
            className="ml-auto p-1 text-red-400 hover:text-red-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Product result card ───────────────────────────────────────────── */}
      {product && !searchLoading && (
        <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
          {/* Product header */}
          <div className="flex gap-4 p-5 border-b border-zinc-100">
            {/* Image */}
            <div className="w-20 h-20 rounded-xl bg-zinc-100 flex-shrink-0 overflow-hidden border border-zinc-200 flex items-center justify-center">
              {product.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <ImageIcon className="w-8 h-8 text-zinc-300" />
              )}
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-zinc-900 leading-tight">
                    {product.name}
                  </h3>
                  <p className="text-xs font-mono text-zinc-500 mt-0.5">{product.sku}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setProduct(null)
                    setManualCode('')
                  }}
                  className="p-1 text-zinc-400 hover:text-zinc-600 flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                {product.category && (
                  <span className="inline-flex items-center gap-1 text-xs text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded-full">
                    <Tag className="w-2.5 h-2.5" />
                    {product.category}
                  </span>
                )}
                <StockBadge
                  stock={product.stock}
                  reorderLevel={product.reorder_level}
                  size="sm"
                />
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="grid grid-cols-3 divide-x divide-zinc-100 border-b border-zinc-100">
            <div className="px-4 py-3 text-center">
              <p className="text-xs text-zinc-500 mb-0.5">Price</p>
              <p className="text-sm font-bold text-zinc-900">
                {formatCurrency(product.price)}
              </p>
            </div>
            <div className="px-4 py-3 text-center">
              <p className="text-xs text-zinc-500 mb-0.5">GST</p>
              <p className="text-sm font-semibold text-zinc-700">
                {product.gst_pct}%
              </p>
            </div>
            <div className="px-4 py-3 text-center">
              <p className="text-xs text-zinc-500 mb-0.5">Stock</p>
              <p
                className={cn(
                  'text-sm font-bold',
                  status === 'out-of-stock'
                    ? 'text-red-600'
                    : status === 'low-stock'
                      ? 'text-amber-600'
                      : 'text-emerald-600',
                )}
              >
                {product.stock}
              </p>
            </div>
          </div>

          {/* Quote controls */}
          <div className="p-5 space-y-4">
            {/* Quantity */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                Quantity
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="w-9 h-9 rounded-lg border border-zinc-300 flex items-center justify-center text-zinc-600 hover:bg-zinc-50 transition-colors"
                >
                  <span className="text-lg leading-none">−</span>
                </button>
                <input
                  type="number"
                  min={1}
                  max={Math.max(1, product.stock)}
                  value={quantity}
                  onChange={(e) =>
                    setQuantity(
                      Math.max(1, Math.min(parseInt(e.target.value) || 1, Math.max(1, product.stock))),
                    )
                  }
                  className="w-20 text-center rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-green-700"
                />
                <button
                  type="button"
                  onClick={() =>
                    setQuantity((q) => Math.min(Math.max(1, product.stock), q + 1))
                  }
                  className="w-9 h-9 rounded-lg border border-zinc-300 flex items-center justify-center text-zinc-600 hover:bg-zinc-50 transition-colors"
                >
                  <span className="text-lg leading-none">+</span>
                </button>
              </div>
            </div>

            {/* Discount */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                Discount %
                <span className="ml-1 text-xs text-zinc-400 font-normal">
                  (max {maxDiscount}%)
                </span>
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={maxDiscount}
                  step={0.5}
                  value={discountPct}
                  onChange={(e) => setDiscountPct(parseFloat(e.target.value))}
                  className="flex-1 h-2 rounded-full appearance-none bg-zinc-200 accent-green-700"
                />
                <div className="relative w-20">
                  <input
                    type="number"
                    min={0}
                    max={maxDiscount}
                    step={0.5}
                    value={discountPct}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value)
                      if (!isNaN(val)) {
                        setDiscountPct(Math.min(maxDiscount, Math.max(0, val)))
                      }
                    }}
                    className="w-full pr-6 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-green-700"
                  />
                  <Percent className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
                </div>
              </div>
              {discountPct > 0 && (
                <p className="text-xs text-amber-700 mt-1">
                  Discount: −{formatCurrency((product.price * discountPct) / 100)} per unit
                </p>
              )}
            </div>

            {/* Line total */}
            {quantity > 0 && (
              <div className="rounded-xl bg-zinc-50 border border-zinc-200 px-4 py-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-600">
                    {quantity} × {formatCurrency(product.price)}
                    {discountPct > 0 && ` (−${discountPct}%)`}
                  </span>
                  <span className="font-bold text-zinc-900">
                    {formatCurrency(
                      quantity * product.price * (1 - discountPct / 100),
                    )}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  + GST: {formatCurrency(
                    quantity *
                      product.price *
                      (1 - discountPct / 100) *
                      (product.gst_pct / 100),
                  )}
                </p>
              </div>
            )}

            {/* Action buttons */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleAddToNewQuote}
                disabled={status === 'out-of-stock'}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-green-700 hover:bg-green-800 active:bg-green-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700 focus-visible:ring-offset-2"
              >
                <Plus className="w-4 h-4" />
                Add to New Quote
              </button>

              <button
                type="button"
                onClick={openAddToExisting}
                disabled={status === 'out-of-stock'}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-zinc-700 border border-zinc-300 bg-white hover:bg-zinc-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FileText className="w-4 h-4" />
                Add to Existing Quote
              </button>
            </div>

            {status === 'out-of-stock' && (
              <p className="text-xs text-red-600 text-center">
                This product is out of stock and cannot be added to a quote
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Add to Existing Quote Dialog ──────────────────────────────────── */}
      <Dialog.Root open={addToExistingOpen} onOpenChange={setAddToExistingOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-xl border border-zinc-200 w-full max-w-sm mx-4 p-6 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
            <Dialog.Title className="text-base font-semibold text-zinc-900 mb-1">
              Add to Existing Quote
            </Dialog.Title>
            <Dialog.Description className="text-sm text-zinc-500 mb-4">
              Select a draft or pending quotation to add {product?.name} to.
            </Dialog.Description>

            {pendingQuotations.length === 0 ? (
              <div className="py-6 text-center">
                <FileText className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                <p className="text-sm text-zinc-500">No draft quotations found</p>
                <p className="text-xs text-zinc-400 mt-1">
                  Create a new quotation instead
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {pendingQuotations.map((q) => (
                  <label
                    key={q.id}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                      selectedQuotationId === q.id
                        ? 'border-green-600 bg-green-50'
                        : 'border-zinc-200 hover:bg-zinc-50',
                    )}
                  >
                    <input
                      type="radio"
                      name="quotation"
                      value={q.id}
                      checked={selectedQuotationId === q.id}
                      onChange={() => setSelectedQuotationId(q.id)}
                      className="w-4 h-4 text-green-700 border-zinc-300"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-zinc-900 truncate">
                        Quote #{q.id.slice(0, 8).toUpperCase()}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {q.stage} · {formatDate(q.created_at)} ·{' '}
                        {formatCurrency(q.grand_total)}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 mt-4 pt-3 border-t border-zinc-100">
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
                onClick={handleAddToExistingConfirm}
                disabled={!selectedQuotationId}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-green-700 hover:bg-green-800 transition-colors disabled:opacity-50"
              >
                <ShoppingCart className="w-4 h-4" />
                Add to Quote
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
