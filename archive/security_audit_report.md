# 🚨 Security Penetration Test & Audit Report
**Target**: ClinicOS (Small Hospital Tracker)
**Auditor**: Senior Backend Security Engineer
**Architecture Note**: The provided codebase utilizes **React + Supabase (PostgreSQL)**, not the MERN stack. Consequently, middleware and MongoDB/NoSQL concepts have been translated to their direct Supabase/PostgreSQL equivalents (RLS, RPCs, and Realtime channels).

---

## 1. Multi-Tenant Data Isolation (Supabase RLS)
**Severity: Critical**

**Vulnerability:** 
In `supabase/migrations/attendance_migration.sql`, the access control for data mutation is dangerously broad:
```sql
CREATE POLICY "Authorized users can manage attendance"
ON staff_attendance FOR ALL TO authenticated
USING ( hospital_id IN ( SELECT hospital_id FROM profiles WHERE id = auth.uid() ) );
```
Because this uses `FOR ALL` and only checks the `hospital_id`, **any authenticated user within the hospital can modify or delete ANY attendance record in that hospital.**

**Exploit Scenario:**
A low-level Clinic Staff member bypasses the frontend UI, opens Postman or the browser console, and sends a direct `PATCH` request to the Supabase REST API to modify the `clock_in_time` or `total_hours` of another employee in a different clinic—or even deletes the Hospital Admin's attendance records.

**The Fix:**
Drop the `ALL` policy and enforce strict RBAC and clinic isolation using `WITH CHECK` clauses.
```sql
-- Drop the insecure policy
DROP POLICY "Authorized users can manage attendance" ON staff_attendance;

-- Restrict INSERT to the user's assigned clinic ONLY
CREATE POLICY "Clinic Managers can insert attendance for their clinic"
ON staff_attendance FOR INSERT TO authenticated
WITH CHECK (
    clinic_id IN (SELECT clinic_id FROM profiles WHERE id = auth.uid() AND role IN ('CLINIC_ADMIN', 'HOSPITAL_ADMIN', 'HOSPITAL_OWNER'))
);

-- Restrict UPDATE to the user's assigned clinic ONLY
CREATE POLICY "Clinic Managers can update attendance for their clinic"
ON staff_attendance FOR UPDATE TO authenticated
USING (
    clinic_id IN (SELECT clinic_id FROM profiles WHERE id = auth.uid() AND role IN ('CLINIC_ADMIN', 'HOSPITAL_ADMIN', 'HOSPITAL_OWNER'))
)
WITH CHECK (
    clinic_id IN (SELECT clinic_id FROM profiles WHERE id = auth.uid() AND role IN ('CLINIC_ADMIN', 'HOSPITAL_ADMIN', 'HOSPITAL_OWNER'))
);
```

---

## 2. Real-Time / WebSocket Security
**Severity: High**

**Vulnerability:**
Supabase Realtime streams database changes directly to the frontend. If the `sales` or `admin_revenue_summary` tables do not have strict `SELECT` RLS policies applied to the realtime publication, sensitive clinical financial data is broadcasted globally across the WebSockets to any authenticated user who subscribes to the channel.

**Exploit Scenario:**
A disgruntled clinic employee opens the browser console and runs:
```javascript
supabase.channel('custom-all-channel')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, payload => console.log(payload))
  .subscribe()
```
They instantly start intercepting a live feed of all transactions happening at every clinic in the hospital network, gaining access to private financial data.

**The Fix:**
Ensure Realtime respects RLS, and strictly lock down the `SELECT` policy on financial tables.
```sql
-- Ensure RLS is enabled
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only view sales for their assigned clinic"
ON sales FOR SELECT TO authenticated
USING (
    clinic_id IN (SELECT clinic_id FROM profiles WHERE id = auth.uid()) 
    OR 
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('HOSPITAL_ADMIN', 'SUPER_ADMIN', 'OWNER'))
);
```

---

## 3. RBAC & Endpoint Protection (RPC Functions)
**Severity: Critical**

**Vulnerability:**
The application relies on PostgreSQL RPC functions (e.g., `process_sale`) to handle complex logic bypassing middle-tier servers. If this function is defined with `SECURITY DEFINER` (which executes with the privileges of the creator) and lacks internal RBAC verification, it is a massive vulnerability.

**Exploit Scenario:**
A clinic user executes the `process_sale` RPC function via an API call but injects a different `p_clinic_id` payload into the request body. Since the function lacks an internal check verifying if `auth.uid()` actually belongs to `p_clinic_id`, the user successfully attributes sales to a different clinic, entirely skewing the Hospital Admin's dashboard metrics.

**The Fix:**
Inject role and ownership verification directly into the PL/pgSQL function block.
```sql
CREATE OR REPLACE FUNCTION process_sale(p_hospital_id UUID, p_clinic_id UUID, ...)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- [SECURITY FIX] Verify the caller belongs to the requested clinic or is a global admin
    IF NOT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND (clinic_id = p_clinic_id OR role IN ('HOSPITAL_ADMIN', 'HOSPITAL_OWNER'))
    ) THEN
        RAISE EXCEPTION 'Unauthorized: You do not have permission to process sales for this clinic.';
    END IF;
    
    -- ... proceed with sale logic
END;
$$;
```

---

## 4. Input Validation & Injection (Database Level)
**Severity: Medium**

**Vulnerability:**
Because there is no Express.js middleware layer (Zod/Joi) to sanitize inputs before they hit the database, the Postgres schema is the *only* line of defense. Missing constraints mean malicious or malformed data can corrupt the system. Supabase defends against SQL injection natively via parameterized queries, but logical data poisoning is still possible.

**Exploit Scenario:**
An attacker modifies the payload for a pharmacy cart checkout, submitting `quantity: -100` for an item. If the RPC function simply does `quantity = quantity - p_quantity`, this adds 100 items to the inventory, artificially inflating stock and causing accounting havoc.

**The Fix:**
Enforce strict `CHECK` constraints at the schema level.
```sql
ALTER TABLE inventory ADD CONSTRAINT check_quantity_positive CHECK (quantity >= 0);
ALTER TABLE sales ADD CONSTRAINT check_amount_positive CHECK (amount >= 0);
ALTER TABLE staff_attendance ADD CONSTRAINT check_hours_realistic CHECK (total_hours >= 0 AND total_hours <= 24);
```

---

## 5. Audit Trails (Anti-Fraud)
**Severity: High**

**Vulnerability:**
Financial systems require immutable audit trails. Currently, modifications to revenue tables or inventory deletions rely entirely on passing the current state. There is no historical tracking of *who* modified a bill or what the previous value was, making fraud impossible to investigate.

**Exploit Scenario:**
A `CLINIC_ADMIN` finalizes a ₹5000 consultation bill in cash. An hour later, they issue a direct Supabase `DELETE` or `UPDATE` API request to drop the bill to ₹500 and pocket the ₹4500 difference. The `updated_at` timestamp changes, but the original amount is lost forever, and there is no record of who changed it.

**The Fix:**
Implement a rigorous PostgreSQL Trigger to capture all state changes into an immutable `audit_logs` table.
```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT,
    record_id UUID,
    action TEXT, -- 'UPDATE' or 'DELETE'
    old_data JSONB,
    changed_by UUID, -- auth.uid()
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION capture_audit_log()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_logs (table_name, record_id, action, old_data, changed_by)
    VALUES (TG_TABLE_NAME, OLD.id, TG_OP, row_to_json(OLD)::jsonb, auth.uid());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Map the anti-fraud trigger to the sales table
CREATE TRIGGER sales_audit_trigger
AFTER UPDATE OR DELETE ON sales
FOR EACH ROW EXECUTE FUNCTION capture_audit_log();
```
