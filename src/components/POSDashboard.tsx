import { useState, useEffect } from 'react'
import { CardDescription } from '@/components/ui/basic'
import { Button, Input, Label } from '@/components/ui/basic'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { dataService as db } from '@/lib/dataService'
import { useHospital } from '@/context/HospitalContext'
import { ReceiptModal } from '@/components/ui/ReceiptModal'

type POSView = 'pharmacy' | 'consultation';

export function POSDashboard() {
    const { profile, clinics, inventory, billing } = useHospital();
    const { toast } = useToast();

    // Context & Routing
    const [view, setView] = useState<POSView>('pharmacy');
    const [selectedClinicId, setSelectedClinicId] = useState<string | null>(null);

    // Form States
    const [patientName, setPatientName] = useState('');
    const [doctorName, setDoctorName] = useState('');
    const [paymentMode, setPaymentMode] = useState('Cash');

    // Consultation State
    const [consultationFee, setConsultationFee] = useState('');
    const [consultationDiscountPercent, setConsultationDiscountPercent] = useState('');
    const [consultationDiscountedFee, setConsultationDiscountedFee] = useState('');

    // Pharmacy Cart State
    const [cart, setCart] = useState<{ 
        id: string, 
        name: string, 
        price: number, 
        quantity: number, 
        maxQty: number,
        unitsPerPack: number,
        isLoose: boolean,
        totalTablets: number
    }[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [pharmacyDiscountPercent, setPharmacyDiscountPercent] = useState('');
    const [pharmacyDiscountedTotal, setPharmacyDiscountedTotal] = useState('');

    // Qty Prompt State
    const [promptItem, setPromptItem] = useState<any>(null);
    const [sellType, setSellType] = useState<'pack' | 'unit'>('pack');
    const [qtyInput, setQtyInput] = useState('1');

    // Receipt State
    const [isReceiptOpen, setIsReceiptOpen] = useState(false);
    const [lastSaleData, setLastSaleData] = useState<any>(null);
    const [lastSaleItems, setLastSaleItems] = useState<any[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);

    // Mobile Search Dialog
    const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
    const [mobileSearchQuery, setMobileSearchQuery] = useState('');

    // derived
    const activeClinic = clinics.find(c => c.id === selectedClinicId);

    // We filter by whichever search query is currently active (desktop or mobile popup)
    const currentSearch = isMobileSearchOpen ? mobileSearchQuery : searchQuery;
    const clinicInventory = inventory.filter(i =>
        i.clinic_id === selectedClinicId &&
        i.quantity > 0 &&
        (i.item_name.toLowerCase().includes(currentSearch.toLowerCase()) || i.batch_number.toLowerCase().includes(currentSearch.toLowerCase()))
    ).sort((a, b) => {
        const nameA = a.item_name.toLowerCase();
        const nameB = b.item_name.toLowerCase();
        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;
        // Same name, sort by expiry date ascending (older expiry first)
        const dateA = new Date(a.expiry_date).getTime();
        const dateB = new Date(b.expiry_date).getTime();
        return dateA - dateB;
    });

    // Auto-select clinic if staff belongs to one
    useEffect(() => {
        if (profile?.clinic_id) {
            setSelectedClinicId(profile.clinic_id);
        }
    }, [profile]);

    const handleProcessConsultation = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedClinicId) return;

        if (billing?.isAtLimit('monthly_sales')) {
            toast({
                title: "Limit Reached",
                description: "Monthly sales limit reached. Upgrade plan to process more transactions.",
                variant: "destructive"
            });
            return;
        }

        setIsProcessing(true);
        try {
            const amount = parseFloat(consultationFee);
            if (isNaN(amount) || amount <= 0) throw new Error("Invalid Consultation Fee");

            const discountPercent = parseFloat(consultationDiscountPercent) || 0;
            const finalAmount = consultationDiscountedFee !== '' ? parseFloat(consultationDiscountedFee) : amount;

            const saleId = await db.callRpc('process_sale', {
                p_hospital_id: profile?.hospital_id,
                p_clinic_id: selectedClinicId,
                p_patient_name: patientName,
                p_doctor_name: doctorName,
                p_sale_type: 'CONSULTATION',
                p_payment_mode: paymentMode,
                p_amount: finalAmount,
                p_subtotal: amount,
                p_discount_percentage: discountPercent,
                p_items: [] // No inventory items for consultation
            });

            toast({ title: 'Success', description: 'Consultation Recorded.', className: 'bg-green-50 border-green-200 text-green-900' });

            // Show receipt
            const recordedSale = { 
                id: saleId, 
                patient_name: patientName, 
                doctor_name: doctorName, 
                amount: finalAmount, 
                subtotal: amount,
                discount_percentage: discountPercent,
                payment_mode: paymentMode, 
                sale_type: 'CONSULTATION' 
            };
            setLastSaleData(recordedSale);
            setLastSaleItems([{ item_name: 'Consultation Fee', quantity: 1, price: amount }]);
            setIsReceiptOpen(true);

            // Reset
            setPatientName(''); setDoctorName(''); setConsultationFee(''); setConsultationDiscountPercent(''); setConsultationDiscountedFee('');

        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setIsProcessing(false);
        }
    };

    useEffect(() => {
        if (!consultationFee) {
            setConsultationDiscountedFee('');
            return;
        }
        if (!consultationDiscountPercent) {
            setConsultationDiscountedFee(consultationFee);
        } else {
            const amount = parseFloat(consultationFee);
            const pct = parseFloat(consultationDiscountPercent) || 0;
            const discounted = amount - (amount * (pct / 100));
            // Only update if it is different to prevent cycles if user is manually typing in the discounted total
            if (Math.abs(parseFloat(consultationDiscountedFee || '0') - discounted) > 0.01) {
                 setConsultationDiscountedFee(discounted.toFixed(2));
            }
        }
    }, [consultationFee, consultationDiscountPercent]);

    const addToCart = (item: any) => {
        setCart(current => {
            const existing = current.find(c => c.id === item.id);
            if (existing) {
                const newQty = existing.quantity + 1;
                const newTotalTablets = existing.isLoose ? newQty : newQty * existing.unitsPerPack;
                
                if (newTotalTablets > item.quantity) {
                    toast({ description: "Not enough stock", variant: "destructive", duration: 2000 });
                    return current;
                }
                
                return current.map(c => c.id === item.id ? { ...c, quantity: newQty, totalTablets: newTotalTablets } : c);
            }

            setPromptItem(item);
            setSellType('pack');
            setQtyInput('1');
            return current;
        });
    };

    const confirmAddToCart = (e: React.FormEvent) => {
        e.preventDefault();
        if (!promptItem) return;

        const qty = parseInt(qtyInput, 10);
        if (isNaN(qty) || qty <= 0) {
            toast({ description: "Please enter a valid quantity greater than 0", variant: "destructive" });
            return;
        }

        const upp = promptItem.units_per_pack || 1;
        const totalTablets = sellType === 'pack' ? qty * upp : qty;

        if (totalTablets > promptItem.quantity) {
            toast({ description: "Not enough stock available", variant: "destructive", duration: 2000 });
            return;
        }

        const pricePerUnit = sellType === 'pack' ? (promptItem.mrp || 0) : (promptItem.mrp || 0) / upp;

        setCart(current => {
            const existingIndex = current.findIndex(c => c.id === promptItem.id && c.isLoose === (sellType === 'unit'));
            
            if (existingIndex > -1) {
                const newCart = [...current];
                const existing = newCart[existingIndex];
                const newQty = existing.quantity + qty;
                const newTotalTablets = existing.isLoose ? newQty : newQty * upp;

                if (newTotalTablets > promptItem.quantity) {
                    toast({ description: "Total quantity exceeds available stock", variant: "destructive" });
                    return current;
                }

                newCart[existingIndex] = { ...existing, quantity: newQty, totalTablets: newTotalTablets };
                return newCart;
            }

            return [
                ...current,
                {
                    id: promptItem.id,
                    name: promptItem.item_name,
                    price: pricePerUnit,
                    quantity: qty,
                    maxQty: promptItem.quantity,
                    unitsPerPack: upp,
                    isLoose: sellType === 'unit',
                    totalTablets: totalTablets
                }
            ];
        });

        setPromptItem(null);
        setQtyInput('1');
    };

    const updateCartQuantity = (id: string, newQty: number) => {
        if (newQty <= 0) {
            setCart(cart.filter(c => c.id !== id));
            return;
        }
        setCart(cart.map(c => {
            if (c.id === id) {
                const newTotalTablets = c.isLoose ? newQty : newQty * c.unitsPerPack;
                if (newTotalTablets > c.maxQty) {
                    toast({ description: "Max stock reached", variant: "destructive", duration: 2000 });
                    return c;
                }
                return { ...c, quantity: newQty, totalTablets: newTotalTablets };
            }
            return c;
        }));
    };

    const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // Sync Pharmacy Discount with Cart Total
    useEffect(() => {
        if (!pharmacyDiscountPercent) {
            setPharmacyDiscountedTotal(cartTotal.toFixed(2));
        } else {
            const pct = parseFloat(pharmacyDiscountPercent) || 0;
            const discounted = cartTotal - (cartTotal * (pct / 100));
            // Only update if it is different to prevent cycles if user is manually typing in the discounted total
            if (Math.abs(parseFloat(pharmacyDiscountedTotal || '0') - discounted) > 0.01) {
                 setPharmacyDiscountedTotal(discounted.toFixed(2));
            }
        }
    }, [cartTotal, pharmacyDiscountPercent]);

    const handleProcessPharmacy = async () => {
        if (!selectedClinicId || cart.length === 0 || !patientName || !doctorName) {
            toast({ title: 'Incomplete', description: 'Fill all fields and add items', variant: 'destructive' })
            return;
        }

        if (billing?.isAtLimit('monthly_sales')) {
            toast({
                title: "Limit Reached",
                description: "Monthly sales limit reached. Upgrade plan to process more transactions.",
                variant: "destructive"
            });
            return;
        }

            setIsProcessing(true);
        try {
            const discountPercent = parseFloat(pharmacyDiscountPercent) || 0;
            const finalAmount = pharmacyDiscountedTotal !== '' ? parseFloat(pharmacyDiscountedTotal) : cartTotal;
            
            const saleItems = cart.map(c => ({ 
                inventory_id: c.id, 
                quantity: c.totalTablets, 
                price: c.price,
                is_loose_sale: c.isLoose,
                units_sold: c.quantity
            }));

            const saleId = await db.callRpc('process_sale', {
                p_hospital_id: profile?.hospital_id,
                p_clinic_id: selectedClinicId,
                p_patient_name: patientName,
                p_doctor_name: doctorName,
                p_sale_type: 'PHARMACY',
                p_payment_mode: paymentMode,
                p_amount: finalAmount,
                p_subtotal: cartTotal,
                p_discount_percentage: discountPercent,
                p_items: saleItems
            });

            toast({ title: 'Success', description: 'Pharmacy Checkout Complete.', className: 'bg-green-50 border-green-200 text-green-900' });

            const recordedSale = { 
                id: saleId, 
                patient_name: patientName, 
                doctor_name: doctorName, 
                amount: finalAmount, 
                subtotal: cartTotal,
                discount_percentage: discountPercent,
                payment_mode: paymentMode, 
                sale_type: 'PHARMACY' 
            };
            setLastSaleData(recordedSale);
            setLastSaleItems(cart.map(c => ({ 
                item_name: c.name + (c.isLoose ? ' (Loose)' : ' (Pack)'), 
                quantity: c.quantity, 
                price: c.price 
            })));
            setIsReceiptOpen(true);

            setCart([]); setPatientName(''); setDoctorName(''); setPharmacyDiscountPercent(''); setPharmacyDiscountedTotal('');

        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setIsProcessing(false);
        }
    }

    if (!selectedClinicId) {
        return (
            <div className="max-w-xl mx-auto mt-20 p-10 bg-white rounded-3xl border border-slate-200 shadow-xl text-center">
                <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <span className="material-symbols-outlined text-4xl text-blue-600">storefront</span>
                </div>
                <h2 className="text-3xl font-bold text-slate-900 mb-2">Select Clinic Location</h2>
                <p className="text-slate-500 mb-8">Choose the designated clinic to start billing and POS operations.</p>
                <div className="space-y-3">
                    {clinics.map(c => (
                        <button key={c.id} disabled={c.status === 'paused'} className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all group ${c.status === 'paused' ? 'border-slate-100 bg-slate-50 cursor-not-allowed opacity-60' : 'border-slate-100 hover:border-blue-600 focus:border-blue-600 bg-slate-50 hover:bg-white focus:bg-white'}`} onClick={() => setSelectedClinicId(c.id)}>
                            <div className="flex items-center gap-4">
                                <span className={`material-symbols-outlined ${c.status === 'paused' ? 'text-slate-300' : 'text-slate-400 group-hover:text-blue-600'}`}>location_on</span>
                                <span className={`font-bold ${c.status === 'paused' ? 'text-slate-400' : 'text-slate-700 group-hover:text-slate-900'}`}>{c.name} {c.status === 'paused' && <span className="text-red-500 font-medium ml-2 text-sm px-2 py-0.5 bg-red-50 rounded-full border border-red-100">Paused</span>}</span>
                            </div>
                            <span className={`material-symbols-outlined ${c.status === 'paused' ? 'text-slate-200' : 'text-slate-300 group-hover:text-blue-600'}`}>chevron_right</span>
                        </button>
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="h-[calc(100vh-100px)] flex flex-col animate-in fade-in duration-500 max-w-[1600px] mx-auto">
            {/* TOP HEADER */}
            <header className="h-14 sm:h-16 shrink-0 border border-slate-200 bg-white rounded-t-lg sm:rounded-t-2xl flex items-center justify-between px-3 sm:px-6 shadow-sm z-20">
                <div className="flex items-center gap-2 sm:gap-4">
                    <div className="bg-blue-600/10 p-1.5 sm:p-2 rounded-lg">
                        <span className="material-symbols-outlined text-blue-600 text-[20px] sm:text-[24px]">point_of_sale</span>
                    </div>
                    <div>
                        <h1 className="text-sm sm:text-lg font-bold tracking-tight text-slate-900">Clinical Billing & POS</h1>
                        <p className="text-[10px] sm:text-xs text-slate-500 font-medium truncate w-32 sm:w-auto">{activeClinic?.name}</p>
                    </div>
                </div>
                {view === 'pharmacy' && (
                    <div className="hidden sm:flex items-center gap-4">
                        <div className="relative">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base">search</span>
                            <input
                                className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-full text-sm w-64 focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all shadow-sm"
                                placeholder="Search items..."
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                )}
            </header>

            {/* MAIN DESKTOP LAYOUT */}
            <main className="flex-1 flex flex-col lg:flex-row overflow-hidden lg:border-x border-b border-slate-200 rounded-b-lg sm:rounded-b-2xl bg-slate-50 z-10">

                {/* LEFT SIDEBAR - CATEGORIES */}
                <aside className="w-full lg:w-64 shrink-0 border-b lg:border-b-0 lg:border-r border-slate-200 bg-white p-2 sm:p-4 flex flex-row lg:flex-col gap-2 relative z-10 shadow-sm overflow-x-auto no-scrollbar">
                    <p className="hidden lg:block text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-2 mt-2">Billing Flows</p>

                    <button onClick={() => setView('pharmacy')} className={`flex items-center whitespace-nowrap gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-3 rounded-lg sm:rounded-xl text-sm sm:text-base font-medium transition-all group ${view === 'pharmacy' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' : 'bg-slate-50 lg:bg-transparent hover:bg-slate-50 text-slate-600'}`}>
                        <span className={`material-symbols-outlined text-[18px] sm:text-[24px] ${view === 'pharmacy' ? '' : 'group-hover:text-blue-600'}`}>pill</span>
                        <span>Pharmacy POS</span>
                    </button>

                    <button onClick={() => setView('consultation')} className={`flex items-center whitespace-nowrap gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-3 rounded-lg sm:rounded-xl text-sm sm:text-base font-medium transition-all group ${view === 'consultation' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' : 'bg-slate-50 lg:bg-transparent hover:bg-slate-50 text-slate-600'}`}>
                        <span className={`material-symbols-outlined text-[18px] sm:text-[24px] ${view === 'consultation' ? '' : 'group-hover:text-blue-600'}`}>stethoscope</span>
                        <span>OPD Consultation</span>
                    </button>

                    <div className="hidden lg:block mt-auto border-t border-slate-100 pt-4">
                        {/* Exit Terminal removed per requested clinic dashboard restrictions */}
                    </div>
                </aside>

                {/* MIDDLE SECTION - CONTENT */}
                <section className="flex-1 flex flex-col min-w-0 bg-[#f8fafc] overflow-y-auto lg:overflow-hidden">

                    {/* PHARMACY VIEW (Grid) */}
                    {view === 'pharmacy' && (
                        <>
                            <div className="p-3 sm:p-6 pb-2 flex items-center justify-between shrink-0">
                                <h2 className="text-base sm:text-xl font-bold text-slate-800">Available Products</h2>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setIsMobileSearchOpen(true)}
                                        className="sm:hidden px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-lg shadow-sm text-slate-900 flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[16px]">search</span>
                                        All Items
                                    </button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-3 sm:p-6 pt-0 sm:pt-2">
                                <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 pb-10">
                                    {clinicInventory.map(item => (
                                        <div key={item.id} onClick={() => addToCart(item)} className="bg-white border border-slate-100 p-3 sm:p-4 rounded-xl sm:rounded-2xl shadow-sm hover:shadow-md hover:border-blue-600/30 active:scale-[0.98] transition-all cursor-pointer group flex flex-col">
                                            <div className="flex justify-between items-start mb-2 sm:mb-3 pointer-events-none">
                                                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg sm:rounded-xl bg-slate-50 flex items-center justify-center group-hover:scale-105 transition-transform border border-slate-100">
                                                    <span className="material-symbols-outlined text-slate-500 group-hover:text-blue-600 text-[20px] sm:text-[24px]">medication</span>
                                                </div>
                                                <span className="text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded bg-slate-100 text-slate-500 font-mono">Qty: {item.quantity}</span>
                                            </div>
                                            <h3 className="font-bold text-slate-800 leading-tight mb-0.5 sm:mb-1 text-sm sm:text-base line-clamp-2 pointer-events-none">{item.item_name}</h3>
                                            <p className="text-[10px] sm:text-[11px] text-slate-500 mb-2 sm:mb-4 font-mono truncate pointer-events-none">Batch: {item.batch_number}</p>

                                            <div className="mt-auto flex items-center justify-between pt-2 sm:pt-3 border-t border-slate-50">
                                                <span className="text-base sm:text-lg font-bold text-blue-600 pointer-events-none">₹{item.mrp || 0}</span>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); addToCart(item); }}
                                                    className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-slate-100 flex items-center justify-center active:bg-blue-600 active:text-white sm:group-hover:bg-blue-600 text-slate-500 sm:group-hover:text-white transition-colors shrink-0 shadow-sm z-10"
                                                >
                                                    <span className="material-symbols-outlined text-[18px] sm:text-[22px]">add</span>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {clinicInventory.length === 0 && (
                                        <div className="col-span-full py-12 text-center text-slate-400">
                                            <span className="material-symbols-outlined text-4xl mb-3 opacity-30">inventory_2</span>
                                            <p className="text-sm">No inventory items found.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}

                    {/* CONSULTATION VIEW (Form) */}
                    {view === 'consultation' && (
                        <div className="flex-1 flex flex-col items-center justify-center p-3 sm:p-6 overflow-y-auto">
                            <div className="w-full max-w-xl bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm sm:shadow-xl overflow-hidden">
                                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-5 sm:p-8 text-white relative overflow-hidden">
                                    <span className="material-symbols-outlined absolute -right-2 sm:-right-4 -bottom-2 sm:-bottom-4 text-[80px] sm:text-[120px] opacity-10">stethoscope</span>
                                    <h2 className="text-lg sm:text-2xl font-bold relative z-10 flex items-center gap-2"><span className="material-symbols-outlined">stethoscope</span> OPD Assessment & Billing</h2>
                                    <p className="text-blue-100 mt-1 relative z-10 text-xs sm:text-base">Generate a consultation fee receipt directly.</p>
                                </div>
                                <div className="p-5 sm:p-8">
                                    <form onSubmit={handleProcessConsultation} className="space-y-4 sm:space-y-6">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                                            <div className="space-y-1.5 sm:space-y-2">
                                                <Label className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-widest">Patient Name</Label>
                                                <div className="relative">
                                                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">person</span>
                                                    <Input required value={patientName} onChange={e => setPatientName(e.target.value)} placeholder="e.g. John Doe" className="pl-10 h-10 sm:h-11 bg-slate-50 border-slate-200 text-sm" />
                                                </div>
                                            </div>
                                            <div className="space-y-1.5 sm:space-y-2">
                                                <Label className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-widest">Attending Doctor</Label>
                                                <div className="relative">
                                                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">badge</span>
                                                    <Input required value={doctorName} onChange={e => setDoctorName(e.target.value)} placeholder="e.g. Dr. Smith" className="pl-10 h-10 sm:h-11 bg-slate-50 border-slate-200 text-sm" />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                                            <div className="space-y-1.5 sm:space-y-2">
                                                <Label className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-widest">Consultation Fee (₹)</Label>
                                                <div className="relative">
                                                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">payments</span>
                                                    <Input type="number" required value={consultationFee} onChange={e => setConsultationFee(e.target.value)} placeholder="500.00" className="pl-10 h-10 sm:h-11 font-bold text-base sm:text-lg bg-slate-50 border-slate-200" />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1.5 sm:space-y-2">
                                                    <Label className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-widest">Discount (%)</Label>
                                                    <div className="relative">
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            max="100"
                                                            value={consultationDiscountPercent}
                                                            onChange={e => setConsultationDiscountPercent(e.target.value)}
                                                            placeholder="0"
                                                            className="pr-6 h-10 sm:h-11 bg-slate-50 border-slate-200 text-sm"
                                                        />
                                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[14px] font-bold">%</span>
                                                    </div>
                                                </div>
                                                <div className="space-y-1.5 sm:space-y-2">
                                                    <Label className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-widest">Final Price (₹)</Label>
                                                    <div className="relative">
                                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[14px] font-bold">₹</span>
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            value={consultationDiscountedFee}
                                                            onChange={e => {
                                                                setConsultationDiscountedFee(e.target.value);
                                                                const originalAmount = parseFloat(consultationFee);
                                                                const discounted = parseFloat(e.target.value);
                                                                if (originalAmount > 0 && discounted >= 0 && discounted <= originalAmount) {
                                                                    const pct = ((originalAmount - discounted) / originalAmount) * 100;
                                                                    if (Math.abs(parseFloat(consultationDiscountPercent || '0') - pct) > 0.1) {
                                                                        setConsultationDiscountPercent(pct.toFixed(2));
                                                                    }
                                                                }
                                                            }}
                                                            placeholder="0.00"
                                                            disabled={!consultationFee}
                                                            className="pl-8 h-10 sm:h-11 font-bold text-slate-700 bg-slate-50 border-slate-200 text-sm"
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-1.5 sm:space-y-2">
                                                <Label className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-widest">Payment Mode</Label>
                                                <Select value={paymentMode} onValueChange={setPaymentMode}>
                                                    <SelectTrigger className="h-10 sm:h-11 bg-slate-50 border-slate-200 font-medium text-sm"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="Cash">Cash Currency</SelectItem>
                                                        <SelectItem value="UPI">UPI / QR Scan</SelectItem>
                                                        <SelectItem value="Card">Credit / Debit Card</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        <div className="pt-2 sm:pt-4 border-t border-slate-100">
                                            <Button type="submit" disabled={isProcessing} className="w-full h-12 sm:h-14 text-sm sm:text-lg bg-blue-600 hover:bg-blue-700 shadow-md sm:shadow-xl shadow-blue-600/20 transition-all hover:-translate-y-0.5 rounded-xl font-bold">
                                                {isProcessing ? <span className="material-symbols-outlined animate-spin mr-2">sync</span> : <span className="material-symbols-outlined mr-2">receipt_long</span>}
                                                {isProcessing ? 'Processing Transaction...' : 'Process Payment & Print'}
                                            </Button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        </div>
                    )}
                </section>

                {/* RIGHT SIDEBAR - CART (Only visible in Pharmacy view) */}
                {view === 'pharmacy' && (
                    <aside className="w-full lg:w-80 xl:w-[400px] shrink-0 lg:border-l border-t lg:border-t-0 border-slate-200 bg-white flex flex-col z-20 shadow-sm lg:shadow-[-2px_0_10px_-4px_rgba(0,0,0,0.05)] h-auto max-h-[45vh] lg:max-h-full">
                        <div className="p-4 sm:p-6 border-b border-slate-100 bg-slate-50/50">
                            <div className="flex items-center justify-between mb-3 sm:mb-4">
                                <h2 className="font-bold text-sm sm:text-base text-slate-900 flex items-center gap-2"><span className="material-symbols-outlined text-emerald-600 text-[18px] sm:text-[24px]">receipt</span> Current Bill</h2>
                                <button onClick={() => setCart([])} className="text-[10px] sm:text-xs text-red-500 font-bold hover:bg-red-50 px-2 py-1 rounded transition-colors">Clear</button>
                            </div>

                            <div className="space-y-2 sm:space-y-3">
                                <div className="relative">
                                    <span className="material-symbols-outlined absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm sm:text-[18px]">person</span>
                                    <input
                                        className="w-full text-xs sm:text-sm bg-white border border-slate-200 rounded-lg pl-8 sm:pl-10 pr-3 sm:pr-4 py-1.5 sm:py-2 focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition-all shadow-sm font-medium placeholder:font-normal"
                                        placeholder="Patient Name*"
                                        required
                                        value={patientName}
                                        onChange={e => setPatientName(e.target.value)}
                                    />
                                </div>
                                <div className="relative">
                                    <span className="material-symbols-outlined absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm sm:text-[18px]">stethoscope</span>
                                    <input
                                        className="w-full text-xs sm:text-sm bg-white border border-slate-200 rounded-lg pl-8 sm:pl-10 pr-3 sm:pr-4 py-1.5 sm:py-2 focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition-all shadow-sm font-medium placeholder:font-normal"
                                        placeholder="Prescribing Doctor*"
                                        required
                                        value={doctorName}
                                        onChange={e => setDoctorName(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 sm:space-y-4 min-h-[150px]">
                            {cart.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60">
                                    <span className="material-symbols-outlined text-4xl sm:text-6xl mb-2 sm:mb-4">shopping_cart</span>
                                    <p className="font-medium text-xs sm:text-sm">Cart is empty</p>
                                    <p className="text-[10px] sm:text-xs mt-1">Add items from inventory</p>
                                </div>
                            ) : (
                                cart.map(c => (
                                    <div key={c.id} className="flex justify-between items-center group gap-2">
                                        <div className="flex-1 min-w-0 pr-2">
                                            <h4 className="text-xs sm:text-sm font-bold text-slate-800 leading-tight mb-0.5 sm:mb-1 truncate">{c.name}</h4>
                                            <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium">₹{c.price.toFixed(2)} / {c.isLoose ? 'unit' : 'pack'}</p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="text-xs sm:text-sm font-bold text-slate-900 leading-tight mb-0.5 sm:mb-1">₹{(c.price * c.quantity).toFixed(2)}</p>
                                            <div className="flex items-center gap-1 sm:gap-2 justify-end bg-slate-50 rounded-lg p-0.5 border border-slate-100">
                                                <button onClick={() => updateCartQuantity(c.id, c.quantity - 1)} className="h-5 w-5 sm:h-6 sm:w-6 rounded-md hover:bg-white hover:text-red-500 hover:shadow-sm flex items-center justify-center transition-all text-slate-400"><span className="material-symbols-outlined text-[14px] sm:text-[16px]">remove</span></button>
                                                <span className="text-[10px] sm:text-xs font-bold w-6 sm:w-8 text-center">{c.quantity} {c.isLoose ? 'u' : 'pk'}</span>
                                                <button onClick={() => updateCartQuantity(c.id, c.quantity + 1)} className="h-5 w-5 sm:h-6 sm:w-6 rounded-md hover:bg-white hover:text-emerald-600 hover:shadow-sm flex items-center justify-center transition-all text-slate-400"><span className="material-symbols-outlined text-[14px] sm:text-[16px]">add</span></button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-200 sticky bottom-0 z-30 mb-safe sm:mb-0 shadow-[0_-4px_10px_-2px_rgba(0,0,0,0.05)]">
                            <div className="space-y-1.5 sm:space-y-2 mb-3 sm:mb-4">
                                <div className="flex justify-between text-xs sm:text-sm">
                                    <span className="text-slate-500 font-medium">Subtotal</span>
                                    <span className="font-bold text-slate-700">₹{cartTotal.toFixed(2)}</span>
                                </div>

                                <div className="grid grid-cols-2 gap-2 sm:gap-3 items-end pt-2">
                                    <div className="space-y-1">
                                        <Label className="text-[10px] tracking-widest uppercase font-bold text-slate-500">Discount (%)</Label>
                                        <div className="relative">
                                            <Input
                                                type="number"
                                                min="0"
                                                max="100"
                                                value={pharmacyDiscountPercent}
                                                onChange={e => setPharmacyDiscountPercent(e.target.value)}
                                                placeholder="0"
                                                className="pr-6 h-8 sm:h-9 text-xs sm:text-sm"
                                            />
                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[10px] tracking-widest uppercase font-bold text-slate-500">Discounted (₹)</Label>
                                        <div className="relative">
                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">₹</span>
                                            <Input
                                                type="number"
                                                min="0"
                                                value={pharmacyDiscountedTotal}
                                                onChange={e => {
                                                    setPharmacyDiscountedTotal(e.target.value);
                                                    const discounted = parseFloat(e.target.value);
                                                    if (cartTotal > 0 && discounted >= 0 && discounted <= cartTotal) {
                                                        const pct = ((cartTotal - discounted) / cartTotal) * 100;
                                                        if (Math.abs(parseFloat(pharmacyDiscountPercent || '0') - pct) > 0.1) {
                                                            setPharmacyDiscountPercent(pct.toFixed(2));
                                                        }
                                                    }
                                                }}
                                                placeholder="0.00"
                                                disabled={cartTotal === 0}
                                                className="pl-6 h-8 sm:h-9 text-xs sm:text-sm font-bold bg-slate-50"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-between text-base sm:text-lg font-bold border-t border-slate-200 pt-2 mt-2">
                                    <span className="text-slate-900">Total</span>
                                    <span className="text-emerald-600">₹{parseFloat(pharmacyDiscountedTotal || cartTotal.toString()).toFixed(2)}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-3 sm:mb-5">
                                <button onClick={() => setPaymentMode('Cash')} className={`flex items-center justify-center gap-1 sm:gap-2 py-2 sm:py-2.5 rounded-lg sm:rounded-xl border-2 font-bold text-xs sm:text-sm transition-all ${paymentMode === 'Cash' ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600 hover:border-slate-300 bg-white'}`}>
                                    <span className="material-symbols-outlined text-[16px] sm:text-[18px]">payments</span> Cash
                                </button>
                                <button onClick={() => setPaymentMode('UPI')} className={`flex items-center justify-center gap-1 sm:gap-2 py-2 sm:py-2.5 rounded-lg sm:rounded-xl border-2 font-bold text-xs sm:text-sm transition-all ${paymentMode === 'UPI' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-slate-300 bg-white'}`}>
                                    <span className="material-symbols-outlined text-[16px] sm:text-[18px]">qr_code_scanner</span> UPI/Card
                                </button>
                            </div>

                            <button onClick={handleProcessPharmacy} disabled={cart.length === 0 || isProcessing} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 sm:py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md sm:shadow-lg shadow-emerald-600/20 disabled:opacity-50 disabled:shadow-none hover:-translate-y-0.5 active:translate-y-0 text-sm sm:text-base">
                                {isProcessing ? <span className="material-symbols-outlined animate-spin text-[18px] sm:text-[20px]">sync</span> : <span className="material-symbols-outlined text-[18px] sm:text-[20px]">check_circle</span>}
                                {isProcessing ? 'Processing Payment...' : 'Complete Payment'}
                            </button>
                        </div>
                    </aside>
                )}
            </main>

            {/* Receipt Modal */}
            <ReceiptModal
                open={isReceiptOpen}
                onClose={() => setIsReceiptOpen(false)}
                sale={lastSaleData}
                items={lastSaleItems}
            />

            {/* Custom Qty Entry Modal */}
            <Dialog open={!!promptItem} onOpenChange={(open) => !open && setPromptItem(null)}>
                <DialogContent className="sm:max-w-sm bg-white text-slate-900 border-none shadow-2xl rounded-2xl overflow-hidden p-0">
                    <div className="bg-slate-50 px-6 py-5 border-b border-slate-100 flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-blue-100 flex items-center justify-center border border-blue-200 shrink-0">
                            <span className="material-symbols-outlined text-blue-600 text-2xl">medication</span>
                        </div>
                        <div className="min-w-0">
                            <DialogTitle className="text-xl font-bold text-slate-900 truncate" title={promptItem?.item_name}>{promptItem?.item_name}</DialogTitle>
                            <CardDescription className="text-xs font-medium text-slate-500 mt-1">
                                Batch: <span className="text-slate-700">{promptItem?.batch_number}</span> &bull; Stock: <span className="text-slate-700">{promptItem?.quantity}</span>
                            </CardDescription>
                        </div>
                    </div>
                    {promptItem && (
                        <form onSubmit={confirmAddToCart} className="p-6">
                            <div className="space-y-4">
                                {(promptItem?.units_per_pack || 1) > 1 && (
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest text-[#0ea5e9]">Dispensing Type</Label>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setSellType('pack')}
                                                className={`flex-1 py-2 px-3 rounded-lg border-2 text-xs font-bold transition-all ${sellType === 'pack' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-100 bg-slate-50 text-slate-500'}`}
                                            >
                                                Packs
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setSellType('unit')}
                                                className={`flex-1 py-2 px-3 rounded-lg border-2 text-xs font-bold transition-all ${sellType === 'unit' ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-slate-100 bg-slate-50 text-slate-500'}`}
                                            >
                                                Loose Units
                                            </button>
                                        </div>
                                    </div>
                                )}
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest text-[#0ea5e9]">
                                        Quantity { (promptItem?.units_per_pack || 1) > 1 ? `(${sellType === 'pack' ? 'Packs' : 'Units'})` : '' }
                                    </Label>
                                    <Input
                                        autoFocus
                                        type="number"
                                        step="1"
                                        min="1"
                                        max={sellType === 'pack' ? Math.floor(promptItem?.quantity / (promptItem?.units_per_pack || 1)) : promptItem?.quantity}
                                        value={qtyInput}
                                        onChange={(e) => setQtyInput(e.target.value)}
                                        placeholder="1"
                                        className="bg-white border-slate-200 text-lg font-bold h-12"
                                        required
                                    />
                                    {sellType === 'unit' && (promptItem?.units_per_pack || 1) > 1 && (
                                        <p className="text-[10px] text-slate-500 italic">
                                            1 Pack = {promptItem.units_per_pack} units
                                        </p>
                                    )}
                                </div>
                                <div className="p-3 bg-blue-50/50 rounded-lg flex justify-between items-center border border-blue-100">
                                    <span className="text-sm text-slate-600 font-medium">Total Price:</span>
                                    <span className="text-lg font-bold text-blue-700">
                                        ₹{(() => {
                                            const qty = parseInt(qtyInput) || 0;
                                            const mrp = parseFloat(promptItem?.mrp) || 0;
                                            const upp = promptItem?.units_per_pack || 1;
                                            return (sellType === 'pack' ? (mrp * qty) : (mrp / upp * qty)).toFixed(2);
                                        })()}
                                    </span>
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 pt-6 mt-6 border-t border-slate-100">
                                <Button type="button" variant="ghost" onClick={() => setPromptItem(null)} className="text-slate-500 hover:text-slate-900">
                                    Cancel
                                </Button>
                                <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-6">
                                    Add to Cart
                                </Button>
                            </div>
                        </form>
                    )}
                </DialogContent>
            </Dialog>

            {/* MOBILE SEARCH DIALOG */}
            <Dialog open={isMobileSearchOpen} onOpenChange={setIsMobileSearchOpen}>
                <DialogContent className="sm:max-w-[425px] p-0 overflow-hidden bg-slate-50 border-0 h-[85vh] flex flex-col rounded-t-2xl mt-auto">
                    <div className="p-4 bg-white border-b border-slate-100 flex-shrink-0">
                        <DialogTitle className="text-lg font-bold text-slate-900 mb-3">Search Inventory</DialogTitle>
                        <div className="relative">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                            <input
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all outline-none"
                                placeholder="Search by name or batch..."
                                type="text"
                                autoFocus
                                value={mobileSearchQuery}
                                onChange={e => setMobileSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {clinicInventory.map(item => (
                            <div key={item.id} onClick={() => { addToCart(item); toast({ description: `Added ${item.item_name} to cart`, duration: 1500 }); }} className="bg-white border border-slate-100 p-3 rounded-xl shadow-sm active:scale-[0.98] active:bg-slate-50 transition-all cursor-pointer flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-100 shrink-0">
                                        <span className="material-symbols-outlined text-slate-500 text-[20px]">medication</span>
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="font-bold text-slate-800 text-sm leading-tight truncate">{item.item_name}</h3>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <p className="text-[10px] text-slate-500 font-mono">Batch: {item.batch_number}</p>
                                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-mono">Qty: {item.quantity}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end shrink-0 pl-2">
                                    <span className="text-sm font-bold text-blue-600 mb-1">₹{item.mrp || 0}</span>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); addToCart(item); toast({ description: `Added ${item.item_name} to cart`, duration: 1500 }); }}
                                        className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 active:bg-blue-600 active:text-white transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">add</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                        {clinicInventory.length === 0 && (
                            <div className="py-12 text-center text-slate-400">
                                <span className="material-symbols-outlined text-4xl mb-3 opacity-30">inventory_2</span>
                                <p className="text-sm">No items found.</p>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
