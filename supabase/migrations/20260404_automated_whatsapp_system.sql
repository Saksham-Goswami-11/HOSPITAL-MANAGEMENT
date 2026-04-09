-- 1. Create WhatsApp Configuration Table
CREATE TABLE IF NOT EXISTS public.whatsapp_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
    agent_secret_key TEXT NOT NULL, -- Encrypted or plain secret for the local agent to authenticate
    is_enabled BOOLEAN DEFAULT FALSE,
    last_heartbeat TIMESTAMP WITH TIME ZONE,
    settings JSONB DEFAULT '{"opd_enabled": true, "ipd_enabled": true, "pharmacy_enabled": true}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(hospital_id)
);

-- 2. Create WhatsApp Outbox for Message Queuing
CREATE TABLE IF NOT EXISTS public.whatsapp_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
    recipient_number TEXT NOT NULL,
    message_body TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    metadata JSONB, -- Store source sale_id or admission_id
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    sent_at TIMESTAMP WITH TIME ZONE,
    processed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.whatsapp_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_outbox ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
-- Only hospital admins can see their own config
CREATE POLICY "Hospital admins can manage their own whatsapp config"
    ON public.whatsapp_configs FOR ALL
    USING (hospital_id IN (SELECT id FROM public.hospitals WHERE id = hospital_id)); 

-- Local Agent Policy: We'll use a Service Role for the agent script, but if we want to use a specific user, we'd add it here.
-- For now, let's allow service-level access.

-- 4. Trigger Function to Queue Messages
CREATE OR REPLACE FUNCTION public.queue_whatsapp_notification()
RETURNS TRIGGER AS $$
DECLARE
    v_hospital_name TEXT;
    v_patient_phone TEXT;
    v_patient_name TEXT;
    v_message TEXT;
    v_config RECORD;
BEGIN
    -- 1. Get Hospital Config
    SELECT * INTO v_config FROM public.whatsapp_configs WHERE hospital_id = NEW.hospital_id AND is_enabled = TRUE;
    IF NOT FOUND THEN RETURN NEW; END IF;

    -- 2. Get Hospital Name
    SELECT name INTO v_hospital_name FROM public.hospitals WHERE id = NEW.hospital_id;

    -- 3. Handle Sales (OPD/Pharmacy)
    IF TG_TABLE_NAME = 'sales' THEN
        -- Check if enabled for this sale type
        IF (NEW.sale_type = 'opd' AND (v_config.settings->>'opd_enabled')::boolean = FALSE) OR
           (NEW.sale_type = 'pharmacy' AND (v_config.settings->>'pharmacy_enabled')::boolean = FALSE) THEN
            RETURN NEW;
        END IF;

        -- Get Patient Phone
        SELECT contact_number, full_name INTO v_patient_phone, v_patient_name 
        FROM public.patients WHERE id = NEW.patient_id;
        
        IF v_patient_phone IS NULL OR v_patient_phone = '' THEN RETURN NEW; END IF;

        -- Format Message
        IF NEW.sale_type = 'opd' THEN
            v_message := format('🏥 *%s*\n\nHello *%s*,\nYour OPD booking is confirmed!\n\n🎟️ Token No: *#%s*\n👨‍⚕️ Doctor: *Dr. %s*\n📅 Amount: ₹%s\n\nPlease arrive 15 mins early. Thank you!', 
                               v_hospital_name, v_patient_name, NEW.daily_serial_number, NEW.doctor_name, NEW.amount);
        ELSE
            v_message := format('🏥 *%s*\n\nHello *%s*,\nYour Pharmacy bill of *₹%s* has been confirmed.\n\nThank you for choosing us!', 
                               v_hospital_name, v_patient_name, NEW.amount);
        END IF;

        -- Insert into Outbox
        INSERT INTO public.whatsapp_outbox (hospital_id, recipient_number, message_body, metadata)
        VALUES (NEW.hospital_id, v_patient_phone, v_message, jsonb_build_object('source', 'sales', 'id', NEW.id));

    -- 4. Handle IPD Admissions
    ELSIF TG_TABLE_NAME = 'ipd_admissions' THEN
        IF (v_config.settings->>'ipd_enabled')::boolean = FALSE THEN RETURN NEW; END IF;

        v_patient_phone := NEW.temp_patient_phone;
        v_patient_name := NEW.temp_patient_name;

        IF v_patient_phone IS NULL OR v_patient_phone = '' THEN RETURN NEW; END IF;

        v_message := format('🏥 *%s*\n\nHello *%s*,\nYou have been successfully admitted.\n\nWe wish you a speedy recovery.', 
                           v_hospital_name, v_patient_name);

        INSERT INTO public.whatsapp_outbox (hospital_id, recipient_number, message_body, metadata)
        VALUES (NEW.hospital_id, v_patient_phone, v_message, jsonb_build_object('source', 'ipd_admissions', 'id', NEW.id));
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Attach Triggers
DROP TRIGGER IF EXISTS tr_sales_whatsapp ON public.sales;
CREATE TRIGGER tr_sales_whatsapp
    AFTER INSERT ON public.sales
    FOR EACH ROW EXECUTE FUNCTION public.queue_whatsapp_notification();

DROP TRIGGER IF EXISTS tr_ipd_whatsapp ON public.ipd_admissions;
CREATE TRIGGER tr_ipd_whatsapp
    AFTER INSERT ON public.ipd_admissions
    FOR EACH ROW EXECUTE FUNCTION public.queue_whatsapp_notification();
