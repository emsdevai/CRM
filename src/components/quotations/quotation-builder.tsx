'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import {
  AlertTriangle,
  ChevronDown,
  ImageOff,
  Loader2,
  Package,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { cn, calcLineItem, formatCurrency } from '@/lib/utils'
import {
  createQuotation,
  searchLeads,
  searchCustomers,
  searchProducts,
  type QuotationItemInput,
} from '@/lib/actions/quotations'
import { QuotationStageBadge } from '@/components/shared/status-badge'
import { StageBadge } from '@/components/shared/status-badge'
import type { Lead, Customer, Product, LeadStage } from '@/lib/types/database'

// =============================================================================
// Types
// =============================================================================

interface QuoteItem {
  id: string // local temp id
  product_id: string | null
  is_custom: boolean
  name: string
  sku: string
  image_url: string
  unit_price: number
  qty: number
  discount_pct: number
  gst_pct: number
  // calculated
  line_base: number
  line_discount: number
  taxable: number
  gst_amt: number
  line_total: number
}

interface DiscountRule {
  min_pct: number
  max_pct: number
  requires_approval_above: number
}

interface Props {
  leadId?: string
  customerId?: string
  onSuccess: (quotationId: string) => void
  discountRule: DiscountRule
}

// =============================================================================
// Helpers
// =============================================================================

function makeId() {
  return Math.random().toString(36).slice(2, 10)
}

function buildQuoteItem(overrides: Partial<QuoteItem> = {}): QuoteItem {
  const base: QuoteItem = {
    id: makeId(),
    product_id: null,
    is_custom: false,
    name: '',
    sku: '',
    image_url: '',
    unit_price: 0,
    qty: 1,
    discount_pct: 0,
    gst_pct: 18,
    line_base: 0,
    line_discount: 0,
    taxable: 0,
    gst_amt: 0,
    line_total: 0,
    ...overrides,
  }
  const calc = calcLineItem(base.qty, base.unit_price, base.discount_pct, base.gst_pct)
  return { ...base, ...calc }
}

function recalcItem(item: QuoteItem): QuoteItem {
  const calc = calcLineItem(item.qty, item.unit_price, item.discount_pct, item.gst_pct)
  return { ...item, ...calc }
}

// =============================================================================
// Sub-components
// =============================================================================

function Combobox<T extends { id: string; name: string }>({
  placeholder,
  selected,
  results,
  query,
  open,
  onQueryChange,
  onOpen,
  onClose,
  onSelect,
  renderItem,
}: {
  placeholder: string
  selected: T | null
  results: T[]
  query: string
  open: boolean
  onQueryChange: (q: string) => void
  onOpen: () => void
  onClose: () => void
  onSelect: (item: T) => void
  renderItem: (item: T) => React.ReactNode
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={open ? onClose : onOpen}
        className={cn(
          'w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-sm',
          'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700',
          'hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-blue-500/20',
        )}
      >
        <span className={cn(selected ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-400')}>
          {selected ? selected.name : placeholder}
        </span>
        <ChevronDown className={cn('w-4 h-4 text-zinc-400 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg">
          <div className="p-2 border-b border-zinc-100 dark:border-zinc-800">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                placeholder="Search..."
                className={cn(
                  'w-full pl-8 pr-3 py-1.5 text-sm rounded-md',
                  'bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700',
                  'placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-blue-500/40',
                )}
              />
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto p-1">
            {results.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-zinc-400">No results found</p>
            ) : (
              results.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => { onSelect(item); onClose() }}
                  className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  {renderItem(item)}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// =============================================================================
// ProductSearch dropdown
// =============================================================================

function ProductSearchDropdown({
  open,
  onClose,
  onAdd,
}: {
  open: boolean
  onClose: () => void
  onAdd: (product: Product) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => {
      setLoading(true)
      searchProducts(query).then((data) => {
        setResults(data)
        setLoading(false)
      })
    }, 200)
    return () => clearTimeout(timer)
  }, [query, open])

  useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      setLoading(true)
      searchProducts('').then((data) => {
        setResults(data)
        setLoading(false)
      })
    }
  }, [open])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  if (!open) return null

  return (
    <div
      ref={containerRef}
      className="absolute left-0 z-50 mt-1 w-96 max-h-80 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl flex flex-col"
    >
      <div className="p-2 border-b border-zinc-100 dark:border-zinc-800 flex-none">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, SKU, or barcode..."
            className={cn(
              'w-full pl-8 pr-3 py-1.5 text-sm rounded-md',
              'bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700',
              'placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-blue-500/40',
            )}
          />
        </div>
      </div>
      <div className="overflow-y-auto flex-1 p-1">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
          </div>
        ) : results.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-zinc-400">No products found</p>
        ) : (
          results.map((product) => (
            <button
              key={product.id}
              type="button"
              onClick={() => { onAdd(product); onClose() }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-md bg-zinc-100 dark:bg-zinc-800 overflow-hidden flex-none flex items-center justify-center">
                {product.image_url ? (
                  <Image
                    src={product.image_url}
                    alt={product.name}
                    width={40}
                    height={40}
                    className="object-cover w-full h-full"
                  />
                ) : (
                  <Package className="w-5 h-5 text-zinc-400" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{product.name}</p>
                <p className="text-xs text-zinc-500">{product.sku} · GST {product.gst_pct}%</p>
              </div>
              <div className="text-right flex-none">
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {formatCurrency(product.price)}
                </p>
                <p className="text-xs text-zinc-400">Stock: {product.stock}</p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

// =============================================================================
// Custom item form
// =============================================================================

interface CustomItemFormState {
  name: string
  unit_price: string
  qty: string
  gst_pct: string
}

function CustomItemForm({
  onAdd,
  onCancel,
}: {
  onAdd: (item: Omit<QuoteItem, 'id' | 'product_id' | 'is_custom' | 'sku' | 'image_url' | 'line_base' | 'line_discount' | 'taxable' | 'gst_amt' | 'line_total'>) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<CustomItemFormState>({
    name: '',
    unit_price: '',
    qty: '1',
    gst_pct: '18',
  })
  const [error, setError] = useState('')

  function handleAdd() {
    if (!form.name.trim()) { setError('Description is required'); return }
    const price = parseFloat(form.unit_price)
    if (!price || price <= 0) { setError('Enter a valid price'); return }
    onAdd({
      name: form.name.trim(),
      unit_price: price,
      qty: Math.max(1, parseInt(form.qty) || 1),
      discount_pct: 0,
      gst_pct: parseFloat(form.gst_pct) || 18,
    })
  }

  return (
    <div className="border border-blue-200 dark:border-blue-900/60 rounded-xl p-4 bg-blue-50/50 dark:bg-blue-950/20">
      <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-3">Add Custom Item</h4>
      <div className="grid grid-cols-12 gap-3">
        <div className="col-span-5">
          <label className="block text-xs text-zinc-500 mb-1">Description *</label>
          <input
            autoFocus
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Custom item description"
            className="w-full px-3 py-1.5 text-sm rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-xs text-zinc-500 mb-1">Qty</label>
          <input
            type="number"
            min="1"
            value={form.qty}
            onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value }))}
            className="w-full px-3 py-1.5 text-sm rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <div className="col-span-3">
          <label className="block text-xs text-zinc-500 mb-1">Unit Price (₹)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.unit_price}
            onChange={(e) => setForm((f) => ({ ...f, unit_price: e.target.value }))}
            placeholder="0"
            className="w-full px-3 py-1.5 text-sm rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-xs text-zinc-500 mb-1">GST %</label>
          <select
            value={form.gst_pct}
            onChange={(e) => setForm((f) => ({ ...f, gst_pct: e.target.value }))}
            className="w-full px-2 py-1.5 text-sm rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="0">0%</option>
            <option value="5">5%</option>
            <option value="12">12%</option>
            <option value="18">18%</option>
            <option value="28">28%</option>
          </select>
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      <div className="flex items-center gap-2 mt-3">
        <button
          type="button"
          onClick={handleAdd}
          className="px-4 py-1.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          Add Item
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-1.5 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// =============================================================================
// Main QuotationBuilder
// =============================================================================

export default function QuotationBuilder({
  leadId: initialLeadId,
  customerId: initialCustomerId,
  onSuccess,
  discountRule,
}: Props) {
  // ─── Recipient mode ───────────────────────────────────────────────────────
  const [mode, setMode] = useState<'lead' | 'customer'>(
    initialCustomerId ? 'customer' : 'lead',
  )

  // ─── Lead selection ───────────────────────────────────────────────────────
  const [leadOpen, setLeadOpen] = useState(false)
  const [leadQuery, setLeadQuery] = useState('')
  const [leadResults, setLeadResults] = useState<Lead[]>([])
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)

  // ─── Customer selection ───────────────────────────────────────────────────
  const [customerOpen, setCustomerOpen] = useState(false)
  const [customerQuery, setCustomerQuery] = useState('')
  const [customerResults, setCustomerResults] = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)

  // ─── Notes ────────────────────────────────────────────────────────────────
  const [notes, setNotes] = useState('')

  // ─── Product search ───────────────────────────────────────────────────────
  const [productSearchOpen, setProductSearchOpen] = useState(false)
  const productAnchorRef = useRef<HTMLDivElement>(null)

  // ─── Custom item form ─────────────────────────────────────────────────────
  const [showCustomForm, setShowCustomForm] = useState(false)

  // ─── Line items ───────────────────────────────────────────────────────────
  const [items, setItems] = useState<QuoteItem[]>([])

  // ─── Saving ───────────────────────────────────────────────────────────────
  const [saving, setSaving] = useState<'draft' | 'submit' | null>(null)

  // ─── Lead search debounce ─────────────────────────────────────────────────
  useEffect(() => {
    if (!leadOpen) return
    const timer = setTimeout(() => {
      searchLeads(leadQuery).then(setLeadResults)
    }, 200)
    return () => clearTimeout(timer)
  }, [leadQuery, leadOpen])

  useEffect(() => {
    if (leadOpen) searchLeads('').then(setLeadResults)
  }, [leadOpen])

  // ─── Customer search debounce ─────────────────────────────────────────────
  useEffect(() => {
    if (!customerOpen) return
    const timer = setTimeout(() => {
      searchCustomers(customerQuery).then(setCustomerResults)
    }, 200)
    return () => clearTimeout(timer)
  }, [customerQuery, customerOpen])

  useEffect(() => {
    if (customerOpen) searchCustomers('').then(setCustomerResults)
  }, [customerOpen])

  // ─── Initial selection if ids provided ───────────────────────────────────
  useEffect(() => {
    if (initialLeadId) {
      searchLeads('').then((leads) => {
        const found = leads.find((l) => l.id === initialLeadId)
        if (found) setSelectedLead(found)
      })
    }
    if (initialCustomerId) {
      searchCustomers('').then((customers) => {
        const found = customers.find((c) => c.id === initialCustomerId)
        if (found) setSelectedCustomer(found)
      })
    }
  }, [initialLeadId, initialCustomerId])

  // ─── Totals ───────────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    return {
      subtotal: items.reduce((s, i) => s + i.line_base, 0),
      discountTotal: items.reduce((s, i) => s + i.line_discount, 0),
      gstTotal: items.reduce((s, i) => s + i.gst_amt, 0),
      grandTotal: items.reduce((s, i) => s + i.line_total, 0),
    }
  }, [items])

  // ─── Approval detection ───────────────────────────────────────────────────
  const maxItemDiscount = items.length > 0
    ? Math.max(...items.map((i) => i.discount_pct))
    : 0

  const needsManagerApproval =
    maxItemDiscount > 0 && maxItemDiscount > discountRule.requires_approval_above
  const needsAdminApproval = maxItemDiscount > 15

  // ─── Item mutation helpers ─────────────────────────────────────────────────

  const addProductItem = useCallback((product: Product) => {
    setItems((prev) => [
      ...prev,
      buildQuoteItem({
        product_id: product.id,
        is_custom: false,
        name: product.name,
        sku: product.sku,
        image_url: product.image_url ?? '',
        unit_price: product.price,
        gst_pct: product.gst_pct,
        discount_pct: 0,
        qty: 1,
      }),
    ])
  }, [])

  const addCustomItem = useCallback((
    data: Pick<QuoteItem, 'name' | 'unit_price' | 'qty' | 'discount_pct' | 'gst_pct'>,
  ) => {
    setItems((prev) => [
      ...prev,
      buildQuoteItem({ ...data, is_custom: true, product_id: null, sku: '', image_url: '' }),
    ])
    setShowCustomForm(false)
  }, [])

  const updateItem = useCallback(
    (id: string, patch: Partial<Pick<QuoteItem, 'qty' | 'unit_price' | 'discount_pct' | 'gst_pct'>>) => {
      setItems((prev) =>
        prev.map((item) => {
          if (item.id !== id) return item
          const merged = { ...item, ...patch }
          // Enforce max discount
          if (merged.discount_pct > discountRule.max_pct) {
            merged.discount_pct = discountRule.max_pct
          }
          return recalcItem(merged)
        }),
      )
    },
    [discountRule.max_pct],
  )

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }, [])

  // ─── Submit handlers ──────────────────────────────────────────────────────

  async function handleSubmit(asDraft: boolean) {
    const recipientId = mode === 'lead' ? selectedLead?.id : selectedCustomer?.id
    if (!recipientId) {
      toast.error(`Please select a ${mode}`)
      return
    }
    if (items.length === 0) {
      toast.error('Add at least one product or custom item')
      return
    }

    setSaving(asDraft ? 'draft' : 'submit')

    const itemInputs: QuotationItemInput[] = items.map((item) => ({
      product_id: item.product_id ?? undefined,
      is_custom: item.is_custom,
      name: item.name,
      sku: item.sku ?? undefined,
      image_url: item.image_url ?? undefined,
      qty: item.qty,
      unit_price: item.unit_price,
      discount_pct: item.discount_pct,
      gst_pct: item.gst_pct,
    }))

    const result = await createQuotation({
      lead_id: mode === 'lead' ? selectedLead?.id ?? null : null,
      customer_id: mode === 'customer' ? selectedCustomer?.id ?? null : null,
      items: itemInputs,
      notes: notes || undefined,
      asDraft,
    })

    setSaving(null)

    if (result.error) {
      toast.error(result.error)
      return
    }

    toast.success(
      asDraft ? 'Quotation saved as draft' : 'Quotation created successfully',
    )
    onSuccess(result.data!.id)
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── Header info ─────────────────────────────────────────────── */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Recipient
          </h3>
          <div className="flex rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden text-xs">
            <button
              type="button"
              onClick={() => { setMode('lead'); setSelectedCustomer(null) }}
              className={cn(
                'px-3 py-1.5 font-medium transition-colors',
                mode === 'lead'
                  ? 'bg-blue-600 text-white'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800',
              )}
            >
              Lead
            </button>
            <button
              type="button"
              onClick={() => { setMode('customer'); setSelectedLead(null) }}
              className={cn(
                'px-3 py-1.5 font-medium transition-colors',
                mode === 'customer'
                  ? 'bg-blue-600 text-white'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800',
              )}
            >
              Customer
            </button>
          </div>
        </div>

        {mode === 'lead' ? (
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1.5">
              Select Lead *
            </label>
            <Combobox<Lead>
              placeholder="Search and select a lead..."
              selected={selectedLead}
              results={leadResults}
              query={leadQuery}
              open={leadOpen}
              onQueryChange={setLeadQuery}
              onOpen={() => setLeadOpen(true)}
              onClose={() => setLeadOpen(false)}
              onSelect={setSelectedLead}
              renderItem={(lead) => (
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">{lead.name}</span>
                    {lead.phone && (
                      <span className="ml-2 text-zinc-400">{lead.phone}</span>
                    )}
                  </div>
                  <StageBadge stage={lead.stage as LeadStage} />
                </div>
              )}
            />
          </div>
        ) : (
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1.5">
              Select Customer *
            </label>
            <Combobox<Customer>
              placeholder="Search and select a customer..."
              selected={selectedCustomer}
              results={customerResults}
              query={customerQuery}
              open={customerOpen}
              onQueryChange={setCustomerQuery}
              onOpen={() => setCustomerOpen(true)}
              onClose={() => setCustomerOpen(false)}
              onSelect={setSelectedCustomer}
              renderItem={(customer) => (
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">{customer.name}</span>
                    {customer.customer_number && (
                      <span className="ml-2 text-xs text-zinc-400">#{customer.customer_number}</span>
                    )}
                  </div>
                  {customer.phone && (
                    <span className="text-xs text-zinc-400">{customer.phone}</span>
                  )}
                </div>
              )}
            />
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1.5">
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Any notes or special instructions..."
            className={cn(
              'w-full px-3 py-2 text-sm rounded-lg border resize-none',
              'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900',
              'placeholder:text-zinc-400 text-zinc-900 dark:text-zinc-100',
              'focus:outline-none focus:ring-2 focus:ring-blue-500/20',
            )}
          />
        </div>
      </div>

      {/* ── Line items ──────────────────────────────────────────────── */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Line Items
            {items.length > 0 && (
              <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-bold">
                {items.length}
              </span>
            )}
          </h3>
          <p className="text-xs text-zinc-400">
            Max discount: {discountRule.max_pct}%
          </p>
        </div>

        {/* Table */}
        {items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px]">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500 w-64">Product</th>
                  <th className="px-3 py-2.5 text-right text-xs font-medium text-zinc-500 w-20">Qty</th>
                  <th className="px-3 py-2.5 text-right text-xs font-medium text-zinc-500 w-28">Unit Price</th>
                  <th className="px-3 py-2.5 text-right text-xs font-medium text-zinc-500 w-24">Disc%</th>
                  <th className="px-3 py-2.5 text-right text-xs font-medium text-zinc-500 w-20">GST%</th>
                  <th className="px-3 py-2.5 text-right text-xs font-medium text-zinc-500 w-28">Line Total</th>
                  <th className="px-3 py-2.5 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/60">
                {items.map((item) => (
                  <LineItemRow
                    key={item.id}
                    item={item}
                    maxDiscountPct={discountRule.max_pct}
                    onUpdate={(patch) => updateItem(item.id, patch)}
                    onRemove={() => removeItem(item.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Package className="w-8 h-8 text-zinc-300 dark:text-zinc-600 mb-2" />
            <p className="text-sm text-zinc-500">No items added yet</p>
            <p className="text-xs text-zinc-400 mt-0.5">
              Add products from inventory or create custom items
            </p>
          </div>
        )}

        {/* Add buttons + custom form */}
        <div className="px-5 py-4 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
          <div className="relative flex items-center gap-2" ref={productAnchorRef}>
            <button
              type="button"
              onClick={() => setProductSearchOpen((v) => !v)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors',
                'border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300',
                'hover:bg-zinc-50 dark:hover:bg-zinc-800',
              )}
            >
              <Plus className="w-3.5 h-3.5" />
              Add Product
            </button>
            <button
              type="button"
              onClick={() => { setShowCustomForm(true); setProductSearchOpen(false) }}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors',
                'border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300',
                'hover:bg-zinc-50 dark:hover:bg-zinc-800',
              )}
            >
              <Plus className="w-3.5 h-3.5" />
              Add Custom Item
            </button>
            <ProductSearchDropdown
              open={productSearchOpen}
              onClose={() => setProductSearchOpen(false)}
              onAdd={addProductItem}
            />
          </div>

          {showCustomForm && (
            <CustomItemForm
              onAdd={addCustomItem}
              onCancel={() => setShowCustomForm(false)}
            />
          )}
        </div>
      </div>

      {/* ── Approval warnings ───────────────────────────────────────── */}
      {needsAdminApproval && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-red-500 flex-none mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-400">
            <span className="font-semibold">Admin approval required.</span>{' '}
            One or more items have a discount exceeding 15%. This quotation must be reviewed by an admin before being sent.
          </p>
        </div>
      )}

      {!needsAdminApproval && needsManagerApproval && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-none mt-0.5" />
          <p className="text-sm text-amber-700 dark:text-amber-400">
            <span className="font-semibold">Manager approval required.</span>{' '}
            One or more items have a discount that exceeds your allowed limit. This quotation will be submitted for manager approval.
          </p>
        </div>
      )}

      {/* ── Totals summary ──────────────────────────────────────────── */}
      {items.length > 0 && (
        <div className="flex justify-end">
          <div className="w-full max-w-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 divide-y divide-zinc-100 dark:divide-zinc-800 text-sm">
            <div className="flex justify-between px-4 py-2.5">
              <span className="text-zinc-500">Subtotal</span>
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {formatCurrency(totals.subtotal)}
              </span>
            </div>
            <div className="flex justify-between px-4 py-2.5">
              <span className="text-zinc-500">Total Discount</span>
              <span className="font-medium text-red-600">
                −{formatCurrency(totals.discountTotal)}
              </span>
            </div>
            <div className="flex justify-between px-4 py-2.5">
              <span className="text-zinc-500">GST Total</span>
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {formatCurrency(totals.gstTotal)}
              </span>
            </div>
            <div className="flex justify-between px-4 py-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-b-xl">
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">Grand Total</span>
              <span className="font-bold text-lg text-zinc-900 dark:text-zinc-100">
                {formatCurrency(totals.grandTotal)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Actions ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
        >
          Cancel
        </button>

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={saving !== null}
            onClick={() => handleSubmit(true)}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-lg border transition-colors',
              'border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300',
              'hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            {saving === 'draft' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              'Save as Draft'
            )}
          </button>

          <button
            type="button"
            disabled={saving !== null}
            onClick={() => handleSubmit(false)}
            className={cn(
              'flex items-center gap-2 px-5 py-2 text-sm font-medium rounded-lg transition-colors',
              needsManagerApproval || needsAdminApproval
                ? 'bg-amber-600 hover:bg-amber-700 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            {saving === 'submit' && <Loader2 className="w-4 h-4 animate-spin" />}
            {needsManagerApproval || needsAdminApproval
              ? 'Submit for Approval'
              : 'Create & Send'}
          </button>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// LineItemRow — separated for performance
// =============================================================================

function LineItemRow({
  item,
  maxDiscountPct,
  onUpdate,
  onRemove,
}: {
  item: QuoteItem
  maxDiscountPct: number
  onUpdate: (patch: Partial<Pick<QuoteItem, 'qty' | 'unit_price' | 'discount_pct' | 'gst_pct'>>) => void
  onRemove: () => void
}) {
  const discountExceeded = item.discount_pct >= maxDiscountPct && maxDiscountPct < 100

  return (
    <tr className="group hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
      {/* Product info */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-zinc-100 dark:bg-zinc-800 overflow-hidden flex-none flex items-center justify-center">
            {item.image_url ? (
              <Image
                src={item.image_url}
                alt={item.name}
                width={36}
                height={36}
                className="object-cover w-full h-full"
              />
            ) : item.is_custom ? (
              <span className="text-xs font-bold text-zinc-400">C</span>
            ) : (
              <ImageOff className="w-4 h-4 text-zinc-400" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate max-w-40">
              {item.name}
            </p>
            {item.sku && (
              <p className="text-xs text-zinc-400">{item.sku}</p>
            )}
            {item.is_custom && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                Custom
              </span>
            )}
          </div>
        </div>
      </td>

      {/* Qty */}
      <td className="px-3 py-3">
        <input
          type="number"
          min="1"
          value={item.qty}
          onChange={(e) => {
            const v = parseInt(e.target.value)
            if (!isNaN(v) && v > 0) onUpdate({ qty: v })
          }}
          className={cn(
            'w-16 text-right px-2 py-1 text-sm rounded-md border',
            'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900',
            'focus:outline-none focus:ring-2 focus:ring-blue-500/20',
          )}
        />
      </td>

      {/* Unit Price */}
      <td className="px-3 py-3">
        <input
          type="number"
          min="0"
          step="0.01"
          value={item.unit_price}
          onChange={(e) => {
            const v = parseFloat(e.target.value)
            if (!isNaN(v) && v >= 0) onUpdate({ unit_price: v })
          }}
          className={cn(
            'w-24 text-right px-2 py-1 text-sm rounded-md border',
            'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900',
            'focus:outline-none focus:ring-2 focus:ring-blue-500/20',
          )}
        />
      </td>

      {/* Discount% */}
      <td className="px-3 py-3">
        <div className="relative">
          <input
            type="number"
            min="0"
            max={maxDiscountPct}
            step="0.5"
            value={item.discount_pct}
            onChange={(e) => {
              let v = parseFloat(e.target.value)
              if (isNaN(v)) v = 0
              if (v > maxDiscountPct) v = maxDiscountPct
              onUpdate({ discount_pct: v })
            }}
            className={cn(
              'w-20 text-right px-2 py-1 text-sm rounded-md border pr-6',
              discountExceeded
                ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30'
                : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900',
              'focus:outline-none focus:ring-2 focus:ring-blue-500/20',
            )}
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-zinc-400 pointer-events-none">
            %
          </span>
        </div>
      </td>

      {/* GST% */}
      <td className="px-3 py-3">
        <select
          value={item.gst_pct}
          onChange={(e) => onUpdate({ gst_pct: parseFloat(e.target.value) })}
          className={cn(
            'w-16 text-right px-1 py-1 text-sm rounded-md border appearance-none',
            'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900',
            'focus:outline-none focus:ring-2 focus:ring-blue-500/20',
          )}
        >
          <option value="0">0%</option>
          <option value="5">5%</option>
          <option value="12">12%</option>
          <option value="18">18%</option>
          <option value="28">28%</option>
        </select>
      </td>

      {/* Line Total */}
      <td className="px-3 py-3 text-right">
        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {formatCurrency(item.line_total)}
        </span>
      </td>

      {/* Remove */}
      <td className="px-3 py-3">
        <button
          type="button"
          onClick={onRemove}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-950/30 text-zinc-400 hover:text-red-500"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </td>
    </tr>
  )
}
