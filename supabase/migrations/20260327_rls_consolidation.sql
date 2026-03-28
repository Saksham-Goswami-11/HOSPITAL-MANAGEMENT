-- RLS Consolidation and Multi-Tenant Hardening
-- This migration standardizes RLS policies across critical financial, inventory, and organizational tables.

-- 1. Optimize Helper Function for RLS Performance
CREATE OR REPLACE FUNCTION public.get_auth_hospital_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT hospital_id FROM public.profiles WHERE id = auth.uid();
$$;

-- 2. Standardize is_admin() Helper
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() 
    AND role IN ('ADMIN', 'HOSPITAL_ADMIN', 'SUPER_ADMIN', 'OWNER')
  );
$$;

-- 3. Standardize is_super_admin() Helper
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'SUPER_ADMIN'
  );
$$;

-- 4. Hospitals Table
ALTER TABLE public.hospitals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Hospitals combined policy" ON public.hospitals;
CREATE POLICY "hospitals_select_policy" ON public.hospitals
  FOR SELECT TO authenticated
  USING (id = get_auth_hospital_id() OR is_super_admin());

-- 5. Profiles Table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Profiles access policy" ON public.profiles;
DROP POLICY IF EXISTS "Profiles update policy" ON public.profiles;
CREATE POLICY "profiles_select_policy" ON public.profiles
  FOR SELECT TO authenticated
  USING (hospital_id = get_auth_hospital_id() OR id = auth.uid() OR is_super_admin());

CREATE POLICY "profiles_admin_all_policy" ON public.profiles
  FOR ALL TO authenticated
  USING (hospital_id = get_auth_hospital_id() AND is_admin())
  WITH CHECK (hospital_id = get_auth_hospital_id() AND is_admin());

-- 6. Inventory Table
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Inventory delete policy" ON public.inventory;
DROP POLICY IF EXISTS "Inventory insert policy" ON public.inventory;
DROP POLICY IF EXISTS "Inventory select policy" ON public.inventory;
DROP POLICY IF EXISTS "Inventory update policy" ON public.inventory;
DROP POLICY IF EXISTS "Personnel can manage inventory" ON public.inventory;
CREATE POLICY "inventory_select_policy" ON public.inventory
  FOR SELECT TO authenticated
  USING (hospital_id = get_auth_hospital_id());

CREATE POLICY "inventory_admin_all_policy" ON public.inventory
  FOR ALL TO authenticated
  USING (hospital_id = get_auth_hospital_id() AND is_admin())
  WITH CHECK (hospital_id = get_auth_hospital_id() AND is_admin());

-- 7. Sales Table
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Sales insert policy" ON public.sales;
DROP POLICY IF EXISTS "Sales select policy" ON public.sales;
DROP POLICY IF EXISTS "Personnel can view sales" ON public.sales;
CREATE POLICY "sales_select_policy" ON public.sales
  FOR SELECT TO authenticated
  USING (hospital_id = get_auth_hospital_id());

CREATE POLICY "sales_insert_policy" ON public.sales
  FOR INSERT TO authenticated
  WITH CHECK (hospital_id = get_auth_hospital_id());

CREATE POLICY "sales_admin_all_policy" ON public.sales
  FOR ALL TO authenticated
  USING (hospital_id = get_auth_hospital_id() AND is_admin())
  WITH CHECK (hospital_id = get_auth_hospital_id() AND is_admin());

-- 8. Financial Ledger Table
ALTER TABLE public.financial_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can insert ledger entries" ON public.financial_ledger;
DROP POLICY IF EXISTS "Users can view their hospital ledger" ON public.financial_ledger;
CREATE POLICY "financial_ledger_select_policy" ON public.financial_ledger
  FOR SELECT TO authenticated
  USING (hospital_id = get_auth_hospital_id());

CREATE POLICY "financial_ledger_admin_all_policy" ON public.financial_ledger
  FOR ALL TO authenticated
  USING (hospital_id = get_auth_hospital_id() AND is_admin())
  WITH CHECK (hospital_id = get_auth_hospital_id() AND is_admin());

-- 9. Purchase Orders
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "PO manageable by hospital admins" ON public.purchase_orders;
DROP POLICY IF EXISTS "PO viewable by hospital staff" ON public.purchase_orders;
CREATE POLICY "purchase_orders_select_policy" ON public.purchase_orders
  FOR SELECT TO authenticated
  USING (hospital_id = get_auth_hospital_id());

CREATE POLICY "purchase_orders_admin_all_policy" ON public.purchase_orders
  FOR ALL TO authenticated
  USING (hospital_id = get_auth_hospital_id() AND is_admin())
  WITH CHECK (hospital_id = get_auth_hospital_id() AND is_admin());

-- 10. Sale Items
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Sale items select policy" ON public.sale_items;
CREATE POLICY "sale_items_select_policy" ON public.sale_items
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sales WHERE id = sale_items.sale_id AND hospital_id = get_auth_hospital_id()));

-- 11. Other Expenses
ALTER TABLE public.other_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "other_expenses_select_policy" ON public.other_expenses
  FOR SELECT TO authenticated
  USING (hospital_id = get_auth_hospital_id());

CREATE POLICY "other_expenses_admin_all_policy" ON public.other_expenses
  FOR ALL TO authenticated
  USING (hospital_id = get_auth_hospital_id() AND is_admin())
  WITH CHECK (hospital_id = get_auth_hospital_id() AND is_admin());
