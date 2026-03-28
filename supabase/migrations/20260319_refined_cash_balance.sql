-- Refined get_financial_statement with accurate cash balance logic
CREATE OR REPLACE FUNCTION public.get_financial_statement(
    p_hospital_id UUID,
    p_report_type TEXT, -- 'PL' for Profit & Loss, 'BS' for Balance Sheet
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
            AND entry_date <= p_as_of_date
            GROUP BY category
        ) s;

        SELECT COALESCE(SUM(credit), 0) INTO v_total_income
        FROM financial_ledger
        WHERE hospital_id = p_hospital_id AND entry_type = 'INCOME' AND entry_date <= p_as_of_date;

        -- Expense Breakdown (Excluding Asset Purchases)
        SELECT jsonb_object_agg(category, total)
        INTO v_breakdown
        FROM (
            SELECT category, SUM(debit) as total
            FROM financial_ledger
            WHERE hospital_id = p_hospital_id 
            AND entry_type = 'EXPENSE'
            AND entry_date <= p_as_of_date
            GROUP BY category
        ) s;

        SELECT COALESCE(SUM(debit), 0) INTO v_total_expense
        FROM financial_ledger
        WHERE hospital_id = p_hospital_id AND entry_type = 'EXPENSE' AND entry_date <= p_as_of_date;

        v_net_profit := v_total_income - v_total_expense;

        RETURN jsonb_build_object(
            'total_income', v_total_income,
            'total_expense', v_total_expense,
            'net_profit', v_net_profit,
            'income', v_total_income, -- For backward compatibility
            'breakdown', COALESCE(v_breakdown, '{}'::jsonb)
        );

    ELSIF p_report_type = 'BS' THEN
        -- 1. Cash Balance = Sum(Credits - Debits) for non-cash accounts
        -- This represents where the cash has come from (Credits) and gone to (Debits)
        -- in the context of double-entry logic applied to non-cash movements.
        -- Basically: Assets = Liabilities + Equity => Cash + Non-Cash Assets = Liabilities + Equity
        -- Cash = (Liabilities + Equity) - Non-Cash Assets
        -- Change in Cash = Sum(Change in Liabilities/Equity [Credits]) - Sum(Change in Non-Cash Assets [Debits])
        SELECT COALESCE(SUM(COALESCE(credit, 0) - COALESCE(debit, 0)), 0) INTO v_cash_balance
        FROM financial_ledger 
        WHERE hospital_id = p_hospital_id 
        AND entry_date <= p_as_of_date
        AND category NOT IN ('Cash', 'Bank', 'HDFC Bank', 'Petty Cash', 'Cash in Hand');

        -- 2. Fixed Assets (Equipment)
        SELECT COALESCE(SUM(COALESCE(purchase_price, purchase_cost * quantity, 0)), 0) INTO v_total_assets
        FROM hospital_equipments
        WHERE hospital_id = p_hospital_id AND purchase_date <= p_as_of_date;

        -- 3. Inventory Value
        -- We'll sum current stock * unit_price from pharmacy_inventory
        -- Note: simplified for this version
        DECLARE
            v_inventory_value DECIMAL := 0;
        BEGIN
            SELECT COALESCE(SUM(current_stock * unit_price), 0) INTO v_inventory_value
            FROM pharmacy_inventory
            WHERE hospital_id = p_hospital_id;
            
            v_total_assets := v_total_assets + v_inventory_value;
            
            -- Combine Assets
            v_breakdown := jsonb_build_object(
                'cash', v_cash_balance,
                'equipment', (SELECT COALESCE(SUM(COALESCE(purchase_price, purchase_cost * quantity, 0)), 0) FROM hospital_equipments WHERE hospital_id = p_hospital_id AND purchase_date <= p_as_of_date),
                'inventory', v_inventory_value
            );
        END;

        -- 4. Liabilities (Supplier Payables)
        SELECT COALESCE(SUM(current_credit), 0) INTO v_total_liabilities
        FROM suppliers WHERE hospital_id = p_hospital_id;

        v_equity := (v_cash_balance + (v_breakdown->>'equipment')::DECIMAL + (v_breakdown->>'inventory')::DECIMAL) - v_total_liabilities;

        RETURN jsonb_build_object(
            'total_assets', (v_cash_balance + (v_breakdown->>'equipment')::DECIMAL + (v_breakdown->>'inventory')::DECIMAL),
            'total_liabilities', v_total_liabilities,
            'equity', v_equity,
            'breakdown', v_breakdown
        );
    END IF;
END;
$$;
