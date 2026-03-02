-- Phase 24: Shift Management System
-- Run this in the Supabase SQL Editor

-- 1. Create clinic_shifts table for shift templates
CREATE TABLE IF NOT EXISTS clinic_shifts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  grace_minutes INT DEFAULT 5,
  late_cutoff_minutes INT DEFAULT 30,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Add shift_id to staff_details
ALTER TABLE staff_details
ADD COLUMN IF NOT EXISTS shift_id UUID REFERENCES clinic_shifts(id) ON DELETE SET NULL;

-- 3. Add late flag to staff_attendance
ALTER TABLE staff_attendance
ADD COLUMN IF NOT EXISTS is_late BOOLEAN DEFAULT false;

-- 4. RLS policies for clinic_shifts
ALTER TABLE clinic_shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read shifts for their hospital"
ON clinic_shifts FOR SELECT
USING (
  hospital_id IN (
    SELECT hospital_id FROM profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Admins can manage shifts"
ON clinic_shifts FOR ALL
USING (
  hospital_id IN (
    SELECT hospital_id FROM profiles WHERE id = auth.uid()
    AND role IN ('ADMIN', 'HOSPITAL_ADMIN', 'CLINIC_ADMIN', 'SUPER_ADMIN', 'OWNER')
  )
);
