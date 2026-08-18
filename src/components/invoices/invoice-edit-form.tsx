'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Package, Search, Trash2, X } from 'lucide-react'
import Image from 'next/image'
import { updateInvoiceFull, type InvoiceItemInput } from '@/lib/actions/invoices'
import { searchProducts, searchCustomers } from '@/lib/actions/quotations'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { InvoiceItem, Customer, Product } from '@/lib/types/database'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const PAYMENT_METHODS = ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Cheque'] as const
const CARD_TYPES      = ['Debit Card', 'Credit Card'] as const

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface EditItem {
  _key: string
  product_id: string | null
  name: string
  sku: string
  image_url: string | null
  qty: number
  unit_price: number
  discount_pct: number
  gst_pct: number
}

interface PaymentMeta {
  bank_name?: string
  ifsc?: string
  account_last4?: string
  cheque_date?: string
  card_last4?: string
}

interface InvoiceEditFormProps {
  invoiceId: string
  invoiceNo: string
  initialDate: string
  initialCustomerId: string | null
  initialCustomerName: string | null
  initialPaymentMethod: string | null
  initialPaymentCardType: string | null
  initialCardSurchargePct: number
  initialPaymentReference: string | null
  initialPaymentMeta: PaymentMeta
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

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
        {label}
        {hint && <span className="text-xs font-normal text-zinc-400">{hint}</span>}
      </label>
      {children}
    </div>
  )
}

function calcItem(item: EditItem) {
  const lineBase     = item.qty * item.unit_price
  const lineDiscount = lineBase * (item.discount_pct / 100)
  const taxable      = lineBase - lineDiscount
  const gstAmt       = taxable  * (item.gst_pct / 100)
  return { lineBase, lineDiscount, taxable, gstAmt, lineTotal: taxable + gstAmt }
}

// ---------------------------------------------------------------------------
// Product search dropdown
// ---------------------------------------------------------------------------
function ProductSearchDropdown({ onSelect }: { onSelect: (p: Product) => void }) {
  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [open,    setOpen]    = useState(false)
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
        <input type="text" value={query} onChange={(e) => handleInput(e.target.value)}
          placeholder="Search and add product…"
          className="w-full pl-9 pr-3 py-2 rounded-lg border border-dashed border-zinc-300 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-zinc-400" />}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full bg-white border border-zinc-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
          {results.map((p) => (
            <button key={p.id} type="button" onClick={() => pick(p)}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-zinc-50 text-left">
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
// Customer picker
// ---------------------------------------------------------------------------
function CustomerPicker({
  customerId, customerName, onChange,
}: { customerId: string | null; customerName: string | null; onChange: (id: string | null, name: string | null) => void }) {
  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState<Customer[]>([])
  const [loading, setLoading] = useState(false)
  const [open,    setOpen]    = useState(false)
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
          <input type="text" value={query} onChange={(e) => handleInput(e.target.value)}
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
// Payment details — per-method extra fields
// ---------------------------------------------------------------------------
function PaymentDetailsFields({
  method,
  cardType, setCardType,
  surchargePct, setSurchargePct,
  reference, setReference,
  meta, setMeta,
  disabled,
}: {
  method: string
  cardType: string; setCardType: (v: string) => void
  surchargePct: number; setSurchargePct: (v: number) => void
  reference: string; setReference: (v: string) => void
  meta: PaymentMeta; setMeta: (v: PaymentMeta) => void
  disabled: boolean
}) {
  function patchMeta(patch: Partial<PaymentMeta>) {
    setMeta({ ...meta, ...patch })
  }

  if (method === 'UPI') {
    return (
      <div className="col-span-full grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-zinc-100 dark:border-zinc-800">
        <Field label="UPI Transaction ID / UTR" hint="(required)">
          <input type="text" value={reference} onChange={(e) => setReference(e.target.value)}
            placeholder="e.g. 407123456789" className={inputCls} disabled={disabled} />
        </Field>
      </div>
    )
  }

  if (method === 'Card') {
    return (
      <div className="col-span-full grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-zinc-100 dark:border-zinc-800">
        <Field label="Card Type">
          <select value={cardType} onChange={(e) => setCardType(e.target.value)}
            className={inputCls} disabled={disabled}>
            <option value="">— Select —</option>
            {CARD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Last 4 Digits" hint="(optional)">
          <input type="text" maxLength={4} value={meta.card_last4 ?? ''}
            onChange={(e) => patchMeta({ card_last4: e.target.value.replace(/\D/g, '').slice(0, 4) })}
            placeholder="e.g. 4321" className={inputCls} disabled={disabled} />
        </Field>
        <Field label="Card Surcharge %" hint="(charged to customer)">
          <div className="relative">
            <input type="number" min="0" max="10" step="0.5" value={surchargePct}
              onChange={(e) => setSurchargePct(Math.max(0, Math.min(10, Number(e.target.value))))}
              className={inputCls} disabled={disabled} />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400 pointer-events-none">%</span>
          </div>
        </Field>
      </div>
    )
  }

  if (method === 'Bank Transfer') {
    return (
      <div className="col-span-full grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-zinc-100 dark:border-zinc-800">
        <Field label="Bank Name">
          <input type="text" value={meta.bank_name ?? ''}
            onChange={(e) => patchMeta({ bank_name: e.target.value })}
            placeholder="e.g. HDFC Bank" className={inputCls} disabled={disabled} />
        </Field>
        <Field label="Transaction Ref / UTR No" hint="(required)">
          <input type="text" value={reference} onChange={(e) => setReference(e.target.value)}
            placeholder="e.g. HDFCR2024081500001" className={inputCls} disabled={disabled} />
        </Field>
        <Field label="IFSC Code" hint="(optional)">
          <input type="text" value={meta.ifsc ?? ''}
            onChange={(e) => patchMeta({ ifsc: e.target.value.toUpperCase() })}
            placeholder="e.g. HDFC0001234" className={cn(inputCls, 'font-mono uppercase')} disabled={disabled} />
        </Field>
        <Field label="Account Last 4 Digits" hint="(optional)">
          <input type="text" maxLength={4} value={meta.account_last4 ?? ''}
            onChange={(e) => patchMeta({ account_last4: e.target.value.replace(/\D/g, '').slice(0, 4) })}
            placeholder="e.g. 3456" className={inputCls} disabled={disabled} />
        </Field>
      </div>
    )
  }

  if (method === 'Cheque') {
    return (
      <div className="col-span-full grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-zinc-100 dark:border-zinc-800">
        <Field label="Cheque Number" hint="(required)">
          <input type="text" value={reference} onChange={(e) => setReference(e.target.value)}
            placeholder="e.g. 012345" className={inputCls} disabled={disabled} />
        </Field>
        <Field label="Bank Name">
          <input type="text" value={meta.bank_name ?? ''}
            onChange={(e) => patchMeta({ bank_name: e.target.value })}
            placeholder="e.g. State Bank of India" className={inputCls} disabled={disabled} />
        </Field>
        <Field label="Cheque Date">
          <input type="date" value={meta.cheque_date ?? ''}
            onChange={(e) => patchMeta({ cheque_date: e.target.value })}
            className={inputCls} disabled={disabled} />
        </Field>
      </div>
    )
  }

  // Cash — no extra fields
  return null
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
  initialCardSurchargePct,
  initialPaymentReference,
  initialPaymentMeta,
  initialItems,
}: InvoiceEditFormProps) {
  const router = useRouter()

  // Basic fields
  const [customerId,   setCustomerId]   = useState<string | null>(initialCustomerId)
  const [customerName, setCustomerName] = useState<string | null>(initialCustomerName)
  const [invoiceDate,  setInvoiceDate]  = useState(initialDate.slice(0, 10))
  const [saving,       setSaving]       = useState(false)

  // Payment fields
  const [paymentMethod,    setPaymentMethod]    = useState<string>(initialPaymentMethod ?? '')
  const [cardType,         setCardType]         = useState<string>(initialPaymentCardType ?? '')
  const [surchargePct,     setSurchargePct]     = useState<number>(initialCardSurchargePct > 0 ? initialCardSurchargePct : 2)
  const [paymentReference, setPaymentReference] = useState<string>(initialPaymentReference ?? '')
  const [paymentMeta,      setPaymentMeta]      = useState<PaymentMeta>(initialPaymentMeta ?? {})

  // Line items
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

  function handleMethodChange(m: string) {
    setPaymentMethod(m)
    // Clear method-specific state when switching
    setPaymentReference('')
    setPaymentMeta({})
    setCardType('')
    if (m === 'Card') setSurchargePct(surchargePct > 0 ? surchargePct : 2)
    else setSurchargePct(0)
  }

  function addProduct(p: Product) {
    setItems((prev) => [...prev, {
      _key: `new-${Date.now()}-${Math.random()}`,
      product_id: p.id, name: p.name, sku: p.sku, image_url: p.image_url,
      qty: 1, unit_price: p.price, discount_pct: 0, gst_pct: p.gst_pct,
    }])
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
      return { subtotal: acc.subtotal + c.lineBase, discount: acc.discount + c.lineDiscount, gst: acc.gst + c.gstAmt, grand: acc.grand + c.lineTotal }
    },
    { subtotal: 0, discount: 0, gst: 0, grand: 0 },
  )
  const surchargeAmt      = paymentMethod === 'Card' && surchargePct > 0 ? totals.grand * surchargePct / 100 : 0
  const grandWithSurcharge = totals.grand + surchargeAmt

  async function handleSave() {
    if (items.length === 0) { toast.error('Add at least one item'); return }
    setSaving(true)
    const itemPayload: InvoiceItemInput[] = items.map((item) => ({
      product_id: item.product_id, name: item.name, sku: item.sku,
      image_url: item.image_url, qty: item.qty, unit_price: item.unit_price,
      discount_pct: item.discount_pct, gst_pct: item.gst_pct,
    }))
    const { error } = await updateInvoiceFull(invoiceId, {
      customer_id:         customerId,
      invoice_date:        invoiceDate,
      payment_method:      paymentMethod      || null,
      payment_card_type:   cardType           || null,
      card_surcharge_pct:  paymentMethod === 'Card' ? surchargePct : 0,
      payment_reference:   paymentReference   || null,
      payment_meta:        Object.keys(paymentMeta).length > 0 ? paymentMeta as Record<string, string> : null,
      items:               itemPayload,
    })
    setSaving(false)
    if (error) { toast.error(error); return }
    toast.success('Invoice updated')
    router.push(`/invoices/${invoiceId}`)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {/* ── Invoice Details ──────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Invoice Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <CustomerPicker customerId={customerId} customerName={customerName}
            onChange={(id, name) => { setCustomerId(id); setCustomerName(name) }} />
          <Field label="Invoice Date">
            <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)}
              className={inputCls} disabled={saving} />
          </Field>
        </div>
      </div>

      {/* ── Payment ──────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Payment</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Payment Method">
            <select value={paymentMethod} onChange={(e) => handleMethodChange(e.target.value)}
              className={inputCls} disabled={saving}>
              <option value="">— Select method —</option>
              {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>

          {/* Method-specific fields */}
          {paymentMethod && (
            <PaymentDetailsFields
              method={paymentMethod}
              cardType={cardType}         setCardType={setCardType}
              surchargePct={surchargePct} setSurchargePct={setSurchargePct}
              reference={paymentReference} setReference={setPaymentReference}
              meta={paymentMeta}          setMeta={setPaymentMeta}
              disabled={saving}
            />
          )}
        </div>
      </div>

      {/* ── Line Items ───────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-100 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Line Items</h2>
        </div>

        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {items.map((item) => {
            const c = calcItem(item)
            return (
              <div key={item._key} className="p-4 space-y-3">
                <div className="flex items-start gap-3">
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
                    <input type="number" min="1" step="1" value={item.qty}
                      onChange={(e) => updateItem(item._key, 'qty', Math.max(1, Number(e.target.value)))}
                      className={cn(inputCls, 'text-center')} disabled={saving} />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">Unit Price (₹)</label>
                    <input type="number" min="0" step="1" value={item.unit_price}
                      onChange={(e) => updateItem(item._key, 'unit_price', Number(e.target.value))}
                      className={inputCls} disabled={saving} />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">Discount %</label>
                    <input type="number" min="0" max="100" step="0.5" value={item.discount_pct}
                      onChange={(e) => updateItem(item._key, 'discount_pct', Number(e.target.value))}
                      className={inputCls} disabled={saving} />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">GST %</label>
                    <input type="number" min="0" max="28" step="1" value={item.gst_pct}
                      onChange={(e) => updateItem(item._key, 'gst_pct', Number(e.target.value))}
                      className={inputCls} disabled={saving} />
                  </div>
                </div>

                <div className="flex justify-end">
                  <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{formatCurrency(c.lineTotal)}</span>
                </div>
              </div>
            )
          })}
        </div>

        <div className="p-4 border-t border-zinc-100 dark:border-zinc-800">
          <ProductSearchDropdown onSelect={addProduct} />
        </div>
      </div>

      {/* ── Totals ───────────────────────────────────────────────────────── */}
      <div className="flex justify-end">
        <div className="w-72 text-sm divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden">
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
          {surchargeAmt > 0 && (
            <div className="flex justify-between px-4 py-2 bg-amber-50/60 dark:bg-amber-900/10">
              <span className="text-amber-700 dark:text-amber-400">Card Surcharge ({surchargePct}%)</span>
              <span className="font-medium text-amber-700 dark:text-amber-400">+{formatCurrency(surchargeAmt)}</span>
            </div>
          )}
          <div className="flex justify-between px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50">
            <span className="font-bold text-zinc-900 dark:text-zinc-100">Grand Total</span>
            <span className="font-bold text-lg text-zinc-900 dark:text-zinc-100">{formatCurrency(grandWithSurcharge)}</span>
          </div>
        </div>
      </div>

      {/* ── Actions ──────────────────────────────────────────────────────── */}
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
