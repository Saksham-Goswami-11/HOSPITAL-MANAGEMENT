BEGIN;

-- =========================================================================
-- 1. DATA ISOLATION (staff_attendance)
-- =========================================================================

-- Drop the overly permissive ALL policy
DROP POLICY IF EXISTS "Authorized users can manage attendance" ON staff_attendance;

-- Create strict INSERT policy tied to clinic_id validation
CREATE POLICY "Clinic Managers can insert attendance for their clinic"
ON staff_attendance FOR INSERT 
TO authenticated
WITH CHECK (
    clinic_id IN (
        SELECT clinic_id FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('CLINIC_ADMIN', 'HOSPITAL_ADMIN', 'SUPER_ADMIN', 'OWNER')
    )
);

-- Create strict UPDATE policy tied to clinic_id validation
CREATE POLICY "Clinic Managers can update attendance for their clinic"
ON staff_attendance FOR UPDATE 
TO authenticated
USING (
    clinic_id IN (
        SELECT clinic_id FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('CLINIC_ADMIN', 'HOSPITAL_ADMIN', 'SUPER_ADMIN', 'OWNER')
    )
)
WITH CHECK (
    clinic_id IN (
        SELECT clinic_id FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('CLINIC_ADMIN', 'HOSPITAL_ADMIN', 'SUPER_ADMIN', 'OWNER')
    )
);


-- =========================================================================
-- 2. REAL-TIME SECURITY (sales)
-- =========================================================================

-- Ensure Row Level Security is active on the financial table
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

-- Create policy to restrict visibility of live financial data over WebSockets
CREATE POLICY "Users can only view sales for their assigned clinic"
ON sales FOR SELECT 
TO authenticated
USING (
    clinic_id IN (
        SELECT clinic_id FROM profiles WHERE id = auth.uid()
    ) 
    OR EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('HOSPITAL_ADMIN', 'SUPER_ADMIN', 'OWNER')
    )
);


-- =========================================================================
-- 3. SCHEMA LEVEL VALIDATION (Poison Prevention)
-- =========================================================================

-- Ensure inventory isn't artificially inflated via negative logic
ALTER TABLE inventory ADD CONSTRAINT check_quantity_positive CHECK (quantity >= 0);

-- Ensure negative billing amounts are rejected natively
ALTER TABLE sales ADD CONSTRAINT check_amount_positive CHECK (amount >= 0);

-- Restrict attendance hours to structurally sound logic
ALTER TABLE staff_attendance ADD CONSTRAINT check_hours_realistic CHECK (total_hours >= 0 AND total_hours <= 24);


-- =========================================================================
-- 4. ANTI-FRAUD AUDIT TRAILS
-- =========================================================================

-- Create immutable audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('UPDATE', 'DELETE')),
    old_data JSONB,
    changed_by UUID,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create generic trigger function to serialize historical records
CREATE OR REPLACE FUNCTION capture_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO audit_logs (table_name, record_id, action, old_data, changed_by)
    VALUES (
        TG_TABLE_NAME, 
        OLD.id, 
        TG_OP, 
        row_to_json(OLD)::jsonb, 
        auth.uid()
    );
    RETURN NEW;
END;
$$;

-- Attach trigger specifically to sales for financial auditing
DROP TRIGGER IF EXISTS sales_audit_trigger ON sales;
CREATE TRIGGER sales_audit_trigger
AFTER UPDATE OR DELETE ON sales
FOR EACH ROW EXECUTE FUNCTION capture_audit_log();


-- =========================================================================
-- 5. RPC FUNCTION PROTECTION (process_sale)
-- =========================================================================

-- Recreate procedure with strict internal security threshold
CREATE OR REPLACE FUNCTION process_sale(
    p_hospital_id UUID, 
    p_clinic_id UUID, 
    p_patient_name TEXT, 
    p_doctor_name TEXT, 
    p_sale_type TEXT, 
    p_payment_mode TEXT, 
    p_amount NUMERIC, 
    p_items JSONB
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
    INSERT INTO sales (hospital_id, clinic_id, patient_name, doctor_name, sale_type, payment_mode, amount)
    VALUES (p_hospital_id, p_clinic_id, p_patient_name, p_doctor_name, p_sale_type, p_payment_mode, p_amount)
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

COMMIT;
