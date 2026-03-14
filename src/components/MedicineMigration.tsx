import { useState, useMemo } from 'react';
import { useHospital } from '@/context/HospitalContext';
import { dataService as db } from '@/lib/dataService';
import { Button, Input, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/basic';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useToast } from '@/components/ui/use-toast';

interface MedicineMigrationProps {
    onBack: () => void;
}

export function MedicineMigration({ onBack }: MedicineMigrationProps) {
    const { profile, clinics, inventory, refreshData } = useHospital();
    const { toast } = useToast();

    const [sourceClinicId, setSourceClinicId] = useState<string>('');
    const [destClinicId, setDestClinicId] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedItems, setSelectedItems] = useState<Map<string, number>>(new Map());
    const [migrating, setMigrating] = useState(false);

    const activeClinics = useMemo(() => clinics.filter(c => c.status !== 'paused'), [clinics]);

    const sourceInventory = useMemo(() => {
        if (!sourceClinicId) return [];
        return inventory.filter(item => item.clinic_id === sourceClinicId && item.quantity > 0);
    }, [inventory, sourceClinicId]);

    const filteredItems = useMemo(() => {
        if (!searchTerm) return sourceInventory;
        const query = searchTerm.toLowerCase();
        return sourceInventory.filter(item => 
            item.item_name.toLowerCase().includes(query) || 
            item.id.toLowerCase().includes(query)
        );
    }, [sourceInventory, searchTerm]);

    const handleQuantityChange = (itemId: string, qty: number, max: number) => {
        const newSelected = new Map(selectedItems);
        if (qty <= 0) {
            newSelected.delete(itemId);
        } else {
            newSelected.set(itemId, Math.min(qty, max));
        }
        setSelectedItems(newSelected);
    };

    const handleMigration = async () => {
        if (!sourceClinicId || !destClinicId) {
            toast({ title: 'Error', description: 'Please select both source and destination clinics.', variant: 'destructive' });
            return;
        }

        if (sourceClinicId === destClinicId) {
            toast({ title: 'Error', description: 'Source and destination clinics must be different.', variant: 'destructive' });
            return;
        }

        if (selectedItems.size === 0) {
            toast({ title: 'Error', description: 'Please select at least one medicine to migrate.', variant: 'destructive' });
            return;
        }

        setMigrating(true);
        try {
            const migrationPromise = Array.from(selectedItems.entries()).map(async ([itemId, qty]) => {
                const item = inventory.find(i => i.id === itemId);
                if (!item) return;

                // 1. Decrement source
                await db.update('inventory', itemId, {
                    quantity: item.quantity - qty
                });

                // 2. Increment/Create destination
                const destItems = inventory.filter(i => 
                    i.clinic_id === destClinicId && 
                    i.item_name === item.item_name &&
                    i.mrp === item.mrp &&
                    i.expiry_date === item.expiry_date &&
                    i.batch_number === item.batch_number
                );

                if (destItems.length > 0) {
                    await db.update('inventory', destItems[0].id, {
                        quantity: destItems[0].quantity + qty
                    });
                } else {
                    await db.create('inventory', {
                        item_name: item.item_name,
                        batch_number: item.batch_number,
                        quantity: qty,
                        mrp: item.mrp,
                        threshold: item.threshold || 10,
                        expiry_date: item.expiry_date,
                        clinic_id: destClinicId,
                        hospital_id: item.hospital_id,
                        is_active: true
                    });
                }

                // 3. Log event
                await db.create('audit_logs', {
                    action: 'MEDICINE_MIGRATION',
                    status: 'INFO',
                    details: `Migrated ${qty} units of ${item.item_name} from ${clinics.find(c => c.id === sourceClinicId)?.name} to ${clinics.find(c => c.id === destClinicId)?.name}`,
                    performed_by: profile?.id,
                    hospital_id: profile?.hospital_id
                });
            });

            await Promise.all(migrationPromise);
            await refreshData();

            toast({ 
                title: 'Success', 
                description: `Successfully migrated ${selectedItems.size} medicine types.`,
                className: "bg-emerald-50 text-emerald-800 border-emerald-100"
            });
            
            setSelectedItems(new Map());
            onBack();
        } catch (error) {
            console.error('Migration error:', error);
            toast({ title: 'Error', description: 'Failed to perform migration. Please try again.', variant: 'destructive' });
        } finally {
            setMigrating(false);
        }
    };

    return (
        <div className="p-6 md:p-8 space-y-8 animate-in fade-in duration-500 max-w-[1200px] mx-auto bg-slate-50/50 min-h-screen">
            <div className="flex items-center justify-between gap-4 sticky top-0 bg-white/80 backdrop-blur-sm p-4 rounded-2xl shadow-sm z-20 border border-slate-100">
                <div className="flex items-center gap-4">
                    <Button 
                        variant="ghost" 
                        onClick={onBack}
                        className="p-2 hover:bg-slate-100 rounded-xl transition-all"
                    >
                        <span className="material-symbols-outlined text-slate-600">arrow_back</span>
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Medicine Migration</h1>
                        <p className="text-sm text-slate-500 font-medium">Transfer stock between clinic facilities</p>
                    </div>
                </div>
                <Button 
                    onClick={handleMigration} 
                    disabled={migrating || selectedItems.size === 0}
                    className="bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-200 px-6 py-6 rounded-xl font-bold transition-all disabled:opacity-50"
                >
                    {migrating ? (
                        <>
                            <span className="material-symbols-outlined animate-spin mr-2">sync</span>
                            Migrating...
                        </>
                    ) : (
                        <>
                            <span className="material-symbols-outlined mr-2">swap_horiz</span>
                            Execute Migration ({selectedItems.size})
                        </>
                    )}
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Clinic Selection & Stats */}
                <div className="lg:col-span-1 space-y-6">
                    <Card className="border-none shadow-xl shadow-slate-200/50 rounded-3xl bg-white overflow-hidden">
                        <CardHeader className="bg-slate-900 text-white p-6">
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <span className="material-symbols-outlined text-blue-400">location_on</span>
                                facility Selection
                            </CardTitle>
                            <CardDescription className="text-slate-400 font-medium">Select source and target clinics</CardDescription>
                        </CardHeader>
                        <CardContent className="p-6 space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Source Clinic</label>
                                <Select onValueChange={setSourceClinicId} value={sourceClinicId}>
                                    <SelectTrigger className="w-full h-12 rounded-xl border-slate-200 bg-slate-50/50 hover:bg-white transition-all">
                                        <SelectValue placeholder="Select Source Facility" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                                        {activeClinics.map(clinic => (
                                            <SelectItem key={clinic.id} value={clinic.id} className="rounded-lg">
                                                {clinic.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex justify-center -my-3 relative z-10">
                                <div className="bg-white p-1 rounded-full shadow-md border border-slate-100">
                                    <div className="bg-slate-100 p-2 rounded-full">
                                        <span className="material-symbols-outlined text-slate-400 rotate-90 scale-75">swap_horiz</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Destination Clinic</label>
                                <Select onValueChange={setDestClinicId} value={destClinicId}>
                                    <SelectTrigger className="w-full h-12 rounded-xl border-slate-200 bg-slate-50/50 hover:bg-white transition-all">
                                        <SelectValue placeholder="Select Destination Facility" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                                        {activeClinics.map(clinic => (
                                            <SelectItem 
                                                key={clinic.id} 
                                                value={clinic.id} 
                                                disabled={clinic.id === sourceClinicId}
                                                className="rounded-lg"
                                            >
                                                {clinic.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {selectedItems.size > 0 && (
                                <div className="pt-6 border-t border-slate-100">
                                    <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
                                        <h4 className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-2">Migration Summary</h4>
                                        <p className="text-sm text-blue-600 font-medium">You are about to transfer {selectedItems.size} medicine types to {clinics.find(c => c.id === destClinicId)?.name}.</p>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <div className="bg-emerald-50 border border-emerald-100 rounded-3xl p-6 transition-all hover:shadow-lg hover:shadow-emerald-100/50">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                                <span className="material-symbols-outlined">verified</span>
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-emerald-900">Safe Transfer</h3>
                                <p className="text-xs text-emerald-600 font-medium">All migrations are audited and stock levels are updated instantly.</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Medicine Selection */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="border-none shadow-xl shadow-slate-200/50 rounded-3xl bg-white overflow-hidden flex flex-col h-[700px]">
                        <CardHeader className="p-6 border-b border-slate-100 bg-white sticky top-0 z-10">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <CardTitle className="text-xl">Select Medicines</CardTitle>
                                    <CardDescription className="text-slate-500 font-medium italic">Showing stock from {clinics.find(c => c.id === sourceClinicId)?.name || 'Source Clinic'}</CardDescription>
                                </div>
                                <div className="relative w-full md:w-64">
                                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 scale-90">search</span>
                                    <Input 
                                        placeholder="Search inventory..." 
                                        className="pl-10 h-10 rounded-xl border-slate-200 bg-slate-50 focus:bg-white focus:ring-slate-400 transition-all text-sm font-medium"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        disabled={!sourceClinicId}
                                    />
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0 overflow-y-auto flex-1">
                            {!sourceClinicId ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 p-12 text-center">
                                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                        <span className="material-symbols-outlined text-4xl opacity-50">inventory_2</span>
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-900 mb-1">Source Clinic Not Selected</h3>
                                    <p className="max-w-xs text-sm font-medium">Please select a source clinic facility to view its available inventory for migration.</p>
                                </div>
                            ) : filteredItems.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 p-12 text-center">
                                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                        <span className="material-symbols-outlined text-4xl opacity-50">search_off</span>
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-900 mb-1">No Matches Found</h3>
                                    <p className="max-w-xs text-sm font-medium">Try adjusting your search terms or verify the clinic has stock items.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100">
                                    {filteredItems.map(item => (
                                        <div key={item.id} className="p-4 hover:bg-slate-50/80 transition-all flex items-center justify-between group">
                                            <div className="flex-1 min-w-0 pr-4">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h4 className="font-bold text-slate-900 truncate">{item.item_name}</h4>
                                                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-[10px] font-bold text-slate-500 border border-slate-200">
                                                        {item.expiry_date}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-3 text-xs font-medium">
                                                    <span className="text-slate-500">Batch: <b className="text-slate-900">{item.batch_number || 'N/A'}</b></span>
                                                    <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                                    <span className="text-slate-500">Available: <b className="text-slate-900">{item.quantity} units</b></span>
                                                    <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                                    <span className="text-slate-500">MRP: <b className="text-slate-900">₹{item.mrp}</b></span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200 group-hover:bg-white transition-all">
                                                    <button 
                                                        onClick={() => handleQuantityChange(item.id, (selectedItems.get(item.id) || 0) - 1, item.quantity)}
                                                        className="p-1 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
                                                    >
                                                        <span className="material-symbols-outlined scale-75">remove</span>
                                                    </button>
                                                    <Input 
                                                        type="number" 
                                                        className="w-16 h-8 text-center bg-transparent border-none text-sm font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none p-0"
                                                        value={selectedItems.get(item.id) || ''}
                                                        onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value) || 0, item.quantity)}
                                                        placeholder="0"
                                                    />
                                                    <button 
                                                        onClick={() => handleQuantityChange(item.id, (selectedItems.get(item.id) || 0) + 1, item.quantity)}
                                                        className="p-1 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
                                                    >
                                                        <span className="material-symbols-outlined scale-75">add</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
