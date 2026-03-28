-- 1. UPDATE PO TRIGGER TO INCLUDE 'received' STATUS
CREATE OR REPLACE FUNCTION unified_log_po_to_ledger()
RETURNS TRIGGER AS $$
BEGIN
    -- Log when status is 'received' or 'DELIVERED'
    -- (Support both just in case)
    IF (NEW.status IN ('received', 'DELIVERED')) AND (TG_OP = 'INSERT' OR (OLD.status NOT IN ('received', 'DELIVERED'))) THEN
        -- Debit (Inventory Asset increase)
        -- We log to 'Inventory' category
        INSERT INTO financial_ledger (id, hospital_id, clinic_id, entry_date, reference_id, debit, credit, entry_type, category, description, payment_mode)
        VALUES (gen_random_uuid(), NEW.hospital_id, NEW.clinic_id, COALESCE(NEW.received_at, NEW.updated_at, CURRENT_TIMESTAMP), NEW.id, NEW.total_amount, 0, 'INVENTORY_PURCHASE', 'Inventory', 'Inventory receipt (PO #' || COALESCE(NEW.order_number, '') || ')', NEW.payment_mode);
        
        -- Credit (Liability increase)
        -- We log to 'Accounts Payable'
        INSERT INTO financial_ledger (id, hospital_id, clinic_id, entry_date, reference_id, debit, credit, entry_type, category, description, payment_mode)
        VALUES (gen_random_uuid(), NEW.hospital_id, NEW.clinic_id, COALESCE(NEW.received_at, NEW.updated_at, CURRENT_TIMESTAMP), NEW.id, 0, NEW.total_amount, 'INVENTORY_PURCHASE', 'Accounts Payable', 'Liability for PO', NEW.payment_mode);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. RE-REBUILD INVENTORY IN LEDGER
DELETE FROM financial_ledger WHERE entry_type = 'INVENTORY_PURCHASE';

INSERT INTO financial_ledger (id, hospital_id, clinic_id, entry_date, reference_id, debit, credit, entry_type, category, description, payment_mode)
SELECT gen_random_uuid(), hospital_id, clinic_id, COALESCE(received_at, updated_at, CURRENT_TIMESTAMP), id, total_amount, 0, 'INVENTORY_PURCHASE', 'Inventory', 'Inventory receipt (PO #' || COALESCE(order_number, '') || ')', payment_mode 
FROM purchase_orders 
WHERE status IN ('received', 'DELIVERED');

INSERT INTO financial_ledger (id, hospital_id, clinic_id, entry_date, reference_id, debit, credit, entry_type, category, description, payment_mode)
SELECT gen_random_uuid(), hospital_id, clinic_id, COALESCE(received_at, updated_at, CURRENT_TIMESTAMP), id, 0, total_amount, 'INVENTORY_PURCHASE', 'Accounts Payable', 'Liability for PO', payment_mode 
FROM purchase_orders 
WHERE status IN ('received', 'DELIVERED');

-- 3. FIX GET_FINANCIAL_STATEMENT RPC
-- Includes ALL expenditure types in P&L breakdown and top-level BS fields
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
    v_income_breakdown JSONB;
    v_expense_breakdown JSONB;
    v_cash_categories TEXT[] := ARRAY['Cash', 'Bank', 'HDFC Bank', 'Petty Cash', 'Cash in Hand', 'Bank Transfer', 'UPI', 'Google Pay', 'Credit Card', 'Debit Card', 'Cheque'];
BEGIN
    IF p_report_type = 'PL' THEN
        -- Income Breakdown
        SELECT COALESCE(jsonb_object_agg(category, total), '{}'::jsonb)
        INTO v_income_breakdown
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

        -- Expense Breakdown: ALL expenditure types (EXPENSE, PAYROLL, INVENTORY_PURCHASE, ASSET_PURCHASE)
        -- Excludes Cash/Bank counter-entries and Accounts Payable (those are balance sheet items)
        SELECT COALESCE(jsonb_object_agg(category, total), '{}'::jsonb)
        INTO v_expense_breakdown
        FROM (
            SELECT category, SUM(debit) as total
            FROM financial_ledger
            WHERE hospital_id = p_hospital_id 
            AND entry_type IN ('EXPENSE', 'PAYROLL', 'INVENTORY_PURCHASE', 'ASSET_PURCHASE')
            AND debit > 0 
            AND entry_date::date <= p_as_of_date
            AND category NOT IN ('Cash', 'Bank', 'HDFC Bank', 'Petty Cash', 'Cash in Hand', 'Bank Transfer', 'UPI', 'Google Pay', 'Credit Card', 'Debit Card', 'Cheque', 'Accounts Payable')
            GROUP BY category
        ) s;

        -- Total expense also includes ALL expenditure types
        SELECT COALESCE(SUM(debit), 0) INTO v_total_expense
        FROM financial_ledger
        WHERE hospital_id = p_hospital_id 
        AND entry_type IN ('EXPENSE', 'PAYROLL', 'INVENTORY_PURCHASE', 'ASSET_PURCHASE') 
        AND debit > 0 
        AND entry_date::date <= p_as_of_date
        AND category NOT IN ('Cash', 'Bank', 'HDFC Bank', 'Petty Cash', 'Cash in Hand', 'Bank Transfer', 'UPI', 'Google Pay', 'Credit Card', 'Debit Card', 'Cheque', 'Accounts Payable');

        v_net_profit := v_total_income - v_total_expense;

        RETURN jsonb_build_object(
            'total_income', v_total_income,
            'total_expense', v_total_expense,
            'net_profit', v_net_profit,
            'income', v_total_income,
            'breakdown', v_expense_breakdown,
            'income_breakdown', v_income_breakdown
        );

    ELSIF p_report_type = 'BS' THEN
        -- 1. Fixed Assets (Equipment) from Ledger
        SELECT COALESCE(SUM(debit - credit), 0) INTO v_equipment_value
        FROM financial_ledger
        WHERE hospital_id = p_hospital_id AND (category = 'Fixed Assets' OR entry_type = 'ASSET_PURCHASE') AND entry_date::date <= p_as_of_date
        AND NOT (category = ANY(v_cash_categories));
        
        -- 2. Inventory Value (Hybrid: use actual physical stock)
        SELECT COALESCE(SUM(quantity * unit_cost_price), 0) INTO v_inventory_value
        FROM inventory
        WHERE hospital_id = p_hospital_id;
        
        -- 3. Liabilities (Accounts Payable)
        SELECT COALESCE(SUM(credit - debit), 0) INTO v_accounts_payable
        FROM financial_ledger
        WHERE hospital_id = p_hospital_id AND category = 'Accounts Payable' AND entry_date::date <= p_as_of_date;

        v_total_liabilities := v_accounts_payable;
        
        -- 4. Cash Balance
        DECLARE
            v_cash_in DECIMAL := 0;
            v_cash_out DECIMAL := 0;
        BEGIN
            SELECT COALESCE(SUM(debit), 0) INTO v_cash_in
            FROM financial_ledger
            WHERE hospital_id = p_hospital_id
            AND entry_date::date <= p_as_of_date
            AND category = ANY(v_cash_categories);

            SELECT COALESCE(SUM(credit), 0) INTO v_cash_out
            FROM financial_ledger
            WHERE hospital_id = p_hospital_id
            AND entry_date::date <= p_as_of_date
            AND category = ANY(v_cash_categories);
            
            v_cash_balance := v_cash_in - v_cash_out;
        END;

        v_total_assets := v_cash_balance + v_equipment_value + v_inventory_value;
        v_equity := v_total_assets - v_total_liabilities;

        RETURN jsonb_build_object(
            'total_assets', v_total_assets,
            'total_liabilities', v_total_liabilities,
            'equity', v_equity,
            'cash_balance', v_cash_balance,
            'inventory_value', v_inventory_value,
            'equipment_value', v_equipment_value,
            'accounts_payable', v_accounts_payable,
            'cash', v_cash_balance,
            'assets', v_total_assets,
            'liabilities', v_total_liabilities
        );
    END IF;
END;
$$;
