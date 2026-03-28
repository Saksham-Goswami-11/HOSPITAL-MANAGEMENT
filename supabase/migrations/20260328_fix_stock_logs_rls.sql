-- Fix RLS policy for stock_logs to allow inserts by clinic admins
BEGIN;

ALTER TABLE public.stock_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stock_logs_insert_policy" ON public.stock_logs;
CREATE POLICY "stock_logs_insert_policy" ON public.stock_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    is_admin() AND 
    EXISTS (SELECT 1 FROM public.inventory i WHERE i.id = inventory_id AND i.hospital_id = get_auth_hospital_id())
  );

COMMIT;
