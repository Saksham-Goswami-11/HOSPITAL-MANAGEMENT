# Hub-and-Spoke Healthcare Management System

A secure, medical-grade inventory and POS system designed for multi-clinic networks. Built with **React (Vite)** and **Supabase (PostgreSQL)**, adhering to strict data isolation and medical compliance standards.

## 🏗 System Architecture
The system follows a **Hub-and-Spoke** architecture where a central database manages multiple satellite clinics.
-   **Frontend**: React + TypeScript + Tailwind CSS (Vite)
-   **Backend**: Supabase (PostgreSQL 15)
-   **Security**: Role-Based Access Control (RBAC) via Row Level Security (RLS) policies.

## 🛡 Security Manifest (Audit Passed ✅)
The application architecture is "Secure by Design," relying on database-level enforcement rather than client-side logic.

### 1. Authentication & RBAC
-   **Method**: Supabase Auth (JWT).
-   **Role Source**: `public.profiles` table linked to `auth.users` via a secure trigger.
-   **Roles**:
    -   `ADMIN`: Full access to all clinics, revenue, and inventory control.
    -   `CLINIC_STAFF`: Strictly scoped to their assigned `clinic_id`.

### 2. Row Level Security (RLS)
All tables have RLS enabled. Data isolation is enforced at the query level:
```sql
-- Example Policy
CREATE POLICY "Staff View Own Clinic" ON sales
USING (clinic_id = (SELECT clinic_id FROM profiles WHERE id = auth.uid()));
```

### 3. Vulnerability Mitigation
-   **SQL Injection**: All functions use `search_path = public` to prevent search path hijacking.
-   **Access Control**: Permissive policies (e.g., `USING (true)`) have been eliminated.
-   **Data Leakage**: `security_invoker = true` is used on views to respect invoking user's permissions.

## 🗄 Database Schema Design
The schema ensures integrity for medical transactions.

| Table | Purpose | Key Relationships |
| :--- | :--- | :--- |
| **clinics** | Physical locations | One-to-Many with Users, Inventory, Sales |
| **profiles** | User Roles & Access | Links `auth.users` to `clinics` |
| **inventory** | Medical Stock | **Tracks**: `batch_number`, `expiry_date` |
| **sales** | Transaction Header | Links to `clinics` |
| **sale_items** | Itemized Bill | Links `sales` ↔ `inventory` |
| **stock_logs** | Audit Trail | Records every In/Out movement |

## 🚀 Key Features

### 1. Point of Sale (POS) System
-   **Searchable Inventory**: Instant lookup by medicine name.
-   **Cart Logic**: Add multiple items, quantity validation against stock.
-   **Checkout**: Transactional consistency with automated stock deduction.

### 2. Automated Inventory Management
-   **Auto-Deduction Trigger**: When a sale is recorded, a Postgres Trigger *automatically* subtracts the quantity from inventory.
-   **Medical Compliance**: Mandatory tracking of **Batch Numbers** and **Expiry Dates**.
-   **Visual Cues**: UI highlights expired (Red) and expiring-soon (Amber) items.

### 3. Analytics Dashboard
-   **Admin View**: Aggregate revenue across all clinics.
-   **Staff View**: Localized daily collection reports.

## 🛠 Deployment Guide

### Prerequisites
-   Node.js v18+
-   Supabase Project

### 1. Environment Variables
Create a `.env` file in the root:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 2. Database Setup
Run the `schema.sql` file in your Supabase SQL Editor to:
-   Enable UUID extension.
-   Create Tables & Relationships.
-   Deploy Triggers & Functions.
-   Enable RLS Policies.

### 3. Deploy Frontend
The application is ready for Vercel or Netlify.
1.  Connect your GitHub repository.
2.  Set the Environment Variables in the dashboard.
3.  Build Command: `npm run build`
4.  Output Directory: `dist`

---
**Status**: Production Ready (Security Audited 2026-01-26)
