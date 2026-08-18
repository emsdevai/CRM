-- Migration: allow salespersons to SELECT all customers
-- Previously salespersons could only see customers where salesperson_id = their own id,
-- meaning customers entered by admin were invisible to them.
-- Now all authenticated staff can read all customers (insert/update/delete remain restricted).

DROP POLICY IF EXISTS "customers_select" ON public.customers;

CREATE POLICY "customers_select" ON public.customers
  FOR SELECT TO authenticated
  USING (true);
