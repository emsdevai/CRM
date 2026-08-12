-- =============================================================================
-- Jangir Brothers CRM – Initial Schema
-- Migration: 0001_initial_schema.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------
-- Helper: updated_at trigger function
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 1. profiles
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT,
  email           TEXT,
  role            TEXT NOT NULL DEFAULT 'salesperson'
                    CHECK (role IN ('admin','manager','salesperson')),
  manager_id      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  phone           TEXT,
  annual_target   NUMERIC DEFAULT 0,
  avatar_url      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Auto-create profile row when a new auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_auth_users_new_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 2. discount_rules
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.discount_rules (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role                    TEXT UNIQUE NOT NULL,
  min_pct                 NUMERIC DEFAULT 0,
  max_pct                 NUMERIC NOT NULL,
  requires_approval_above NUMERIC NOT NULL,
  updated_by              UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_discount_rules_updated_at
  BEFORE UPDATE ON public.discount_rules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. products
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku           TEXT UNIQUE NOT NULL,
  barcode       TEXT UNIQUE,
  name          TEXT NOT NULL,
  category      TEXT,
  subcategory   TEXT,
  family        TEXT,
  type          TEXT CHECK (type IN ('existing','new','customized')),
  cost          NUMERIC,
  price         NUMERIC NOT NULL,
  gst_pct       NUMERIC DEFAULT 18,
  margin_pct    NUMERIC,
  stock         INTEGER DEFAULT 0,
  reorder_level INTEGER DEFAULT 5,
  image_url     TEXT,
  description   TEXT,
  sold_count    INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. offers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.offers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title          TEXT NOT NULL,
  category       TEXT,
  discount_type  TEXT CHECK (discount_type IN ('percentage','flat')),
  discount_value NUMERIC,
  start_date     DATE,
  end_date       DATE,
  active         BOOLEAN DEFAULT false,
  created_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_offers_updated_at
  BEFORE UPDATE ON public.offers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. leads
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.leads (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,
  email                 TEXT,
  phone                 TEXT NOT NULL,
  address               TEXT,
  city                  TEXT,
  state                 TEXT,
  stage                 TEXT NOT NULL DEFAULT 'New'
                          CHECK (stage IN ('New','Contacted','Qualified','Quotation Sent','Negotiation','Won','Lost')),
  source                TEXT,
  assigned_to           UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  interested_categories TEXT[] DEFAULT '{}',
  estimated_value       NUMERIC,
  demographic           JSONB DEFAULT '{}',
  notes                 TEXT,
  customer_id           UUID,  -- populated after conversion; circular ref resolved below
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- 6. lead_activities
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lead_activities (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id    UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  type       TEXT NOT NULL CHECK (type IN ('created','call','note','quote','order','stage','approval')),
  text       TEXT NOT NULL,
  by         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 7. customers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  customer_number TEXT UNIQUE,
  name            TEXT NOT NULL,
  email           TEXT,
  phone           TEXT,
  address         TEXT,
  city            TEXT,
  state           TEXT,
  demographic     JSONB DEFAULT '{}',
  total_spent     NUMERIC DEFAULT 0,
  salesperson_id  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Now that customers table exists, add the FK from leads.customer_id
ALTER TABLE public.leads
  ADD CONSTRAINT fk_leads_customer_id
  FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;

-- Auto-generate customer_number: JB-YYYYMMDD-XXXX
CREATE OR REPLACE FUNCTION public.generate_customer_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_date   TEXT;
  v_seq    INTEGER;
  v_num    TEXT;
BEGIN
  IF NEW.customer_number IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_date := to_char(now(), 'YYYYMMDD');

  SELECT COUNT(*) + 1
    INTO v_seq
    FROM public.customers
   WHERE customer_number LIKE 'JB-' || v_date || '-%';

  v_num := 'JB-' || v_date || '-' || lpad(v_seq::TEXT, 4, '0');
  NEW.customer_number := v_num;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_customers_number
  BEFORE INSERT ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.generate_customer_number();

-- ---------------------------------------------------------------------------
-- 8. quotations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quotations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id               UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  customer_id           UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  stage                 TEXT NOT NULL DEFAULT 'Draft'
                          CHECK (stage IN ('Draft','Pending Approval','Sent','Converted','Rejected')),
  subtotal              NUMERIC DEFAULT 0,
  discount_total        NUMERIC DEFAULT 0,
  gst_total             NUMERIC DEFAULT 0,
  grand_total           NUMERIC DEFAULT 0,
  notes                 TEXT,
  created_by            UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approval_required_from UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_by           UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  rejected_by           UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reject_reason         TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_quotations_updated_at
  BEFORE UPDATE ON public.quotations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- 9. quotation_items
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quotation_items (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id       UUID NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  product_id         UUID REFERENCES public.products(id) ON DELETE SET NULL,
  is_custom          BOOLEAN DEFAULT false,
  custom_description TEXT,
  name               TEXT NOT NULL,
  sku                TEXT,
  image_url          TEXT,
  qty                INTEGER DEFAULT 1,
  unit_price         NUMERIC NOT NULL,
  discount_pct       NUMERIC DEFAULT 0,
  gst_pct            NUMERIC DEFAULT 18,
  line_base          NUMERIC,
  line_discount      NUMERIC,
  taxable            NUMERIC,
  gst_amt            NUMERIC,
  line_total         NUMERIC,
  sort_order         INTEGER DEFAULT 0
);

-- ---------------------------------------------------------------------------
-- 10. invoices
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_no      TEXT UNIQUE NOT NULL,
  quotation_id    UUID REFERENCES public.quotations(id) ON DELETE SET NULL,
  customer_id     UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  lead_id         UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  subtotal        NUMERIC,
  discount_total  NUMERIC,
  gst_total       NUMERIC,
  grand_total     NUMERIC,
  payment_status  TEXT NOT NULL DEFAULT 'Pending'
                    CHECK (payment_status IN ('Pending','Partially Paid','Paid')),
  salesperson_id  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  invoice_date    TIMESTAMPTZ DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- 11. invoice_items
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id   UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  product_id   UUID REFERENCES public.products(id) ON DELETE SET NULL,
  name         TEXT,
  sku          TEXT,
  image_url    TEXT,
  qty          INTEGER,
  unit_price   NUMERIC,
  discount_pct NUMERIC,
  gst_pct      NUMERIC,
  line_total   NUMERIC
);

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_user_manager_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT manager_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_managed_user_ids()
RETURNS UUID[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT ARRAY(
    SELECT id FROM public.profiles
    WHERE id = auth.uid()
       OR manager_id = auth.uid()
  );
$$;

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_rules  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items   ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- profiles policies
-- ---------------------------------------------------------------------------
-- SELECT: own row, admin sees all, manager sees own team
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.get_user_role() = 'admin'
    OR (public.get_user_role() = 'manager' AND (id = auth.uid() OR manager_id = auth.uid()))
  );

-- UPDATE: own profile (any field), admin can update any row
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.get_user_role() = 'admin')
  WITH CHECK (id = auth.uid() OR public.get_user_role() = 'admin');

-- INSERT: only via admin (e.g. inviting team members) – auth trigger runs as SECURITY DEFINER
CREATE POLICY "profiles_insert" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() = 'admin' OR id = auth.uid());

-- DELETE: admin only
CREATE POLICY "profiles_delete" ON public.profiles
  FOR DELETE TO authenticated
  USING (public.get_user_role() = 'admin');

-- ---------------------------------------------------------------------------
-- discount_rules policies
-- ---------------------------------------------------------------------------
CREATE POLICY "discount_rules_select" ON public.discount_rules
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "discount_rules_insert" ON public.discount_rules
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY "discount_rules_update" ON public.discount_rules
  FOR UPDATE TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY "discount_rules_delete" ON public.discount_rules
  FOR DELETE TO authenticated
  USING (public.get_user_role() = 'admin');

-- ---------------------------------------------------------------------------
-- products policies
-- ---------------------------------------------------------------------------
-- All authenticated users can read products (cost/margin enforced at query level)
CREATE POLICY "products_select" ON public.products
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "products_insert" ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() IN ('admin','manager'));

CREATE POLICY "products_update" ON public.products
  FOR UPDATE TO authenticated
  USING (public.get_user_role() IN ('admin','manager'))
  WITH CHECK (public.get_user_role() IN ('admin','manager'));

CREATE POLICY "products_delete" ON public.products
  FOR DELETE TO authenticated
  USING (public.get_user_role() IN ('admin','manager'));

-- ---------------------------------------------------------------------------
-- offers policies
-- ---------------------------------------------------------------------------
CREATE POLICY "offers_select" ON public.offers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "offers_insert" ON public.offers
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY "offers_update" ON public.offers
  FOR UPDATE TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY "offers_delete" ON public.offers
  FOR DELETE TO authenticated
  USING (public.get_user_role() = 'admin');

-- ---------------------------------------------------------------------------
-- leads policies
-- ---------------------------------------------------------------------------
CREATE POLICY "leads_select" ON public.leads
  FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'admin'
    OR assigned_to = auth.uid()
    OR (
      public.get_user_role() = 'manager'
      AND assigned_to = ANY(public.get_managed_user_ids())
    )
  );

CREATE POLICY "leads_insert" ON public.leads
  FOR INSERT TO authenticated
  WITH CHECK (true);  -- any authenticated user; app sets assigned_to

CREATE POLICY "leads_update" ON public.leads
  FOR UPDATE TO authenticated
  USING (
    public.get_user_role() = 'admin'
    OR assigned_to = auth.uid()
    OR (
      public.get_user_role() = 'manager'
      AND assigned_to = ANY(public.get_managed_user_ids())
    )
  )
  WITH CHECK (
    public.get_user_role() = 'admin'
    OR assigned_to = auth.uid()
    OR (
      public.get_user_role() = 'manager'
      AND assigned_to = ANY(public.get_managed_user_ids())
    )
  );

CREATE POLICY "leads_delete" ON public.leads
  FOR DELETE TO authenticated
  USING (public.get_user_role() = 'admin');

-- ---------------------------------------------------------------------------
-- lead_activities policies
-- ---------------------------------------------------------------------------
CREATE POLICY "lead_activities_select" ON public.lead_activities
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.leads l
       WHERE l.id = lead_id
         AND (
           public.get_user_role() = 'admin'
           OR l.assigned_to = auth.uid()
           OR (
             public.get_user_role() = 'manager'
             AND l.assigned_to = ANY(public.get_managed_user_ids())
           )
         )
    )
  );

CREATE POLICY "lead_activities_insert" ON public.lead_activities
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- customers policies
-- ---------------------------------------------------------------------------
CREATE POLICY "customers_select" ON public.customers
  FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'admin'
    OR salesperson_id = auth.uid()
    OR (
      public.get_user_role() = 'manager'
      AND salesperson_id = ANY(public.get_managed_user_ids())
    )
  );

CREATE POLICY "customers_insert" ON public.customers
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "customers_update" ON public.customers
  FOR UPDATE TO authenticated
  USING (
    public.get_user_role() = 'admin'
    OR salesperson_id = auth.uid()
    OR (
      public.get_user_role() = 'manager'
      AND salesperson_id = ANY(public.get_managed_user_ids())
    )
  )
  WITH CHECK (
    public.get_user_role() = 'admin'
    OR salesperson_id = auth.uid()
    OR (
      public.get_user_role() = 'manager'
      AND salesperson_id = ANY(public.get_managed_user_ids())
    )
  );

CREATE POLICY "customers_delete" ON public.customers
  FOR DELETE TO authenticated
  USING (public.get_user_role() = 'admin');

-- ---------------------------------------------------------------------------
-- quotations policies
-- ---------------------------------------------------------------------------
CREATE POLICY "quotations_select" ON public.quotations
  FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'admin'
    OR created_by = auth.uid()
    OR (
      public.get_user_role() = 'manager'
      AND created_by = ANY(public.get_managed_user_ids())
    )
  );

CREATE POLICY "quotations_insert" ON public.quotations
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "quotations_update" ON public.quotations
  FOR UPDATE TO authenticated
  USING (
    public.get_user_role() IN ('admin','manager')
    OR created_by = auth.uid()
  )
  WITH CHECK (
    public.get_user_role() IN ('admin','manager')
    OR created_by = auth.uid()
  );

CREATE POLICY "quotations_delete" ON public.quotations
  FOR DELETE TO authenticated
  USING (public.get_user_role() = 'admin');

-- ---------------------------------------------------------------------------
-- quotation_items policies (via parent quotation)
-- ---------------------------------------------------------------------------
CREATE POLICY "quotation_items_select" ON public.quotation_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.quotations q
       WHERE q.id = quotation_id
         AND (
           public.get_user_role() = 'admin'
           OR q.created_by = auth.uid()
           OR (
             public.get_user_role() = 'manager'
             AND q.created_by = ANY(public.get_managed_user_ids())
           )
         )
    )
  );

CREATE POLICY "quotation_items_insert" ON public.quotation_items
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "quotation_items_update" ON public.quotation_items
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.quotations q
       WHERE q.id = quotation_id
         AND (
           public.get_user_role() IN ('admin','manager')
           OR q.created_by = auth.uid()
         )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quotations q
       WHERE q.id = quotation_id
         AND (
           public.get_user_role() IN ('admin','manager')
           OR q.created_by = auth.uid()
         )
    )
  );

CREATE POLICY "quotation_items_delete" ON public.quotation_items
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.quotations q
       WHERE q.id = quotation_id
         AND (
           public.get_user_role() IN ('admin','manager')
           OR q.created_by = auth.uid()
         )
    )
  );

-- ---------------------------------------------------------------------------
-- invoices policies
-- ---------------------------------------------------------------------------
CREATE POLICY "invoices_select" ON public.invoices
  FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'admin'
    OR salesperson_id = auth.uid()
    OR (
      public.get_user_role() = 'manager'
      AND salesperson_id = ANY(public.get_managed_user_ids())
    )
  );

CREATE POLICY "invoices_insert" ON public.invoices
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "invoices_update" ON public.invoices
  FOR UPDATE TO authenticated
  USING (
    public.get_user_role() IN ('admin','manager')
    OR salesperson_id = auth.uid()
  )
  WITH CHECK (
    public.get_user_role() IN ('admin','manager')
    OR salesperson_id = auth.uid()
  );

CREATE POLICY "invoices_delete" ON public.invoices
  FOR DELETE TO authenticated
  USING (public.get_user_role() = 'admin');

-- ---------------------------------------------------------------------------
-- invoice_items policies (via parent invoice)
-- ---------------------------------------------------------------------------
CREATE POLICY "invoice_items_select" ON public.invoice_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
       WHERE i.id = invoice_id
         AND (
           public.get_user_role() = 'admin'
           OR i.salesperson_id = auth.uid()
           OR (
             public.get_user_role() = 'manager'
             AND i.salesperson_id = ANY(public.get_managed_user_ids())
           )
         )
    )
  );

CREATE POLICY "invoice_items_insert" ON public.invoice_items
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "invoice_items_update" ON public.invoice_items
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
       WHERE i.id = invoice_id
         AND (
           public.get_user_role() IN ('admin','manager')
           OR i.salesperson_id = auth.uid()
         )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.invoices i
       WHERE i.id = invoice_id
         AND (
           public.get_user_role() IN ('admin','manager')
           OR i.salesperson_id = auth.uid()
         )
    )
  );

CREATE POLICY "invoice_items_delete" ON public.invoice_items
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
       WHERE i.id = invoice_id
         AND (
           public.get_user_role() IN ('admin','manager')
           OR i.salesperson_id = auth.uid()
         )
    )
  );

-- =============================================================================
-- SEED: discount_rules
-- =============================================================================
INSERT INTO public.discount_rules (role, min_pct, max_pct, requires_approval_above)
VALUES
  ('salesperson', 0, 10,  10),
  ('manager',     0, 15,  15),
  ('admin',       0, 100, 100)
ON CONFLICT (role) DO UPDATE
  SET min_pct                 = EXCLUDED.min_pct,
      max_pct                 = EXCLUDED.max_pct,
      requires_approval_above = EXCLUDED.requires_approval_above,
      updated_at              = now();
