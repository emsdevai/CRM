'use client'

import {
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react'
import {
  Camera,
  CameraOff,
  Search,
  Tag,
  Barcode,
  Loader2,
  FileText,
  AlertCircle,
  X,
  Image as ImageIcon,
  Sparkles,
  Percent,
  ShoppingCart,
  Receipt,
  User,
  UserPlus,
  ArrowRight,
  CheckCircle2,
  Banknote,
  RotateCcw,
  ChevronRight,
  Palette,
} from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import { toast } from 'sonner'
import { cn, formatCurrency, stockStatus } from '@/lib/utils'
import { useUser } from '@/hooks/use-user'
import { getProductByBarcode, createCustomizedProduct } from '@/lib/actions/inventory'
import { getActiveOffers } from '@/lib/actions/catalog'
import { StockBadge } from '@/components/inventory/stock-badge'
import type { Product, Offer, Lead, Customer } from '@/lib/types/database'
import { DEFAULT_DISCOUNT_RULES } from '@/lib/constants'
import {
  createQuotation,
  convertToInvoice,
  searchLeads,
  searchCustomers,
} from '@/lib/actions/quotations'
import { updatePaymentStatus } from '@/lib/actions/invoices'
import { createLead } from '@/lib/actions/leads'
import { LeadForm } from '@/components/leads/lead-form'
import { CustomizedProductForm } from '@/components/inventory/customized-product-form'
import type { LeadFormValues } from '@/lib/validations'
import type { CustomizedProductFormValues } from '@/components/inventory/customized-product-form'
import { useRouter, useSearchParams } from 'next/navigation'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type PageMode  = 'scan' | 'custom'
type FlowStep  = 'scan' | 'custom_pick' | 'custom_form' | 'quote_created' | 'invoice_created'

interface CreatedQuotation {
  id: string
  stage: string
  grand_total: number
}

interface CreatedInvoice {
  id: string
  invoice_no: string
  payment_status: string
  grand_total: number
}

type EntityType = 'lead' | 'customer' | 'walkin'
interface SelectedEntity {
  type: EntityType
  id?: string
  name: string
  phone?: string
}

function formatDiscount(offer: Offer): string {
  if (!offer.discount_type || offer.discount_value == null) return '—'
  return offer.discount_type === 'percentage'
    ? `${offer.discount_value}% off`
    : `₹${offer.discount_value.toLocaleString('en-IN')} off`
}

// ---------------------------------------------------------------------------
// Step indicator — adapts to mode
// ---------------------------------------------------------------------------
function StepIndicator({ mode, step }: { mode: PageMode; step: FlowStep }) {
  const steps =
    mode === 'custom'
      ? [
          { key: 'custom_pick', label: 'Customer' },
          { key: 'custom_form', label: 'Product' },
          { key: 'quote_created', label: 'Quotation' },
          { key: 'invoice_created', label: 'Invoice' },
        ]
      : [
          { key: 'scan', label: 'Scan' },
          { key: 'quote_created', label: 'Quotation' },
          { key: 'invoice_created', label: 'Invoice' },
        ]

  const currentIdx = steps.findIndex((s) => s.key === step)

  return (
    <div className="flex items-center gap-0">
      {steps.map((s, idx) => (
        <div key={s.key} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors',
                idx < currentIdx
                  ? 'bg-blue-700 border-blue-700 text-white'
                  : idx === currentIdx
                    ? 'bg-white border-blue-700 text-blue-700'
                    : 'bg-white border-zinc-300 text-zinc-400',
              )}
            >
              {idx < currentIdx ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
            </div>
            <span
              className={cn(
                'text-[10px] mt-0.5 font-medium',
                idx <= currentIdx ? 'text-blue-700' : 'text-zinc-400',
              )}
            >
              {s.label}
            </span>
          </div>
          {idx < steps.length - 1 && (
            <div
              className={cn(
                'h-0.5 w-8 mb-3 mx-1 transition-colors',
                idx < currentIdx ? 'bg-blue-700' : 'bg-zinc-200',
              )}
            />
          )}
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Selected entity chip (reused in both modes)
// ---------------------------------------------------------------------------
function EntityChip({
  entity,
  onClear,
}: {
  entity: SelectedEntity
  onClear?: () => void
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200">
      <div className="w-6 h-6 rounded-full bg-blue-700 flex items-center justify-center flex-shrink-0">
        <span className="text-white text-[10px] font-bold">
          {entity.name.charAt(0).toUpperCase()}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-blue-900 truncate">{entity.name}</p>
        <p className="text-xs text-blue-700">
          {entity.type === 'walkin' ? 'Walk-in lead' : entity.type === 'lead' ? 'Lead' : 'Customer'}
          {entity.phone && ` · ${entity.phone}`}
        </p>
      </div>
      {onClear && (
        <button type="button" onClick={onClear} className="text-blue-500 hover:text-blue-700 flex-shrink-0">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function ScanPage() {
  const { profile, loading: userLoading } = useUser()
  const router = useRouter()
  const searchParams = useSearchParams()

  // ── Mode — initialise from ?mode=custom query param ──────────────────────
  const initialMode: PageMode = searchParams.get('mode') === 'custom' ? 'custom' : 'scan'
  const [pageMode, setPageMode] = useState<PageMode>(initialMode)

  // ── Scanner ──────────────────────────────────────────────────────────────
  const [scannerActive, setScannerActive] = useState(false)
  const [scannerError, setScannerError] = useState<string | null>(null)
  const scannerRef = useRef<{ clear: () => Promise<void> } | null>(null)

  // ── Manual search ─────────────────────────────────────────────────────────
  const [manualCode, setManualCode] = useState('')
  const [searchLoading, setSearchLoading] = useState(false)

  // ── Product (for scan mode) ───────────────────────────────────────────────
  const [product, setProduct] = useState<Product | null>(null)
  const [productError, setProductError] = useState<string | null>(null)

  // ── Quote controls (scan mode) ────────────────────────────────────────────
  const [quantity, setQuantity] = useState(1)
  const [discountPct, setDiscountPct] = useState(0)

  // ── Active offers ─────────────────────────────────────────────────────────
  const [activeOffers, setActiveOffers] = useState<Offer[]>([])

  // ── Flow state — start at custom_pick if launched in custom mode ─────────
  const [flowStep, setFlowStep] = useState<FlowStep>(initialMode === 'custom' ? 'custom_pick' : 'scan')
  const [createdQuotation, setCreatedQuotation] = useState<CreatedQuotation | null>(null)
  const [createdInvoice, setCreatedInvoice] = useState<CreatedInvoice | null>(null)

  // ── Customer picker dialog ────────────────────────────────────────────────
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerQuery, setPickerQuery] = useState('')
  const [pickerLeads, setPickerLeads] = useState<Lead[]>([])
  const [pickerCustomers, setPickerCustomers] = useState<Customer[]>([])
  const [pickerLoading, setPickerLoading] = useState(false)
  const [selectedEntity, setSelectedEntity] = useState<SelectedEntity | null>(null)

  // ── Walk-in sheet ─────────────────────────────────────────────────────────
  const [leadSheetOpen, setLeadSheetOpen] = useState(false)
  const [leadFormLoading, setLeadFormLoading] = useState(false)

  // ── Custom product loading ────────────────────────────────────────────────
  const [creatingCustom, setCreatingCustom] = useState(false)

  // ── Shared loading states ─────────────────────────────────────────────────
  const [creatingQuote, setCreatingQuote] = useState(false)
  const [creatingInvoice, setCreatingInvoice] = useState(false)
  const [markingPaid, setMarkingPaid] = useState(false)

  const role = profile?.role ?? 'salesperson'
  const discountRule = DEFAULT_DISCOUNT_RULES[role as keyof typeof DEFAULT_DISCOUNT_RULES]
  const maxDiscount = discountRule?.max_pct ?? 10

  // ── Load active offers ─────────────────────────────────────────────────────
  useEffect(() => {
    getActiveOffers().then(({ data }) => {
      if (data) setActiveOffers(data)
    })
  }, [])

  // ── Picker search ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!pickerOpen) return
    const timeout = setTimeout(async () => {
      setPickerLoading(true)
      const [leadRes, custRes] = await Promise.all([
        searchLeads(pickerQuery),
        searchCustomers(pickerQuery),
      ])
      setPickerLeads(leadRes)
      setPickerCustomers(custRes)
      setPickerLoading(false)
    }, 300)
    return () => clearTimeout(timeout)
  }, [pickerQuery, pickerOpen])

  // ── Scanner ────────────────────────────────────────────────────────────────
  const startScanner = useCallback(async () => {
    setScannerError(null)
    try {
      // Use Html5Qrcode (not Html5QrcodeScanner) so we get a clean camera view
      // with no camera-selection dropdown, no "Cam 1 / Cam 2" buttons, and no
      // file-upload option — just the live feed that starts scanning immediately.
      const { Html5Qrcode } = await import('html5-qrcode')
      const qrCode = new Html5Qrcode('qr-reader')

      await qrCode.start(
        { facingMode: 'environment' }, // back camera; falls back to front if none
        { fps: 10, qrbox: { width: 260, height: 260 } },
        async (decodedText) => {
          await qrCode.stop().catch(() => {})
          scannerRef.current = null
          setScannerActive(false)
          handleCodeFound(decodedText)
        },
        () => {}, // per-frame failures are normal (no code visible yet)
      )

      // Wrap as { clear } so stopScanner works unchanged
      scannerRef.current = { clear: () => qrCode.stop() }
      setScannerActive(true)
    } catch (err) {
      setScannerError(err instanceof Error ? err.message : 'Failed to start camera')
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

  useEffect(() => {
    return () => { if (scannerRef.current) scannerRef.current.clear().catch(() => {}) }
  }, [])

  const handleCodeFound = useCallback(async (code: string) => {
    setProductError(null)
    setProduct(null)
    setSearchLoading(true)
    setQuantity(1)
    setDiscountPct(0)
    setFlowStep('scan')
    setCreatedQuotation(null)
    setCreatedInvoice(null)
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

  async function handleManualSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!manualCode.trim()) return
    await stopScanner()
    await handleCodeFound(manualCode.trim())
  }

  // ── Create Quotation (scan mode) ──────────────────────────────────────────
  // Entity passed directly — avoids React stale-closure bug.
  async function handleCreateQuotation(entity: SelectedEntity | null) {
    if (!product) return
    setCreatingQuote(true)
    setPickerOpen(false)

    const lineItem = {
      product_id: product.id,
      name: product.name,
      sku: product.sku,
      image_url: product.image_url ?? undefined,
      qty: quantity,
      unit_price: product.price,
      discount_pct: discountPct,
      gst_pct: product.gst_pct,
    }

    const { data, error } = await createQuotation({
      lead_id: entity?.type === 'lead' ? entity.id ?? null : null,
      customer_id: entity?.type === 'customer' ? entity.id ?? null : null,
      items: [lineItem],
      asDraft: false,
    })

    if (error || !data) {
      toast.error(error ?? 'Failed to create quotation')
      setCreatingQuote(false)
      return
    }

    setCreatedQuotation({
      id: data.id,
      stage: (data as any).stage ?? 'Sent',
      grand_total: (data as any).grand_total ?? 0,
    })
    setFlowStep('quote_created')
    setCreatingQuote(false)
    toast.success('Quotation created!')
  }

  // ── Create Customized Product + Quotation ─────────────────────────────────
  async function handleCustomProductSubmit(values: CustomizedProductFormValues) {
    if (!selectedEntity) return
    setCreatingCustom(true)

    // 1. Save customized product
    const metadata = {
      customization_details: values.customization_details,
      color:  values.color  || undefined,
      finish: values.finish || undefined,
      dimensions:
        values.dim_l || values.dim_w || values.dim_h
          ? { l: values.dim_l, w: values.dim_w, h: values.dim_h, unit: values.dim_unit }
          : undefined,
      pickup_charge:       values.pickup_charge       || undefined,
      installation_charge: values.installation_charge || undefined,
      delivery_days:       values.delivery_days       || undefined,
    }

    const { data: prod, error: prodErr } = await createCustomizedProduct({
      name:        values.name,
      category:    values.category    || null,
      subcategory: values.subcategory || null,
      family:      values.family      || null,
      description: values.description || null,
      price:       values.price,
      cost:        values.cost        ?? null,
      gst_pct:     values.gst_pct,
      metadata,
    })

    if (prodErr || !prod) {
      toast.error(prodErr ?? 'Failed to save product')
      setCreatingCustom(false)
      return
    }

    // 2. Build quotation line items (product + optional extras)
    const items = [
      {
        product_id:   prod.id,
        name:         prod.name,
        sku:          prod.sku,
        qty:          1,
        unit_price:   prod.price,
        discount_pct: 0,
        gst_pct:      prod.gst_pct,
      },
    ]

    const pickupCharge  = values.pickup_charge       || 0
    const installCharge = values.installation_charge || 0

    if (pickupCharge > 0) {
      items.push({
        product_id:   null,
        is_custom:    true,
        custom_description: 'Pickup / Delivery Charge',
        name:         'Pickup / Delivery',
        sku:          undefined,
        qty:          1,
        unit_price:   pickupCharge,
        discount_pct: 0,
        gst_pct:      0,
      } as any)
    }

    if (installCharge > 0) {
      items.push({
        product_id:   null,
        is_custom:    true,
        custom_description: 'Installation Charge',
        name:         'Installation',
        sku:          undefined,
        qty:          1,
        unit_price:   installCharge,
        discount_pct: 0,
        gst_pct:      0,
      } as any)
    }

    // 3. Create quotation
    const { data: quot, error: quotErr } = await createQuotation({
      lead_id:     selectedEntity.type === 'lead'     ? selectedEntity.id ?? null : null,
      customer_id: selectedEntity.type === 'customer' ? selectedEntity.id ?? null : null,
      items,
      asDraft: false,
    })

    if (quotErr || !quot) {
      toast.error(quotErr ?? 'Failed to create quotation')
      setCreatingCustom(false)
      return
    }

    setCreatedQuotation({
      id:          quot.id,
      stage:       (quot as any).stage       ?? 'Sent',
      grand_total: (quot as any).grand_total ?? 0,
    })
    setFlowStep('quote_created')
    setCreatingCustom(false)
    toast.success('Quotation created!')
  }

  // ── Walk-in lead form submit ───────────────────────────────────────────────
  async function handleLeadFormSubmit(values: LeadFormValues) {
    setLeadFormLoading(true)

    const { data: lead, error } = await createLead({
      ...values,
      stage:  'New',
      source: values.source ?? 'Walk-in',
    })

    if (error || !lead) {
      toast.error(error ?? 'Failed to create lead')
      setLeadFormLoading(false)
      return
    }

    const entity: SelectedEntity = { type: 'lead', id: lead.id, name: lead.name, phone: lead.phone ?? undefined }
    setSelectedEntity(entity)
    setLeadSheetOpen(false)
    setPickerOpen(false)
    setLeadFormLoading(false)
    toast.success(`Lead created for ${lead.name}`)

    // In scan mode — create quotation immediately
    // In custom mode — advance to the product form step
    if (pageMode === 'scan') {
      handleCreateQuotation(entity)
    } else {
      setFlowStep('custom_form')
    }
  }

  // ── Convert to Invoice ─────────────────────────────────────────────────────
  async function handleCreateInvoice() {
    if (!createdQuotation) return
    setCreatingInvoice(true)

    const { data, error } = await convertToInvoice(createdQuotation.id)

    if (error || !data) {
      toast.error(error ?? 'Failed to create invoice')
      setCreatingInvoice(false)
      return
    }

    setCreatedInvoice({
      id:             data.id,
      invoice_no:     (data as any).invoice_no     ?? '',
      payment_status: (data as any).payment_status ?? 'Pending',
      grand_total:    (data as any).grand_total    ?? createdQuotation.grand_total,
    })
    setFlowStep('invoice_created')
    setCreatingInvoice(false)
    toast.success(`Invoice ${(data as any).invoice_no} created!`)
  }

  // ── Mark Paid ──────────────────────────────────────────────────────────────
  async function handleMarkPaid() {
    if (!createdInvoice) return
    setMarkingPaid(true)

    const { error } = await updatePaymentStatus(createdInvoice.id, 'Paid')

    if (error) {
      toast.error(error)
      setMarkingPaid(false)
      return
    }

    setCreatedInvoice((prev) => prev ? { ...prev, payment_status: 'Paid' } : prev)
    setMarkingPaid(false)
    toast.success('Payment recorded — invoice marked as Paid ✅')
  }

  // ── Reset flow ─────────────────────────────────────────────────────────────
  function handleReset() {
    setProduct(null)
    setManualCode('')
    setProductError(null)
    setQuantity(1)
    setDiscountPct(0)
    setCreatedQuotation(null)
    setCreatedInvoice(null)
    setSelectedEntity(null)
    setLeadSheetOpen(false)
    setFlowStep(pageMode === 'custom' ? 'custom_pick' : 'scan')
  }

  // ── Switch mode ───────────────────────────────────────────────────────────
  function switchMode(mode: PageMode) {
    if (mode === pageMode) return
    setPageMode(mode)
    handleReset()
    setFlowStep(mode === 'custom' ? 'custom_pick' : 'scan')
  }

  if (userLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    )
  }

  const stockSt = product ? stockStatus(product.stock, product.reorder_level) : null

  // Scan mode totals
  const lineBase     = product ? product.price * quantity : 0
  const lineDiscount = lineBase * (discountPct / 100)
  const taxable      = lineBase - lineDiscount
  const gstAmt       = product ? taxable * (product.gst_pct / 100) : 0
  const grandTotal   = taxable + gstAmt

  // Whether we're in a shared "post-scan/form" step
  const isPostFlow = flowStep === 'quote_created' || flowStep === 'invoice_created'

  return (
    <div className="max-w-2xl mx-auto space-y-5">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Scan &amp; Quote</h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            Scan a product or create a custom order — quotation and invoice in one flow
          </p>
        </div>
        {isPostFlow && (
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-600 border border-zinc-300 hover:bg-zinc-50 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {pageMode === 'scan' ? 'Scan Another' : 'New Order'}
          </button>
        )}
      </div>

      {/* ── Mode toggle ───────────────────────────────────────────────────── */}
      {!isPostFlow && (
        <div className="flex rounded-xl border border-zinc-200 bg-zinc-50 p-1 gap-1">
          <button
            type="button"
            onClick={() => switchMode('scan')}
            className={cn(
              'flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors',
              pageMode === 'scan'
                ? 'bg-white text-zinc-900 shadow-sm border border-zinc-200'
                : 'text-zinc-500 hover:text-zinc-700',
            )}
          >
            <Barcode className="w-4 h-4" />
            Scan Product
          </button>
          <button
            type="button"
            onClick={() => switchMode('custom')}
            className={cn(
              'flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors',
              pageMode === 'custom'
                ? 'bg-white text-amber-800 shadow-sm border border-amber-200'
                : 'text-zinc-500 hover:text-zinc-700',
            )}
          >
            <Palette className="w-4 h-4" />
            Custom Order
          </button>
        </div>
      )}

      {/* ── Step indicator ────────────────────────────────────────────────── */}
      {(product || pageMode === 'custom') && (
        <div className="flex justify-center py-1">
          <StepIndicator mode={pageMode} step={flowStep} />
        </div>
      )}

      {/* ── Active offers ─────────────────────────────────────────────────── */}
      {activeOffers.length > 0 && flowStep === 'scan' && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-amber-600" />
            <p className="text-sm font-semibold text-amber-800">Active Offers Today</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {activeOffers.map((offer) => (
              <span
                key={offer.id}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-800 bg-amber-100 border border-amber-300 px-2.5 py-1 rounded-full"
              >
                <Tag className="w-3 h-3" />
                {offer.title} — {formatDiscount(offer)}
                {offer.category && <span className="text-amber-600">({offer.category})</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          SCAN MODE UI
      ══════════════════════════════════════════════════════════════════════ */}

      {pageMode === 'scan' && (
        <>
          {/* Scanner */}
          {flowStep === 'scan' && (
            <>
              <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
                <div className="bg-zinc-950 relative min-h-[240px] flex items-center justify-center">
                  {!scannerActive && !scannerError && (
                    <div className="flex flex-col items-center gap-3 text-zinc-500">
                      <CameraOff className="w-12 h-12 text-zinc-700" />
                      <p className="text-sm text-zinc-500">Tap Start Scanner to use camera</p>
                    </div>
                  )}
                  {scannerError && (
                    <div className="flex flex-col items-center gap-2 text-red-400 px-4 text-center">
                      <AlertCircle className="w-10 h-10" />
                      <p className="text-sm">{scannerError}</p>
                    </div>
                  )}
                  <div id="qr-reader" className={cn('w-full', scannerActive ? 'block' : 'hidden')} />
                </div>
                <div className="p-4 flex gap-3">
                  {!scannerActive ? (
                    <button
                      type="button"
                      onClick={startScanner}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 transition-colors"
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

              {/* Manual search */}
              <div className="bg-white rounded-xl border border-zinc-200 p-5">
                <p className="text-sm font-medium text-zinc-700 mb-3 flex items-center gap-1.5">
                  <Barcode className="w-4 h-4 text-zinc-400" />
                  Or enter SKU / Barcode manually
                </p>
                <form onSubmit={handleManualSearch} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. JB-SF-001 or 1234567890123"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-700 focus:border-blue-700"
                  />
                  <button
                    type="submit"
                    disabled={searchLoading || !manualCode.trim()}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {searchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    Search
                  </button>
                </form>
              </div>
            </>
          )}

          {/* Search loading */}
          {searchLoading && (
            <div className="flex items-center gap-2 justify-center py-4 text-zinc-500 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Looking up product…
            </div>
          )}

          {/* Product not found */}
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

          {/* Product found + quote controls */}
          {product && !searchLoading && flowStep === 'scan' && (
            <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
              {/* Product header */}
              <div className="flex gap-4 p-5 border-b border-zinc-100">
                <div className="w-20 h-20 rounded-xl bg-zinc-100 flex-shrink-0 overflow-hidden border border-zinc-200 flex items-center justify-center">
                  {product.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-8 h-8 text-zinc-300" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-zinc-900 leading-tight">{product.name}</h3>
                      <p className="text-xs font-mono text-zinc-500 mt-0.5">{product.sku}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setProduct(null); setManualCode('') }}
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
                    <StockBadge stock={product.stock} reorderLevel={product.reorder_level} size="sm" />
                  </div>
                </div>
              </div>

              {/* Pricing grid */}
              <div className="grid grid-cols-3 divide-x divide-zinc-100 border-b border-zinc-100">
                <div className="px-4 py-3 text-center">
                  <p className="text-xs text-zinc-500 mb-0.5">Price</p>
                  <p className="text-sm font-bold text-zinc-900">{formatCurrency(product.price)}</p>
                </div>
                <div className="px-4 py-3 text-center">
                  <p className="text-xs text-zinc-500 mb-0.5">GST</p>
                  <p className="text-sm font-semibold text-zinc-700">{product.gst_pct}%</p>
                </div>
                <div className="px-4 py-3 text-center">
                  <p className="text-xs text-zinc-500 mb-0.5">Stock</p>
                  <p className={cn('text-sm font-bold', stockSt === 'out-of-stock' ? 'text-red-600' : stockSt === 'low-stock' ? 'text-amber-600' : 'text-emerald-600')}>
                    {product.stock}
                  </p>
                </div>
              </div>

              {/* Quote controls */}
              <div className="p-5 space-y-4">
                {/* Quantity */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-2">Quantity</label>
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
                      onChange={(e) => setQuantity(Math.max(1, Math.min(parseInt(e.target.value) || 1, Math.max(1, product.stock))))}
                      className="w-20 text-center rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-700"
                    />
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.min(Math.max(1, product.stock), q + 1))}
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
                    <span className="ml-1 text-xs text-zinc-400 font-normal">(max {maxDiscount}%)</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={0}
                      max={maxDiscount}
                      step={0.5}
                      value={discountPct}
                      onChange={(e) => setDiscountPct(parseFloat(e.target.value))}
                      className="flex-1 h-2 rounded-full appearance-none bg-zinc-200 accent-blue-700"
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
                          if (!isNaN(val)) setDiscountPct(Math.min(maxDiscount, Math.max(0, val)))
                        }}
                        className="w-full pr-6 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-700"
                      />
                      <Percent className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
                    </div>
                  </div>
                </div>

                {/* Live total */}
                <div className="rounded-xl bg-zinc-50 border border-zinc-200 px-4 py-3 space-y-1.5">
                  <div className="flex justify-between text-xs text-zinc-500">
                    <span>Base ({quantity} × {formatCurrency(product.price)})</span>
                    <span>{formatCurrency(lineBase)}</span>
                  </div>
                  {discountPct > 0 && (
                    <div className="flex justify-between text-xs text-red-600">
                      <span>Discount ({discountPct}%)</span>
                      <span>−{formatCurrency(lineDiscount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs text-zinc-500">
                    <span>GST ({product.gst_pct}%)</span>
                    <span>+{formatCurrency(gstAmt)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-zinc-900 pt-1 border-t border-zinc-200">
                    <span>Total</span>
                    <span>{formatCurrency(grandTotal)}</span>
                  </div>
                </div>

                {/* Selected customer */}
                {selectedEntity && (
                  <EntityChip entity={selectedEntity} onClear={() => setSelectedEntity(null)} />
                )}

                {/* CTA */}
                {stockSt === 'out-of-stock' ? (
                  <p className="text-xs text-red-600 text-center py-2">Out of stock — cannot create quotation</p>
                ) : (
                  <button
                    type="button"
                    onClick={() => selectedEntity ? handleCreateQuotation(selectedEntity) : setPickerOpen(true)}
                    disabled={creatingQuote}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 active:bg-blue-900 transition-colors disabled:opacity-50"
                  >
                    {creatingQuote ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <FileText className="w-4 h-4" />
                    )}
                    {selectedEntity ? 'Create Quotation' : 'Select Customer & Create Quotation'}
                    {!creatingQuote && <ArrowRight className="w-4 h-4 ml-auto" />}
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          CUSTOM ORDER MODE UI
      ══════════════════════════════════════════════════════════════════════ */}

      {pageMode === 'custom' && (
        <>
          {/* Step 1 — pick customer */}
          {flowStep === 'custom_pick' && (
            <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
              <div className="px-5 pt-5 pb-4 border-b border-zinc-100">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-amber-700" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-zinc-900">Step 1 — Select Customer</p>
                    <p className="text-xs text-zinc-500">Who is this custom order for?</p>
                  </div>
                </div>
              </div>

              <div className="p-5 space-y-3">
                {/* Walk-in */}
                <button
                  type="button"
                  onClick={() => setLeadSheetOpen(true)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 border-dashed border-zinc-300 hover:border-amber-400 hover:bg-amber-50 transition-colors"
                >
                  <UserPlus className="w-5 h-5 text-zinc-400" />
                  <div className="text-left">
                    <p className="text-sm font-medium text-zinc-700">New Walk-in Lead</p>
                    <p className="text-xs text-zinc-400">Register name, phone, categories &amp; more</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-400 ml-auto" />
                </button>

                {/* Search existing */}
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border border-zinc-200 hover:bg-zinc-50 transition-colors"
                >
                  <Search className="w-5 h-5 text-zinc-400" />
                  <div className="text-left">
                    <p className="text-sm font-medium text-zinc-700">Search Existing Lead / Customer</p>
                    <p className="text-xs text-zinc-400">Find by name or phone number</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-400 ml-auto" />
                </button>
              </div>
            </div>
          )}

          {/* Step 2 — fill product form */}
          {flowStep === 'custom_form' && selectedEntity && (
            <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
              {/* Customer chip */}
              <div className="px-5 pt-5 pb-4 border-b border-zinc-100 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <Palette className="w-4 h-4 text-amber-700" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-zinc-900">Step 2 — Product Details</p>
                    <p className="text-xs text-zinc-500">Describe the customisation below</p>
                  </div>
                </div>
                <EntityChip
                  entity={selectedEntity}
                  onClear={() => {
                    setSelectedEntity(null)
                    setFlowStep('custom_pick')
                  }}
                />
              </div>

              <div className="p-5">
                <CustomizedProductForm
                  onSubmit={handleCustomProductSubmit}
                  onCancel={handleReset}
                  loading={creatingCustom}
                  isAdmin={profile?.role === 'admin'}
                />
              </div>
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          SHARED — Step 3: Quotation created
      ══════════════════════════════════════════════════════════════════════ */}

      {flowStep === 'quote_created' && createdQuotation && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-100 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center">
                <FileText className="w-4 h-4 text-blue-700" />
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-900">Quotation Created</p>
                <p className="text-xs text-zinc-500">Stage: {createdQuotation.stage}</p>
              </div>
              <span
                className={cn(
                  'ml-auto px-2.5 py-0.5 rounded-full text-xs font-semibold',
                  createdQuotation.stage === 'Sent'
                    ? 'bg-blue-100 text-blue-700'
                    : createdQuotation.stage === 'Pending Approval'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-zinc-100 text-zinc-600',
                )}
              >
                {createdQuotation.stage}
              </span>
            </div>

            <div className="px-5 py-4 space-y-2">
              {/* Scan mode shows per-line detail; custom mode shows just the total */}
              {pageMode === 'scan' && product ? (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">{product.name}</span>
                    <span className="font-medium text-zinc-900">
                      {quantity} × {formatCurrency(product.price)}
                      {discountPct > 0 && ` (−${discountPct}%)`}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">GST ({product.gst_pct}%)</span>
                    <span className="text-zinc-700">+{formatCurrency(gstAmt)}</span>
                  </div>
                </>
              ) : (
                <p className="text-xs text-zinc-400 mb-1">
                  Customised order — see full quotation for line-item breakdown
                </p>
              )}
              <div className="flex justify-between text-base font-bold text-zinc-900 pt-2 border-t border-zinc-100">
                <span>Grand Total</span>
                <span>{formatCurrency(createdQuotation.grand_total)}</span>
              </div>
              {selectedEntity && (
                <p className="text-xs text-zinc-400 pt-1">
                  For: {selectedEntity.name}
                  {selectedEntity.type === 'walkin' && ' (Walk-in)'}
                </p>
              )}
            </div>

            <div className="px-5 pb-3">
              <button
                type="button"
                onClick={() => router.push(`/quotations/${createdQuotation.id}`)}
                className="text-xs text-blue-700 hover:text-blue-900 underline underline-offset-2"
              >
                View full quotation →
              </button>
            </div>
          </div>

          {/* Approval warning */}
          {createdQuotation.stage === 'Pending Approval' && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Approval required</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  The discount exceeds your limit and requires manager approval before an invoice can be raised.
                </p>
              </div>
            </div>
          )}

          {/* Customer agreed */}
          {createdQuotation.stage === 'Sent' && (
            <div className="bg-white rounded-xl border border-zinc-200 p-5 space-y-3">
              <p className="text-sm font-semibold text-zinc-800">Did the customer agree?</p>
              <p className="text-xs text-zinc-500">
                If yes, we'll convert the quotation to an invoice ({formatCurrency(createdQuotation.grand_total)}) right now.
              </p>
              <button
                type="button"
                onClick={handleCreateInvoice}
                disabled={creatingInvoice}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 transition-colors disabled:opacity-50"
              >
                {creatingInvoice ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Receipt className="w-4 h-4" />
                )}
                Yes, Customer Agreed — Create Invoice
                {!creatingInvoice && <ArrowRight className="w-4 h-4 ml-auto" />}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          SHARED — Step 4: Invoice
      ══════════════════════════════════════════════════════════════════════ */}

      {flowStep === 'invoice_created' && createdInvoice && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-100 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center">
                <Receipt className="w-4 h-4 text-blue-700" />
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-900">Invoice Created</p>
                <p className="text-xs font-mono text-zinc-500">{createdInvoice.invoice_no}</p>
              </div>
              <span
                className={cn(
                  'ml-auto px-2.5 py-0.5 rounded-full text-xs font-semibold',
                  createdInvoice.payment_status === 'Paid'
                    ? 'bg-blue-100 text-blue-700'
                    : createdInvoice.payment_status === 'Partially Paid'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-zinc-100 text-zinc-600',
                )}
              >
                {createdInvoice.payment_status}
              </span>
            </div>

            <div className="px-5 py-4">
              <div className="flex justify-between text-base font-bold text-zinc-900">
                <span>Grand Total</span>
                <span>{formatCurrency(createdInvoice.grand_total)}</span>
              </div>
              {selectedEntity && (
                <p className="text-xs text-zinc-400 mt-1">Customer: {selectedEntity.name}</p>
              )}
            </div>

            <div className="px-5 pb-3">
              <button
                type="button"
                onClick={() => router.push(`/invoices/${createdInvoice.id}`)}
                className="text-xs text-blue-700 hover:text-blue-900 underline underline-offset-2"
              >
                View full invoice →
              </button>
            </div>
          </div>

          {/* Mark as Paid */}
          {createdInvoice.payment_status !== 'Paid' ? (
            <div className="bg-white rounded-xl border border-zinc-200 p-5 space-y-3">
              <p className="text-sm font-semibold text-zinc-800">Collect Payment</p>
              <p className="text-xs text-zinc-500">
                Once payment of {formatCurrency(createdInvoice.grand_total)} is received, mark the invoice as Paid.
              </p>
              <button
                type="button"
                onClick={handleMarkPaid}
                disabled={markingPaid}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                {markingPaid ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Banknote className="w-4 h-4" />
                )}
                Mark as Paid
              </button>
            </div>
          ) : (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-5 py-5 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-3" />
              <p className="text-sm font-bold text-emerald-900">Sale Complete!</p>
              <p className="text-xs text-emerald-700 mt-1">
                Invoice {createdInvoice.invoice_no} — {formatCurrency(createdInvoice.grand_total)} — Paid ✅
              </p>
              <button
                type="button"
                onClick={handleReset}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                {pageMode === 'scan' ? 'Scan Next Product' : 'New Custom Order'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          SHARED — Customer picker dialog
      ══════════════════════════════════════════════════════════════════════ */}
      <Dialog.Root open={pickerOpen} onOpenChange={setPickerOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-xl border border-zinc-200 w-full max-w-sm mx-4 p-5 max-h-[80vh] flex flex-col">
            <div className="flex items-start justify-between mb-4">
              <div>
                <Dialog.Title className="text-base font-semibold text-zinc-900">Who is this for?</Dialog.Title>
                <Dialog.Description className="text-xs text-zinc-500 mt-0.5">Search existing or register a new walk-in lead</Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button type="button" className="p-1 text-zinc-400 hover:text-zinc-600">
                  <X className="w-4 h-4" />
                </button>
              </Dialog.Close>
            </div>

            {/* Walk-in */}
            <button
              type="button"
              onClick={() => { setPickerOpen(false); setLeadSheetOpen(true) }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed border-zinc-300 hover:border-blue-500 hover:bg-blue-50 transition-colors mb-3"
            >
              <UserPlus className="w-5 h-5 text-zinc-400" />
              <div className="text-left">
                <p className="text-sm font-medium text-zinc-700">New Walk-in Lead</p>
                <p className="text-xs text-zinc-400">Register name, phone, source, categories &amp; more</p>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-400 ml-auto" />
            </button>

            {/* Search */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                placeholder="Search by name or phone…"
                value={pickerQuery}
                onChange={(e) => setPickerQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-zinc-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-700"
                autoFocus
              />
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto space-y-1">
              {pickerLoading && (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
                </div>
              )}

              {!pickerLoading && pickerCustomers.length > 0 && (
                <>
                  <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide px-1 pb-1">Customers</p>
                  {pickerCustomers.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        const entity: SelectedEntity = { type: 'customer', id: c.id, name: c.name, phone: c.phone ?? undefined }
                        setSelectedEntity(entity)
                        setPickerOpen(false)
                        if (pageMode === 'scan') {
                          handleCreateQuotation(entity)
                        } else {
                          setFlowStep('custom_form')
                        }
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-zinc-50 transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-blue-700 text-xs font-bold">{c.name.charAt(0)}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-zinc-900 truncate">{c.name}</p>
                        <p className="text-xs text-zinc-500">{c.phone}</p>
                      </div>
                    </button>
                  ))}
                </>
              )}

              {!pickerLoading && pickerLeads.length > 0 && (
                <>
                  <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide px-1 pb-1 pt-2">Leads</p>
                  {pickerLeads.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => {
                        const entity: SelectedEntity = { type: 'lead', id: l.id, name: l.name, phone: l.phone ?? undefined }
                        setSelectedEntity(entity)
                        setPickerOpen(false)
                        if (pageMode === 'scan') {
                          handleCreateQuotation(entity)
                        } else {
                          setFlowStep('custom_form')
                        }
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-zinc-50 transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-amber-700 text-xs font-bold">{l.name.charAt(0)}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-zinc-900 truncate">{l.name}</p>
                        <p className="text-xs text-zinc-500">{l.phone} · {l.stage}</p>
                      </div>
                    </button>
                  ))}
                </>
              )}

              {!pickerLoading && pickerLeads.length === 0 && pickerCustomers.length === 0 && pickerQuery && (
                <div className="py-6 text-center">
                  <User className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                  <p className="text-sm text-zinc-500">No results for &ldquo;{pickerQuery}&rdquo;</p>
                  <button
                    type="button"
                    onClick={() => { setPickerOpen(false); setLeadSheetOpen(true) }}
                    className="mt-2 text-xs text-blue-700 hover:underline"
                  >
                    + Register as new walk-in lead
                  </button>
                </div>
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* ── Walk-in Lead sheet (full LeadForm) ────────────────────────────── */}
      <Dialog.Root open={leadSheetOpen} onOpenChange={setLeadSheetOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />
          <Dialog.Content
            className={cn(
              'fixed right-0 top-0 z-50 h-full w-full max-w-2xl bg-white shadow-2xl',
              'flex flex-col overflow-hidden',
              'data-[state=open]:animate-in data-[state=closed]:animate-out',
              'data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
              'duration-300',
            )}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 bg-white flex-shrink-0">
              <div>
                <Dialog.Title className="text-base font-semibold text-zinc-900">
                  New Walk-in Lead
                </Dialog.Title>
                <Dialog.Description className="text-xs text-zinc-500 mt-0.5">
                  Fill in the details — a lead record will be created and linked to this order
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button type="button" className="p-2 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </Dialog.Close>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6">
              <LeadForm
                onSubmit={handleLeadFormSubmit}
                onCancel={() => setLeadSheetOpen(false)}
                loading={leadFormLoading}
              />
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
