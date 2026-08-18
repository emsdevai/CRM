import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getQuotationById } from '@/lib/actions/quotations'
import { PageHeader } from '@/components/shared/page-header'
import { QuotationEditForm } from '@/components/quotations/quotation-edit-form'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function QuotationEditPage({ params }: PageProps) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role ?? 'salesperson'

  const { data: quotation, error } = await getQuotationById(id)
  if (error || !quotation) notFound()

  const shortId = quotation.id.slice(0, 8).toUpperCase()

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader
        title={`Edit Quotation #${shortId}`}
        breadcrumb={[
          { label: 'Quotations', href: '/quotations' },
          { label: `#${shortId}`, href: `/quotations/${id}` },
          { label: 'Edit' },
        ]}
      />

      <QuotationEditForm
        quotationId={id}
        initialTitle={(quotation as any).title ?? ''}
        initialNotes={quotation.notes ?? ''}
        initialStage={quotation.stage}
        isAdmin={role === 'admin'}
      />
    </div>
  )
}
