'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowRight, Loader2, Send, FileText } from 'lucide-react'
import { updateQuotationStage, convertToInvoice } from '@/lib/actions/quotations'
import type { QuotationStage } from '@/lib/types/database'

interface Props {
  quotationId: string
  stage: QuotationStage
  userId: string
  createdBy: string
}

export function QuotationStageActions({ quotationId, stage, userId, createdBy }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)

  const isOwner = userId === createdBy

  async function handleSubmitForApproval() {
    setLoading('submit')
    const { error } = await updateQuotationStage(quotationId, 'Pending Approval')
    setLoading(null)
    if (error) { toast.error(error); return }
    toast.success('Quotation submitted for approval')
    router.refresh()
  }

  async function handleSend() {
    setLoading('send')
    const { error } = await updateQuotationStage(quotationId, 'Sent')
    setLoading(null)
    if (error) { toast.error(error); return }
    toast.success('Quotation marked as sent')
    router.refresh()
  }

  async function handleConvert() {
    setLoading('convert')
    const { data, error } = await convertToInvoice(quotationId)
    setLoading(null)
    if (error) { toast.error(error); return }
    toast.success('Converted to invoice successfully')
    router.push(`/invoices/${data!.id}`)
  }

  if (stage === 'Draft') {
    return (
      <div className="flex items-center gap-3 py-2">
        <button
          type="button"
          onClick={handleSubmitForApproval}
          disabled={loading !== null}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {loading === 'submit' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Submit for Approval
        </button>
        <button
          type="button"
          onClick={handleSend}
          disabled={loading !== null}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {loading === 'send' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Mark as Sent
        </button>
      </div>
    )
  }

  if (stage === 'Sent') {
    return (
      <div className="flex items-center gap-3 py-2">
        <button
          type="button"
          onClick={handleConvert}
          disabled={loading !== null}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {loading === 'convert' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ArrowRight className="w-4 h-4" />
          )}
          Convert to Invoice
        </button>
      </div>
    )
  }

  if (stage === 'Converted') {
    return (
      <div className="flex items-center gap-3 py-2">
        <Link
          href="/invoices"
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
        >
          <FileText className="w-4 h-4" />
          View Invoice
        </Link>
      </div>
    )
  }

  if (stage === 'Rejected' && isOwner) {
    return (
      <div className="py-2">
        <Link
          href="/quotations/new"
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors w-fit"
        >
          <FileText className="w-4 h-4" />
          Create New Quotation
        </Link>
      </div>
    )
  }

  return null
}
