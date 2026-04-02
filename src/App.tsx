import { useState, useEffect } from 'react'
import { StaffPortal } from '@/components/StaffPortal'
import ProcurementDashboard from '@/components/ProcurementDashboard';
import { MedicineMigration } from '@/components/MedicineMigration';
import { SuperAdminDashboard } from "@/components/SuperAdminDashboard";
import { HospitalDashboard } from "@/components/HospitalDashboard";
import { ClinicAdminDashboard } from "@/components/ClinicAdminDashboard";
import { AppLayout } from "@/components/layout/AppLayout";
import { LoginPage } from "@/components/LoginPage";
import { InventoryDashboard } from "@/components/InventoryDashboard";
import { AdminSetup } from "@/components/AdminSetup";
import { HospitalProvider, useHospital } from '@/context/HospitalContext';
import { TourProvider } from '@/context/TourContext';
import { ProductTour } from '@/components/ProductTour';
import { ResetPasswordPage } from "@/components/ResetPasswordPage";
import { HospitalsRegistry } from '@/components/HospitalsRegistry';
import { ExpensesDashboard } from './components/ExpensesDashboard';
import { EquipmentsDashboard } from './components/EquipmentsDashboard';
import { HospitalDetails } from '@/components/HospitalDetails';
import { AuditLogs } from '@/components/AuditLogs';
import { POSDashboard } from '@/components/POSDashboard';
import { ClinicAttendance } from '@/components/ClinicAttendance';
import { ShiftManagement } from '@/components/ShiftManagement';
import { HospitalShiftManagement } from '@/components/HospitalShiftManagement';
import { EarningsDashboard } from '@/components/EarningsDashboard';
import { SettingsDashboard } from '@/components/SettingsDashboard';
import { CAFinancialSuite } from '@/components/CAFinancialSuite';
import { IPDDashboard } from '@/components/IPDDashboard';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from '@/pages/LandingPage';
import { RegisterPage } from '@/components/RegisterPage';
import { BillingOverview, SubscriptionDashboard } from '@/components/billing';
import AboutPage from '@/pages/AboutPage';
import NewsPage from '@/pages/NewsPage';
import ContactPage from '@/pages/ContactPage';
import ClinicOperationsPage from '@/pages/ClinicOperationsPage';
import HospitalCommandCenterPage from '@/pages/HospitalCommandCenterPage';
import PrivacyPage from '@/pages/PrivacyPage';
import CareersPage from '@/pages/CareersPage';
import SupportPage from '@/pages/SupportPage';
import { useLocation } from 'react-router-dom';
import { logPageView } from '@/lib/analytics';
import { motion, AnimatePresence } from 'framer-motion';
import { pageVariants } from '@/lib/transitions';

import { Loader2, Shield } from 'lucide-react'
import { Button } from '@/components/ui/basic'
import { Toaster } from '@/components/ui/toaster'
import { authService } from '@/lib/authService'
import { dataService } from '@/lib/dataService'

// View types
type View = 'selection' | 'staff' | 'admin' | 'inventory-dashboard' | 'setup' | 'hospitals' | 'audit_logs' | 'pos' | 'attendance' | 'earnings' | 'settings' | 'billing' | 'shift-management' | 'procurement' | 'medicine-migration' | 'expenses' | 'equipments' | 'ca-suite' | 'ipd'

const PageWrapper = ({ children }: { children: React.ReactNode }) => (
    <motion.div
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className="w-full h-full"
    >
        {children}
    </motion.div>
);

function AppContent() {
    const { session, profile, loading } = useHospital();
    const isHospitalAdmin = profile?.role === 'HOSPITAL_ADMIN' || profile?.role === 'ADMIN';
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
            // Each role has a set of valid views (matching their sidebar menu).
            // Only redirect to the default if the current view is NOT in their allowed set.
            // This prevents losing the user's position when the component remounts
            // (e.g. tab switch, minimize, auth state re-trigger).

            // 1. CRITICAL: Clinic Admin Bypass (Gatekeeper Fix)
            // Allow entry even if clinic_id is null (The Dashboard will handle the "No Clinic" state)
            if (profile.role === 'CLINIC_ADMIN') {
                const clinicAdminViews: View[] = ['admin', 'pos', 'staff', 'attendance', 'shift-management', 'inventory-dashboard', 'ipd', 'settings'];
                if (!clinicAdminViews.includes(view)) {
                    setView('admin');
                }
                return;
            }

            // 1b. CRITICAL: Clinic Staff & Clinic-Linked Doctors Bypass
            if ((profile.role === 'CLINIC_STAFF' || profile.role === 'DOCTOR') && profile.clinic_id && !profile.hospital_id) {
                const clinicStaffViews: View[] = ['pos', 'staff', 'inventory-dashboard', 'ipd'];
                if (!clinicStaffViews.includes(view)) {
                    setView('pos');
                }
                return;
            }

            // 1c. Hospital-Linked Doctors
            if (profile.role === 'DOCTOR' && profile.hospital_id) {
                const doctorViews: View[] = ['admin', 'ipd', 'pos', 'inventory-dashboard'];
                if (!doctorViews.includes(view)) {
                    setView('admin');
                }
                return;
            }

            // 2. Setup Redirect for Orphaned Hospital Admins ONLY
            if ((profile.role === 'ADMIN' || profile.role === 'HOSPITAL_ADMIN') && !profile.hospital_id) {
                if (view !== 'setup') setView('setup');
            }

            // 2b. Hospital Admin — allow all their sidebar views
            else if (['ADMIN', 'HOSPITAL_ADMIN'].includes(profile.role)) {
                const hospitalAdminViews: View[] = ['admin', 'inventory-dashboard', 'staff', 'shift-management', 'earnings', 'billing', 'procurement', 'expenses', 'equipments', 'ipd', 'ca-suite', 'settings', 'setup', 'pos', 'attendance', 'medicine-migration'];
                if (!hospitalAdminViews.includes(view)) {
                    setView('admin');
                }
            }

            // 2c. Super Admin — allow all their sidebar views
            else if (['SUPER_ADMIN', 'OWNER'].includes(profile.role)) {
                const superAdminViews: View[] = ['admin', 'hospitals', 'audit_logs', 'billing', 'settings'];
                if (!superAdminViews.includes(view)) {
                    setView('admin');
                }
            }

            // 3. Default Routing (Only if view is generic 'selection' or 'setup' but shouldn't be)
            else if (view === 'selection' || (view === 'setup' && profile.hospital_id)) {
                if (['ADMIN', 'SUPER_ADMIN', 'HOSPITAL_ADMIN', 'CLINIC_ADMIN'].includes(profile.role)) {
                    setView('admin');
                } else if (profile.role === 'CLINIC_STAFF' || (profile.role === 'DOCTOR' && profile.clinic_id)) {
                    setView('pos');
                } else if (profile.role === 'DOCTOR' && profile.hospital_id) {
                    setView('admin');
                }
            }
        } else if (!loading && !session) {
            setView('selection');
        }
    }, [loading, profile, session]); // Removed 'view' dependency to prevent redirect loops.

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
            await authService.signOut();
        } catch (err) {
            console.warn('Sign out error:', err);
        } finally {
            // Clear all session-related localStorage
            localStorage.removeItem('lastActiveView');
            // Remove auth tokens from localStorage
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith('sb-') || key.includes('supabase') || key.includes('auth')) {
                    localStorage.removeItem(key);
                }
            });
            // Hard redirect to fully reset app state (avoids stale React state)
            window.location.href = window.location.origin + window.location.pathname + '#/login';
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
            <AnimatePresence mode="wait">
                <PageWrapper key={view}>
                    {/* ERROR STATE: Locked out if no Role */}
                    {view === 'selection' && !loading && profile && !['ADMIN', 'CLINIC_STAFF', 'SUPER_ADMIN', 'HOSPITAL_ADMIN', 'CLINIC_ADMIN', 'DOCTOR'].includes(profile?.role || '') && (
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
                        <POSDashboard onNavigate={setView} />
                    )}

                    {/* PROCUREMENT DASHBOARD */}
                    {view === 'procurement' && (['HOSPITAL_ADMIN', 'ADMIN', 'SUPER_ADMIN', 'OWNER'].includes(profile?.role || '')) && (
                        <ProcurementDashboard />
                    )}


                    {/* ATTENDANCE DASHBOARD */}
                    {view === 'attendance' && selectedClinicId && (
                        <ClinicAttendance clinicId={selectedClinicId} onNavigate={(v) => setView(v as View)} />
                    )}
                    {view === 'attendance' && profile?.role === 'CLINIC_ADMIN' && profile.clinic_id && (
                        <ClinicAttendance clinicId={profile.clinic_id} onNavigate={(v) => setView(v as View)} />
                    )}

                    {/* SHIFT MANAGEMENT */}
                    {view === 'shift-management' && (
                        (['HOSPITAL_ADMIN', 'ADMIN'].includes(profile?.role || '')) ? (
                            <HospitalShiftManagement />
                        ) : (
                            profile?.clinic_id ? (
                                <ShiftManagement clinicId={profile.clinic_id} />
                            ) : (
                                <div className="p-12 text-center text-slate-500">No Clinic Selected</div>
                            )
                        )
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
                                                // 1. Search Staff Details
                                                const results = await dataService.list('staff_details', { filters: [{ field: 'user_id', operator: '==', value: profile.id }] });
                                                const staffRec = results[0];

                                                if (staffRec?.clinic_id) {
                                                    await dataService.update('profiles', profile.id, { clinic_id: staffRec.clinic_id });
                                                    window.location.reload();
                                                    return;
                                                }

                                                alert("Could not automatically find your clinic linkage. Please report this to support.");
                                            }}
                                        >
                                            Check for Linked Clinic (Auto-Fix)
                                        </Button>
                                    </div>
                                )
                            )}
                            {/* TIER 4: DOCTOR (Hospital Context) */}
                            {(profile?.role === 'DOCTOR') && profile.hospital_id && (
                                <HospitalDashboard onSelectClinic={setSelectedClinicId} />
                            )}
                        </>
                    )}

                    {/* SETUP VIEW (Onboarding) */}
                    {view === 'setup' && (
                        <AdminSetup userProfile={profile} onComplete={() => window.location.reload()} />
                    )}

                    {/* Inventory Dashboard */}
                    {view === 'inventory-dashboard' && (
                        <InventoryDashboard onNavigate={setView} />
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

                {view === 'medicine-migration' && isHospitalAdmin && (
                    <MedicineMigration onBack={() => setView('inventory-dashboard')} />
                )}

                    {view === 'billing' && (
                        <div className="max-w-4xl mx-auto">
                            {['SUPER_ADMIN', 'OWNER'].includes(profile?.role || '') ? (
                                <BillingOverview />
                            ) : (
                                <SubscriptionDashboard />
                            )}
                        </div>
                    )}

                    {view === 'expenses' && (
                        <ExpensesDashboard />
                    )}

                    {view === 'equipments' && (
                        <EquipmentsDashboard />
                    )}

                    {view === 'ca-suite' && (
                        <CAFinancialSuite />
                    )}

                    {view === 'ipd' && (
                        <IPDDashboard />
                    )}

                    {view === 'settings' && (
                        <SettingsDashboard />
                    )}
                </PageWrapper>
            </AnimatePresence>

            <Toaster />
        </AppLayout>

    )
}

function AnalyticsTracker() {
    const location = useLocation();

    useEffect(() => {
        // Correctly handle HashRouter paths
        const path = location.pathname + location.search + location.hash;
        console.log('[GA4] Logging pageview:', path); // DEBUG
        logPageView(path);
    }, [location]);

    return null;
}

function AppRouter() {
    const { session, loading, isPasswordRecovery } = useHospital();
    const location = useLocation();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
            </div>
        )
    }

    const isResetPath = window.location.hash.startsWith('#/reset-password');

    if (isPasswordRecovery || isResetPath) {
        return (
            <>
                <ResetPasswordPage />
                <Toaster />
            </>
        )
    }

    return (
        <>
            <AnalyticsTracker />
            <AnimatePresence mode="wait">
                <Routes location={location} key={location.pathname}>
                    <Route path="/" element={<PageWrapper><LandingPage /></PageWrapper>} />
                    <Route path="/about" element={<PageWrapper><AboutPage /></PageWrapper>} />
                    <Route path="/news" element={<PageWrapper><NewsPage /></PageWrapper>} />
                    <Route path="/contact" element={<PageWrapper><ContactPage /></PageWrapper>} />
                    <Route path="/clinic-operations" element={<PageWrapper><ClinicOperationsPage /></PageWrapper>} />
                    <Route path="/hospital-command-center" element={<PageWrapper><HospitalCommandCenterPage /></PageWrapper>} />
                    <Route path="/privacy" element={<PageWrapper><PrivacyPage /></PageWrapper>} />
                    <Route path="/careers" element={<PageWrapper><CareersPage /></PageWrapper>} />
                    <Route path="/support" element={<PageWrapper><SupportPage /></PageWrapper>} />
                    <Route path="/login" element={session ? <Navigate to="/app" /> : <PageWrapper><LoginPage /></PageWrapper>} />
                    <Route path="/register" element={session ? <Navigate to="/app" /> : <PageWrapper><RegisterPage /></PageWrapper>} />
                    <Route path="/app/*" element={session ? <AppContent /> : <Navigate to="/login" />} />
                    <Route path="*" element={<Navigate to="/" />} />
                </Routes>
            </AnimatePresence>
        </>
    )
}

function Main() {
    return (
        <Router>
            <TourProvider>
                <ProductTour />
                <AppRouter />
            </TourProvider>
        </Router>
    );
}

function App() {
    return (
        <HospitalProvider>
            <Main />
        </HospitalProvider>
    )
}

export default App
