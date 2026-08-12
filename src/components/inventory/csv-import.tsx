'use client'

import { useRef, useState } from 'react'
import {
  Upload,
  FileText,
  AlertCircle,
  CheckCircle,
  Loader2,
  X,
} from 'lucide-react'
import Papa from 'papaparse'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { bulkImportProducts, type BulkImportRow } from '@/lib/actions/inventory'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ValidationError {
  row: number
  field: string
  message: string
}

interface ImportState {
  phase: 'idle' | 'preview' | 'importing' | 'done'
  rows: BulkImportRow[]
  errors: ValidationError[]
  imported: number
  serverErrors: { row: number; message: string }[]
}

interface CsvImportProps {
  onComplete: (count: number) => void
}

// ---------------------------------------------------------------------------
// Required columns
// ---------------------------------------------------------------------------
const REQUIRED_COLS = ['name', 'sku', 'price'] as const
const OPTIONAL_COLS = [
  'category',
  'subcategory',
  'family',
  'type',
  'cost',
  'gst_pct',
  'stock',
  'reorder_level',
  'description',
] as const

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
function validateRow(
  rawRow: Record<string, string>,
  rowIndex: number,
): { row: BulkImportRow | null; errors: ValidationError[] } {
  const errors: ValidationError[] = []

  const name = rawRow.name?.trim()
  const sku = rawRow.sku?.trim()
  const priceStr = rawRow.price?.trim()

  if (!name) {
    errors.push({ row: rowIndex, field: 'name', message: 'Name is required' })
  }
  if (!sku) {
    errors.push({ row: rowIndex, field: 'sku', message: 'SKU is required' })
  }

  const price = parseFloat(priceStr)
  if (!priceStr || isNaN(price) || price <= 0) {
    errors.push({ row: rowIndex, field: 'price', message: 'Valid price required (> 0)' })
  }

  if (errors.length > 0) return { row: null, errors }

  const row: BulkImportRow = {
    name,
    sku,
    price,
    category: rawRow.category?.trim() || undefined,
    subcategory: rawRow.subcategory?.trim() || undefined,
    family: rawRow.family?.trim() || undefined,
    type: rawRow.type?.trim() || undefined,
    cost: rawRow.cost ? parseFloat(rawRow.cost) : undefined,
    gst_pct: rawRow.gst_pct ? parseFloat(rawRow.gst_pct) : 18,
    stock: rawRow.stock !== undefined ? parseInt(rawRow.stock, 10) : 0,
    reorder_level: rawRow.reorder_level !== undefined
      ? parseInt(rawRow.reorder_level, 10)
      : 5,
    description: rawRow.description?.trim() || undefined,
  }

  return { row, errors: [] }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function CsvImport({ onComplete }: CsvImportProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [state, setState] = useState<ImportState>({
    phase: 'idle',
    rows: [],
    errors: [],
    imported: 0,
    serverErrors: [],
  })

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      toast.error('Please select a CSV file (.csv)')
      return
    }

    setFileName(file.name)

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        // Check required headers
        const headers = results.meta.fields ?? []
        const missingCols = REQUIRED_COLS.filter(
          (col) => !headers.includes(col),
        )
        if (missingCols.length > 0) {
          toast.error(`Missing required columns: ${missingCols.join(', ')}`)
          setState((prev) => ({ ...prev, phase: 'idle', rows: [], errors: [] }))
          return
        }

        const validRows: BulkImportRow[] = []
        const allErrors: ValidationError[] = []

        results.data.forEach((rawRow, i) => {
          const { row, errors } = validateRow(rawRow, i + 1)
          if (row) validRows.push(row)
          allErrors.push(...errors)
        })

        setState({
          phase: 'preview',
          rows: validRows,
          errors: allErrors,
          imported: 0,
          serverErrors: [],
        })
      },
      error(err) {
        toast.error(`CSV parse error: ${err.message}`)
      },
    })
  }

  function handleReset() {
    setState({
      phase: 'idle',
      rows: [],
      errors: [],
      imported: 0,
      serverErrors: [],
    })
    setFileName(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleImport() {
    if (state.rows.length === 0) return

    setState((prev) => ({ ...prev, phase: 'importing' }))

    const result = await bulkImportProducts(state.rows)

    if (result.error) {
      toast.error(result.error)
      setState((prev) => ({ ...prev, phase: 'preview' }))
      return
    }

    setState((prev) => ({
      ...prev,
      phase: 'done',
      imported: result.imported,
      serverErrors: result.errors,
    }))

    if (result.imported > 0) {
      toast.success(`Imported ${result.imported} product${result.imported !== 1 ? 's' : ''} successfully`)
      onComplete(result.imported)
    }
  }

  // ── Preview table (first 5 rows) ─────────────────────────────────────────
  const previewRows = state.rows.slice(0, 5)

  return (
    <div className="space-y-4">
      {/* ── File picker ──────────────────────────────────────────────────── */}
      {state.phase === 'idle' && (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            className="hidden"
            id="csv-file-input"
          />

          <label
            htmlFor="csv-file-input"
            className={cn(
              'flex flex-col items-center justify-center gap-3',
              'border-2 border-dashed border-zinc-300 rounded-xl p-10',
              'cursor-pointer hover:border-green-600 hover:bg-green-50/50',
              'transition-colors text-center',
            )}
          >
            <div className="w-12 h-12 rounded-xl bg-zinc-100 flex items-center justify-center">
              <Upload className="w-6 h-6 text-zinc-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-900">
                Click to upload a CSV file
              </p>
              <p className="text-xs text-zinc-500 mt-0.5">
                Required columns: name, sku, price
              </p>
            </div>
          </label>

          {/* Column reference */}
          <div className="mt-3 rounded-lg bg-zinc-50 border border-zinc-200 p-3">
            <p className="text-xs font-semibold text-zinc-600 mb-1">
              Expected columns:
            </p>
            <p className="text-xs text-zinc-500 leading-relaxed font-mono">
              {[...REQUIRED_COLS, ...OPTIONAL_COLS].join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* ── Preview + validation ──────────────────────────────────────────── */}
      {(state.phase === 'preview' || state.phase === 'importing') && (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-zinc-500" />
              <span className="text-sm font-medium text-zinc-700">{fileName}</span>
            </div>
            <button
              type="button"
              onClick={handleReset}
              disabled={state.phase === 'importing'}
              className="p-1 rounded text-zinc-400 hover:text-zinc-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 text-sm">
            <span className="text-zinc-600">
              <span className="font-semibold text-zinc-900">{state.rows.length}</span>{' '}
              valid row{state.rows.length !== 1 ? 's' : ''}
            </span>
            {state.errors.length > 0 && (
              <span className="text-amber-700">
                <span className="font-semibold">{state.errors.length}</span> error
                {state.errors.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Validation errors */}
          {state.errors.length > 0 && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 max-h-32 overflow-y-auto">
              <div className="flex items-center gap-1.5 mb-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <p className="text-xs font-semibold text-amber-700">
                  Validation errors (rows with errors will be skipped):
                </p>
              </div>
              <ul className="space-y-0.5">
                {state.errors.slice(0, 10).map((err, i) => (
                  <li key={i} className="text-xs text-amber-700">
                    Row {err.row}, {err.field}: {err.message}
                  </li>
                ))}
                {state.errors.length > 10 && (
                  <li className="text-xs text-amber-600">
                    …and {state.errors.length - 10} more errors
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* Preview table */}
          {previewRows.length > 0 && (
            <div>
              <p className="text-xs font-medium text-zinc-500 mb-1.5">
                Preview (first {previewRows.length} of {state.rows.length} rows):
              </p>
              <div className="overflow-x-auto rounded-lg border border-zinc-200">
                <table className="w-full text-xs">
                  <thead className="bg-zinc-50 border-b border-zinc-200">
                    <tr>
                      {['Name', 'SKU', 'Category', 'Price', 'Stock', 'GST%'].map(
                        (col) => (
                          <th
                            key={col}
                            className="px-3 py-2 text-left font-semibold text-zinc-600 whitespace-nowrap"
                          >
                            {col}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {previewRows.map((row, i) => (
                      <tr key={i} className="hover:bg-zinc-50">
                        <td className="px-3 py-2 text-zinc-900 max-w-[160px] truncate">
                          {row.name}
                        </td>
                        <td className="px-3 py-2 text-zinc-600 font-mono">
                          {row.sku}
                        </td>
                        <td className="px-3 py-2 text-zinc-600">
                          {row.category ?? '—'}
                        </td>
                        <td className="px-3 py-2 text-zinc-900">
                          ₹{row.price.toLocaleString('en-IN')}
                        </td>
                        <td className="px-3 py-2 text-zinc-600">
                          {row.stock ?? 0}
                        </td>
                        <td className="px-3 py-2 text-zinc-600">
                          {row.gst_pct ?? 18}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {state.rows.length > 5 && (
                <p className="mt-1 text-xs text-zinc-400">
                  + {state.rows.length - 5} more rows
                </p>
              )}
            </div>
          )}

          {/* Import button */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-zinc-100">
            <button
              type="button"
              onClick={handleReset}
              disabled={state.phase === 'importing'}
              className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 transition-colors disabled:opacity-50"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={state.rows.length === 0 || state.phase === 'importing'}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-green-700 hover:bg-green-800 active:bg-green-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {state.phase === 'importing' && (
                <Loader2 className="w-4 h-4 animate-spin" />
              )}
              Import {state.rows.length} Product{state.rows.length !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      )}

      {/* ── Done ─────────────────────────────────────────────────────────── */}
      {state.phase === 'done' && (
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center">
              <CheckCircle className="w-7 h-7 text-emerald-600" />
            </div>
            <div>
              <p className="text-base font-semibold text-zinc-900">
                Import Complete
              </p>
              <p className="text-sm text-zinc-500 mt-0.5">
                {state.imported} product{state.imported !== 1 ? 's' : ''} imported
                successfully
              </p>
            </div>
          </div>

          {state.serverErrors.length > 0 && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
              <p className="text-xs font-semibold text-amber-700 mb-1">
                {state.serverErrors.length} row{state.serverErrors.length !== 1 ? 's' : ''} skipped:
              </p>
              <ul className="space-y-0.5">
                {state.serverErrors.slice(0, 5).map((err, i) => (
                  <li key={i} className="text-xs text-amber-700">
                    Row {err.row}: {err.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 transition-colors"
            >
              Import Another File
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
