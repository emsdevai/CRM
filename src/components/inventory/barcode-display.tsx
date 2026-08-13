'use client'

import { useEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Printer, AlertCircle, Barcode, QrCode } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BarcodeDisplayProps {
  value: string
  sku: string
  productName: string
  showPrintButton?: boolean
  className?: string
}

type DisplayMode = 'barcode' | 'qr'

export function BarcodeDisplay({
  value,
  sku,
  productName,
  showPrintButton = true,
  className,
}: BarcodeDisplayProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [mode, setMode] = useState<DisplayMode>('qr')

  // ── Render barcode whenever value changes ──────────────────────────────────
  useEffect(() => {
    if (!svgRef.current || !value || mode !== 'barcode') return

    let cancelled = false

    async function renderBarcode() {
      try {
        const JsBarcode = (await import('jsbarcode')).default

        if (cancelled || !svgRef.current) return

        const isEAN13Compatible = /^\d{12,13}$/.test(value.trim())
        const format = isEAN13Compatible ? 'EAN13' : 'CODE128'

        JsBarcode(svgRef.current, value, {
          format,
          width: 2,
          height: 80,
          displayValue: true,
          fontSize: 13,
          fontOptions: '500',
          margin: 10,
          background: '#ffffff',
          lineColor: '#18181b',
        })

        if (!cancelled) {
          setError(null)
          setReady(true)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to render barcode')
          setReady(false)
        }
      }
    }

    setReady(false)
    renderBarcode()
    return () => { cancelled = true }
  }, [value, mode])

  // QR mode is always ready (pure SVG, no async)
  useEffect(() => {
    if (mode === 'qr') {
      setError(null)
      setReady(true)
    }
  }, [mode])

  // ── Print handler ──────────────────────────────────────────────────────────
  function handlePrint() {
    const printWindow = window.open('', '_blank', 'width=420,height=340')
    if (!printWindow) return

    let codeBlock = ''

    if (mode === 'qr') {
      // Grab the rendered QR SVG from the DOM
      const qrEl = document.getElementById(`qr-${sku}`)
      codeBlock = qrEl
        ? `<div style="display:flex;justify-content:center;">${qrEl.outerHTML}</div>`
        : ''
    } else {
      const barcodeEl = svgRef.current
      codeBlock = barcodeEl
        ? `<div style="display:flex;justify-content:center;">${barcodeEl.outerHTML}</div>`
        : ''
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <title>${mode === 'qr' ? 'QR Code' : 'Barcode'} – ${sku}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              font-family: ui-sans-serif, system-ui, sans-serif;
              background: #fff;
              padding: 24px;
              gap: 10px;
            }
            .product-name {
              font-size: 14px;
              font-weight: 700;
              color: #18181b;
              text-align: center;
              max-width: 280px;
            }
            .sku {
              font-size: 12px;
              color: #71717a;
              letter-spacing: 0.06em;
              text-transform: uppercase;
            }
            svg { display: block; max-width: 100%; }
            @media print { @page { margin: 0.5cm; } }
          </style>
        </head>
        <body>
          <p class="product-name">${productName}</p>
          ${codeBlock}
          <p class="sku">SKU: ${sku}</p>
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
      printWindow.close()
    }, 400)
  }

  return (
    <div className={cn('flex flex-col items-center gap-4', className)}>

      {/* ── Mode toggle ─────────────────────────────────────────────────── */}
      <div className="inline-flex rounded-lg border border-zinc-200 bg-zinc-100 p-1 gap-1">
        <button
          type="button"
          onClick={() => setMode('qr')}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
            mode === 'qr'
              ? 'bg-white text-zinc-900 shadow-sm'
              : 'text-zinc-500 hover:text-zinc-700',
          )}
        >
          <QrCode className="w-3.5 h-3.5" />
          QR Code
        </button>
        <button
          type="button"
          onClick={() => setMode('barcode')}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
            mode === 'barcode'
              ? 'bg-white text-zinc-900 shadow-sm'
              : 'text-zinc-500 hover:text-zinc-700',
          )}
        >
          <Barcode className="w-3.5 h-3.5" />
          Barcode
        </button>
      </div>

      {/* ── Code display ─────────────────────────────────────────────────── */}
      {error ? (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>Error: {error}</span>
        </div>
      ) : mode === 'qr' ? (
        <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm flex flex-col items-center gap-3">
          <QRCodeSVG
            id={`qr-${sku}`}
            value={value}
            size={180}
            level="M"
            includeMargin={false}
            bgColor="#ffffff"
            fgColor="#18181b"
          />
          <div className="text-center">
            <p className="text-xs font-semibold text-zinc-700 truncate max-w-[180px]">{productName}</p>
            <p className="text-xs font-mono text-zinc-400 mt-0.5">SKU: {sku}</p>
          </div>
        </div>
      ) : (
        <div className="inline-block bg-white border border-zinc-200 rounded-xl p-4 shadow-sm">
          <svg
            ref={svgRef}
            id={`barcode-${sku}`}
            aria-label={`Barcode for ${productName}`}
          />
        </div>
      )}

      {/* ── Print button ─────────────────────────────────────────────────── */}
      {showPrintButton && ready && !error && (
        <button
          type="button"
          onClick={handlePrint}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 active:bg-blue-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2"
        >
          <Printer className="w-4 h-4" />
          Print {mode === 'qr' ? 'QR Code' : 'Barcode'}
        </button>
      )}
    </div>
  )
}
