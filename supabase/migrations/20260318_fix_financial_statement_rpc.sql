-- Fix get_financial_statement RPC: remove entry_type filter, include other_expenses 
-- and hospital_equipments in P&L, fix purchase_price/purchase_cost mismatch

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
    v_inventory_value numeric := 0;
    v_equipment_value numeric := 0;
    v_cash_balance numeric := 0;
    v_total_liabilities numeric := 0;
    v_equity numeric := 0;
    v_category_breakdown jsonb := '{}'::jsonb;
BEGIN
    IF p_type = 'PL' THEN
        SELECT COALESCE(SUM(credit), 0)
        INTO v_income
        FROM public.financial_ledger
        WHERE hospital_id = p_hospital_id
        AND entry_date::date <= p_date;

        SELECT COALESCE(SUM(debit), 0)
        INTO v_expense
        FROM public.financial_ledger
        WHERE hospital_id = p_hospital_id
        AND entry_date::date <= p_date;

        SELECT COALESCE(SUM(amount), 0)
        INTO v_other_expense
        FROM public.other_expenses
        WHERE hospital_id = p_hospital_id
        AND expense_date <= p_date;

        SELECT COALESCE(SUM(COALESCE(purchase_price, purchase_cost * quantity, 0)), 0)
        INTO v_equipment_expense
        FROM public.hospital_equipments
        WHERE hospital_id = p_hospital_id
        AND purchase_date <= p_date;

        SELECT COALESCE(jsonb_object_agg(category, total_amount), '{}'::jsonb)
        INTO v_category_breakdown
        FROM (
            SELECT category, SUM(debit) as total_amount
            FROM public.financial_ledger
            WHERE hospital_id = p_hospital_id
            AND entry_date::date <= p_date
            AND debit > 0
            GROUP BY category
        ) sub;

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

        IF v_expense > 0 THEN
            v_result := jsonb_build_object(
                'total_income', v_income,
                'total_expense', v_expense,
                'net_profit', v_income - v_expense,
                'income', v_income,
                'breakdown', v_category_breakdown
            );
        ELSE
            v_expense := v_other_expense + v_equipment_expense;
            v_result := jsonb_build_object(
                'total_income', v_income,
                'total_expense', v_expense,
                'net_profit', v_income - v_expense,
                'income', v_income,
                'breakdown', v_category_breakdown
            );
        END IF;

    ELSIF p_type = 'BS' THEN
        SELECT COALESCE(SUM(quantity * unit_cost_price), 0)
        INTO v_inventory_value
        FROM public.inventory
        WHERE hospital_id = p_hospital_id;

        SELECT COALESCE(SUM(COALESCE(purchase_price, purchase_cost * quantity, 0)), 0)
        INTO v_equipment_value
        FROM public.hospital_equipments
        WHERE hospital_id = p_hospital_id;

        SELECT COALESCE(SUM(credit - debit), 0)
        INTO v_cash_balance
        FROM public.financial_ledger
        WHERE hospital_id = p_hospital_id
        AND entry_date::date <= p_date;

        SELECT COALESCE(SUM(current_credit), 0)
        INTO v_total_liabilities
        FROM public.suppliers
        WHERE hospital_id = p_hospital_id;

        v_equity := (v_inventory_value + v_equipment_value + v_cash_balance) - v_total_liabilities;

        v_result := jsonb_build_object(
            'total_assets', v_inventory_value + v_equipment_value + ABS(v_cash_balance),
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
