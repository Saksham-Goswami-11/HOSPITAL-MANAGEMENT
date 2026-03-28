-- Migration: Fix get_financial_statement RPC output format
-- Date: 2026-03-29

BEGIN;

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
BEGIN
    IF p_report_type = 'PL' THEN
        -- Income Breakdown
        SELECT jsonb_object_agg(category, total)
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

        -- Expense Breakdown (Now includes COGS)
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

        SELECT COALESCE(SUM(debit), 0) INTO v_total_expense
        FROM financial_ledger
        WHERE hospital_id = p_hospital_id AND entry_type IN ('EXPENSE', 'PAYROLL', 'COGS') AND debit > 0 AND entry_date::date <= p_as_of_date;

        v_net_profit := v_total_income - v_total_expense;

        RETURN jsonb_build_object(
            'total_income', v_total_income,
            'total_expense', v_total_expense,
            'net_profit', v_net_profit,
            'income_breakdown', COALESCE(v_income_breakdown, '{}'::jsonb),
            'expense_breakdown', COALESCE(v_expense_breakdown, '{}'::jsonb)
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
