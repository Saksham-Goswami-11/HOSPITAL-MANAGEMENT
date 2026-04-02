BEGIN;

-- Create patients table
CREATE TABLE IF NOT EXISTS public.patients (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
    clinic_id UUID REFERENCES public.clinics(id) ON DELETE SET NULL,
    full_name TEXT NOT NULL,
    age INTEGER,
    gender TEXT CHECK (gender IN ('Male', 'Female', 'Other')),
    contact_number TEXT,
    emergency_contact TEXT,
    address TEXT,
    blood_group TEXT,
    medical_history TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS and set policies for patients
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view/manage their hospital's patients" ON public.patients
    FOR ALL USING (
        hospital_id IN (
            SELECT hospital_id FROM public.profiles WHERE id = auth.uid()
        )
    );

-- Create wards table
CREATE TABLE IF NOT EXISTS public.wards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    ward_type TEXT NOT NULL, -- General, ICU, Private, etc.
    base_daily_charge NUMERIC DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS and set policies for wards
ALTER TABLE public.wards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view/manage their hospital's wards" ON public.wards
    FOR ALL USING (
        hospital_id IN (
            SELECT hospital_id FROM public.profiles WHERE id = auth.uid()
        )
    );

-- Create beds table
CREATE TABLE IF NOT EXISTS public.beds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ward_id UUID NOT NULL REFERENCES public.wards(id) ON DELETE CASCADE,
    bed_number TEXT NOT NULL,
    status TEXT DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'maintenance')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS and set policies for beds
ALTER TABLE public.beds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view/manage their hospital's beds" ON public.beds
    FOR ALL USING (
        ward_id IN (
            SELECT id FROM public.wards WHERE hospital_id IN (
                SELECT hospital_id FROM public.profiles WHERE id = auth.uid()
            )
        )
    );

-- Create ipd_admissions table
CREATE TABLE IF NOT EXISTS public.ipd_admissions (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    bed_id UUID NOT NULL REFERENCES public.beds(id) ON DELETE CASCADE,
    hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
    admitting_doctor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    admission_date TIMESTAMPTZ DEFAULT now(),
    discharge_date TIMESTAMPTZ,
    reason_for_admission TEXT,
    status TEXT DEFAULT 'admitted' CHECK (status IN ('admitted', 'discharged', 'transferred')),
    advance_paid NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS and set policies for ipd_admissions
ALTER TABLE public.ipd_admissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view/manage their hospital's admissions" ON public.ipd_admissions
    FOR ALL USING (
        hospital_id IN (
            SELECT hospital_id FROM public.profiles WHERE id = auth.uid()
        )
    );

COMMIT;
