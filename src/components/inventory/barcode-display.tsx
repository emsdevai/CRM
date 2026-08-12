'use client'

import { useEffect, useRef, useState } from 'react'
import { Printer, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BarcodeDisplayProps {
  value: string
  sku: string
  productName: string
  showPrintButton?: boolean
  className?: string
}

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

  useEffect(() => {
    if (!svgRef.current || !value) return

    let cancelled = false

    async function renderBarcode() {
      try {
        const JsBarcode = (await import('jsbarcode')).default

        if (cancelled || !svgRef.current) return

        // Try EAN13 first (requires 12 or 13 numeric digits)
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

    renderBarcode()

    return () => {
      cancelled = true
    }
  }, [value])

  function handlePrint() {
    const printWindow = window.open('', '_blank', 'width=400,height=300')
    if (!printWindow) return

    const svgEl = svgRef.current
    const svgContent = svgEl ? svgEl.outerHTML : ''

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <title>Barcode – ${sku}</title>
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
            }
            .product-name {
              font-size: 13px;
              font-weight: 600;
              color: #18181b;
              text-align: center;
              max-width: 260px;
              margin-bottom: 8px;
            }
            .sku {
              font-size: 11px;
              color: #71717a;
              margin-top: 4px;
              letter-spacing: 0.05em;
            }
            svg { display: block; max-width: 100%; }
            @media print {
              @page { margin: 0.5cm; }
            }
          </style>
        </head>
        <body>
          <p class="product-name">${productName}</p>
          ${svgContent}
          <p class="sku">SKU: ${sku}</p>
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
      printWindow.close()
    }, 300)
  }

  return (
    <div className={cn('flex flex-col items-center gap-4', className)}>
      {error ? (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>Barcode error: {error}</span>
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

      {showPrintButton && !error && ready && (
        <button
          type="button"
          onClick={handlePrint}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 active:bg-zinc-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700 focus-visible:ring-offset-2"
        >
          <Printer className="w-4 h-4" />
          Print Barcode
        </button>
      )}
    </div>
  )
}
