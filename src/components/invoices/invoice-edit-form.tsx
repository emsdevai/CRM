'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Package, Plus, Search, Trash2, X } from 'lucide-react'
import Image from 'next/image'
import { updateInvoiceFull, type InvoiceItemInput } from '@/lib/actions/invoices'
import { searchProducts, searchCustomers } from '@/lib/actions/quotations'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { InvoiceItem, Customer, Product } from '@/lib/types/database'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EditItem {
  _key: string // local id
  product_id: string | null
  name: string
  sku: string
  image_url: string | null
  qty: number
  unit_price: number
  discount_pct: number
  gst_pct: number
}

const PAYMENT_METHODS = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Card'] as const
const CARD_TYPES      = ['Debit Card', 'Credit Card'] as const

interface InvoiceEditFormProps {
  invoiceId: string
  invoiceNo: string
  initialDate: string
  initialCustomerId: string | null
  initialCustomerName: string | null
  initialPaymentMethod: string | null
  initialPaymentCardType: string | null
  initialItems: InvoiceItem[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const inputCls = cn(
  'w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900',
  'placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600',
  'disabled:opacity-50 disabled:bg-zinc-50',
)

function calcItem(item: EditItem) {
  const lineBase = item.qty * item.unit_price
  const lineDiscount = lineBase * (item.discount_pct / 100)
  const taxable = lineBase - lineDiscount
  const gstAmt = taxable * (item.gst_pct / 100)
  return { lineBase, lineDiscount, taxable, gstAmt, lineTotal: taxable + gstAmt }
}

// ---------------------------------------------------------------------------
// Product search dropdown
// ---------------------------------------------------------------------------
function ProductSearchDropdown({
  onSelect,
}: {
  onSelect: (p: Product) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleInput(val: string) {
    setQuery(val)
    if (timer.current) clearTimeout(timer.current)
    if (!val.trim()) { setResults([]); setOpen(false); return }
    timer.current = setTimeout(async () => {
      setLoading(true)
      const data = await searchProducts(val)
      setResults(data)
      setOpen(true)
      setLoading(false)
    }, 280)
  }

  function pick(p: Product) {
    onSelect(p)
    setQuery('')
    setResults([])
    setOpen(false)
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          placeholder="Search and add product…"
          className="w-full pl-9 pr-3 py-2 rounded-lg border border-dashed border-zinc-300 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-zinc-400" />}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full bg-white border border-zinc-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
          {results.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => pick(p)}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-zinc-50 text-left"
            >
              <div className="w-8 h-8 rounded flex-none bg-zinc-100 overflow-hidden flex items-center justify-center">
                {p.image_url
                  ? <Image src={p.image_url} alt={p.name} width={32} height={32} className="object-cover w-full h-full" />
                  : <Package className="w-3.5 h-3.5 text-zinc-400" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-zinc-900 truncate">{p.name}</div>
                <div className="text-xs text-zinc-400 font-mono">{p.sku}</div>
              </div>
              <div className="text-sm font-semibold text-zinc-700">{formatCurrency(p.price)}</div>
            </button>
          ))}
        </div>
      )}
      {open && results.length === 0 && !loading && (
        <div className="absolute z-50 top-full mt-1 w-full bg-white border border-zinc-200 rounded-xl shadow-lg px-4 py-3 text-sm text-zinc-400">
          No products found
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Customer search
// ---------------------------------------------------------------------------
function CustomerPicker({
  customerId,
  customerName,
  onChange,
}: {
  customerId: string | null
  customerName: string | null
  onChange: (id: string | null, name: string | null) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Customer[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleInput(val: string) {
    setQuery(val)
    if (timer.current) clearTimeout(timer.current)
    if (!val.trim()) { setResults([]); setOpen(false); return }
    timer.current = setTimeout(async () => {
      setLoading(true)
      const data = await searchCustomers(val)
      setResults(data)
      setOpen(true)
      setLoading(false)
    }, 280)
  }

  function pick(c: Customer) {
    onChange(c.id, c.name)
    setQuery('')
    setResults([])
    setOpen(false)
  }

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Customer</label>
      {customerId && customerName && (
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
          <span className="flex-1 font-medium">{customerName}</span>
          <button type="button" onClick={() => onChange(null, null)} className="text-blue-500 hover:text-blue-700">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      {!customerId && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => handleInput(e.target.value)}
            placeholder="Search customer by name or phone…"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-zinc-300 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
          />
          {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-zinc-400" />}
          {open && results.length > 0 && (
            <div className="absolute z-50 top-full mt-1 w-full bg-white border border-zinc-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
              {results.map((c) => (
                <button key={c.id} type="button" onClick={() => pick(c)}
                  className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-zinc-50 text-left">
                  <div>
                    <div className="text-sm font-medium text-zinc-900">{c.name}</div>
                    {c.phone && <div className="text-xs text-zinc-400">{c.phone}</div>}
                  </div>
                  {c.customer_number && <div className="text-xs font-mono text-zinc-400">{c.customer_number}</div>}
                </button>
              ))}
            </div>
          )}
          {open && results.length === 0 && !loading && (
            <div className="absolute z-50 top-full mt-1 w-full bg-white border border-zinc-200 rounded-xl shadow-lg px-4 py-3 text-sm text-zinc-400">
              No customers found
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main form
// ---------------------------------------------------------------------------
export function InvoiceEditForm({
  invoiceId,
  invoiceNo,
  initialDate,
  initialCustomerId,
  initialCustomerName,
  initialPaymentMethod,
  initialPaymentCardType,
  initialItems,
}: InvoiceEditFormProps) {
  const router = useRouter()

  const [customerId, setCustomerId] = useState<string | null>(initialCustomerId)
  const [customerName, setCustomerName] = useState<string | null>(initialCustomerName)
  const [invoiceDate, setInvoiceDate] = useState(initialDate.slice(0, 10))
  const [paymentMethod,   setPaymentMethod]   = useState<string>(initialPaymentMethod ?? '')
  const [paymentCardType, setPaymentCardType] = useState<string>(initialPaymentCardType ?? '')
  const [saving, setSaving] = useState(false)

  const [items, setItems] = useState<EditItem[]>(
    initialItems.map((item) => ({
      _key: item.id,
      product_id: item.product_id,
      name: item.name ?? '',
      sku: item.sku ?? '',
      image_url: item.image_url,
      qty: item.qty ?? 1,
      unit_price: item.unit_price ?? 0,
      discount_pct: item.discount_pct ?? 0,
      gst_pct: item.gst_pct ?? 18,
    })),
  )

  function addProduct(p: Product) {
    setItems((prev) => [
      ...prev,
      {
        _key: `new-${Date.now()}-${Math.random()}`,
        product_id: p.id,
        name: p.name,
        sku: p.sku,
        image_url: p.image_url,
        qty: 1,
        unit_price: p.price,
        discount_pct: 0,
        gst_pct: p.gst_pct,
      },
    ])
  }

  function updateItem(key: string, field: keyof EditItem, value: unknown) {
    setItems((prev) => prev.map((it) => it._key === key ? { ...it, [field]: value } : it))
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((it) => it._key !== key))
  }

  // Totals
  const totals = items.reduce(
    (acc, item) => {
      const c = calcItem(item)
      return {
        subtotal: acc.subtotal + c.lineBase,
        discount: acc.discount + c.lineDiscount,
        gst: acc.gst + c.gstAmt,
        grand: acc.grand + c.lineTotal,
      }
    },
    { subtotal: 0, discount: 0, gst: 0, grand: 0 },
  )

  async function handleSave() {
    if (items.length === 0) { toast.error('Add at least one item'); return }
    setSaving(true)
    const itemPayload: InvoiceItemInput[] = items.map((item) => ({
      product_id: item.product_id,
      name: item.name,
      sku: item.sku,
      image_url: item.image_url,
      qty: item.qty,
      unit_price: item.unit_price,
      discount_pct: item.discount_pct,
      gst_pct: item.gst_pct,
    }))
    const { error } = await updateInvoiceFull(invoiceId, {
      customer_id: customerId,
      invoice_date: invoiceDate,
      payment_method:    paymentMethod    || null,
      payment_card_type: paymentCardType  || null,
      items: itemPayload,
    })
    setSaving(false)
    if (error) { toast.error(error); return }
    toast.success('Invoice updated')
    router.push(`/invoices/${invoiceId}`)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {/* Header fields */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Invoice Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <CustomerPicker
            customerId={customerId}
            customerName={customerName}
            onChange={(id, name) => { setCustomerId(id); setCustomerName(name) }}
          />
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Invoice Date</label>
            <input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              className={inputCls}
              disabled={saving}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Payment Method</label>
            <select
              value={paymentMethod}
              onChange={(e) => {
                setPaymentMethod(e.target.value)
                if (e.target.value !== 'Card') setPaymentCardType('')
              }}
              className={inputCls}
              disabled={saving}
            >
              <option value="">— Select method —</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          {paymentMethod === 'Card' && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Card Type</label>
              <select
                value={paymentCardType}
                onChange={(e) => setPaymentCardType(e.target.value)}
                className={inputCls}
                disabled={saving}
              >
                <option value="">— Select card type —</option>
                {CARD_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Line items */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-100 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Line Items</h2>
        </div>

        {/* Items table */}
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {items.map((item) => {
            const c = calcItem(item)
            return (
              <div key={item._key} className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  {/* Thumbnail */}
                  <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 overflow-hidden flex-none flex items-center justify-center mt-0.5">
                    {item.image_url
                      ? <Image src={item.image_url} alt={item.name} width={40} height={40} className="object-cover w-full h-full" />
                      : <Package className="w-4 h-4 text-zinc-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{item.name}</p>
                    <p className="text-xs font-mono text-zinc-400">{item.sku}</p>
                  </div>
                  <button type="button" onClick={() => removeItem(item._key)}
                    className="flex-none text-zinc-400 hover:text-red-500 transition-colors p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">Qty</label>
                    <input type="number" min="1" step="1"
                      value={item.qty}
                      onChange={(e) => updateItem(item._key, 'qty', Math.max(1, Number(e.target.value)))}
                      className={cn(inputCls, 'text-center')}
                      disabled={saving}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">Unit Price (₹)</label>
                    <input type="number" min="0" step="1"
                      value={item.unit_price}
                      onChange={(e) => updateItem(item._key, 'unit_price', Number(e.target.value))}
                      className={inputCls}
                      disabled={saving}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">Discount %</label>
                    <input type="number" min="0" max="100" step="0.5"
                      value={item.discount_pct}
                      onChange={(e) => updateItem(item._key, 'discount_pct', Number(e.target.value))}
                      className={inputCls}
                      disabled={saving}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">GST %</label>
                    <input type="number" min="0" max="28" step="1"
                      value={item.gst_pct}
                      onChange={(e) => updateItem(item._key, 'gst_pct', Number(e.target.value))}
                      className={inputCls}
                      disabled={saving}
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {formatCurrency(c.lineTotal)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Add product */}
        <div className="p-4 border-t border-zinc-100 dark:border-zinc-800">
          <ProductSearchDropdown onSelect={addProduct} />
        </div>
      </div>

      {/* Totals */}
      <div className="flex justify-end">
        <div className="w-64 text-sm divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden">
          <div className="flex justify-between px-4 py-2">
            <span className="text-zinc-500">Subtotal</span>
            <span className="font-medium">{formatCurrency(totals.subtotal)}</span>
          </div>
          {totals.discount > 0 && (
            <div className="flex justify-between px-4 py-2">
              <span className="text-zinc-500">Discount</span>
              <span className="font-medium text-red-600">−{formatCurrency(totals.discount)}</span>
            </div>
          )}
          <div className="flex justify-between px-4 py-2">
            <span className="text-zinc-500">GST</span>
            <span className="font-medium">{formatCurrency(totals.gst)}</span>
          </div>
          <div className="flex justify-between px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50">
            <span className="font-bold text-zinc-900 dark:text-zinc-100">Grand Total</span>
            <span className="font-bold text-lg text-zinc-900 dark:text-zinc-100">{formatCurrency(totals.grand)}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2 border-t border-zinc-200 dark:border-zinc-800">
        <button type="button" onClick={() => router.back()} disabled={saving}
          className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 rounded-lg border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50">
          Cancel
        </button>
        <button type="button" onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Save Invoice
        </button>
      </div>
    </div>
  )
}
