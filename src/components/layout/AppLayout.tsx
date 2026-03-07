import React, { useState, useMemo } from 'react'
import { useHospital } from '@/context/HospitalContext'
import { NotificationsPanel } from '@/components/ui/NotificationsPanel'
import { TrialBanner, PastDueBanner, ReadOnlyBanner, DowngradeResolutionModal } from '@/components/billing'
import { requestNotificationPermission } from '@/lib/notifications'

interface AppLayoutProps {
    children: React.ReactNode
    onLogout: () => void
    view: string
    setView: (view: any) => void
    lockNavigation?: boolean
}

export function AppLayout({ children, onLogout, view, setView, lockNavigation = false }: AppLayoutProps) {
    const { profile: userProfile, hospital, clinics, requiresDowngradeResolution, inventory } = useHospital()
    const role = userProfile?.role
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)

    // Calculate Low Stock Count for Badge
    const lowStockCount = useMemo(() => {
        let items = inventory;
        if (role === 'CLINIC_ADMIN' || role === 'CLINIC_STAFF') {
            items = inventory.filter(i => i.clinic_id === userProfile?.clinic_id);
        }
        return items.filter(i => i.quantity < i.threshold).length;
    }, [inventory, role, userProfile?.clinic_id]);

    // Helper for Navigation Items
    const NavItem = ({ icon, label, active, onClick, disabled }: any) => (
        <button
            onClick={() => {
                if (!disabled) {
                    onClick()
                    setIsMobileMenuOpen(false)
                }
            }}
            disabled={disabled}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors group
                ${disabled ? 'opacity-50 cursor-not-allowed text-slate-400' :
                    active
                        ? 'bg-primary/10 text-primary'
                        : 'text-slate-500 hover:bg-slate-200/50'}
                `}
        >
            <span className={`material-symbols-outlined ${active ? '' : ''}`}>{icon}</span>
            <span className={`text-sm ${active ? 'font-semibold' : 'font-medium'}`}>{label}</span>
            {disabled && <span className="material-symbols-outlined text-[16px] ml-auto opacity-50">lock</span>}
        </button>
    )

    // Dynamic Branding
    const myClinic = userProfile?.clinic_id ? clinics.find(c => c.id === userProfile.clinic_id) : null

    const getBrandName = () => {
        if (['SUPER_ADMIN', 'OWNER'].includes(role || '')) return 'SaaS Control';
        if (role === 'CLINIC_ADMIN' && myClinic) return myClinic.name;
        return hospital?.name || 'MedFlow';
    }

    const getBrandSubtitle = () => {
        if (['SUPER_ADMIN', 'OWNER'].includes(role || '')) return 'System Admin';
        if (role === 'CLINIC_ADMIN') return 'Clinic Manager';
        return 'Hospital OS';
    }

    const isClinicPaused = myClinic?.status === 'paused' && role !== 'SUPER_ADMIN' && role !== 'OWNER';

    if (isClinicPaused) {
        return (
            <div className="text-slate-900 h-screen w-screen flex overflow-hidden bg-slate-50 font-sans">
                <div className="w-full h-full flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 text-center ring-1 ring-slate-200">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <span className="material-symbols-outlined text-3xl text-red-600">block</span>
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900 mb-2">Clinic Paused</h2>
                        <p className="text-slate-600 mb-8">
                            Your clinic has been paused by the hospital administrator.
                            You cannot access the system until it is unpaused.
                        </p>
                        <button
                            onClick={onLogout}
                            className="w-full bg-slate-100 text-slate-700 font-medium py-3 rounded-xl hover:bg-slate-200 transition-colors"
                        >
                            Sign Out
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="text-slate-900 h-screen w-screen flex overflow-hidden bg-white font-sans">

            {/* MOBILE OVERLAY */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 lg:hidden"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* SIDEBAR */}
            <aside className={`
                w-64 bg-sidebar border-r border-slate-200 flex flex-col shrink-0 h-screen fixed lg:static z-50
                transform transition-transform duration-300 ease-in-out
                ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            `}>
                <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                            <span className="material-symbols-outlined text-white text-xl">local_hospital</span>
                        </div>
                        <span className="font-bold text-lg tracking-tight truncate max-w-[150px]">{getBrandName()}</span>
                    </div>
                    <button className="lg:hidden text-slate-500" onClick={() => setIsMobileMenuOpen(false)}>
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto no-scrollbar py-4 px-2 space-y-1">
                    {/* HOSPITAL ADMIN MENU */}
                    {(role === 'ADMIN' || role === 'HOSPITAL_ADMIN') && (
                        <>
                            <NavItem
                                icon="dashboard"
                                label={lockNavigation ? "Setup Required" : "Dashboard"}
                                active={view === 'admin' || view === 'setup'}
                                onClick={() => setView('admin')}
                                disabled={false}
                            />
                            <NavItem
                                icon="inventory"
                                label="Inventory"
                                active={view === 'inventory-dashboard'}
                                onClick={() => setView('inventory-dashboard')}
                                disabled={lockNavigation}
                            />
                            <NavItem
                                icon="badge"
                                label="Staff Management"
                                active={view === 'staff-management' || view === 'staff'}
                                onClick={() => setView('staff')}
                                disabled={lockNavigation}
                            />
                            <NavItem
                                icon="schedule"
                                label="Shift Management"
                                active={view === 'shift-management'}
                                onClick={() => setView('shift-management')}
                                disabled={lockNavigation}
                            />
                            <NavItem
                                icon="account_balance_wallet"
                                label="Earnings"
                                active={view === 'earnings'}
                                onClick={() => setView('earnings')}
                                disabled={lockNavigation}
                            />
                            <NavItem
                                icon="receipt_long"
                                label="Subscription & Billing"
                                active={view === 'billing'}
                                onClick={() => setView('billing')}
                                disabled={lockNavigation}
                            />


                        </>
                    )}

                    {/* CLINIC ADMIN MENU */}
                    {role === 'CLINIC_ADMIN' && (
                        <>
                            <NavItem
                                icon="dashboard"
                                label="Clinic Dashboard"
                                active={view === 'admin'}
                                onClick={() => setView('admin')}
                                disabled={false}
                            />
                            <NavItem
                                icon="point_of_sale"
                                label="Billing & POS"
                                active={view === 'pos'}
                                onClick={() => setView('pos')}
                            />
                            <NavItem
                                icon="badge"
                                label="My Staff"
                                active={view === 'staff'}
                                onClick={() => setView('staff')}
                                disabled={false}
                            />
                            <NavItem
                                icon="how_to_reg"
                                label="Attendance"
                                active={view === 'attendance'}
                                onClick={() => setView('attendance')}
                                disabled={false}
                            />
                            <NavItem
                                icon="schedule"
                                label="Shift Management"
                                active={view === 'shift-management'}
                                onClick={() => setView('shift-management')}
                                disabled={false}
                            />
                            <NavItem
                                icon="inventory"
                                label="Inventory Control"
                                active={view === 'inventory-dashboard'}
                                onClick={() => setView('inventory-dashboard')}
                                disabled={false}
                            />
                        </>
                    )}

                    {/* SUPER ADMIN MENU */}
                    {(role === 'SUPER_ADMIN' || role === 'OWNER') && (
                        <>
                            <NavItem
                                icon="dashboard"
                                label="Command Center"
                                active={view === 'admin'}
                                onClick={() => setView('admin')}
                            />
                            <NavItem
                                icon="domain"
                                label="Hospitals Registry"
                                active={view === 'hospitals'}
                                onClick={() => setView('hospitals')}
                            />
                            <NavItem
                                icon="shield_person"
                                label="Audit Logs"
                                active={view === 'audit_logs'}
                                onClick={() => setView('audit_logs')}
                            />
                            <NavItem
                                icon="payments"
                                label="Platform Billing"
                                active={view === 'billing'}
                                onClick={() => setView('billing')}
                            />
                        </>
                    )}

                    {/* CLINIC STAFF MENU */}
                    {role === 'CLINIC_STAFF' && (
                        <>
                            <NavItem
                                icon="point_of_sale"
                                label="Billing & POS"
                                active={view === 'pos'}
                                onClick={() => setView('pos')}
                            />
                            <NavItem
                                icon="inventory"
                                label="Inventory"
                                active={view === 'inventory-dashboard'}
                                onClick={() => setView('inventory-dashboard')}
                            />
                        </>
                    )}
                </div>

                <div className="p-4 border-t border-slate-200 mt-auto shrink-0 bg-white">
                    {/* SETTINGS MENU ITEM - FIXED TO BOTTOM */}
                    {['ADMIN', 'HOSPITAL_ADMIN', 'CLINIC_ADMIN', 'SUPER_ADMIN', 'OWNER'].includes(role || '') && (
                        <div className="mb-2">
                            <NavItem
                                icon="settings"
                                label="Settings"
                                active={view === 'settings'}
                                onClick={() => setView('settings')}
                                disabled={lockNavigation}
                            />
                        </div>
                    )}

                    <button
                        onClick={onLogout}
                        className="w-full text-left flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50 rounded-lg transition-colors active:bg-slate-100"
                    >
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold shrink-0">
                            {userProfile?.full_name?.[0] || 'U'}
                        </div>
                        <div className="overflow-hidden flex-1">
                            <p className="text-xs font-semibold truncate">{userProfile?.full_name}</p>
                            <p className="text-[10px] text-slate-500 truncate">{getBrandSubtitle()}</p>
                        </div>
                        <span className="material-symbols-outlined text-red-500 text-lg group-hover:text-red-700" title="Sign Out">logout</span>
                    </button>
                </div>
            </aside>

            {/* MAIN CONTENT AREA */}
            <main className="flex-1 overflow-y-auto bg-white flex flex-col relative w-full">

                {/* HEADER */}
                <header className="h-20 border-b border-slate-100 flex items-center justify-between px-4 lg:px-12 sticky top-0 bg-white/95 backdrop-blur-md z-30 shrink-0">
                    <div className="flex items-center gap-4">
                        <button className="lg:hidden p-2.5 -ml-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all flex items-center justify-center" onClick={() => setIsMobileMenuOpen(true)}>
                            <span className="material-symbols-outlined text-[24px]">menu</span>
                        </button>
                        <div className="flex flex-col">
                            <h1 className="text-xl font-bold text-slate-900 tracking-tight capitalize leading-none">
                                {view.replace('-', ' ')}
                            </h1>
                            <div className="flex items-center gap-2 mt-1.5 lg:hidden">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest leading-none">Live System</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Notifications */}
                        <div className="flex items-center gap-1 sm:gap-2">
                            {Notification.permission !== 'granted' && (
                                <button
                                    onClick={async () => {
                                        const granted = await requestNotificationPermission();
                                        if (granted) {
                                            // Refresh component state or show success
                                            window.location.reload();
                                        }
                                    }}
                                    className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors"
                                    title="Enable Desktop Notifications"
                                >
                                    <span className="material-symbols-outlined text-[16px]">notifications_active</span>
                                    Enable Desktop Alerts
                                </button>
                            )}
                            <button
                                onClick={() => setIsNotificationsOpen(true)}
                                className="relative p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all active:scale-95 group"
                            >
                                <span className="material-symbols-outlined text-2xl group-hover:rotate-[15deg] transition-transform">notifications</span>
                                {lowStockCount > 0 && (
                                    <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 bg-red-500 border-2 border-white rounded-full flex items-center justify-center text-[10px] font-bold text-white group-hover:scale-110 transition-transform">
                                        {lowStockCount > 99 ? '99+' : lowStockCount}
                                    </span>
                                )}
                            </button>
                        </div>
                        <NotificationsPanel
                            open={isNotificationsOpen}
                            onClose={() => setIsNotificationsOpen(false)}
                            onNavigate={setView}
                        />
                        {/* We leave the top right action area primarily to the child components, 
                        but we can provide a container for them if needed later. */}
                    </div>
                </header>

                {/* BILLING BANNERS - Only show for regular hospital/clinic admins */}
                {role !== 'SUPER_ADMIN' && role !== 'OWNER' && (
                    <>
                        <TrialBanner
                            onUpgradeClick={() => setView('billing')}
                            onExtendClick={() => setView('billing')}
                        />
                        <PastDueBanner />
                        <ReadOnlyBanner />
                    </>
                )}

                {/* SCROLLABLE INNER CONTENT */}
                <div className="flex-1 p-4 lg:p-12 lg:pt-6 max-w-[1600px] w-full mx-auto">
                    {!['SUPER_ADMIN', 'OWNER'].includes(role || '') && (
                        <DowngradeResolutionModal isOpen={requiresDowngradeResolution} />
                    )}
                    {children}
                </div>
            </main>
        </div>
    )
}
