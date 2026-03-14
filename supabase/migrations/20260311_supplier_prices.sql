-- Create supplier item prices table
CREATE TABLE IF NOT EXISTS public.supplier_item_prices (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE CASCADE,
    item_name TEXT NOT NULL,
    price DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(supplier_id, item_name)
);

-- Enable RLS
ALTER TABLE public.supplier_item_prices ENABLE ROW LEVEL SECURITY;

-- Add RLS Policies (Matching existing procurement patterns)
CREATE POLICY "Enable all for authenticated users" ON public.supplier_item_prices
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Add comment for PostgREST
COMMENT ON TABLE public.supplier_item_prices IS 'Store negotiated item prices for each supplier';
