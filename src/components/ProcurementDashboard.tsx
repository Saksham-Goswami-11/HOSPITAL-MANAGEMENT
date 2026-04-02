import { useState, useEffect } from 'react';
import { 
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator
} from '@/components/ui/DropdownMenu';
import { Plus, Search, MoreVertical, CheckCircle, Building2, Edit3, Trash2, User, Phone, Mail, PlusCircle, Printer, IndianRupee, AlertCircle, CheckCircle2, Trash, History, FileText } from 'lucide-react';
import { Button, Input, Label } from '@/components/ui/basic';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from "@/components/ui/use-toast";
import { dataService as db } from '@/lib/dataService';
import { supabase } from '@/lib/supabase';
import { useHospital } from '@/context/HospitalContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { TaxInvoice, TaxInvoiceControls } from './TaxInvoice';

const INDIAN_STATES = [
    { name: "Andaman and Nicobar Islands", code: "35" },
    { name: "Andhra Pradesh", code: "37" },
    { name: "Arunachal Pradesh", code: "12" },
    { name: "Assam", code: "18" },
    { name: "Bihar", code: "10" },
    { name: "Chandigarh", code: "04" },
    { name: "Chhattisgarh", code: "22" },
    { name: "Dadra and Nagar Haveli and Daman and Diu", code: "26" },
    { name: "Delhi", code: "07" },
    { name: "Goa", code: "30" },
    { name: "Gujarat", code: "24" },
    { name: "Haryana", code: "06" },
    { name: "Himachal Pradesh", code: "02" },
    { name: "Jammu and Kashmir", code: "01" },
    { name: "Jharkhand", code: "20" },
    { name: "Karnataka", code: "29" },
    { name: "Kerala", code: "32" },
    { name: "Ladakh", code: "38" },
    { name: "Lakshadweep", code: "31" },
    { name: "Madhya Pradesh", code: "23" },
    { name: "Maharashtra", code: "27" },
    { name: "Manipur", code: "14" },
    { name: "Meghalaya", code: "17" },
    { name: "Mizoram", code: "15" },
    { name: "Nagaland", code: "13" },
    { name: "Odisha", code: "21" },
    { name: "Puducherry", code: "34" },
    { name: "Punjab", code: "03" },
    { name: "Rajasthan", code: "08" },
    { name: "Sikkim", code: "11" },
    { name: "Tamil Nadu", code: "33" },
    { name: "Telangana", code: "36" },
    { name: "Tripura", code: "16" },
    { name: "Uttar Pradesh", code: "09" },
    { name: "Uttarakhand", code: "05" },
    { name: "West Bengal", code: "19" }
];

import { numberToWords } from '@/lib/utils';

export default function ProcurementDashboard() {
    const { profile, clinics, hospital, pendingPOItem, setPendingPOItem } = useHospital();
    const { toast } = useToast();
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
    const [payments, setPayments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [creditNotes, setCreditNotes] = useState<any[]>([]);
    const [isEditingCreditLimit, setIsEditingCreditLimit] = useState(false);
    const [editCreditLimitValue, setEditCreditLimitValue] = useState(0);

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTab, setSelectedTab] = useState('orders');
    const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
    const [supplierPrices, setSupplierPrices] = useState<any[]>([]);
    
    const [isPOModalOpen, setIsPOModalOpen] = useState(false);
    const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
    const [newSupplier, setNewSupplier] = useState({ 
        name: '', 
        contact_person: '', 
        phone: '', 
        email: '', 
        category: '',
        credit_limit: 0,
        bank_name: '',
        account_number: '',
        ifsc_code: '',
        branch_name: '',
        billing_address: '',
        shipping_address: '',
        state_code: '',
        state_name: '',
        gst_number: ''
    });
    const [isEditingSupplier, setIsEditingSupplier] = useState(false);
    const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
    const [newPO, setNewPO] = useState({ 
        supplier_id: '', 
        clinic_id: profile?.clinic_id || '', 
        is_b2b: true,
        place_of_supply: '',
        state_name: '',
        state_code: '',
        payment_mode: 'cash' as 'cash' | 'credit',
        advance_paid: 0,
        eway_bill_number: '',
        irn_number: '',
        items: [] as any[] 
    });
    const [poItems, setPoItems] = useState<{ 
        item_name: string, 
        quantity: number, 
        price: number, 
        units_per_pack: number, 
        mrp: number,
        hsn_code: string,
        gst_rate: number,
        discount_percent: number,
        inventory_item_id?: string 
    }[]>([]);

    const [viewingOrder, setViewingOrder] = useState<any | null>(null);
    const [receiptItems, setReceiptItems] = useState<any[]>([]);
    const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
    const [newNote, setNewNote] = useState({
        type: 'credit' as 'credit' | 'debit',
        amount: 0,
        reason: '',
        reference_po_id: '',
        state_name: '',
        state_code: ''
    });

    useEffect(() => {
        if (pendingPOItem) {
            if (Array.isArray(pendingPOItem)) {
                setPoItems(pendingPOItem.map((item: any) => ({
                    item_name: item.item_name, 
                    quantity: item.threshold || 10, 
                    price: 0,
                    units_per_pack: item.units_per_pack || 1,
                    mrp: item.mrp || 0,
                    hsn_code: '',
                    gst_rate: 18, // Default GST rate
                    discount_percent: 0,
                    inventory_item_id: item.id || item.inventory_item_id
                })));
            } else {
                setPoItems([{ 
                    item_name: pendingPOItem.item_name, 
                    quantity: pendingPOItem.threshold || 10, 
                    price: 0,
                    units_per_pack: pendingPOItem.units_per_pack || 1,
                    mrp: pendingPOItem.mrp || 0,
                    hsn_code: '',
                    gst_rate: 18,
                    discount_percent: 0,
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
        if (selectedSupplierId) {
            fetchSupplierPrices(selectedSupplierId);
            fetchSupplierNotes(selectedSupplierId);
        } else {
            setSupplierPrices([]);
            setCreditNotes([]);
        }
    }, [selectedSupplierId]);

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

    const fetchSupplierNotes = async (supplierId: string) => {
        try {
            const notes = await db.list('credit_debit_notes', {
                filters: [{ field: 'supplier_id', operator: '==', value: supplierId }],
                sort: { column: 'created_at', ascending: false }
            });
            setCreditNotes(notes || []);
        } catch (error) {
            console.error('Error fetching credit notes:', error);
        }
    };

    const handleSupplierChange = (supplierId: string) => {
        const supplier = suppliers.find(s => s.id === supplierId);
        if (supplier) {
            const matchedStateName = INDIAN_STATES.find(s => s.code === supplier.state_code)?.name || '';
            setNewPO({ 
                ...newPO, 
                supplier_id: supplierId,
                place_of_supply: supplier.billing_address || '',
                state_name: matchedStateName,
                state_code: supplier.state_code || ''
            });
            setSelectedSupplierId(supplierId);
        } else {
            setNewPO({ ...newPO, supplier_id: '' });
            setSelectedSupplierId(null);
        }
    };

    const handleSupplierStateChoice = (stateName: string) => {
        const state = INDIAN_STATES.find(s => s.name === stateName);
        setNewSupplier({
            ...newSupplier,
            state_name: stateName,
            state_code: state ? state.code : ''
        });
    };

    const handleStateChoice = (stateName: string) => {
        const state = INDIAN_STATES.find(s => s.name === stateName);
        setNewPO({
            ...newPO,
            state_name: stateName,
            state_code: state ? state.code : ''
        });
    };

    const handleItemNameChange = async (idx: number, name: string) => {
        const updatedItems = [...poItems];
        updatedItems[idx].item_name = name;
        setPoItems(updatedItems);

        if (!name || name.length < 2) return;

        try {
            // Check supplier prices first
            const matchedPrice = supplierPrices.find(p => p.item_name.toLowerCase() === name.toLowerCase());
            if (matchedPrice) {
                setPoItems(prev => {
                    if (prev[idx]?.item_name !== name) return prev;
                    return prev.map((item, i) => i === idx ? {
                        ...item,
                        price: matchedPrice.price || item.price,
                        hsn_code: matchedPrice.hsn_code || item.hsn_code,
                        gst_rate: matchedPrice.gst_rate || item.gst_rate
                    } : item);
                });
                return;
            }

            // Fallback to inventory or global history
            const { data: previous } = await supabase
                .from('purchase_order_items')
                .select('hsn_code, gst_rate, unit_price')
                .ilike('item_name', name)
                .order('created_at', { ascending: false })
                .limit(1);

            if (previous && previous.length > 0) {
                setPoItems(prev => {
                    if (prev[idx]?.item_name !== name) return prev;
                    return prev.map((item, i) => i === idx ? {
                        ...item,
                        price: previous[0].unit_price || item.price,
                        hsn_code: previous[0].hsn_code || item.hsn_code,
                        gst_rate: previous[0].gst_rate || item.gst_rate
                    } : item);
                });
            }
        } catch (error) {
            console.error('Error in background auto-fill:', error);
        }
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

            // NOTE: DB trigger `handle_payment_financials` automatically updates suppliers.current_credit

            toast({ title: 'Payment Recorded', description: 'The payment has been successfully logged.' });
            setIsPaymentModalOpen(false);
            fetchData();
            if (selectedSupplierId) fetchSupplierNotes(selectedSupplierId);
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        }
    };

    const handleRecordNote = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSupplierId) return;
        
        try {
            await db.create('credit_debit_notes', {
                ...newNote,
                hospital_id: profile?.hospital_id,
                supplier_id: selectedSupplierId
            });

            // NOTE: DB trigger `update_supplier_credit` automatically updates suppliers.current_credit

            toast({ title: 'Note Recorded', description: `Successfully added ${newNote.type} note and updated credit balance.` });
            setIsNoteModalOpen(false);
            setNewNote({ 
                type: 'credit', 
                amount: 0, 
                reason: '', 
                reference_po_id: '',
                state_name: '',
                state_code: ''
            });
            fetchData();
            if (selectedSupplierId) fetchSupplierNotes(selectedSupplierId);
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        }
    };

    const handleCancelPO = async (po: any) => {
        const reason = window.prompt("Please enter the reason for cancellation:");
        if (reason === null) return;
        
        try {
            await db.update('purchase_orders', po.id, {
                status: 'cancelled',
                cancellation_reason: reason,
                cancelled_at: new Date().toISOString()
            });
            toast({ title: 'Order Cancelled', description: `PO #${po.order_number} has been cancelled.` });
            fetchData();
        } catch (error: any) {
            toast({ title: 'Cancellation Failed', description: error.message, variant: 'destructive' });
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
    const stats = (() => {
        const totalOrdered = purchaseOrders.reduce((sum, po) => sum + (po.total_amount || 0), 0);
        const recordedPayments = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
        const advancesAndCash = purchaseOrders.reduce((sum, po) => {
            if (po.payment_mode === 'cash') return sum + (po.total_amount || 0);
            return sum + (po.advance_paid || 0);
        }, 0);
        
        const totalPaid = recordedPayments + advancesAndCash;
        
        return {
            totalOrdered,
            totalPaid,
            pendingBalance: Math.max(0, totalOrdered - totalPaid),
            activePOs: purchaseOrders.filter(po => po.status !== 'received').length,
            totalCreditUsed: suppliers.reduce((acc, s) => acc + (s.current_credit || 0), 0),
            totalCreditLimit: suppliers.reduce((acc, s) => acc + (s.credit_limit || 0), 0)
        };
    })();

    const getPOBalance = (po: any) => {
        if (po.payment_mode === 'cash') return 0;
        const totalAmount = po.total_amount || 0;
        const advancePaid = po.advance_paid || 0;
        const poPayments = payments.filter(p => p.purchase_order_id === po.id);
        const paidAmount = poPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
        return Math.max(0, totalAmount - advancePaid - paidAmount);
    };

    const handlePayDue = (po: any) => {
        const balance = getPOBalance(po);
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
            if (isEditingSupplier && editingSupplierId) {
                await db.update('suppliers', editingSupplierId, newSupplier);
                toast({ title: 'Success', description: 'Supplier updated successfully' });
            } else {
                await db.create('suppliers', { ...newSupplier, hospital_id: profile?.hospital_id });
                toast({ title: 'Success', description: 'Supplier added successfully' });
            }
            setIsSupplierModalOpen(false);
            setIsEditingSupplier(false);
            setEditingSupplierId(null);
            setNewSupplier({ 
                name: '', 
                contact_person: '', 
                phone: '', 
                email: '', 
                category: '',
                credit_limit: 0,
                bank_name: '',
                account_number: '',
                ifsc_code: '',
                branch_name: '',
                billing_address: '',
                shipping_address: '',
                state_code: '',
                state_name: '',
                gst_number: ''
            });
            fetchData();
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        }
    }

    const handleEditSupplier = (supplier: any) => {
        setNewSupplier({
            name: supplier.name || '',
            contact_person: supplier.contact_person || '',
            phone: supplier.phone || '',
            email: supplier.email || '',
            category: supplier.category || '',
            credit_limit: supplier.credit_limit || 0,
            bank_name: supplier.bank_name || '',
            account_number: supplier.account_number || '',
            ifsc_code: supplier.ifsc_code || '',
            branch_name: supplier.branch_name || '',
            billing_address: supplier.billing_address || '',
            shipping_address: supplier.shipping_address || '',
            state_code: supplier.state_code || '',
            state_name: supplier.state_name || '',
            gst_number: supplier.gst_number || ''
        });
        setEditingSupplierId(supplier.id);
        setIsEditingSupplier(true);
        setIsSupplierModalOpen(true);
    };

    async function handleCreatePO(e: React.FormEvent) {
        e.preventDefault();
        if (poItems.length === 0) {
            toast({ title: 'Empty Order', description: 'Please add items to the order', variant: 'destructive' });
            return;
        }
        try {
            let totalBasic = 0;
            let totalTax = 0;
            let totalDiscount = 0;

            const itemsWithTax = poItems.map(item => {
                const basic = item.quantity * item.price;
                const discount = basic * (item.discount_percent / 100);
                const taxable = basic - discount;
                const tax = taxable * (item.gst_rate / 100);
                
                totalBasic += basic;
                totalDiscount += discount;
                totalTax += tax;

                // Simple GST splitting logic
                const isIntraState = newPO.state_code === hospital?.state_code || !newPO.state_code;
                const cgst = isIntraState ? tax / 2 : 0;
                const sgst = isIntraState ? tax / 2 : 0;
                const igst = isIntraState ? 0 : tax;

                return {
                    item_name: item.item_name,
                    inventory_item_id: item.inventory_item_id,
                    quantity_ordered: item.quantity,
                    unit_price: item.price,
                    units_per_pack: item.units_per_pack || 1,
                    mrp: item.mrp || 0,
                    hsn_code: item.hsn_code,
                    gst_rate: item.gst_rate,
                    cgst_amount: cgst,
                    sgst_amount: sgst,
                    igst_amount: igst,
                    discount_percent: item.discount_percent
                };
            });

            const currentTotal = totalBasic - totalDiscount + totalTax;
            
            // Credit Limit Check — HARD BLOCK
            const selectedSupplier = suppliers.find(s => s.id === newPO.supplier_id);
            if (newPO.payment_mode === 'credit' && selectedSupplier) {
                const creditLimit = selectedSupplier.credit_limit || 0;
                const netCreditImpact = currentTotal - (newPO.advance_paid || 0);
                const projectedCredit = (selectedSupplier.current_credit || 0) + netCreditImpact;
                
                if (creditLimit > 0 && projectedCredit > creditLimit) {
                    const remainingCredit = Math.max(0, creditLimit - (selectedSupplier.current_credit || 0));
                    const isAdmin = profile?.role === 'HOSPITAL_ADMIN' || profile?.role === 'SUPER_ADMIN' || profile?.role === 'OWNER';
                    
                    if (isAdmin) {
                        const proceed = window.confirm(
                            `⚠️ CREDIT LIMIT EXCEEDED\n\nThis order needs ₹${netCreditImpact.toLocaleString()} in credit but only ₹${remainingCredit.toLocaleString()} remains for ${selectedSupplier.name}.\n\nAs an admin, you can override this. Proceed?`
                        );
                        if (!proceed) return;
                    } else {
                        toast({ 
                            title: 'Credit Limit Exceeded', 
                            description: `Cannot create this order. It needs ₹${netCreditImpact.toLocaleString()} in credit but only ₹${remainingCredit.toLocaleString()} remains for ${selectedSupplier.name}. Contact an admin to increase the credit limit.`, 
                            variant: 'destructive' 
                        });
                        return;
                    }
                }
            }

            const orderNum = Math.floor(100000 + Math.random() * 900000).toString();

            const po = await db.create('purchase_orders', {
                hospital_id: profile?.hospital_id,
                clinic_id: newPO.clinic_id || profile?.clinic_id,
                supplier_id: newPO.supplier_id,
                total_amount: currentTotal,
                basic_amount: totalBasic,
                tax_amount: totalTax,
                discount_amount: totalDiscount,
                is_b2b: newPO.is_b2b,
                place_of_supply: newPO.place_of_supply,
                state_code: newPO.state_code,
                payment_mode: newPO.payment_mode,
                advance_paid: newPO.advance_paid,
                eway_bill_number: newPO.eway_bill_number,
                irn_number: newPO.irn_number,
                status: 'draft',
                order_number: orderNum,
                amount_in_words: numberToWords(currentTotal)
            });

            const itemsToInsert = itemsWithTax.map(item => ({
                ...item,
                purchase_order_id: po.id
            }));

            await db.createMany('purchase_order_items', itemsToInsert);
            
            // 7. Save/Update supplier item prices for future auto-fill
            const priceUpserts = poItems.map(item => ({
                supplier_id: newPO.supplier_id,
                item_name: item.item_name,
                price: item.price,
                hsn_code: item.hsn_code,
                gst_rate: item.gst_rate,
                updated_at: new Date().toISOString()
            }));

            if (priceUpserts.length > 0) {
                await supabase.from('supplier_item_prices').upsert(priceUpserts, {
                    onConflict: 'supplier_id,item_name'
                });
            }

            // 8. Update inventory metadata if inventory_item_id exists
            const inventoryUpdates = poItems
                .filter(item => item.inventory_item_id)
                .map(item => 
                    supabase.from('inventory')
                        .update({ 
                            hsn_code: item.hsn_code, 
                            gst_rate: item.gst_rate 
                        })
                        .eq('id', item.inventory_item_id)
                );
            
            if (inventoryUpdates.length > 0) {
                await Promise.all(inventoryUpdates);
            }

            toast({ title: 'Order Created', description: `PO #${po.order_number} has been created.` });
            setIsPOModalOpen(false);
            setPoItems([]);
            
            // 9. Sync supplier master data (address/state only)
            // NOTE: DB trigger `handle_po_financials` handles credit updates when PO is received
            try {
                await db.update('suppliers', newPO.supplier_id, {
                    billing_address: newPO.place_of_supply,
                    state_code: newPO.state_code,
                });
            } catch (err) {
                console.error('Failed to sync supplier master record:', err);
            }

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
                            <CardTitle>Credit Management</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Current Credit Usage</p>
                                <div className="flex justify-between items-end mb-2">
                                    <span className="text-2xl font-bold text-slate-800">₹{supplier?.current_credit?.toLocaleString() || 0}</span>
                                    {isEditingCreditLimit ? (
                                        <div className="flex items-center gap-1">
                                            <span className="text-xs text-slate-500">₹</span>
                                            <Input 
                                                type="number" 
                                                value={editCreditLimitValue} 
                                                onChange={e => setEditCreditLimitValue(Number(e.target.value))} 
                                                className="w-24 h-7 text-xs text-right p-1 border-blue-300"
                                                autoFocus
                                                onKeyDown={async (e) => {
                                                    if (e.key === 'Enter') {
                                                        await db.update('suppliers', supplier.id, { credit_limit: editCreditLimitValue });
                                                        toast({ title: 'Updated', description: `Credit limit set to ₹${editCreditLimitValue.toLocaleString()}` });
                                                        setIsEditingCreditLimit(false);
                                                        fetchData();
                                                    } else if (e.key === 'Escape') {
                                                        setIsEditingCreditLimit(false);
                                                    }
                                                }}
                                            />
                                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-emerald-600" onClick={async () => {
                                                await db.update('suppliers', supplier.id, { credit_limit: editCreditLimitValue });
                                                toast({ title: 'Updated', description: `Credit limit set to ₹${editCreditLimitValue.toLocaleString()}` });
                                                setIsEditingCreditLimit(false);
                                                fetchData();
                                            }}>
                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>
                                    ) : (
                                        <button 
                                            className="text-xs text-slate-500 font-medium pb-1 hover:text-blue-600 transition-colors cursor-pointer flex items-center gap-1"
                                            onClick={() => {
                                                setEditCreditLimitValue(supplier?.credit_limit || 0);
                                                setIsEditingCreditLimit(true);
                                            }}
                                        >
                                            Limit: ₹{supplier?.credit_limit?.toLocaleString() || 0}
                                            <Edit3 className="w-3 h-3" />
                                        </button>
                                    )}
                                </div>
                                <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                                    <div 
                                        className={`h-full rounded-full transition-all duration-500 ${
                                            supplier?.credit_limit > 0 && (supplier?.current_credit / supplier?.credit_limit) > 0.9 ? 'bg-red-500' : 
                                            supplier?.credit_limit > 0 && (supplier?.current_credit / supplier?.credit_limit) > 0.7 ? 'bg-orange-500' : 'bg-blue-500'
                                        }`}
                                        style={{ width: `${supplier?.credit_limit > 0 ? Math.min(100, (supplier?.current_credit / supplier?.credit_limit) * 100) : 0}%` }}
                                    />
                                </div>
                                {(supplier?.credit_limit > 0 && supplier?.current_credit > supplier?.credit_limit) && (
                                    <p className="text-[10px] text-red-600 font-bold mt-2 flex items-center gap-1">
                                        <AlertCircle className="w-3 h-3" /> Credit limit exceeded by ₹{(supplier.current_credit - supplier.credit_limit).toLocaleString()}!
                                    </p>
                                )}
                                {supplier?.credit_limit === 0 && (
                                    <p className="text-[10px] text-slate-400 mt-2">No credit limit set. Click limit to set one.</p>
                                )}
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2">
                                <Button variant="outline" size="sm" className="w-full text-xs h-9" onClick={() => setIsNoteModalOpen(true)}>
                                    <FileText className="w-3 h-3 mr-1" /> Record Note
                                </Button>
                                <Button variant="outline" size="sm" className="w-full text-xs h-9" onClick={() => {
                                    setNewPayment({ ...newPayment, supplier_id: supplier.id });
                                    setIsPaymentModalOpen(true);
                                }}>
                                    <IndianRupee className="w-3 h-3 mr-1" /> Clear Dues
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="lg:col-span-2">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <History className="w-5 h-5 text-slate-400" />
                                    Credit/Debit History
                                </CardTitle>
                                <CardDescription>Recent adjustments for this supplier.</CardDescription>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Reason</TableHead>
                                        <TableHead className="text-right">Amount</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {creditNotes.length === 0 ? (
                                        <TableRow><TableCell colSpan={4} className="text-center py-10 text-slate-400">No notes recorded yet.</TableCell></TableRow>
                                    ) : (
                                        creditNotes.map(note => (
                                            <TableRow key={note.id}>
                                                <TableCell>{new Date(note.created_at).toLocaleDateString()}</TableCell>
                                                <TableCell>
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                                        note.type === 'credit' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                                                    }`}>
                                                        {note.type}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="max-w-[200px] truncate">{note.reason}</TableCell>
                                                <TableCell className={`text-right font-bold ${note.type === 'credit' ? 'text-emerald-600' : 'text-red-600'}`}>
                                                    {note.type === 'credit' ? '-' : '+'}₹{note.amount.toLocaleString()}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

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
                                <DialogContent className="sm:max-w-4xl bg-white">
                                    <DialogHeader>
                                        <DialogTitle>Create Purchase Order</DialogTitle>
                                    </DialogHeader>
                                    <form onSubmit={handleCreatePO} className="space-y-4 pt-4">
                                        <div className="grid grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <div className="flex justify-between items-center px-0.5">
                                                    <Label className="text-slate-700 font-bold">Select Supplier</Label>
                                                    {newPO.supplier_id && (
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                            ((suppliers.find(s => s.id === newPO.supplier_id)?.credit_limit || 0) - (suppliers.find(s => s.id === newPO.supplier_id)?.current_credit || 0)) < 0 
                                                            ? 'bg-red-100 text-red-600' 
                                                            : 'bg-emerald-100 text-emerald-600'
                                                        }`}>
                                                            Limit Left: ₹{((suppliers.find(s => s.id === newPO.supplier_id)?.credit_limit || 0) - (suppliers.find(s => s.id === newPO.supplier_id)?.current_credit || 0)).toLocaleString()}
                                                        </span>
                                                    )}
                                                </div>
                                                <select 
                                                    className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white shadow-sm focus:ring-2 focus:ring-blue-500/20"
                                                    value={newPO.supplier_id}
                                                    onChange={e => handleSupplierChange(e.target.value)}
                                                    required
                                                >
                                                    <option value="">Choose a supplier...</option>
                                                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                                </select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-slate-700 font-bold px-0.5">Destination Clinic</Label>
                                                <select 
                                                    className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white shadow-sm focus:ring-2 focus:ring-blue-500/20"
                                                    value={newPO.clinic_id}
                                                    onChange={e => setNewPO({ ...newPO, clinic_id: e.target.value })}
                                                    required
                                                >
                                                    <option value="">Select clinic...</option>
                                                    {clinics.filter(c => c.status !== 'paused').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                                                         <div className="grid grid-cols-4 gap-4">
                                            <div className="col-span-1 space-y-2">
                                                <Label className="text-slate-700 font-bold px-0.5">Place of Supply</Label>
                                                <Input 
                                                    value={newPO.place_of_supply} 
                                                    onChange={(e) => setNewPO({ ...newPO, place_of_supply: e.target.value })}
                                                    placeholder="Address..."
                                                    className="h-10"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-slate-700 font-bold px-0.5">State</Label>
                                                <select 
                                                    className="w-full h-10 px-2 border border-slate-200 rounded-lg text-sm bg-white"
                                                    value={newPO.state_name}
                                                    onChange={e => handleStateChoice(e.target.value)}
                                                    required
                                                >
                                                    <option value="">State...</option>
                                                    {INDIAN_STATES.map(s => <option key={s.code} value={s.name}>{s.name}</option>)}
                                                </select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-slate-700 font-bold px-0.5">Code</Label>
                                                <Input 
                                                    value={newPO.state_code} 
                                                    onChange={e => setNewPO({ ...newPO, state_code: e.target.value })} 
                                                    placeholder="00" 
                                                    readOnly
                                                    className="bg-slate-50 h-10 text-center"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-slate-700 font-bold px-0.5">Payment</Label>
                                                <select 
                                                    className="w-full h-10 px-2 border border-slate-200 rounded-lg text-sm bg-white capitalize"
                                                    value={newPO.payment_mode}
                                                    onChange={e => setNewPO({ ...newPO, payment_mode: e.target.value as 'cash' | 'credit' })}
                                                >
                                                    <option value="cash">Cash</option>
                                                    <option value="credit">Credit</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="border border-slate-100 rounded-xl overflow-hidden">
                                            <div className="bg-slate-50 p-3 flex justify-between items-center border-b border-slate-100">
                                                <span className="font-bold text-xs uppercase text-slate-500 tracking-widest">Order Items</span>
                                                <Button type="button" size="sm" variant="outline" onClick={() => setPoItems([...poItems, { item_name: '', quantity: 1, price: 0, units_per_pack: 1, mrp: 0, hsn_code: '', gst_rate: 18, discount_percent: 0 }])}>Add Item</Button>
                                            </div>
                                            <div className="px-3 py-2 bg-slate-100 border-b border-slate-200 grid grid-cols-[1fr_80px_80px_80px_80px_60px_60px_40px] gap-2 items-center text-center">
                                                <span className="text-[10px] font-bold text-slate-500 uppercase text-left ml-1">Item Name</span>
                                                <span className="text-[10px] font-bold text-slate-500 uppercase">Packs</span>
                                                <span className="text-[10px] font-bold text-slate-500 uppercase">MRP</span>
                                                <span className="text-[10px] font-bold text-slate-500 uppercase">Price</span>
                                                <span className="text-[10px] font-bold text-slate-500 uppercase">HSN</span>
                                                <span className="text-[10px] font-bold text-slate-500 uppercase">GST%</span>
                                                <span className="text-[10px] font-bold text-slate-500 uppercase">Disc%</span>
                                                <span></span>
                                            </div>
                                            <div className="p-3 space-y-3 max-h-60 overflow-y-auto">
                                                {poItems.map((item, idx) => (
                                                    <div key={idx} className="grid grid-cols-[1fr_80px_80px_80px_80px_60px_60px_40px] gap-2 items-center">
                                                        <Input 
                                                            placeholder="Item Name" 
                                                            value={item.item_name} 
                                                            onChange={e => handleItemNameChange(idx, e.target.value)} 
                                                            className="w-full h-10 bg-white border-slate-200" 
                                                            required 
                                                        />
                                                        <Input type="number" value={item.quantity} onChange={e => {
                                                            const updated = [...poItems];
                                                            updated[idx].quantity = parseInt(e.target.value);
                                                            setPoItems(updated);
                                                        }} className="h-10 text-center border-slate-200" required />
                                                        
                                                        <Input type="number" value={item.mrp} onChange={e => {
                                                            const updated = [...poItems];
                                                            updated[idx].mrp = parseFloat(e.target.value);
                                                            setPoItems(updated);
                                                        }} className="h-10 text-center border-slate-200" required />

                                                        <Input type="number" value={item.price} onChange={e => {
                                                            const updated = [...poItems];
                                                            updated[idx].price = parseFloat(e.target.value);
                                                            setPoItems(updated);
                                                        }} className="h-10 text-center font-bold text-blue-600 border-slate-200" required />

                                                        <Input placeholder="Code" value={item.hsn_code} onChange={e => {
                                                            const updated = [...poItems];
                                                            updated[idx].hsn_code = e.target.value;
                                                            setPoItems(updated);
                                                        }} className="h-10 text-center text-xs border-slate-200" />

                                                        <Input type="number" value={item.gst_rate} onChange={e => {
                                                            const updated = [...poItems];
                                                            updated[idx].gst_rate = parseFloat(e.target.value);
                                                            setPoItems(updated);
                                                        }} className="h-10 text-center border-slate-200" required />

                                                        <Input type="number" value={item.discount_percent} onChange={e => {
                                                            const updated = [...poItems];
                                                            updated[idx].discount_percent = parseFloat(e.target.value);
                                                            setPoItems(updated);
                                                        }} className="h-10 text-center text-red-500 border-slate-200" />

                                                        <Button type="button" variant="ghost" className="text-red-400 hover:text-red-600 hover:bg-red-50 p-0 h-10 w-10 justify-center ml-auto" onClick={() => setPoItems(poItems.filter((_, i) => i !== idx))}>
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-8 items-start pt-2 border-t border-slate-100">
                                            <div className="space-y-4 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                                                <div className="space-y-2">
                                                    <Label className="text-slate-700 font-bold px-0.5">Advance Paid</Label>
                                                    <div className="relative">
                                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₹</span>
                                                        <Input 
                                                            type="number" 
                                                            value={newPO.advance_paid} 
                                                            onChange={e => setNewPO({ ...newPO, advance_paid: parseFloat(e.target.value) })} 
                                                            placeholder="0.00" 
                                                            className="pl-7 h-11 text-lg font-medium border-slate-200 focus:border-blue-500 bg-white"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <Label className="text-xs font-bold text-slate-500 uppercase px-0.5">E-way Bill No.</Label>
                                                        <Input 
                                                            value={newPO.eway_bill_number} 
                                                            onChange={e => setNewPO({ ...newPO, eway_bill_number: e.target.value })} 
                                                            placeholder="Optional" 
                                                            className="h-9 text-sm"
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-xs font-bold text-slate-500 uppercase px-0.5">IRN Number</Label>
                                                        <Input 
                                                            value={newPO.irn_number} 
                                                            onChange={e => setNewPO({ ...newPO, irn_number: e.target.value })} 
                                                            placeholder="Optional" 
                                                            className="h-9 text-sm"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="bg-blue-50/50 p-4 rounded-xl space-y-2">
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-slate-500">Subtotal:</span>
                                                    <span className="font-medium">₹{poItems.reduce((acc, item) => acc + (item.quantity * item.price), 0).toLocaleString()}</span>
                                                </div>
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-slate-500">Discount:</span>
                                                    <span className="font-medium text-red-600">-₹{poItems.reduce((acc, item) => acc + (item.quantity * item.price * (item.discount_percent / 100)), 0).toLocaleString()}</span>
                                                </div>
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-slate-500">GST:</span>
                                                    <span className="font-medium">₹{poItems.reduce((acc, item) => {
                                                        const taxable = (item.quantity * item.price) * (1 - item.discount_percent / 100);
                                                        return acc + (taxable * (item.gst_rate / 100));
                                                    }, 0).toLocaleString()}</span>
                                                </div>
                                                <div className="border-t border-blue-100 pt-2 flex justify-between items-center text-blue-700">
                                                    <span className="font-bold">Total Amount:</span>
                                                    <span className="text-xl font-bold">₹{poItems.reduce((acc, item) => {
                                                        const taxable = (item.quantity * item.price) * (1 - item.discount_percent / 100);
                                                        const tax = taxable * (item.gst_rate / 100);
                                                        return acc + taxable + tax;
                                                    }, 0).toLocaleString()}</span>
                                                </div>
                                            </div>
                                         </div>
                                         <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 h-12">Create Draft Order</Button>
                                    </form>
                                </DialogContent>
                            </Dialog>
                        )}
                        {selectedTab === 'suppliers' && (
                            <Dialog open={isSupplierModalOpen} onOpenChange={(open) => {
                                setIsSupplierModalOpen(open);
                                if (!open) {
                                    setIsEditingSupplier(false);
                                    setEditingSupplierId(null);
                                    setNewSupplier({ 
                                        name: '', contact_person: '', phone: '', email: '', category: '', 
                                        credit_limit: 0, bank_name: '', account_number: '', ifsc_code: '', 
                                        branch_name: '', billing_address: '', shipping_address: '', state_code: '', 
                                        state_name: '', gst_number: '' 
                                    });
                                }
                            }}>
                                <DialogTrigger asChild>
                                    <Button className="bg-blue-600 hover:bg-blue-700">
                                        <Plus className="w-4 h-4 mr-2" /> New Supplier
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-2xl bg-white max-h-[90vh] overflow-y-auto">
                                    <DialogHeader>
                                        <DialogTitle>{isEditingSupplier ? 'Edit Supplier' : 'Register New Supplier'}</DialogTitle>
                                    </DialogHeader>
                                    <form onSubmit={handleCreateSupplier} className="space-y-4 pt-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Supplier Name</Label>
                                                <Input required value={newSupplier.name} onChange={e => setNewSupplier({ ...newSupplier, name: e.target.value })} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Category</Label>
                                                <Input value={newSupplier.category} onChange={e => setNewSupplier({ ...newSupplier, category: e.target.value })} placeholder="e.g. Pharma, Surgical" />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Contact Person</Label>
                                                <Input value={newSupplier.contact_person} onChange={e => setNewSupplier({ ...newSupplier, contact_person: e.target.value })} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Phone</Label>
                                                <Input value={newSupplier.phone} onChange={e => setNewSupplier({ ...newSupplier, phone: e.target.value })} />
                                            </div>
                                        </div>

                                        <div className="space-y-4 border-t pt-4">
                                            <h3 className="font-bold text-sm text-slate-700">GST & Credit Info</h3>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label>GST Number</Label>
                                                    <Input value={newSupplier.gst_number} onChange={e => setNewSupplier({ ...newSupplier, gst_number: e.target.value })} placeholder="GSTIN" />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Credit Limit (₹)</Label>
                                                    <Input type="number" value={newSupplier.credit_limit} onChange={e => setNewSupplier({ ...newSupplier, credit_limit: Number(e.target.value) })} />
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="space-y-4 border-t pt-4">
                                            <h3 className="font-bold text-sm text-slate-700">Bank Details</h3>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label>Bank Name</Label>
                                                    <Input value={newSupplier.bank_name} onChange={e => setNewSupplier({ ...newSupplier, bank_name: e.target.value })} />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Account Number</Label>
                                                    <Input value={newSupplier.account_number} onChange={e => setNewSupplier({ ...newSupplier, account_number: e.target.value })} />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label>IFSC Code</Label>
                                                    <Input value={newSupplier.ifsc_code} onChange={e => setNewSupplier({ ...newSupplier, ifsc_code: e.target.value })} />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Branch</Label>
                                                    <Input value={newSupplier.branch_name} onChange={e => setNewSupplier({ ...newSupplier, branch_name: e.target.value })} />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="border-t pt-4 space-y-4">
                                            <h3 className="font-bold text-sm text-slate-700">Addresses</h3>
                                            <div className="space-y-2">
                                                <Label>Billing Address</Label>
                                                <Input value={newSupplier.billing_address} onChange={e => setNewSupplier({ ...newSupplier, billing_address: e.target.value })} />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label>State</Label>
                                                    <select 
                                                        className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                                                        value={newSupplier.state_name}
                                                        onChange={e => handleSupplierStateChoice(e.target.value)}
                                                        required
                                                    >
                                                        <option value="">Select State...</option>
                                                        {INDIAN_STATES.map(s => <option key={s.code} value={s.name}>{s.name}</option>)}
                                                    </select>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>GST State Code</Label>
                                                    <Input 
                                                        value={newSupplier.state_code} 
                                                        onChange={e => setNewSupplier({ ...newSupplier, state_code: e.target.value })} 
                                                        placeholder="e.g. 07" 
                                                        readOnly 
                                                        className="bg-slate-50"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 h-12 font-bold shadow-lg shadow-blue-600/20">
                                            {isEditingSupplier ? 'Update Supplier' : 'Register Supplier'}
                                        </Button>
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
                                                    {getPOBalance(po) === 0 ? (
                                                        <span className="text-emerald-600 font-bold flex items-center gap-1">
                                                            <CheckCircle2 className="w-3 h-3" /> Settled
                                                        </span>
                                                    ) : (
                                                        <span className="text-red-600 font-bold">
                                                            ₹{getPOBalance(po).toLocaleString()}
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
                                                    {getPOBalance(po) > 0 && (
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
                                                            {po.status !== 'received' && po.status !== 'cancelled' && (
                                                                <DropdownMenuItem onClick={() => handleReceiveOrder(po.id)} className="text-emerald-600">
                                                                    <CheckCircle className="w-4 h-4 mr-2" /> Mark as Received
                                                                </DropdownMenuItem>
                                                            )}
                                                            {po.status !== 'cancelled' && (
                                                                <DropdownMenuItem onClick={() => handleCancelPO(po)} className="text-orange-600">
                                                                    <AlertCircle className="w-4 h-4 mr-2" /> Cancel Order
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
                                            handleEditSupplier(s);
                                        }}>
                                            <Edit3 className="w-4 h-4 text-slate-400" />
                                        </Button>
                                    </div>
                                    <CardTitle className="mt-4 text-lg">{s.name}</CardTitle>
                                    <CardDescription className="font-medium text-blue-600/70">{s.category || 'Vendor'}</CardDescription>
                                </CardHeader>
                                <CardContent className="pt-4">
                                    <div className="space-y-3 text-sm">
                                        <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-100/50">
                                            <div className="flex items-center gap-2">
                                                <AlertCircle className={`w-4 h-4 ${s.current_credit > s.credit_limit ? 'text-red-500' : 'text-emerald-500'}`} />
                                                <span className="text-slate-500 font-medium">Credit Used</span>
                                            </div>
                                            <span className={`font-bold ${s.current_credit > s.credit_limit ? 'text-red-600' : 'text-slate-700'}`}>
                                                ₹{s.current_credit?.toLocaleString() || 0} / ₹{s.credit_limit?.toLocaleString() || 0}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3 text-slate-600">
                                            <User className="w-4 h-4 text-slate-400" />
                                            <span className="font-medium">{s.contact_person}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-slate-600">
                                            <Phone className="w-4 h-4 text-slate-400" />
                                            {s.phone}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                        <button 
                            className="border-2 border-dashed border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center gap-3 text-slate-400 hover:border-blue-400 hover:text-blue-500 transition-all group min-h-[220px] bg-slate-50/30"
                            onClick={() => setIsSupplierModalOpen(true)}
                        >
                            <PlusCircle className="w-12 h-12 group-hover:scale-110 transition-transform opacity-30" />
                            <span className="font-bold text-sm">Register New Supplier</span>
                        </button>
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
                        <div className="bg-slate-900 text-white p-4 rounded-xl shadow-lg flex flex-col justify-between">
                            <div className="flex justify-between items-center mb-1">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Alt Market Credit Exposure</p>
                                <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full font-bold">
                                    {Math.round((stats.totalCreditUsed / stats.totalCreditLimit) * 100) || 0}% Used
                                </span>
                            </div>
                            <div className="flex justify-between items-end">
                                <p className="text-xl font-bold">₹{stats.totalCreditUsed.toLocaleString()}</p>
                                <p className="text-[10px] text-slate-400">Limit: ₹{stats.totalCreditLimit.toLocaleString()}</p>
                            </div>
                            <div className="h-1.5 w-full bg-slate-800 rounded-full mt-2 overflow-hidden">
                                <div 
                                    className={`h-full rounded-full transition-all duration-500 ${
                                        (stats.totalCreditUsed / stats.totalCreditLimit) > 0.9 ? 'bg-red-500' : 
                                        (stats.totalCreditUsed / stats.totalCreditLimit) > 0.7 ? 'bg-orange-500' : 'bg-blue-500'
                                    }`}
                                    style={{ width: `${Math.min(100, (stats.totalCreditUsed / stats.totalCreditLimit) * 100 || 0)}%` }}
                                />
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

            <Dialog open={isNoteModalOpen} onOpenChange={setIsNoteModalOpen}>
                <DialogContent className="sm:max-w-md bg-white">
                    <DialogHeader>
                        <DialogTitle>Record Credit/Debit Note</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleRecordNote} className="space-y-4 pt-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Type</Label>
                                <select 
                                    className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                                    value={newNote.type}
                                    onChange={e => setNewNote({ ...newNote, type: e.target.value as 'credit' | 'debit' })}
                                >
                                    <option value="credit">Credit (Decrease Debt)</option>
                                    <option value="debit">Debit (Increase Debt)</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label>Amount</Label>
                                <Input 
                                    type="number" 
                                    required 
                                    value={newNote.amount} 
                                    onChange={e => setNewNote({ ...newNote, amount: parseFloat(e.target.value) || 0 })} 
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>State (Place of Supply)</Label>
                                <select 
                                    className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                                    value={newNote.state_name}
                                    onChange={(e) => {
                                        const stateName = e.target.value;
                                        const state = INDIAN_STATES.find(s => s.name === stateName);
                                        setNewNote({
                                            ...newNote,
                                            state_name: stateName,
                                            state_code: state ? state.code : ''
                                        });
                                    }}
                                >
                                    <option value="">Select State</option>
                                    {INDIAN_STATES.map(state => (
                                        <option key={state.code} value={state.name}>
                                            {state.name} ({state.code})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label>State Code</Label>
                                <Input 
                                    value={newNote.state_code} 
                                    readOnly 
                                    className="bg-slate-50"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Reason</Label>
                            <Input 
                                required 
                                value={newNote.reason} 
                                onChange={e => setNewNote({ ...newNote, reason: e.target.value })} 
                                placeholder="e.g. Return of damaged goods"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Reference PO (Optional)</Label>
                            <select 
                                className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                                value={newNote.reference_po_id}
                                onChange={e => setNewNote({ ...newNote, reference_po_id: e.target.value })}
                            >
                                <option value="">None</option>
                                {purchaseOrders.filter(po => po.supplier_id === selectedSupplierId).map(po => (
                                    <option key={po.id} value={po.id}>PO-{po.order_number}</option>
                                ))}
                            </select>
                        </div>
                        <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 h-11">Record Note</Button>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={isReceiptModalOpen} onOpenChange={setIsReceiptModalOpen}>
                <DialogContent className="sm:max-w-4xl bg-white p-6 overflow-y-auto max-h-[95vh] rounded-2xl border-none shadow-2xl">
                    <TaxInvoiceControls onPrint={() => window.print()} />
                    <TaxInvoice 
                        order={viewingOrder} 
                        items={receiptItems} 
                        hospital={hospital} 
                        supplier={viewingOrder?.suppliers || suppliers.find(s => s.id === viewingOrder?.supplier_id)} 
                        clinic={clinics.find(c => c.id === viewingOrder?.clinic_id)} 
                    />
                </DialogContent>
            </Dialog>
        </div>
    );
}
