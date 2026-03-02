
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useSubscription, SubscriptionContextValue } from '@/hooks/useSubscription';

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
    settings?: Record<string, any>; // NEW
    [key: string]: any;
};

type Clinic = {
    id: string;
    name: string;
    address?: string;
    settings?: Record<string, any>; // NEW
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
    [key: string]: any;
};

interface HospitalContextType {
    session: any;
    profile: Profile | null;
    hospital: Hospital | null;
    managedClinic: Clinic | null; // NEW: Specific clinic for Clinic Admins
    hasOrganization: boolean;     // NEW: True if Hospital OR Managed Clinic exists
    clinics: Clinic[];
    inventory: InventoryItem[];
    loading: boolean;
    refreshData: () => Promise<void>;
    updateInventoryItem: (id: string, updates: Partial<InventoryItem>) => Promise<void>;
    // Auth Helpers
    isPasswordRecovery: boolean;
    setIsPasswordRecovery: (isRecovery: boolean) => void;
    requestPasswordReset: (email: string) => Promise<void>;
    updateUserPassword: (newPassword: string) => Promise<void>;
    // Global Settings
    updateHospitalSettings: (hospitalId: string, settings: Record<string, any>) => Promise<void>;
    updateClinicSettings: (clinicId: string, settings: Record<string, any>) => Promise<void>;
    updateHospitalProfile: (hospitalId: string, updates: Partial<Hospital>) => Promise<void>;
    updateClinicProfile: (clinicId: string, updates: Partial<Clinic>) => Promise<void>;
    // Subscription & Billing
    billing: SubscriptionContextValue;
}

// Create Context
const HospitalContext = createContext<HospitalContextType | undefined>(undefined);

// Provider Component
export function HospitalProvider({ children }: { children: ReactNode }) {
    const [session, setSession] = useState<any>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [hospital, setHospital] = useState<Hospital | null>(null);
    const [managedClinic, setManagedClinic] = useState<Clinic | null>(null); // NEW
    const [clinics, setClinics] = useState<Clinic[]>([]);
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

    // Subscription & Billing
    const billing = useSubscription(profile?.hospital_id);

    // Initial Load
    useEffect(() => {
        // 1. Check active session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);

            // Detect password recovery from URL hash fragment
            // Supabase appends #access_token=...&type=recovery to the redirect URL
            const hashFragment = window.location.hash;
            // The hash may contain both a route (e.g. #/) and Supabase params
            // Look for type=recovery anywhere in the hash
            if (hashFragment.includes('type=recovery')) {
                setIsPasswordRecovery(true);
            }

            if (session) fetchProfile(session.user.id);
            else setLoading(false);
        });

        // 2. Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            setSession(session);

            if (event === 'PASSWORD_RECOVERY') {
                setIsPasswordRecovery(true);
            }

            if (session) {
                fetchProfile(session.user.id);
            } else {
                setProfile(null);
                setHospital(null);
                setManagedClinic(null);
                setClinics([]);
                setInventory([]);
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    // Fetch Profile & Hospital / Clinic
    const fetchProfile = async (userId: string) => {
        // Fetching profile
        const { data, error } = await supabase
            .from('profiles')
            .select('*, hospitals(*)') // Fetch hospital details
            .eq('id', userId)
            .single();

        if (error) {
            console.error("Error fetching profile:", error);
            setLoading(false);
            return;
        }

        if (data) {
            // Profile found
            setProfile(data);

            // Handle Hospital Admin / Staff
            if (data.hospitals) {
                setHospital(data.hospitals);
                applyBranding(data.hospitals.branding_color);
            }

            // Handle Clinic Admin (Managed Clinic)
            if (data.role === 'CLINIC_ADMIN' && data.clinic_id) {
                const { data: clinicData } = await supabase
                    .from('clinics')
                    .select('*')
                    .eq('id', data.clinic_id)
                    .single();
                if (clinicData) {
                    setManagedClinic(clinicData);
                }
            }

            // Fetch Data using the hospital_id
            if (data.hospital_id) {
                await fetchData(data.hospital_id);
            } else {
                setLoading(false);
            }
        } else {
            setLoading(false);
        }
    };

    // Fetch Clinics & Inventory
    const fetchData = async (hospitalId: string) => {
        try {
            // Fetching hospital data

            // Fetch clinics
            const { data: clinicsData, error: clinicsError } = await supabase
                .from('clinics')
                .select('*')
                .eq('hospital_id', hospitalId);

            if (clinicsError) console.error("Error fetching clinics:", clinicsError);
            if (clinicsData) setClinics(clinicsData);

            // Fetch Inventory
            const { data: inventoryData, error: invError } = await supabase
                .from('inventory')
                .select('*, clinics(name)')
                .eq('hospital_id', hospitalId);

            if (invError) console.error("Error fetching inventory:", invError);
            if (inventoryData) {
                const mappedInventory = inventoryData.map((i: any) => ({
                    ...i,
                    clinic_name: i.clinics?.name,
                }));
                setInventory(mappedInventory);
            }

        } catch (err) {
            console.error("Critical error in fetchData:", err);
        } finally {
            setLoading(false);
        }
    };

    // Dynamic Branding Logic
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

    // Refresh function for consumers
    const refreshData = async () => {
        if (profile?.hospital_id) {
            await fetchData(profile.hospital_id);
        }
    };

    // Update Inventory Item Helper
    const updateInventoryItem = async (id: string, updates: Partial<InventoryItem>) => {
        try {
            const { error } = await supabase
                .from('inventory')
                .update(updates)
                .eq('id', id);

            if (error) throw error;

            // Re-fetch data to sync state
            await refreshData();
        } catch (err) {
            console.error("Error updating inventory item:", err);
            throw err;
        }
    };

    // --- SETTINGS HELPERS ---
    const updateHospitalSettings = async (hospitalId: string, newSettings: Record<string, any>) => {
        try {
            const { error } = await supabase
                .from('hospitals')
                .update({ settings: newSettings })
                .eq('id', hospitalId);

            if (error) throw error;
            await refreshData();
        } catch (err) {
            console.error("Error updating hospital settings:", err);
            throw err;
        }
    };

    const updateClinicSettings = async (clinicId: string, newSettings: Record<string, any>) => {
        try {
            const { error } = await supabase
                .from('clinics')
                .update({ settings: newSettings })
                .eq('id', clinicId);

            if (error) throw error;
            await refreshData();
        } catch (err) {
            console.error("Error updating clinic settings:", err);
            throw err;
        }
    };

    const updateHospitalProfile = async (hospitalId: string, updates: Partial<Hospital>) => {
        try {
            const { error } = await supabase
                .from('hospitals')
                .update(updates)
                .eq('id', hospitalId);

            if (error) throw error;
            await refreshData();
        } catch (err) {
            console.error("Error updating hospital profile:", err);
            throw err;
        }
    };

    const updateClinicProfile = async (clinicId: string, updates: Partial<Clinic>) => {
        try {
            const { error } = await supabase
                .from('clinics')
                .update(updates)
                .eq('id', clinicId);

            if (error) throw error;
            await refreshData();
        } catch (err) {
            console.error("Error updating clinic profile:", err);
            throw err;
        }
    };

    // --- PASSWORD RECOVERY HELPERS ---
    const requestPasswordReset = async (email: string) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}${window.location.pathname}`,
        });
        if (error) throw error;
    };

    const updateUserPassword = async (newPassword: string) => {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
        setIsPasswordRecovery(false);
    };

    // Derived State
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
            requestPasswordReset,
            updateUserPassword,
            updateHospitalSettings,
            updateClinicSettings,
            updateHospitalProfile,
            updateClinicProfile,
            billing
        }}
        >
            {children}
        </HospitalContext.Provider>
    );
}

// Hook
export const useHospital = () => {
    const context = useContext(HospitalContext);
    if (!context) {
        throw new Error("useHospital must be used within a HospitalProvider");
    }
    return context;
};
