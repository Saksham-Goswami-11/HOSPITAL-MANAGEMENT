-- Create the staff_attendance table
CREATE TABLE staff_attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,
    clinic_id UUID REFERENCES clinics(id) ON DELETE SET NULL,
    staff_id UUID REFERENCES staff_details(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    clock_in_time TIMESTAMP WITH TIME ZONE,
    clock_out_time TIMESTAMP WITH TIME ZONE,
    status TEXT CHECK (status IN ('PRESENT', 'ABSENT', 'HALF_DAY', 'ON_LEAVE')),
    total_hours NUMERIC(5, 2), -- Stores up to 999.99 hours
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

    -- Ensure a staff member only has one attendance record per day
    UNIQUE(staff_id, date)
);

-- Enable Row Level Security (RLS)
ALTER TABLE staff_attendance ENABLE ROW LEVEL SECURITY;

-- Policy: Hospital Admins and Owners can view all attendance across their hospital
CREATE POLICY "Hospital Admins can view all attendance"
ON staff_attendance FOR SELECT
TO authenticated
USING (
    hospital_id IN (
        SELECT hospital_id FROM profiles
        WHERE id = auth.uid() AND role IN ('SUPER_ADMIN', 'HOSPITAL_ADMIN', 'HOSPITAL_OWNER')
    )
);

-- Policy: Clinic Admins and Staff can only view attendance for their specific clinic
CREATE POLICY "Clinic roles can view their clinic's attendance"
ON staff_attendance FOR SELECT
TO authenticated
USING (
    clinic_id IN (
        SELECT clinic_id FROM profiles
        WHERE id = auth.uid()
    )
);

-- Policy: Anyone logged in with appropriate hospital access can insert/update attendance
-- In a stricter system, you'd limit this to only CLINIC_ADMIN, but for MVP we allow staff to punch themselves in if needed
CREATE POLICY "Authorized users can manage attendance"
ON staff_attendance FOR ALL
TO authenticated
USING (
    hospital_id IN (
        SELECT hospital_id FROM profiles
        WHERE id = auth.uid()
    )
);

-- Note: In a production environment with complete RLS strictness, you would break the ALL policy into explicit INSERT and UPDATE policies with tighter `WITH CHECK` conditions.

-- Create an index to speed up daily roster queries
CREATE INDEX idx_staff_attendance_date ON staff_attendance(clinic_id, date);
