'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Loader2, Package, Search, Trash2, X, Truck, Users, UserCheck,
} from 'lucide-react'
import Image from 'next/image'
import { updateQuotationFull } from '@/lib/actions/quotations'
import { searchProducts, searchLeads, searchCustomers } from '@/lib/actions/quotations'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type {
  QuotationItem, QuotationStage, Lead, Customer, Product,
} from '@/lib/types/database'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const STAGES: QuotationStage[] = ['Draft', 'Pending Approval', 'Sent', 'Converted', 'Rejected']

const inputCls = cn(
  'w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900',
  'placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600',
  'disabled:opacity-50 disabled:bg-zinc-50',
)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface EditItem {
  _key: string
  product_id: string | null
  is_custom: boolean
  name: string
  sku: string
  image_url: string | null
  qty: number
  unit_price: number
  discount_pct: number
  gst_pct: number
}

interface AddressBlock {
  name: string
  gst_number: string
  phone: string
  address: string
  city: string
  state: string
  pincode: string
}

const EMPTY_ADDRESS: AddressBlock = { name: '', gst_number: '', phone: '', address: '', city: '', state: '', pincode: '' }

function addressFromCustomer(c: Customer): AddressBlock {
  return {
    name:       c.name ?? '',
    gst_number: (c as any).gst_number ?? '',
    phone:      c.phone ?? '',
    address:    (c as any).address ?? '',
    city:       (c as any).city ?? '',
    state:      (c as any).state ?? '',
    pincode:    (c as any).pincode ?? '',
  }
}

export interface QuotationEditFormProps {
  quotationId: string
  initialTitle: string
  initialNotes: string
  initialStage: QuotationStage
  initialFreightCharges: number
  initialLeadId: string | null
  initialLeadName: string | null
  initialCustomerId: string | null
  initialCustomerName: string | null
  initialBilledTo: AddressBlock | null
  initialShippedTo: AddressBlock | null
  initialItems: QuotationItem[]
  isAdmin: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
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
// Lead / Customer pickers
// ---------------------------------------------------------------------------
type RecipientMode = 'lead' | 'customer'

function LeadPicker({
  leadId, leadName, onChange,
}: { leadId: string | null; leadName: string | null; onChange: (id: string | null, name: string | null) => void }) {
  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState<Lead[]>([])
  const [loading, setLoading] = useState(false)
  const [open,    setOpen]    = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleInput(val: string) {
    setQuery(val)
    if (timer.current) clearTimeout(timer.current)
    if (!val.trim()) { setResults([]); setOpen(false); return }
    timer.current = setTimeout(async () => {
      setLoading(true)
      const data = await searchLeads(val)
      setResults(data)
      setOpen(true)
      setLoading(false)
    }, 280)
  }

  function pick(l: Lead) {
    onChange(l.id, l.name)
    setQuery('')
    setResults([])
    setOpen(false)
  }

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-zinc-700">Lead</label>
      {leadId && leadName && (
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
          <span className="flex-1 font-medium">{leadName}</span>
          <button type="button" onClick={() => onChange(null, null)} className="text-blue-500 hover:text-blue-700">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      {!leadId && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
          <input type="text" value={query} onChange={(e) => handleInput(e.target.value)}
            placeholder="Search lead by name or phone…"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-zinc-300 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
          />
          {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-zinc-400" />}
          {open && results.length > 0 && (
            <div className="absolute z-50 top-full mt-1 w-full bg-white border border-zinc-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
              {results.map((l) => (
                <button key={l.id} type="button" onClick={() => pick(l)}
                  className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-zinc-50 text-left">
                  <div>
                    <div className="text-sm font-medium text-zinc-900">{l.name}</div>
                    {l.phone && <div className="text-xs text-zinc-400">{l.phone}</div>}
                  </div>
                  <span className="text-xs text-zinc-400 capitalize">{l.stage}</span>
                </button>
              ))}
            </div>
          )}
          {open && results.length === 0 && !loading && (
            <div className="absolute z-50 top-full mt-1 w-full bg-white border border-zinc-200 rounded-xl shadow-lg px-4 py-3 text-sm text-zinc-400">No leads found</div>
          )}
        </div>
      )}
    </div>
  )
}

function CustomerPicker({
  customerId, customerName, onChange,
}: { customerId: string | null; customerName: string | null; onChange: (id: string | null, name: string | null, customer?: Customer) => void }) {
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
    onChange(c.id, c.name, c)
    setQuery('')
    setResults([])
    setOpen(false)
  }

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-zinc-700">Customer</label>
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
            <div className="absolute z-50 top-full mt-1 w-full bg-white border border-zinc-200 rounded-xl shadow-lg px-4 py-3 text-sm text-zinc-400">No customers found</div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Address fields component
// ---------------------------------------------------------------------------
function AddressFields({
  label, value, onChange, showGst, disabled,
}: { label: string; value: AddressBlock; onChange: (v: AddressBlock) => void; showGst?: boolean; disabled?: boolean }) {
  function patch(field: keyof AddressBlock, val: string) {
    onChange({ ...value, [field]: val })
  }
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">{label}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-zinc-500 mb-1 block">Name</label>
          <input className={inputCls} disabled={disabled} value={value.name} onChange={(e) => patch('name', e.target.value)} placeholder="Customer / Company name" />
        </div>
        <div>
          <label className="text-xs text-zinc-500 mb-1 block">Phone</label>
          <input className={inputCls} disabled={disabled} value={value.phone} onChange={(e) => patch('phone', e.target.value)} placeholder="+91 …" />
        </div>
      </div>
      {showGst && (
        <div>
          <label className="text-xs text-zinc-500 mb-1 block">GSTIN (optional)</label>
          <input className={cn(inputCls, 'font-mono uppercase')} maxLength={15} disabled={disabled}
            value={value.gst_number} onChange={(e) => patch('gst_number', e.target.value.toUpperCase())} placeholder="22AAAAA0000A1Z5" />
        </div>
      )}
      <div>
        <label className="text-xs text-zinc-500 mb-1 block">Address</label>
        <input className={inputCls} disabled={disabled} value={value.address} onChange={(e) => patch('address', e.target.value)} placeholder="Street / House no." />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-zinc-500 mb-1 block">City</label>
          <input className={inputCls} disabled={disabled} value={value.city} onChange={(e) => patch('city', e.target.value)} placeholder="City" />
        </div>
        <div>
          <label className="text-xs text-zinc-500 mb-1 block">State</label>
          <input className={inputCls} disabled={disabled} value={value.state} onChange={(e) => patch('state', e.target.value)} placeholder="State" />
        </div>
        <div>
          <label className="text-xs text-zinc-500 mb-1 block">Pincode</label>
          <input className={inputCls} disabled={disabled} value={value.pincode} onChange={(e) => patch('pincode', e.target.value)} placeholder="000000" maxLength={6} />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main form
// ---------------------------------------------------------------------------
export function QuotationEditForm({
  quotationId,
  initialTitle,
  initialNotes,
  initialStage,
  initialFreightCharges,
  initialLeadId,
  initialLeadName,
  initialCustomerId,
  initialCustomerName,
  initialBilledTo,
  initialShippedTo,
  initialItems,
  isAdmin,
}: QuotationEditFormProps) {
  const router = useRouter()

  // Recipient mode
  const [mode, setMode] = useState<RecipientMode>(initialLeadId ? 'lead' : 'customer')
  const [leadId,        setLeadId]        = useState<string | null>(initialLeadId)
  const [leadName,      setLeadName]      = useState<string | null>(initialLeadName)
  const [customerId,    setCustomerId]    = useState<string | null>(initialCustomerId)
  const [customerName,  setCustomerName]  = useState<string | null>(initialCustomerName)

  // Header fields
  const [title,    setTitle]    = useState(initialTitle)
  const [notes,    setNotes]    = useState(initialNotes)
  const [stage,    setStage]    = useState<QuotationStage>(initialStage)
  const [freight,  setFreight]  = useState(initialFreightCharges)

  // Address blocks
  const [billedTo,     setBilledTo]     = useState<AddressBlock>(initialBilledTo ?? EMPTY_ADDRESS)
  const [shippedTo,    setShippedTo]    = useState<AddressBlock>(initialShippedTo ?? EMPTY_ADDRESS)
  const [sameAsBilling, setSameAsBilling] = useState(false)

  // Line items
  const [items, setItems] = useState<EditItem[]>(
    initialItems.map((item) => ({
      _key: item.id,
      product_id: item.product_id,
      is_custom: item.is_custom ?? false,
      name: item.name ?? '',
      sku: item.sku ?? '',
      image_url: item.image_url,
      qty: item.qty ?? 1,
      unit_price: item.unit_price ?? 0,
      discount_pct: item.discount_pct ?? 0,
      gst_pct: item.gst_pct ?? 18,
    })),
  )

  const [saving, setSaving] = useState(false)

  function switchMode(m: RecipientMode) {
    setMode(m)
    if (m === 'lead')     { setCustomerId(null); setCustomerName(null) }
    if (m === 'customer') { setLeadId(null);     setLeadName(null) }
  }

  function addProduct(p: Product) {
    setItems((prev) => [...prev, {
      _key: `new-${Date.now()}-${Math.random()}`,
      product_id: p.id, is_custom: false,
      name: p.name, sku: p.sku, image_url: p.image_url,
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
  const grandWithFreight = totals.grand + freight

  async function handleSave() {
    if (items.length === 0) { toast.error('Add at least one item'); return }
    setSaving(true)
    const { error } = await updateQuotationFull(quotationId, {
      lead_id:      mode === 'lead'     ? leadId     : null,
      customer_id:  mode === 'customer' ? customerId : null,
      title: title || null,
      notes: notes || null,
      stage: isAdmin ? stage : undefined,
      freight_charges: freight,
      billed_to:  billedTo  as unknown as Record<string, string>,
      shipped_to: (sameAsBilling ? billedTo : shippedTo) as unknown as Record<string, string>,
      items: items.map((item) => ({
        product_id: item.product_id,
        is_custom: item.is_custom,
        name: item.name,
        sku: item.sku,
        image_url: item.image_url ?? undefined,
        qty: item.qty,
        unit_price: item.unit_price,
        discount_pct: item.discount_pct,
        gst_pct: item.gst_pct,
      })),
    })
    setSaving(false)
    if (error) { toast.error(error); return }
    toast.success('Quotation updated')
    router.push(`/quotations/${quotationId}`)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {/* ── Recipient ────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-zinc-200 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-800">Recipient</h2>
          <div className="flex rounded-lg border border-zinc-300 overflow-hidden text-xs font-medium">
            <button type="button" onClick={() => switchMode('lead')}
              className={cn('px-3 py-1.5 flex items-center gap-1.5 transition-colors',
                mode === 'lead' ? 'bg-blue-600 text-white' : 'text-zinc-600 hover:bg-zinc-50')}>
              <Users className="w-3.5 h-3.5" /> Lead
            </button>
            <button type="button" onClick={() => switchMode('customer')}
              className={cn('px-3 py-1.5 flex items-center gap-1.5 transition-colors border-l border-zinc-300',
                mode === 'customer' ? 'bg-blue-600 text-white' : 'text-zinc-600 hover:bg-zinc-50')}>
              <UserCheck className="w-3.5 h-3.5" /> Customer
            </button>
          </div>
        </div>

        {mode === 'lead'
          ? <LeadPicker leadId={leadId} leadName={leadName} onChange={(id, name) => { setLeadId(id); setLeadName(name) }} />
          : <CustomerPicker customerId={customerId} customerName={customerName} onChange={(id, name, customer) => {
              setCustomerId(id); setCustomerName(name)
              if (customer) {
                const addr = addressFromCustomer(customer)
                setBilledTo(addr)
                if (sameAsBilling) setShippedTo(addr)
              }
            }} />
        }
      </div>

      {/* ── Header fields ────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-zinc-200 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-800">Details</h2>
        <div className={cn('grid gap-4', isAdmin ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1')}>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-zinc-700">Title <span className="text-zinc-400 font-normal">(optional)</span></label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Bedroom Set Package – Sharma Ji"
              className={inputCls} disabled={saving} />
          </div>
          {isAdmin && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-700">Stage</label>
              <select value={stage} onChange={(e) => setStage(e.target.value as QuotationStage)}
                className={inputCls} disabled={saving}>
                {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-zinc-700">Notes</label>
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Any special remarks or conditions…"
            className={inputCls} disabled={saving} />
        </div>
      </div>

      {/* ── Billed To / Ship To ──────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-zinc-200 p-5 space-y-6">
        <h2 className="text-sm font-semibold text-zinc-800">Address</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:divide-x md:divide-zinc-100">
          <AddressFields label="Billed To" value={billedTo} showGst onChange={setBilledTo} disabled={saving} />
          <div className="md:pl-6 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Ship To</p>
              <label className="flex items-center gap-1.5 text-xs text-zinc-500 cursor-pointer select-none">
                <input type="checkbox" checked={sameAsBilling}
                  onChange={(e) => { setSameAsBilling(e.target.checked); if (e.target.checked) setShippedTo(billedTo) }}
                  className="rounded border-zinc-300" />
                Same as Billed To
              </label>
            </div>
            {sameAsBilling ? (
              <div className="text-xs text-zinc-400 space-y-0.5 py-2">
                {billedTo.name    && <p className="font-medium text-zinc-600">{billedTo.name}</p>}
                {billedTo.address && <p>{billedTo.address}</p>}
                {(billedTo.city || billedTo.state || billedTo.pincode) && (
                  <p>{[billedTo.city, billedTo.state, billedTo.pincode].filter(Boolean).join(', ')}</p>
                )}
                {!billedTo.name && !billedTo.address && <p className="italic">Fill in Billed To first</p>}
              </div>
            ) : (
              <AddressFields label="" value={shippedTo} onChange={setShippedTo} disabled={saving} />
            )}
          </div>
        </div>
      </div>

      {/* ── Line items ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-100">
          <h2 className="text-sm font-semibold text-zinc-800">Line Items</h2>
        </div>

        <div className="divide-y divide-zinc-100">
          {items.map((item) => {
            const c = calcItem(item)
            return (
              <div key={item._key} className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-zinc-100 overflow-hidden flex-none flex items-center justify-center mt-0.5">
                    {item.image_url
                      ? <Image src={item.image_url} alt={item.name} width={40} height={40} className="object-cover w-full h-full" />
                      : <Package className="w-4 h-4 text-zinc-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-900">{item.name}</p>
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
                  <span className="text-sm font-semibold text-zinc-900">{formatCurrency(c.lineTotal)}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Add product */}
        <div className="p-4 border-t border-zinc-100">
          <ProductSearchDropdown onSelect={addProduct} />
        </div>
      </div>

      {/* ── Totals + Freight ─────────────────────────────────────────────── */}
      <div className="flex flex-col items-end gap-3">
        {/* Freight charges */}
        <div className="flex items-center gap-3 w-full sm:w-80">
          <div className="flex items-center gap-2 text-sm text-zinc-600 w-32 flex-shrink-0">
            <Truck className="w-4 h-4" /> Freight
          </div>
          <input type="number" min="0" step="100" value={freight}
            onChange={(e) => setFreight(Math.max(0, Number(e.target.value)))}
            className={cn(inputCls, 'flex-1')} disabled={saving} />
        </div>

        {/* Totals */}
        <div className="w-full sm:w-80 text-sm divide-y divide-zinc-100 border border-zinc-200 rounded-xl overflow-hidden">
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
          {freight > 0 && (
            <div className="flex justify-between px-4 py-2">
              <span className="text-zinc-500">Freight</span>
              <span className="font-medium">{formatCurrency(freight)}</span>
            </div>
          )}
          <div className="flex justify-between px-4 py-3 bg-zinc-50">
            <span className="font-bold text-zinc-900">Grand Total</span>
            <span className="font-bold text-lg text-zinc-900">{formatCurrency(grandWithFreight)}</span>
          </div>
        </div>
      </div>

      {/* ── Actions ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-end gap-3 pt-2 border-t border-zinc-200">
        <button type="button" onClick={() => router.back()} disabled={saving}
          className="px-4 py-2 text-sm font-medium text-zinc-700 rounded-lg border border-zinc-300 hover:bg-zinc-50 transition-colors disabled:opacity-50">
          Cancel
        </button>
        <button type="button" onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Save Quotation
        </button>
      </div>
    </div>
  )
}
