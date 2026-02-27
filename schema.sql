-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Clinics Table
create table if not exists clinics (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  location text not null,
  created_at timestamptz default now()
);

-- 2. Seed Clinics (CRITICAL: Must match frontend constants)
INSERT INTO clinics (id, name, location) VALUES 
('1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed', 'Artemis Clinic (Sector 14, Gurgaon)', 'Sector 14'),
('2b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed', 'Artemis Satellite (Sector 56, Gurgaon)', 'Sector 56'),
('3b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed', 'Artemis Health (DLF Phase 3)', 'DLF Phase 3'),
('4b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed', 'Artemis Wellness (Golf Course Road)', 'Golf Course Road'),
('5b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed', 'Artemis Med-Center (Sohna Road)', 'Sohna Road')
ON CONFLICT (id) DO NOTHING;

-- 3. Profiles Table (RBAC)
create table if not exists profiles (
  id uuid references auth.users on delete cascade not null primary key,
  full_name text,
  role text check (role in ('ADMIN', 'CLINIC_STAFF')),
  clinic_id uuid references clinics(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 4. Sales Table
create table if not exists sales (
  id uuid default uuid_generate_v4() primary key,
  clinic_id uuid references clinics(id) not null,
  patient_name text not null,
  doctor_name text not null,
  amount numeric not null,
  payment_mode text not null check (payment_mode in ('UPI', 'Cash', 'Card')),
  timestamp timestamptz default now(),
  sale_type text check (sale_type in ('CONSULTATION', 'PHARMACY')) default 'PHARMACY',
  meta_data jsonb default '{}'::jsonb
);

-- 5. Inventory Table (Upgraded)
create table if not exists inventory (
  id uuid default uuid_generate_v4() primary key,
  clinic_id uuid references clinics(id) not null,
  item_name text not null,
  batch_number text not null,
  expiry_date date not null,
  manufacturer text default 'Unknown',
  quantity int not null default 0 check (quantity >= 0),
  mrp numeric not null default 0,
  threshold int not null default 10,
  last_updated timestamptz default now()
);

-- 6. Stock Logs
create table if not exists stock_logs (
  id uuid default uuid_generate_v4() primary key,
  inventory_id uuid references inventory(id) on delete cascade not null,
  change_amount int not null,
  reason text not null,
  created_at timestamptz default now(),
  created_by uuid references auth.users(id) default auth.uid()
);

-- 7. Daily Reports Table
create table if not exists daily_reports (
  id uuid default uuid_generate_v4() primary key,
  clinic_id uuid references clinics(id) not null,
  total_collection numeric not null default 0,
  total_patients int not null default 0,
  date date default current_date,
  created_at timestamptz default now(),
  unique(clinic_id, date)
);

-- 8. Functions & Triggers

-- Handle New User
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role, clinic_id)
  values (
    new.id, 
    coalesce(new.raw_user_meta_data->>'full_name', 'New User'),
    coalesce(new.raw_user_meta_data->>'role', 'CLINIC_STAFF'),
    null 
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Is Admin Helper (CRITICAL SECURITY DEFINER to bypass RLS recursion)
create or replace function public.is_admin()
returns boolean as $$
begin
  -- Perform the check. Since this is SECURITY DEFINER, it runs as DB owner (bypassing RLS)
  return exists (
    select 1 from profiles
    where id = auth.uid() and role = 'ADMIN'
  );
end;
$$ language plpgsql security definer set search_path = public;

-- 9. RLS Policies
alter table clinics enable row level security;
alter table sales enable row level security;
alter table inventory enable row level security;
alter table daily_reports enable row level security;
alter table profiles enable row level security;
alter table stock_logs enable row level security;

-- PROFILES POLICIES
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;

CREATE POLICY "Admins can view all" ON profiles 
FOR SELECT USING ( is_admin() );

CREATE POLICY "Users can view their own profile" ON profiles
FOR SELECT USING ( auth.uid() = id );

-- (Policies simplified for brevity - in production these are applied via migration)

-- 10. Sale Items (Phase 3)
create table if not exists sale_items (
  id uuid default uuid_generate_v4() primary key,
  sale_id uuid references sales(id) on delete cascade not null,
  inventory_id uuid references inventory(id) not null,
  quantity int not null check (quantity > 0),
  unit_price numeric not null check (unit_price >= 0),
  total_price numeric generated always as (quantity * unit_price) stored
);

alter table sale_items enable row level security;

-- 11. Triggers
create or replace function deduct_inventory_on_sale()
returns trigger as $$
begin
  update inventory
  set quantity = quantity - new.quantity
  where id = new.inventory_id;
  
  insert into stock_logs (inventory_id, change_amount, reason, created_by)
  values (new.inventory_id, -new.quantity, 'SALE', auth.uid());
  
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_sale_item_insert
  after insert on sale_items
  for each row execute procedure deduct_inventory_on_sale();

-- 12. Views
create or replace view admin_revenue_summary 
with (security_invoker = true) as
select 
  c.name as clinic_name,
  date(s.timestamp) as sale_date,
  count(s.id) as total_transactions,
  sum(s.amount) as total_revenue
from sales s
join clinics c on s.clinic_id = c.id
group by 1, 2
order by 2 desc, 1;

-- 13. Security Hardening (Lint Fixes)
ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.is_admin() SET search_path = public;
ALTER FUNCTION public.deduct_inventory_on_sale() SET search_path = public;

-- Updated RLS for Sales
DROP POLICY IF EXISTS "Enable all access for all users" ON sales;
DROP POLICY IF EXISTS "Enable all for sales" ON sales;

CREATE POLICY "Staff can view own clinic sales" ON sales
FOR SELECT TO authenticated
USING (
  clinic_id = (SELECT clinic_id FROM profiles WHERE id = auth.uid())
);

CREATE POLICY "Staff can insert own clinic sales" ON sales
FOR INSERT TO authenticated
WITH CHECK (
  clinic_id = (SELECT clinic_id FROM profiles WHERE id = auth.uid())
);

CREATE POLICY "Admins can do everything on sales" ON sales
FOR ALL TO authenticated
USING ( is_admin() );

-- Updated RLS for Clinics
DROP POLICY IF EXISTS "Enable all access for all users" ON clinics;
DROP POLICY IF EXISTS "Enable all for clinics" ON clinics;

-- 14. Admin RPC for Clinic Registration
create or replace function admin_create_clinic_and_staff(
  clinic_name text,
  clinic_address text,
  staff_user_id uuid,
  staff_name text
)
returns uuid as $$
declare
  new_clinic_id uuid;
begin
  -- 1. Check if Admin
  if not is_admin() then
    raise exception 'Access Denied: Only Admins can create clinics';
  end if;

  -- 2. Create Clinic
  insert into clinics (name, location)
  values (clinic_name, clinic_address)
  returning id into new_clinic_id;

  -- 3. Link Staff to Clinic (Update Profile)
  -- The profile row is created by the trigger on auth.users insert.
  -- We rely on the trigger having run or we update whatever is there.
  update profiles
  set clinic_id = new_clinic_id,
      role = 'CLINIC_STAFF',
      full_name = staff_name
  where id = staff_user_id;

  return new_clinic_id;
end;
$$ language plpgsql security definer set search_path = public;

-- Grant access to authenticated users (logic inside handles security)
grant execute on function admin_create_clinic_and_staff to authenticated;

CREATE POLICY "Staff can view own clinic" ON clinics
FOR SELECT TO authenticated
USING (
  id = (SELECT clinic_id FROM profiles WHERE id = auth.uid())
);

CREATE POLICY "Admins can do everything on clinics" ON clinics
FOR ALL TO authenticated
USING ( is_admin() );

-- 15. Transactional Sale Processing (RPC)
create or replace function process_sale(
  p_clinic_id uuid,
  p_patient_name text,
  p_doctor_name text,
  p_sale_type text, -- 'CONSULTATION' or 'PHARMACY'
  p_payment_mode text,
  p_items jsonb, -- Array of objects: { "inventory_id": "uuid", "quantity": int, "price": numeric }
  p_amount numeric default 0 -- For Consultation Fee or override
)
returns uuid as $$
declare
  new_sale_id uuid;
  item jsonb;
  v_inventory_id uuid;
  v_quantity int;
  v_current_qty int;
  v_expiry date;
  v_item_name text;
begin
  -- 1. Validate Items (Availability & Expiry)
  if p_sale_type = 'PHARMACY' then
    for item in select * from jsonb_array_elements(p_items)
    loop
      v_inventory_id := (item->>'inventory_id')::uuid;
      v_quantity := (item->>'quantity')::int;

      select quantity, expiry_date, item_name
      into v_current_qty, v_expiry, v_item_name
      from inventory
      where id = v_inventory_id;

      if not found then
        raise exception 'Item not found: %', v_inventory_id;
      end if;

      -- A. Expiry Lock
      if v_expiry < current_date then
        raise exception 'MEDICINE EXPIRED: % (Expired on %)', v_item_name, v_expiry;
      end if;

      -- B. Stock Check
      if v_current_qty < v_quantity then
        raise exception 'INSUFFICIENT STOCK: % (Requested: %, Available: %)', v_item_name, v_quantity, v_current_qty;
      end if;
    end loop;
  end if;

  -- 2. Create Sale Record
  insert into sales (clinic_id, patient_name, doctor_name, sale_type, payment_mode, amount, created_by)
  values (
    p_clinic_id,
    p_patient_name,
    p_doctor_name,
    p_sale_type,
    p_payment_mode,
    p_amount, -- Use passed amount initially
    auth.uid()
  )
  returning id into new_sale_id;

  -- 3. Insert Sale Items (Trigger will handle Inventory Deduction)
  if p_sale_type = 'PHARMACY' then
    insert into sale_items (sale_id, inventory_id, quantity, unit_price)
    select 
      new_sale_id,
      (item->>'inventory_id')::uuid,
      (item->>'quantity')::int,
      (item->>'price')::numeric
    from jsonb_array_elements(p_items) as item;
    
    -- Recalculate and Update Total Amount based on actual items
    update sales 
    set amount = (select sum(total_price) from sale_items where sale_id = new_sale_id)
    where id = new_sale_id;
  end if;
  
  return new_sale_id;
end;
$$ language plpgsql security definer set search_path = public;

-- Grant access
grant execute on function process_sale to authenticated;

-- 16. Fix Inventory RLS (Comprehensive)
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable insert for authenticated users with matching clinic" ON inventory;
DROP POLICY IF EXISTS "Enable insert for staff into their clinic" ON inventory;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON inventory;

-- SELECT Policy
CREATE POLICY "inventory_select_policy" ON inventory
FOR SELECT TO authenticated
USING (
  clinic_id IN (SELECT clinic_id FROM profiles WHERE id = auth.uid())
  OR 
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'ADMIN'
);

-- INSERT Policy
CREATE POLICY "inventory_insert_policy" ON inventory
FOR INSERT TO authenticated
WITH CHECK (
  clinic_id IN (SELECT clinic_id FROM profiles WHERE id = auth.uid())
  OR 
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'ADMIN'
);
