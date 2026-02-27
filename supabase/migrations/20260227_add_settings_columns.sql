-- Add settings JSONB column to hospitals
ALTER TABLE public.hospitals 
ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;

-- Add settings JSONB column to clinics
ALTER TABLE public.clinics 
ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;

-- Add a comment to the columns
COMMENT ON COLUMN public.hospitals.settings IS 'Stores global hospital configurations (security, integrations, policies, etc.)';
COMMENT ON COLUMN public.clinics.settings IS 'Stores local clinic configurations (hours, billing rules, notifications, etc.)';
