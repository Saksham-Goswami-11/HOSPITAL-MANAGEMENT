-- Migration: Security Hardening & RLS Updates
-- Description: Transition RLS to authenticated role and enforce search_path for security definer functions.

BEGIN;

-- 1. Enforce search_path = public for all SECURITY DEFINER functions in public schema
DO $$ 
DECLARE 
    func_record RECORD;
BEGIN
    FOR func_record IN 
        SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' AND p.prosecdef = true
    LOOP
        EXECUTE format('ALTER FUNCTION %I.%I(%s) SET search_path = public', func_record.nspname, func_record.proname, func_record.args);
    END LOOP;
END $$;

-- 2. Transition RLS policies to authenticated role
-- This is a generic approach to update existing policies. 
-- For safety, we will re-create them for core tables.

-- List of core tables to harden
-- clinics, profiles, sales, inventory, stock_logs, sale_items, staff_attendance

-- Inventory
DROP POLICY IF EXISTS "Inventory select policy" ON public.inventory;
CREATE POLICY "Inventory select policy" ON public.inventory 
FOR SELECT TO authenticated 
USING ((hospital_id = get_auth_hospital_id()) OR is_super_admin() OR is_admin() OR (clinic_id IN (SELECT clinic_id FROM profiles WHERE id = auth.uid())));

DROP POLICY IF EXISTS "Inventory insert policy" ON public.inventory;
CREATE POLICY "Inventory insert policy" ON public.inventory 
FOR INSERT TO authenticated 
WITH CHECK ((hospital_id = get_auth_hospital_id()) OR is_super_admin() OR is_admin() OR (clinic_id IN (SELECT clinic_id FROM profiles WHERE id = auth.uid())));

DROP POLICY IF EXISTS "Inventory update policy" ON public.inventory;
CREATE POLICY "Inventory update policy" ON public.inventory 
FOR UPDATE TO authenticated 
USING ((hospital_id = get_auth_hospital_id()) OR is_super_admin() OR is_admin() OR (clinic_id IN (SELECT clinic_id FROM profiles WHERE id = auth.uid())));

DROP POLICY IF EXISTS "Inventory delete policy" ON public.inventory;
CREATE POLICY "Inventory delete policy" ON public.inventory 
FOR DELETE TO authenticated 
USING ((hospital_id = get_auth_hospital_id()) OR is_super_admin() OR is_admin() OR (clinic_id IN (SELECT clinic_id FROM profiles WHERE id = auth.uid())));

-- Sales
DROP POLICY IF EXISTS "Sales select policy" ON public.sales;
CREATE POLICY "Sales select policy" ON public.sales 
FOR SELECT TO authenticated 
USING (is_admin() OR (clinic_id IN (SELECT clinic_id FROM profiles WHERE id = auth.uid())) OR (hospital_id = get_auth_hospital_id()) OR is_super_admin());

DROP POLICY IF EXISTS "Sales insert policy" ON public.sales;
CREATE POLICY "Sales insert policy" ON public.sales 
FOR INSERT TO authenticated 
WITH CHECK (is_admin() OR (clinic_id IN (SELECT clinic_id FROM profiles WHERE id = auth.uid())) OR (hospital_id = get_auth_hospital_id()) OR is_super_admin());

-- Sale Items
DROP POLICY IF EXISTS "Sale items select policy" ON public.sale_items;
CREATE POLICY "Sale items select policy" ON public.sale_items 
FOR SELECT TO authenticated 
USING (is_admin() OR (EXISTS (SELECT 1 FROM sales s JOIN profiles p ON p.clinic_id = s.clinic_id WHERE s.id = sale_items.sale_id AND p.id = auth.uid())));

-- Staff Attendance
DROP POLICY IF EXISTS "Staff attendance select policy" ON public.staff_attendance;
CREATE POLICY "Staff attendance select policy" ON public.staff_attendance 
FOR SELECT TO authenticated 
USING ((clinic_id IN (SELECT clinic_id FROM profiles WHERE id = auth.uid())) OR (hospital_id = get_auth_hospital_id()) OR is_super_admin());

DROP POLICY IF EXISTS "Staff attendance insert policy" ON public.staff_attendance;
CREATE POLICY "Staff attendance insert policy" ON public.staff_attendance 
FOR INSERT TO authenticated 
WITH CHECK ((clinic_id IN (SELECT clinic_id FROM profiles WHERE id = auth.uid() AND role IN ('CLINIC_ADMIN', 'HOSPITAL_ADMIN', 'SUPER_ADMIN', 'OWNER'))));

DROP POLICY IF EXISTS "Staff attendance update policy" ON public.staff_attendance;
CREATE POLICY "Staff attendance update policy" ON public.staff_attendance 
FOR UPDATE TO authenticated 
USING ((clinic_id IN (SELECT clinic_id FROM profiles WHERE id = auth.uid() AND role IN ('CLINIC_ADMIN', 'HOSPITAL_ADMIN', 'SUPER_ADMIN', 'OWNER'))));

COMMIT;
