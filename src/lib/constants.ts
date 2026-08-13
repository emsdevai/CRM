// =============================================================================
// Jangid Brothers CRM — Application Constants
// =============================================================================

export interface NavItem {
  label: string
  href: string
  icon: string
  adminOnly?: boolean
  managerUp?: boolean
}

export const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    href:  '/dashboard',
    icon:  'LayoutDashboard',
  },
  {
    label: 'Leads',
    href:  '/leads',
    icon:  'Users',
  },
  {
    label: 'Customers',
    href:  '/customers',
    icon:  'UserCheck',
  },
  {
    label: 'Quotations',
    href:  '/quotations',
    icon:  'FileText',
  },
  {
    label: 'Invoices',
    href:  '/invoices',
    icon:  'Receipt',
  },
  {
    label: 'Inventory',
    href:  '/inventory',
    icon:  'Package',
  },
  {
    label: 'Scan & Quote',
    href:  '/scan',
    icon:  'Scan',
  },
  {
    label: 'Catalog',
    href:  '/catalog',
    icon:  'LayoutGrid',
  },
  {
    label: 'Analytics',
    href:  '/analytics',
    icon:  'BarChart3',
    managerUp: true,
  },
  {
    label: 'HR',
    href:  '/hr',
    icon:  'UserCog',
  },
  {
    label: 'Admin',
    href:  '/admin',
    icon:  'Settings',
    adminOnly: true,
  },
]

export const APP_NAME = 'Jangid Brothers CRM'
export const APP_TAGLINE = 'Complete Furniture Retail Management'

// ---------------------------------------------------------------------------
// Furniture categories
// ---------------------------------------------------------------------------
export const FURNITURE_CATEGORIES = [
  {
    value: 'Living Room',
    label: 'Living Room',
    subcategories: ['Sofas', 'Coffee Tables', 'Recliners', 'TV Units', 'Side Tables', 'Ottomans'],
  },
  {
    value: 'Bedroom',
    label: 'Bedroom',
    subcategories: ['Beds', 'Wardrobes', 'Nightstands', 'Dressers', 'Vanity Tables'],
  },
  {
    value: 'Dining',
    label: 'Dining',
    subcategories: ['Dining Tables', 'Dining Chairs', 'Bar Units', 'Crockery Units'],
  },
  {
    value: 'Office',
    label: 'Office',
    subcategories: ['Office Chairs', 'Office Desks', 'Bookshelves', 'Filing Cabinets'],
  },
  {
    value: 'Outdoor',
    label: 'Outdoor',
    subcategories: ['Patio Sets', 'Garden Benches', 'Swing Chairs'],
  },
  {
    value: 'Storage',
    label: 'Storage',
    subcategories: ['Shoe Racks', 'Cabinets', 'Wall Shelves'],
  },
  {
    value: 'Decor',
    label: 'Decor',
    subcategories: ['Mirrors', 'Lamps', 'Wall Art', 'Rugs'],
  },
] as const

export type FurnitureCategory = typeof FURNITURE_CATEGORIES[number]['value']

export const SUBCATEGORIES_BY_CATEGORY: Record<string, readonly string[]> =
  Object.fromEntries(FURNITURE_CATEGORIES.map((c) => [c.value, c.subcategories]))

// ---------------------------------------------------------------------------
// Lead pipeline
// ---------------------------------------------------------------------------
export const LEAD_STAGES = [
  'New',
  'Contacted',
  'Qualified',
  'Quotation Sent',
  'Negotiation',
  'Won',
  'Lost',
] as const

export const LEAD_SOURCES = [
  'Walk-in',
  'Website',
  'Referral',
  'Instagram Ad',
  'Google Ads',
  'Showroom Event',
  'Cold Call',
  'WhatsApp',
  'Other',
] as const

// ---------------------------------------------------------------------------
// GST rates by category
// ---------------------------------------------------------------------------
export const GST_RATES: Record<string, number> = {
  'Living Room': 18,
  Bedroom: 18,
  Dining: 18,
  Office: 18,
  Outdoor: 12,
  Storage: 18,
  Decor: 12,
}

export const DEFAULT_GST_RATE = 18

// ---------------------------------------------------------------------------
// Quotation & invoice
// ---------------------------------------------------------------------------
export const QUOTATION_STAGES = [
  'Draft',
  'Pending Approval',
  'Sent',
  'Converted',
  'Rejected',
] as const

export const PAYMENT_STATUSES = ['Pending', 'Partially Paid', 'Paid'] as const

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------
export const PRODUCT_TYPES = ['existing', 'new', 'customized'] as const

export const FAMILY_MATERIALS = [
  'Fabric Upholstered',
  'Sheesham Wood',
  'Leatherette',
  'Engineered Wood',
  'Rattan / Cane',
  'Metal & Glass',
  'Mesh & Metal',
  'Velvet',
  'Acacia Wood',
] as const

// ---------------------------------------------------------------------------
// Customer demographics
// ---------------------------------------------------------------------------
export const OCCUPATIONS = [
  'Software Engineer',
  'Business Owner',
  'Doctor',
  'Government Employee',
  'Architect',
  'Marketing Manager',
  'Consultant',
  'Teacher',
  'CA / Finance',
  'Interior Designer',
  'Other',
] as const

export const AGE_GROUPS = ['18-24', '25-34', '35-44', '45-54', '55+'] as const

export const HOME_TYPES = [
  'Apartment',
  'Independent House',
  'Villa',
  'Office Space',
  'Bungalow',
] as const

export const INCOME_BRACKETS = [
  '₹3-6 LPA',
  '₹6-10 LPA',
  '₹10-20 LPA',
  '₹20-35 LPA',
  '₹35+ LPA',
] as const

export const GENDER_OPTIONS = [
  'Male',
  'Female',
  'Other',
  'Prefer not to say',
] as const

export const FAMILY_SIZES = ['1', '2', '3-4', '5-6', '7+'] as const

// ---------------------------------------------------------------------------
// Discount rule defaults (mirrors DB seed)
// ---------------------------------------------------------------------------
export const DEFAULT_DISCOUNT_RULES = {
  salesperson: { min_pct: 0, max_pct: 10, requires_approval_above: 10 },
  manager: { min_pct: 0, max_pct: 15, requires_approval_above: 15 },
  admin: { min_pct: 0, max_pct: 100, requires_approval_above: 100 },
} as const

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------
export const PAGE_SIZE = 20
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

// ---------------------------------------------------------------------------
// Activity type labels
// ---------------------------------------------------------------------------
export const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  created: 'Lead Created',
  call: 'Call Logged',
  note: 'Note Added',
  quote: 'Quotation',
  order: 'Order',
  stage: 'Stage Changed',
  approval: 'Approval',
}

// ---------------------------------------------------------------------------
// Indian states
// ---------------------------------------------------------------------------
export const INDIAN_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra & Nagar Haveli and Daman & Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry',
] as const
