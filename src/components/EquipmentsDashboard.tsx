import { useState, useEffect, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import { dataService as db } from '@/lib/dataService';
import { useHospital } from '@/context/HospitalContext';
import { 
    Loader2, 
    Monitor, 
    Plus, 
    Search, 
    Filter, 
    Trash2,
    AlertCircle,
    Bed,
    Laptop,
    Tv,
    Wrench,
    Activity
} from 'lucide-react';
import { Card } from '@/components/ui/basic';
import { Button } from '@/components/ui/basic';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';

interface Equipment {
    id: string;
    hospital_id: string;
    clinic_id: string | null;
    name: string;
    category: string;
    quantity: number;
    purchase_date: string;
    purchase_cost: number;
    status: 'FUNCTIONAL' | 'MAINTENANCE' | 'RETIRED';
    created_at: string;
}

const CATEGORIES = [
    { label: 'Beds', icon: Bed, value: 'BEDS' },
    { label: 'Medical Machines', icon: Activity, value: 'MACHINES' },
    { label: 'IT / Electronics', icon: Laptop, value: 'IT' },
    { label: 'Furniture', icon: Tv, value: 'FURNITURE' },
    { label: 'Maintenance Tools', icon: Wrench, value: 'MAINTENANCE' },
    { label: 'Other', icon: Monitor, value: 'OTHER' }
];

export function EquipmentsDashboard() {
    const { hospital, clinics } = useHospital();
    const { toast } = useToast();
    const [equipments, setEquipments] = useState<Equipment[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState('ALL');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        fetchEquipments();
    }, [hospital?.id]);

    const fetchEquipments = async () => {
        if (!hospital?.id) return;
        setLoading(true);
        try {
            const data = await db.list('hospital_equipments', {
                filters: [{ field: 'hospital_id', operator: '==', value: hospital.id }],
                sort: { column: 'purchase_date', ascending: false }
            });
            setEquipments(data || []);
        } catch (error: any) {
            console.error('Error fetching equipments:', error);
            toast({ title: 'Error', description: 'Failed to load equipments', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const handleAddEquipment = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!hospital?.id) return;

        setIsSubmitting(true);
        const formData = new FormData(e.currentTarget);
        
        const payload = {
            hospital_id: hospital.id,
            clinic_id: formData.get('clinic_id') || null,
            name: formData.get('name') as string,
            category: formData.get('category') as string,
            quantity: parseInt(formData.get('quantity') as string),
            purchase_cost: parseFloat(formData.get('purchase_cost') as string),
            purchase_date: formData.get('purchase_date') as string,
            status: 'FUNCTIONAL'
        };

        try {
            await db.create('hospital_equipments', payload);
            
            toast({ title: 'Success', description: 'Equipment added to inventory successfully' });
            setIsAddModalOpen(false);
            fetchEquipments();
        } catch (error: any) {
            toast({ title: 'Error', description: error.message || 'Failed to add equipment', variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteEquipment = async (id: string) => {
        if (!confirm('Are you sure you want to remove this equipment record?')) return;

        try {
            await db.remove('hospital_equipments', id);
            toast({ title: 'Success', description: 'Equipment record removed' });
            setEquipments(equipments.filter(e => e.id !== id));
        } catch (error: any) {
            toast({ title: 'Error', description: 'Failed to delete record', variant: 'destructive' });
        }
    };

    const sortedAndFiltered = useMemo(() => {
        return equipments.filter(e => {
            const matchesSearch = e.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                 e.category.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCategory = filterCategory === 'ALL' || e.category === filterCategory;
            return matchesSearch && matchesCategory;
        });
    }, [equipments, searchQuery, filterCategory]);

    const stats = useMemo(() => {
        return {
            totalItems: sortedAndFiltered.reduce((sum, e) => sum + e.quantity, 0),
            totalValue: sortedAndFiltered.reduce((sum, e) => sum + (e.purchase_cost * e.quantity), 0),
            functional: sortedAndFiltered.filter(e => e.status === 'FUNCTIONAL').length
        };
    }, [sortedAndFiltered]);

    const handleGenerateAssetReport = () => {
        if (equipments.length === 0) {
            toast({ title: 'No Data', description: 'No equipment records found to generate report', variant: 'destructive' });
            return;
        }

        const doc = new jsPDF();
        const hospitalName = hospital?.name || 'Hospital Asset Registry';
        const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

        // Header
        doc.setFontSize(22);
        doc.setTextColor(15, 23, 42); // slate-900
        doc.text(hospitalName.toUpperCase(), 105, 20, { align: 'center' });
        
        doc.setFontSize(16);
        doc.text("FIXED ASSET REGISTRY REPORT", 105, 30, { align: 'center' });
        
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Generated on: ${dateStr}`, 105, 38, { align: 'center' });
        doc.setLineWidth(0.5);
        doc.line(20, 42, 190, 42);

        let y = 55;
        const rowHeight = 10;
        const col1 = 20; // Name
        const col2 = 80; // Category
        const col3 = 120; // Qty
        const col4 = 140; // Unit Cost
        const col5 = 170; // Total

        // Table Header
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text("Asset Name", col1, y);
        doc.text("Category", col2, y);
        doc.text("Qty", col3, y);
        doc.text("Unit Cost", col4, y);
        doc.text("Total Value", col5, y);
        y += 4;
        doc.line(20, y, 190, y);
        y += 8;

        doc.setFont('helvetica', 'normal');
        equipments.forEach((item) => {
            if (y > 270) {
                doc.addPage();
                y = 20;
                // Repeat Header on new page
                doc.setFont('helvetica', 'bold');
                doc.text("Asset Name", col1, y);
                doc.text("Category", col2, y);
                doc.text("Qty", col3, y);
                doc.text("Unit Cost", col4, y);
                doc.text("Total Value", col5, y);
                y += 4;
                doc.line(20, y, 190, y);
                y += 8;
                doc.setFont('helvetica', 'normal');
            }

            const categoryLabel = CATEGORIES.find(c => c.value === item.category)?.label || item.category;
            
            doc.text(item.name.substring(0, 25), col1, y);
            doc.text(categoryLabel, col2, y);
            doc.text(item.quantity.toString(), col3, y);
            doc.text(`Rs. ${item.purchase_cost.toLocaleString()}`, col4, y);
            doc.text(`Rs. ${(item.purchase_cost * item.quantity).toLocaleString()}`, col5, y);
            
            y += rowHeight;
        });

        // Summary Section
        y += 10;
        if (y > 250) { doc.addPage(); y = 20; }
        
        doc.setLineWidth(0.8);
        doc.line(20, y, 190, y);
        y += 10;
        
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text("VALUATION SUMMARY", 20, y);
        
        y += 10;
        doc.setFontSize(12);
        doc.text(`Total Registered Assets: ${stats.totalItems}`, 20, y);
        y += 8;
        doc.setTextColor(21, 128, 61); // emerald-700
        doc.text(`Total Asset Valuation: Rs. ${stats.totalValue.toLocaleString()}`, 20, y);

        doc.save(`Asset_Report_${new Date().toISOString().split('T')[0]}.pdf`);
        toast({ title: 'Success', description: 'Asset report generated and downloaded' });
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/60 pb-6">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Equipments & Assets</h1>
                    <p className="text-slate-500 mt-1">Manage hospital machines, furniture, and fixed assets</p>
                </div>

                <div className="flex items-center gap-3">
                    <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-200">
                                <Plus className="w-4 h-4 mr-2" /> Add Equipment
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[500px]">
                            <DialogHeader>
                                <DialogTitle>Add New Equipment</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleAddEquipment} className="space-y-4 pt-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Equipment Name</label>
                                    <input 
                                        name="name" 
                                        required 
                                        placeholder="e.g. Samsung Smart TV, ICU Bed Model X"
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Category</label>
                                        <select name="category" required className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none">
                                            {CATEGORIES.map(c => (
                                                <option key={c.value} value={c.value}>{c.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Quantity</label>
                                        <input 
                                            name="quantity" 
                                            type="number" 
                                            min="1"
                                            required 
                                            defaultValue="1"
                                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Unit Cost (₹)</label>
                                        <input 
                                            name="purchase_cost" 
                                            type="number" 
                                            step="0.01"
                                            required 
                                            placeholder="0.00"
                                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Purchase Date</label>
                                        <input 
                                            name="purchase_date" 
                                            type="date" 
                                            required 
                                            defaultValue={new Date().toISOString().split('T')[0]}
                                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Assign to Clinic (Optional)</label>
                                    <select name="clinic_id" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none">
                                        <option value="">Hospital Wide / Global</option>
                                        {clinics.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="pt-4 flex justify-end gap-3">
                                    <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
                                    <Button type="submit" disabled={isSubmitting} className="bg-emerald-600 text-white">
                                        {isSubmitting ? 'Saving...' : 'Add Equipment'}
                                    </Button>
                                </div>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card className="border border-slate-200 shadow-sm bg-white overflow-hidden p-6">
                    <div className="text-sm font-medium text-slate-500 mb-1">Total Assets</div>
                    <div className="text-3xl font-bold text-slate-900">{stats.totalItems}</div>
                    <div className="text-xs text-slate-400 mt-1">Units tracked</div>
                </Card>
                <Card className="border border-slate-200 shadow-sm bg-white overflow-hidden p-6">
                    <div className="text-sm font-medium text-slate-500 mb-1">Total Valuation</div>
                    <div className="text-3xl font-bold text-emerald-600">₹{stats.totalValue.toLocaleString()}</div>
                    <div className="text-xs text-emerald-600/70 mt-1">Acquisition cost</div>
                </Card>
                <Card className="border border-slate-200 shadow-sm bg-white overflow-hidden p-6">
                    <div className="text-sm font-medium text-slate-500 mb-1">Functional</div>
                    <div className="text-3xl font-bold text-blue-600">{stats.functional}</div>
                    <div className="text-xs text-blue-600/70 mt-1">Active categories</div>
                </Card>
                <Card className="border border-slate-200 shadow-sm bg-white overflow-hidden p-6">
                    <div className="text-sm font-medium text-slate-500 mb-1">Recent Activity</div>
                    <div className="text-3xl font-bold text-purple-600">{equipments.length > 0 ? 'Active' : 'N/A'}</div>
                    <div className="text-xs text-purple-600/70 mt-1">Asset registry</div>
                </Card>
            </div>

            {/* Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Sidebar Filters */}
                <div className="space-y-6">
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <Filter size={16} className="text-blue-600" />
                            Filter by Category
                        </h3>
                        <div className="space-y-1">
                            <button
                                onClick={() => setFilterCategory('ALL')}
                                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                    filterCategory === 'ALL' 
                                    ? 'bg-blue-50 text-blue-700' 
                                    : 'text-slate-600 hover:bg-slate-50'
                                }`}
                            >
                                All Equipments
                            </button>
                            {CATEGORIES.map(cat => (
                                <button
                                    key={cat.value}
                                    onClick={() => setFilterCategory(cat.value)}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-3 transition-colors ${
                                        filterCategory === cat.value 
                                        ? 'bg-blue-50 text-blue-700' 
                                        : 'text-slate-600 hover:bg-slate-50'
                                    }`}
                                >
                                    <cat.icon size={16} className={filterCategory === cat.value ? 'text-blue-600' : 'text-slate-400'} />
                                    {cat.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="bg-blue-600 rounded-xl p-6 text-white shadow-xl shadow-blue-200 relative overflow-hidden">
                        <Monitor className="absolute -right-4 -bottom-4 w-24 h-24 opacity-10 rotate-12" />
                        <h4 className="font-bold mb-2">Inventory Insight</h4>
                        <p className="text-sm text-blue-100 mb-4">You have {stats.totalItems} distinct hardware assets registered in the hospital registry.</p>
                        <Button 
                            onClick={handleGenerateAssetReport}
                            className="w-full bg-white/20 hover:bg-white/30 border border-white/40 text-white font-bold backdrop-blur-sm transition-all"
                        >
                            Generate Asset Report
                        </Button>
                    </div>
                </div>

                {/* Main Table */}
                <div className="lg:col-span-3 space-y-4">
                    <div className="relative">
                        <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Search equipment by name or model..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl text-lg font-medium outline-none focus:ring-2 focus:ring-emerald-500/20 shadow-sm"
                        />
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 border-b border-slate-100">
                                    <tr>
                                        <th className="px-6 py-4 font-semibold text-slate-600 uppercase tracking-wider">Asset Item</th>
                                        <th className="px-6 py-4 font-semibold text-slate-600 uppercase tracking-wider">Category</th>
                                        <th className="px-6 py-4 font-semibold text-slate-600 uppercase tracking-wider text-center">Qty</th>
                                        <th className="px-6 py-4 font-semibold text-slate-600 uppercase tracking-wider">Purchase Cost</th>
                                        <th className="px-6 py-4 font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-4 font-semibold text-slate-600 uppercase tracking-wider text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center">
                                                <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-500" />
                                            </td>
                                        </tr>
                                    ) : sortedAndFiltered.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                                                <AlertCircle size={32} className="mx-auto mb-2 opacity-20" />
                                                No equipment found matching your criteria.
                                            </td>
                                        </tr>
                                    ) : (
                                        sortedAndFiltered.map((item) => (
                                            <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="font-bold text-slate-900 text-base">{item.name}</div>
                                                    <div className="text-xs text-slate-400">Purchased: {new Date(item.purchase_date).toLocaleDateString()}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                                        <span className="text-slate-600 font-medium">{CATEGORIES.find(c => c.value === item.category)?.label || item.category}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center font-bold text-slate-900">
                                                    {item.quantity}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="font-mono font-bold text-slate-900">₹{item.purchase_cost.toLocaleString()}</div>
                                                    <div className="text-[10px] text-slate-400">Total: ₹{(item.purchase_cost * item.quantity).toLocaleString()}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                                                        item.status === 'FUNCTIONAL' 
                                                        ? 'bg-emerald-100 text-emerald-700' 
                                                        : item.status === 'MAINTENANCE'
                                                        ? 'bg-amber-100 text-amber-700'
                                                        : 'bg-slate-100 text-slate-700'
                                                    }`}>
                                                        {item.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button 
                                                        onClick={() => handleDeleteEquipment(item.id)}
                                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
