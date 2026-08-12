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

  // Fetch invoice with items + customer
  const { data: invoice, error } = await supabase
    .from('invoices')
    .select(
      `
      *,
      items:invoice_items(*),
      customer:customers(id, name, phone, email, address, city, state),
      salesperson:profiles!invoices_salesperson_id_fkey(id, name, phone)
      `,
    )
    .eq('id', id)
    .single()

  if (error || !invoice) {
    return new NextResponse('Invoice not found', { status: 404 })
  }

  const formatCurrencyHtml = (v: number | null) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(v ?? 0)

  const formatDateHtml = (d: string) =>
    new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(d))

  type InvoiceItem = {
    id: string
    name: string | null
    sku: string | null
    qty: number | null
    unit_price: number | null
    discount_pct: number | null
    gst_pct: number | null
    line_total: number | null
    image_url: string | null
  }

  const items: InvoiceItem[] = (invoice.items as InvoiceItem[]) ?? []
  const cgst = ((invoice.gst_total as number) ?? 0) / 2
  const sgst = cgst

  type Customer = {
    name: string
    phone?: string | null
    email?: string | null
    address?: string | null
    city?: string | null
    state?: string | null
  }
  type Salesperson = { name: string | null; phone?: string | null }

  const customer = invoice.customer as Customer | null
  const salesperson = invoice.salesperson as Salesperson | null

  const itemRows = items
    .map((item, idx) => {
      const lineBase = (item.qty ?? 0) * (item.unit_price ?? 0)
      const lineDiscount = lineBase * ((item.discount_pct ?? 0) / 100)
      const taxable = lineBase - lineDiscount
      const gstAmt = taxable * ((item.gst_pct ?? 0) / 100)

      return `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:12px;color:#666">${idx + 1}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0">
          <div style="font-size:13px;font-weight:500;color:#111">${item.name ?? '—'}</div>
          ${item.sku ? `<div style="font-size:11px;color:#888;font-family:monospace">${item.sku}</div>` : ''}
        </td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right;font-size:13px">${item.qty ?? 0}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right;font-size:13px">${formatCurrencyHtml(item.unit_price)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right;font-size:13px;color:${(item.discount_pct ?? 0) > 0 ? '#dc2626' : '#aaa'}">
          ${(item.discount_pct ?? 0) > 0 ? `−${formatCurrencyHtml(lineDiscount)} <span style="font-size:10px;color:#aaa">(${item.discount_pct}%)</span>` : '—'}
        </td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right;font-size:13px">${formatCurrencyHtml(taxable)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right;font-size:13px;color:#666">${item.gst_pct ?? 0}%</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right;font-size:13px">${formatCurrencyHtml(gstAmt)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right;font-size:13px;font-weight:600">${formatCurrencyHtml(item.line_total)}</td>
      </tr>`
    })
    .join('')

  const paymentStatusColor = {
    Paid: '#059669',
    'Partially Paid': '#2563eb',
    Pending: '#d97706',
  }[invoice.payment_status as string] ?? '#666'

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
      padding: 40px;
      font-size: 14px;
      line-height: 1.5;
    }
    .invoice-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 24px;
      border-bottom: 2px solid #111;
      margin-bottom: 24px;
    }
    .company-name { font-size: 22px; font-weight: 800; color: #111; letter-spacing: -0.5px; }
    .company-tagline { font-size: 12px; color: #666; margin-top: 2px; }
    .invoice-label {
      display: inline-block;
      background: #111;
      color: #fff;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 2px;
      text-transform: uppercase;
      padding: 4px 12px;
      border-radius: 20px;
      margin-bottom: 6px;
    }
    .invoice-number { font-size: 16px; font-weight: 700; color: #111; }
    .invoice-date { font-size: 13px; color: #555; }
    .billing-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-bottom: 24px;
    }
    .section-label {
      font-size: 10px;
      font-weight: 700;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 6px;
    }
    .billed-name { font-size: 15px; font-weight: 600; color: #111; }
    .billed-detail { font-size: 12px; color: #555; margin-top: 2px; }
    .payment-status {
      display: inline-block;
      padding: 6px 16px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 700;
      border: 2px solid;
      margin-bottom: 20px;
    }
    table { width: 100%; border-collapse: collapse; }
    thead tr { background: #f8f8f8; }
    thead th {
      padding: 10px 12px;
      text-align: left;
      font-size: 11px;
      font-weight: 600;
      color: #555;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 2px solid #e8e8e8;
    }
    thead th.text-right { text-align: right; }
    .totals-table { margin-left: auto; width: 260px; margin-top: 16px; }
    .totals-table td { padding: 5px 0; font-size: 13px; }
    .totals-table td:last-child { text-align: right; font-weight: 500; }
    .grand-total-row td {
      font-size: 18px;
      font-weight: 800;
      padding-top: 12px;
      border-top: 2px solid #111;
    }
    .footer {
      margin-top: 40px;
      padding-top: 16px;
      border-top: 1px solid #eee;
      text-align: center;
      font-size: 11px;
      color: #aaa;
    }
    @media print {
      body { padding: 20px; }
      .no-print { display: none; }
      @page { margin: 1cm; size: A4; }
    }
  </style>
</head>
<body>
  <!-- Print button (hidden in print) -->
  <div class="no-print" style="text-align:right;margin-bottom:20px">
    <button
      onclick="window.print()"
      style="padding:8px 20px;background:#111;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer"
    >
      Print / Save as PDF
    </button>
  </div>

  <!-- Invoice Header -->
  <div class="invoice-header">
    <div>
      <div class="company-name">Jangir Brothers</div>
      <div class="company-tagline">Complete Furniture Retail</div>
    </div>
    <div style="text-align:right">
      <div class="invoice-label">Tax Invoice</div>
      <div class="invoice-number">${invoice.invoice_no}</div>
      <div class="invoice-date">Date: ${formatDateHtml(invoice.invoice_date)}</div>
    </div>
  </div>

  <!-- Billing section -->
  <div class="billing-section">
    <div>
      <div class="section-label">Billed To</div>
      ${
        customer
          ? `
        <div class="billed-name">${customer.name}</div>
        ${customer.phone ? `<div class="billed-detail">📞 ${customer.phone}</div>` : ''}
        ${customer.email ? `<div class="billed-detail">✉ ${customer.email}</div>` : ''}
        ${customer.address ? `<div class="billed-detail">${customer.address}</div>` : ''}
        ${customer.city || customer.state ? `<div class="billed-detail">${[customer.city, customer.state].filter(Boolean).join(', ')}</div>` : ''}
      `
          : '<div class="billed-detail">—</div>'
      }
    </div>
    <div>
      <div class="section-label">Sold By</div>
      ${salesperson ? `<div class="billed-name">${salesperson.name ?? 'Unknown'}</div>${salesperson.phone ? `<div class="billed-detail">📞 ${salesperson.phone}</div>` : ''}` : '<div class="billed-detail">—</div>'}
    </div>
  </div>

  <!-- Payment Status -->
  <div>
    <span class="payment-status" style="color:${paymentStatusColor};border-color:${paymentStatusColor}">
      ${invoice.payment_status}
    </span>
  </div>

  <!-- Line Items -->
  <table>
    <thead>
      <tr>
        <th style="width:36px">#</th>
        <th>Product</th>
        <th class="text-right" style="width:50px">Qty</th>
        <th class="text-right" style="width:90px">Unit Price</th>
        <th class="text-right" style="width:110px">Discount</th>
        <th class="text-right" style="width:90px">Taxable</th>
        <th class="text-right" style="width:50px">GST%</th>
        <th class="text-right" style="width:80px">GST Amt</th>
        <th class="text-right" style="width:90px">Total</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <!-- Totals -->
  <table class="totals-table">
    <tbody>
      <tr>
        <td style="color:#555">Subtotal</td>
        <td>${formatCurrencyHtml(invoice.subtotal as number)}</td>
      </tr>
      ${(invoice.discount_total as number) > 0 ? `
      <tr>
        <td style="color:#dc2626">Total Discount</td>
        <td style="color:#dc2626">−${formatCurrencyHtml(invoice.discount_total as number)}</td>
      </tr>` : ''}
      <tr>
        <td style="color:#555">CGST (9%)</td>
        <td>${formatCurrencyHtml(cgst)}</td>
      </tr>
      <tr>
        <td style="color:#555">SGST (9%)</td>
        <td>${formatCurrencyHtml(sgst)}</td>
      </tr>
      <tr class="grand-total-row">
        <td>Grand Total</td>
        <td>${formatCurrencyHtml(invoice.grand_total as number)}</td>
      </tr>
    </tbody>
  </table>

  <!-- Footer -->
  <div class="footer">
    <p>Thank you for your business — Jangir Brothers Furniture</p>
    <p style="margin-top:4px">This is a computer-generated invoice and does not require a signature.</p>
  </div>

  <script>
    // Auto-print on load if ?print=1 is in the URL
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
