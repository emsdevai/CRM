'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PageHeader } from '@/components/shared/page-header'
import { LoadingSpinner } from '@/components/shared/loading-spinner'
import QuotationBuilder from '@/components/quotations/quotation-builder'
import { useUser } from '@/hooks/use-user'
import { getDiscountRule } from '@/lib/actions/quotations'

interface DiscountRule {
  min_pct: number
  max_pct: number
  requires_approval_above: number
}

export default function NewQuotationPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { profile, loading: userLoading } = useUser()

  const leadId = searchParams.get('leadId') ?? undefined
  const customerId = searchParams.get('customerId') ?? undefined

  const [discountRule, setDiscountRule] = useState<DiscountRule | null>(null)
  const [ruleLoading, setRuleLoading] = useState(true)

  useEffect(() => {
    if (!profile?.role) return
    let mounted = true
    setRuleLoading(true)
    getDiscountRule(profile.role).then((rule) => {
      if (mounted) {
        setDiscountRule({
          min_pct: rule.min_pct ?? 0,
          max_pct: rule.max_pct ?? 10,
          requires_approval_above: rule.requires_approval_above ?? 100,
        })
        setRuleLoading(false)
      }
    })
    return () => { mounted = false }
  }, [profile?.role])

  const loading = userLoading || ruleLoading

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title="New Quotation"
        description="Build and send a quotation to a lead or customer"
        breadcrumb={[
          { label: 'Quotations', href: '/quotations' },
          { label: 'New Quotation' },
        ]}
      />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner />
        </div>
      ) : discountRule ? (
        <QuotationBuilder
          leadId={leadId}
          customerId={customerId}
          discountRule={discountRule}
          onSuccess={(id) => router.push(`/quotations/${id}`)}
        />
      ) : (
        <div className="text-center py-20 text-zinc-500 text-sm">
          Failed to load discount rules. Please refresh the page.
        </div>
      )}
    </div>
  )
}
