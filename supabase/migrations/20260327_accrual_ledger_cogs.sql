-- Migration: Implement Accrual-Based COGS Tracking
-- Date: 2026-03-27

BEGIN;

-- 1. Add unit_cost_price to inventory (needed for BS and COGS calculation)
ALTER TABLE public.inventory 
ADD COLUMN IF NOT EXISTS unit_cost_price NUMERIC(12, 2) DEFAULT 0;

-- 2. Update financial_ledger constraints to include COGS
-- First, identify the constraint name. 20260319 used 'financial_ledger_entry_type_check'
ALTER TABLE financial_ledger DROP CONSTRAINT IF EXISTS financial_ledger_entry_type_check;
ALTER TABLE financial_ledger ADD CONSTRAINT financial_ledger_entry_type_check 
CHECK (entry_type IN ('INCOME', 'EXPENSE', 'ASSET_PURCHASE', 'LIABILITY_REPAYMENT', 'SUPPLIER_PAYMENT', 'INVENTORY_PURCHASE', 'PAYROLL', 'EQUITY', 'MANUAL', 'COGS'));

-- 3. Update receive_purchase_order to track cost price in inventory
CREATE OR REPLACE FUNCTION public.receive_purchase_order(
    p_order_id UUID,
    p_received_by UUID
)
RETURNS VOID AS $$
DECLARE
    v_po RECORD;
    v_item RECORD;
    v_inventory_id UUID;
    v_units_per_pack INTEGER; 
    v_calculated_unit_cost NUMERIC;
BEGIN
    -- 1. Get and Validate Purchase Order
    SELECT * INTO v_po FROM public.purchase_orders WHERE id = p_order_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Purchase Order not found'; END IF;
    IF v_po.status = 'received' THEN RAISE EXCEPTION 'This order has already been received'; END IF;

    -- 2. Update Purchase Order Status
    UPDATE public.purchase_orders SET status = 'received', received_at = now(), updated_at = now() WHERE id = p_order_id;

    -- 3. Process each item in the order
    FOR v_item IN (SELECT * FROM public.purchase_order_items WHERE purchase_order_id = p_order_id) LOOP
        -- Default units_per_pack comes from the item record in the PO
        v_units_per_pack := COALESCE(v_item.units_per_pack, 1);
        
        -- ACCRUAL FIX: Calculate unit cost (pack price / units per pack)
        v_calculated_unit_cost := COALESCE(v_item.unit_price, 0) / NULLIF(v_units_per_pack, 0);

        -- Try to find existing inventory item in the destination clinic
        IF v_item.inventory_item_id IS NOT NULL THEN
            v_inventory_id := v_item.inventory_item_id;
            SELECT COALESCE(units_per_pack, v_units_per_pack) INTO v_units_per_pack FROM public.inventory WHERE id = v_inventory_id;
        ELSE
            SELECT id INTO v_inventory_id FROM public.inventory 
            WHERE LOWER(TRIM(item_name)) = LOWER(TRIM(v_item.item_name)) AND clinic_id = v_po.clinic_id LIMIT 1;
            IF v_inventory_id IS NOT NULL THEN
                SELECT COALESCE(units_per_pack, v_units_per_pack) INTO v_units_per_pack FROM public.inventory WHERE id = v_inventory_id;
            END IF;
        END IF;

        IF v_inventory_id IS NOT NULL THEN
            -- Update existing stock
            UPDATE public.inventory SET 
                quantity = quantity + (v_item.quantity_ordered * v_units_per_pack),
                unit_cost_price = v_calculated_unit_cost, -- Track latest cost
                last_updated = now()
            WHERE id = v_inventory_id;
            
            INSERT INTO public.stock_logs (inventory_id, change_amount, reason, created_by)
            VALUES (v_inventory_id, (v_item.quantity_ordered * v_units_per_pack), 'PURCHASE_ORDER (#' || v_po.order_number || ')', p_received_by);
        ELSE
            -- Create new inventory record
            INSERT INTO public.inventory (clinic_id, hospital_id, item_name, quantity, units_per_pack, mrp, unit_cost_price, batch_number, expiry_date, threshold)
            VALUES (v_po.clinic_id, v_po.hospital_id, v_item.item_name, (v_item.quantity_ordered * v_units_per_pack), v_units_per_pack, COALESCE(v_item.mrp, 0), v_calculated_unit_cost, COALESCE(v_item.batch_number, 'PO-' || v_po.order_number), COALESCE(v_item.expiry_date, CURRENT_DATE + INTERVAL '1 year'), 10)
            RETURNING id INTO v_inventory_id;
            
            INSERT INTO public.stock_logs (inventory_id, change_amount, reason, created_by)
            VALUES (v_inventory_id, (v_item.quantity_ordered * v_units_per_pack), 'PO_INITIAL_STOCK (#' || v_po.order_number || ')', p_received_by);
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Update process_sale to record unit_cost_price in sale_items
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
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_sale_id UUID;
    v_item RECORD;
    v_current_cost NUMERIC;
BEGIN
    -- Auth check
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (clinic_id = p_clinic_id OR role IN ('HOSPITAL_ADMIN', 'SUPER_ADMIN', 'OWNER'))) THEN
        RAISE EXCEPTION 'Unauthorized: You do not have permission to process sales for this clinic branch.';
    END IF;

    -- Core sale insert 
    INSERT INTO sales (hospital_id, clinic_id, patient_name, doctor_name, sale_type, payment_mode, amount, subtotal, discount_percentage)
    VALUES (p_hospital_id, p_clinic_id, p_patient_name, p_doctor_name, p_sale_type, p_payment_mode, p_amount, p_subtotal, p_discount_percentage)
    RETURNING id INTO v_sale_id;

    -- Process items if PHARMACY
    IF p_sale_type = 'PHARMACY' AND p_items IS NOT NULL THEN
        FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(inventory_id UUID, quantity INT, price NUMERIC, is_loose_sale BOOLEAN, units_sold INT) LOOP
            
            -- ACCRUAL FIX: Fetch current cost price from inventory template
            SELECT unit_cost_price INTO v_current_cost FROM inventory WHERE id = v_item.inventory_id;
            
            -- Deduct stock 
            UPDATE inventory SET quantity = quantity - v_item.quantity WHERE id = v_item.inventory_id;
            
            -- Log item with cost capture
            INSERT INTO sale_items (sale_id, inventory_id, quantity, price, unit_cost_price, is_loose_sale, units_sold)
            VALUES (v_sale_id, v_item.inventory_id, v_item.quantity, v_item.price, COALESCE(v_current_cost, 0), COALESCE(v_item.is_loose_sale, FALSE), COALESCE(v_item.units_sold, v_item.quantity));
        END LOOP;
    END IF;

    RETURN v_sale_id;
END;
$$;

-- 5. Create Trigger for Automated COGS Ledger Entries
CREATE OR REPLACE FUNCTION log_cogs_to_ledger()
RETURNS TRIGGER AS $$
DECLARE
    v_hospital_id UUID;
    v_clinic_id UUID;
    v_timestamp TIMESTAMPTZ;
    v_total_cost NUMERIC;
    v_item_name TEXT;
BEGIN
    -- Fetch sale metadata
    SELECT hospital_id, clinic_id, timestamp INTO v_hospital_id, v_clinic_id, v_timestamp FROM sales WHERE id = NEW.sale_id;
    
    -- Fetch item name for description
    SELECT item_name INTO v_item_name FROM inventory WHERE id = NEW.inventory_id;
    
    -- Calculate total COGS for this item
    v_total_cost := NEW.quantity * COALESCE(NEW.unit_cost_price, 0);

    IF v_total_cost > 0 THEN
        -- Debit: Cost of Goods Sold (Expense Account)
        INSERT INTO financial_ledger (id, hospital_id, clinic_id, entry_date, reference_id, debit, credit, entry_type, category, description)
        VALUES (gen_random_uuid(), v_hospital_id, v_clinic_id, v_timestamp, NEW.id, v_total_cost, 0, 'COGS', 'Cost of Goods Sold', 'COGS for ' || v_item_name);

        -- Credit: Inventory (Asset Account decrease)
        INSERT INTO financial_ledger (id, hospital_id, clinic_id, entry_date, reference_id, debit, credit, entry_type, category, description)
        VALUES (gen_random_uuid(), v_hospital_id, v_clinic_id, v_timestamp, NEW.id, 0, v_total_cost, 'COGS', 'Inventory', 'Stock reduction for ' || v_item_name);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_log_cogs_after_sale_item ON sale_items;
CREATE TRIGGER trg_log_cogs_after_sale_item
AFTER INSERT ON sale_items
FOR EACH ROW EXECUTE FUNCTION log_cogs_to_ledger();

-- 6. Update get_financial_statement to include COGS in P&L
CREATE OR REPLACE FUNCTION public.get_financial_statement(
    p_hospital_id UUID,
    p_report_type TEXT, 
    p_as_of_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_income DECIMAL := 0;
    v_total_expense DECIMAL := 0;
    v_net_profit DECIMAL := 0;
    v_cash_balance DECIMAL := 0;
    v_total_assets DECIMAL := 0;
    v_total_liabilities DECIMAL := 0;
    v_equity DECIMAL := 0;
    v_inventory_value DECIMAL := 0;
    v_equipment_value DECIMAL := 0;
    v_accounts_payable DECIMAL := 0;
    v_breakdown JSONB;
BEGIN
    IF p_report_type = 'PL' THEN
        -- Income Breakdown
        SELECT jsonb_object_agg(category, total)
        INTO v_breakdown
        FROM (
            SELECT category, SUM(credit) as total
            FROM financial_ledger
            WHERE hospital_id = p_hospital_id 
            AND entry_type = 'INCOME'
            AND credit > 0
            AND entry_date::date <= p_as_of_date
            GROUP BY category
        ) s;

        SELECT COALESCE(SUM(credit), 0) INTO v_total_income
        FROM financial_ledger
        WHERE hospital_id = p_hospital_id AND entry_type = 'INCOME' AND credit > 0 AND entry_date::date <= p_as_of_date;

        -- Expense Breakdown (Now includes COGS)
        DECLARE
            v_expense_breakdown JSONB;
        BEGIN
            SELECT jsonb_object_agg(category, total)
            INTO v_expense_breakdown
            FROM (
                SELECT category, SUM(debit) as total
                FROM financial_ledger
                WHERE hospital_id = p_hospital_id 
                AND entry_type IN ('EXPENSE', 'PAYROLL', 'COGS')
                AND debit > 0
                AND entry_date::date <= p_as_of_date
                GROUP BY category
            ) s;
            v_breakdown := v_breakdown || jsonb_build_object('Expenses', v_expense_breakdown);
        END;

        SELECT COALESCE(SUM(debit), 0) INTO v_total_expense
        FROM financial_ledger
        WHERE hospital_id = p_hospital_id AND entry_type IN ('EXPENSE', 'PAYROLL', 'COGS') AND debit > 0 AND entry_date::date <= p_as_of_date;

        v_net_profit := v_total_income - v_total_expense;

        RETURN jsonb_build_object(
            'total_income', v_total_income,
            'total_expense', v_total_expense,
            'net_profit', v_net_profit,
            'breakdown', v_breakdown
        );

    ELSIF p_report_type = 'BS' THEN
        -- 1. Fixed Assets (Equipment)
        SELECT COALESCE(SUM(debit - credit), 0) INTO v_equipment_value
        FROM financial_ledger
        WHERE hospital_id = p_hospital_id AND category = 'Fixed Assets' AND entry_date <= p_as_of_date;
        
        -- 2. Inventory Value
        SELECT COALESCE(SUM(quantity * unit_cost_price), 0) INTO v_inventory_value
        FROM inventory
        WHERE hospital_id = p_hospital_id;
        
        -- 3. Liabilities
        SELECT COALESCE(SUM(current_credit), 0) INTO v_total_liabilities
        FROM suppliers WHERE hospital_id = p_hospital_id;
        
        -- 4. Cash Balance
        DECLARE
            v_cash_in DECIMAL := 0;
            v_cash_out DECIMAL := 0;
            v_cash_categories TEXT[] := ARRAY['Cash', 'Bank', 'HDFC Bank', 'Petty Cash', 'UPI', 'Bank Transfer'];
        BEGIN
            SELECT COALESCE(SUM(debit), 0) INTO v_cash_in FROM financial_ledger
            WHERE hospital_id = p_hospital_id AND entry_date <= p_as_of_date AND category = ANY(v_cash_categories);

            SELECT COALESCE(SUM(credit), 0) INTO v_cash_out FROM financial_ledger
            WHERE hospital_id = p_hospital_id AND entry_date <= p_as_of_date AND category = ANY(v_cash_categories);
            
            v_cash_balance := v_cash_in - v_cash_out;
        END;

        v_total_assets := v_cash_balance + v_equipment_value + v_inventory_value;
        v_equity := v_total_assets - v_total_liabilities;

        RETURN jsonb_build_object(
            'total_assets', v_total_assets,
            'total_liabilities', v_total_liabilities,
            'equity', v_equity,
            'breakdown', jsonb_build_object(
                'cash', v_cash_balance,
                'equipment', v_equipment_value,
                'inventory', v_inventory_value
            )
        );
    END IF;
END;
$$;

COMMIT;
