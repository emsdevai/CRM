# Jangir Brothers CRM

A production-grade furniture retail CRM built with Next.js 15, Supabase, and deployed on Vercel.

## Features

- **10 Modules**: Dashboard, Leads, Quotations, Customers, Inventory, Catalog & Offers, Scan & Quote, Invoices, Analytics, Admin
- **3 Role Tiers**: Admin (full access + cost/margin), Manager (team-scoped), Salesperson (own data only)
- **Discount Approval Workflow**: Role-based discount limits with manager/admin approval chain
- **Barcode Scanning**: Camera-based QR/barcode scan → instant product lookup → add to quotation
- **Invoice PDF**: Generate, download, and print invoices with GST breakdown
- **Bulk CSV Import**: Import product catalog via CSV
- **Supabase RLS**: Row Level Security enforced at database level, not just UI

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind CSS v4 |
| Backend / DB | Supabase (Postgres + Auth + Storage + RLS) |
| Deployment | Vercel |
| Charts | Recharts |
| Forms | React Hook Form + Zod |
| PDF | Browser print via styled HTML |
| Barcode scan | html5-qrcode |
| Barcode gen | JsBarcode |
| CSV import | Papa Parse |

---

## Setup Instructions

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd jangir-crm
npm install
```

### 2. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) → New Project
2. Name it `jangir-crm-prod` (or similar)
3. Choose your region (Mumbai / ap-south-1 recommended for India)
4. Copy your Project URL and API Keys from **Settings → API**

### 3. Run Database Migrations

In the Supabase SQL Editor, run these in order:

```sql
-- 1. Run the main schema
-- Copy & paste contents of: supabase/migrations/0001_initial_schema.sql

-- 2. Run the settings table
-- Copy & paste contents of: supabase/migrations/0002_settings_table.sql

-- 3. Run seed data (optional but recommended for dev)
-- Copy & paste contents of: supabase/seed.sql
```

### 4. Configure Supabase Storage

1. Go to **Storage** in Supabase Dashboard
2. Create a new bucket called `product-images`
3. Set it to **Public**
4. Under Policies, add:
   - **SELECT**: Anyone (public read)
   - **INSERT**: Authenticated users only
   - **DELETE**: Admin only (or authenticated for simplicity)

### 5. Create Initial Admin User

1. Go to **Authentication → Users** in Supabase Dashboard
2. Click "Invite user" → enter your admin email
3. After they sign up, go to **Table Editor → profiles**
4. Find their row and set `role = 'admin'`

OR use the SQL editor:
```sql
UPDATE public.profiles 
SET role = 'admin', name = 'Prashant Hinger'
WHERE email = 'admin@jangirbrothers.com';
```

### 6. Environment Variables

```bash
cp .env.local.example .env.local
```

Fill in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 7. Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) → redirects to `/login`.

---

## Deploy to Vercel

### Option A: Via Vercel Dashboard (Recommended)

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → Import from GitHub
3. Add Environment Variables (same as `.env.local` but with production values)
4. Deploy

### Option B: Via CLI

```bash
npm install -g vercel
vercel
# Follow prompts, add env vars when asked
```

### After Deploy

1. Update `NEXT_PUBLIC_APP_URL` to your Vercel URL
2. In Supabase: **Authentication → URL Configuration** → add your Vercel domain to:
   - **Site URL**: `https://your-app.vercel.app`
   - **Redirect URLs**: `https://your-app.vercel.app/**`

---

## Project Structure

```
src/
  app/
    (auth)/login/          # Login page + action
    (dashboard)/           # Protected routes
      layout.tsx           # Auth check + sidebar shell
      dashboard/           # KPI dashboard
      leads/               # Lead pipeline
      quotations/          # Quote builder + approval
      customers/           # Customer 360 view
      inventory/           # Stock management
      catalog/             # Products + offers
      scan/                # Barcode scan & quote
      invoices/            # Invoice management
      analytics/           # Charts + leaderboard
      admin/               # Team + settings (admin only)
    api/
      invoices/[id]/pdf/   # PDF generation
  components/
    layout/                # Sidebar, Topbar, Shell
    leads/                 # Lead-specific components
    quotations/            # Quote builder components
    inventory/             # Product form, barcode, CSV import
    analytics/             # Charts
    admin/                 # Team management forms
    shared/                # DataTable, ConfirmDialog, etc.
  lib/
    actions/               # Server actions (DB mutations)
    supabase/              # Client + server + middleware
    types/                 # TypeScript types matching DB schema
    validations/           # Zod schemas
    utils.ts               # Helpers
    constants.ts           # App-wide constants
  hooks/                   # useUser, useToast
  middleware.ts            # Auth guard
supabase/
  migrations/              # SQL schema files (run in order)
  seed.sql                 # Dev seed data
```

---

## Role Permissions

| Feature | Admin | Manager | Salesperson |
|---|---|---|---|
| View cost & margin | ✅ | ❌ | ❌ |
| See all team data | ✅ | Own team | Own only |
| Full analytics + leaderboard | ✅ | Team only | Self only |
| Set discount rules | ✅ | ❌ | ❌ |
| Approve quotations | ✅ | Up to 15% | ❌ |
| Manage team members | ✅ | ❌ | ❌ |
| Create & manage offers | ✅ | ❌ | ❌ |
| Add products / bulk import | ✅ | ✅ | ❌ |
| Create leads, quotes, invoices | ✅ | ✅ | ✅ |
| Scan barcode & quote | ✅ | ✅ | ✅ |

---

## Discount Flow

```
Salesperson creates quotation with 8% discount
  → 8% ≤ 10% max (salesperson rule) → auto-approved → stage: Sent

Salesperson creates quotation with 12% discount  
  → 12% > 10% → stage: Pending Approval → manager gets notified
  → Manager approves → stage: Sent
  → Manager rejects → stage: Rejected (reason logged)

Manager creates quotation with 18% discount
  → 18% > 15% max (manager rule) → stage: Pending Approval → admin gets notified
```

---

## V2 Roadmap

- [ ] Manufacturing module (raw materials, BOM, production orders)
- [ ] HR / Leave / Attendance management
- [ ] WhatsApp / Email quotation sharing
- [ ] EMS (Expense Management) integration
- [ ] Multi-tenant white-label for other furniture retailers

---

## License

Private. Built by GrowthArc for Jangir Brothers.
