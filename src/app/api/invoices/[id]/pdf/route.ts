import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  // Fetch invoice with items + customer + lead + salesperson
  const { data: invoice, error } = await supabase
    .from('invoices')
    .select(
      `
      *,
      items:invoice_items(*, product:products(id, hsn_code)),
      customer:customers(id, name, phone, email, address, city, state, gst_number, pincode),
      lead:leads(id, name, phone, email, city, state),
      salesperson:profiles!invoices_salesperson_id_fkey(id, name, phone)
      `,
    )
    .eq('id', id)
    .single()

  if (error || !invoice) {
    return new NextResponse('Invoice not found', { status: 404 })
  }

  const fmt = (v: number | null) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(v ?? 0)

  const fmtDate = (d: string) =>
    new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(d))

  type InvoiceItemWithProduct = {
    id: string
    name: string | null
    sku: string | null
    qty: number | null
    unit_price: number | null
    discount_pct: number | null
    gst_pct: number | null
    line_total: number | null
    image_url: string | null
    product: { id: string; hsn_code: string | null } | null
  }

  type BilledParty = {
    name: string
    phone?: string | null
    email?: string | null
    address?: string | null
    city?: string | null
    state?: string | null
    gst_number?: string | null
    pincode?: string | null
  }

  const items: InvoiceItemWithProduct[] = (invoice.items as InvoiceItemWithProduct[]) ?? []
  const customer = (invoice.customer as BilledParty | null) ?? (invoice.lead as BilledParty | null)

  // Freight + payment mode (new optional columns — graceful fallback to 0/null)
  const freightCharges: number = (invoice as any).freight_charges ?? 0
  const paymentMode: string = (invoice as any).payment_mode ?? ''
  const paymentReference: string = (invoice as any).payment_reference ?? ''
  const cardSurchargePct: number = (invoice as any).card_surcharge_pct ?? 0

  // Totals
  const subtotal: number = (invoice.subtotal as number) ?? 0
  const discountTotal: number = (invoice.discount_total as number) ?? 0
  const gstTotal: number = (invoice.gst_total as number) ?? 0
  const cgst = gstTotal / 2
  const sgst = gstTotal / 2
  const cardSurcharge = cardSurchargePct > 0 ? ((subtotal - discountTotal + gstTotal + freightCharges) * cardSurchargePct) / 100 : 0
  const grandTotal: number = (invoice.grand_total as number) ?? (subtotal - discountTotal + gstTotal + freightCharges + cardSurcharge)

  const itemRows = items
    .map((item, idx) => {
      const lineBase = (item.qty ?? 0) * (item.unit_price ?? 0)
      const lineDiscount = lineBase * ((item.discount_pct ?? 0) / 100)
      const taxable = lineBase - lineDiscount
      const gstAmt = taxable * ((item.gst_pct ?? 0) / 100)
      const hsnCode = item.product?.hsn_code ?? (item as any).hsn_code ?? ''

      return `
      <tr>
        <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;font-size:12px;color:#888;text-align:center">${idx + 1}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0">
          <div style="display:flex;align-items:center;gap:10px">
            ${item.image_url
              ? `<img src="${item.image_url}" alt="" style="width:72px;height:72px;object-fit:cover;border-radius:6px;border:1px solid #e8e8e8;flex-shrink:0" />`
              : `<div style="width:72px;height:72px;border-radius:6px;background:#f4f4f4;border:1px solid #e8e8e8;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:9px;color:#bbb">IMG</div>`
            }
            <div>
              <div style="font-size:13px;font-weight:600;color:#111;line-height:1.3">${item.name ?? '—'}</div>
              ${item.sku ? `<div style="font-size:10px;color:#888;font-family:monospace;margin-top:2px">${item.sku}</div>` : ''}
            </div>
          </div>
        </td>
        <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;text-align:center;font-size:12px;color:#555;font-family:monospace">${hsnCode || '—'}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;text-align:center;font-size:13px">${item.qty ?? 0}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;text-align:right;font-size:13px">${fmt(item.unit_price)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;text-align:right;font-size:13px;color:${(item.discount_pct ?? 0) > 0 ? '#dc2626' : '#aaa'}">
          ${(item.discount_pct ?? 0) > 0 ? `−${fmt(lineDiscount)}<br/><span style="font-size:10px">(${item.discount_pct}%)</span>` : '—'}
        </td>
        <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;text-align:right;font-size:13px">${fmt(taxable)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;text-align:center;font-size:12px;color:#555">${item.gst_pct ?? 0}%</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;text-align:right;font-size:13px">${fmt(gstAmt)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;text-align:right;font-size:13px;font-weight:600">${fmt(item.line_total)}</td>
      </tr>`
    })
    .join('')

  const paymentStatusColor: Record<string, string> = {
    Paid: '#059669',
    'Partially Paid': '#2563eb',
    Pending: '#d97706',
  }
  const statusColor = paymentStatusColor[invoice.payment_status as string] ?? '#666'

  const billedToHtml = customer
    ? `<div style="font-size:15px;font-weight:700;color:#111">${customer.name}</div>
       ${customer.phone ? `<div style="font-size:12px;color:#555;margin-top:3px">📞 ${customer.phone}</div>` : ''}
       ${customer.email ? `<div style="font-size:12px;color:#555;margin-top:2px">✉ ${customer.email}</div>` : ''}
       ${(customer as any).gst_number ? `<div style="font-size:12px;color:#555;margin-top:2px">GSTIN: ${(customer as any).gst_number}</div>` : ''}
       ${customer.address ? `<div style="font-size:12px;color:#555;margin-top:2px">${customer.address}</div>` : ''}
       ${(customer.city || customer.state || (customer as any).pincode) ? `<div style="font-size:12px;color:#555;margin-top:2px">${[customer.city, customer.state, (customer as any).pincode].filter(Boolean).join(', ')}</div>` : ''}`
    : '<div style="font-size:12px;color:#aaa">—</div>'

  const shipToHtml = customer
    ? `<div style="font-size:15px;font-weight:700;color:#111">${customer.name}</div>
       ${customer.phone ? `<div style="font-size:12px;color:#555;margin-top:3px">📞 ${customer.phone}</div>` : ''}
       ${customer.address ? `<div style="font-size:12px;color:#555;margin-top:2px">${customer.address}</div>` : ''}
       ${(customer.city || customer.state || (customer as any).pincode) ? `<div style="font-size:12px;color:#555;margin-top:2px">${[customer.city, customer.state, (customer as any).pincode].filter(Boolean).join(', ')}</div>` : ''}`
    : '<div style="font-size:12px;color:#aaa">—</div>'

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Invoice ${invoice.invoice_no}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      color: #111;
      background: #fff;
      padding: 32px;
      font-size: 14px;
      line-height: 1.5;
    }
    .invoice-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 20px;
      border-bottom: 2.5px solid #111;
      margin-bottom: 20px;
    }
    .company-name { font-size: 22px; font-weight: 800; color: #111; letter-spacing: -0.5px; }
    .company-tagline { font-size: 11px; color: #888; margin-top: 2px; }
    .invoice-badge {
      display: inline-block;
      background: #111;
      color: #fff;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 2px;
      text-transform: uppercase;
      padding: 4px 12px;
      border-radius: 20px;
      margin-bottom: 6px;
    }
    .invoice-number { font-size: 16px; font-weight: 700; color: #111; }
    .invoice-date { font-size: 12px; color: #666; }
    .billing-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-bottom: 20px;
      padding: 16px;
      background: #fafafa;
      border-radius: 10px;
      border: 1px solid #eee;
    }
    .section-label {
      font-size: 9px;
      font-weight: 700;
      color: #999;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      margin-bottom: 6px;
    }
    .payment-badge {
      display: inline-block;
      padding: 5px 14px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 700;
      border: 2px solid;
      margin-bottom: 16px;
    }
    table { width: 100%; border-collapse: collapse; }
    thead tr { background: #f5f5f5; }
    thead th {
      padding: 9px 10px;
      text-align: left;
      font-size: 10px;
      font-weight: 700;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 2px solid #e0e0e0;
    }
    thead th.text-right { text-align: right; }
    thead th.text-center { text-align: center; }
    .totals-table { margin-left: auto; width: 280px; margin-top: 16px; }
    .totals-table td { padding: 4px 0; font-size: 13px; }
    .totals-table td:last-child { text-align: right; font-weight: 500; }
    .grand-total-row td {
      font-size: 17px;
      font-weight: 800;
      padding-top: 10px;
      border-top: 2.5px solid #111;
    }
    .footer {
      margin-top: 36px;
      padding-top: 14px;
      border-top: 1px solid #eee;
      text-align: center;
      font-size: 11px;
      color: #bbb;
    }
    @media print {
      body { padding: 16px; }
      .no-print { display: none !important; }
      @page { margin: 1cm; size: A4; }
    }
  </style>
</head>
<body>

  <!-- ── Toolbar (hidden in print) ──────────────────────────────────────── -->
  <div class="no-print" style="background:#f8f8f8;border:1px solid #e0e0e0;border-radius:10px;padding:14px 16px;margin-bottom:20px">
    <div style="display:flex;align-items:flex-start;gap:24px;flex-wrap:wrap">

      <!-- Payment status -->
      <div>
        <div style="font-size:10px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Payment Status</div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <select id="paymentSelect" style="padding:6px 10px;border:1px solid #ddd;border-radius:7px;font-size:13px;color:#111;background:#fff">
            <option value="Pending" ${invoice.payment_status === 'Pending' ? 'selected' : ''}>Pending</option>
            <option value="Partially Paid" ${invoice.payment_status === 'Partially Paid' ? 'selected' : ''}>Partially Paid</option>
            <option value="Paid" ${invoice.payment_status === 'Paid' ? 'selected' : ''}>Paid</option>
          </select>
          <button onclick="updatePayment()" id="updatePaymentBtn"
            style="padding:6px 14px;background:#1D4ED8;color:#fff;border:none;border-radius:7px;font-size:13px;font-weight:600;cursor:pointer">
            Update
          </button>
          <span id="paymentMsg" style="font-size:12px;color:#059669;display:none">✓ Saved</span>
        </div>
      </div>

      <!-- Payment mode -->
      <div>
        <div style="font-size:10px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Payment Mode</div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <select id="paymentModeSelect" onchange="onModeChange()"
            style="padding:6px 10px;border:1px solid #ddd;border-radius:7px;font-size:13px;color:#111;background:#fff">
            <option value="" ${!paymentMode ? 'selected' : ''}>— Select —</option>
            <option value="Cash" ${paymentMode === 'Cash' ? 'selected' : ''}>Cash</option>
            <option value="UPI" ${paymentMode === 'UPI' ? 'selected' : ''}>UPI</option>
            <option value="Card" ${paymentMode === 'Card' ? 'selected' : ''}>Card</option>
            <option value="Bank Transfer" ${paymentMode === 'Bank Transfer' ? 'selected' : ''}>Bank Transfer</option>
          </select>
          <input id="paymentRef" type="text" placeholder="Transaction / Reference ID"
            value="${paymentReference}"
            style="padding:6px 10px;border:1px solid #ddd;border-radius:7px;font-size:13px;width:200px;display:none" />
          <span id="cardSurchargeWrap" style="display:none">
            <input id="cardSurchargePct" type="number" min="0" max="10" step="0.5"
              value="${cardSurchargePct}"
              placeholder="Card surcharge %"
              style="padding:6px 10px;border:1px solid #ddd;border-radius:7px;font-size:13px;width:140px" />
            <span style="font-size:12px;color:#666;margin-left:4px">% surcharge</span>
          </span>
          <button onclick="savePaymentMode()" id="saveModeBtn"
            style="padding:6px 14px;background:#059669;color:#fff;border:none;border-radius:7px;font-size:13px;font-weight:600;cursor:pointer">
            Save
          </button>
        </div>
      </div>

      <!-- Freight -->
      <div>
        <div style="font-size:10px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Freight Charges (excl. GST)</div>
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:13px;color:#555">₹</span>
          <input id="freightInput" type="number" min="0" step="1"
            value="${freightCharges}"
            style="padding:6px 10px;border:1px solid #ddd;border-radius:7px;font-size:13px;width:120px" />
          <button onclick="saveFreight()" id="saveFreightBtn"
            style="padding:6px 14px;background:#059669;color:#fff;border:none;border-radius:7px;font-size:13px;font-weight:600;cursor:pointer">
            Save
          </button>
          <span id="freightMsg" style="font-size:12px;color:#059669;display:none">✓ Saved</span>
        </div>
      </div>

      <!-- Print -->
      <div style="margin-left:auto;display:flex;align-items:flex-end">
        <button onclick="window.print()"
          style="padding:8px 20px;background:#111;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">
          Print / Save PDF
        </button>
      </div>
    </div>
  </div>

  <!-- ── Invoice Header ──────────────────────────────────────────────────── -->
  <div class="invoice-header">
    <div>
      <div class="company-name">Jangid Brothers</div>
      <div class="company-tagline">Complete Furniture Retail</div>
    </div>
    <div style="text-align:right">
      <div class="invoice-badge">Tax Invoice</div>
      <div class="invoice-number">${invoice.invoice_no}</div>
      <div class="invoice-date">Date: ${fmtDate(invoice.invoice_date)}</div>
    </div>
  </div>

  <!-- ── Billing / Shipping Section ─────────────────────────────────────── -->
  <div class="billing-section">
    <div>
      <div class="section-label">Billed To</div>
      ${billedToHtml}
    </div>
    <div>
      <div class="section-label">Ship To</div>
      ${shipToHtml}
    </div>
  </div>

  <!-- ── Payment Status Badge ────────────────────────────────────────────── -->
  <div>
    <span class="payment-badge" id="paymentBadge"
      style="color:${statusColor};border-color:${statusColor}">
      ${invoice.payment_status}
    </span>
    ${paymentMode ? `<span style="font-size:12px;color:#555;margin-left:10px">Mode: <strong>${paymentMode}</strong>${paymentReference ? ` · Ref: ${paymentReference}` : ''}</span>` : ''}
  </div>

  <!-- ── Line Items ──────────────────────────────────────────────────────── -->
  <table>
    <thead>
      <tr>
        <th class="text-center" style="width:32px">#</th>
        <th>Product</th>
        <th class="text-center" style="width:70px">HSN</th>
        <th class="text-center" style="width:44px">Qty</th>
        <th class="text-right" style="width:88px">Unit Price</th>
        <th class="text-right" style="width:100px">Discount</th>
        <th class="text-right" style="width:88px">Taxable</th>
        <th class="text-center" style="width:46px">GST%</th>
        <th class="text-right" style="width:78px">GST Amt</th>
        <th class="text-right" style="width:88px">Total</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <!-- ── Totals ─────────────────────────────────────────────────────────── -->
  <table class="totals-table">
    <tbody>
      <tr>
        <td style="color:#555">Subtotal</td>
        <td>${fmt(subtotal)}</td>
      </tr>
      ${discountTotal > 0 ? `
      <tr>
        <td style="color:#dc2626">Total Discount</td>
        <td style="color:#dc2626">−${fmt(discountTotal)}</td>
      </tr>` : ''}
      <tr>
        <td style="color:#555">CGST (${(gstTotal / subtotal * 50).toFixed(0)}%)</td>
        <td>${fmt(cgst)}</td>
      </tr>
      <tr>
        <td style="color:#555">SGST (${(gstTotal / subtotal * 50).toFixed(0)}%)</td>
        <td>${fmt(sgst)}</td>
      </tr>
      ${freightCharges > 0 ? `
      <tr>
        <td style="color:#555">Freight Charges</td>
        <td>${fmt(freightCharges)}</td>
      </tr>` : ''}
      ${cardSurcharge > 0 ? `
      <tr>
        <td style="color:#555">Card Surcharge (${cardSurchargePct}%)</td>
        <td>${fmt(cardSurcharge)}</td>
      </tr>` : ''}
      <tr class="grand-total-row">
        <td>Grand Total</td>
        <td id="grandTotalCell">${fmt(grandTotal)}</td>
      </tr>
    </tbody>
  </table>

  <!-- ── Footer ─────────────────────────────────────────────────────────── -->
  <div class="footer">
    <p>Thank you for your business — Jangid Brothers Furniture</p>
    <p style="margin-top:4px">This is a computer-generated invoice and does not require a signature.</p>
  </div>

  <script>
    // Show/hide fields based on payment mode
    function onModeChange() {
      const mode = document.getElementById('paymentModeSelect').value
      const refWrap = document.getElementById('paymentRef')
      const cardWrap = document.getElementById('cardSurchargeWrap')
      refWrap.style.display = (mode === 'UPI' || mode === 'Card' || mode === 'Bank Transfer') ? 'block' : 'none'
      cardWrap.style.display = (mode === 'Card') ? 'inline' : 'none'
    }
    // Init on load
    onModeChange()

    async function updatePayment() {
      const select = document.getElementById('paymentSelect')
      const btn = document.getElementById('updatePaymentBtn')
      const msg = document.getElementById('paymentMsg')
      btn.disabled = true; btn.textContent = '...'
      try {
        const res = await fetch('/api/invoices/${id}/payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: select.value }),
        })
        if (res.ok) {
          msg.style.display = 'inline'
          const colors = { 'Paid': '#059669', 'Partially Paid': '#2563eb', 'Pending': '#d97706' }
          const badge = document.getElementById('paymentBadge')
          if (badge) {
            badge.style.color = colors[select.value] || '#666'
            badge.style.borderColor = colors[select.value] || '#666'
            badge.textContent = select.value
          }
          setTimeout(() => { msg.style.display = 'none' }, 2500)
        } else {
          alert('Failed to update. Please try from the invoice page.')
        }
      } catch(e) { alert('Network error.') }
      btn.disabled = false; btn.textContent = 'Update'
    }

    async function savePaymentMode() {
      const mode = document.getElementById('paymentModeSelect').value
      const ref = document.getElementById('paymentRef').value
      const surcharge = parseFloat(document.getElementById('cardSurchargePct').value) || 0
      const btn = document.getElementById('saveModeBtn')
      btn.disabled = true; btn.textContent = '...'
      try {
        const res = await fetch('/api/invoices/${id}/payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payment_mode: mode, payment_reference: ref, card_surcharge_pct: surcharge }),
        })
        if (!res.ok) alert('Failed to save payment mode.')
      } catch(e) { alert('Network error.') }
      btn.disabled = false; btn.textContent = 'Save'
    }

    async function saveFreight() {
      const freight = parseFloat(document.getElementById('freightInput').value) || 0
      const btn = document.getElementById('saveFreightBtn')
      const msg = document.getElementById('freightMsg')
      btn.disabled = true; btn.textContent = '...'
      try {
        const res = await fetch('/api/invoices/${id}/payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ freight_charges: freight }),
        })
        if (res.ok) {
          msg.style.display = 'inline'
          setTimeout(() => { msg.style.display = 'none' }, 2500)
        } else {
          alert('Failed to save freight. Please try again.')
        }
      } catch(e) { alert('Network error.') }
      btn.disabled = false; btn.textContent = 'Save'
    }

    if (new URLSearchParams(window.location.search).get('print') === '1') {
      window.addEventListener('load', () => window.print())
    }
  </script>
</body>
</html>`

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-cache',
    },
  })
}
