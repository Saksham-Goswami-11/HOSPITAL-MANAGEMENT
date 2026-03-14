-- Migration: Add dynamic discounts to POS billing
-- Description: Adds subtotal and discount_percentage to sales tracking and updates process_sale RPC

-- 1. Add new columns to the sales table
ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS subtotal NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_percentage NUMERIC DEFAULT 0;

-- 2. Update the process_sale RPC function
CREATE OR REPLACE FUNCTION public.process_sale(
    p_hospital_id UUID, 
    p_clinic_id UUID, 
    p_patient_name TEXT, 
    p_doctor_name TEXT, 
    p_sale_type TEXT, 
    p_payment_mode TEXT, 
    p_amount NUMERIC, 
    p_items JSONB,
    p_subtotal NUMERIC DEFAULT 0,
    p_discount_percentage NUMERIC DEFAULT 0
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sale_id UUID;
    v_item RECORD;
BEGIN
    -- [SECURITY PATCH Block] Verify caller belongs to the requested clinic or has explicit global oversight
    IF NOT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND (
            clinic_id = p_clinic_id 
            OR role IN ('HOSPITAL_ADMIN', 'SUPER_ADMIN', 'OWNER')
        )
    ) THEN
        RAISE EXCEPTION 'Unauthorized: You do not have permission to process sales for this clinic branch.';
    END IF;

    -- Core sale insert 
    INSERT INTO sales (
        hospital_id, 
        clinic_id, 
        patient_name, 
        doctor_name, 
        sale_type, 
        payment_mode, 
        amount, 
        subtotal, 
        discount_percentage
    )
    VALUES (
        p_hospital_id, 
        p_clinic_id, 
        p_patient_name, 
        p_doctor_name, 
        p_sale_type, 
        p_payment_mode, 
        p_amount, 
        p_subtotal, 
        p_discount_percentage
    )
    RETURNING id INTO v_sale_id;

    -- Optional list iteration if elements are present
    IF p_sale_type = 'PHARMACY' AND p_items IS NOT NULL THEN
        FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(inventory_id UUID, quantity INT, price NUMERIC)
        LOOP
            -- Deduct stock directly from active inventory tracking
            UPDATE inventory 
            SET quantity = quantity - v_item.quantity
            WHERE id = v_item.inventory_id;
            
            -- Append isolated log for receipt construction
            INSERT INTO sale_items (sale_id, inventory_id, quantity, price)
            VALUES (v_sale_id, v_item.inventory_id, v_item.quantity, v_item.price);
        END LOOP;
    END IF;

    RETURN v_sale_id;
END;
$$;
