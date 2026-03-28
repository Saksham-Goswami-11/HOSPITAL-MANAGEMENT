ALTER TABLE financial_ledger DROP CONSTRAINT IF EXISTS financial_ledger_entry_type_check;
ALTER TABLE financial_ledger ADD CONSTRAINT financial_ledger_entry_type_check 
CHECK (entry_type IN ('INCOME', 'EXPENSE', 'ASSET_PURCHASE', 'LIABILITY_REPAYMENT', 'SUPPLIER_PAYMENT', 'INVENTORY_PURCHASE', 'PAYROLL', 'EQUITY', 'MANUAL'));

-- 1. DROP EXISTING CONFLICTING TRIGGERS AND FUNCTIONS
DROP TRIGGER IF EXISTS trg_log_sale_to_ledger ON sales;
DROP FUNCTION IF EXISTS log_sale_to_ledger();

DROP TRIGGER IF EXISTS trg_log_expense_to_ledger ON other_expenses;
DROP FUNCTION IF EXISTS log_expense_to_ledger();

DROP TRIGGER IF EXISTS trg_log_equipment_to_ledger ON hospital_equipments;
DROP FUNCTION IF EXISTS log_equipment_to_ledger();

-- 2. CREATE NEW DOUBLE-ENTRY FUNCTIONS

-- A. SALES (INCOME)
CREATE OR REPLACE FUNCTION unified_log_sale_to_ledger()
RETURNS TRIGGER AS $$
BEGIN
    -- Debit (Asset / Cash in)
    INSERT INTO financial_ledger (id, hospital_id, clinic_id, entry_date, reference_id, debit, credit, entry_type, category, description, payment_mode)
    VALUES (gen_random_uuid(), NEW.hospital_id, NEW.clinic_id, NEW.timestamp, NEW.id, NEW.amount, 0, 'INCOME', COALESCE(NEW.payment_mode, 'Cash'), 'Sale receipt', NEW.payment_mode);
    
    -- Credit (Revenue in)
    INSERT INTO financial_ledger (id, hospital_id, clinic_id, entry_date, reference_id, debit, credit, entry_type, category, description, payment_mode)
    VALUES (gen_random_uuid(), NEW.hospital_id, NEW.clinic_id, NEW.timestamp, NEW.id, 0, NEW.amount, 'INCOME', 'Sales Revenue', 'Sale income: ' || COALESCE(NEW.sale_type, ''), NEW.payment_mode);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_unified_log_sale
AFTER INSERT ON sales
FOR EACH ROW EXECUTE FUNCTION unified_log_sale_to_ledger();

-- B. OTHER EXPENSES (EXPENSE)
CREATE OR REPLACE FUNCTION unified_log_expense_to_ledger()
RETURNS TRIGGER AS $$
BEGIN
    -- Debit (Expense increase)
    INSERT INTO financial_ledger (id, hospital_id, clinic_id, entry_date, reference_id, debit, credit, entry_type, category, description, payment_mode)
    VALUES (gen_random_uuid(), NEW.hospital_id, NEW.clinic_id, NEW.expense_date, NEW.id, NEW.amount, 0, 'EXPENSE', COALESCE(NEW.category, 'Other Expense'), NEW.description, NEW.payment_mode);
    
    -- Credit (Asset / Cash decrease)
    INSERT INTO financial_ledger (id, hospital_id, clinic_id, entry_date, reference_id, debit, credit, entry_type, category, description, payment_mode)
    VALUES (gen_random_uuid(), NEW.hospital_id, NEW.clinic_id, NEW.expense_date, NEW.id, 0, NEW.amount, 'EXPENSE', COALESCE(NEW.payment_mode, 'Cash'), 'Expense payment', NEW.payment_mode);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_unified_log_expense
AFTER INSERT ON other_expenses
FOR EACH ROW EXECUTE FUNCTION unified_log_expense_to_ledger();

-- C. ASSET PURCHASES (EQUIPMENT)
CREATE OR REPLACE FUNCTION unified_log_equipment_to_ledger()
RETURNS TRIGGER AS $$
BEGIN
    -- Debit (Fixed Asset increase)
    INSERT INTO financial_ledger (id, hospital_id, clinic_id, entry_date, reference_id, debit, credit, entry_type, category, description, payment_mode)
    VALUES (gen_random_uuid(), NEW.hospital_id, NEW.clinic_id, NEW.purchase_date, NEW.id, COALESCE(NEW.purchase_price, 0), 0, 'ASSET_PURCHASE', 'Fixed Assets', NEW.name || ' (' || COALESCE(NEW.category, 'Equipment') || ')', 'Cash');
    
    -- Credit (Asset / Cash decrease)
    INSERT INTO financial_ledger (id, hospital_id, clinic_id, entry_date, reference_id, debit, credit, entry_type, category, description, payment_mode)
    VALUES (gen_random_uuid(), NEW.hospital_id, NEW.clinic_id, NEW.purchase_date, NEW.id, 0, COALESCE(NEW.purchase_price, 0), 'ASSET_PURCHASE', 'Cash', 'Equipment payment', 'Cash');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_unified_log_equipment
AFTER INSERT ON hospital_equipments
FOR EACH ROW EXECUTE FUNCTION unified_log_equipment_to_ledger();

-- D. SUPPLIER PAYMENTS
CREATE OR REPLACE FUNCTION unified_log_supplier_payment_to_ledger()
RETURNS TRIGGER AS $$
BEGIN
    -- Debit (Liability decrease)
    INSERT INTO financial_ledger (id, hospital_id, clinic_id, entry_date, reference_id, debit, credit, entry_type, category, description, payment_mode)
    VALUES (gen_random_uuid(), NEW.hospital_id, NULL, NEW.payment_date, NEW.id, NEW.amount, 0, 'SUPPLIER_PAYMENT', 'Accounts Payable', 'Payment to supplier', NEW.payment_method);
    
    -- Credit (Asset / Cash decrease)
    INSERT INTO financial_ledger (id, hospital_id, clinic_id, entry_date, reference_id, debit, credit, entry_type, category, description, payment_mode)
    VALUES (gen_random_uuid(), NEW.hospital_id, NULL, NEW.payment_date, NEW.id, 0, NEW.amount, 'SUPPLIER_PAYMENT', COALESCE(NEW.payment_method, 'Cash'), 'Supplier payment out', NEW.payment_method);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_unified_log_supplier_payment
AFTER INSERT ON supplier_payments
FOR EACH ROW EXECUTE FUNCTION unified_log_supplier_payment_to_ledger();

-- E. PURCHASE ORDERS (INVENTORY PURCHASES)
CREATE OR REPLACE FUNCTION unified_log_po_to_ledger()
RETURNS TRIGGER AS $$
BEGIN
    -- Only log when delivered
    IF NEW.status = 'DELIVERED' AND (TG_OP = 'INSERT' OR OLD.status != 'DELIVERED') THEN
        -- Debit (Inventory Expense/Asset increase)
        INSERT INTO financial_ledger (id, hospital_id, clinic_id, entry_date, reference_id, debit, credit, entry_type, category, description, payment_mode)
        VALUES (gen_random_uuid(), NEW.hospital_id, NEW.clinic_id, COALESCE(NEW.received_at, NEW.updated_at, CURRENT_TIMESTAMP), NEW.id, NEW.total_amount, 0, 'INVENTORY_PURCHASE', 'Inventory', 'Inventory receipt (PO #' || COALESCE(NEW.order_number, '') || ')', NEW.payment_mode);
        
        -- Credit (Liability increase)
        INSERT INTO financial_ledger (id, hospital_id, clinic_id, entry_date, reference_id, debit, credit, entry_type, category, description, payment_mode)
        VALUES (gen_random_uuid(), NEW.hospital_id, NEW.clinic_id, COALESCE(NEW.received_at, NEW.updated_at, CURRENT_TIMESTAMP), NEW.id, 0, NEW.total_amount, 'INVENTORY_PURCHASE', 'Accounts Payable', 'Liability for PO', NEW.payment_mode);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_unified_log_po
AFTER INSERT OR UPDATE ON purchase_orders
FOR EACH ROW EXECUTE FUNCTION unified_log_po_to_ledger();

-- F. PAYROLL
CREATE OR REPLACE FUNCTION unified_log_payroll_to_ledger()
RETURNS TRIGGER AS $$
BEGIN
    -- Only log when paid
    IF NEW.status = 'PAID' AND (TG_OP = 'INSERT' OR OLD.status != 'PAID') THEN
        -- Debit (Salary Expense increase)
        INSERT INTO financial_ledger (id, hospital_id, clinic_id, entry_date, reference_id, debit, credit, entry_type, category, description, payment_mode)
        VALUES (gen_random_uuid(), NEW.hospital_id, NEW.clinic_id, COALESCE(NEW.payment_date, CURRENT_TIMESTAMP), NEW.id, NEW.amount_paid, 0, 'PAYROLL', 'Salary Expense', 'Salary payment', 'Bank Transfer');
        
        -- Credit (Asset / Cash decrease)
        INSERT INTO financial_ledger (id, hospital_id, clinic_id, entry_date, reference_id, debit, credit, entry_type, category, description, payment_mode)
        VALUES (gen_random_uuid(), NEW.hospital_id, NEW.clinic_id, COALESCE(NEW.payment_date, CURRENT_TIMESTAMP), NEW.id, 0, NEW.amount_paid, 'PAYROLL', 'Cash/Bank', 'Salary paid out', 'Bank Transfer');
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_unified_log_payroll
AFTER INSERT OR UPDATE ON payroll_history
FOR EACH ROW EXECUTE FUNCTION unified_log_payroll_to_ledger();


-- 3. COMPLETELY REBUILD HISTORICAL FINANCIAL LEDGER
-- This wipes all automatically generated single entries and frontend double entries
-- and perfectly rebuilds the ledger from the source tables using our new standardized double-entry logic.

DELETE FROM financial_ledger WHERE entry_type IN ('INCOME', 'EXPENSE', 'ASSET_PURCHASE', 'SUPPLIER_PAYMENT', 'INVENTORY_PURCHASE', 'PAYROLL');

-- Rebuild Sales
INSERT INTO financial_ledger (id, hospital_id, clinic_id, entry_date, reference_id, debit, credit, entry_type, category, description, payment_mode)
SELECT gen_random_uuid(), hospital_id, clinic_id, timestamp, id, amount, 0, 'INCOME', COALESCE(payment_mode, 'Cash'), 'Sale receipt', payment_mode FROM sales;

INSERT INTO financial_ledger (id, hospital_id, clinic_id, entry_date, reference_id, debit, credit, entry_type, category, description, payment_mode)
SELECT gen_random_uuid(), hospital_id, clinic_id, timestamp, id, 0, amount, 'INCOME', 'Sales Revenue', 'Sale income: ' || COALESCE(sale_type, ''), payment_mode FROM sales;

-- Rebuild Expenses
INSERT INTO financial_ledger (id, hospital_id, clinic_id, entry_date, reference_id, debit, credit, entry_type, category, description, payment_mode)
SELECT gen_random_uuid(), hospital_id, clinic_id, expense_date, id, amount, 0, 'EXPENSE', COALESCE(category, 'Other Expense'), description, payment_mode FROM other_expenses;

INSERT INTO financial_ledger (id, hospital_id, clinic_id, entry_date, reference_id, debit, credit, entry_type, category, description, payment_mode)
SELECT gen_random_uuid(), hospital_id, clinic_id, expense_date, id, 0, amount, 'EXPENSE', COALESCE(payment_mode, 'Cash'), 'Expense payment', payment_mode FROM other_expenses;

-- Rebuild Equipment
INSERT INTO financial_ledger (id, hospital_id, clinic_id, entry_date, reference_id, debit, credit, entry_type, category, description, payment_mode)
SELECT gen_random_uuid(), hospital_id, clinic_id, purchase_date, id, COALESCE(purchase_price, 0), 0, 'ASSET_PURCHASE', 'Fixed Assets', name || ' (' || COALESCE(category, 'Equipment') || ')', 'Cash' FROM hospital_equipments;

INSERT INTO financial_ledger (id, hospital_id, clinic_id, entry_date, reference_id, debit, credit, entry_type, category, description, payment_mode)
SELECT gen_random_uuid(), hospital_id, clinic_id, purchase_date, id, 0, COALESCE(purchase_price, 0), 'ASSET_PURCHASE', 'Cash', 'Equipment payment', 'Cash' FROM hospital_equipments;

-- Rebuild Supplier Payments
INSERT INTO financial_ledger (id, hospital_id, clinic_id, entry_date, reference_id, debit, credit, entry_type, category, description, payment_mode)
SELECT gen_random_uuid(), hospital_id, NULL, payment_date, id, amount, 0, 'SUPPLIER_PAYMENT', 'Accounts Payable', 'Payment to supplier', payment_method FROM supplier_payments;

INSERT INTO financial_ledger (id, hospital_id, clinic_id, entry_date, reference_id, debit, credit, entry_type, category, description, payment_mode)
SELECT gen_random_uuid(), hospital_id, NULL, payment_date, id, 0, amount, 'SUPPLIER_PAYMENT', COALESCE(payment_method, 'Cash'), 'Supplier payment out', payment_method FROM supplier_payments;

-- Rebuild Delivered POs
INSERT INTO financial_ledger (id, hospital_id, clinic_id, entry_date, reference_id, debit, credit, entry_type, category, description, payment_mode)
SELECT gen_random_uuid(), hospital_id, clinic_id, COALESCE(received_at, updated_at, CURRENT_TIMESTAMP), id, total_amount, 0, 'INVENTORY_PURCHASE', 'Inventory', 'Inventory receipt (PO #' || COALESCE(order_number, '') || ')', payment_mode FROM purchase_orders WHERE status = 'DELIVERED';

INSERT INTO financial_ledger (id, hospital_id, clinic_id, entry_date, reference_id, debit, credit, entry_type, category, description, payment_mode)
SELECT gen_random_uuid(), hospital_id, clinic_id, COALESCE(received_at, updated_at, CURRENT_TIMESTAMP), id, 0, total_amount, 'INVENTORY_PURCHASE', 'Accounts Payable', 'Liability for PO', payment_mode FROM purchase_orders WHERE status = 'DELIVERED';

-- Rebuild Payroll
INSERT INTO financial_ledger (id, hospital_id, clinic_id, entry_date, reference_id, debit, credit, entry_type, category, description, payment_mode)
SELECT gen_random_uuid(), hospital_id, clinic_id, COALESCE(payment_date, CURRENT_TIMESTAMP), id, amount_paid, 0, 'PAYROLL', 'Salary Expense', 'Salary payment', 'Bank Transfer' FROM payroll_history WHERE status = 'PAID';

INSERT INTO financial_ledger (id, hospital_id, clinic_id, entry_date, reference_id, debit, credit, entry_type, category, description, payment_mode)
SELECT gen_random_uuid(), hospital_id, clinic_id, COALESCE(payment_date, CURRENT_TIMESTAMP), id, 0, amount_paid, 'PAYROLL', 'Cash/Bank', 'Salary paid out', 'Bank Transfer' FROM payroll_history WHERE status = 'PAID';
