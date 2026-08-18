import { z } from 'zod'

// =============================================================================
// Shared field schemas
// =============================================================================
const uuidSchema = z.string().uuid()
const phoneSchema = z
  .string()
  .min(10, 'Phone number must be at least 10 digits')
  .max(15, 'Phone number too long')
  .regex(/^[+\d\s()-]+$/, 'Invalid phone number')

const emailSchema = z
  .string()
  .email('Invalid email address')
  .optional()
  .or(z.literal(''))

const positiveNumeric = z.coerce
  .number({ message: 'Must be a number' })
  .nonnegative('Must be 0 or greater')

const percentageSchema = z.coerce
  .number()
  .min(0, 'Cannot be negative')
  .max(100, 'Cannot exceed 100%')

// =============================================================================
// 1. leadSchema
// =============================================================================
export const leadSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: emailSchema,
  phone: phoneSchema,
  address: z.string().max(300).optional().or(z.literal('')),
  city: z.string().max(100).optional().or(z.literal('')),
  state: z.string().max(100).optional().or(z.literal('')),
  stage: z
    .enum(['New', 'Contacted', 'Qualified', 'Quotation Sent', 'Negotiation', 'Won', 'Lost'])
    .default('New'),
  source: z.string().max(100).optional().or(z.literal('')),
  assigned_to: uuidSchema.optional().nullable(),
  interested_categories: z.array(z.string()).default([]),
  estimated_value: positiveNumeric.optional().nullable(),
  demographic: z
    .object({
      age_group: z.string().optional(),
      gender: z.string().optional(),
      occupation: z.string().optional(),
      income: z.string().optional(),
      family_size: z.coerce.number().int().positive().optional(),
      home_type: z.string().optional(),
    })
    .default({}),
  notes: z.string().max(2000).optional().or(z.literal('')),
})

export type LeadFormValues = z.infer<typeof leadSchema>

// =============================================================================
// 2. quotationItemSchema
// =============================================================================
export const quotationItemSchema = z.object({
  product_id: uuidSchema.optional().nullable(),
  is_custom: z.boolean().default(false),
  custom_description: z.string().max(500).optional().or(z.literal('')),
  name: z.string().min(1, 'Item name is required').max(200),
  sku: z.string().max(50).optional().or(z.literal('')),
  image_url: z.string().url('Invalid image URL').optional().or(z.literal('')),
  qty: z.coerce
    .number({ message: 'Quantity must be a number' })
    .int('Quantity must be a whole number')
    .min(1, 'Quantity must be at least 1'),
  unit_price: z.coerce
    .number({ message: 'Price must be a number' })
    .positive('Price must be greater than 0'),
  discount_pct: percentageSchema.default(0),
  gst_pct: percentageSchema.default(18),
  sort_order: z.number().int().default(0),
})

export type QuotationItemFormValues = z.infer<typeof quotationItemSchema>

// =============================================================================
// 3. quotationSchema
// =============================================================================
export const quotationSchema = z.object({
  lead_id: uuidSchema.optional().nullable(),
  customer_id: uuidSchema.optional().nullable(),
  stage: z
    .enum(['Draft', 'Pending Approval', 'Sent', 'Converted', 'Rejected'])
    .default('Draft'),
  notes: z.string().max(2000).optional().or(z.literal('')),
  approval_required_from: uuidSchema.optional().nullable(),
  items: z
    .array(quotationItemSchema)
    .min(1, 'At least one item is required'),
})

export type QuotationFormValues = z.infer<typeof quotationSchema>

// =============================================================================
// 4. productSchema
// =============================================================================
export const productSchema = z.object({
  sku: z
    .string()
    .min(3, 'SKU must be at least 3 characters')
    .max(50)
    .regex(/^[A-Z0-9-_]+$/i, 'SKU can only contain letters, numbers, hyphens, and underscores'),
  hsn_code: z.string().max(20).optional().or(z.literal('')),
  name: z.string().min(2, 'Product name is required').max(200),
  category: z.string().max(100).optional().or(z.literal('')),
  subcategory: z.string().max(100).optional().or(z.literal('')),
  family: z.string().max(100).optional().or(z.literal('')),
  type: z.enum(['existing', 'new', 'customized']).optional().nullable(),
  cost: positiveNumeric.optional().nullable(),
  price: z.coerce
    .number({ message: 'Price must be a number' })
    .positive('Selling price must be greater than 0'),
  gst_pct: percentageSchema.default(18),
  margin_pct: percentageSchema.optional().nullable(),
  stock: z.coerce
    .number({ message: 'Stock must be a number' })
    .int('Stock must be a whole number')
    .min(0, 'Stock cannot be negative')
    .default(0),
  reorder_level: z.coerce
    .number()
    .int()
    .min(0)
    .default(5),
  image_url: z.string().url('Invalid image URL').optional().or(z.literal('')),
  description: z.string().max(2000).optional().or(z.literal('')),
})

export type ProductFormValues = z.infer<typeof productSchema>

// =============================================================================
// 5. offerSchema
// =============================================================================
export const offerSchema = z.object({
  title: z.string().min(2, 'Offer title is required').max(200),
  category: z.string().max(100).optional().or(z.literal('')),
  discount_type: z.enum(['percentage', 'flat']).optional().nullable(),
  discount_value: positiveNumeric.optional().nullable(),
  start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)')
    .optional()
    .nullable(),
  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)')
    .optional()
    .nullable(),
  active: z.boolean().default(false),
})
  .refine(
    (data) => {
      if (data.start_date && data.end_date) {
        return new Date(data.end_date) >= new Date(data.start_date)
      }
      return true
    },
    { message: 'End date must be on or after start date', path: ['end_date'] }
  )

export type OfferFormValues = z.infer<typeof offerSchema>

// =============================================================================
// 6. profileSchema (create / update team member)
// =============================================================================
export const profileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address'),
  role: z.enum(['admin', 'manager', 'salesperson']),
  manager_id: uuidSchema.optional().nullable(),
  phone: phoneSchema.optional().or(z.literal('')),
  annual_target: positiveNumeric.default(0),
  avatar_url: z.string().url('Invalid URL').optional().or(z.literal('')),
})

export type ProfileFormValues = z.infer<typeof profileSchema>

// =============================================================================
// 7. discountRuleSchema
// =============================================================================
export const discountRuleSchema = z
  .object({
    role: z.enum(['admin', 'manager', 'salesperson']),
    min_pct: percentageSchema.default(0),
    max_pct: percentageSchema,
    requires_approval_above: percentageSchema,
  })
  .refine(
    (data) => data.max_pct >= data.min_pct,
    { message: 'Max discount must be ≥ min discount', path: ['max_pct'] }
  )
  .refine(
    (data) => data.requires_approval_above <= data.max_pct,
    {
      message: 'Approval threshold must be ≤ max discount',
      path: ['requires_approval_above'],
    }
  )

export type DiscountRuleFormValues = z.infer<typeof discountRuleSchema>

// =============================================================================
// 8. customerSchema
// =============================================================================
export const customerSchema = z.object({
  lead_id: uuidSchema.optional().nullable(),
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: emailSchema,
  phone: phoneSchema.optional().or(z.literal('')),
  address: z.string().max(300).optional().or(z.literal('')),
  city: z.string().max(100).optional().or(z.literal('')),
  state: z.string().max(100).optional().or(z.literal('')),
  demographic: z
    .object({
      age_group: z.string().optional(),
      gender: z.string().optional(),
      occupation: z.string().optional(),
      income: z.string().optional(),
      family_size: z.coerce.number().int().positive().optional(),
      home_type: z.string().optional(),
    })
    .default({}),
  salesperson_id: uuidSchema.optional().nullable(),
})

export type CustomerFormValues = z.infer<typeof customerSchema>

// =============================================================================
// Re-export all schemas for convenience
// =============================================================================
export {
  leadSchema as LeadSchema,
  quotationItemSchema as QuotationItemSchema,
  quotationSchema as QuotationSchema,
  productSchema as ProductSchema,
  offerSchema as OfferSchema,
  profileSchema as ProfileSchema,
  discountRuleSchema as DiscountRuleSchema,
  customerSchema as CustomerSchema,
}
