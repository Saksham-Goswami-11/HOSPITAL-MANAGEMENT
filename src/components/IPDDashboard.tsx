import React, { useState, useEffect, useMemo } from 'react';
import { dataService as db } from '@/lib/dataService';
import { useHospital } from '@/context/HospitalContext';
import { 
    Plus, 
    Hotel, 
    Bed as BedIcon, 
    UserPlus, 
    Search, 
    Calendar, 
    Loader2, 
    BedDouble, 
    Stethoscope, 
    Receipt, 
    Trash2,
    Users,
    Building2,
    Home,
    MapPin,
    Save
} from 'lucide-react';
import { Card, Button, Input, Label, Badge } from '@/components/ui/basic';
import { ReceiptModal } from '@/components/ui/ReceiptModal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Patient {
    id: string;
    full_name: string;
    age: number;
    gender: 'Male' | 'Female' | 'Other';
    contact_number: string;
    blood_group: string;
}

interface Ward {
    id: string;
    name: string;
    ward_type: string;
    base_daily_charge: number;
    clinic_id?: string;
}

interface Bed {
    id: string;
    ward_id: string;
    bed_number: string;
    status: 'available' | 'occupied' | 'maintenance';
}

interface Profile {
    id: string;
    full_name: string;
    role: string;
}

interface Admission {
    id: string;
    patient_id: string | null;
    bed_id: string;
    hospital_id: string;
    clinic_id: string | null;
    admitting_doctor_id: string;
    admission_date: string;
    status: 'admitted' | 'discharged';
    reason_for_admission: string;
    advance_paid: number;
    temp_patient_name?: string;
    temp_patient_phone?: string;
    temp_patient_address?: string;
    patient?: Patient;
    bed?: Bed & { ward?: Ward };
    doctor?: Profile;
    sales?: any[];
    misc_expenses?: any[];
}

const WARD_TYPES = ["General", "ICU", "Semi-Private", "Private", "Emergency", "Maternity"];

export function IPDDashboard() {
    const { hospital, clinics, profile } = useHospital();
    const role = profile?.role;
    const { toast } = useToast();
    const [selectedClinicId, setSelectedClinicId] = useState<string>(
        role === 'CLINIC_ADMIN' ? (profile?.clinic_id || 'all') : 'all'
    );
    const [activeTab, setActiveTab] = useState('admissions');
    const [loading, setLoading] = useState(true);
    
    const [admissions, setAdmissions] = useState<Admission[]>([]);
    const [wards, setWards] = useState<Ward[]>([]);
    const [beds, setBeds] = useState<Bed[]>([]);
    const [patients, setPatients] = useState<Patient[]>([]);
    const [doctors, setDoctors] = useState<Profile[]>([]);

    const [admSearch, setAdmSearch] = useState('');
    const [patSearch, setPatSearch] = useState('');

    const [isAdmissionModalOpen, setIsAdmissionModalOpen] = useState(false);
    const [isWardModalOpen, setIsWardModalOpen] = useState(false);
    const [isBedModalOpen, setIsBedModalOpen] = useState(false);
    const [isPatientModalOpen, setIsPatientModalOpen] = useState(false);
    const [isDischargeModalOpen, setIsDischargeModalOpen] = useState(false);
    const [isMiscModalOpen, setIsMiscModalOpen] = useState(false);
    
    const [selectedAdmission, setSelectedAdmission] = useState<any>(null);
    const [extraCharges, setExtraCharges] = useState<{name: string, amount: number}[]>([]);
    const [paymentMode, setPaymentMode] = useState<'Cash' | 'UPI' | 'Card'>('Cash');
    const [showReceipt, setShowReceipt] = useState(false);
    const [lastSaleId, setLastSaleId] = useState<string | null>(null);
    
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedWardId, setSelectedWardId] = useState<string>('');
    const [isNewPatient, setIsNewPatient] = useState(false);
    
    // Detailed Bill State
    const [isBillModalOpen, setIsBillModalOpen] = useState(false);
    const [billAdmission, setBillAdmission] = useState<Admission | null>(null);
    const [billItems, setBillItems] = useState<any[]>([]);
    const [isFetchingBill, _setIsFetchingBill] = useState(false);
    // Misc Expense Form State
    const [miscExpenseName, setMiscExpenseName] = useState('');
    const [miscExpenseAmount, setMiscExpenseAmount] = useState('');

    const [isRangeMode, setIsRangeMode] = useState(false);
    const [bedPrefix, setBedPrefix] = useState('');
    const [rangeStart, setRangeStart] = useState('1');
    const [rangeEnd, setRangeEnd] = useState('10');

    const fetchInitialData = async () => {
        if (!hospital?.id) return;
        setLoading(true);
        try {
            const hId = hospital.id;
            const wardFilters: any[] = [{ field: 'hospital_id', operator: '==', value: hId }];
            const admissionFilters: any[] = [{ field: 'hospital_id', operator: '==', value: hId }];

            if (selectedClinicId !== 'all') {
                wardFilters.push({ field: 'clinic_id', operator: '==', value: selectedClinicId });
                admissionFilters.push({ field: 'clinic_id', operator: '==', value: selectedClinicId });
            }
            
            const [_, patientsData, admissionsData, bedsData, wardsData, salesData, staffData] = await Promise.all([
                db.list('profiles', { filters: [{ field: 'hospital_id', operator: '==', value: hId }] }),
                db.list('patients', { filters: [{ field: 'hospital_id', operator: '==', value: hId }] }),
                db.list('ipd_admissions', { 
                    filters: admissionFilters,
                    sort: { column: 'admission_date', ascending: false }
                }),
                db.list('beds'),
                db.list('wards', { filters: wardFilters }),
                db.list('sales', { filters: [{ field: 'hospital_id', operator: '==', value: hId }] }),
                db.list('staff_details', { filters: [{ field: 'hospital_id', operator: '==', value: hId }] }),
            ]);
            const miscExpData = await db.list('ipd_misc_expenses', {
                filters: hospital?.id ? { hospital_id: hospital.id } : {}
            });

            // Fetch sale items if we have an active bill modal session
            if (isBillModalOpen && billAdmission) {
                const admissionSales = salesData.filter((s: any) => s.admission_id === billAdmission.id);
                if (admissionSales.length > 0) {
                    const saleIds = admissionSales.map((s: any) => s.id);
                    const [allItems, inventoryData] = await Promise.all([
                        db.list('sale_items', { filters: [{ field: 'sale_id', operator: 'in', value: saleIds }] }),
                        db.list('inventory', { filters: [{ field: 'hospital_id', operator: '==', value: hId }] })
                    ]);

                    const itemized = allItems.map((it: any) => {
                        const price = Number(it.unit_price || it.price || 0);
                        return {
                            ...it,
                            price,
                            item_name: inventoryData.find((inv: any) => inv.id === it.inventory_id)?.item_name || 'Medical Item'
                        };
                    });
                    setBillItems(itemized);
                } else {
                    setBillItems([]);
                }
            }

            const processedAdmissions = admissionsData.map((adm: any) => {
                const patient = patientsData.find((p: any) => p.id === adm.patient_id);
                const doctor = staffData.find((s: any) => s.id === adm.admitting_doctor_id);
                const bed = bedsData.find((b: any) => b.id === adm.bed_id);
                const ward = wardsData.find((w: any) => w.id === bed?.ward_id);
                const linkedSales = salesData.filter((s: any) => s.admission_id === adm.id);
                const linkedMisc = miscExpData.filter((e: any) => e.admission_id === adm.id);

                return {
                    ...adm,
                    patient: patient || (adm.temp_patient_name ? { full_name: adm.temp_patient_name, id: 'temp' } : null),
                    doctor,
                    bed: bed ? { ...bed, ward } : null,
                    sales: linkedSales,
                    misc_expenses: linkedMisc
                };
            });

            setAdmissions(processedAdmissions);
            setWards(wardsData || []);
            setBeds(bedsData || []);
            setPatients(patientsData || []);
            setDoctors(staffData.filter((s: any) => s.role === 'DOCTOR' || s.role === 'doctor'));

            // Sync currently open billing session data
            if (selectedAdmission) {
                const refreshed = processedAdmissions.find(a => a.id === selectedAdmission.id);
                console.log('Syncing Selected Admission:', refreshed);
                if (refreshed) setSelectedAdmission(refreshed);
            }
            if (billAdmission) {
                const refreshed = processedAdmissions.find(a => a.id === billAdmission.id);
                if (refreshed) setBillAdmission(refreshed);
            }

        } catch (error: any) {
            console.error('IPD Load Error:', error);
            toast({ title: 'Error', description: 'Failed to load IPD data', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInitialData();
    }, [hospital?.id, selectedClinicId, isBillModalOpen]);

    const handleAddAdmission = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!hospital?.id) return;
        setIsSubmitting(true);

        const formData = new FormData(e.currentTarget);
        const bed_id = formData.get('bed_id') as string;
        const selectedBed = beds.find(b => b.id === bed_id);
        const advance = Number(formData.get('advance') || 0);
        const patient_id = formData.get('patient_id') as string;
        const temp_name = formData.get('temp_name') as string;
        const temp_phone = formData.get('temp_phone') as string;
        const temp_address = formData.get('temp_address') as string;
        const doctor_id = formData.get('doctor_id') as string;
        const clinic_id = selectedBed ? (wards.find(w => w.id === selectedBed.ward_id)?.clinic_id || (selectedClinicId !== 'all' ? selectedClinicId : clinics[0]?.id)) : (selectedClinicId !== 'all' ? selectedClinicId : clinics[0]?.id);

        try {
            const admission = await db.create('ipd_admissions', {
                hospital_id: hospital.id,
                clinic_id: clinic_id,
                patient_id: patient_id === 'new' ? null : patient_id,
                temp_patient_name: patient_id === 'new' ? temp_name : null,
                temp_patient_phone: patient_id === 'new' ? temp_phone : null,
                temp_patient_address: patient_id === 'new' ? temp_address : null,
                bed_id: bed_id,
                admitting_doctor_id: doctor_id,
                admission_date: new Date().toISOString(),
                status: 'admitted',
                reason_for_admission: formData.get('reason') || '',
                advance_paid: advance
            });

            // If advance is paid, record it as a SALE to reflect in revenue dashboard
            if (advance > 0) {
                const doctor = doctors.find(d => d.id === doctor_id);
                const patient = patients.find(p => p.id === patient_id);
                
                await db.callRpc('process_sale', {
                    p_hospital_id: hospital.id,
                    p_clinic_id: clinic_id || hospital.id,
                    p_patient_name: patient?.full_name || temp_name || 'IPD Patient',
                    p_patient_phone: patient?.contact_number || temp_phone || null,
                    p_patient_address: patient?.blood_group || temp_address || null, // Note: blood_group is usually not address, but here we pass address
                    p_doctor_name: doctor?.full_name || 'Staff Doctor',
                    p_amount: advance,
                    p_subtotal: advance,
                    p_discount_percentage: 0,
                    p_payment_mode: 'Cash', // Default for advance, can be improved
                    p_sale_type: 'IPD_ADMISSION_ADVANCE',
                    p_items: [],
                    p_admission_id: admission.id
                });
                // No token for IPD advance
            }

            await db.update('beds', bed_id, { status: 'occupied' });
            toast({ title: 'Success', description: 'Admission confirmed. Bed has been reserved.' });
            setIsAdmissionModalOpen(false);
            fetchInitialData();
        } catch (error: any) {
            toast({ title: 'Error', description: error.message || 'Failed to admit patient', variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAddWard = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!hospital?.id) return;
        setIsSubmitting(true);

        const formData = new FormData(e.currentTarget);
        const wardClinicId = formData.get('clinic_id') as string;

        const payload = {
            hospital_id: hospital.id,
            clinic_id: (wardClinicId && wardClinicId !== 'none') ? wardClinicId : (selectedClinicId !== 'all' ? selectedClinicId : clinics[0]?.id),
            name: formData.get('name') as string,
            ward_type: formData.get('ward_type') as string,
            base_daily_charge: parseFloat(formData.get('daily_charge') as string)
        };

        try {
            await db.create('wards', payload);
            toast({ title: 'Success', description: 'Ward created successfully' });
            setIsWardModalOpen(false);
            fetchInitialData();
        } catch (error: any) {
            toast({ title: 'Error', description: 'Failed to create ward', variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAddBed = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!hospital?.id) return;
        setIsSubmitting(true);

        const formData = new FormData(e.currentTarget);
        const ward_id = formData.get('ward_id') as string;

        try {
            if (isRangeMode) {
                const start = parseInt(rangeStart);
                const end = parseInt(rangeEnd);
                
                if (isNaN(start) || isNaN(end) || start > end) {
                    throw new Error('Invalid range. End must be greater than or equal to Start.');
                }
                if (end - start > 100) {
                    throw new Error('Too many beds to create. Max range is 100.');
                }

                const bedsToCreate = [];
                for (let i = start; i <= end; i++) {
                    bedsToCreate.push({
                        ward_id: ward_id,
                        bed_number: `${bedPrefix}${i}`,
                        status: 'available'
                    });
                }
                await db.createMany('beds', bedsToCreate);
                toast({ title: 'Success', description: `${bedsToCreate.length} beds added to ward.` });
            } else {
                const payload = {
                    ward_id: ward_id,
                    bed_number: formData.get('bed_number') as string,
                    status: 'available'
                };
                await db.create('beds', payload);
                toast({ title: 'Success', description: 'Bed added to ward.' });
            }
            setIsBedModalOpen(false);
            fetchInitialData();
            setBedPrefix('');
            setRangeStart('1');
            setRangeEnd('10');
            setIsRangeMode(false);
        } catch (error: any) {
            toast({ title: 'Error', description: error.message || 'Failed to add bed(s)', variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAddMiscExpense = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedAdmission || !miscExpenseName || !miscExpenseAmount) return;
        setIsSubmitting(true);
        try {
            await db.create('ipd_misc_expenses', {
                admission_id: selectedAdmission.id,
                hospital_id: hospital?.id,
                description: miscExpenseName,
                amount: parseFloat(miscExpenseAmount),
                created_at: new Date().toISOString()
            });
            toast({ title: 'Success', description: 'Misc expense added to bill.' });
            setIsMiscModalOpen(false);
            setMiscExpenseName('');
            setMiscExpenseAmount('');
            fetchInitialData();
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to add expense', variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRegisterPatient = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!hospital?.id) return;
        setIsSubmitting(true);

        const formData = new FormData(e.currentTarget);
        const payload = {
            hospital_id: hospital.id,
            full_name: formData.get('full_name') as string,
            age: parseInt(formData.get('age') as string),
            gender: formData.get('gender') as string,
            contact_number: formData.get('phone') as string,
            blood_group: formData.get('blood_group') as string || 'N/A'
        };

        try {
            await db.create('patients', payload);
            toast({ title: 'Success', description: 'Patient registered' });
            setIsPatientModalOpen(false);
            fetchInitialData();
        } catch (error: any) {
            toast({ title: 'Error', description: 'Failed to register patient', variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSaveInterimCharge = async () => {
        const nameEl = document.getElementById('newChargeName') as HTMLInputElement;
        const amountEl = document.getElementById('newChargeAmount') as HTMLInputElement;
        
        if (!nameEl?.value || !amountEl?.value || !selectedAdmission || !hospital?.id) {
            toast({ title: 'Missing Info', description: 'Please enter charge name and amount.', variant: 'destructive' });
            return;
        }

        setIsSubmitting(true);
        try {
            await db.create('ipd_misc_expenses', {
                admission_id: selectedAdmission.id,
                hospital_id: hospital.id,
                description: nameEl.value,
                amount: Number(amountEl.value),
                created_at: new Date().toISOString()
            });

            nameEl.value = '';
            amountEl.value = '';
            toast({ title: 'Saved', description: 'Charge added to patient bill.' });
            await fetchInitialData(); // This now re-syncs selectedAdmission
        } catch (error: any) {
            console.error('Save Charge Error:', error);
            toast({ title: 'Error', description: 'Failed to persist charge', variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleFinalDischarge = async () => {
        if (!selectedAdmission || !hospital?.id) return;
        setIsSubmitting(true);
        try {
            const now = new Date();
            const start = new Date(selectedAdmission.admission_date);
            const days = Math.max(1, Math.ceil(Math.abs(now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
            const bedChargeAmount = days * (selectedAdmission.bed?.ward?.base_daily_charge || 0);

            // Aggregate linked costs
            const pharmaTotal = selectedAdmission.sales?.filter((s: any) => s.sale_type === 'PHARMACY' && s.payment_mode === 'IPD_BILL').reduce((sum: number, s: any) => sum + (Number(s.amount || s.final_amount) || 0), 0) || 0;
            const consulTotal = selectedAdmission.sales?.filter((s: any) => s.sale_type === 'CONSULTATION' && s.payment_mode === 'IPD_BILL').reduce((sum: number, s: any) => sum + (Number(s.amount || s.final_amount) || 0), 0) || 0;
            const miscTotal = selectedAdmission.misc_expenses?.reduce((sum: number, m: any) => sum + Number(m.amount), 0) || 0;
            const extraStateTotal = extraCharges.reduce((sum, c) => sum + Number(c.amount), 0);
            
            const subtotal = bedChargeAmount + pharmaTotal + consulTotal + miscTotal + extraStateTotal;
            const advance = selectedAdmission.advance_paid || 0;
            const finalAmount = Math.max(0, subtotal - advance);

            // Get or create Service Item for Billing
            const inventoryItems = await db.list('inventory', {
                filters: [
                    { field: 'hospital_id', operator: '==', value: hospital.id },
                    { field: 'item_name', operator: '==', value: 'IPD SETTLEMENT' }
                ],
                limit: 1
            });
            let serviceItem = inventoryItems[0];

            if (!serviceItem) {
                serviceItem = await db.create('inventory', {
                    hospital_id: hospital.id,
                    clinic_id: selectedAdmission.clinic_id || clinics[0]?.id,
                    item_name: 'IPD SETTLEMENT',
                    batch_number: 'IPD-SETTLE',
                    category: 'SERVICE',
                    quantity: 999999,
                    mrp: 0,
                    expiry_date: '2099-12-31'
                });
            }

            // Create the Master Sale record for Discharge
            const result = await db.callRpc('process_sale', {
                p_hospital_id: hospital.id,
                p_clinic_id: selectedAdmission.clinic_id || (selectedClinicId !== 'all' ? selectedClinicId : clinics[0]?.id) || hospital.id, 
                p_patient_name: selectedAdmission.patient?.full_name || selectedAdmission.temp_patient_name || 'Walking Patient',
                p_doctor_name: selectedAdmission.doctor?.full_name || 'Staff Doctor',
                p_amount: finalAmount,
                p_subtotal: subtotal,
                p_discount_percentage: 0,
                p_payment_mode: paymentMode,
                p_sale_type: 'IPD',
                p_items: [],
                p_admission_id: selectedAdmission.id,
                p_patient_id: selectedAdmission.patient_id
            });

            const { sale_id: saleId } = result;

            // Create breakdown items for the receipt
            const itemsToInsert = [
                {
                    sale_id: saleId,
                    inventory_id: serviceItem.id,
                    quantity: days,
                    unit_price: selectedAdmission.bed?.ward?.base_daily_charge,
                    is_loose_sale: false
                }
            ];

            if (pharmaTotal > 0) itemsToInsert.push({ sale_id: saleId, inventory_id: serviceItem.id, quantity: 1, unit_price: pharmaTotal, is_loose_sale: false });
            if (consulTotal > 0) itemsToInsert.push({ sale_id: saleId, inventory_id: serviceItem.id, quantity: 1, unit_price: consulTotal, is_loose_sale: false });
            if (miscTotal > 0) itemsToInsert.push({ sale_id: saleId, inventory_id: serviceItem.id, quantity: 1, unit_price: miscTotal, is_loose_sale: false });
            if (extraStateTotal > 0) {
                 extraCharges.forEach(c => {
                    itemsToInsert.push({ sale_id: saleId, inventory_id: serviceItem.id, quantity: 1, unit_price: c.amount, is_loose_sale: false });
                 });
            }

            await db.createMany('sale_items', itemsToInsert);

            // Update Admission status
            await db.update('ipd_admissions', selectedAdmission.id, { 
                status: 'discharged', 
                discharge_date: now.toISOString() 
            });

            // Free the Bed
            await db.update('beds', selectedAdmission.bed_id, { 
                status: 'available' 
            });

            setLastSaleId(saleId);
            setIsDischargeModalOpen(false);
            setShowReceipt(true);
            fetchInitialData();
            toast({ title: 'Discharged', description: 'Settlement complete and bill generated.' });
        } catch (error: any) {
            console.error('Discharge Error:', error);
            toast({ title: 'Error', description: error.message || 'Failed to complete discharge billing', variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredAdmissions = useMemo(() => {
        return admissions.filter(a => 
            (a.patient?.full_name?.toLowerCase() || '').includes(admSearch.toLowerCase()) ||
            a.bed?.ward?.name.toLowerCase().includes(admSearch.toLowerCase())
        );
    }, [admissions, admSearch]);

    const filteredPatients = useMemo(() => {
        // Only show patients who have at least one IPD admission
        const ipdPatientIds = new Set(admissions.map(a => a.patient_id).filter(Boolean));
        const ipdPatients = patients.filter(p => ipdPatientIds.has(p.id));
        
        const registered = ipdPatients.filter(p => 
            (p.full_name?.toLowerCase() || '').includes(patSearch.toLowerCase()) ||
            (p.contact_number?.includes(patSearch))
        );

        // Include temp patients from active admissions
        const tempPatients = admissions
            .filter(a => a.temp_patient_name && !a.patient_id)
            .map(a => ({
                id: `temp-${a.id}`,
                full_name: a.temp_patient_name as string,
                age: 0,
                gender: 'Other' as any,
                contact_number: a.temp_patient_phone || 'N/A',
                blood_group: 'N/A',
                is_temp: true
            }))
            .filter(tp => tp.full_name.toLowerCase().includes(patSearch.toLowerCase()) || tp.contact_number.includes(patSearch));

        // Deduplicate and merge
        const seenNames = new Set(registered.map(p => p.full_name.toLowerCase()));
        const uniqueTemp = tempPatients.filter(tp => !seenNames.has(tp.full_name.toLowerCase()));

        return [...registered, ...uniqueTemp];
    }, [patients, admissions, patSearch]);

    const stats = useMemo(() => {
        const active = admissions.filter(a => a.status === 'admitted').length;
        
        // Filter beds to only include those in wards belonging to the selected clinic
        const wardIds = new Set(wards.map(w => w.id));
        const filteredBeds = selectedClinicId === 'all' 
            ? beds 
            : beds.filter(b => wardIds.has(b.ward_id));
            
        const totalBeds = filteredBeds.length;
        const occupiedBeds = filteredBeds.filter(b => b.status === 'occupied').length;
        return { active, totalBeds, occupiedBeds };
    }, [admissions, beds, wards, selectedClinicId]);

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-slate-200/60 pb-6">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-xl shadow-indigo-100">
                        <Building2 className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">IPD Management</h1>
                        <p className="text-slate-500 font-medium">Manage indoor patient admissions, wards, and bed tracking</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-2xl px-3 py-1.5 shadow-sm">
                        <Home className="w-4 h-4 text-slate-400" />
                        <Select disabled={role === 'CLINIC_ADMIN'} value={selectedClinicId} onValueChange={setSelectedClinicId}>
                            <SelectTrigger className="w-[180px] border-none shadow-none focus:ring-0 h-8 p-0 text-sm font-semibold">
                                <SelectValue placeholder="All Branches" />
                            </SelectTrigger>
                            <SelectContent className="bg-white border-slate-200">
                                <SelectItem value="all">🏢 All Branches</SelectItem>
                                {clinics.map(clinic => (
                                    <SelectItem key={clinic.id} value={clinic.id}>
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${clinic.status === 'paused' ? 'bg-red-500' : 'bg-emerald-500'}`} />
                                            {clinic.name}
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <Button 
                        onClick={() => setIsAdmissionModalOpen(true)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-200 gap-2 h-11 px-6 rounded-2xl font-bold transition-all active:scale-95"
                    >
                        <Plus className="w-4 h-4" /> New Admission
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="p-6 border-l-4 border-l-blue-500 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
                            <Users size={24} />
                        </div>
                        <div>
                            <div className="text-sm font-medium text-slate-500">Active Admissions</div>
                            <div className="text-3xl font-bold text-slate-900">{stats.active}</div>
                        </div>
                    </div>
                </Card>
                <Card className="p-6 border-l-4 border-l-emerald-500 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
                            <BedIcon size={24} />
                        </div>
                        <div>
                            <div className="text-sm font-medium text-slate-500">Available Beds</div>
                            <div className="text-3xl font-bold text-slate-900">{stats.totalBeds - stats.occupiedBeds} / {stats.totalBeds}</div>
                        </div>
                    </div>
                </Card>
                <Card className="p-6 border-l-4 border-l-amber-500 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
                            <Hotel size={24} />
                        </div>
                        <div>
                            <div className="text-sm font-medium text-slate-500">Total Wards</div>
                            <div className="text-3xl font-bold text-slate-900">{wards.length}</div>
                        </div>
                    </div>
                </Card>
            </div>

            <Tabs defaultValue="admissions" value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="bg-slate-100/50 p-1 rounded-xl border border-slate-200/60">
                    <TabsTrigger value="admissions" className="rounded-lg px-6 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-primary font-bold">
                        <Calendar className="w-4 h-4 mr-2" /> Admissions
                    </TabsTrigger>
                    <TabsTrigger value="wards" className="rounded-lg px-6 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-primary font-bold">
                        <Hotel className="w-4 h-4 mr-2" /> Wards & Beds
                    </TabsTrigger>
                    <TabsTrigger value="patients" className="rounded-lg px-6 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-primary font-bold">
                        <UserPlus className="w-4 h-4 mr-2" /> Patient Directory
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="admissions" className="space-y-4">
                    <div className="relative">
                        <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                        <Input
                            placeholder="Search by patient name or ward..."
                            value={admSearch}
                            onChange={(e) => setAdmSearch(e.target.value)}
                            className="pl-12 py-6 text-lg rounded-xl"
                        />
                    </div>

                    <Card className="overflow-hidden border-slate-200">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 border-b border-slate-100">
                                    <tr>
                                        <th className="px-6 py-4 font-semibold text-slate-600 uppercase tracking-wider text-[11px]">Patient</th>
                                        <th className="px-6 py-4 font-semibold text-slate-600 uppercase tracking-wider text-[11px]">Ward & Bed</th>
                                        <th className="px-6 py-4 font-semibold text-slate-600 uppercase tracking-wider text-[11px]">Doctor</th>
                                        <th className="px-6 py-4 font-semibold text-slate-600 uppercase tracking-wider text-[11px]">Status</th>
                                        <th className="px-6 py-4 font-semibold text-slate-600 uppercase tracking-wider text-[11px]">Current Bill</th>
                                        <th className="px-6 py-4 font-semibold text-slate-600 text-right uppercase tracking-wider text-[11px]">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-24 text-center">
                                                <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                                            </td>
                                        </tr>
                                    ) : filteredAdmissions.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-24 text-center">
                                                <div className="flex flex-col items-center gap-2 opacity-30">
                                                    <Calendar size={48} />
                                                    <p className="font-bold">No Records Found</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredAdmissions.map((adm) => {
                                            const now = new Date();
                                            const start = new Date(adm.admission_date);
                                            const days = Math.max(1, Math.ceil(Math.abs(now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
                                            const bedCharge = days * (adm.bed?.ward?.base_daily_charge || 0);
                                            const pharmaTotal = adm.sales?.filter((s: any) => s.sale_type === 'PHARMACY').reduce((sum: number, s: any) => sum + (Number(s.amount || s.final_amount) || 0), 0) || 0;
                                            const consulTotal = adm.sales?.filter((s: any) => s.sale_type === 'CONSULTATION').reduce((sum: number, s: any) => sum + (Number(s.amount || s.final_amount) || 0), 0) || 0;
                                            const miscTotal = adm.misc_expenses?.reduce((sum: number, e: any) => sum + Number(e.amount), 0) || 0;
                                            
                                            // Calculate what was already paid at the POS (Cash/UPI) - Exclude the final IPD settlement itself
                                            const paidAtPOS = adm.sales?.filter((s: any) => s.payment_mode !== 'IPD_BILL' && s.sale_type !== 'IPD' && s.sale_type !== 'IPD_ADMISSION_ADVANCE').reduce((sum: number, s: any) => sum + (Number(s.amount || s.final_amount) || 0), 0) || 0;
                                            
                                            const runningTotal = bedCharge + pharmaTotal + consulTotal + miscTotal;
                                            const balance = runningTotal - (adm.advance_paid || 0) - paidAtPOS;

                                            return (
                                                <tr key={adm.id} className="hover:bg-slate-50/50 transition-colors group">
                                                    <td className="px-6 py-4">
                                                        <div className="font-bold text-slate-900 text-base">
                                                            {adm.patient?.full_name || adm.temp_patient_name || 'Unknown Patient'}
                                                        </div>
                                                        {adm.patient?.id && adm.patient.id !== 'temp' ? (
                                                            <div className="flex flex-col">
                                                                <div className="text-xs text-slate-400 font-bold">UID: {(adm.patient?.id || '').substring(0,8).toUpperCase()}</div>
                                                                <div className="text-xs text-emerald-600 font-mono font-bold mt-0.5">{adm.patient?.contact_number}</div>
                                                            </div>
                                                        ) : (
                                                            <div className="flex flex-col mt-0.5">
                                                                <div className="text-[10px] text-amber-600 font-bold uppercase tracking-widest flex items-center gap-1">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                                                    Temporary Record
                                                                </div>
                                                                <div className="text-xs text-emerald-600 font-mono font-bold mt-0.5 tracking-tighter">
                                                                    {adm.temp_patient_phone || 'No Phone Number'}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col gap-1">
                                                            <div className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded w-fit">{adm.bed?.ward?.name}</div>
                                                            <span className="font-bold text-slate-700">Bed: {adm.bed?.bed_number}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 text-xs font-bold">
                                                                {adm.doctor?.full_name?.charAt(0)}
                                                            </div>
                                                            <span className="font-medium text-slate-700">Dr. {adm.doctor?.full_name || 'N/A'}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <Badge className={adm.status === 'admitted' ? 'bg-emerald-50 text-emerald-700 border-emerald-100 px-3 py-1' : 'bg-slate-100 text-slate-600 px-3 py-1'}>
                                                            <span className="w-1.5 h-1.5 rounded-full bg-current mr-2 animate-pulse" />
                                                            {adm.status.toUpperCase()}
                                                        </Badge>
                                                        <div className="text-[10px] text-slate-400 font-mono mt-1">
                                                            Since: {new Date(adm.admission_date).toLocaleDateString()}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-black text-slate-900">₹{balance.toLocaleString()}</span>
                                                            <div className="flex flex-wrap gap-1 mt-1">
                                                                <div title={`Bed: ${days} days @ ₹${adm.bed?.ward?.base_daily_charge}`} className="text-[9px] px-1 bg-blue-50 text-blue-600 font-bold rounded cursor-help">B</div>
                                                                {pharmaTotal > 0 && <div title={`Pharmacy: ₹${pharmaTotal}`} className="text-[9px] px-1 bg-emerald-50 text-emerald-600 font-bold rounded cursor-help">P</div>}
                                                                {consulTotal > 0 && <div title={`Consultation: ₹${consulTotal}`} className="text-[9px] px-1 bg-amber-50 text-amber-600 font-bold rounded cursor-help">C</div>}
                                                                {miscTotal > 0 && <div title={`Misc: ₹${miscTotal}`} className="text-[9px] px-1 bg-purple-50 text-purple-600 font-bold rounded cursor-help">M</div>}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex items-center justify-end gap-2 pr-2">
                                                            <Button 
                                                                variant="ghost" 
                                                                size="sm"
                                                                onClick={() => {
                                                                    setSelectedAdmission(adm);
                                                                    setIsMiscModalOpen(true);
                                                                }}
                                                                className="h-9 w-9 p-0 rounded-xl hover:bg-amber-50 hover:text-amber-600 text-slate-400 transition-all font-bold"
                                                                title="Add Charges"
                                                            >
                                                                <Plus className="w-4 h-4" />
                                                            </Button>
                                                            <Button 
                                                                variant="ghost" 
                                                                size="sm"
                                                                onClick={() => {
                                                                    setSelectedAdmission(adm);
                                                                    setIsDischargeModalOpen(true);
                                                                }}
                                                                className="h-9 w-9 p-0 rounded-xl hover:bg-emerald-50 hover:text-emerald-600 text-slate-400 transition-all font-bold"
                                                                title="Discharge & Bill"
                                                            >
                                                                <Receipt className="w-4 h-4" />
                                                            </Button>
                                                            <Button 
                                                                variant="ghost" 
                                                                size="sm"
                                                                className="h-9 w-9 p-0 rounded-xl hover:bg-rose-50 hover:text-rose-600 text-slate-400 transition-all"
                                                                title="Archive"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </TabsContent>

                <TabsContent value="wards">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-slate-900">Hospital Wards</h2>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => setIsBedModalOpen(true)}>
                                <Plus size={16} className="mr-1" /> Add Bed
                            </Button>
                            <Button variant="default" size="sm" onClick={() => setIsWardModalOpen(true)} className="bg-primary hover:bg-primary/90">
                                <Plus size={16} className="mr-1" /> New Ward
                            </Button>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {wards.length === 0 ? (
                            <Card className="col-span-full p-12 flex flex-col items-center justify-center text-center space-y-4 border-dashed border-2 bg-slate-50/50">
                                <div className="p-4 bg-white rounded-2xl shadow-sm ring-1 ring-slate-100">
                                    <Hotel className="w-12 h-12 text-slate-300" />
                                </div>
                                <div className="max-w-xs space-y-2">
                                    <h3 className="text-xl font-bold text-slate-900">No Wards Created</h3>
                                    <p className="text-sm text-slate-500 font-medium">
                                        Your hospital needs at least one ward to manage bed assignments and admissions.
                                    </p>
                                </div>
                                <Button 
                                    onClick={() => setIsWardModalOpen(true)}
                                    className="bg-primary hover:bg-primary/90 text-white font-bold px-8"
                                >
                                    <Plus className="w-4 h-4 mr-2" />
                                    Configure Your First Ward
                                </Button>
                            </Card>
                        ) : (
                            wards.map(ward => (
                                <Card key={ward.id} className="p-6 space-y-4 hover:shadow-md transition-shadow border-slate-200">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="flex items-center gap-3">
                                                <h3 className="text-2xl font-black text-slate-900 group-hover/card:text-indigo-600 transition-colors uppercase tracking-tight">{ward.name}</h3>
                                                {ward.clinic_id && (
                                                    <div className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-[10px] font-bold text-slate-500 flex items-center gap-1">
                                                        <MapPin className="w-3 h-3" />
                                                        {clinics.find(c => c.id === ward.clinic_id)?.name}
                                                    </div>
                                                )}
                                            </div>
                                            <Badge variant="outline" className="mt-1 uppercase tracking-tighter text-[10px] bg-slate-50">{ward.ward_type}</Badge>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xl font-black text-primary">₹{ward.base_daily_charge}</div>
                                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Per Day</div>
                                        </div>
                                    </div>
                                    <div className="pt-4 border-t border-slate-100">
                                        <div className="flex items-center justify-between mb-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                            <span>Bed Grid</span>
                                            <span>{beds.filter(b => b.ward_id === ward.id).length} Total</span>
                                        </div>
                                        <div className="grid grid-cols-4 gap-2">
                                            {beds.filter(b => b.ward_id === ward.id).map(bed => (
                                                <div key={bed.id} className={`p-2 border rounded-lg flex flex-col items-center justify-center gap-1 ${bed.status === 'available' ? 'bg-green-50/50 border-green-100' : 'bg-gray-50 border-gray-100'}`}>
                                                    <BedDouble className={`h-5 w-5 ${bed.status === 'available' ? 'text-green-600' : 'text-gray-400'}`} />
                                                    <span className="text-[10px] font-bold">{bed.bed_number}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </Card>
                            ))
                        )}
                    </div>
                </TabsContent>

                <TabsContent value="patients" className="space-y-4">
                     <div className="flex justify-between items-center mb-4">
                        <div className="relative flex-1 max-w-md">
                            <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                            <Input
                                placeholder="Search patients by name or phone..."
                                value={patSearch}
                                onChange={(e) => setPatSearch(e.target.value)}
                                className="pl-12 rounded-xl"
                            />
                        </div>
                        <Button onClick={() => setIsPatientModalOpen(true)} className="bg-blue-600 hover:bg-blue-700">
                            <Plus size={16} className="mr-2" /> Register Patient
                        </Button>
                    </div>

                    <Card className="overflow-hidden border-slate-200">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 border-b border-slate-100">
                                <tr>
                                    <th className="px-6 py-4 font-semibold text-slate-600">Full Name</th>
                                    <th className="px-6 py-4 font-semibold text-slate-600">Demographics</th>
                                    <th className="px-6 py-4 font-semibold text-slate-600">Contact</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredPatients.map(p => (
                                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4 font-bold text-slate-900">{p.full_name}</td>
                                        <td className="px-6 py-4 text-slate-500 font-medium">
                                            {p.age} yrs • {p.gender}
                                        </td>
                                        <td className="px-6 py-4 font-mono text-slate-700 font-semibold">{p.contact_number}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </Card>
                </TabsContent>
            </Tabs>

            <Dialog open={isAdmissionModalOpen} onOpenChange={setIsAdmissionModalOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black">Indoor Admission Flow</DialogTitle>
                        <DialogDescription>
                            Register a new patient or select an existing one to begin the admission process.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAddAdmission} className="space-y-4 mt-4">
                        <div className="space-y-2">
                            <Label>Select Patient</Label>
                            <select 
                                name="patient_id" 
                                required 
                                className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white shadow-sm outline-none font-medium"
                                onChange={(e) => setIsNewPatient(e.target.value === 'new')}
                            >
                                <option value="">-- Choose Patient --</option>
                                <option value="new" className="font-bold text-emerald-600">+ Register New Patient</option>
                                {patients.map(p => (
                                    <option key={p.id} value={p.id}>{p.full_name} ({p.contact_number})</option>
                                ))}
                            </select>
                        </div>

                        {isNewPatient && (
                            <div className="space-y-4 p-4 bg-emerald-50/50 rounded-xl border border-emerald-100 animate-in slide-in-from-top-2 duration-300">
                                <div className="space-y-2">
                                    <Label className="text-emerald-800">Full Name</Label>
                                    <Input name="temp_name" placeholder="Patient Full Name" required={isNewPatient} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-emerald-800">Phone Number</Label>
                                        <Input name="temp_phone" placeholder="Contact Number" required={isNewPatient} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-emerald-800">Address</Label>
                                        <Input name="temp_address" placeholder="City/Area" />
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Ward</Label>
                                <select 
                                    className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white shadow-sm outline-none font-medium"
                                    value={selectedWardId}
                                    onChange={(e) => setSelectedWardId(e.target.value)}
                                    required
                                >
                                    <option value="">-- Select Ward --</option>
                                    {wards.map(w => (
                                        <option key={w.id} value={w.id}>{w.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label>Bed Number</Label>
                                <select name="bed_id" required className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white shadow-sm outline-none font-medium">
                                    <option value="">-- Choose Bed --</option>
                                    {beds.filter(b => b.ward_id === selectedWardId && b.status === 'available').map(b => (
                                        <option key={b.id} value={b.id}>Bed {b.bed_number}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Admitting Doctor</Label>
                            <select name="doctor_id" required className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white shadow-sm outline-none font-medium">
                                <option value="">-- Select Doctor --</option>
                                {doctors.map(d => (
                                    <option key={d.id} value={d.id}>{d.full_name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Advance Paid (₹)</Label>
                                <Input name="advance" type="number" placeholder="0" />
                            </div>
                            <div className="space-y-2">
                                <Label>Reason</Label>
                                <Input name="reason" placeholder="Diagnosis/Reason" />
                            </div>
                        </div>

                        <DialogFooter className="pt-4">
                            <Button type="button" variant="outline" onClick={() => setIsAdmissionModalOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={isSubmitting} className="bg-emerald-600 text-white min-w-[120px]">
                                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Admission'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={isWardModalOpen} onOpenChange={setIsWardModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create New Ward</DialogTitle>
                        <DialogDescription>
                            Set up a new ward wing or department in your hospital.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAddWard} className="space-y-4">
                        <div className="space-y-2">
                            <Label className="text-slate-500 font-bold uppercase text-[10px] tracking-wider">Assign to Branch</Label>
                            <Select name="clinic_id" defaultValue="none">
                                <SelectTrigger className="w-full bg-slate-50 border-slate-100 rounded-xl h-11 focus:ring-indigo-500/20 transition-all">
                                    <SelectValue placeholder="Global (No Branch)" />
                                </SelectTrigger>
                                <SelectContent className="bg-white border-slate-200">
                                    <SelectItem value="none">🌐 Global (All Branches)</SelectItem>
                                    {clinics.map(clinic => (
                                        <SelectItem key={clinic.id} value={clinic.id}>
                                            <div className="flex items-center gap-2">
                                                <div className={`w-2 h-2 rounded-full ${clinic.status === 'paused' ? 'bg-red-500' : 'bg-emerald-500'}`} />
                                                {clinic.name}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-slate-500 font-bold uppercase text-[10px] tracking-wider">Ward Name</Label>
                            <Input name="name" placeholder="e.g. ICU Wing A" required className="bg-slate-50 border-slate-100 rounded-xl h-11 focus:ring-indigo-500/20 transition-all" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-slate-500 font-bold uppercase text-[10px] tracking-wider">Ward Type</Label>
                                <select name="ward_type" className="w-full h-11 px-3 border border-slate-100 rounded-xl bg-slate-50 focus:ring-indigo-500/20 transition-all" required>
                                    {WARD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-slate-500 font-bold uppercase text-[10px] tracking-wider">Daily Charge (₹)</Label>
                                <Input name="daily_charge" type="number" step="0.01" placeholder="0.00" required className="bg-slate-50 border-slate-100 rounded-xl h-11 focus:ring-indigo-500/20 transition-all" />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Create Ward'}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={isBedModalOpen} onOpenChange={setIsBedModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Bed to Ward</DialogTitle>
                        <DialogDescription>
                            Define individual or multiple bed units for a specific ward.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAddBed} className="space-y-4">
                        <div className="space-y-2">
                            <Label>Select Ward</Label>
                            <select name="ward_id" required className="w-full h-10 px-3 border rounded-lg bg-white">
                                {wards.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                            </select>
                        </div>
                        
                        <div className="flex items-center gap-2 py-2">
                            <input 
                                type="checkbox" 
                                id="range_mode" 
                                checked={isRangeMode} 
                                onChange={(e) => setIsRangeMode(e.target.checked)}
                                className="w-4 h-4 text-primary rounded border-slate-300 focus:ring-primary"
                            />
                            <Label htmlFor="range_mode" className="cursor-pointer select-none">Add Multiple Beds (Range)</Label>
                        </div>

                        {isRangeMode ? (
                            <div className="space-y-4 animate-in slide-in-from-top-2 duration-200">
                                <div className="space-y-2">
                                    <Label>Bed Prefix (Optional)</Label>
                                    <Input 
                                        value={bedPrefix} 
                                        onChange={e => setBedPrefix(e.target.value)} 
                                        placeholder="e.g. B- or GW-" 
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Start Number</Label>
                                        <Input 
                                            type="number" 
                                            value={rangeStart} 
                                            onChange={e => setRangeStart(e.target.value)} 
                                            required 
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>End Number</Label>
                                        <Input 
                                            type="number" 
                                            value={rangeEnd} 
                                            onChange={e => setRangeEnd(e.target.value)} 
                                            required 
                                        />
                                    </div>
                                </div>
                                <div className="text-[11px] text-slate-500 font-medium italic">
                                    Beds will be created from {bedPrefix}{rangeStart} to {bedPrefix}{rangeEnd}
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                                <Label>Bed Number</Label>
                                <Input name="bed_number" placeholder="e.g. B-101" required />
                            </div>
                        )}

                        <DialogFooter className="pt-2">
                            <Button type="button" variant="outline" onClick={() => setIsBedModalOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                {isRangeMode ? 'Add Beds' : 'Add Bed'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={isBillModalOpen} onOpenChange={setIsBillModalOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white p-0 rounded-3xl border-none shadow-2xl">
                    {billAdmission && (
                        <div className="p-10 space-y-8">
                            <div className="flex justify-between items-start border-b border-slate-100 pb-8">
                                <div className="space-y-4">
                                    <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase">
                                        <Receipt className="w-3.5 h-3.5" /> IPD Tax Invoice (Active)
                                    </div>
                                    <div>
                                        <h2 className="text-4xl font-black text-slate-900 tracking-tight">Bill Summary</h2>
                                        <DialogDescription className="text-slate-500 font-medium">Patient Details & Financial Breakdown</DialogDescription>
                                    </div>
                                    <div className="flex flex-wrap gap-4 pt-2">
                                        <div className="bg-slate-50 rounded-xl px-4 py-2 border border-slate-100">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Patient Name</p>
                                            <p className="font-bold text-slate-800">{billAdmission.patient?.full_name || billAdmission.temp_patient_name}</p>
                                        </div>
                                        <div className="bg-slate-50 rounded-xl px-4 py-2 border border-slate-100">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Admission ID</p>
                                            <p className="font-bold text-slate-800">#{(billAdmission.id || '').toString().slice(0, 8)}</p>
                                        </div>
                                        <div className="bg-slate-50 rounded-xl px-4 py-2 border border-slate-100">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Doctor</p>
                                            <p className="font-bold text-slate-800">{billAdmission.doctor?.full_name || 'Hospital Panel'}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right space-y-2">
                                    <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-4 py-1.5 rounded-lg border-0 shadow-lg shadow-emerald-500/20">LIVE BILLING</Badge>
                                    <div className="pt-4 text-sm text-slate-500 font-medium space-y-1">
                                        <p className="flex items-center justify-end gap-2"><MapPin className="w-3 h-3"/> {billAdmission.bed?.ward?.name} / Bed {billAdmission.bed?.bed_number}</p>
                                        <p className="flex items-center justify-end gap-2"><Calendar className="w-3 h-3"/> Since {new Date(billAdmission.admission_date ?? '').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Billing Content */}
                            <div className="grid gap-8">
                                {/* Accomodation Section */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-1.5 h-6 bg-blue-600 rounded-full" />
                                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Accommodation Charges (24H Cycle)</h3>
                                    </div>
                                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                                        <table className="w-full">
                                            <thead className="bg-slate-50/50">
                                                <tr>
                                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Service Description</th>
                                                    <th className="px-6 py-4 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">Qty/Days</th>
                                                    <th className="px-6 py-4 text-right text-xs font-bold text-slate-400 uppercase tracking-wider">Rate</th>
                                                    <th className="px-6 py-4 text-right text-xs font-bold text-slate-400 uppercase tracking-wider">Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                <tr className="hover:bg-slate-50/30 transition-colors">
                                                    <td className="px-6 py-5">
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 bg-blue-50 rounded-lg"><Hotel className="w-4 h-4 text-blue-600" /></div>
                                                            <div>
                                                                <p className="font-bold text-slate-800">{billAdmission.bed?.ward?.name} Stay</p>
                                                                <p className="text-[10px] text-slate-400 font-medium">Admission Bed: {billAdmission.bed?.bed_number}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-5 text-center font-bold text-slate-900 whitespace-nowrap">
                                                        {Math.max(1, Math.ceil((new Date().getTime() - new Date(billAdmission.admission_date ?? '').getTime()) / (1000 * 60 * 60 * 24)))} Days
                                                    </td>
                                                    <td className="px-6 py-5 text-right font-medium text-slate-600">₹{billAdmission.bed?.ward?.base_daily_charge?.toLocaleString()}</td>
                                                    <td className="px-6 py-5 text-right font-black text-slate-900 border-l border-slate-50 bg-slate-50/20">
                                                        ₹{(Math.max(1, Math.ceil((new Date().getTime() - new Date(billAdmission.admission_date ?? '').getTime()) / (1000 * 60 * 60 * 24))) * (billAdmission.bed?.ward?.base_daily_charge || 0)).toLocaleString()}
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Clinical & Pharmacy Items */}
                                {((billAdmission as any).sales?.length > 0) && (
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-1.5 h-6 bg-indigo-600 rounded-full" />
                                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Pharmacy & Consultation Details</h3>
                                        </div>
                                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                                            <table className="w-full">
                                                <thead className="bg-slate-50/50 text-slate-400">
                                                    <tr>
                                                        <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider">Item Name / Service</th>
                                                        <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider">Unit</th>
                                                        <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider">Price</th>
                                                        <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-900">Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-50">
                                                    {isFetchingBill ? (
                                                        <tr><td colSpan={4} className="p-12 text-center text-slate-300 font-bold uppercase tracking-widest italic animate-pulse">Itemizing Bill...</td></tr>
                                                    ) : (
                                                        <>
                                                            {(billAdmission as any).sales.map((sale: any) => {
                                                                const items = billItems.filter(bi => bi.sale_id === sale.id);
                                                                return (
                                                                    <React.Fragment key={sale.id}>
                                                                        {sale.sale_type === 'CONSULTATION' ? (
                                                                            <tr className="bg-indigo-50/20">
                                                                                <td className="px-6 py-4">
                                                                                    <div className="flex items-center gap-3">
                                                                                        <div className="p-2 bg-indigo-100 rounded-lg"><Stethoscope className="w-4 h-4 text-indigo-600" /></div>
                                                                                        <div>
                                                                                            <p className="font-bold text-slate-800">DR. {sale.doctor_name || 'Hospital Panel'}</p>
                                                                                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Professional Consultation</p>
                                                                                        </div>
                                                                                    </div>
                                                                                </td>
                                                                                <td className="px-6 py-4 text-center font-bold text-slate-900">1 Vis.</td>
                                                                                <td className="px-6 py-4 text-right font-medium text-slate-600">₹{sale.amount.toLocaleString()}</td>
                                                                                <td className="px-6 py-4 text-right font-black text-slate-900 bg-indigo-50/30">₹{sale.amount.toLocaleString()}</td>
                                                                            </tr>
                                                                        ) : (
                                                                            items.map((item: any) => (
                                                                                <tr key={item.id} className="hover:bg-slate-50/40">
                                                                                    <td className="px-6 py-4">
                                                                                        <div className="flex flex-col">
                                                                                            <span className="font-bold text-slate-800">{item.item_name || 'Medicine'}</span>
                                                                                            <span className="text-[10px] text-slate-400 font-medium italic">Sale ID: {(sale.id || '').toString().slice(0, 6)}</span>
                                                                                        </div>
                                                                                    </td>
                                                                                    <td className="px-6 py-4 text-center font-bold text-slate-900">{item.quantity} units</td>
                                                                                    <td className="px-6 py-4 text-right font-medium text-slate-600">₹{(Number(item.price || item.unit_price || 0)).toLocaleString()}</td>
                                                                                    <td className="px-6 py-4 text-right font-black text-slate-900">₹{(item.quantity * Number(item.price || item.unit_price || 0)).toLocaleString()}</td>
                                                                                </tr>
                                                                            ))
                                                                        )}
                                                                    </React.Fragment>
                                                                );
                                                            })}
                                                        </>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* Misc Charges */}
                                {((billAdmission as any).misc_expenses?.length > 0) && (
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-1.5 h-6 bg-amber-500 rounded-full" />
                                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Miscellaneous Expenses</h3>
                                        </div>
                                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                                            <table className="w-full">
                                                <thead className="bg-amber-50/30">
                                                    <tr>
                                                        <th className="px-6 py-4 text-left text-xs font-bold text-amber-600 uppercase tracking-wider">Charge Name</th>
                                                        <th className="px-6 py-4 text-center text-xs font-bold text-amber-600 uppercase tracking-wider">Charged On</th>
                                                        <th className="px-6 py-4 text-right text-xs font-bold text-amber-600 uppercase tracking-wider">Amount</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-amber-50/50">
                                                    {(billAdmission as any).misc_expenses.map((exp: any) => (
                                                        <tr key={exp.id} className="hover:bg-amber-50/10">
                                                            <td className="px-6 py-4 font-bold text-slate-800">{exp.name}</td>
                                                            <td className="px-6 py-4 text-center font-medium text-slate-500 text-xs">
                                                                {new Date(exp.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                                            </td>
                                                            <td className="px-6 py-4 text-right font-black text-slate-900 bg-amber-50/10">₹{exp.amount.toLocaleString()}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Summary Card */}
                            <div className="relative mt-8 pt-8 border-t-2 border-dashed border-slate-100">
                                <div className="absolute -top-[1px] left-0 right-0 grid grid-cols-6 gap-2">
                                    {[...Array(24)].map((_, i) => <div key={i} className="h-0.5 bg-slate-50 w-full" />)}
                                </div>
                                <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white shadow-2xl relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-blue-600/20 transition-all duration-700" />
                                    
                                    <div className="relative space-y-6">
                                        <div className="flex justify-between items-center text-slate-400">
                                            <span className="text-xs font-black uppercase tracking-[0.3em]">Total Billable Accrual</span>
                                            <span className="text-xl font-bold tracking-tight">₹{(
                                                (Math.max(1, Math.ceil((new Date().getTime() - new Date(billAdmission.admission_date ?? '').getTime()) / (1000 * 60 * 60 * 24))) * (billAdmission.bed?.ward?.base_daily_charge || 0)) +
                                                ((billAdmission as any).sales?.reduce((sum: number, s: any) => sum + Number(s.amount || 0), 0) || 0) +
                                                ((billAdmission as any).misc_expenses?.reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0) || 0)
                                            ).toLocaleString()}</span>
                                        </div>
                                        
                                        <div className="flex justify-between items-center text-orange-400">
                                            <span className="text-xs font-black uppercase tracking-[0.3em]">Paid at POS (-)</span>
                                            <span className="text-xl font-bold tracking-tight">₹{((billAdmission as any).sales?.filter((s: any) => s.payment_mode !== 'IPD_BILL').reduce((sum: number, s: any) => sum + Number(s.amount || 0), 0) || 0).toLocaleString()}</span>
                                        </div>

                                        <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-8">
                                            <div>
                                                <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.4em] mb-2">Net Payable Balance</p>
                                                <h4 className="text-6xl font-black tracking-tighter">
                                                    ₹{(((Math.max(1, Math.ceil((new Date().getTime() - new Date(billAdmission.admission_date ?? '').getTime()) / (1000 * 60 * 60 * 24))) * (billAdmission.bed?.ward?.base_daily_charge || 0)) +
                                                    ((billAdmission as any).sales?.reduce((sum: number, s: any) => sum + Number(s.amount || 0), 0) || 0) +
                                                    ((billAdmission as any).misc_expenses?.reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0) || 0)) - 
                                                    (billAdmission.advance_paid || 0) -
                                                    ((billAdmission as any).sales?.filter((s: any) => s.payment_mode !== 'IPD_BILL').reduce((sum: number, s: any) => sum + Number(s.amount || 0), 0) || 0)).toLocaleString()}
                                                </h4>
                                            </div>
                                            <div className="flex gap-4 w-full md:w-auto">
                                                <Button 
                                                    onClick={() => window.print()}
                                                    variant="outline" 
                                                    className="flex-1 md:flex-none border-white/20 text-white hover:bg-white/10 h-14 px-8 rounded-2xl font-bold uppercase tracking-widest text-[10px]"
                                                >
                                                    <Receipt className="w-4 h-4 mr-2" /> Print Preview
                                                </Button>
                                                <Button 
                                                    className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-500 text-white shadow-xl shadow-blue-600/30 h-14 px-10 rounded-2xl font-bold uppercase tracking-widest text-[10px]"
                                                >
                                                    Finalize & Release
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={isPatientModalOpen} onOpenChange={setIsPatientModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Quick Patient Registration</DialogTitle>
                        <DialogDescription>
                            Enter patient demographics to create a new medical record.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleRegisterPatient} className="space-y-4">
                        <div className="space-y-2">
                            <Label>Full Name</Label>
                            <Input name="full_name" required />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Age</Label>
                                <Input name="age" type="number" required />
                            </div>
                            <div className="space-y-2">
                                <Label>Gender</Label>
                                <select name="gender" className="w-full h-10 px-3 border rounded-lg bg-white" required>
                                    <option value="Male">Male</option>
                                    <option value="Female">Female</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Phone number</Label>
                            <Input name="phone" required placeholder="10-digit mobile number" />
                        </div>
                        <div className="space-y-2">
                            <Label>Address (Optional)</Label>
                            <Input name="address" placeholder="Postal address" />
                        </div>
                        <DialogFooter>
                            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Registering...' : 'Complete Registration'}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={isMiscModalOpen} onOpenChange={setIsMiscModalOpen}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black">Add Manual Charge</DialogTitle>
                        <DialogDescription>Add services like Nursing, Oxygen, or Lab tests to the IPD bill.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAddMiscExpense} className="space-y-4 pt-4">
                        <div className="space-y-2">
                            <Label>Expense Note</Label>
                            <Input value={miscExpenseName} onChange={e => setMiscExpenseName(e.target.value)} placeholder="e.g. ICU Nursing - Night Shift" required />
                        </div>
                        <div className="space-y-2">
                            <Label>Amount (₹)</Label>
                            <Input type="number" value={miscExpenseAmount} onChange={e => setMiscExpenseAmount(e.target.value)} placeholder="0.00" required />
                        </div>
                        <DialogFooter className="pt-4">
                            <Button type="button" variant="outline" onClick={() => setIsMiscModalOpen(false)}>Cancel</Button>
                            <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={isSubmitting}>
                                {isSubmitting ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                                Add to Bill
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={isDischargeModalOpen} onOpenChange={setIsDischargeModalOpen}>
                <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black">Discharge & Billing</DialogTitle>
                        <DialogDescription>Review final charges and finalize the transaction.</DialogDescription>
                    </DialogHeader>
                    
                    {selectedAdmission && (
                        <div className="space-y-6 mt-4">
                            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center">
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Patient Details</p>
                                    <h4 className="font-bold text-slate-900 text-lg">{selectedAdmission.patient?.full_name}</h4>
                                    <p className="text-xs text-slate-500 font-medium">{selectedAdmission.bed?.ward?.name} • Bed {selectedAdmission.bed?.bed_number}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Admission Duration</p>
                                    <p className="font-bold text-slate-900">
                                        {Math.max(1, Math.ceil((new Date().getTime() - new Date(selectedAdmission.admission_date).getTime()) / (1000 * 60 * 60 * 24)))} Days
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Service Breakdown</Label>
                                <div className="border rounded-xl divide-y divide-slate-100 overflow-hidden bg-white">
                                    {/* Bed Charges */}
                                    <div className="flex justify-between items-center p-3 text-sm">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-slate-900">Accomodation Charges</span>
                                            <span className="text-[10px] text-slate-400 font-medium">
                                                {Math.max(1, Math.ceil((new Date().getTime() - new Date(selectedAdmission.admission_date).getTime()) / (1000 * 60 * 60 * 24)))} days x ₹{selectedAdmission.bed?.ward?.base_daily_charge}
                                            </span>
                                        </div>
                                        <span className="font-bold font-mono">₹{Math.max(1, Math.ceil((new Date().getTime() - new Date(selectedAdmission.admission_date).getTime()) / (1000 * 60 * 60 * 24))) * (selectedAdmission.bed?.ward?.base_daily_charge || 0)}</span>
                                    </div>
                                    
                                    {/* Pharmacy Charges - Itemized */}
                                    {selectedAdmission.sales?.filter((s: any) => s.sale_type === 'PHARMACY').map((s: any) => (
                                        <div key={s.id} className="flex justify-between items-center p-3 text-sm bg-emerald-50/30 border-b border-emerald-100/50 last:border-0 border-dashed">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-emerald-800 flex items-center gap-1">
                                                    <span className="material-symbols-outlined text-[16px]">receipt_long</span> Pharmacy Receipt #{(s.id || '').toString().slice(-6).toUpperCase()}
                                                </span>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${s.payment_mode === 'IPD_BILL' ? 'bg-emerald-100/50 text-emerald-700' : 'bg-blue-100/50 text-blue-700'}`}>
                                                        {s.payment_mode === 'IPD_BILL' ? 'Added to Bill' : s.payment_mode}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">
                                                        {new Date(s.timestamp).toLocaleDateString()} • {new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className="font-bold font-mono text-emerald-700 block">₹{Number(s.amount || s.final_amount) || 0}</span>
                                                {s.payment_mode !== 'IPD_BILL' && <span className="text-[8px] text-emerald-500 font-black uppercase italic">Paid at POS</span>}
                                            </div>
                                        </div>
                                    ))}

                                    {/* Consultation Charges */}
                                    {(() => {
                                        const consulTotal = selectedAdmission.sales?.filter((s: any) => s.sale_type === 'CONSULTATION').reduce((sum: number, s: any) => sum + (Number(s.amount || s.final_amount) || 0), 0) || 0;
                                        if (consulTotal === 0) return null;
                                        return (
                                            <div className="flex justify-between items-center p-3 text-sm bg-amber-50/30">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-amber-700 flex items-center gap-1">
                                                        <span className="material-symbols-outlined text-sm">stethoscope</span> Consultations
                                                    </span>
                                                </div>
                                                <span className="font-bold font-mono text-amber-700">₹{consulTotal}</span>
                                            </div>
                                        );
                                    })()}

                                    {/* Misc Expenses (from table) */}
                                    {selectedAdmission.misc_expenses?.map((m: any) => (
                                        <div key={m.id} className="flex justify-between items-center p-3 text-sm bg-purple-50/30">
                                            <div className="flex flex-col">
                                                <span className="font-medium text-purple-700">{m.description}</span>
                                                <span className="text-[10px] text-purple-500">{new Date(m.created_at).toLocaleDateString()}</span>
                                            </div>
                                            <span className="font-bold font-mono text-purple-700">₹{m.amount}</span>
                                        </div>
                                    ))}

                                    {/* Manual Extras in Modal */}
                                    {extraCharges.map((charge: any, idx: number) => (
                                        <div key={idx} className="flex justify-between items-center p-3 text-sm group">
                                            <span className="font-medium text-slate-600">{charge.name} (Manual)</span>
                                            <div className="flex items-center gap-3">
                                                <span className="font-bold font-mono">₹{charge.amount}</span>
                                                <button onClick={() => setExtraCharges(prev => prev.filter((_, i) => i !== idx))} className="p-1 hover:bg-red-50 text-red-400 hover:text-red-500 rounded transition-colors"><Trash2 size={14} /></button>
                                            </div>
                                        </div>
                                    ))}

                                    <div className="p-3 bg-slate-50 flex gap-2">
                                        <Input placeholder="Additional Charge (e.g. Oxygen)" className="h-8 text-xs flex-1 border-slate-200" id="newChargeName" />
                                        <Input type="number" placeholder="Amt" className="h-8 text-xs w-20 border-slate-200" id="newChargeAmount" />
                                        <div className="flex gap-1">
                                            <Button size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold" onClick={handleSaveInterimCharge} disabled={isSubmitting}>
                                                {isSubmitting ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} className="mr-1" />}
                                                Add
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-slate-900 text-white p-6 rounded-2xl space-y-4 shadow-xl shadow-slate-200">
                                <div className="flex justify-between items-center text-sm opacity-60">
                                    <span>Gross Bill Amount</span>
                                    <span>₹{(
                                        (Math.max(1, Math.ceil((new Date().getTime() - new Date(selectedAdmission.admission_date).getTime()) / (1000 * 60 * 60 * 24))) * (selectedAdmission.bed?.ward?.base_daily_charge || 0)) + 
                                        (selectedAdmission.sales?.filter((s: any) => s.payment_mode === 'IPD_BILL').reduce((sum: number, s: any) => sum + (Number(s.amount || s.final_amount) || 0), 0) || 0) +
                                        (selectedAdmission.misc_expenses?.reduce((sum: number, m: any) => sum + Number(m.amount), 0) || 0) +
                                        extraCharges.reduce((sum, c) => sum + Number(c.amount), 0)
                                    ).toLocaleString()}</span>
                                </div>
                                {selectedAdmission.advance_paid > 0 && (
                                    <div className="flex justify-between items-center text-sm font-bold text-emerald-400">
                                        <span>Advance Adjusted</span>
                                        <span>- ₹{selectedAdmission.advance_paid}</span>
                                    </div>
                                )}
                                <div className="border-t border-white/10 pt-4 flex justify-between items-end">
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-1">Total Payable</p>
                                        <p className="text-3xl font-black">₹{Math.max(0, (
                                            (Math.max(1, Math.ceil((new Date().getTime() - new Date(selectedAdmission.admission_date).getTime()) / (1000 * 60 * 60 * 24))) * (selectedAdmission.bed?.ward?.base_daily_charge || 0)) + 
                                            (selectedAdmission.sales?.reduce((sum: number, s: any) => sum + (Number(s.amount || s.final_amount) || 0), 0) || 0) +
                                            (selectedAdmission.misc_expenses?.reduce((sum: number, m: any) => sum + Number(m.amount), 0) || 0) +
                                            extraCharges.reduce((sum, c) => sum + Number(c.amount), 0)
                                        ) - (selectedAdmission.advance_paid || 0) - (selectedAdmission.sales?.filter((s: any) => s.payment_mode !== 'IPD_BILL').reduce((sum: number, s: any) => sum + (Number(s.amount || s.final_amount) || 0), 0) || 0)).toLocaleString()}</p>
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        <Label className="text-[10px] uppercase font-bold text-white/50">Payment Mode</Label>
                                        <div className="flex bg-white/10 p-1 rounded-lg">
                                            {(['Cash', 'UPI', 'Card'] as const).map(mode => (
                                                <button key={mode} type="button" onClick={() => setPaymentMode(mode)}
                                                    className={`px-3 py-1 rounded-md text-[10px] font-black transition-all ${paymentMode === mode ? 'bg-white text-slate-900 shadow-sm' : 'text-white/40 hover:text-white/70'}`}
                                                > {mode} </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <DialogFooter className="pt-2">
                                <Button variant="outline" type="button" onClick={() => setIsDischargeModalOpen(false)}>Back</Button>
                                <Button 
                                    onClick={handleFinalDischarge} 
                                    disabled={isSubmitting}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-8 shadow-lg shadow-emerald-100"
                                >
                                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Receipt className="w-4 h-4 mr-2" />}
                                    Final Payment & Discharge
                                </Button>
                            </DialogFooter>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Receipt Modal for IPD Bill */}
            {lastSaleId && (
                <ReceiptModal
                    open={showReceipt}
                    onClose={() => setShowReceipt(false)}
                    sale={(() => {
                        const now = new Date();
                        const days = selectedAdmission ? Math.max(1, Math.ceil((now.getTime() - new Date(selectedAdmission.admission_date).getTime()) / (1000 * 60 * 60 * 24))) : 0;
                        const subtotal = selectedAdmission ? (days * (selectedAdmission.bed?.ward?.base_daily_charge || 0) + extraCharges.reduce((sum, c) => sum + Number(c.amount), 0)) : 0;
                        const final = selectedAdmission ? Math.max(0, subtotal - (selectedAdmission.advance_paid || 0)) : 0;
                        
                        return {
                            id: lastSaleId,
                            patient_name: selectedAdmission?.patient?.full_name,
                            doctor_name: selectedAdmission?.doctor?.full_name,
                            amount: final,
                            subtotal: subtotal,
                            discount_percentage: 0,
                            payment_mode: paymentMode,
                            timestamp: now.toISOString(),
                            sale_type: 'IPD'
                        };
                    })()}
                    items={(() => {
                        const days = selectedAdmission ? Math.max(1, Math.ceil((new Date().getTime() - new Date(selectedAdmission.admission_date).getTime()) / (1000 * 60 * 60 * 24))) : 0;
                        const items = [
                            { 
                                item_name: `Accomodation (${selectedAdmission?.bed?.ward?.name})`, 
                                quantity: days, 
                                price: selectedAdmission?.bed?.ward?.base_daily_charge 
                            }
                        ];
                        
                        const pharmaTotal = selectedAdmission?.sales?.filter((s: any) => s.sale_type === 'PHARMACY').reduce((sum: number, s: any) => sum + (Number(s.amount || s.final_amount) || 0), 0) || 0;
                        if (pharmaTotal > 0) items.push({ item_name: 'Pharmacy Purchases', quantity: 1, price: pharmaTotal });
                        
                        const consulTotal = selectedAdmission?.sales?.filter((s: any) => s.sale_type === 'CONSULTATION').reduce((sum: number, s: any) => sum + (Number(s.amount || s.final_amount) || 0), 0) || 0;
                        if (consulTotal > 0) items.push({ item_name: 'OPD/Consultation Fees', quantity: 1, price: consulTotal });
                        
                        selectedAdmission?.misc_expenses?.forEach((m: any) => {
                            items.push({ item_name: m.name, quantity: 1, price: Number(m.amount) });
                        });
                        
                        extraCharges.forEach(c => {
                            items.push({ item_name: c.name, quantity: 1, price: Number(c.amount) });
                        });

                        // Add credits for payments already made
                        if ((selectedAdmission?.advance_paid || 0) > 0) {
                            items.push({ item_name: 'Advance Deposit (Paid)', quantity: 1, price: -Number(selectedAdmission?.advance_paid) });
                        }

                        const paidAtPOS = selectedAdmission?.sales?.filter((s: any) => s.payment_mode !== 'IPD_BILL').reduce((sum: number, s: any) => sum + (Number(s.amount || s.final_amount) || 0), 0) || 0;
                        if (paidAtPOS > 0) {
                            items.push({ item_name: 'Paid at POS (Cash/UPI)', quantity: 1, price: -Number(paidAtPOS) });
                        }

                        return items;
                    })()}
                />
            )}
        </div>
    );
}

export default IPDDashboard;
