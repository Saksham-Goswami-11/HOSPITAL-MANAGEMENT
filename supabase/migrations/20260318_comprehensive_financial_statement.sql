-- Upgrade get_financial_statement RPC to include Procurement Orders, Equipments, and fix BS logic
-- This version merges all sources of expenditure into a unified P&L breakdown.

CREATE OR REPLACE FUNCTION public.get_financial_statement(p_hospital_id uuid, p_type text, p_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_result jsonb;
    v_income numeric := 0;
    v_expense numeric := 0;
    v_other_expense numeric := 0;
    v_equipment_expense numeric := 0;
    v_procurement_expense numeric := 0;
    v_inventory_value numeric := 0;
    v_equipment_value numeric := 0;
    v_cash_balance numeric := 0;
    v_total_liabilities numeric := 0;
    v_equity numeric := 0;
    v_category_breakdown jsonb := '{}'::jsonb;
BEGIN
    IF p_type = 'PL' THEN
        -- 1. Get Income from Ledger (SALE categories)
        SELECT COALESCE(SUM(credit), 0)
        INTO v_income
        FROM public.financial_ledger
        WHERE hospital_id = p_hospital_id
        AND entry_date::date <= p_date
        AND entry_type = 'INCOME';

        -- 2. Construct Breakdown from multiple sources
        
        -- A. Ledger entries (Directly posted expenses)
        SELECT COALESCE(jsonb_object_agg(category, total_amount), '{}'::jsonb)
        INTO v_category_breakdown
        FROM (
            SELECT category, SUM(debit) as total_amount
            FROM public.financial_ledger
            WHERE hospital_id = p_hospital_id
            AND entry_date::date <= p_date
            AND entry_type = 'EXPENSE'
            AND debit > 0
            GROUP BY category
        ) sub;

        -- B. Other Expenses (Include if NOT in ledger to avoid double counting)
        SELECT v_category_breakdown || COALESCE(jsonb_object_agg(category, total_amount), '{}'::jsonb)
        INTO v_category_breakdown
        FROM (
            SELECT category, SUM(amount) as total_amount
            FROM public.other_expenses
            WHERE hospital_id = p_hospital_id
            AND expense_date <= p_date
            AND NOT EXISTS (
                SELECT 1 FROM public.financial_ledger fl
                WHERE fl.hospital_id = p_hospital_id
                AND fl.reference_id = other_expenses.id
            )
            GROUP BY category
        ) sub;

        -- C. Hospital Equipments (Include as "Equipment Purchases")
        SELECT COALESCE(SUM(COALESCE(purchase_price, purchase_cost * quantity, 0)), 0)
        INTO v_equipment_expense
        FROM public.hospital_equipments
        WHERE hospital_id = p_hospital_id
        AND purchase_date <= p_date;

        IF v_equipment_expense > 0 THEN
            v_category_breakdown := v_category_breakdown || jsonb_build_object('Equipment Purchases', v_equipment_expense);
        END IF;

        -- D. Procurement Orders (All received/completed purchases)
        SELECT COALESCE(SUM(total_amount), 0)
        INTO v_procurement_expense
        FROM public.purchase_orders
        WHERE hospital_id = p_hospital_id
        AND order_date <= p_date
        AND status IN ('received', 'completed', 'received_partial');

        IF v_procurement_expense > 0 THEN
            v_category_breakdown := v_category_breakdown || jsonb_build_object('Procurement Purchases', v_procurement_expense);
        END IF;

        -- 3. Calculate Final Totals
        -- Sum all values in v_category_breakdown to get total_expense
        SELECT COALESCE(SUM(value::numeric), 0)
        INTO v_expense
        FROM jsonb_each_text(v_category_breakdown);

        v_result := jsonb_build_object(
            'total_income', v_income,
            'total_expense', v_expense,
            'net_profit', v_income - v_expense,
            'income', v_income,
            'breakdown', v_category_breakdown
        );

    ELSIF p_type = 'BS' THEN
        -- 1. Asset Valuations
        SELECT COALESCE(SUM(quantity * unit_cost_price), 0)
        INTO v_inventory_value
        FROM public.inventory
        WHERE hospital_id = p_hospital_id;

        SELECT COALESCE(SUM(COALESCE(purchase_price, purchase_cost * quantity, 0)), 0)
        INTO v_equipment_value
        FROM public.hospital_equipments
        WHERE hospital_id = p_hospital_id;

        -- 2. Cash Balance from Ledger (Net Sum)
        SELECT COALESCE(SUM(credit - debit), 0)
        INTO v_cash_balance
        FROM public.financial_ledger
        WHERE hospital_id = p_hospital_id
        AND entry_date::date <= p_date;

        -- 3. Outstanding Liabilities (Sundry Creditors)
        SELECT COALESCE(SUM(current_credit), 0)
        INTO v_total_liabilities
        FROM public.suppliers
        WHERE hospital_id = p_hospital_id;

        -- 4. Equity Calculation
        -- Net Worth = Assets - Liabilities
        -- Initial Capital = Net Worth - Current Profit (to present separately)
        
        -- Total Assets Calculation (Standard Accounting: Cash + Inventory + Fixed Assets)
        -- Note: If Cash is negative, it's technically a liability (Overdraft), but we show it in Assets breakdown.
        
        v_equity := (v_inventory_value + v_equipment_value + v_cash_balance) - v_total_liabilities;

        v_result := jsonb_build_object(
            'total_assets', v_inventory_value + v_equipment_value + v_cash_balance, -- Fixed: removed ABS
            'total_liabilities', v_total_liabilities,
            'equity', v_equity,
            'breakdown', jsonb_build_object(
                'inventory', v_inventory_value,
                'equipment', v_equipment_value,
                'cash', v_cash_balance,
                'liabilities', v_total_liabilities
            )
        );
    END IF;

    RETURN v_result;
END;
$function$;
