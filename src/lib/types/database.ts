// =============================================================================
// Jangid Brothers CRM – Database Types
// Mirrors the Supabase Postgres schema exactly.
// =============================================================================

// ---------------------------------------------------------------------------
// Enum-like union types
// ---------------------------------------------------------------------------
export type Role = 'admin' | 'manager' | 'salesperson'

export type LeadStage =
  | 'New'
  | 'Contacted'
  | 'Qualified'
  | 'Quotation Sent'
  | 'Negotiation'
  | 'Won'
  | 'Lost'

export type QuotationStage =
  | 'Draft'
  | 'Pending Approval'
  | 'Sent'
  | 'Converted'
  | 'Rejected'

export type PaymentStatus = 'Pending' | 'Partially Paid' | 'Paid'

export type ActivityType =
  | 'created'
  | 'call'
  | 'note'
  | 'quote'
  | 'order'
  | 'stage'
  | 'approval'

export type ProductType = 'existing' | 'new' | 'customized'

export type DiscountType = 'percentage' | 'flat'

// ---------------------------------------------------------------------------
// Demographic (shared across leads and customers)
// ---------------------------------------------------------------------------
export interface Demographic {
  age_group?: string
  gender?: string
  occupation?: string
  income?: string
  family_size?: number
  home_type?: string
}

// ---------------------------------------------------------------------------
// 1. Profile
// ---------------------------------------------------------------------------
export interface Profile {
  id: string
  name: string | null
  email: string | null
  role: Role
  manager_id: string | null
  phone: string | null
  annual_target: number
  max_discount_pct: number | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// 2. DiscountRule
// ---------------------------------------------------------------------------
export interface DiscountRule {
  id: string
  role: string
  min_pct: number
  max_pct: number
  requires_approval_above: number
  updated_by: string | null
  updated_at: string
}

// ---------------------------------------------------------------------------
// 3. Product
// ---------------------------------------------------------------------------
export interface Product {
  id: string
  sku: string
  barcode: string | null
  hsn_code: string | null
  name: string
  category: string | null
  subcategory: string | null
  family: string | null
  type: ProductType | null
  cost: number | null        // hidden from salesperson at query level
  price: number
  gst_pct: number
  margin_pct: number | null  // hidden from salesperson at query level
  stock: number
  reorder_level: number
  image_url: string | null
  description: string | null
  metadata: CustomizedProductMeta | null
  sold_count: number
  created_at: string
  updated_at: string
  created_by: string | null
}

// Customized product metadata stored in the products.metadata JSONB column
export interface CustomizedProductMeta {
  customization_details?: string
  color?: string
  dimensions?: { l?: number; w?: number; h?: number; unit?: 'cm' | 'inches' }
  pickup_charge?: number
  installation_charge?: number
  delivery_days?: number
  finish?: string
}

// ---------------------------------------------------------------------------
// 4. Offer
// ---------------------------------------------------------------------------
export interface Offer {
  id: string
  title: string
  category: string | null
  discount_type: DiscountType | null
  discount_value: number | null
  start_date: string | null  // ISO date string
  end_date: string | null
  active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// 5. Lead
// ---------------------------------------------------------------------------
export interface Lead {
  id: string
  name: string
  email: string | null
  phone: string
  address: string | null
  city: string | null
  state: string | null
  stage: LeadStage
  source: string | null
  assigned_to: string | null
  interested_categories: string[]
  estimated_value: number | null
  demographic: Demographic
  notes: string | null
  customer_id: string | null
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// 6. LeadActivity
// ---------------------------------------------------------------------------
export interface LeadActivity {
  id: string
  lead_id: string
  type: ActivityType
  text: string
  by: string | null
  created_at: string
}

// ---------------------------------------------------------------------------
// 7. Customer
// ---------------------------------------------------------------------------
export interface Customer {
  id: string
  lead_id: string | null
  customer_number: string | null
  name: string
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  state: string | null
  pincode: string | null
  gst_number: string | null
  demographic: Demographic
  total_spent: number
  salesperson_id: string | null
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// 8. Quotation
// ---------------------------------------------------------------------------
export interface Quotation {
  id: string
  lead_id: string | null
  customer_id: string | null
  title: string | null
  stage: QuotationStage
  subtotal: number
  discount_total: number
  gst_total: number
  freight_charges: number
  grand_total: number
  notes: string | null
  created_by: string | null
  approval_required_from: string | null
  approved_by: string | null
  rejected_by: string | null
  reject_reason: string | null
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// 9. QuotationItem
// ---------------------------------------------------------------------------
export interface QuotationItem {
  id: string
  quotation_id: string
  product_id: string | null
  is_custom: boolean
  custom_description: string | null
  name: string
  sku: string | null
  image_url: string | null
  qty: number
  unit_price: number
  discount_pct: number
  gst_pct: number
  line_base: number | null
  line_discount: number | null
  taxable: number | null
  gst_amt: number | null
  line_total: number | null
  sort_order: number
}

// ---------------------------------------------------------------------------
// 10. Invoice
// ---------------------------------------------------------------------------
export type PaymentMethod = 'Cash' | 'UPI' | 'Bank Transfer' | 'Cheque' | 'Card'
export type PaymentCardType = 'Debit Card' | 'Credit Card'

export interface Invoice {
  id: string
  invoice_no: string
  quotation_id: string | null
  customer_id: string | null
  lead_id: string | null
  subtotal: number | null
  discount_total: number | null
  gst_total: number | null
  grand_total: number | null
  payment_status: PaymentStatus
  payment_method: PaymentMethod | null
  payment_card_type: PaymentCardType | null
  card_surcharge_pct: number
  payment_reference: string | null   // UPI UTR / bank ref / cheque no
  payment_meta: Record<string, string> | null  // method-specific extras
  salesperson_id: string | null
  invoice_date: string
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// 11. InvoiceItem
// ---------------------------------------------------------------------------
export interface InvoiceItem {
  id: string
  invoice_id: string
  product_id: string | null
  name: string | null
  sku: string | null
  image_url: string | null
  qty: number | null
  unit_price: number | null
  discount_pct: number | null
  gst_pct: number | null
  line_total: number | null
}

// =============================================================================
// Extended / joined types
// =============================================================================

export interface LeadWithActivities extends Lead {
  activities: LeadActivity[]
}

export interface LeadWithAssignee extends Lead {
  assignee: Profile | null
}

export interface LeadFull extends Lead {
  activities: LeadActivity[]
  assignee: Profile | null
}

export interface QuotationWithItems extends Quotation {
  items: QuotationItem[]
  creator: Profile | null
}

export interface QuotationFull extends Quotation {
  items: QuotationItem[]
  creator: Profile | null
  approver: Profile | null
  customer: Customer | null
  lead: Lead | null
}

export interface InvoiceWithItems extends Invoice {
  items: InvoiceItem[]
  customer: Customer | null
  salesperson: Profile | null
}

export interface CustomerWithInvoices extends Customer {
  invoices: Invoice[]
}

export interface CustomerFull extends Customer {
  invoices: Invoice[]
  salesperson: Profile | null
  lead: Lead | null
}

// =============================================================================
// Dashboard KPIs
// =============================================================================
export interface DashboardKPIs {
  total_revenue: number
  revenue_change_pct: number
  total_leads: number
  leads_change_pct: number
  avg_deal_size: number
  active_leads: number
  inventory_value: number
  conversion_rate: number
}

export interface SalespersonPerformance {
  id: string
  name: string
  avatar_url: string | null
  annual_target: number
  revenue: number
  leads_count: number
  won_count: number
  conversion_rate: number
  progress_pct: number
}

export interface StageCount {
  stage: LeadStage
  count: number
  value: number
}

export interface CategoryRevenue {
  category: string
  revenue: number
  units: number
}

// =============================================================================
// Utility insert / update payload types (omit auto-generated fields)
// =============================================================================

export type ProfileInsert = Omit<Profile, 'created_at' | 'updated_at'>
export type ProfileUpdate = Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at'>>

export type ProductInsert = Omit<Product, 'id' | 'created_at' | 'updated_at' | 'sold_count'>
export type ProductUpdate = Partial<Omit<Product, 'id' | 'created_at' | 'updated_at'>>

export type LeadInsert = Omit<Lead, 'id' | 'created_at' | 'updated_at'>
export type LeadUpdate = Partial<Omit<Lead, 'id' | 'created_at' | 'updated_at'>>

export type CustomerInsert = Omit<Customer, 'id' | 'created_at' | 'updated_at' | 'customer_number' | 'total_spent'>
export type CustomerUpdate = Partial<Omit<Customer, 'id' | 'created_at' | 'updated_at' | 'customer_number'>>

export type QuotationInsert = Omit<Quotation, 'id' | 'created_at' | 'updated_at'>
export type QuotationUpdate = Partial<Omit<Quotation, 'id' | 'created_at' | 'updated_at'>>

export type QuotationItemInsert = Omit<QuotationItem, 'id'>
export type QuotationItemUpdate = Partial<Omit<QuotationItem, 'id' | 'quotation_id'>>

export type InvoiceInsert = Omit<Invoice, 'id' | 'created_at' | 'updated_at'>
export type InvoiceUpdate = Partial<Omit<Invoice, 'id' | 'created_at' | 'updated_at'>>

export type InvoiceItemInsert = Omit<InvoiceItem, 'id'>

export type OfferInsert = Omit<Offer, 'id' | 'created_at' | 'updated_at'>
export type OfferUpdate = Partial<Omit<Offer, 'id' | 'created_at' | 'updated_at'>>

// =============================================================================
// Store / App settings
// =============================================================================

export interface StoreSettings {
  id: number
  geo_check_enabled: boolean
  /** true = block non-admins outside radius; false = warn only */
  geo_strict_mode: boolean
  store_latitude: number | null
  store_longitude: number | null
  /** metres */
  radius_meters: number
  updated_by: string | null
  updated_at: string
}

// =============================================================================
// HR Module Types
// =============================================================================

export type LeaveStatus = 'Pending' | 'Approved' | 'Rejected' | 'Cancelled'
export type AttendanceStatus = 'Present' | 'Absent' | 'Half Day' | 'Late' | 'On Leave' | 'Holiday' | 'Week Off'

export interface LeaveType {
  id: string
  name: string
  description: string | null
  default_days: number
  color: string
  created_at: string
}

export interface LeaveBalance {
  id: string
  employee_id: string
  leave_type_id: string
  year: number
  total_days: number
  used_days: number
  pending_days: number
  created_at: string
  updated_at: string
}

export interface LeaveApplication {
  id: string
  employee_id: string
  leave_type_id: string
  start_date: string
  end_date: string
  days_requested: number
  half_day: boolean
  reason: string | null
  status: LeaveStatus
  reviewed_by: string | null
  review_note: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
}

export interface AttendanceRecord {
  id: string
  employee_id: string
  date: string
  check_in: string | null
  check_out: string | null
  status: AttendanceStatus
  work_hours: number | null
  notes: string | null
  marked_by: string | null
  created_at: string
  updated_at: string
}

// Extended / joined
export interface LeaveApplicationFull extends LeaveApplication {
  employee: { id: string; name: string | null; email: string | null; role: string } | null
  leave_type: LeaveType | null
  reviewer: { id: string; name: string | null } | null
}

export interface LeaveBalanceFull extends LeaveBalance {
  leave_type: LeaveType | null
  available_days: number   // computed: total - used - pending
}

export interface AttendanceRecordFull extends AttendanceRecord {
  employee: { id: string; name: string | null; email: string | null } | null
}
