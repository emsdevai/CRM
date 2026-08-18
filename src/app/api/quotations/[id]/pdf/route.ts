import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const { data: quotation, error } = await supabase
    .from('quotations')
    .select(
      `*,
      items:quotation_items(*, product:products(id, hsn_code)),
      lead:leads(id, name, phone, email, city, state, address),
      customer:customers(id, name, phone, email, address, city, state, gst_number, pincode),
      creator:profiles!quotations_created_by_fkey(id, name, phone)`,
    )
    .eq('id', id)
    .single()

  if (error || !quotation) return new NextResponse('Not found', { status: 404 })

  const fmt = (v: number | null) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v ?? 0)

  const fmtDate = (d: string) =>
    new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(d))

  type QItem = {
    name: string | null
    sku: string | null
    qty: number | null
    unit_price: number | null
    discount_pct: number | null
    gst_pct: number | null
    line_total: number | null
    image_url?: string | null
    product?: { id: string; hsn_code: string | null } | null
  }

  type Party = {
    name: string
    phone?: string | null
    email?: string | null
    address?: string | null
    city?: string | null
    state?: string | null
    gst_number?: string | null
    pincode?: string | null
  }

  const items: QItem[] = (quotation.items as QItem[]) ?? []
  const recipient = (quotation.customer as Party | null) ?? (quotation.lead as Party | null)
  const creator = quotation.creator as { name: string | null; phone?: string | null } | null

  const subtotal: number = (quotation.subtotal as number) ?? 0
  const discountTotal: number = (quotation.discount_total as number) ?? 0
  const gstTotal: number = (quotation.gst_total as number) ?? 0
  const grandTotal: number = (quotation.grand_total as number) ?? 0
  const cgst = gstTotal / 2
  const sgst = gstTotal / 2

  const itemRows = items.map((item, idx) => {
    const lineBase = (item.qty ?? 0) * (item.unit_price ?? 0)
    const lineDiscount = lineBase * ((item.discount_pct ?? 0) / 100)
    const taxable = lineBase - lineDiscount
    const gstAmt = taxable * ((item.gst_pct ?? 0) / 100)
    const hsnCode = item.product?.hsn_code ?? ''

    return `
    <tr>
      <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;font-size:12px;color:#888;text-align:center">${idx + 1}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0">
        <div style="display:flex;align-items:center;gap:10px">
          ${item.image_url
            ? `<img src="${item.image_url}" alt="" style="width:60px;height:60px;object-fit:cover;border-radius:6px;border:1px solid #e8e8e8;flex-shrink:0" />`
            : `<div style="width:60px;height:60px;border-radius:6px;background:#f5f5f5;border:1px solid #e8e8e8;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:9px;color:#ccc">IMG</div>`
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
  }).join('')

  const recipientHtml = recipient
    ? `<div style="font-size:15px;font-weight:700;color:#111">${recipient.name}</div>
       ${recipient.phone ? `<div style="font-size:12px;color:#555;margin-top:3px">📞 ${recipient.phone}</div>` : ''}
       ${recipient.email ? `<div style="font-size:12px;color:#555;margin-top:2px">✉ ${recipient.email}</div>` : ''}
       ${(recipient as any).gst_number ? `<div style="font-size:12px;color:#555;margin-top:2px">GSTIN: ${(recipient as any).gst_number}</div>` : ''}
       ${recipient.address ? `<div style="font-size:12px;color:#555;margin-top:2px">${recipient.address}</div>` : ''}
       ${(recipient.city || recipient.state || (recipient as any).pincode) ? `<div style="font-size:12px;color:#555;margin-top:2px">${[recipient.city, recipient.state, (recipient as any).pincode].filter(Boolean).join(', ')}</div>` : ''}`
    : '<div style="font-size:12px;color:#aaa">—</div>'

  const stageColors: Record<string, string> = {
    Draft: '#888',
    Sent: '#2563eb',
    Approved: '#059669',
    Rejected: '#dc2626',
    Converted: '#7c3aed',
  }
  const stageColor = stageColors[quotation.stage as string] ?? '#888'

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Quotation ${id.slice(0, 8).toUpperCase()}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; color:#111; background:#fff; padding:32px; font-size:14px; line-height:1.5; }
    .header { display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:20px; border-bottom:2.5px solid #111; margin-bottom:20px; }
    .company-name { font-size:22px; font-weight:800; color:#111; letter-spacing:-0.5px; }
    .company-tagline { font-size:11px; color:#888; margin-top:2px; }
    .quot-badge { display:inline-block; background:#2563eb; color:#fff; font-size:10px; font-weight:700; letter-spacing:2px; text-transform:uppercase; padding:4px 12px; border-radius:20px; margin-bottom:6px; }
    .quot-number { font-size:16px; font-weight:700; color:#111; }
    .billing-section { display:grid; grid-template-columns:1fr 1fr; gap:24px; margin-bottom:20px; padding:16px; background:#fafafa; border-radius:10px; border:1px solid #eee; }
    .section-label { font-size:9px; font-weight:700; color:#999; text-transform:uppercase; letter-spacing:1.5px; margin-bottom:6px; }
    table { width:100%; border-collapse:collapse; }
    thead tr { background:#f5f5f5; }
    thead th { padding:9px 10px; text-align:left; font-size:10px; font-weight:700; color:#666; text-transform:uppercase; letter-spacing:0.5px; border-bottom:2px solid #e0e0e0; }
    thead th.text-right { text-align:right; }
    thead th.text-center { text-align:center; }
    .totals-table { margin-left:auto; width:280px; margin-top:16px; }
    .totals-table td { padding:4px 0; font-size:13px; }
    .totals-table td:last-child { text-align:right; font-weight:500; }
    .grand-total-row td { font-size:17px; font-weight:800; padding-top:10px; border-top:2.5px solid #111; }
    .footer { margin-top:36px; padding-top:14px; border-top:1px solid #eee; text-align:center; font-size:11px; color:#bbb; }
    .validity-box { background:#fffbeb; border:1px solid #fde68a; border-radius:8px; padding:10px 14px; margin-bottom:16px; font-size:12px; color:#92400e; }
    .qr-wrap img, .qr-wrap canvas { display:block !important; }
    * { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    @media print { body { padding:16px; } .no-print { display:none!important; } @page { margin:1cm; size:A4; } }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
</head>
<body>

  <div class="no-print" style="display:flex;justify-content:flex-end;margin-bottom:16px">
    <button onclick="window.print()" style="padding:8px 20px;background:#111;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">
      Print / Save PDF
    </button>
  </div>

  <div class="header">
    <div>
      <div class="company-name">Jangid Brothers</div>
      <div class="company-tagline">Complete Furniture Retail</div>
      ${(quotation as any).title ? `<div style="font-size:14px;font-weight:600;color:#333;margin-top:6px">${(quotation as any).title}</div>` : ''}
    </div>
    <div style="text-align:right;display:flex;align-items:flex-start;gap:16px">
      <div>
        <div class="quot-badge">Quotation</div>
        <div class="quot-number">${id.slice(0, 8).toUpperCase()}</div>
        <div style="font-size:12px;color:#666">Date: ${fmtDate(quotation.created_at)}</div>
        <div style="margin-top:4px">
          <span style="font-size:12px;font-weight:700;color:${stageColor};border:1.5px solid ${stageColor};border-radius:12px;padding:2px 10px">${quotation.stage}</span>
        </div>
      </div>
      <div class="qr-wrap" id="qrcode" style="width:72px;height:72px;flex-shrink:0"></div>
    </div>
  </div>

  <div class="billing-section">
    <div>
      <div class="section-label">Quotation For</div>
      ${recipientHtml}
    </div>
    <div>
      <div class="section-label">Prepared By</div>
      ${creator ? `<div style="font-size:14px;font-weight:600;color:#111">${creator.name ?? 'Unknown'}</div>${creator.phone ? `<div style="font-size:12px;color:#555;margin-top:2px">📞 ${creator.phone}</div>` : ''}` : '<div style="font-size:12px;color:#aaa">—</div>'}
    </div>
  </div>

  <div class="validity-box">
    ⚠️ This quotation is valid for 7 days from the date of issue. Prices are subject to change.
  </div>

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

  <table class="totals-table">
    <tbody>
      <tr>
        <td style="color:#555">Subtotal</td>
        <td>${fmt(subtotal)}</td>
      </tr>
      ${discountTotal > 0 ? `<tr><td style="color:#dc2626">Total Discount</td><td style="color:#dc2626">−${fmt(discountTotal)}</td></tr>` : ''}
      <tr><td style="color:#555">CGST</td><td>${fmt(cgst)}</td></tr>
      <tr><td style="color:#555">SGST</td><td>${fmt(sgst)}</td></tr>
      <tr class="grand-total-row"><td>Grand Total</td><td>${fmt(grandTotal)}</td></tr>
    </tbody>
  </table>

  ${quotation.notes ? `<div style="margin-top:24px;padding:12px 16px;background:#f8f8f8;border-radius:8px;font-size:13px;color:#555"><strong>Notes:</strong> ${quotation.notes}</div>` : ''}

  <div class="footer">
    <p>This is an estimate — final invoice will be raised upon order confirmation.</p>
    <p style="margin-top:4px">Jangid Brothers Furniture · Thank you for your interest</p>
  </div>

  <script>
    // Generate QR code with quotation details
    try {
      new QRCode(document.getElementById('qrcode'), {
        text: 'QUOT:${id.slice(0, 8).toUpperCase()}|CUST:${(recipient?.name ?? '').replace(/[|]/g, '')}|AMT:${grandTotal.toFixed(0)}|DT:${quotation.created_at.slice(0, 10)}',
        width: 72, height: 72, correctLevel: QRCode.CorrectLevel.M,
      })
    } catch(e) {}

    if (new URLSearchParams(window.location.search).get('print') === '1') {
      window.addEventListener('load', () => window.print())
    }
  </script>
</body>
</html>`

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-cache' },
  })
}
