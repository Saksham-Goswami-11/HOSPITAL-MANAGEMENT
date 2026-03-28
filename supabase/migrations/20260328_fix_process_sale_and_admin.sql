-- Bug fixes for process_sale price column and is_admin missing CLINIC_ADMIN
BEGIN;

-- FIX 1: Add CLINIC_ADMIN to is_admin function 
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() 
    AND role IN ('ADMIN', 'HOSPITAL_ADMIN', 'SUPER_ADMIN', 'OWNER', 'CLINIC_ADMIN')
  );
$$;

-- FIX 2: process_sale insert into sale_items uses incorrect column name ("price" instead of "unit_price")
CREATE OR REPLACE FUNCTION public.process_sale(p_hospital_id uuid, p_clinic_id uuid, p_patient_name text, p_doctor_name text, p_sale_type text, p_payment_mode text, p_amount numeric, p_items jsonb, p_subtotal numeric DEFAULT 0, p_discount_percentage numeric DEFAULT 0)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
    v_sale_id UUID;
    v_item RECORD;
    v_current_cost NUMERIC;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (clinic_id = p_clinic_id OR role IN ('HOSPITAL_ADMIN', 'SUPER_ADMIN', 'OWNER', 'CLINIC_ADMIN'))) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    INSERT INTO sales (hospital_id, clinic_id, patient_name, doctor_name, sale_type, payment_mode, amount, subtotal, discount_percentage)
    VALUES (p_hospital_id, p_clinic_id, p_patient_name, p_doctor_name, p_sale_type, p_payment_mode, p_amount, p_subtotal, p_discount_percentage)
    RETURNING id INTO v_sale_id;

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

COMMIT;
