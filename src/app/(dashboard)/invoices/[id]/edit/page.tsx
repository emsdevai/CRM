import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getInvoiceById } from '@/lib/actions/invoices'
import { PageHeader } from '@/components/shared/page-header'
import { InvoiceEditForm } from '@/components/invoices/invoice-edit-form'
import type { InvoiceItem } from '@/lib/types/database'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function InvoiceEditPage({ params }: PageProps) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect(`/invoices/${id}`)

  const { data: invoice, error } = await getInvoiceById(id)
  if (error || !invoice) notFound()

  const customer = invoice.customer as { id: string; name: string } | null

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader
        title={`Edit Invoice ${invoice.invoice_no}`}
        breadcrumb={[
          { label: 'Invoices', href: '/invoices' },
          { label: invoice.invoice_no, href: `/invoices/${id}` },
          { label: 'Edit' },
        ]}
      />

      <InvoiceEditForm
        invoiceId={id}
        invoiceNo={invoice.invoice_no}
        initialDate={invoice.invoice_date}
        initialCustomerId={customer?.id ?? null}
        initialCustomerName={customer?.name ?? null}
        initialPaymentMethod={(invoice as any).payment_method ?? null}
        initialPaymentCardType={(invoice as any).payment_card_type ?? null}
        initialCardSurchargePct={(invoice as any).card_surcharge_pct ?? 0}
        initialPaymentReference={(invoice as any).payment_reference ?? null}
        initialPaymentMeta={(invoice as any).payment_meta ?? {}}
        initialItems={(invoice.items as InvoiceItem[]) ?? []}
      />
    </div>
  )
}
