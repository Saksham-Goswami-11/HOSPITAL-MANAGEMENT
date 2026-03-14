-- Purchase Order and Supplier Management System Migration

-- 1. Suppliers Table
CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    contact_person TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    gst_number TEXT,
    payment_terms TEXT, -- e.g., "Net 30", "Due on Receipt"
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Purchase Orders Table
CREATE TABLE IF NOT EXISTS public.purchase_orders (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
    clinic_id UUID REFERENCES public.clinics(id) ON DELETE SET NULL, -- Destination clinic
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
    order_number TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'partially_received', 'received', 'cancelled')),
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    order_date DATE DEFAULT CURRENT_DATE,
    expected_delivery_date DATE,
    received_at TIMESTAMPTZ,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Purchase Order Items Table
CREATE TABLE IF NOT EXISTS public.purchase_order_items (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
    inventory_item_id UUID REFERENCES public.inventory(id) ON DELETE SET NULL, -- Link to existing inventory template if known
    item_name TEXT NOT NULL, -- Flexible name in case it's a new item
    quantity_ordered INTEGER NOT NULL CHECK (quantity_ordered > 0),
    quantity_received INTEGER DEFAULT 0 CHECK (quantity_received >= 0),
    unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total_price NUMERIC(12, 2) GENERATED ALWAYS AS (quantity_ordered * unit_price) STORED,
    batch_number TEXT, -- Expected or provided batch
    expiry_date DATE -- Expected expiry
);

-- 4. Supplier Payments Table
CREATE TABLE IF NOT EXISTS public.supplier_payments (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
    purchase_order_id UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    payment_date DATE DEFAULT CURRENT_DATE,
    payment_method TEXT CHECK (payment_method IN ('UPI', 'Cash', 'Card', 'Bank Transfer')),
    transaction_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
    due_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS POLICIES

-- Suppliers
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Suppliers are viewable by hospital staff" ON public.suppliers
    FOR SELECT USING (hospital_id IN (SELECT hospital_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "Suppliers are manageable by hospital admins" ON public.suppliers
    FOR ALL USING (hospital_id IN (SELECT hospital_id FROM public.profiles WHERE id = auth.uid() AND role IN ('HOSPITAL_ADMIN', 'SUPER_ADMIN', 'OWNER')));

-- Purchase Orders
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "PO are viewable by hospital staff" ON public.purchase_orders
    FOR SELECT USING (hospital_id IN (SELECT hospital_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "PO are manageable by hospital admins" ON public.purchase_orders
    FOR ALL USING (hospital_id IN (SELECT hospital_id FROM public.profiles WHERE id = auth.uid() AND role IN ('HOSPITAL_ADMIN', 'SUPER_ADMIN', 'OWNER')));

-- PO Items
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "PO items are viewable by hospital staff" ON public.purchase_order_items
    FOR SELECT USING (purchase_order_id IN (SELECT id FROM public.purchase_orders WHERE hospital_id IN (SELECT hospital_id FROM public.profiles WHERE id = auth.uid())));
CREATE POLICY "PO items are manageable by hospital admins" ON public.purchase_order_items
    FOR ALL USING (purchase_order_id IN (SELECT id FROM public.purchase_orders WHERE hospital_id IN (SELECT hospital_id FROM public.profiles WHERE id = auth.uid() AND role IN ('HOSPITAL_ADMIN', 'SUPER_ADMIN', 'OWNER'))));

-- Supplier Payments
ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Payments are viewable by hospital staff" ON public.supplier_payments
    FOR SELECT USING (hospital_id IN (SELECT hospital_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "Payments are manageable by hospital admins" ON public.supplier_payments
    FOR ALL USING (hospital_id IN (SELECT hospital_id FROM public.profiles WHERE id = auth.uid() AND role IN ('HOSPITAL_ADMIN', 'SUPER_ADMIN', 'OWNER')));

-- Stock Logs Foreign Key check (if not already there)
-- The existing stock_logs has a reference to inventory.id which is fine.

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
