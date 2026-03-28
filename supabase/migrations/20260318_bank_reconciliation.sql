-- Phase 3: Bank Reconciliation Statement (BRS)

-- Bank Statement Entries table
CREATE TABLE IF NOT EXISTS public.bank_statements (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT NOT NULL,
    reference_no TEXT,
    debit NUMERIC(12, 2) DEFAULT 0.00,
    credit NUMERIC(12, 2) DEFAULT 0.00,
    running_balance NUMERIC(14, 2) DEFAULT 0.00,
    is_reconciled BOOLEAN DEFAULT false,
    reconciled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS policies
ALTER TABLE public.bank_statements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bank statements viewable by hospital staff"
ON public.bank_statements FOR SELECT
USING (hospital_id IN (
    SELECT hospital_id FROM public.profiles WHERE id = auth.uid()
));

CREATE POLICY "Bank statements manageable by admins"
ON public.bank_statements FOR ALL
USING (hospital_id IN (
    SELECT hospital_id FROM public.profiles
    WHERE id = auth.uid() AND role IN ('HOSPITAL_ADMIN', 'SUPER_ADMIN', 'OWNER')
));
