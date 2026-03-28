-- Migration for Phase 2: Operations & Tax Streamlining

-- Add tax and receipt fields to other_expenses (assuming it exists or will be created/altered securely)
ALTER TABLE IF EXISTS public.other_expenses 
ADD COLUMN IF NOT EXISTS tax_percentage NUMERIC(5, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS receipt_url TEXT;

-- Add tax fields to purchase_orders
ALTER TABLE IF EXISTS public.purchase_orders
ADD COLUMN IF NOT EXISTS tax_percentage NUMERIC(5, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12, 2) DEFAULT 0.00;
