import { useState, useMemo, useRef, useEffect } from 'react'
import { dataService as db } from '@/lib/dataService'
import * as XLSX from 'xlsx'
import { Button, Input, Label } from '@/components/ui/basic'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { useHospital } from '@/context/HospitalContext'
import { MapPin } from 'lucide-react'

interface InventoryDashboardProps {
    clinicIdOverride?: string;
}

export function InventoryDashboard({ clinicIdOverride }: InventoryDashboardProps) {
    const { inventory, profile: userProfile, clinics, refreshData, hospital, updateInventoryItem, billing, pendingRestockId, setPendingRestockId } = useHospital()
    const { toast } = useToast()
    const [loading, setLoading] = useState(false)
    const [syncing, setSyncing] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [filterClinicId, setFilterClinicId] = useState('all')
    const [editingItem, setEditingItem] = useState<any>(null)
    const [restockItem, setRestockItem] = useState<any>(null)
    const [filterType, setFilterType] = useState<'all' | 'low' | 'expired'>('all')
    const [isFullScreen, setIsFullScreen] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Effective Clinic: Override > Profile Clinic > Null (All)
    const effectiveClinicId = clinicIdOverride || userProfile?.clinic_id

    // Check if user has permission to edit inventory
    const canEditInventory = ['ADMIN', 'HOSPITAL_ADMIN', 'SUPER_ADMIN', 'OWNER'].includes(userProfile?.role || '');

    // Handle pending restock from notifications
    useEffect(() => {
        if (pendingRestockId && inventory.length > 0) {
            const item = inventory.find(i => i.id === pendingRestockId);
            if (item) {
                setRestockItem(item);
                // Clear the pending ID so it doesn't re-open
                setPendingRestockId(null);
            }
        }
    }, [pendingRestockId, inventory, setPendingRestockId]);

    const now = new Date();

    const filteredInventory = useMemo(() => {
        return inventory.filter(i => {
            const matchesClinicOverride = effectiveClinicId ? i.clinic_id === effectiveClinicId : true;
            const matchesDropdownFilter = filterClinicId !== 'all' ? i.clinic_id === filterClinicId : true;
            const matchesSearch = i.item_name.toLowerCase().includes(searchQuery.toLowerCase()) || i.batch_number.toLowerCase().includes(searchQuery.toLowerCase());

            let matchesType = true;
            const threshold = i.threshold || hospital?.settings?.global_low_stock_threshold || 10;
            if (filterType === 'low') matchesType = i.quantity < threshold;
            if (filterType === 'expired') matchesType = new Date(i.expiry_date) < now;

            return matchesClinicOverride && matchesDropdownFilter && matchesSearch && matchesType;
        });
    }, [inventory, effectiveClinicId, filterClinicId, searchQuery, filterType]);

    const lowStockCount = inventory.filter(i => {
        const threshold = i.threshold || hospital?.settings?.global_low_stock_threshold || 10;
        return (effectiveClinicId ? i.clinic_id === effectiveClinicId : true) && i.quantity < threshold;
    }).length;
    const expiredCount = inventory.filter(i => (effectiveClinicId ? i.clinic_id === effectiveClinicId : true) && new Date(i.expiry_date) < now).length;

    const getIconInfo = (itemName: string) => {
        const lower = itemName.toLowerCase();
        if (lower.includes('glove') || lower.includes('mask') || lower.includes('syringe') || lower.includes('kit')) {
            return { icon: 'medical_services', color: 'bg-emerald-50 text-emerald-600' };
        }
        if (lower.includes('fluid') || lower.includes('saline') || lower.includes('vaccine') || lower.includes('ampoule')) {
            return { icon: 'vaccines', color: 'bg-blue-50 text-blue-600' };
        }
        return { icon: 'medication', color: 'bg-purple-50 text-purple-600' };
    };

    async function handleRestock(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        if (!effectiveClinicId && userProfile?.role !== 'ADMIN' && userProfile?.role !== 'HOSPITAL_ADMIN' && userProfile?.role !== 'SUPER_ADMIN' && userProfile?.role !== 'OWNER') return

        setLoading(true)
        const formData = new FormData(e.currentTarget)
        const item_name = formData.get('item_name') as string
        const quantity = parseInt(formData.get('quantity') as string)
        const batch_number = formData.get('batch_number') as string
        const expiry_date = formData.get('expiry_date') as string

        const targetClinicId = effectiveClinicId || formData.get('clinic_id')
        const mrp = parseFloat(formData.get('mrp') as string) || 0

        if (!targetClinicId) {
            toast({ title: 'Error', description: 'Clinic ID required', variant: 'destructive' })
            setLoading(false)
            return
        }

        try {
            const existingItems = inventory.filter(i =>
                i.clinic_id === targetClinicId &&
                i.item_name.toLowerCase() === item_name.toLowerCase() &&
                i.batch_number.toLowerCase() === batch_number.toLowerCase() &&
                i.expiry_date === expiry_date
            );

            if (existingItems.length > 0) {
                // Update existing
                const existingItem = existingItems[0];
                await updateInventoryItem(existingItem.id, {
                    quantity: existingItem.quantity + quantity
                });
                toast({ title: 'Success', description: `Added ${quantity} to existing stock batch.` });
            } else {
                if (billing?.isAtLimit('inventory_items')) {
                    toast({
                        title: 'Limit Reached',
                        description: `Your current plan allows a maximum of ${billing?.getLimit('inventory_items')} inventory items. Please upgrade to add more unique items.`,
                        variant: 'destructive'
                    });
                    setLoading(false);
                    return;
                }

                // Insert new
                await db.create('inventory', {
                    clinic_id: targetClinicId,
                    hospital_id: hospital?.id || userProfile?.hospital_id,
                    item_name,
                    quantity: quantity,
                    mrp: mrp,
                    batch_number,
                    expiry_date,
                    threshold: hospital?.settings?.global_low_stock_threshold || 20 // Default to global threshold
                });
                toast({ title: 'Success', description: 'New stock batch added successfully' });
            }

            (e.target as HTMLFormElement).reset()
            refreshData()

            if (restockItem) {
                setRestockItem(null)
            }
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' })
        } finally {
            setLoading(false)
        }
    }

    async function handleEditSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        if (!editingItem) return

        setLoading(true)
        const formData = new FormData(e.currentTarget)
        const updates = {
            item_name: formData.get('item_name') as string,
            batch_number: formData.get('batch_number') as string,
            expiry_date: formData.get('expiry_date') as string,
            mrp: parseFloat(formData.get('mrp') as string) || 0,
            quantity: parseInt(formData.get('quantity') as string) || 0,
            threshold: parseInt(formData.get('threshold') as string) || hospital?.settings?.global_low_stock_threshold || 10
        }

        try {
            await updateInventoryItem(editingItem.id, updates)
            toast({ title: 'Success', description: 'Item updated successfully.' })
            setEditingItem(null)
        } catch (error: any) {
            toast({ title: 'Error', description: error.message || 'Failed to update item.', variant: 'destructive' })
        } finally {
            setLoading(false)
        }
    }

    const handleExportList = () => {
        if (filteredInventory.length === 0) {
            toast({ title: 'Notice', description: 'No items to export based on current filters.', variant: 'default' });
            return;
        }

        const headers = ['Item Name', 'Clinic', 'Batch Number', 'Expiry Date', 'MRP', 'Stock Level', 'Threshold'];
        const csvRows = [];

        csvRows.push(headers.join(','));

        for (const item of filteredInventory) {
            const clinicName = clinics.find(c => c.id === item.clinic_id)?.name || 'Unknown';
            const row = [
                `"${item.item_name}"`, // Quote strings to handle commas
                `"${clinicName}"`,
                `"${item.batch_number || ''}"`,
                item.expiry_date,
                item.mrp || 0,
                item.quantity,
                item.threshold || 10
            ];
            csvRows.push(row.join(','));
        }

        const csvContent = "data:text/csv;charset=utf-8," + csvRows.join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `inventory_export_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link); // Required for FF

        link.click();

        document.body.removeChild(link);
    }

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (!effectiveClinicId && userProfile?.role !== 'ADMIN' && userProfile?.role !== 'HOSPITAL_ADMIN' && userProfile?.role !== 'SUPER_ADMIN' && userProfile?.role !== 'OWNER') {
            toast({ title: 'Error', description: 'You do not have permission to perform this action.', variant: 'destructive' })
            return
        }

        // Use default logic to determine which clinic to insert into if a global admin uploads
        // Alternatively, prompt user. For simplicity, we require them to select a clinic filter first if global.
        let targetClinicId = effectiveClinicId
        if (!targetClinicId && filterClinicId !== 'all') {
            targetClinicId = filterClinicId
        }

        if (!targetClinicId) {
            toast({ title: 'Error', description: 'Please select a specific clinic from the dropdown first to import data.', variant: 'destructive' })
            return
        }

        setLoading(true)
        const targetHospitalId = hospital?.id || userProfile?.hospital_id

        try {
            const data = await file.arrayBuffer()
            const workbook = XLSX.read(data)

            // Assume data is in the first sheet
            const sheetName = workbook.SheetNames[0]
            const worksheet = workbook.Sheets[sheetName]

            // Convert to JSON array of objects securely mapping fields
            const jsonData = XLSX.utils.sheet_to_json<any>(worksheet)

            if (jsonData.length === 0) {
                throw new Error("The uploaded file is empty or formatted incorrectly.")
            }

            const insertPayloads = jsonData.map(row => {
                const cleanRow: any = {};
                Object.keys(row).forEach(key => {
                    // Remove quotes, BOM, spaces, and lowercase the key for bulletproof matching
                    const cleanKey = key.replace(/["\uFEFF]/g, '').trim().toLowerCase().replace(/\s+/g, '_');
                    let cleanValue = row[key];
                    if (typeof cleanValue === 'string') {
                        cleanValue = cleanValue.replace(/^"|"$/g, '').trim();
                    }
                    cleanRow[cleanKey] = cleanValue;
                });

                // Helper to safely parse excel dates if they come as numbers
                let expiryDate = new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0];
                const rawExpiry = cleanRow['expiry_date'] || cleanRow['expiry'] || cleanRow['expiration'];
                if (rawExpiry) {
                    if (typeof rawExpiry === 'number') {
                        // Excel serial date
                        expiryDate = new Date(Math.round((rawExpiry - 25569) * 86400 * 1000)).toISOString().split('T')[0];
                    } else {
                        const parsed = new Date(rawExpiry);
                        if (!isNaN(parsed.getTime())) expiryDate = parsed.toISOString().split('T')[0];
                    }
                }

                return {
                    clinic_id: targetClinicId,
                    hospital_id: targetHospitalId,
                    item_name: cleanRow['item_name'] || cleanRow['item'] || cleanRow['name'] || cleanRow['product'] || 'Unknown Item',
                    quantity: parseInt(cleanRow['quantity'] || cleanRow['stock_level'] || cleanRow['stock'] || cleanRow['qty'] || '0') || 0,
                    mrp: parseFloat(cleanRow['mrp'] || cleanRow['price'] || cleanRow['unit_price'] || '0') || 0,
                    batch_number: (cleanRow['batch_number'] || cleanRow['batch_no'] || cleanRow['batch'] || '').toString(),
                    expiry_date: expiryDate,
                    threshold: parseInt(cleanRow['threshold'] || cleanRow['min_stock'] || cleanRow['alert_level'] || cleanRow['minimum'] || '10') || 10
                }
            })

            const remaining = billing?.getRemainingQuota?.('inventory_items') ?? Infinity;
            if (insertPayloads.length > remaining) {
                toast({
                    title: 'Upload Failed',
                    description: `This file contains ${insertPayloads.length} items, but your plan only allows ${remaining} more. Please reduce the list or upgrade your plan.`,
                    variant: 'destructive'
                });
                setLoading(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
                return;
            }

            await db.createMany('inventory', insertPayloads)

            toast({ title: 'Success', description: `Successfully imported ${insertPayloads.length} items to inventory.`, variant: 'default' })
            refreshData()

        } catch (error: any) {
            toast({ title: 'Import Failed', description: error.message || 'There was an error parsing the spreadsheet.', variant: 'destructive' })
        } finally {
            setLoading(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    const handleSync = async () => {
        setSyncing(true)
        try {
            await refreshData()
            toast({
                title: "Database Synced",
                description: "Inventory records have been successfully updated.",
                variant: "default"
            })
        } catch (error) {
            toast({
                title: "Sync Failed",
                description: "Failed to update records. Please check your connection.",
                variant: "destructive"
            })
        } finally {
            setSyncing(false)
        }
    }

    const handleRemoveExpired = async () => {
        const expiredItems = inventory.filter(i => {
            const matchesClinicOverride = effectiveClinicId ? i.clinic_id === effectiveClinicId : true;
            return matchesClinicOverride && new Date(i.expiry_date) < now;
        });

        if (expiredItems.length === 0) {
            toast({ title: 'No Expired Items', description: 'There are no expired items to remove.', variant: 'default' });
            return;
        }

        if (!confirm(`Are you sure you want to permanently remove ${expiredItems.length} expired items? This action cannot be undone.`)) {
            return;
        }

        setLoading(true);
        try {
            await Promise.all(expiredItems.map(item => db.remove('inventory', item.id)));
            toast({
                title: 'Success',
                description: `Successfully removed ${expiredItems.length} expired items.`,
                variant: 'default'
            });
            await refreshData();
        } catch (error: any) {
            toast({
                title: 'Error',
                description: error.message || 'Failed to remove some items.',
                variant: 'destructive'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={isFullScreen
            ? "fixed inset-0 z-50 bg-slate-50 p-4 sm:p-6 lg:p-8 flex flex-col animate-in zoom-in-95 duration-200 overflow-hidden"
            : "space-y-6 animate-in fade-in duration-500 max-w-[1600px] mx-auto min-h-[calc(100vh-120px)] flex flex-col pb-10 lg:pb-0"
        }>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-200/60 pb-8 shrink-0">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-200">
                            <span className="material-symbols-outlined text-[20px]">inventory_2</span>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Stock Management</h2>
                            <p className="text-sm text-slate-500 font-medium">Monitoring and tracking medical supplies</p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    {!effectiveClinicId && (
                        <select
                            className="p-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[200px]"
                            value={filterClinicId}
                            onChange={(e) => setFilterClinicId(e.target.value)}
                        >
                            <option value="all">All Clinics Stock</option>
                            {clinics.map(c => (
                                <option key={c.id} value={c.id} disabled={c.status === 'paused'}>
                                    {c.name} {c.status === 'paused' ? '(Paused)' : ''}
                                </option>
                            ))}
                        </select>
                    )}
                    <button
                        onClick={handleSync}
                        disabled={syncing}
                        className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors bg-white shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        <span className={`material-symbols-outlined text-[20px] ${syncing ? 'animate-spin' : ''}`}>sync</span>
                        {syncing ? 'Syncing...' : 'Sync DB'}
                    </button>

                    {canEditInventory && (
                        <>
                            <input
                                type="file"
                                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                                className="hidden"
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                            />

                            <button onClick={() => fileInputRef.current?.click()} disabled={loading} className="flex items-center gap-2 px-4 py-2 border border-slate-200 bg-white text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm whitespace-nowrap hidden sm:flex disabled:opacity-50">
                                {loading ? <span className="material-symbols-outlined text-[20px] animate-spin">sync</span> : <span className="material-symbols-outlined text-[20px]">upload_file</span>}
                                Import Spreadsheet
                            </button>
                        </>
                    )}

                    <button onClick={handleExportList} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm whitespace-nowrap hidden sm:flex">
                        <span className="material-symbols-outlined text-[20px]">file_download</span>
                        Export List
                    </button>
                </div>
            </div>

            {/* MAIN DESKTOP LAYOUT W/ SPLIT COLUMNS */}
            <div className="flex flex-col lg:flex-row bg-white border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden flex-1 min-h-[500px]">

                {/* LEFT LIST SECTION (70%) */}
                <div className="flex-1 flex flex-col overflow-hidden border-b lg:border-b-0 lg:border-r border-slate-100">
                    <header className="px-6 py-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center gap-4 justify-between bg-slate-50/30 shrink-0">
                        <div className="flex flex-wrap items-center gap-3">
                            <button
                                onClick={() => setFilterType('low')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold border transition-colors ${filterType === 'low' ? 'bg-orange-100 border-orange-200 text-orange-800' : 'bg-orange-50 text-orange-700 border-orange-100 hover:bg-orange-100'}`}>
                                <span className="material-symbols-outlined text-[18px]">warning</span>
                                LOW STOCK ({lowStockCount})
                            </button>
                            <button
                                onClick={() => setFilterType('expired')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold border transition-colors ${filterType === 'expired' ? 'bg-red-100 border-red-200 text-red-800' : 'bg-red-50 text-red-700 border-red-100 hover:bg-red-100'}`}>
                                <span className="material-symbols-outlined text-[18px]">event_busy</span>
                                EXPIRED ({expiredCount})
                            </button>
                            <div className="hidden sm:block h-4 w-px bg-slate-300 mx-1"></div>
                            <button
                                onClick={() => setFilterType('all')}
                                className={`px-4 py-2 rounded-full text-xs font-bold transition-colors ${filterType === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-transparent'}`}>
                                ALL ITEMS
                            </button>
                            <button
                                onClick={() => setIsFullScreen(!isFullScreen)}
                                className="hidden sm:flex items-center gap-1 px-3 py-2 rounded-full text-xs font-bold transition-colors bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 ml-2 shadow-sm">
                                <span className="material-symbols-outlined text-[16px]">{isFullScreen ? 'fullscreen_exit' : 'fullscreen'}</span>
                                {isFullScreen ? 'COLLAPSE' : 'EXPAND TABLE'}
                            </button>
                            {canEditInventory && expiredCount > 0 && (
                                <button
                                    onClick={handleRemoveExpired}
                                    disabled={loading}
                                    className="flex items-center gap-1 px-4 py-2 rounded-full text-xs font-bold transition-all bg-red-600 text-white hover:bg-red-700 border border-red-700 shadow-sm ml-2 disabled:opacity-50"
                                >
                                    <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
                                    REMOVE EXPIRED
                                </button>
                            )}
                        </div>
                        <div className="relative w-full sm:w-64">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl">search</span>
                            <input
                                className="w-full bg-white border border-slate-200 rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm"
                                placeholder="Search by name or batch..."
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </header>

                    <div className="flex-1 overflow-x-auto overflow-y-auto">
                        <table className="w-full text-left border-collapse min-w-[800px]">
                            <thead className="bg-white sticky top-0 border-b border-slate-100 z-10 shadow-sm">
                                <tr>
                                    <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest bg-white">Item Name</th>
                                    {!effectiveClinicId && <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest bg-white">Store</th>}
                                    <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest bg-white">Batch No</th>
                                    <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest bg-white">Expiry</th>
                                    <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest bg-white">Stock Level</th>
                                    {canEditInventory && <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest bg-white text-right">Actions</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filteredInventory.length === 0 ? (
                                    <tr>
                                        <td colSpan={(effectiveClinicId ? 4 : 5) + (canEditInventory ? 1 : 0)} className="px-6 py-12 text-center text-slate-400 bg-slate-50/50">
                                            <div className="flex flex-col items-center">
                                                <span className="material-symbols-outlined text-4xl mb-2 opacity-50">inventory_2</span>
                                                <p>No inventory items match your current filters.</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredInventory.map(item => {
                                        const { icon, color } = getIconInfo(item.item_name);
                                        const threshold = item.threshold || hospital?.settings?.global_low_stock_threshold || 10;
                                        const isLow = item.quantity < threshold;
                                        const isExpired = new Date(item.expiry_date) < now;
                                        const pct = Math.min(100, Math.max(5, (item.quantity / (item.threshold * 2 || 100)) * 100));

                                        return (
                                            <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3 w-max">
                                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color} shrink-0`}>
                                                            <span className="material-symbols-outlined text-[20px]">{icon}</span>
                                                        </div>
                                                        <div className="min-w-[150px]">
                                                            <p className="font-bold text-sm text-slate-900 line-clamp-2">{item.item_name}</p>
                                                            <p className="text-[11px] text-slate-500 font-medium mt-0.5">MRP: ₹{item.mrp?.toFixed(2) || '0.00'}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                {!effectiveClinicId && (
                                                    <td className="px-6 py-4 text-xs font-medium text-slate-600">
                                                        <div className="flex items-center gap-1 bg-slate-100 w-fit px-2 py-1 rounded whitespace-nowrap">
                                                            <MapPin className="w-3 h-3 text-slate-400" />
                                                            {clinics.find(c => c.id === item.clinic_id)?.name || 'Unknown'}
                                                        </div>
                                                    </td>
                                                )}
                                                <td className="px-6 py-4 text-xs font-mono font-medium text-slate-600 bg-slate-50/50 whitespace-nowrap">
                                                    {item.batch_number || 'N/A'}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full whitespace-nowrap ${isExpired ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-slate-100 text-slate-600 border border-transparent'
                                                        }`}>
                                                        Exp: {new Date(item.expiry_date).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3 w-32">
                                                        <span className={`font-bold text-sm w-8 shrink-0 ${isLow ? 'text-orange-600' : 'text-slate-900'}`}>
                                                            {item.quantity < 10 ? `0${item.quantity}` : item.quantity}
                                                        </span>
                                                        <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden shrink-0">
                                                            <div className={`h-full rounded-full ${isLow ? 'bg-orange-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }}></div>
                                                        </div>
                                                    </div>
                                                </td>
                                                {canEditInventory && (
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex justify-end gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={() => setRestockItem(item)}
                                                                className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors" title="Restock Item">
                                                                <span className="material-symbols-outlined text-[20px]">add_shopping_cart</span>
                                                            </button>
                                                            <button
                                                                onClick={() => setEditingItem(item)}
                                                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Edit Item">
                                                                <span className="material-symbols-outlined text-[20px]">edit_square</span>
                                                            </button>
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-white shrink-0">
                        <p className="text-xs text-slate-500 font-medium tracking-wide">Showing {filteredInventory.length} items available</p>
                        <div className="flex gap-2">
                            <button className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
                                <span className="material-symbols-outlined text-sm">chevron_left</span>
                            </button>
                            <button className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors">
                                <span className="material-symbols-outlined text-sm">chevron_right</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* RIGHT SIDEBAR SECTION (30%) */}
                {!isFullScreen && (
                    <div className="w-full lg:w-[380px] xl:w-[420px] bg-slate-50/30 p-6 lg:p-8 overflow-y-auto shrink-0 flex flex-col border-t lg:border-t-0 border-slate-100 relative">
                        {canEditInventory && (
                            <div className="mb-10 lg:sticky lg:top-0 h-fit pb-4 z-10">
                                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-6 tracking-tight">
                                    <span className="material-symbols-outlined text-blue-600 p-1.5 bg-blue-100 rounded-lg">add_box</span>
                                    Quick Stock Entry
                                </h2>

                                <form onSubmit={handleRestock} className="space-y-5 bg-white p-5 rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-slate-100">
                                    {!effectiveClinicId && (
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Target Clinic Location*</label>
                                            <div className="relative">
                                                <select name="clinic_id" className="w-full bg-slate-50 border-slate-200 rounded-lg pl-10 pr-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all shadow-sm appearance-none" required>
                                                    <option value="">Select Clinic</option>
                                                    {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                                </select>
                                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg pointer-events-none">domain</span>
                                                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">expand_more</span>
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Item Reference Name</label>
                                        <div className="relative">
                                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">medical_information</span>
                                            <input name="item_name" required className="w-full bg-slate-50 border-slate-200 rounded-lg pl-10 pr-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all shadow-sm" placeholder="e.g. Saline Bottle 1L" type="text" />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Qty Added</label>
                                            <div className="relative">
                                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">format_list_numbered</span>
                                                <input name="quantity" required min="1" className="w-full bg-slate-50 border-slate-200 rounded-lg pl-9 pr-3 py-2.5 text-sm font-bold font-mono text-slate-700 focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all shadow-sm" placeholder="0" type="number" />
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Unit MRP (₹)</label>
                                            <div className="relative">
                                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">currency_rupee</span>
                                                <input name="mrp" required step="0.01" min="0" className="w-full bg-slate-50 border-slate-200 rounded-lg pl-9 pr-3 py-2.5 text-sm font-bold font-mono text-slate-700 focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all shadow-sm" placeholder="0.00" type="number" />
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Batch #</label>
                                            <input name="batch_number" required className="w-full bg-slate-50 border-slate-200 rounded-lg px-3 py-2.5 text-xs font-mono font-medium focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all shadow-sm" placeholder="E.g. B-012" type="text" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Expiry Date</label>
                                            <input name="expiry_date" required className="w-full bg-slate-50 border-slate-200 rounded-lg px-3 py-2.5 text-xs font-medium focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all shadow-sm" type="date" />
                                        </div>
                                    </div>

                                    <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-blue-500/20 hover:bg-blue-700 hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-70 disabled:hover:translate-y-0 text-sm">
                                        {loading ? <span className="material-symbols-outlined animate-spin text-xl">sync</span> : <span className="material-symbols-outlined text-xl">inventory_2</span>}
                                        {loading ? 'Adding Stock...' : 'Commit to Inventory'}
                                    </button>
                                </form>
                            </div>
                        )}

                        <div className={`pt-6 ${canEditInventory ? 'border-t border-slate-100' : ''} flex-1`}>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xs font-bold text-slate-900 flex items-center gap-2 uppercase tracking-widest">
                                    <span className="material-symbols-outlined text-slate-400 text-[18px]">history</span>
                                    Critical Notices
                                </h3>
                            </div>
                            <div className="space-y-3">
                                {filteredInventory.slice(0, 3).filter(item => {
                                    const threshold = item.threshold || hospital?.settings?.global_low_stock_threshold || 10;
                                    return item.quantity < threshold;
                                }).map(item => (
                                    <div key={'alert-' + item.id} className="flex items-start gap-3 p-3 rounded-xl border border-orange-100 bg-orange-50/30">
                                        <div className="w-2 h-2 rounded-full bg-orange-400 mt-1.5 shrink-0 animate-pulse"></div>
                                        <div className="min-w-0">
                                            <p className="text-[13px] font-bold text-slate-800 leading-tight">Stock Minimum Threshold: {item.item_name}</p>
                                            <p className="text-[10px] text-slate-500 mt-1 uppercase font-medium">Only {item.quantity} units left • Action Reqd</p>
                                        </div>
                                    </div>
                                ))}
                                {filteredInventory.filter(i => i.quantity < (i.threshold || 10)).length === 0 && (
                                    <div className="text-center py-6 px-4 bg-white rounded-xl border border-slate-100 border-dashed">
                                        <span className="material-symbols-outlined text-3xl text-emerald-200 mb-2">inventory</span>
                                        <p className="text-xs font-medium text-slate-500">All inventory items are currently above their minimum thresholds.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* RESTOCK ITEM MODAL */}
            <Dialog open={!!restockItem} onOpenChange={(open) => !open && setRestockItem(null)}>
                <DialogContent className="sm:max-w-md bg-white text-slate-900 border border-slate-200 shadow-2xl rounded-2xl p-0 overflow-hidden">
                    <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center gap-3">
                        <div className="w-10 h-10 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-emerald-600">add_shopping_cart</span>
                        </div>
                        <div>
                            <DialogTitle className="text-lg font-bold text-slate-900 tracking-tight">Restock Item</DialogTitle>
                            <p className="text-xs text-slate-500 mt-0.5">Add inventory for <span className="font-bold text-slate-700">{restockItem?.item_name}</span></p>
                        </div>
                    </div>

                    {restockItem && (
                        <form onSubmit={handleRestock} className="p-6 space-y-4">
                            <input type="hidden" name="item_name" value={restockItem.item_name} />
                            <input type="hidden" name="mrp" value={restockItem.mrp || 0} />
                            <input type="hidden" name="clinic_id" value={restockItem.clinic_id} />

                            <div className="grid grid-cols-1 gap-4">
                                <div className="space-y-1">
                                    <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest text-[#0ea5e9]">Quantity to Add</Label>
                                    <Input name="quantity" type="number" min="1" placeholder="0" className="bg-slate-50 border-slate-200 font-mono font-bold text-slate-900 h-10" required />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Batch Number</Label>
                                    <Input name="batch_number" placeholder="Enter batch number" className="bg-white border-slate-200 font-mono text-sm h-10" required />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Expiry Date</Label>
                                    <Input name="expiry_date" type="date" className="bg-white border-slate-200 text-sm h-10" required />
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 pt-6 border-t border-slate-100 mt-6">
                                <Button type="button" variant="outline" onClick={() => setRestockItem(null)} className="border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 bg-white">
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-md">
                                    {loading ? 'Adding...' : 'Add to Inventory'}
                                </Button>
                            </div>
                        </form>
                    )}
                </DialogContent>
            </Dialog>

            {/* EDIT ITEM MODAL */}
            <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
                <DialogContent className="sm:max-w-md bg-white text-slate-900 border border-slate-200 shadow-2xl rounded-2xl p-0 overflow-hidden">
                    <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center gap-3">
                        <div className="w-10 h-10 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-blue-600">edit_document</span>
                        </div>
                        <div>
                            <DialogTitle className="text-lg font-bold text-slate-900 tracking-tight">Edit Inventory Record</DialogTitle>
                            <p className="text-xs text-slate-500 mt-0.5">Modify stock counts and item details manually</p>
                        </div>
                    </div>

                    {editingItem && (
                        <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
                            <div className="space-y-1">
                                <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Item Reference Name</Label>
                                <Input name="item_name" defaultValue={editingItem.item_name} className="bg-white border-slate-200 focus:ring-blue-600 h-10" required />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Batch Number</Label>
                                    <Input name="batch_number" defaultValue={editingItem.batch_number} className="bg-white border-slate-200 font-mono text-sm h-10" required />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Expiry Date</Label>
                                    <Input name="expiry_date" type="date" defaultValue={editingItem.expiry_date} className="bg-white border-slate-200 text-sm h-10" required />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4 border-t border-slate-100 pt-5 mt-5">
                                <div className="space-y-1">
                                    <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest text-[#0ea5e9]">Stock Level</Label>
                                    <Input name="quantity" type="number" defaultValue={editingItem.quantity} className="bg-slate-50 border-slate-200 font-mono font-bold text-slate-900 h-10" required />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest text-orange-600" title="Trigger low stock warning">Min Alert</Label>
                                    <Input name="threshold" type="number" min="0" defaultValue={editingItem.threshold || 20} className="bg-slate-50 border-slate-200 font-mono font-bold text-slate-900 h-10" required />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">MRP (₹)</Label>
                                    <Input name="mrp" type="number" step="0.01" defaultValue={editingItem.mrp || 0} className="bg-slate-50 border-slate-200 font-mono font-bold text-slate-900 h-10" required />
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 pt-6 border-t border-slate-100 mt-6">
                                <Button type="button" variant="outline" onClick={() => setEditingItem(null)} className="border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 bg-white">
                                    Cancel Changes
                                </Button>
                                <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white shadow-md">
                                    {loading ? 'Committing...' : 'Commit Edit to System'}
                                </Button>
                            </div>
                        </form>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
