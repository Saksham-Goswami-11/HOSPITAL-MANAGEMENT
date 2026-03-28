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
            AND credit > 0 -- Only sum the Revenue side of the double entry
            AND entry_date::date <= p_as_of_date
            GROUP BY category
        ) s;

        SELECT COALESCE(SUM(credit), 0) INTO v_total_income
        FROM financial_ledger
        WHERE hospital_id = p_hospital_id AND entry_type = 'INCOME' AND credit > 0 AND entry_date::date <= p_as_of_date;

        -- Expense Breakdown (Includes EXPENSE and PAYROLL)
        SELECT jsonb_object_agg(category, total)
        INTO v_breakdown
        FROM (
            SELECT category, SUM(debit) as total
            FROM financial_ledger
            WHERE hospital_id = p_hospital_id 
            AND entry_type IN ('EXPENSE', 'PAYROLL')
            AND debit > 0 -- Only sum the Expense side of the double entry
            AND entry_date::date <= p_as_of_date
            GROUP BY category
        ) s;

        SELECT COALESCE(SUM(debit), 0) INTO v_total_expense
        FROM financial_ledger
        WHERE hospital_id = p_hospital_id AND entry_type IN ('EXPENSE', 'PAYROLL') AND debit > 0 AND entry_date::date <= p_as_of_date;

        v_net_profit := v_total_income - v_total_expense;

        RETURN jsonb_build_object(
            'total_income', v_total_income,
            'total_expense', v_total_expense,
            'net_profit', v_net_profit,
            'income', v_total_income,
            'breakdown', COALESCE(v_breakdown, '{}'::jsonb)
        );

    ELSIF p_report_type = 'BS' THEN
        -- 1. Fixed Assets (Equipment) from Ledger
        SELECT COALESCE(SUM(debit - credit), 0) INTO v_equipment_value
        FROM financial_ledger
        WHERE hospital_id = p_hospital_id AND category = 'Fixed Assets' AND entry_date <= p_as_of_date;
        
        -- 2. Inventory Value (Hybrid: use actual physical stock to be 100% accurate to pharmacy dashboard)
        SELECT COALESCE(SUM(quantity * unit_cost_price), 0) INTO v_inventory_value
        FROM inventory
        WHERE hospital_id = p_hospital_id;
        
        -- 3. Liabilities (Accounts Payable)
        -- Can use ledger's Accounts Payable balance: Sum(Credit - Debit)
        SELECT COALESCE(SUM(credit - debit), 0) INTO v_accounts_payable
        FROM financial_ledger
        WHERE hospital_id = p_hospital_id AND category = 'Accounts Payable' AND entry_date <= p_as_of_date;

        -- Override Payables with actual Suppliers table just for safety to match Procurement dashboard perfectly
        SELECT COALESCE(SUM(current_credit), 0) INTO v_total_liabilities
        FROM suppliers WHERE hospital_id = p_hospital_id;
        
        -- 4. Cash Balance
        -- Cash = Net Cash Flows from the completely double-entry unified ledger.
        
        DECLARE
            v_cash_in DECIMAL := 0;
            v_cash_out DECIMAL := 0;
            v_cash_categories TEXT[] := ARRAY['Cash', 'Bank', 'HDFC Bank', 'Petty Cash', 'Cash in Hand', 'Bank Transfer', 'UPI', 'Google Pay', 'Credit Card', 'Debit Card', 'Cheque'];
        BEGIN
            -- Sum of all cash INS (Debits to Cash Categories)
            SELECT COALESCE(SUM(debit), 0) INTO v_cash_in
            FROM financial_ledger
            WHERE hospital_id = p_hospital_id
            AND entry_date <= p_as_of_date
            AND category = ANY(v_cash_categories);

            -- Sum of all cash OUTS (Credits to Cash Categories)
            SELECT COALESCE(SUM(credit), 0) INTO v_cash_out
            FROM financial_ledger
            WHERE hospital_id = p_hospital_id
            AND entry_date <= p_as_of_date
            AND category = ANY(v_cash_categories);
            
            v_cash_balance := v_cash_in - v_cash_out;
        END;

        v_total_assets := v_cash_balance + v_equipment_value + v_inventory_value;
        v_equity := v_total_assets - v_total_liabilities;

        v_breakdown := jsonb_build_object(
            'cash', v_cash_balance,
            'equipment', v_equipment_value,
            'inventory', v_inventory_value
        );

        RETURN jsonb_build_object(
            'total_assets', v_total_assets,
            'total_liabilities', v_total_liabilities,
            'equity', v_equity,
            'breakdown', v_breakdown
        );
    END IF;
END;
$$;
