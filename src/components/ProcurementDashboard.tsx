import { useState, useEffect } from 'react';
import { 
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator
} from '@/components/ui/DropdownMenu';
import { Plus, Search, MoreVertical, CheckCircle, Building2, Edit3, Trash2, User, Phone, Mail, PlusCircle, Share2, Printer, IndianRupee, AlertCircle, CheckCircle2, Trash } from 'lucide-react';
import { Button, Input, Label } from '@/components/ui/basic';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ReceiptBranding } from '@/components/ui/ReceiptBranding';
import { useToast } from "@/components/ui/use-toast";
import { dataService as db } from '@/lib/dataService';
import { useHospital } from '@/context/HospitalContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export default function ProcurementDashboard() {
    const { profile, clinics, hospital, pendingPOItem, setPendingPOItem } = useHospital();
    const { toast } = useToast();
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
    const [payments, setPayments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTab, setSelectedTab] = useState('orders');
    const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
    const [supplierPrices, setSupplierPrices] = useState<any[]>([]);
    
    const [isPOModalOpen, setIsPOModalOpen] = useState(false);
    const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [newSupplier, setNewSupplier] = useState({ name: '', contact_person: '', phone: '', email: '', category: '' });
    const [newPO, setNewPO] = useState({ supplier_id: '', clinic_id: profile?.clinic_id || '', items: [] as any[] });
    const [poItems, setPoItems] = useState<{ 
        item_name: string, 
        quantity: number, 
        price: number, 
        units_per_pack: number, 
        mrp: number,
        inventory_item_id?: string 
    }[]>([]);

    const [viewingOrder, setViewingOrder] = useState<any | null>(null);
    const [receiptItems, setReceiptItems] = useState<any[]>([]);
    const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

    useEffect(() => {
        if (pendingPOItem) {
            if (Array.isArray(pendingPOItem)) {
                setPoItems(pendingPOItem.map((item: any) => ({
                    item_name: item.item_name, 
                    quantity: item.threshold || 10, 
                    price: 0,
                    units_per_pack: item.units_per_pack || 1,
                    mrp: item.mrp || 0,
                    inventory_item_id: item.id || item.inventory_item_id
                })));
            } else {
                setPoItems([{ 
                    item_name: pendingPOItem.item_name, 
                    quantity: pendingPOItem.threshold || 10, 
                    price: 0,
                    units_per_pack: pendingPOItem.units_per_pack || 1,
                    mrp: pendingPOItem.mrp || 0,
                    inventory_item_id: pendingPOItem.id || pendingPOItem.inventory_item_id
                }]);
            }
            setIsPOModalOpen(true);
            setPendingPOItem(null); // Clear it
        }
    }, [pendingPOItem, setPendingPOItem]);

    useEffect(() => {
        if (profile?.hospital_id) {
            fetchData();
        }
    }, [profile?.hospital_id]);

    useEffect(() => {
        if (newPO.supplier_id) {
            fetchSupplierPrices(newPO.supplier_id);
        } else {
            setSupplierPrices([]);
        }
    }, [newPO.supplier_id]);

    const fetchSupplierPrices = async (supplierId: string) => {
        try {
            const prices = await db.list('supplier_item_prices', {
                filters: [{ field: 'supplier_id', operator: '==', value: supplierId }]
            });
            setSupplierPrices(prices || []);
        } catch (error) {
            console.error('Error fetching supplier prices:', error);
        }
    };

    const handleItemNameChange = (idx: number, name: string) => {
        const updated = [...poItems];
        updated[idx].item_name = name;
        
        // Auto-fetch price if available
        const matchedPrice = supplierPrices.find(p => p.item_name.toLowerCase() === name.toLowerCase());
        if (matchedPrice) {
            updated[idx].price = matchedPrice.price;
        }
        
        setPoItems(updated);
    };

    async function fetchData() {
        setLoading(true);
        try {
            const [suppliersData, poData, paymentsData] = await Promise.all([
                db.list('suppliers', { filters: { hospital_id: profile?.hospital_id } }),
                db.list('purchase_orders', { 
                    select: '*, suppliers(name)', 
                    filters: { hospital_id: profile?.hospital_id },
                    sort: { column: 'created_at', ascending: false }
                }),
                db.list('supplier_payments', {
                    select: '*, suppliers(name), purchase_orders(order_number)',
                    filters: { hospital_id: profile?.hospital_id },
                    sort: { column: 'payment_date', ascending: false }
                })
            ]);
            setSuppliers(suppliersData || []);
            setPurchaseOrders(poData || []);
            setPayments(paymentsData || []);
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    }

    const handleReceiveOrder = async (orderId: string) => {
        try {
            await db.callRpc('receive_purchase_order', {
                p_order_id: orderId,
                p_received_by: profile?.id
            });
            toast({ title: 'Success', description: 'Order marked as received and inventory updated.' });
            fetchData();
        } catch (error: any) {
            toast({ title: 'Receipt Failed', description: error.message, variant: 'destructive' });
        }
    };

    const handleRecordPayment = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await db.create('supplier_payments', {
                ...newPayment,
                hospital_id: profile?.hospital_id,
                payment_date: new Date().toISOString()
            });
            toast({ title: 'Payment Recorded', description: 'The payment has been successfully logged.' });
            setIsPaymentModalOpen(false);
            fetchData();
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        }
    };

    const handleDeletePO = async (po: any) => {
        if (!window.confirm(`Are you sure you want to delete PO-${po.order_number}? This action is permanent.`)) return;
        
        try {
            await db.remove('purchase_orders', po.id);
            toast({ title: 'Order Deleted', description: `PO #${po.order_number} has been removed.` });
            fetchData();
        } catch (error: any) {
            toast({ title: 'Deletion Failed', description: error.message, variant: 'destructive' });
        }
    };

    const [newPayment, setNewPayment] = useState({
        supplier_id: '',
        purchase_order_id: '',
        amount: 0,
        payment_method: 'Bank Transfer',
        status: 'completed',
        notes: ''
    });

    // Calculate Financial Stats
    const stats = {
        totalOrdered: purchaseOrders.reduce((sum, po) => sum + (po.total_amount || 0), 0),
        totalPaid: payments.reduce((sum, p) => sum + (p.amount || 0), 0),
        pendingBalance: Math.max(0, purchaseOrders.reduce((sum, po) => sum + (po.total_amount || 0), 0) - payments.reduce((sum, p) => sum + (p.amount || 0), 0)),
        activePOs: purchaseOrders.filter(po => po.status !== 'received').length
    };

    const getPOBalance = (poId: string, totalAmount: number) => {
        const poPayments = payments.filter(p => p.purchase_order_id === poId);
        const paidAmount = poPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
        return Math.max(0, totalAmount - paidAmount);
    };

    const handlePayDue = (po: any) => {
        const balance = getPOBalance(po.id, po.total_amount);
        setNewPayment({
            supplier_id: po.supplier_id,
            purchase_order_id: po.id,
            amount: balance,
            payment_method: 'Bank Transfer',
            status: 'completed',
            notes: `Payment for PO-${po.order_number}`
        });
        setIsPaymentModalOpen(true);
    };

    const handleViewReceipt = async (po: any) => {
        setViewingOrder(po);
        setIsReceiptModalOpen(true);
        try {
            const items = await db.list('purchase_order_items', {
                filters: [{ field: 'purchase_order_id', operator: '==', value: po.id }]
            });
            setReceiptItems(items || []);
        } catch (error) {
            console.error('Error fetching PO items:', error);
        }
    };

    const shareWhatsApp = () => {
        if (!viewingOrder) return;
        const destClinic = clinics.find(c => c.id === viewingOrder.clinic_id);
        const itemsList = receiptItems.map(item => `${item.item_name} (x${item.quantity_ordered})`).join(', ');
        const message = `Order Receipt: PO-${viewingOrder.order_number}\n\n` +
            `From Hospital: ${hospital?.name || 'Aarogya Nidhi'}\n` +
            `To Clinic: ${destClinic?.name || 'Main Clinic'}\n` +
            `Address: ${destClinic?.address || 'N/A'}\n\n` +
            `Supplier: ${viewingOrder.suppliers?.name}\n\n` +
            `Items: ${itemsList}\n` +
            `Total Amount: ₹${viewingOrder.total_amount?.toLocaleString()}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
    };

    const shareEmail = () => {
        if (!viewingOrder) return;
        const destClinic = clinics.find(c => c.id === viewingOrder.clinic_id);
        const itemsList = receiptItems.map(item => `${item.item_name} - Qty: ${item.quantity_ordered} - Price: ₹${item.unit_price}`).join('\n');
        const subject = `Purchase Order Receipt: PO-${viewingOrder.order_number} (${hospital?.name || 'Aarogya Nidhi'})`;
        const body = `Purchase Order: PO-${viewingOrder.order_number}\n\n` +
            `Hospital: ${hospital?.name || 'Aarogya Nidhi'}\n` +
            `Delivery to: ${destClinic?.name || 'N/A'}\n` +
            `Address: ${destClinic?.address || 'N/A'}\n\n` +
            `Supplier: ${viewingOrder.suppliers?.name || 'Supplier'}\n\n` +
            `Order Details:\n${itemsList}\n\n` +
            `Total Amount: ₹${viewingOrder.total_amount?.toLocaleString()}\n\n` +
            `Status: ${viewingOrder.status === 'received' ? 'PAID / RECEIVED' : viewingOrder.status.toUpperCase()}`;
        window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    };

    const filteredOrders = purchaseOrders.filter(po => 
        po.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        po.suppliers?.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredSuppliers = suppliers.filter(s => 
        s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredPayments = payments.filter(p => 
        p.suppliers?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.purchase_orders?.order_number?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleCreateSupplier = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await db.create('suppliers', { ...newSupplier, hospital_id: profile?.hospital_id });
            toast({ title: 'Success', description: 'Supplier added successfully' });
            setIsSupplierModalOpen(false);
            setNewSupplier({ name: '', contact_person: '', phone: '', email: '', category: '' });
            fetchData();
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        }
    }

    async function handleCreatePO(e: React.FormEvent) {
        e.preventDefault();
        if (poItems.length === 0) {
            toast({ title: 'Empty Order', description: 'Please add items to the order', variant: 'destructive' });
            return;
        }
        try {
            const total = poItems.reduce((acc, item) => acc + (item.quantity * item.price), 0);
            
            // Generate a simple order number if not handled by DB trigger
            const orderNum = Math.floor(1000 + Math.random() * 9000).toString();

            const po = await db.create('purchase_orders', {
                hospital_id: profile?.hospital_id,
                clinic_id: newPO.clinic_id || profile?.clinic_id,
                supplier_id: newPO.supplier_id,
                total_amount: total,
                status: 'draft',
                order_number: orderNum
            });

            const itemsToInsert = poItems.map(item => ({
                purchase_order_id: po.id,
                item_name: item.item_name,
                inventory_item_id: item.inventory_item_id,
                quantity_ordered: item.quantity,
                unit_price: item.price,
                units_per_pack: item.units_per_pack || 1,
                mrp: item.mrp || 0
            }));

            await db.createMany('purchase_order_items', itemsToInsert);
            
            toast({ title: 'Order Created', description: `PO #${po.order_number} has been created.` });
            setIsPOModalOpen(false);
            setPoItems([]);
            fetchData();
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        }
    }

    if (selectedSupplierId) {
        const supplier = suppliers.find(s => s.id === selectedSupplierId);
        return (
            <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in slide-in-from-right duration-300">
                <header className="flex items-center gap-4">
                    <Button variant="ghost" onClick={() => setSelectedSupplierId(null)} className="p-2">
                        <Plus className="rotate-45" /> Back
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">{supplier?.name}</h1>
                        <p className="text-slate-500">Supplier Details & Price Chart</p>
                    </div>
                </header>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Card className="lg:col-span-1">
                        <CardHeader>
                            <CardTitle>Contact Info</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center gap-3">
                                <User className="text-slate-400" />
                                <span>{supplier?.contact_person}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <Phone className="text-slate-400" />
                                <span>{supplier?.phone}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <Mail className="text-slate-400" />
                                <span>{supplier?.email}</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="lg:col-span-2">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle>Price Chart</CardTitle>
                                <CardDescription>Negotiated items and prices for this supplier.</CardDescription>
                            </div>
                            <div className="flex gap-2">
                                <Input 
                                    type="file" 
                                    className="hidden" 
                                    id="csv-upload" 
                                    accept=".csv"
                                    onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        const reader = new FileReader();
                                        reader.onload = async (event) => {
                                            const text = event.target?.result as string;
                                            const lines = text.split('\n').slice(1); // Skip header
                                            const items = lines.map(line => {
                                                const [name, price] = line.split(',');
                                                return {
                                                    supplier_id: selectedSupplierId,
                                                    item_name: name.trim(),
                                                    price: parseFloat(price.trim())
                                                };
                                            }).filter(item => item.item_name && !isNaN(item.price));

                                            try {
                                                // Bulk delete existing prices for this supplier
                                                await db.removeByFilters('supplier_item_prices', {
                                                    filters: [{ field: 'supplier_id', operator: '==', value: selectedSupplierId }]
                                                });
                                                await db.createMany('supplier_item_prices', items);
                                                toast({ title: 'Success', description: 'Price chart uploaded successfully' });
                                                fetchSupplierPrices(selectedSupplierId);
                                            } catch (err: any) {
                                                toast({ title: 'Upload Failed', description: err.message, variant: 'destructive' });
                                            }
                                        };
                                        reader.readAsText(file);
                                    }}
                                />
                                <Button onClick={() => document.getElementById('csv-upload')?.click()}>
                                    Upload CSV
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Item Name</TableHead>
                                        <TableHead>Price</TableHead>
                                        <TableHead className="w-20">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {supplierPrices.length === 0 ? (
                                        <TableRow><TableCell colSpan={3} className="text-center py-10 text-slate-400">No prices saved yet. Upload a CSV to get started.</TableCell></TableRow>
                                    ) : (
                                        supplierPrices.map(p => (
                                            <TableRow key={p.id}>
                                                <TableCell>{p.item_name}</TableCell>
                                                <TableCell>₹{p.price.toLocaleString()}</TableCell>
                                                <TableCell>
                                                    <Button variant="ghost" size="sm" onClick={async () => {
                                                        await db.remove('supplier_item_prices', p.id);
                                                        fetchSupplierPrices(selectedSupplierId);
                                                    }}>
                                                        <Trash2 className="w-4 h-4 text-red-500" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Procurement</h1>
                    <p className="text-slate-500">Manage supply chain, suppliers, and purchase orders.</p>
                </div>
                <div className="flex gap-2">
                    {/* Dialogs are now triggered by buttons within the Tabs section */}
                </div>
            </header>

            <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <TabsList className="bg-slate-100 p-1 rounded-xl">
                        <TabsTrigger value="orders" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Orders</TabsTrigger>
                        <TabsTrigger value="suppliers" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Suppliers</TabsTrigger>
                        <TabsTrigger value="payments" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Payments</TabsTrigger>
                    </TabsList>
                    
                    <div className="flex items-center gap-2">
                         <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input 
                                placeholder="Search..." 
                                className="pl-9 h-10 w-full md:w-64 bg-white border-slate-200"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        {selectedTab === 'orders' && (
                            <Dialog open={isPOModalOpen} onOpenChange={setIsPOModalOpen}>
                                <DialogTrigger asChild>
                                    <Button className="bg-blue-600 hover:bg-blue-700">
                                        <Plus className="w-4 h-4 mr-2" /> New Order
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-2xl bg-white">
                                    <DialogHeader>
                                        <DialogTitle>Create Purchase Order</DialogTitle>
                                    </DialogHeader>
                                    <form onSubmit={handleCreatePO} className="space-y-4 pt-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Select Supplier</Label>
                                                <select 
                                                    className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                                                    value={newPO.supplier_id}
                                                    onChange={e => setNewPO({ ...newPO, supplier_id: e.target.value })}
                                                    required
                                                >
                                                    <option value="">Choose a supplier...</option>
                                                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                                </select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Destination Clinic</Label>
                                                <select 
                                                    className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                                                    value={newPO.clinic_id}
                                                    onChange={e => setNewPO({ ...newPO, clinic_id: e.target.value })}
                                                    required
                                                >
                                                    <option value="">Select clinic...</option>
                                                    {clinics.filter(c => c.status !== 'paused').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                        
                                        <div className="border border-slate-100 rounded-xl overflow-hidden">
                                            <div className="bg-slate-50 p-3 flex justify-between items-center border-b border-slate-100">
                                                <span className="font-bold text-xs uppercase text-slate-500 tracking-widest">Order Items</span>
                                                <Button type="button" size="sm" variant="outline" onClick={() => setPoItems([...poItems, { item_name: '', quantity: 1, price: 0, units_per_pack: 1, mrp: 0 }])}>Add Item</Button>
                                            </div>
                                            <div className="px-3 py-2 bg-slate-50/50 border-b border-slate-100 grid grid-cols-[1fr,80px,80px,80px,96px,40px] gap-2 items-center text-center">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase text-left ml-1">Item Name</span>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase">Packs</span>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase">Unit/Pk</span>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase">MRP</span>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase">Buy Price</span>
                                                <span></span>
                                            </div>
                                            <div className="p-3 space-y-3 max-h-60 overflow-y-auto">
                                                {poItems.map((item, idx) => (
                                                    <div key={idx} className="flex gap-2">
                                                        <Input 
                                                            placeholder="Item Name" 
                                                            value={item.item_name} 
                                                            onChange={e => handleItemNameChange(idx, e.target.value)} 
                                                            className="flex-1" 
                                                            required 
                                                        />
                                                        <Input type="number" placeholder="Qty" value={item.quantity} onChange={e => {
                                                            const updated = [...poItems];
                                                            updated[idx].quantity = parseInt(e.target.value);
                                                            setPoItems(updated);
                                                        }} className="w-20" required title="Number of packs" />
                                                        
                                                        <Input type="number" placeholder="Units" value={item.units_per_pack} onChange={e => {
                                                            const updated = [...poItems];
                                                            updated[idx].units_per_pack = parseInt(e.target.value);
                                                            setPoItems(updated);
                                                        }} className="w-20" required title="Units per pack (e.g. 10)" />

                                                        <Input type="number" placeholder="MRP" value={item.mrp} onChange={e => {
                                                            const updated = [...poItems];
                                                            updated[idx].mrp = parseFloat(e.target.value);
                                                            setPoItems(updated);
                                                        }} className="w-20" required title="MRP per pack" />

                                                        <Input type="number" placeholder="Price" value={item.price} onChange={e => {
                                                            const updated = [...poItems];
                                                            updated[idx].price = parseFloat(e.target.value);
                                                            setPoItems(updated);
                                                        }} className="w-24" required title="Purchase price per pack" />
                                                        <Button type="button" variant="ghost" className="text-red-500 p-2" onClick={() => setPoItems(poItems.filter((_, i) => i !== idx))}>
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="flex justify-between items-center px-2 py-4 bg-blue-50/50 rounded-lg">
                                            <span className="font-bold text-slate-600">Total Estimated Cost:</span>
                                            <span className="text-xl font-bold text-blue-700">₹{poItems.reduce((acc, item) => acc + (item.quantity * item.price), 0).toLocaleString()}</span>
                                        </div>
                                        <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 h-12">Create Draft Order</Button>
                                    </form>
                                </DialogContent>
                            </Dialog>
                        )}
                        {selectedTab === 'suppliers' && (
                            <Dialog open={isSupplierModalOpen} onOpenChange={setIsSupplierModalOpen}>
                                <DialogTrigger asChild>
                                    <Button className="bg-blue-600 hover:bg-blue-700">
                                        <Plus className="w-4 h-4 mr-2" /> New Supplier
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-md bg-white">
                                    <DialogHeader>
                                        <DialogTitle>Add New Supplier</DialogTitle>
                                    </DialogHeader>
                                    <form onSubmit={handleCreateSupplier} className="space-y-4 pt-4">
                                        <div className="space-y-2">
                                            <Label>Company Name</Label>
                                            <Input required value={newSupplier.name} onChange={e => setNewSupplier({ ...newSupplier, name: e.target.value })} placeholder="e.g. PharmaCorp India" />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Contact Person</Label>
                                                <Input required value={newSupplier.contact_person} onChange={e => setNewSupplier({ ...newSupplier, contact_person: e.target.value })} placeholder="John Doe" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Phone Number</Label>
                                                <Input required value={newSupplier.phone} onChange={e => setNewSupplier({ ...newSupplier, phone: e.target.value })} placeholder="+91 ..." />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Email (Optional)</Label>
                                            <Input type="email" value={newSupplier.email} onChange={e => setNewSupplier({ ...newSupplier, email: e.target.value })} placeholder="sales@pharma.com" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Category</Label>
                                            <Input value={newSupplier.category} onChange={e => setNewSupplier({ ...newSupplier, category: e.target.value })} placeholder="e.g. Surgical Equipment, Medicines" />
                                        </div>
                                        <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 h-12 font-bold shadow-lg shadow-blue-600/20">Register Supplier</Button>
                                    </form>
                                </DialogContent>
                            </Dialog>
                        )}
                        {selectedTab === 'payments' && (
                            <Button 
                                className="bg-blue-600 hover:bg-blue-700"
                                onClick={() => {
                                    setNewPayment({ supplier_id: '', purchase_order_id: '', amount: 0, payment_method: 'Bank Transfer', status: 'completed', notes: '' });
                                    setIsPaymentModalOpen(true);
                                }}
                            >
                                <Plus className="w-4 h-4 mr-2" /> Record Payment
                            </Button>
                        )}
                    </div>
                </div>

                <TabsContent value="orders" className="space-y-4">
                    <Card className="border-slate-200 shadow-sm overflow-hidden">
                        <CardHeader className="bg-white border-b border-slate-100">
                            <CardTitle>Recent Orders</CardTitle>
                            <CardDescription>Monitor and track supply chain inventory intake.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader className="bg-slate-50">
                                    <TableRow>
                                        <TableHead>Order #</TableHead>
                                        <TableHead>Supplier</TableHead>
                                        <TableHead>Total Amount</TableHead>
                                        <TableHead>Balance Due</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        <TableRow><TableCell colSpan={6} className="text-center py-10 text-slate-400">Loading orders...</TableCell></TableRow>
                                    ) : filteredOrders.length === 0 ? (
                                        <TableRow><TableCell colSpan={6} className="text-center py-10">No matching orders found.</TableCell></TableRow>
                                    ) : (
                                        filteredOrders.map(po => (
                                            <TableRow key={po.id} className="hover:bg-slate-50 transition-colors">
                                                <TableCell 
                                                    className="font-bold text-blue-600 cursor-pointer hover:underline"
                                                    onClick={() => handleViewReceipt(po)}
                                                >
                                                    PO-{po.order_number}
                                                </TableCell>
                                                <TableCell>{po.suppliers?.name}</TableCell>
                                                <TableCell className="font-bold">₹{po.total_amount?.toLocaleString()}</TableCell>
                                                <TableCell>
                                                    {getPOBalance(po.id, po.total_amount) === 0 ? (
                                                        <span className="text-emerald-600 font-bold flex items-center gap-1">
                                                            <CheckCircle2 className="w-3 h-3" /> Settled
                                                        </span>
                                                    ) : (
                                                        <span className="text-red-600 font-bold">
                                                            ₹{getPOBalance(po.id, po.total_amount).toLocaleString()}
                                                        </span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                                                        po.status === 'received' ? 'bg-emerald-100 text-emerald-700' :
                                                        po.status === 'sent' ? 'bg-blue-100 text-blue-700' :
                                                        po.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                                                        'bg-slate-100 text-slate-600'
                                                    }`}>
                                                        {po.status === 'received' ? 'RECEIVED' : po.status}
                                                    </span>
                                                </TableCell>
                                                <TableCell>{new Date(po.created_at).toLocaleDateString()}</TableCell>
                                                <TableCell className="text-right space-x-2">
                                                    {getPOBalance(po.id, po.total_amount) > 0 && (
                                                        <Button 
                                                            variant="outline" 
                                                            size="sm"
                                                            onClick={() => handlePayDue(po)}
                                                            className="h-8 border-blue-200 text-blue-700 hover:bg-blue-50"
                                                        >
                                                            <IndianRupee className="w-4 h-4 mr-1" />
                                                            Pay Due
                                                        </Button>
                                                    )}
                                                    {po.status !== 'received' && (
                                                        <Button 
                                                            variant="outline" 
                                                            size="sm"
                                                            onClick={() => handleReceiveOrder(po.id)}
                                                            className="h-8 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                                                        >
                                                            <CheckCircle className="w-4 h-4 mr-1" />
                                                            Receive
                                                        </Button>
                                                    )}
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="sm" className="h-8 text-slate-400">
                                                                <MoreVertical className="w-4 h-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="bg-white">
                                                            <DropdownMenuItem onClick={() => handleViewReceipt(po)}>
                                                                <Printer className="w-4 h-4 mr-2" /> View/Print Receipt
                                                            </DropdownMenuItem>
                                                            {po.status !== 'received' && (
                                                                <DropdownMenuItem onClick={() => handleReceiveOrder(po.id)} className="text-emerald-600">
                                                                    <CheckCircle className="w-4 h-4 mr-2" /> Mark as Received
                                                                </DropdownMenuItem>
                                                            )}
                                                            {(profile?.role === 'HOSPITAL_ADMIN' || profile?.role === 'SUPER_ADMIN' || profile?.role === 'OWNER') && (
                                                                <>
                                                                    <DropdownMenuSeparator />
                                                                    <DropdownMenuItem 
                                                                        onClick={() => handleDeletePO(po)}
                                                                        className="text-red-600 focus:text-red-600"
                                                                    >
                                                                        <Trash className="w-4 h-4 mr-2" /> Delete Order
                                                                    </DropdownMenuItem>
                                                                </>
                                                            )}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="suppliers" className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredSuppliers.map(s => (
                            <Card 
                                key={s.id} 
                                className="hover:border-blue-300 transition-colors shadow-sm bg-white overflow-hidden group cursor-pointer"
                                onClick={() => setSelectedSupplierId(s.id)}
                            >
                                <CardHeader className="pb-3 bg-slate-50/50">
                                    <div className="flex justify-between items-start">
                                        <div className="h-12 w-12 bg-white rounded-xl flex items-center justify-center shadow-sm border border-slate-100 group-hover:scale-110 transition-transform">
                                            <Building2 className="w-6 h-6 text-blue-600" />
                                        </div>
                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={(e) => {
                                            e.stopPropagation();
                                            // TODO: Edit functionality
                                        }}>
                                            <Edit3 className="w-4 h-4 text-slate-400" />
                                        </Button>
                                    </div>
                                    <CardTitle className="mt-4 text-lg">{s.name}</CardTitle>
                                    <CardDescription className="font-medium text-blue-600/70">{s.category || 'Vendor'}</CardDescription>
                                </CardHeader>
                                <CardContent className="pt-4">
                                    <div className="space-y-3 text-sm">
                                        <div className="flex items-center gap-3 text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100/50">
                                            <User className="w-4 h-4 text-slate-400" />
                                            <span className="font-medium">{s.contact_person}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-slate-600">
                                            <Phone className="w-4 h-4 text-slate-400" />
                                            {s.phone}
                                        </div>
                                        <div className="flex items-center gap-3 text-slate-600">
                                            <Mail className="w-4 h-4 text-slate-400" />
                                            <span className="truncate">{s.email}</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                        <Dialog open={isSupplierModalOpen} onOpenChange={setIsSupplierModalOpen}>
                            <DialogTrigger asChild>
                                <button className="border-2 border-dashed border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center gap-3 text-slate-400 hover:border-blue-400 hover:text-blue-500 transition-all group min-h-[220px] bg-slate-50/30">
                                    <PlusCircle className="w-12 h-12 group-hover:scale-110 transition-transform opacity-30" />
                                    <span className="font-bold text-sm">Register New Supplier</span>
                                </button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-md bg-white">
                                <DialogHeader>
                                    <DialogTitle>Add New Supplier</DialogTitle>
                                </DialogHeader>
                                <form onSubmit={handleCreateSupplier} className="space-y-4 pt-4">
                                    <div className="space-y-2">
                                        <Label>Company Name</Label>
                                        <Input required value={newSupplier.name} onChange={e => setNewSupplier({ ...newSupplier, name: e.target.value })} placeholder="e.g. PharmaCorp India" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Contact Person</Label>
                                            <Input required value={newSupplier.contact_person} onChange={e => setNewSupplier({ ...newSupplier, contact_person: e.target.value })} placeholder="John Doe" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Phone Number</Label>
                                            <Input required value={newSupplier.phone} onChange={e => setNewSupplier({ ...newSupplier, phone: e.target.value })} placeholder="+91 ..." />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Email (Optional)</Label>
                                        <Input type="email" value={newSupplier.email} onChange={e => setNewSupplier({ ...newSupplier, email: e.target.value })} placeholder="sales@pharma.com" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Category</Label>
                                        <Input value={newSupplier.category} onChange={e => setNewSupplier({ ...newSupplier, category: e.target.value })} placeholder="e.g. Surgical Equipment, Medicines" />
                                    </div>
                                    <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 h-12 font-bold shadow-lg shadow-blue-600/20">Register Supplier</Button>
                                </form>
                            </DialogContent>
                        </Dialog>
                    </div>
                </TabsContent>

                <TabsContent value="payments" className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4">
                            <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                                <IndianRupee className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Procurement</p>
                                <p className="text-xl font-bold text-slate-800">₹{stats.totalOrdered.toLocaleString()}</p>
                            </div>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4">
                            <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                                <CheckCircle2 className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Amount Paid</p>
                                <p className="text-xl font-bold text-emerald-600">₹{stats.totalPaid.toLocaleString()}</p>
                            </div>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4">
                            <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center text-red-600">
                                <AlertCircle className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Outstanding Dues</p>
                                <p className="text-xl font-bold text-red-600">₹{stats.pendingBalance.toLocaleString()}</p>
                            </div>
                        </div>
                    </div>

                     <Card className="border-slate-200 shadow-sm overflow-hidden">
                        <CardHeader className="bg-white border-b border-slate-100">
                            <CardTitle>Supplier Payments</CardTitle>
                            <CardDescription>Track pending dues and payment history.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader className="bg-slate-50">
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Supplier</TableHead>
                                        <TableHead>Related PO</TableHead>
                                        <TableHead>Amount</TableHead>
                                        <TableHead>Method</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        <TableRow><TableCell colSpan={6} className="text-center py-10 text-slate-400">Loading payments...</TableCell></TableRow>
                                    ) : filteredPayments.length === 0 ? (
                                        <TableRow><TableCell colSpan={6} className="text-center py-10">No matching payments found.</TableCell></TableRow>
                                    ) : (
                                        filteredPayments.map(pmt => (
                                            <TableRow key={pmt.id} className="hover:bg-slate-50 transition-colors">
                                                <TableCell>{new Date(pmt.payment_date).toLocaleDateString()}</TableCell>
                                                <TableCell>{pmt.suppliers?.name}</TableCell>
                                                <TableCell className="text-blue-600 font-medium">
                                                    {pmt.purchase_orders?.order_number ? `PO-${pmt.purchase_orders.order_number}` : '-'}
                                                </TableCell>
                                                <TableCell className="font-bold">₹{pmt.amount?.toLocaleString()}</TableCell>
                                                <TableCell>{pmt.payment_method}</TableCell>
                                                <TableCell>
                                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                                                        pmt.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                                                        pmt.status === 'pending' ? 'bg-orange-100 text-orange-700' :
                                                        'bg-red-100 text-red-700'
                                                    }`}>
                                                        {pmt.status === 'completed' ? 'PAID' : pmt.status}
                                                    </span>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
                <DialogContent className="sm:max-w-md bg-white">
                    <DialogHeader>
                        <DialogTitle>Record Supplier Payment</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleRecordPayment} className="space-y-4 pt-4">
                        <div className="space-y-2">
                            <Label>Supplier</Label>
                            <select 
                                className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                                value={newPayment.supplier_id}
                                onChange={e => setNewPayment({ ...newPayment, supplier_id: e.target.value })}
                                required
                            >
                                <option value="">Select a supplier...</option>
                                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label>Related Purchase Order (Optional)</Label>
                            <select 
                                className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                                value={newPayment.purchase_order_id}
                                onChange={e => setNewPayment({ ...newPayment, purchase_order_id: e.target.value })}
                            >
                                <option value="">None</option>
                                {purchaseOrders.map(po => <option key={po.id} value={po.id}>PO-{po.order_number} ({po.suppliers?.name})</option>)}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Amount</Label>
                                <Input 
                                    type="number" 
                                    required 
                                    value={newPayment.amount} 
                                    onChange={e => setNewPayment({ ...newPayment, amount: parseFloat(e.target.value) || 0 })} 
                                    placeholder="e.g. 5000" 
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Payment Method</Label>
                                <select 
                                    className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                                    value={newPayment.payment_method}
                                    onChange={e => setNewPayment({ ...newPayment, payment_method: e.target.value })}
                                    required
                                >
                                    <option value="Bank Transfer">Bank Transfer</option>
                                    <option value="Cash">Cash</option>
                                    <option value="Cheque">Cheque</option>
                                    <option value="UPI">UPI</option>
                                </select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Notes (Optional)</Label>
                            <Input value={newPayment.notes} onChange={e => setNewPayment({ ...newPayment, notes: e.target.value })} placeholder="Any specific details about the payment" />
                        </div>
                        <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 h-12 font-bold shadow-lg shadow-blue-600/20">Record Payment</Button>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={isReceiptModalOpen} onOpenChange={setIsReceiptModalOpen}>
                <DialogContent className="sm:max-w-xl bg-white p-0 overflow-hidden rounded-2xl border-none shadow-2xl">
                    <div className="bg-blue-600 p-6 text-white">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="text-2xl font-bold">Order Receipt</h3>
                                <p className="text-blue-100 opacity-80">PO-{viewingOrder?.order_number}</p>
                            </div>
                            <div className="bg-white/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider backdrop-blur-sm">
                                {viewingOrder?.status === 'received' ? 'RECEIVED' : viewingOrder?.status}
                            </div>
                        </div>
                    </div>
                    
                    <div className="p-8 space-y-6">
                        <div className="flex justify-between border-b border-slate-100 pb-4">
                            <div className="space-y-1">
                                <p className="text-slate-400 font-medium uppercase tracking-tighter text-[10px]">Hospital / Organization</p>
                                <p className="font-bold text-slate-800 text-lg leading-tight">{hospital?.name}</p>
                                {hospital?.registration_number && (
                                    <p className="text-[10px] text-slate-500 font-mono italic">Reg: {hospital.registration_number}</p>
                                )}
                            </div>
                            <div className="text-right space-y-1">
                                <p className="text-slate-400 font-medium uppercase tracking-tighter text-[10px]">Date Issued</p>
                                <p className="font-bold text-slate-800">{viewingOrder ? new Date(viewingOrder.created_at).toLocaleDateString() : '-'}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-2">
                            <div className="space-y-1">
                                <p className="text-slate-400 font-medium uppercase tracking-tighter text-[10px]">Destination Clinic</p>
                                {(() => {
                                    const destClinic = clinics.find(c => c.id === viewingOrder?.clinic_id);
                                    return (
                                        <>
                                            <p className="font-bold text-blue-700">{destClinic?.name || 'Main Centre'}</p>
                                            <p className="text-xs text-slate-500 leading-relaxed font-medium">
                                                {destClinic?.address || 'Hospital Campus Address'}
                                            </p>
                                            {destClinic?.settings?.gst_number && (
                                                <p className="text-[10px] text-slate-400 mt-1">GSTIN: {destClinic.settings.gst_number}</p>
                                            )}
                                        </>
                                    );
                                })()}
                            </div>
                            <div className="space-y-1 md:text-right">
                                <p className="text-slate-400 font-medium uppercase tracking-tighter text-[10px]">Supplier Detail</p>
                                <p className="font-bold text-slate-800 underline decoration-blue-200 underline-offset-4">{viewingOrder?.suppliers?.name}</p>
                                <p className="text-xs text-slate-500">Inventory Supply Partner</p>
                            </div>
                        </div>

                        <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                            <Table>
                                <TableHeader className="bg-slate-50/50">
                                    <TableRow>
                                        <TableHead className="text-[10px] font-bold uppercase text-slate-400">Item</TableHead>
                                        <TableHead className="text-[10px] font-bold uppercase text-slate-400 text-center">Packs</TableHead>
                                        <TableHead className="text-[10px] font-bold uppercase text-slate-400 text-center">Units/Pk</TableHead>
                                        <TableHead className="text-[10px] font-bold uppercase text-slate-400 text-right">MRP</TableHead>
                                        <TableHead className="text-[10px] font-bold uppercase text-slate-400 text-right">Price</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {receiptItems.map((item, i) => (
                                        <TableRow key={i}>
                                            <TableCell className="font-medium text-slate-700">{item.item_name}</TableCell>
                                            <TableCell className="text-center text-slate-600">{item.quantity_ordered}</TableCell>
                                            <TableCell className="text-center text-slate-500 font-mono text-[10px]">{item.units_per_pack || 1}</TableCell>
                                            <TableCell className="text-right text-slate-600">₹{item.mrp?.toLocaleString() || '0'}</TableCell>
                                            <TableCell className="text-right font-bold text-slate-800">₹{item.unit_price?.toLocaleString()}</TableCell>
                                        </TableRow>
                                    ))}
                                    <TableRow className="bg-slate-50/30 border-t-2 border-slate-50">
                                        <TableCell colSpan={4} className="font-bold text-slate-900 border-none">Total Amount</TableCell>
                                        <TableCell className="text-right font-black text-blue-600 text-lg border-none">₹{viewingOrder?.total_amount?.toLocaleString()}</TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-4">
                            <Button 
                                onClick={shareWhatsApp}
                                className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold h-12 rounded-xl flex items-center justify-center gap-2"
                            >
                                <Share2 className="w-5 h-5" />
                                WhatsApp
                            </Button>
                            <Button 
                                onClick={shareEmail}
                                variant="outline"
                                className="border-slate-200 text-slate-700 font-bold h-12 rounded-xl flex items-center justify-center gap-2 hover:bg-slate-50"
                            >
                                <Mail className="w-5 h-5" />
                                Email
                            </Button>
                        </div>
                        
                        <Button 
                            variant="ghost" 
                            className="w-full text-slate-400 text-xs font-medium hover:text-slate-600"
                            onClick={() => window.print()}
                        >
                            <Printer className="w-3 h-3 mr-2" />
                            Print this receipt
                        </Button>

                        <ReceiptBranding />
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
