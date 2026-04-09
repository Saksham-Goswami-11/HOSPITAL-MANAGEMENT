-- Fix search_path for critical onboarding and management functions
-- These were set to '' (empty), which prevents them from finding tables in 'public'

BEGIN;

ALTER FUNCTION public.initialize_hospital_onboarding(text, text, text, uuid, text, text) SET search_path TO public, extensions;
ALTER FUNCTION public.admin_create_clinic_and_staff(text, text, uuid, text, uuid, text) SET search_path TO public, extensions;
ALTER FUNCTION public.onboard_hospital_with_admin(text, text, text, uuid, text) SET search_path TO public, extensions;
ALTER FUNCTION public.create_hospital_for_new_user(text, text, text, uuid) SET search_path TO public, extensions;
ALTER FUNCTION public.create_hospital_for_owner(text, text, text) SET search_path TO public, extensions;
ALTER FUNCTION public.super_admin_create_hospital(text, text, uuid, text) SET search_path TO public, extensions;
ALTER FUNCTION public.get_hospital_plan_limits(uuid) SET search_path TO public, extensions;
ALTER FUNCTION public.upsert_usage_metric(uuid, text, integer) SET search_path TO public, extensions;
ALTER FUNCTION public.recount_usage_metric(uuid, text) SET search_path TO public, extensions;
ALTER FUNCTION public.check_hospital_limit(uuid, text, integer) SET search_path TO public, extensions;
ALTER FUNCTION public.check_hospital_limit(uuid, text) SET search_path TO public, extensions;
ALTER FUNCTION public.process_payment_captured(uuid, text, text, text, text, integer) SET search_path TO public, extensions;
ALTER FUNCTION public.process_payment_failed(uuid, text, text, text) SET search_path TO public, extensions;
ALTER FUNCTION public.check_checkout_rate_limit(uuid, integer) SET search_path TO public, extensions;
ALTER FUNCTION public.enforce_trial_expiry() SET search_path TO public, extensions;
ALTER FUNCTION public.check_expiring_trials() SET search_path TO public, extensions;
ALTER FUNCTION public.fn_mark_auto_absent() SET search_path TO public, extensions;

-- Trigger functions
ALTER FUNCTION public.capture_audit_log() SET search_path TO public, extensions;
ALTER FUNCTION public.update_supplier_credit() SET search_path TO public, extensions;
ALTER FUNCTION public.handle_new_user() SET search_path TO public, extensions;
ALTER FUNCTION public.confirm_new_user() SET search_path TO public, extensions;
ALTER FUNCTION public.trigger_track_clinics() SET search_path TO public, extensions;
ALTER FUNCTION public.trigger_track_sales() SET search_path TO public, extensions;
ALTER FUNCTION public.trigger_track_staff() SET search_path TO public, extensions;
ALTER FUNCTION public.trigger_track_inventory() SET search_path TO public, extensions;
ALTER FUNCTION public.handle_payment_financials() SET search_path TO public, extensions;

COMMIT;
