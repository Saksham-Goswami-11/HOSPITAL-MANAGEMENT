-- Add INSERT policy for clinics to allow hospital setup
CREATE POLICY "Hospital Admins can insert clinics for their hospital"
ON public.clinics FOR INSERT 
TO authenticated
WITH CHECK (
    hospital_id IN (
        SELECT hospital_id FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('HOSPITAL_ADMIN', 'SUPER_ADMIN', 'OWNER')
    )
);

-- Ensure HOSPITAL_ADMIN can also UPDATE their clinics
CREATE POLICY "Hospital Admins can update their clinics"
ON public.clinics FOR UPDATE
TO authenticated
USING (
    hospital_id IN (
        SELECT hospital_id FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('HOSPITAL_ADMIN', 'SUPER_ADMIN', 'OWNER')
    )
)
WITH CHECK (
    hospital_id IN (
        SELECT hospital_id FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('HOSPITAL_ADMIN', 'SUPER_ADMIN', 'OWNER')
    )
);
