-- Add category column to suppliers table
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS category TEXT;
