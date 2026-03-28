import { useState, useEffect, useMemo } from 'react';
import { dataService as db } from '@/lib/dataService';
import { supabase } from '@/lib/supabase';
import { useHospital } from '@/context/HospitalContext';
import { 
    Loader2, 
    TrendingDown, 
    Plus, 
    Search, 
    Filter, 
    Calendar,
    Receipt,
    Trash2,
    AlertCircle,
    FileText
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/basic';
import { Button } from '@/components/ui/basic';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';

type ExpenseType = 'ONE_TIME' | 'RECURRING';

interface Expense {
    id: string;
    hospital_id: string;
    clinic_id: string | null;
    category: string;
    amount: number;
    description: string;
    expense_type: ExpenseType;
    expense_date: string;
    tax_percentage?: number;
    tax_amount?: number;
    receipt_url?: string | null;
    created_at: string;
}

export function ExpensesDashboard() {
    const { hospital, clinics } = useHospital();
    const { toast } = useToast();
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<'ALL' | 'ONE_TIME' | 'RECURRING'>('ALL');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        fetchExpenses();
    }, [hospital?.id]);

    const fetchExpenses = async () => {
        if (!hospital?.id) return;
        setLoading(true);
        try {
            const data = await db.list('other_expenses', {
                filters: [{ field: 'hospital_id', operator: '==', value: hospital.id }],
                sort: { column: 'expense_date', ascending: false }
            });
            setExpenses(data || []);
        } catch (error: any) {
            console.error('Error fetching expenses:', error);
            toast({ title: 'Error', description: 'Failed to load expenses', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const handleAddExpense = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!hospital?.id) return;

        setIsSubmitting(true);
        const formData = new FormData(e.currentTarget);
        
        const baseAmount = parseFloat(formData.get('amount') as string);
        const taxPercentage = parseFloat(formData.get('tax_percentage') as string) || 0;
        const taxAmount = (baseAmount * taxPercentage) / 100;
        
        let receiptUrl = '';
        const receiptFile = formData.get('receipt') as File;
        if (receiptFile && receiptFile.size > 0) {
            const fileExt = receiptFile.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = `${hospital.id}/${fileName}`;
            const { error: uploadError } = await supabase.storage.from('receipts').upload(filePath, receiptFile);
            if (!uploadError) {
                const { data } = supabase.storage.from('receipts').getPublicUrl(filePath);
                receiptUrl = data.publicUrl;
            }
        }
        
        const payload = {
            hospital_id: hospital.id,
            clinic_id: formData.get('clinic_id') || null,
            category: formData.get('category') as string,
            amount: baseAmount + taxAmount, // Total amount
            tax_percentage: taxPercentage,
            tax_amount: taxAmount,
            receipt_url: receiptUrl || null,
            description: formData.get('description') as string,
            expense_type: formData.get('expense_type') as ExpenseType,
            expense_date: formData.get('expense_date') as string,
        };

        try {
            await db.create('other_expenses', payload);
            
            toast({ title: 'Success', description: 'Expense recorded successfully' });
            setIsAddModalOpen(false);
            fetchExpenses();
        } catch (error: any) {
            toast({ title: 'Error', description: error.message || 'Failed to add expense', variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteExpense = async (id: string) => {
        if (!confirm('Are you sure you want to delete this expense record?')) return;

        try {
            await db.remove('other_expenses', id);
            toast({ title: 'Success', description: 'Expense record deleted' });
            setExpenses(expenses.filter(e => e.id !== id));
        } catch (error: any) {
            toast({ title: 'Error', description: 'Failed to delete record', variant: 'destructive' });
        }
    };

    const filteredExpenses = useMemo(() => {
        return expenses.filter(e => {
            const matchesSearch = e.category.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                 (e.description || '').toLowerCase().includes(searchQuery.toLowerCase());
            const matchesType = filterType === 'ALL' || e.expense_type === filterType;
            return matchesSearch && matchesType;
        });
    }, [expenses, searchQuery, filterType]);

    const totalStats = useMemo(() => {
        return filteredExpenses.reduce((acc, curr) => {
            if (curr.expense_type === 'ONE_TIME') acc.oneTime += curr.amount;
            else acc.recurring += curr.amount;
            acc.total += curr.amount;
            return acc;
        }, { oneTime: 0, recurring: 0, total: 0 });
    }, [filteredExpenses]);

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/60 pb-6">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Other Expenses</h1>
                    <p className="text-slate-500 mt-1">Track utility bills, maintenance, and miscellaneous costs</p>
                </div>

                <div className="flex items-center gap-3">
                    <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200">
                                <Plus className="w-4 h-4 mr-2" /> Record Expense
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[500px]">
                            <DialogHeader>
                                <DialogTitle>Record Other Expense</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleAddExpense} className="space-y-4 pt-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Category</label>
                                        <input 
                                            name="category" 
                                            required 
                                            placeholder="e.g. Electricity"
                                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Amount (₹)</label>
                                        <input 
                                            name="amount" 
                                            type="number" 
                                            step="0.01"
                                            required 
                                            placeholder="0.00"
                                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Tax % (Optional)</label>
                                        <input 
                                            name="tax_percentage" 
                                            type="number" 
                                            step="0.01"
                                            placeholder="e.g. 18"
                                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Receipt/Bill (Optional)</label>
                                        <input 
                                            name="receipt" 
                                            type="file" 
                                            accept="image/*,.pdf"
                                            className="w-full px-3 py-1.5 border rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Type</label>
                                        <select name="expense_type" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                                            <option value="RECURRING">Recurring (Monthly/Bills)</option>
                                            <option value="ONE_TIME">One-Time (Purchase)</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Date</label>
                                        <input 
                                            name="expense_date" 
                                            type="date" 
                                            required 
                                            defaultValue={new Date().toISOString().split('T')[0]}
                                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Description (Optional)</label>
                                    <textarea 
                                        name="description" 
                                        rows={2}
                                        placeholder="Note details about this expense..."
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Assign to Clinic (Optional)</label>
                                    <select name="clinic_id" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                                        <option value="">Hospital Wide / Global</option>
                                        {clinics.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="pt-4 flex justify-end gap-3">
                                    <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
                                    <Button type="submit" disabled={isSubmitting} className="bg-blue-600 text-white">
                                        {isSubmitting ? 'Recording...' : 'Record Expense'}
                                    </Button>
                                </div>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="border border-slate-200 shadow-sm bg-white overflow-hidden group">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between pb-2">
                            <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider">Total Expenses</h3>
                            <TrendingDown className="w-5 h-5 text-red-500 bg-red-50 p-1 rounded-md" />
                        </div>
                        <div className="text-4xl font-bold text-slate-900 group-hover:scale-105 transition-transform origin-left">
                            ₹{totalStats.total.toLocaleString()}
                        </div>
                        <p className="text-xs text-slate-400 mt-2 font-medium">Aggregate of all categories</p>
                    </CardContent>
                </Card>

                <Card className="border border-slate-200 shadow-sm bg-white overflow-hidden group">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between pb-2">
                            <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider">Recurring Bills</h3>
                            <Calendar className="w-5 h-5 text-blue-500 bg-blue-50 p-1 rounded-md" />
                        </div>
                        <div className="text-4xl font-bold text-slate-900 text-blue-600 group-hover:scale-105 transition-transform origin-left">
                            ₹{totalStats.recurring.toLocaleString()}
                        </div>
                        <p className="text-xs text-blue-600/70 mt-2 font-medium">Maintenance & Utilities</p>
                    </CardContent>
                </Card>

                <Card className="border border-slate-200 shadow-sm bg-white overflow-hidden group">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between pb-2">
                            <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider">One-Time Costs</h3>
                            <Receipt className="w-5 h-5 text-purple-500 bg-purple-50 p-1 rounded-md" />
                        </div>
                        <div className="text-4xl font-bold text-slate-900 text-purple-600 group-hover:scale-105 transition-transform origin-left">
                            ₹{totalStats.oneTime.toLocaleString()}
                        </div>
                        <p className="text-xs text-purple-600/70 mt-2 font-medium">Asset purchases & repairs</p>
                    </CardContent>
                </Card>
            </div>

            {/* Filters and Search */}
            <div className="flex flex-col md:flex-row items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="relative flex-1 w-full">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Search categories or descriptions..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <Filter className="w-4 h-4 text-slate-400" />
                    <div className="flex bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
                        {(['ALL', 'RECURRING', 'ONE_TIME'] as const).map(type => (
                            <button
                                key={type}
                                onClick={() => setFilterType(type)}
                                className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${filterType === type 
                                    ? 'bg-blue-600 text-white shadow-sm' 
                                    : 'text-slate-500 hover:bg-slate-50'}`}
                            >
                                {type.replace('_', ' ')}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Ledger Table */}
            <Card className="border border-slate-200 shadow-sm bg-white overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-4 font-semibold text-slate-600 uppercase tracking-wider">Date</th>
                                <th className="px-6 py-4 font-semibold text-slate-600 uppercase tracking-wider">Category</th>
                                <th className="px-6 py-4 font-semibold text-slate-600 uppercase tracking-wider">Clinic</th>
                                <th className="px-6 py-4 font-semibold text-slate-600 uppercase tracking-wider">Type</th>
                                <th className="px-6 py-4 font-semibold text-slate-600 uppercase tracking-wider">Amount</th>
                                <th className="px-6 py-4 font-semibold text-slate-600 uppercase tracking-wider">Receipt</th>
                                <th className="px-6 py-4 font-semibold text-slate-600 uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                                        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                                        Loading expenses...
                                    </td>
                                </tr>
                            ) : filteredExpenses.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                                        <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                        No expenses found.
                                    </td>
                                </tr>
                            ) : (
                                filteredExpenses.map((expense) => (
                                    <tr key={expense.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-6 py-4 text-slate-600">
                                            {new Date(expense.expense_date).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-slate-900">{expense.category}</div>
                                            <div className="text-xs text-slate-500 truncate max-w-[200px]">{expense.description}</div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-600">
                                            {clinics.find(c => c.id === expense.clinic_id)?.name || 'Global'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                                                expense.expense_type === 'RECURRING' 
                                                ? 'bg-blue-100 text-blue-700' 
                                                : 'bg-purple-100 text-purple-700'
                                            }`}>
                                                {expense.expense_type.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 font-mono font-bold text-slate-900 text-lg">
                                            ₹{expense.amount.toLocaleString()}
                                            {(expense.tax_amount || 0) > 0 && (
                                                <div className="text-xs font-normal text-slate-500 mt-1">
                                                    incl. ₹{expense.tax_amount?.toLocaleString()} ({expense.tax_percentage}%) tax
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            {expense.receipt_url && (
                                                <a href={expense.receipt_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 flex items-center justify-center gap-1 text-xs font-semibold bg-blue-50 px-2 py-1.5 rounded-md border border-blue-100 w-fit hover:bg-blue-100 transition-colors">
                                                    <FileText size={14} /> View
                                                </a>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button 
                                                onClick={() => handleDeleteExpense(expense.id)}
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
            </Card>
        </div>
    );
}
