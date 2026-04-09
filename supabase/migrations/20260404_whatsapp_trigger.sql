-- Migration: WhatsApp Notification Triggers
-- Description: Sets up the schema and triggers for automated WhatsApp messages for OPD and IPD events.

BEGIN;

-- 1. Ensure ipd_admissions has temporary patient fields
ALTER TABLE public.ipd_admissions 
ADD COLUMN IF NOT EXISTS temp_patient_name TEXT,
ADD COLUMN IF NOT EXISTS temp_patient_phone TEXT,
ADD COLUMN IF NOT EXISTS temp_patient_address TEXT;

-- 2. Create WhatsApp Logs table
CREATE TABLE IF NOT EXISTS public.whatsapp_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id UUID REFERENCES public.hospitals(id),
    recipient_number TEXT NOT NULL,
    patient_name TEXT,
    event_type TEXT, -- OPD_BOOKING, IPD_ADMISSION
    meta_data JSONB, -- stores template data (doctor, token, bed, hospital_name)
    status TEXT DEFAULT 'pending', -- pending, sent, error
    error_message TEXT,
    related_entity_id UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for logs
ALTER TABLE public.whatsapp_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hospital staff can view their organization's logs" ON public.whatsapp_logs
    FOR ALL USING (
        hospital_id IN (
            SELECT hospital_id FROM public.profiles WHERE id = auth.uid()
        )
    );

-- 3. Trigger Function
CREATE OR REPLACE FUNCTION public.handle_whatsapp_notification_log()
RETURNS TRIGGER AS $$
DECLARE
    v_hospital_name TEXT;
    v_doctor_name TEXT;
    v_patient_name TEXT;
    v_phone TEXT;
    v_event_type TEXT;
    v_meta JSONB;
BEGIN
    -- 1. Determine Event Source
    IF (TG_TABLE_NAME = 'sales') THEN
        -- Only for consultation
        IF (NEW.sale_type <> 'CONSULTATION') THEN
            RETURN NEW;
        END IF;

        v_event_type := 'OPD_BOOKING';
        v_patient_name := NEW.patient_name;
        v_doctor_name := NEW.doctor_name;
        v_phone := NEW.meta_data->>'patient_phone';
        v_meta := jsonb_build_object(
            'token_number', NEW.daily_serial_number,
            'doctor_name', v_doctor_name
        );

    ELSIF (TG_TABLE_NAME = 'ipd_admissions') THEN
        v_event_type := 'IPD_ADMISSION';
        
        -- Get patient details (prefer registered patient record if linked)
        IF NEW.patient_id IS NOT NULL THEN
            SELECT full_name, contact_number INTO v_patient_name, v_phone FROM patients WHERE id = NEW.patient_id;
        ELSE
            v_patient_name := NEW.temp_patient_name;
            v_phone := NEW.temp_patient_phone;
        END IF;

        -- Get doctor name
        SELECT COALESCE(full_name, 'Assigned Doctor') INTO v_doctor_name FROM profiles WHERE id = NEW.admitting_doctor_id;
        
        -- Get bed/ward details
        SELECT jsonb_build_object(
            'bed_number', b.bed_number,
            'ward_name', w.name,
            'doctor_name', v_doctor_name
        ) INTO v_meta
        FROM beds b
        JOIN wards w ON b.ward_id = w.id
        WHERE b.id = NEW.bed_id;
        
    END IF;

    -- 2. Validate Phone
    IF v_phone IS NULL OR v_phone = '' THEN
        RETURN NEW;
    END IF;

    -- 3. Fetch Hospital Name
    SELECT name INTO v_hospital_name FROM hospitals WHERE id = NEW.hospital_id;
    v_meta := v_meta || jsonb_build_object('hospital_name', v_hospital_name);

    -- 4. Queue the notification by inserting into whatsapp_logs
    -- The actual sending will be handled by a Supabase Webhook on this log table
    INSERT INTO public.whatsapp_logs (
        hospital_id, 
        recipient_number, 
        patient_name, 
        event_type, 
        meta_data, 
        related_entity_id, 
        status
    )
    VALUES (
        NEW.hospital_id, 
        v_phone, 
        v_patient_name, 
        v_event_type, 
        v_meta, 
        NEW.id, 
        'pending'
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create Triggers
DROP TRIGGER IF EXISTS tr_opd_whatsapp_notify ON public.sales;
CREATE TRIGGER tr_opd_whatsapp_notify
    AFTER INSERT ON public.sales
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_whatsapp_notification_log();

DROP TRIGGER IF EXISTS tr_ipd_whatsapp_notify ON public.ipd_admissions;
CREATE TRIGGER tr_ipd_whatsapp_notify
    AFTER INSERT ON public.ipd_admissions
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_whatsapp_notification_log();

COMMIT;
