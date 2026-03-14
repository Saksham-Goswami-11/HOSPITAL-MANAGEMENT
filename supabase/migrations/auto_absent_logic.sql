-- Function to mark staff as absent automatically
CREATE OR REPLACE FUNCTION public.fn_mark_auto_absent()
RETURNS void AS $$
DECLARE
    current_ist_timestamp TIMESTAMPTZ;
    current_ist_date DATE;
    current_ist_time TIME;
    staff_record RECORD;
BEGIN
    -- 1. Get current time in IST
    current_ist_timestamp := TIMEZONE('Asia/Kolkata', NOW());
    current_ist_date := current_ist_timestamp::DATE;
    current_ist_time := current_ist_timestamp::TIME;

    -- 2. Find staff who should be marked absent
    FOR staff_record IN
        SELECT 
            sd.id as staff_id,
            sd.hospital_id,
            sd.clinic_id,
            cs.start_time,
            cs.late_cutoff_minutes
        FROM 
            public.staff_details sd
        JOIN 
            public.clinic_shifts cs ON sd.shift_id = cs.id
        WHERE 
            sd.status = 'Active'
            AND cs.is_active = true
            -- Ensure the shift start time + cutoff has passed for today
            AND (cs.start_time + (cs.late_cutoff_minutes || ' minutes')::INTERVAL) < current_ist_time
            -- Ensure we haven't already marked them today
            AND NOT EXISTS (
                SELECT 1 
                FROM public.staff_attendance sa 
                WHERE sa.staff_id = sd.id 
                AND sa.date = current_ist_date
            )
    LOOP
        -- 3. Insert ABSENT record
        INSERT INTO public.staff_attendance (
            hospital_id,
            clinic_id,
            staff_id,
            date,
            status,
            total_hours,
            is_late,
            notes
        ) VALUES (
            staff_record.hospital_id,
            staff_record.clinic_id,
            staff_record.staff_id,
            current_ist_date,
            'ABSENT',
            0,
            false,
            'Automatically marked absent (past late cutoff)'
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule the job using pg_cron (runs every 15 minutes)
-- Note: 'postgres' is the default database where cron jobs are often scheduled
SELECT cron.schedule(
    'mark-staff-absent-job',
    '*/15 * * * *',
    'SELECT public.fn_mark_auto_absent()'
);
