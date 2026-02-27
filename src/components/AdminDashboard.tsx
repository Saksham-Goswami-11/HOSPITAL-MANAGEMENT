import { HospitalDashboard } from './HospitalDashboard'

/**
 * @deprecated 
 * This component has been replaced by the 3-Tier Architecture.
 * Use HospitalDashboard.tsx for Hospital Admins.
 * Use SuperAdminDashboard.tsx for Super Admins.
 * Use ClinicAdminDashboard.tsx for Clinic Admins.
 */
export function AdminDashboard(props: any) {
    console.warn("⚠️ DEPRECATED: AdminDashboard is being used. Please migrate to specific dashboard components.")

    // Fallback: If it's still being used, try to map old props to new HospitalDashboard
    // Old: onView (likely for Hospital Selection or Clinic Selection)
    // New: onSelectClinic

    return (
        <div className="relative">
            <div className="bg-red-500 text-white px-2 py-1 text-xs text-center font-bold">
                ⚠️ DEVELOPER WARNING: Using Deprecated AdminDashboard.tsx
            </div>
            <HospitalDashboard onSelectClinic={props.onView || (() => { })} />
        </div>
    )
}
