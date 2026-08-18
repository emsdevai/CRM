import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()

  // Build update payload — accept any combination of fields
  const update: Record<string, unknown> = {}

  if (body?.status !== undefined) {
    const validStatuses = ['Pending', 'Partially Paid', 'Paid']
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
    update.payment_status = body.status
  }

  if (body?.payment_mode !== undefined) update.payment_mode = body.payment_mode || null
  if (body?.payment_reference !== undefined) update.payment_reference = body.payment_reference || null
  if (body?.card_surcharge_pct !== undefined) update.card_surcharge_pct = Number(body.card_surcharge_pct) || 0
  if (body?.freight_charges !== undefined) update.freight_charges = Number(body.freight_charges) || 0

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const { error } = await supabase
    .from('invoices')
    .update(update)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
