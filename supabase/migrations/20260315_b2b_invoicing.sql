-- B2B Invoicing and Credit Management Migration

-- 1. Update Suppliers Table
ALTER TABLE public.suppliers 
ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(12, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS current_credit NUMERIC(12, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS bank_name TEXT,
ADD COLUMN IF NOT EXISTS account_number TEXT,
ADD COLUMN IF NOT EXISTS ifsc_code TEXT,
ADD COLUMN IF NOT EXISTS branch_name TEXT,
ADD COLUMN IF NOT EXISTS billing_address TEXT,
ADD COLUMN IF NOT EXISTS shipping_address TEXT,
ADD COLUMN IF NOT EXISTS state_code TEXT;

-- 2. Update Purchase Orders Table
ALTER TABLE public.purchase_orders
ADD COLUMN IF NOT EXISTS is_b2b BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS irn_number TEXT,
ADD COLUMN IF NOT EXISTS place_of_supply TEXT,
ADD COLUMN IF NOT EXISTS state_code TEXT,
ADD COLUMN IF NOT EXISTS basic_amount NUMERIC(12, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS eway_bill_number TEXT,
ADD COLUMN IF NOT EXISTS payment_mode TEXT CHECK (payment_mode IN ('cash', 'credit')) DEFAULT 'cash',
ADD COLUMN IF NOT EXISTS advance_paid NUMERIC(12, 2) DEFAULT 0;

-- 3. Update Purchase Order Items Table
ALTER TABLE public.purchase_order_items
ADD COLUMN IF NOT EXISTS hsn_code TEXT,
ADD COLUMN IF NOT EXISTS gst_rate NUMERIC(5, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS cgst_amount NUMERIC(12, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS sgst_amount NUMERIC(12, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS igst_amount NUMERIC(12, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5, 2) DEFAULT 0;

-- 4. Create Credit/Debit Notes Table
CREATE TABLE IF NOT EXISTS public.credit_debit_notes (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    reason TEXT NOT NULL,
    reference_po_id UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Credit Management Logic
-- Function to update supplier credit balance
CREATE OR REPLACE FUNCTION public.update_supplier_credit()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- When a credit PO is created
        IF TG_TABLE_NAME = 'purchase_orders' AND NEW.payment_mode = 'credit' THEN
            UPDATE public.suppliers 
            SET current_credit = current_credit + NEW.total_amount
            WHERE id = NEW.supplier_id;
        END IF;
        
        -- When a payment is recorded
        IF TG_TABLE_NAME = 'supplier_payments' AND NEW.status = 'completed' THEN
            UPDATE public.suppliers
            SET current_credit = current_credit - NEW.amount
            WHERE id = NEW.supplier_id;
        END IF;

        -- When a credit note is added (decreases what we owe)
        IF TG_TABLE_NAME = 'credit_debit_notes' AND NEW.type = 'credit' THEN
            UPDATE public.suppliers
            SET current_credit = current_credit - NEW.amount
            WHERE id = NEW.supplier_id;
        END IF;

        -- When a debit note is added (increases what we owe or adjusts item price)
        IF TG_TABLE_NAME = 'credit_debit_notes' AND NEW.type = 'debit' THEN
            UPDATE public.suppliers
            SET current_credit = current_credit + NEW.amount
            WHERE id = NEW.supplier_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers for credit management
DROP TRIGGER IF EXISTS tr_po_credit_update ON public.purchase_orders;
CREATE TRIGGER tr_po_credit_update
AFTER INSERT ON public.purchase_orders
FOR EACH ROW EXECUTE FUNCTION public.update_supplier_credit();

DROP TRIGGER IF EXISTS tr_payment_credit_update ON public.supplier_payments;
CREATE TRIGGER tr_payment_credit_update
AFTER INSERT ON public.supplier_payments
FOR EACH ROW EXECUTE FUNCTION public.update_supplier_credit();

DROP TRIGGER IF EXISTS tr_note_credit_update ON public.credit_debit_notes;
CREATE TRIGGER tr_note_credit_update
AFTER INSERT ON public.credit_debit_notes
FOR EACH ROW EXECUTE FUNCTION public.update_supplier_credit();

-- RLS for credit_debit_notes
ALTER TABLE public.credit_debit_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Notes are viewable by hospital staff" ON public.credit_debit_notes
    FOR SELECT USING (hospital_id IN (SELECT hospital_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "Notes are manageable by hospital admins" ON public.credit_debit_notes
    FOR ALL USING (hospital_id IN (SELECT hospital_id FROM public.profiles WHERE id = auth.uid() AND role IN ('HOSPITAL_ADMIN', 'SUPER_ADMIN', 'OWNER')));
