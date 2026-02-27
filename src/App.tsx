import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { StaffPortal } from '@/components/StaffPortal'
import { SuperAdminDashboard } from "@/components/SuperAdminDashboard";
import { HospitalDashboard } from "@/components/HospitalDashboard";
import { ClinicAdminDashboard } from "@/components/ClinicAdminDashboard";
import { AppLayout } from "@/components/layout/AppLayout";
import { LoginPage } from "@/components/LoginPage";
import { InventoryDashboard } from "@/components/InventoryDashboard";
import { AdminSetup } from "@/components/AdminSetup";
import { HospitalProvider, useHospital } from '@/context/HospitalContext';
import { ResetPasswordPage } from "@/components/ResetPasswordPage";
import { HospitalsRegistry } from '@/components/HospitalsRegistry';
import { HospitalDetails } from '@/components/HospitalDetails';
import { AuditLogs } from '@/components/AuditLogs';
import { POSDashboard } from '@/components/POSDashboard';
import { ClinicAttendance } from '@/components/ClinicAttendance';
import { EarningsDashboard } from '@/components/EarningsDashboard';
import { SettingsDashboard } from '@/components/SettingsDashboard';
import { HashRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import LandingPage from '@/pages/LandingPage';

import { Loader2, Shield } from 'lucide-react'
import { Button } from '@/components/ui/basic'
import { Toaster } from '@/components/ui/toaster'

// View types
type View = 'selection' | 'staff' | 'admin' | 'inventory-dashboard' | 'setup' | 'hospitals' | 'audit_logs' | 'pos' | 'attendance' | 'earnings' | 'settings'


function AppContent() {
    const { session, profile, loading } = useHospital();
    const navigate = useNavigate();
    const [view, setView] = useState<View>(() => {
        const savedView = localStorage.getItem('lastActiveView') as View
        return savedView || 'selection'
    });

    // 3-Tier State: Hospital Admin 'Drill Down' Clinic ID
    const [selectedClinicId, setSelectedClinicId] = useState<string | null>(null);

    useEffect(() => {
        if (view) {
            localStorage.setItem('lastActiveView', view)
        }
    }, [view])

    useEffect(() => {
        if (!loading && profile) {
            // Router logic processing

            // 1. CRITICAL: Clinic Admin Bypass (Gatekeeper Fix)
            // Allow entry even if clinic_id is null (The Dashboard will handle the "No Clinic" state)
            if (profile.role === 'CLINIC_ADMIN') {
                if (view !== 'admin') {
                    // Redirecting Clinic Admin to Dashboard
                    setView('admin');
                }
                return;
            }

            // 1b. CRITICAL: Clinic Staff Bypass
            if (profile.role === 'CLINIC_STAFF' && profile.clinic_id) {
                if (view !== 'pos' && view !== 'staff' && view !== 'inventory-dashboard') {
                    // Redirecting Clinic Staff to POS
                    setView('pos');
                }
                return;
            }

            // 2. Setup Redirect for Orphaned Hospital Admins ONLY
            if ((profile.role === 'ADMIN' || profile.role === 'HOSPITAL_ADMIN') && !profile.hospital_id) {
                if (view !== 'setup') setView('setup');
            }

            // 3. Default Routing (Only if view is generic 'selection' or 'setup' but shouldn't be)
            else if (view === 'selection' || (view === 'setup' && profile.hospital_id)) {
                if (['ADMIN', 'SUPER_ADMIN', 'HOSPITAL_ADMIN', 'CLINIC_ADMIN'].includes(profile.role)) {
                    setView('admin');
                } else if (profile.role === 'CLINIC_STAFF') {
                    setView('pos');
                }
            }
        } else if (!loading && !session) {
            setView('selection');
        }
    }, [loading, profile, session]); // Check: Removed 'view' dependency to prevent loops, checking logic.

    // Used for Super Admin "Hospital X-Ray"
    const [selectedHospitalId, setSelectedHospitalId] = useState<string | null>(null);

    const navigateToHospital = (id: string) => {
        setSelectedHospitalId(id)
        setView('hospitals')
    }

    const handleBackFromDetails = () => {
        setSelectedHospitalId(null);
    };

    const handleLogout = async () => {
        try {
            await supabase.auth.signOut();
        } finally {
            localStorage.removeItem('lastActiveView');
            navigate('/');
            // Force a slight delay before reload to ensure router catches the state change if needed
            setTimeout(() => window.location.reload(), 100);
        }
    }

    // Auth checks are now handled by AppRouter, so we don't need them here.
    return (
        <AppLayout
            onLogout={handleLogout}
            view={view}
            setView={setView}
            lockNavigation={view === 'setup'}
        >
            {/* ERROR STATE: Locked out if no Role */}
            {view === 'selection' && !loading && profile && !['ADMIN', 'CLINIC_STAFF', 'SUPER_ADMIN', 'HOSPITAL_ADMIN', 'CLINIC_ADMIN'].includes(profile?.role || '') && (
                <div className="flex flex-col items-center justify-center p-12 text-center h-full">
                    <Shield className="w-20 h-20 text-slate-200 mb-6" />
                    <h1 className="text-3xl font-bold text-slate-900">Access Restricted</h1>
                    <p className="text-slate-500 max-w-md mt-2">
                        Your account ({profile.email}) is active but has no assigned role.
                        <br />Current Role: <code className="bg-slate-100 px-2 py-1 rounded text-sm">{profile.role || 'NULL'}</code>
                    </p>
                </div>
            )}

            {/* STAFF PORTAL VIEW (HR) */}
            {view === 'staff' && (
                <StaffPortal />
            )}

            {/* EARNINGS DASHBOARD (HR/ADMINS) */}
            {view === 'earnings' && (
                <EarningsDashboard />
            )}

            {/* POS/BILLING DASHBOARD */}
            {view === 'pos' && (
                <POSDashboard />
            )}

            {/* ATTENDANCE DASHBOARD */}
            {view === 'attendance' && selectedClinicId && (
                <ClinicAttendance clinicId={selectedClinicId} />
            )}
            {view === 'attendance' && profile?.role === 'CLINIC_ADMIN' && profile.clinic_id && (
                <ClinicAttendance clinicId={profile.clinic_id} />
            )}

            {/* DASHBOARD ROUTER (3-TIER LOGIC) */}
            {view === 'admin' && (
                <>
                    {/* TIER 1: SUPER ADMIN */}
                    {(['SUPER_ADMIN', 'OWNER'].includes(profile?.role || '')) && (
                        <SuperAdminDashboard onView={navigateToHospital} />
                    )}

                    {/* TIER 2: HOSPITAL ADMIN */}
                    {(['HOSPITAL_ADMIN', 'ADMIN'].includes(profile?.role || '')) && (
                        selectedClinicId ? (
                            // Showing Clinic View (Drill Down)
                            <ClinicAdminDashboard clinicId={selectedClinicId} onBack={() => setSelectedClinicId(null)} onNavigate={setView} />
                        ) : (
                            // Showing Hospital HQ
                            <HospitalDashboard onSelectClinic={setSelectedClinicId} />
                        )
                    )}

                    {/* TIER 3: CLINIC ADMIN */}
                    {(profile?.role === 'CLINIC_ADMIN') && (
                        profile.clinic_id ? (
                            <ClinicAdminDashboard clinicId={profile.clinic_id} onNavigate={setView} />
                        ) : (
                            <div className="p-12 text-center text-slate-500">
                                <h2 className="text-xl font-bold text-slate-800">No Clinic Assigned</h2>
                                <p className="mb-4">Please contact your Hospital Administrator.</p>

                                <Button
                                    variant="outline"
                                    className="border-slate-300 text-slate-600 hover:text-blue-600 hover:border-blue-300"
                                    onClick={async () => {
                                        await import('@/components/ui/use-toast')
                                        // 1. Search Staff Details
                                        const { data: staffRec } = await supabase.from('staff_details').select('clinic_id').eq('user_id', profile.id).single();

                                        if (staffRec?.clinic_id) {
                                            await supabase.from('profiles').update({ clinic_id: staffRec.clinic_id }).eq('id', profile.id);
                                            window.location.reload();
                                            return;
                                        }

                                        // 2. Fallback: Search Clinic by Name match (e.g. "Medanta" -> "Medanta Clinic")
                                        // Since we can't guess easily, we just try to find ANY clinic where they are staff?
                                        // Actually if step 1 failed, they likely aren't in staff_details either.

                                        // 3. Last Resort: Search for a matching clinic name if their email implies it? No too risky.
                                        alert("Could not automatically find your clinic linkage. Please report this to support.");
                                    }}
                                >
                                    Check for Linked Clinic (Auto-Fix)
                                </Button>
                            </div>
                        )
                    )}
                </>
            )}

            {/* SETUP VIEW (Onboarding) */}
            {view === 'setup' && (
                <AdminSetup userProfile={profile} onComplete={() => window.location.reload()} />
            )}

            {/* Inventory Dashboard */}
            {view === 'inventory-dashboard' && (
                <InventoryDashboard />
            )}

            {/* HOSPITALS REGISTRY & DETAILS */}
            {view === 'hospitals' && (
                selectedHospitalId ? (
                    // X-RAY VIEW
                    <HospitalDetails
                        hospitalId={selectedHospitalId}
                        onBack={handleBackFromDetails}
                    />
                ) : (
                    // REGISTRY VIEW
                    <HospitalsRegistry onView={navigateToHospital} />
                )
            )}

            {view === 'audit_logs' && (
                <AuditLogs />
            )}


            {view === 'settings' && (
                <SettingsDashboard />
            )}

            <Toaster />
        </AppLayout>
    )
}

function AppRouter() {
    const { session, loading, isPasswordRecovery } = useHospital();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
            </div>
        )
    }

    if (isPasswordRecovery) {
        return (
            <>
                <ResetPasswordPage />
                <Toaster />
            </>
        )
    }

    return (
        <Router>
            <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={session ? <Navigate to="/app" /> : <LoginPage />} />
                <Route path="/app/*" element={session ? <AppContent /> : <Navigate to="/login" />} />
                <Route path="*" element={<Navigate to="/" />} />
            </Routes>
        </Router>
    )
}

function App() {
    return (
        <HospitalProvider>
            <AppRouter />
        </HospitalProvider>
    )
}

export default App
