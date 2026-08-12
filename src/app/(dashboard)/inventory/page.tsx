import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/actions/dashboard'
import { getProducts } from '@/lib/actions/inventory'
import { InventoryClient } from '@/components/inventory/inventory-client'
import { LoadingSpinner } from '@/components/shared/loading-spinner'

interface InventoryPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function InventoryPage({ searchParams }: InventoryPageProps) {
  const params = await searchParams
  const { data: profile, error: profileError } = await getCurrentProfile()

  if (profileError || !profile) {
    redirect('/login')
  }

  const category = typeof params.category === 'string' ? params.category : undefined
  const type = typeof params.type === 'string' ? params.type : undefined
  const stockStatus = typeof params.stockStatus === 'string' ? params.stockStatus : undefined
  const search = typeof params.search === 'string' ? params.search : undefined

  const { data: products, count, stats, error } = await getProducts({
    category,
    type,
    stockStatus,
    search,
  })

  const isAdmin = profile.role === 'admin'
  const isAdminOrManager = profile.role === 'admin' || profile.role === 'manager'

  return (
    <Suspense fallback={<LoadingSpinner />}>
      <InventoryClient
        products={products}
        count={count}
        stats={stats}
        isAdmin={isAdmin}
        isAdminOrManager={isAdminOrManager}
        currentFilters={{ category, type, stockStatus, search }}
      />
    </Suspense>
  )
}
