-- Add patient_id to sales table
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS patient_id uuid REFERENCES public.patients(id);

-- Fix process_sale to support automated patient registration and admission linking
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
    p_admission_id uuid DEFAULT NULL,
    p_patient_id uuid DEFAULT NULL
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
    v_sale_id UUID;
    v_patient_id UUID;
    v_item RECORD;
    v_current_cost NUMERIC;
BEGIN
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
            INSERT INTO patients (hospital_id, clinic_id, full_name)
            VALUES (p_hospital_id, p_clinic_id, p_patient_name)
            RETURNING id INTO v_patient_id;
        END IF;
    END IF;

    -- 2. Link Admission to Patient if needed
    IF p_admission_id IS NOT NULL AND v_patient_id IS NOT NULL THEN
        UPDATE ipd_admissions 
        SET patient_id = v_patient_id,
            temp_patient_name = NULL -- Clear temp name once registered
        WHERE id = p_admission_id AND patient_id IS NULL;
    END IF;

    -- 3. Insert Sale
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
        admission_id
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
        p_admission_id
    )
    RETURNING id INTO v_sale_id;

    -- 4. Process Inventory
    IF p_sale_type = 'PHARMACY' AND p_items IS NOT NULL THEN
        FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(inventory_id UUID, quantity INT, price NUMERIC, is_loose_sale BOOLEAN, units_sold INT) LOOP
            SELECT unit_cost_price INTO v_current_cost FROM inventory WHERE id = v_item.inventory_id;
            UPDATE inventory SET quantity = quantity - v_item.quantity WHERE id = v_item.inventory_id;
            INSERT INTO sale_items (sale_id, inventory_id, quantity, unit_price, total_price, unit_cost_price, is_loose_sale, units_sold)
            VALUES (v_sale_id, v_item.inventory_id, v_item.quantity, v_item.price, (v_item.price * v_item.quantity), COALESCE(v_current_cost, 0), COALESCE(v_item.is_loose_sale, FALSE), COALESCE(v_item.units_sold, v_item.quantity));
        END LOOP;
    END IF;
    
    RETURN v_sale_id;
END;
$$;
