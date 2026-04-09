-- Unify process_sale functions into a single 15-argument version
BEGIN;

-- Drop existing overloads to avoid ambiguity
DROP FUNCTION IF EXISTS public.process_sale(uuid, uuid, text, text, text, text, numeric, jsonb, numeric, numeric, uuid, uuid, text);
DROP FUNCTION IF EXISTS public.process_sale(uuid, uuid, text, text, text, text, numeric, jsonb, numeric, numeric, uuid, uuid, text, text);

-- Create the unified 15-argument version
CREATE OR REPLACE FUNCTION public.process_sale(
    p_hospital_id uuid,
    p_clinic_id uuid,
    p_patient_name text,
    p_doctor_name text,
    p_sale_type text,
    p_payment_mode text,
    p_amount numeric,
    p_items jsonb,
    p_subtotal numeric DEFAULT 0,
    p_discount_percentage numeric DEFAULT 0,
    p_admission_id uuid DEFAULT NULL::uuid,
    p_patient_id uuid DEFAULT NULL::uuid,
    p_patient_phone text DEFAULT NULL::text,
    p_patient_address text DEFAULT NULL::text,
    p_payment_status text DEFAULT 'paid'::text
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
    v_sale_id UUID;
    v_patient_id UUID;
    v_item RECORD;
    v_current_cost NUMERIC;
    v_serial_number INTEGER := NULL;
BEGIN
    -- Authorization check
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (clinic_id = p_clinic_id OR role IN ('HOSPITAL_ADMIN', 'SUPER_ADMIN', 'OWNER', 'CLINIC_ADMIN'))) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- 1. Determine or create patient_id
    v_patient_id := p_patient_id;
    
    IF v_patient_id IS NULL AND p_patient_name IS NOT NULL AND p_patient_name <> '' THEN
        -- Try to find existing patient by name and hospital
        SELECT id INTO v_patient_id FROM patients 
        WHERE full_name ILIKE p_patient_name 
        AND hospital_id = p_hospital_id 
        LIMIT 1;
        
        -- If not found, create one (Automated Registration)
        IF v_patient_id IS NULL THEN
            INSERT INTO patients (hospital_id, clinic_id, full_name, contact_number, address)
            VALUES (p_hospital_id, p_clinic_id, p_patient_name, p_patient_phone, p_patient_address)
            RETURNING id INTO v_patient_id;
        END IF;
    END IF;

    -- Update patient details if they were missing (Consistency check)
    IF v_patient_id IS NOT NULL THEN
        UPDATE patients 
        SET contact_number = COALESCE(contact_number, p_patient_phone),
            address = COALESCE(address, p_patient_address)
        WHERE id = v_patient_id 
        AND (contact_number IS NULL OR contact_number = '' OR address IS NULL OR address = '');
    END IF;

    -- 2. Link Admission to Patient and clear temp details if needed
    IF p_admission_id IS NOT NULL AND v_patient_id IS NOT NULL THEN
        UPDATE ipd_admissions 
        SET patient_id = v_patient_id,
            temp_patient_name = NULL,
            temp_patient_phone = NULL,
            temp_patient_address = NULL
        WHERE id = p_admission_id AND patient_id IS NULL;
    END IF;

    -- 3. Calculate daily serial number ONLY if it is a consultation
    IF p_sale_type = 'CONSULTATION' THEN
        SELECT COALESCE(MAX(daily_serial_number), 0) + 1
        INTO v_serial_number
        FROM sales
        WHERE clinic_id = p_clinic_id
          AND (timestamp AT TIME ZONE 'Asia/Kolkata')::date = (now() AT TIME ZONE 'Asia/Kolkata')::date
          AND sale_type = 'CONSULTATION';
    END IF;

    -- 4. Insert Sale
    INSERT INTO sales (
        hospital_id, 
        clinic_id, 
        patient_name, 
        patient_id,
        doctor_name, 
        sale_type, 
        payment_mode, 
        amount, 
        subtotal, 
        discount_percentage,
        admission_id,
        daily_serial_number,
        payment_status,
        meta_data
    )
    VALUES (
        p_hospital_id, 
        p_clinic_id, 
        p_patient_name, 
        v_patient_id,
        p_doctor_name, 
        p_sale_type, 
        p_payment_mode, 
        p_amount, 
        p_subtotal, 
        p_discount_percentage,
        p_admission_id,
        v_serial_number,
        p_payment_status,
        jsonb_build_object(
            'patient_phone', p_patient_phone,
            'patient_address', p_patient_address
        )
    )
    RETURNING id INTO v_sale_id;

    -- 5. Process Inventory
    IF p_sale_type = 'PHARMACY' AND p_items IS NOT NULL THEN
        FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(inventory_id UUID, quantity INT, price NUMERIC, is_loose_sale BOOLEAN, units_sold INT) LOOP
            SELECT unit_cost_price INTO v_current_cost FROM inventory WHERE id = v_item.inventory_id;
            UPDATE inventory SET quantity = quantity - v_item.quantity WHERE id = v_item.inventory_id;
            
            INSERT INTO sale_items (sale_id, inventory_id, quantity, unit_price, unit_cost_price, is_loose_sale, units_sold)
            VALUES (v_sale_id, v_item.inventory_id, v_item.quantity, v_item.price, COALESCE(v_current_cost, 0), COALESCE(v_item.is_loose_sale, FALSE), COALESCE(v_item.units_sold, v_item.quantity));
        END LOOP;
    END IF;
    
    -- 6. Return JSON with sale ID and token number
    RETURN jsonb_build_object(
        'sale_id', v_sale_id,
        'daily_serial_number', v_serial_number
    );
END;
$$;

COMMIT;
