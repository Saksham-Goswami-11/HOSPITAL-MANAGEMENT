-- Update initialize_hospital_onboarding to include admin_email
-- This function is used during the initial hospital setup flow.

BEGIN;

-- First, drop the old function to handle the signature change
DROP FUNCTION IF EXISTS public.initialize_hospital_onboarding(text, text, text, uuid, text, text);

CREATE OR REPLACE FUNCTION public.initialize_hospital_onboarding(
    p_name TEXT,
    p_slug TEXT,
    p_branding_color TEXT,
    p_owner_id UUID,
    p_plan_slug TEXT,
    p_billing_cycle TEXT,
    p_admin_email TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_hospital_id UUID;
    v_plan_id UUID;
BEGIN
    -- 1. Basic Validation: Ensure user doesn't already have a hospital linked
    IF EXISTS (SELECT 1 FROM profiles WHERE id = p_owner_id AND hospital_id IS NOT NULL) THEN
        RAISE EXCEPTION 'User already associated with a hospital organization.';
    END IF;

    -- 2. Create the Hospital Record
    INSERT INTO hospitals (
        name, 
        slug, 
        branding_color, 
        owner_id, 
        subscription_plan, 
        is_active,
        admin_email
    )
    VALUES (
        p_name, 
        p_slug, 
        p_branding_color, 
        p_owner_id, 
        p_plan_slug, 
        true,
        p_admin_email
    )
    RETURNING id INTO v_hospital_id;

    -- 3. Update the User Profile
    UPDATE profiles
    SET 
        hospital_id = v_hospital_id,
        role = 'HOSPITAL_ADMIN',
        updated_at = NOW()
    WHERE id = p_owner_id;

    -- 4. Set up the Initial Subscription (Trial)
    SELECT id INTO v_plan_id FROM plans WHERE slug = p_plan_slug LIMIT 1;

    IF v_plan_id IS NOT NULL THEN
        INSERT INTO subscriptions (
            hospital_id, 
            plan_id, 
            status, 
            billing_cycle, 
            trial_ends_at
        )
        VALUES (
            v_hospital_id,
            v_plan_id,
            'trialing',
            p_billing_cycle,
            NOW() + INTERVAL '7 days'
        );
    END IF;

    RETURN v_hospital_id;
END;
$$;

-- Grant access to authenticated users
GRANT EXECUTE ON FUNCTION public.initialize_hospital_onboarding(text, text, text, uuid, text, text, text) TO authenticated;

COMMIT;
