import { useState } from 'react'
import { useHospital } from '@/context/HospitalContext'
import { NotificationsPanel } from '@/components/ui/NotificationsPanel'
import { TrialBanner, PastDueBanner, ReadOnlyBanner } from '@/components/billing'

interface AppLayoutProps {
    children: React.ReactNode
    onLogout: () => void
    view: string
    setView: (view: any) => void
    lockNavigation?: boolean
}

export function AppLayout({ children, onLogout, view, setView, lockNavigation = false }: AppLayoutProps) {
    const { profile: userProfile, hospital, clinics } = useHospital()
    const role = userProfile?.role
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)

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
                <header className="h-16 border-b border-slate-100 flex items-center justify-between px-4 lg:px-8 sticky top-0 bg-white/80 backdrop-blur-md z-10 shrink-0">
                    <div className="flex items-center gap-3">
                        <button className="lg:hidden p-2 -ml-2 text-slate-400 hover:text-slate-600" onClick={() => setIsMobileMenuOpen(true)}>
                            <span className="material-symbols-outlined">menu</span>
                        </button>
                        <h1 className="text-xl font-bold text-slate-800 capitalize hidden sm:block">
                            {view.replace('-', ' ')}
                        </h1>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="relative hidden sm:block">
                            <button
                                className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
                                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                            >
                                <span className="material-symbols-outlined">notifications</span>
                                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full"></span>
                            </button>
                        </div>
                        <NotificationsPanel
                            open={isNotificationsOpen}
                            onClose={() => setIsNotificationsOpen(false)}
                        />
                        {/* We leave the top right action area primarily to the child components, 
                        but we can provide a container for them if needed later. */}
                    </div>
                </header>

                {/* BILLING BANNERS */}
                <TrialBanner
                    onUpgradeClick={() => setView('billing')}
                    onExtendClick={() => setView('billing')}
                />
                <PastDueBanner onUpgradeClick={() => setView('billing')} />
                <ReadOnlyBanner onUpgradeClick={() => setView('billing')} />

                {/* SCROLLABLE INNER CONTENT */}
                <div className="flex-1 p-4 lg:p-8 max-w-[1600px] w-full mx-auto">
                    {children}
                </div>
            </main>
        </div>
    )
}
