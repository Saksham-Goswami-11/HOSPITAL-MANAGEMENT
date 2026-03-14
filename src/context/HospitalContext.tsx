
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { authService as auth } from '@/lib/authService';
import { dataService as db } from '@/lib/dataService';
import { useSubscription, SubscriptionContextValue } from '@/hooks/useSubscription';
import { showNotification } from '@/lib/notifications';
import { getStartOfTodayIST } from '@/lib/utils';

// Define Types
type Profile = {
    id: string;
    role: string;
    email: string;
    hospital_id: string;
    clinic_id?: string;
    [key: string]: any;
};

type Hospital = {
    id: string;
    name: string;
    branding_color?: string;
    settings?: Record<string, any>;
    [key: string]: any;
};

type Clinic = {
    id: string;
    name: string;
    address?: string;
    settings?: Record<string, any>;
    status?: 'active' | 'paused';
    scheduled_deletion_date?: string | null;
    [key: string]: any;
};

type InventoryItem = {
    id: string;
    item_name: string;
    quantity: number; // This remains total units (tablets)
    mrp: number; // Price per pack
    units_per_pack: number; // Number of units in one pack
    threshold: number;
    clinic_id: string;
    hospital_id: string;
    clinics?: { name: string };
    is_active?: boolean;
    updated_at?: string;
    [key: string]: any;
};

export interface Notification {
    id: string;
    type: 'sale' | 'low_stock' | 'consultation' | 'pharmacy';
    title: string;
    message: string;
    timestamp: string;
    clinicName?: string;
    icon: string;
    color: string;
    data?: any;
}

interface HospitalContextType {
    session: any;
    profile: Profile | null;
    hospital: Hospital | null;
    managedClinic: Clinic | null;
    hasOrganization: boolean;
    clinics: Clinic[];
    inventory: InventoryItem[];
    loading: boolean;
    refreshData: () => Promise<void>;
    updateInventoryItem: (id: string, updates: Partial<InventoryItem>) => Promise<void>;
    isPasswordRecovery: boolean;
    setIsPasswordRecovery: (isRecovery: boolean) => void;
    updateHospitalSettings: (hospitalId: string, settings: Record<string, any>) => Promise<void>;
    updateClinicSettings: (clinicId: string, settings: Record<string, any>) => Promise<void>;
    updateHospitalProfile: (hospitalId: string, updates: Partial<Hospital>) => Promise<void>;
    updateClinicProfile: (clinicId: string, updates: Partial<Clinic>) => Promise<void>;
    updateUserPassword: (password: string) => Promise<void>;
    billing: SubscriptionContextValue;
    requiresDowngradeResolution: boolean;
    activeClinics: Clinic[];
    pendingRestockId: string | null;
    setPendingRestockId: (id: string | null) => void;
    pendingPOItem: any | null;
    setPendingPOItem: (item: any | null) => void;
    notifications: Notification[];
    unseenCount: number;
    markNotificationsAsSeen: () => void;
    revenueSummary: any[];
    expiringItems: any[];
    fetchDashboardStats: (hospitalId?: string, clinicsOverride?: Clinic[]) => Promise<void>;
}

const HospitalContext = createContext<HospitalContextType | undefined>(undefined);

export function HospitalProvider({ children }: { children: ReactNode }) {
    const [session, setSession] = useState<any>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [hospital, setHospital] = useState<Hospital | null>(null);
    const [managedClinic, setManagedClinic] = useState<Clinic | null>(null);
    const [clinics, setClinics] = useState<Clinic[]>([]);
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
    const [pendingRestockId, setPendingRestockId] = useState<string | null>(null);
    const [pendingPOItem, setPendingPOItem] = useState<any | null>(null);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [lastSeenAt, setLastSeenAt] = useState<string>(() => localStorage.getItem('last_seen_notifications_at') || '2000-01-01T00:00:00.000Z');
    const [revenueSummary, setRevenueSummary] = useState<any[]>([]);
    const [expiringItems, setExpiringItems] = useState<any[]>([]);

    const rawBilling = useSubscription(profile?.hospital_id);

    const activeClinics = clinics.filter(c => c.status !== 'paused');

    // Override raw billing metrics with strictly active clinics count for limit checks
    const billing: SubscriptionContextValue = {
        ...rawBilling,
        usage: {
            ...rawBilling.usage,
            clinics_count: activeClinics.length
        },
        isAtLimit: (metric) => {
            if (metric === 'clinics_count') {
                const max = rawBilling.getLimit(metric);
                if (max === -1) return false;
                return activeClinics.length >= max;
            }
            return rawBilling.isAtLimit(metric);
        },
        getUsagePercent: (metric) => {
            if (metric === 'clinics_count') {
                const max = rawBilling.getLimit(metric);
                if (max === -1) return 0;
                if (max === 0) return 100;
                return Math.min(100, Math.round((activeClinics.length / max) * 100));
            }
            return rawBilling.getUsagePercent(metric);
        },
        getRemainingQuota: (metric) => {
            if (metric === 'clinics_count') {
                const max = rawBilling.getLimit(metric);
                if (max === -1) return Infinity;
                return Math.max(0, max - activeClinics.length);
            }
            return rawBilling.getRemainingQuota(metric);
        }
    };

    const limit = billing.getLimit('clinics_count');
    const isCalculating = loading || billing.loading;
    const requiresDowngradeResolution =
        !isCalculating &&
        !billing.isTrialing &&
        limit !== -1 &&
        activeClinics.length > limit;

    useEffect(() => {
        auth.onAuthStateChange((user, event) => {
            setSession(user);

            // Handle Password Recovery Event
            if (event === 'PASSWORD_RECOVERY') {
                setIsPasswordRecovery(true);
            }

            if (user) {
                fetchProfile(user.id);
            } else {
                setProfile(null);
                setHospital(null);
                setManagedClinic(null);
                setClinics([]);
                setInventory([]);
                setLoading(false);
            }
        });
    }, []);

    const fetchNotifications = async () => {
        if (!profile?.hospital_id) return;

        const notifs: Notification[] = [];
        const today = new Date().toISOString().split('T')[0];
        const isHospitalLevel = ['HOSPITAL_ADMIN', 'SUPER_ADMIN', 'OWNER'].includes(profile.role || '');

        try {
            // 1. Recent Sales
            const salesData = await db.list('sales', {
                filters: [
                    { column: 'timestamp', operator: 'gte', value: `${today}T00:00:00` }
                ],
                sort: { column: 'timestamp', ascending: false },
                limit: 10,
                select: '*, clinics(name)'
            }, !isHospitalLevel && profile.clinic_id ? { clinic_id: profile.clinic_id } : undefined);

            if (salesData) {
                salesData.forEach((sale: any) => {
                    const clinicName = Array.isArray(sale.clinics) ? sale.clinics[0]?.name : sale.clinics?.name;
                    const isConsultation = sale.sale_type === 'CONSULTATION';

                    notifs.push({
                        id: `sale-${sale.id}`,
                        type: isConsultation ? 'consultation' : 'pharmacy',
                        title: isConsultation ? 'Consultation Fee Collected' : 'Pharmacy Sale',
                        message: `₹${sale.amount?.toLocaleString()} • ${sale.patient_name} • ${sale.doctor_name}`,
                        timestamp: sale.timestamp,
                        clinicName: isHospitalLevel ? clinicName : undefined,
                        icon: isConsultation ? 'stethoscope' : 'medication',
                        color: isConsultation ? 'blue' : 'emerald',
                        data: sale
                    });
                });
            }

            // 2. Aggregated Low Stock
            const clinicInventory = isHospitalLevel
                ? inventory
                : inventory.filter(i => i.clinic_id === profile.clinic_id);

            const aggregatedInventory = new Map();
            clinicInventory.forEach(item => {
                const key = `${item.item_name}-${item.clinic_id}`;
                if (!aggregatedInventory.has(key)) {
                    aggregatedInventory.set(key, { ...item, total_quantity: 0 });
                }
                const record = aggregatedInventory.get(key);
                record.total_quantity += (item.quantity || 0);
            });

            const globalThreshold = hospital?.settings?.global_low_stock_threshold || 10;
            const lowStockItems = Array.from(aggregatedInventory.values()).filter((i: any) =>
                (i.total_quantity / (i.units_per_pack || 1)) < (i.threshold || globalThreshold)
            );

            lowStockItems.forEach((item: any) => {
                const clinic = clinics.find(c => c.id === item.clinic_id);
                const packsAvailable = (item.total_quantity / (item.units_per_pack || 1)).toFixed(1);
                notifs.push({
                    id: `stock-${item.item_name}-${item.clinic_id}`,
                    type: 'low_stock',
                    title: 'Low Stock Alert',
                    message: `${item.item_name} \u2014 only ${packsAvailable} packs left`,
                    timestamp: item.updated_at || new Date().toISOString(),
                    clinicName: isHospitalLevel ? clinic?.name : undefined,
                    icon: 'warning',
                    color: 'orange',
                    data: item
                });
            });

            notifs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            setNotifications(notifs);
        } catch (e) {
            console.error('Error fetching context notifications:', e);
        }
    };

    useEffect(() => {
        if (!loading && profile) {
            fetchNotifications();
        }
    }, [inventory, profile, loading]);

    const markNotificationsAsSeen = () => {
        const now = new Date().toISOString();
        setLastSeenAt(now);
        localStorage.setItem('last_seen_notifications_at', now);
    };

    const unseenCount = notifications.filter(n =>
        new Date(n.timestamp).getTime() > new Date(lastSeenAt).getTime()
    ).length;

    // Monitoring inventory for low stock notifications
    useEffect(() => {
        if (!loading && inventory.length > 0 && profile) {
            const globalThreshold = hospital?.settings?.global_low_stock_threshold || 10;
            const lowStockItems = inventory.filter(item => {
                const isRelevant = profile.role === 'HOSPITAL_ADMIN' || profile.role === 'ADMIN' || item.clinic_id === profile.clinic_id;
                const packs = item.quantity / (item.units_per_pack || 1);
                return isRelevant && packs < (item.threshold || globalThreshold);
            });

            // Prevent duplicate notifications in the same session by tracking notified item IDs
            const notifiedIds = new Set(JSON.parse(sessionStorage.getItem('notified_low_stock') || '[]'));
            let updated = false;

            lowStockItems.forEach(item => {
                if (!notifiedIds.has(item.id)) {
                    const packsAvailable = (item.quantity / (item.units_per_pack || 1)).toFixed(1);
                    showNotification('Low Stock Alert', {
                        body: `${item.item_name} is running low (${packsAvailable} packs left).`,
                        tag: `low-stock-${item.id}`
                    });
                    notifiedIds.add(item.id);
                    updated = true;
                }
            });

            if (updated) {
                sessionStorage.setItem('notified_low_stock', JSON.stringify(Array.from(notifiedIds)));
            }
        }
    }, [inventory, loading, profile]);

    const fetchDashboardStats = async (hospitalId?: string, clinicsOverride?: Clinic[]) => {
        const hId = hospitalId || profile?.hospital_id;
        if (!hId) return;

        // Use consistent date handling
        const now = new Date();
        const startOfToday = getStartOfTodayIST();
        const thirtyDaysFromNow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30).toISOString().split('T')[0];

        try {
            // 1. Expiring Items - Using date string instead of ISO string for 'date' column
            // Added is_active: true filter to exclude archived items
            const expiryData = await db.list('inventory', {
                filters: [
                    { column: 'hospital_id', operator: '==', value: hId },
                    { column: 'is_active', operator: '==', value: true },
                    { column: 'expiry_date', operator: '<', value: thirtyDaysFromNow },
                    { column: 'quantity', operator: '>', value: 0 }
                ],
                select: '*, clinics(name)'
            });

            if (expiryData) {
                const results = expiryData.map((item: any) => ({
                    ...item,
                    clinic_name: Array.isArray(item.clinics) ? item.clinics[0]?.name : item.clinics?.name
                }));
                setExpiringItems(results);
            } else {
                setExpiringItems([]);
            }

            // 2. Revenue Summary - Querying sales directly for reliability
            // The view admin_revenue_summary has internal filters that might fail for some users
            const todaySales = await db.list('sales', {
                filters: [
                    { column: 'hospital_id', operator: '==', value: hId },
                    { column: 'timestamp', operator: '>=', value: startOfToday }
                ]
            });

            // Aggregate sales by clinic to mimic the view structure
            // View structure: { clinic_id, clinic_name, total_revenue, transaction_count, revenue_date }
            // Using clinicsOverride || clinics to solve race condition for 'Unknown Clinic'
            const effectiveClinics = clinicsOverride || clinics;
            const aggregated = todaySales.reduce((acc: any, sale: any) => {
                const clinicId = sale.clinic_id;
                if (!acc[clinicId]) {
                    const clinic = effectiveClinics.find(c => c.id === clinicId);
                    acc[clinicId] = {
                        clinic_id: clinicId,
                        clinic_name: clinic?.name || 'Unknown Clinic',
                        total_revenue: 0,
                        transaction_count: 0,
                        revenue_date: startOfToday.split('T')[0]
                    };
                }
                acc[clinicId].total_revenue += Number(sale.amount);
                acc[clinicId].transaction_count += 1;
                return acc;
            }, {});

            setRevenueSummary(Object.values(aggregated));
        } catch (err) {
            console.error('Error fetching dashboard stats:', err);
        }
    };

    // Unified Real-time Subscription
    useEffect(() => {
        if (!profile?.hospital_id) return;

        const subs = [
            // Handle sales for both notifications and dashboard stats
            db.subscribe('sales', (newSale) => {
                if (newSale.hospital_id !== profile.hospital_id) return;

                // Update notifications
                fetchNotifications();
                // Update stats
                fetchDashboardStats(profile.hospital_id);

                // Show push notification
                const isConsultation = newSale.sale_type === 'CONSULTATION';
                if ((profile.role === 'CLINIC_ADMIN' && newSale.clinic_id === profile.clinic_id) ||
                    ['HOSPITAL_ADMIN', 'ADMIN', 'OWNER'].includes(profile.role)) {
                    showNotification(isConsultation ? 'New Consultation' : 'New Pharmacy Sale', {
                        body: `₹${newSale.amount?.toLocaleString()} • ${newSale.patient_name} • Dr. ${newSale.doctor_name}`,
                        tag: `sale-${newSale.id}`,
                        icon: isConsultation ? '/stethoscope.png' : '/medication.png'
                    });
                }
            }, '*'),

            // Handle inventory changes
            db.subscribe('inventory', (item) => {
                if (item.hospital_id !== profile.hospital_id) return;
                fetchData(profile.hospital_id);
                fetchDashboardStats(profile.hospital_id);
            }, '*'),

            // Handle clinic changes
            db.subscribe('clinics', (clinic) => {
                if (clinic.hospital_id !== profile.hospital_id) return;
                fetchData(profile.hospital_id);
            }, '*')
        ];

        return () => subs.forEach(unsub => unsub());
    }, [profile]);

    const fetchProfile = async (userId: string) => {
        try {
            const profileData = await db.get('profiles', userId);
            if (profileData) {
                setProfile(profileData);

                if (profileData.hospital_id) {
                    const hospitalData = await db.get('hospitals', profileData.hospital_id);
                    if (hospitalData) {
                        setHospital(hospitalData);
                        applyBranding(hospitalData.branding_color);
                    }
                }

                if (profileData.role === 'CLINIC_ADMIN' && profileData.clinic_id) {
                    const clinicData = await db.get('clinics', profileData.clinic_id);
                    if (clinicData) {
                        setManagedClinic(clinicData);
                    }
                }

                if (profileData.hospital_id) {
                    await fetchData(profileData.hospital_id);
                } else {
                    setLoading(false);
                }
            } else {
                setLoading(false);
            }
        } catch (error) {
            console.error("Error fetching profile:", error);
            setLoading(false);
        }
    };

    const fetchData = async (hospitalId: string) => {
        try {
            const clinicsData = await db.list('clinics', {
                filters: [{ column: 'hospital_id', operator: 'eq', value: hospitalId }],
                sort: { column: 'name', ascending: true }
            });
            setClinics(clinicsData);

            const inventoryData = await db.list('inventory', {
                filters: [
                    { column: 'hospital_id', operator: 'eq', value: hospitalId },
                    { column: 'is_active', operator: 'eq', value: true }
                ]
            });
            setInventory(inventoryData);

            await fetchDashboardStats(hospitalId, clinicsData);
        } catch (err) {
            console.error("Error fetching data:", err);
        } finally {
            setLoading(false);
        }
    };

    const applyBranding = (hexColor?: string) => {
        if (!hexColor) return;
        const r = parseInt(hexColor.slice(1, 3), 16);
        const g = parseInt(hexColor.slice(3, 5), 16);
        const b = parseInt(hexColor.slice(5, 7), 16);
        const rNorm = r / 255, gNorm = g / 255, bNorm = b / 255;
        const max = Math.max(rNorm, gNorm, bNorm), min = Math.min(rNorm, gNorm, bNorm);
        let h = 0, s = 0, l = (max + min) / 2;

        if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case rNorm: h = (gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0); break;
                case gNorm: h = (bNorm - rNorm) / d + 2; break;
                case bNorm: h = (rNorm - gNorm) / d + 4; break;
            }
            h /= 6;
        }

        const hDeg = h * 360, sPct = s * 100, lPct = l * 100;
        document.documentElement.style.setProperty('--primary', `${hDeg.toFixed(1)} ${sPct.toFixed(1)}% ${lPct.toFixed(1)}%`);
        document.documentElement.style.setProperty('--ring', `${hDeg.toFixed(1)} ${sPct.toFixed(1)}% ${lPct.toFixed(1)}%`);
    };

    const refreshData = async () => {
        if (profile?.hospital_id) {
            await fetchData(profile.hospital_id);
        }
    };

    const updateInventoryItem = async (id: string, updates: Partial<InventoryItem>) => {
        await db.update('inventory', id, updates);
        await refreshData();
    };

    const updateHospitalSettings = async (hospitalId: string, newSettings: Record<string, any>) => {
        await db.update('hospitals', hospitalId, { settings: newSettings });
        await refreshData();
    };

    const updateClinicSettings = async (clinicId: string, newSettings: Record<string, any>) => {
        await db.update('clinics', clinicId, { settings: newSettings });
        await refreshData();
    };

    const updateHospitalProfile = async (hospitalId: string, updates: Partial<Hospital>) => {
        await db.update('hospitals', hospitalId, updates);
        await refreshData();
    };

    const updateClinicProfile = async (clinicId: string, updates: Partial<Clinic>) => {
        await db.update('clinics', clinicId, updates);
        await refreshData();
    };

    const updateUserPassword = async (password: string) => {
        await auth.updatePassword(password);
    };

    const hasOrganization = !!hospital || !!managedClinic;

    return (
        <HospitalContext.Provider value={{
            session,
            profile,
            hospital: hospital || null,
            managedClinic,
            hasOrganization,
            clinics,
            inventory,
            loading,
            refreshData,
            updateInventoryItem,
            isPasswordRecovery,
            setIsPasswordRecovery,
            updateHospitalSettings,
            updateClinicSettings,
            updateHospitalProfile,
            updateClinicProfile,
            updateUserPassword,
            billing,
            requiresDowngradeResolution,
            activeClinics,
            pendingRestockId,
            setPendingRestockId,
            pendingPOItem,
            setPendingPOItem,
            notifications,
            unseenCount,
            markNotificationsAsSeen,
            revenueSummary,
            expiringItems,
            fetchDashboardStats
        }}
        >
            {children}
        </HospitalContext.Provider>
    );
}

export const useHospital = () => {
    const context = useContext(HospitalContext);
    if (!context) {
        throw new Error("useHospital must be used within a HospitalProvider");
    }
    return context;
};
