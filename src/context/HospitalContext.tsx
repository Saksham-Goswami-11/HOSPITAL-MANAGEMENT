
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { authService as auth } from '@/lib/authService';
import { dataService as db } from '@/lib/dataService';
import { useSubscription, SubscriptionContextValue } from '@/hooks/useSubscription';
import { showNotification } from '@/lib/notifications';

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
    quantity: number;
    mrp: number;
    threshold: number;
    clinic_id: string;
    hospital_id: string;
    clinics?: { name: string };
    is_active?: boolean;
    [key: string]: any;
};

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

    // Monitoring inventory for low stock notifications
    useEffect(() => {
        if (!loading && inventory.length > 0 && profile) {
            const lowStockItems = inventory.filter(item => {
                const isRelevant = profile.role === 'HOSPITAL_ADMIN' || profile.role === 'ADMIN' || item.clinic_id === profile.clinic_id;
                return isRelevant && item.quantity < (item.threshold || 10);
            });

            // Prevent duplicate notifications in the same session by tracking notified item IDs
            const notifiedIds = new Set(JSON.parse(sessionStorage.getItem('notified_low_stock') || '[]'));
            let updated = false;

            lowStockItems.forEach(item => {
                if (!notifiedIds.has(item.id)) {
                    showNotification('Low Stock Alert', {
                        body: `${item.item_name} is running low (${item.quantity} left).`,
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

    // Real-time sales notifications
    useEffect(() => {
        if (!profile?.hospital_id) return;

        const unsubscribe = db.subscribe('sales', (newSale) => {
            // Check if this sale belongs to current hospital
            if (newSale.hospital_id !== profile.hospital_id) return;

            // If clinic-level user, check clinic ID
            if (profile.role === 'CLINIC_ADMIN' && newSale.clinic_id !== profile.clinic_id) return;

            const isConsultation = newSale.sale_type === 'CONSULTATION';
            const title = isConsultation ? 'New Consultation' : 'New Pharmacy Sale';
            const body = `₹${newSale.amount?.toLocaleString()} • ${newSale.patient_name} • Dr. ${newSale.doctor_name}`;

            showNotification(title, {
                body,
                tag: `sale-${newSale.id}`,
                icon: isConsultation ? '/stethoscope.png' : '/medication.png' // Use fallback if icons not present
            });
        });

        return () => unsubscribe();
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
            setPendingRestockId
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
