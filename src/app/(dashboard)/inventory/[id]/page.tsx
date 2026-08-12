import { notFound, redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/actions/dashboard'
import { getProduct } from '@/lib/actions/inventory'
import { ProductDetailClient } from '@/components/inventory/product-detail-client'

interface ProductDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  const { id } = await params

  const [{ data: profile, error: profileError }, { data: product, error: productError }] =
    await Promise.all([getCurrentProfile(), getProduct(id)])

  if (profileError || !profile) {
    redirect('/login')
  }

  if (productError || !product) {
    notFound()
  }

  const isAdmin = profile.role === 'admin'
  const isAdminOrManager = profile.role === 'admin' || profile.role === 'manager'

  return (
    <ProductDetailClient
      product={product}
      profile={profile}
      isAdmin={isAdmin}
      isAdminOrManager={isAdminOrManager}
    />
  )
}
