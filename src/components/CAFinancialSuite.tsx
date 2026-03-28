import { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import { dataService as db } from '@/lib/dataService';
import { useHospital } from '@/context/HospitalContext';
import {
    Loader2,
    Calculator,
    FileText,
    History,
    Lock,
    TrendingUp,
    ArrowUpRight,
    ArrowDownLeft,
    Printer,
    Download,
    Calendar,
    Building2,
    Shield,
    Info,
    Receipt,
    Landmark,
    Upload,
    CheckCircle2,
    XCircle,
    Plus
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Badge } from '@/components/ui/basic';
import { Button } from '@/components/ui/basic';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
    Cell, PieChart, Pie
} from 'recharts';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogTrigger,
} from "@/components/ui/dialog";
// Basic UI components are correctly imported below

type BankEntry = {
    id?: string;
    entry_date: string;
    description: string;
    reference_no: string;
    debit: number;
    credit: number;
    running_balance: number;
    is_reconciled: boolean;
    reconciled_at?: string;
};


export function CAFinancialSuite() {
    const { profile } = useHospital();
    const { toast } = useToast();

    const [loading, setLoading] = useState(true);
    const [plData, setPlData] = useState<any>(null);
    const [bsData, setBsData] = useState<any>(null);
    const [ledger, setLedger] = useState<any[]>([]);

    // Fallback for missing date-fns
    const formatDate = (date: Date) => date.toISOString().split('T')[0];

    const [dateRange, setDateRange] = useState({
        start: formatDate(new Date(new Date().getFullYear(), 0, 1)),
        end: formatDate(new Date())
    });
    const [auditLocking, setAuditLocking] = useState(false);
    const [selectedDetail, setSelectedDetail] = useState<string | null>(null);
    const [isJvModalOpen, setIsJvModalOpen] = useState(false);
    const [isSubmittingJv, setIsSubmittingJv] = useState(false);
    const [taxReport, setTaxReport] = useState<{
        expenseTax: { category: string; base: number; tax_pct: number; tax_amt: number }[];
        procurementTax: { item_name: string; gst_rate: number; cgst: number; sgst: number; igst: number; total_tax: number }[];
        totalExpenseTax: number;
        totalProcurementTax: number;
    }>({
        expenseTax: [],
        procurementTax: [],
        totalExpenseTax: 0,
        totalProcurementTax: 0
    });
    const [bankEntries, setBankEntries] = useState<BankEntry[]>([]);
    const [isBrsModalOpen, setIsBrsModalOpen] = useState(false);
    const [isSubmittingBank, setIsSubmittingBank] = useState(false);

    const CHART_OF_ACCOUNTS = [
        { group: 'Assets', accounts: ['Cash', 'Bank Account', 'Accounts Receivable', 'Inventory', 'Fixed Assets'] },
        { group: 'Liabilities', accounts: ['Accounts Payable', 'Loans', 'Sundry Creditors'] },
        { group: 'Equity', accounts: ['Retained Earnings', 'Owner Capital'] },
        { group: 'Revenue', accounts: ['Sales Income', 'Consultation Fees', 'Other Income'] },
        { group: 'Expenses', accounts: ['Depreciation Expense', 'Rent Expense', 'Salary & Wages', 'Utility Bills', 'Medical Supplies', 'Miscellaneous Expense'] },
    ];

    const handleAddJournalEntry = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!profile?.hospital_id) return;

        setIsSubmittingJv(true);
        const formData = new FormData(e.currentTarget);
        const debitAccount = formData.get('debit_account') as string;
        const creditAccount = formData.get('credit_account') as string;
        const amount = parseFloat(formData.get('amount') as string);
        const narration = formData.get('narration') as string;
        const date = formData.get('date') as string;

        if (debitAccount === creditAccount) {
            toast({ variant: 'destructive', title: 'Invalid Entry', description: 'Debit and Credit accounts cannot be the same.' });
            setIsSubmittingJv(false);
            return;
        }

        try {
            // Determine entry_type based on account groups
            const getEntryType = (account: string) => {
                const revenueAccounts = ['Sales Income', 'Consultation Fees', 'Other Income'];
                const expenseAccounts = ['Depreciation Expense', 'Rent Expense', 'Salary & Wages', 'Utility Bills', 'Medical Supplies', 'Miscellaneous Expense'];
                if (revenueAccounts.includes(account)) return 'INCOME';
                if (expenseAccounts.includes(account)) return 'EXPENSE';
                return 'MANUAL'; // Updated from ADJUSTMENT to fit the new DB CHECK constraint
            };

            await Promise.all([
                db.create('financial_ledger', {
                    hospital_id: profile.hospital_id,
                    entry_date: date,
                    reference_id: undefined, // Manual entry has no source table
                    debit: amount,
                    credit: 0,
                    entry_type: getEntryType(debitAccount),
                    category: debitAccount,
                    description: `[JV] ${narration}`,
                    payment_mode: 'Journal',
                    audit_locked: false
                }),
                db.create('financial_ledger', {
                    hospital_id: profile.hospital_id,
                    entry_date: date,
                    reference_id: undefined,
                    debit: 0,
                    credit: amount,
                    entry_type: getEntryType(creditAccount),
                    category: creditAccount,
                    description: `[JV] ${narration}`,
                    payment_mode: 'Journal',
                    audit_locked: false
                })
            ]);
            toast({ title: 'Success', description: 'Journal entry posted successfully.' });
            setIsJvModalOpen(false);
            fetchData();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to post journal entry.' });
        } finally {
            setIsSubmittingJv(false);
        }
    };

    const handleExportCSV = () => {
        if (!ledger || ledger.length === 0) {
            toast({
                variant: "destructive",
                title: "No data to export",
                description: "The ledger is currently empty for the selected period."
            });
            return;
        }

        const headers = ["Date", "Description", "Category", "Debit", "Credit", "Status"];
        const rows = ledger.map(entry => [
            new Date(entry.entry_date).toLocaleDateString(),
            entry.description,
            entry.category,
            entry.debit,
            entry.credit,
            entry.audit_locked ? "Audited" : "Pending"
        ]);

        const csvContent = [
            headers.join(","),
            ...rows.map(row => row.map(value =>
                typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value
            ).join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `financial_ledger_${dateRange.end}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handlePrint = () => {
        window.print();
    };

    const fetchData = async () => {
        if (!profile?.hospital_id) return;
        setLoading(true);
        try {
            const [pl, bs, entries] = await Promise.all([
                db.getFinancialStatement(profile.hospital_id, 'PL', dateRange.end),
                db.getFinancialStatement(profile.hospital_id, 'BS', dateRange.end),
                db.getFinancialLedger(profile.hospital_id, {
                    startDate: dateRange.start,
                    endDate: dateRange.end
                })
            ]);
            setPlData(pl);
            setBsData(bs);
            setLedger(entries);
        } catch (error) {
            console.error('Fetch error:', error);
            toast({
                variant: "destructive",
                title: "Error fetching financial data",
                description: "Could not retrieve accounting records."
            });
        } finally {
            setLoading(false);
        }
    };

    const fetchTaxReport = async () => {
        if (!profile?.hospital_id) return;
        try {
            const [expenses, poItems] = await Promise.all([
                db.list('other_expenses', {
                    filters: [
                        { field: 'hospital_id', operator: '==', value: profile.hospital_id },
                        { field: 'expense_date', operator: '>=', value: dateRange.start },
                        { field: 'expense_date', operator: '<=', value: dateRange.end },
                    ]
                }),
                db.list('purchase_order_items', {
                    select: 'item_name, gst_rate, cgst_amount, sgst_amount, igst_amount'
                })
            ]);

            const expenseTax = (expenses || []).filter((e: any) => (e.tax_amount || 0) > 0).map((e: any) => ({
                category: e.category,
                base: e.amount - (e.tax_amount || 0),
                tax_pct: e.tax_percentage || 0,
                tax_amt: e.tax_amount || 0
            }));

            const procurementTax = (poItems || []).filter((i: any) => (i.cgst_amount || 0) + (i.sgst_amount || 0) + (i.igst_amount || 0) > 0).map((i: any) => ({
                item_name: i.item_name,
                gst_rate: i.gst_rate || 0,
                cgst: i.cgst_amount || 0,
                sgst: i.sgst_amount || 0,
                igst: i.igst_amount || 0,
                total_tax: (i.cgst_amount || 0) + (i.sgst_amount || 0) + (i.igst_amount || 0)
            }));

            setTaxReport({
                expenseTax,
                procurementTax,
                totalExpenseTax: expenseTax.reduce((s: number, e: any) => s + e.tax_amt, 0),
                totalProcurementTax: procurementTax.reduce((s: number, p: any) => s + p.total_tax, 0)
            });
        } catch (err) {
            console.error('Tax report fetch failed:', err);
        }
    };

    const fetchBankStatements = async () => {
        if (!profile?.hospital_id) return;
        try {
            const data = await db.list('bank_statements', {
                filters: [
                    { field: 'hospital_id', operator: '==', value: profile.hospital_id },
                    { field: 'entry_date', operator: '>=', value: dateRange.start },
                    { field: 'entry_date', operator: '<=', value: dateRange.end },
                ],
                sort: { column: 'entry_date', ascending: true }
            });
            setBankEntries(data || []);
        } catch (err) {
            setIsSubmittingJv(false);
            fetchData();
        }
    };

    const handleDownloadPDF = () => {
        if (!bsData || !plData) return;

        const doc = new jsPDF();
        const hospitalName = profile?.hospital_id?.split('-').map((s: string) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ') || 'Hospital';
        const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

        // --- PAGE 1: PROFIT & LOSS STATEMENT ---
        // Header
        doc.setFontSize(22);
        doc.setTextColor(15, 23, 42); // slate-900
        doc.text(hospitalName.toUpperCase(), 105, 20, { align: 'center' });

        doc.setFontSize(16);
        doc.text("AUDIT REPORT: PROFIT & LOSS STATEMENT", 105, 30, { align: 'center' });

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Period Ending: ${dateStr}`, 105, 38, { align: 'center' });
        doc.setLineWidth(0.5);
        doc.line(20, 42, 190, 42);

        let y = 55;
        const rowHeight = 8;
        const col1 = 25;
        const col2 = 140;

        // Income Section
        doc.setFontSize(14);
        doc.setTextColor(15, 23, 42);
        doc.setFont('helvetica', 'bold');
        doc.text("INCOME", 20, y);
        y += 10;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.text("Total Operational Revenue", col1, y);
        doc.text(`Rs. ${(plData.total_income || 0).toLocaleString()}`, col2, y);
        y += 15;

        // Expenses Section
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text("EXPENSES & EXPENDITURE", 20, y);
        y += 10;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);

        // Expense Breakdown
        const breakdownEntries = Object.entries(plData?.expense_breakdown || {});
        breakdownEntries.forEach(([category, amount]) => {
            if (y > 270) { doc.addPage(); y = 20; }
            doc.text(category, col1, y);
            doc.text(`Rs. ${(amount as number || 0).toLocaleString()}`, col2, y);
            y += rowHeight;
        });

        doc.setFont('helvetica', 'bold');
        doc.line(20, y, 190, y);
        y += 7;
        doc.text("TOTAL EXPENSES", col1, y);
        doc.text(`Rs. ${(plData.total_expense || 0).toLocaleString()}`, col2, y);
        y += 15;

        // Net Profit
        doc.setFillColor(240, 253, 244); // green-50
        doc.rect(20, y - 5, 170, 12, 'F');
        doc.setTextColor(21, 128, 61); // green-700
        doc.text("NET PROFIT / (LOSS)", col1, y + 2);
        doc.text(`Rs. ${(plData.net_profit || 0).toLocaleString()}`, col2, y + 2);

        // --- PAGE 2: BALANCE SHEET ---
        doc.addPage();
        y = 20;
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text("AUDIT REPORT: BALANCE SHEET", 105, y, { align: 'center' });
        y += 15;

        doc.setFontSize(14);
        doc.text("Statement of Financial Position", 20, y);
        y += 10;

        // Assets Header
        doc.setFontSize(12);
        doc.setFillColor(248, 250, 252);
        doc.rect(20, y, 170, 10, 'F');
        doc.text("ASSETS", col1, y + 7);
        doc.text("Amount (INR)", col2, y + 7);
        doc.setFont('helvetica', 'normal');
        y += 12;

        const assets = [
            { label: "Inventory (Medicines & Consumables)", value: bsData?.breakdown?.inventory || 0 },
            { label: "Fixed Assets (Hospital Equipment)", value: bsData?.breakdown?.equipment || 0 },
            { label: "Cash & Bank Balances", value: bsData?.breakdown?.cash || 0 }
        ];

        assets.forEach(asset => {
            doc.text(asset.label, col1, y);
            doc.text(`Rs. ${(asset.value || 0).toLocaleString()}`, col2, y);
            y += rowHeight;
        });

        doc.setFont('helvetica', 'bold');
        doc.line(20, y, 190, y);
        y += 7;
        doc.text("TOTAL ASSETS", col1, y);
        doc.text(`Rs. ${(bsData.total_assets || 0).toLocaleString()}`, col2, y);
        y += 15;

        // Liabilities Header
        doc.setFillColor(248, 250, 252);
        doc.rect(20, y, 170, 10, 'F');
        doc.text("LIABILITIES & EQUITY", col1, y + 7);
        doc.text("Amount (INR)", col2, y + 7);
        doc.setFont('helvetica', 'normal');
        y += 12;

        const liabilities = [
            { label: "Accounts Payable (Sundry Creditors)", value: bsData?.total_liabilities || 0 },
            { label: "Initial Capital (Net Worth)", value: (bsData?.equity || 0) - (plData?.net_profit || 0) },
            { label: "Retained Earnings (Period Profit)", value: plData?.net_profit || 0 }
        ];

        liabilities.forEach(liab => {
            doc.text(liab.label, col1, y);
            doc.text(`Rs. ${(liab.value || 0).toLocaleString()}`, col2, y);
            y += rowHeight;
        });

        const totalLiabilities = (bsData?.total_liabilities || 0) + (bsData?.equity || 0);
        doc.setFont('helvetica', 'bold');
        doc.line(20, y, 190, y);
        y += 7;
        doc.text("TOTAL LIABILITIES & EQUITY", col1, y);
        doc.text(`Rs. ${totalLiabilities.toLocaleString()}`, col2, y);
        y += 20;

        // Notes to Accounts
        doc.setFontSize(14);
        doc.text("NOTES TO ACCOUNTS (AUDIT EXPLANATIONS)", 20, y);
        y += 10;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');

        const notes = [
            `1. OPERATIONAL REVENUE: Represents total collections registered in the financial ledger up to ${dateStr}.`,
            "2. PROCUREMENT PURCHASES: Includes all costs from verified Purchase Orders (Received/Completed status).",
            "3. EQUIPMENT ASSETS: Capital expenditure on medical devices and hospital furniture, recorded at purchase value.",
            "4. INVENTORY VALUATION: Current market value of stock based on recent purchase prices.",
            "5. CASH & BANK: Consolidated liquid assets including physical cash counters and reconciled bank statements.",
            "6. SUNDRY CREDITORS: Outstanding dues to suppliers for medicines and consumables.",
            "7. EQUITY ADJUSTMENT: Initial Capital is adjusted for any prior period drawings or injections.",
            "8. COMPLIANCE: This report is generated from real-time database audits and follows standard accounting principles."
        ];

        notes.forEach(note => {
            if (y > 275) { doc.addPage(); y = 20; }
            doc.text(note, 20, y);
            y += 6;
        });

        // Footer on all pages would be complex, just add to last page
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text("This is a computer-generated audit document. No signature required.", 105, 285, { align: 'center' });

        doc.save(`${hospitalName}_Audit_Report_${dateStr}.pdf`);
        toast({ title: 'PDF Exported', description: 'Comprehensive audit report has been downloaded.' });
    };

    const handleAddBankEntry = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!profile?.hospital_id) return;
        setIsSubmittingBank(true);
        const fd = new FormData(e.currentTarget);
        try {
            await db.create('bank_statements', {
                hospital_id: profile.hospital_id,
                entry_date: fd.get('b_date') as string,
                description: fd.get('b_desc') as string,
                reference_no: fd.get('b_ref') as string,
                debit: parseFloat(fd.get('b_debit') as string) || 0,
                credit: parseFloat(fd.get('b_credit') as string) || 0,
                running_balance: parseFloat(fd.get('b_balance') as string) || 0,
                is_reconciled: false
            });
            toast({ title: 'Saved', description: 'Bank entry recorded.' });
            setIsBrsModalOpen(false);
            fetchBankStatements();
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not save bank entry.' });
        } finally {
            setIsSubmittingBank(false);
        }
    };

    const handleToggleReconciled = async (entry: BankEntry) => {
        if (!entry.id) return;
        try {
            await db.update('bank_statements', entry.id, {
                is_reconciled: !entry.is_reconciled,
                reconciled_at: !entry.is_reconciled ? new Date().toISOString() : null
            });
            fetchBankStatements();
        } catch (err) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not update reconciliation status.' });
        }
    };

    const handleImportBankCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !profile?.hospital_id) return;
        const reader = new FileReader();
        reader.onload = async (ev) => {
            try {
                const text = ev.target?.result as string;
                const lines = text.trim().split('\n');
                const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
                const dateIdx = headers.findIndex(h => h.includes('date'));
                const descIdx = headers.findIndex(h => h.includes('desc') || h.includes('narration') || h.includes('particular'));
                const refIdx = headers.findIndex(h => h.includes('ref') || h.includes('chq') || h.includes('cheque'));
                const debIdx = headers.findIndex(h => h.includes('debit') || h.includes('withdrawal'));
                const credIdx = headers.findIndex(h => h.includes('credit') || h.includes('deposit'));
                const balIdx = headers.findIndex(h => h.includes('balance'));

                if (dateIdx === -1 || descIdx === -1) {
                    toast({ variant: 'destructive', title: 'Invalid CSV', description: 'CSV must have at least Date and Description columns.' });
                    return;
                }

                const rows = lines.slice(1).filter(l => l.trim()).map(line => {
                    const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
                    return {
                        hospital_id: profile.hospital_id,
                        entry_date: cols[dateIdx] || new Date().toISOString().split('T')[0],
                        description: cols[descIdx] || '',
                        reference_no: refIdx >= 0 ? cols[refIdx] : '',
                        debit: debIdx >= 0 ? parseFloat(cols[debIdx]) || 0 : 0,
                        credit: credIdx >= 0 ? parseFloat(cols[credIdx]) || 0 : 0,
                        running_balance: balIdx >= 0 ? parseFloat(cols[balIdx]) || 0 : 0,
                        is_reconciled: false
                    };
                });

                if (rows.length > 0) {
                    await db.createMany('bank_statements', rows);
                    toast({ title: 'Import Complete', description: `${rows.length} entries imported.` });
                    fetchBankStatements();
                }
            } catch (err) {
                toast({ variant: 'destructive', title: 'Import Failed', description: 'Could not parse CSV file.' });
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    useEffect(() => {
        fetchData();
        fetchTaxReport();
        fetchBankStatements();
    }, [profile?.hospital_id, dateRange]);

    const handleLockAudit = async () => {
        if (!profile?.hospital_id) return;
        setAuditLocking(true);
        try {
            await db.updateAuditLock(profile.hospital_id, dateRange.end);
            toast({
                title: "Audit Locked",
                description: `All transactions up to ${dateRange.end} are now locked for auditing.`
            });
            fetchData();
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Locking Failed",
                description: "Could not lock the audit records."
            });
        } finally {
            setAuditLocking(false);
        }
    };

    if (loading && !plData) {
        return (
            <div className="flex items-center justify-center p-24">
                <Loader2 className="w-12 h-12 animate-spin text-indigo-500" />
            </div>
        );
    }

    const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

    return (
        <div className="p-4 md:p-8 max-w-[1400px] mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Header Section */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                        <Calculator className="w-8 h-8 text-indigo-600" />
                        CA Financial Suite
                    </h1>
                    <p className="text-slate-500 mt-1">Professional Balance Sheet & Audit Reporting</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <input
                            type="date"
                            className="text-sm bg-transparent border-none focus:ring-0"
                            value={dateRange.start}
                            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                        />
                        <span className="text-slate-300">to</span>
                        <input
                            type="date"
                            className="text-sm bg-transparent border-none focus:ring-0"
                            value={dateRange.end}
                            onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                        />
                    </div>

                    <Button variant="outline" size="icon" onClick={fetchData} className="shadow-sm">
                        <History className="w-4 h-4" />
                    </Button>

                    <Button
                        onClick={handleLockAudit}
                        disabled={auditLocking}
                        className="bg-slate-900 hover:bg-slate-800 text-white shadow-md transition-all active:scale-95"
                    >
                        {auditLocking ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Lock className="w-4 h-4 mr-2" />}
                        Lock Audit
                    </Button>
                </div>
            </header>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card
                    className="border-none shadow-xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white cursor-pointer hover:scale-[1.02] transition-transform"
                    onClick={() => setSelectedDetail('net_profit')}
                >
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                            <p className="text-indigo-100 font-medium">Net Profit (YTD)</p>
                            <TrendingUp className="w-5 h-5 text-indigo-400" />
                        </div>
                        <h3 className="text-2xl font-bold mt-2">₹{(plData?.net_profit || 0).toLocaleString()}</h3>
                        <div className="flex items-center gap-1 mt-4 text-sm text-indigo-100 bg-white/10 w-fit px-2 py-0.5 rounded-full">
                            <Info className="w-3 h-3" />
                            <span>Click for Details</span>
                        </div>
                    </CardContent>
                </Card>

                <Card
                    className="border-none shadow-sm bg-white ring-1 ring-slate-100 cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => setSelectedDetail('total_assets')}
                >
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                            <p className="text-slate-500 font-medium">Total Assets</p>
                            <Building2 className="w-5 h-5 text-indigo-500" />
                        </div>
                        <h3 className="text-2xl font-bold mt-2">₹{(bsData?.total_assets || 0).toLocaleString()}</h3>
                        <p className="text-xs text-slate-400 mt-4 leading-relaxed font-medium">Inventory, Fixed Assets & Cash</p>
                    </CardContent>
                </Card>

                <Card
                    className="border-none shadow-sm bg-white ring-1 ring-slate-100 cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => setSelectedDetail('income')}
                >
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                            <p className="text-slate-500 font-medium">Total Income</p>
                            <ArrowUpRight className="w-5 h-5 text-emerald-500" />
                        </div>
                        <h3 className="text-2xl font-bold mt-2">₹{(plData?.total_income || 0).toLocaleString()}</h3>
                        <p className="text-xs text-slate-400 mt-4 leading-relaxed font-medium">Gross revenue for period</p>
                    </CardContent>
                </Card>

                <Card
                    className="border-none shadow-sm bg-white ring-1 ring-slate-100 cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => setSelectedDetail('expense')}
                >
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                            <p className="text-slate-500 font-medium">Total Expenses</p>
                            <ArrowDownLeft className="w-5 h-5 text-rose-500" />
                        </div>
                        <h3 className="text-2xl font-bold mt-2 text-rose-600">₹{(plData?.total_expense || 0).toLocaleString()}</h3>
                        <p className="text-xs text-slate-400 mt-4 leading-relaxed font-medium">Operating costs & Purchases</p>
                    </CardContent>
                </Card>
            </div>

            {/* Main Tabs Container */}
            <Tabs defaultValue="pl" className="w-full">
                <TabsList className="bg-slate-100/50 p-1 rounded-xl mb-6 flex items-center justify-start w-fit border border-slate-200">
                    <TabsTrigger value="pl" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-md">
                        <TrendingUp className="w-4 h-4 mr-2" />
                        Profit & Loss
                    </TabsTrigger>
                    <TabsTrigger value="bs" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-md">
                        <FileText className="w-4 h-4 mr-2" />
                        Balance Sheet
                    </TabsTrigger>
                    <TabsTrigger value="ledger" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-md">
                        <History className="w-4 h-4 mr-2" />
                        Financial Ledger
                    </TabsTrigger>
                    <TabsTrigger value="tax" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-md">
                        <Receipt className="w-4 h-4 mr-2" />
                        Tax Report
                    </TabsTrigger>
                    <TabsTrigger value="brs" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-md">
                        <Landmark className="w-4 h-4 mr-2" />
                        Bank Reconciliation
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="pl" className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <Card className="lg:col-span-2 border-none shadow-sm">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-lg font-semibold">Expense Breakdown</CardTitle>
                            </CardHeader>
                            <CardContent className="h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={Object.entries(plData?.expense_breakdown || {}).map(([name, value]) => ({ name, value: Math.abs(value as number) }))}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} />
                                        <YAxis axisLine={false} tickLine={false} />
                                        <RechartsTooltip
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                            cursor={{ fill: '#f8fafc' }}
                                        />
                                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                            {Object.entries(plData?.expense_breakdown || {}).map((_, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        <Card className="border-none shadow-sm">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-lg font-semibold">Income Sources</CardTitle>
                            </CardHeader>
                            <CardContent className="flex flex-col items-center justify-center pt-4">
                                <div className="h-[200px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={
                                                    (plData?.total_income || 0) > 0
                                                        ? [{ name: 'Sales Income', value: plData.total_income }]
                                                        : [{ name: 'No Income Recorded', value: 1 }]
                                                }
                                                innerRadius={60}
                                                outerRadius={80}
                                                paddingAngle={5}
                                                dataKey="value"
                                            >
                                                <Cell fill={(plData?.income || 0) > 0 ? "#6366f1" : "#f1f5f9"} />
                                            </Pie>
                                            <RechartsTooltip
                                                formatter={(value: any, name?: string) => [
                                                    name === 'No Income Recorded' ? '₹0' : `₹${value.toLocaleString()}`,
                                                    name || ''
                                                ]}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="w-full space-y-3 mt-4">
                                    <div className="flex items-center justify-between text-sm">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full bg-indigo-500" />
                                            <span className="text-slate-600">Sales Income</span>
                                        </div>
                                        <span className="font-semibold text-slate-900">₹{(plData?.total_income || 0).toLocaleString()}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full bg-indigo-100" />
                                            <span className="text-slate-400 italic">Others</span>
                                        </div>
                                        <span className="font-semibold text-slate-400">₹0</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="bs" className="space-y-6">
                    <Card className="border-none shadow-sm overflow-hidden">
                        <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white">
                            <div>
                                <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                                    <Calculator className="w-8 h-8 text-indigo-600" />
                                    BALANCE SHEET
                                </h2>
                                <p className="text-slate-500 font-medium">Financial Position as of {new Date().toLocaleDateString()}</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <Button
                                    variant="outline"
                                    className="border-2 border-indigo-100 font-bold gap-2 text-indigo-700 hover:bg-indigo-50 h-10 shadow-sm"
                                    onClick={handleDownloadPDF}
                                >
                                    <Download className="w-4 h-4" />
                                    Download Audit Report (PDF)
                                </Button>
                                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 py-1.5 px-4 font-bold shadow-sm">
                                    Audit Ready
                                </Badge>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
                            {/* Assets Side */}
                            <div className="p-8 space-y-6">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xl font-bold text-slate-900 underline decoration-indigo-300 decoration-4 underline-offset-4">Assets</h3>
                                    <Badge variant="outline" className="text-indigo-600 bg-indigo-50 border-indigo-100">Application of Funds</Badge>
                                </div>

                                <div className="space-y-4">
                                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex justify-between items-center group hover:bg-white hover:shadow-md transition-all">
                                        <div>
                                            <p className="font-bold text-slate-900">Inventory Stock</p>
                                            <p className="text-xs text-slate-400">Valued at Cost Price</p>
                                        </div>
                                        <span className="text-lg font-bold text-indigo-600">₹{(bsData?.breakdown?.inventory || 0).toLocaleString()}</span>
                                    </div>
                                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex justify-between items-center group hover:bg-white hover:shadow-md transition-all">
                                        <div>
                                            <p className="font-bold text-slate-900">Fixed Assets</p>
                                            <p className="text-xs text-slate-400">Equipments & Machines (WDV)</p>
                                        </div>
                                        <span className="text-lg font-bold text-indigo-600">₹{(bsData?.breakdown?.equipment || 0).toLocaleString()}</span>
                                    </div>
                                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex justify-between items-center group hover:bg-white hover:shadow-md transition-all">
                                        <div>
                                            <p className="font-bold text-slate-900">Cash & Bank</p>
                                            <p className="text-xs text-slate-400">Liquidity available</p>
                                        </div>
                                        <span className={`text-lg font-bold ${(bsData?.breakdown?.cash || 0) < 0 ? 'text-rose-600' : 'text-indigo-600'}`}>
                                            ₹{(bsData?.breakdown?.cash || 0).toLocaleString()}
                                        </span>
                                    </div>
                                </div>

                                <div className="pt-6 border-t border-slate-100 flex justify-between items-center">
                                    <span className="text-lg font-black text-slate-900 italic">TOTAL ASSETS</span>
                                    <span className="text-2xl font-black text-slate-900">₹{(bsData?.total_assets || 0).toLocaleString()}</span>
                                </div>
                            </div>

                            {/* Liabilities & Equity Side */}
                            <div className="p-8 space-y-6 bg-slate-50/30">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xl font-bold text-slate-900 underline decoration-rose-300 decoration-4 underline-offset-4">Liabilities & Equity</h3>
                                    <Badge variant="outline" className="text-rose-600 bg-rose-50 border-rose-100">Sources of Funds</Badge>
                                </div>

                                <div className="space-y-4">
                                    <div className="p-4 rounded-xl bg-white border border-slate-100 flex justify-between items-center group hover:shadow-md transition-all">
                                        <div>
                                            <p className="font-bold text-slate-900">Retained Earnings</p>
                                            <p className="text-xs text-slate-400">Net Profit after all taxes</p>
                                        </div>
                                        <span className={`text-lg font-bold ${(plData?.net_profit || 0) < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                            ₹{(plData?.net_profit || 0).toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="p-4 rounded-xl bg-white border border-slate-100 flex justify-between items-center group hover:shadow-md transition-all">
                                        <div>
                                            <p className="font-bold text-slate-900">Sundry Creditors</p>
                                            <p className="text-xs text-slate-400">Dues to Suppliers</p>
                                        </div>
                                        <span className={`text-lg font-bold ${(bsData?.total_liabilities || 0) < 0 ? 'text-emerald-600' : 'text-slate-900'}`}>
                                            ₹{(bsData?.total_liabilities || 0).toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="p-4 rounded-xl bg-white border border-slate-100 flex justify-between items-center group hover:shadow-md transition-all">
                                        <div>
                                            <p className="font-bold text-slate-900">Initial Capital</p>
                                            <p className="text-xs text-slate-400">Hospital Owner Investment</p>
                                        </div>
                                        <span className="text-lg font-bold text-slate-900">
                                            ₹{((bsData?.equity || 0) - (plData?.net_profit || 0)).toLocaleString()}
                                        </span>
                                    </div>
                                </div>

                                <div className="pt-6 border-t border-slate-100 flex justify-between items-center">
                                    <span className="text-lg font-black text-slate-900 italic uppercase">TOTAL LIABILITIES & EQUITY</span>
                                    <span className="text-2xl font-black text-slate-900">
                                        ₹{((bsData?.total_liabilities || 0) + (bsData?.equity || 0)).toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </Card>
                </TabsContent>

                <TabsContent value="ledger" className="space-y-6">
                    <Card className="border-none shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100">
                            <div>
                                <CardTitle className="text-lg font-bold">Transaction History</CardTitle>
                                <p className="text-xs text-slate-400 uppercase tracking-widest mt-0.5">Double-Entry Logging</p>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <Dialog open={isJvModalOpen} onOpenChange={setIsJvModalOpen}>
                                    <DialogTrigger asChild>
                                        <Button size="sm" className="h-8 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
                                            <Calculator className="w-3.5 h-3.5 mr-2" /> New Journal Entry
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-[500px]">
                                        <DialogHeader>
                                            <DialogTitle>Add Manual Journal Voucher</DialogTitle>
                                            <DialogDescription>Record adjusting entries, depreciation, and custom ledger postings.</DialogDescription>
                                        </DialogHeader>
                                        <form onSubmit={handleAddJournalEntry} className="space-y-4 pt-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Debit Account (Dr)</label>
                                                    <select name="debit_account" required className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium">
                                                        <option value="">Select Account...</option>
                                                        {CHART_OF_ACCOUNTS.map(group => (
                                                            <optgroup key={group.group} label={group.group}>
                                                                {group.accounts.map(acc => (
                                                                    <option key={acc} value={acc}>{acc}</option>
                                                                ))}
                                                            </optgroup>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Credit Account (Cr)</label>
                                                    <select name="credit_account" required className="w-full px-3 py-2 border border-rose-200 rounded-lg focus:ring-2 focus:ring-rose-500 outline-none text-sm font-medium">
                                                        <option value="">Select Account...</option>
                                                        {CHART_OF_ACCOUNTS.map(group => (
                                                            <optgroup key={`cr-${group.group}`} label={group.group}>
                                                                {group.accounts.map(acc => (
                                                                    <option key={`cr-${acc}`} value={acc}>{acc}</option>
                                                                ))}
                                                            </optgroup>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Amount (₹)</label>
                                                    <input name="amount" type="number" step="0.01" min="0.01" required placeholder="0.00" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-mono" />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Posting Date</label>
                                                    <input name="date" type="date" required defaultValue={dateRange.end} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                                                </div>
                                            </div>
                                            <div className="space-y-2 border-t pt-4 mt-2">
                                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Narration / Description</label>
                                                <textarea name="narration" required rows={2} placeholder="Being depreciation charged on machinery for FY 25-26..." className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"></textarea>
                                            </div>
                                            <div className="flex justify-end gap-3 pt-2">
                                                <Button type="button" variant="outline" onClick={() => setIsJvModalOpen(false)}>Cancel</Button>
                                                <Button type="submit" disabled={isSubmittingJv} className="bg-indigo-600 text-white">
                                                    {isSubmittingJv ? 'Posting...' : 'Post Entry'}
                                                </Button>
                                            </div>
                                        </form>
                                    </DialogContent>
                                </Dialog>
                                <Button variant="outline" size="sm" className="h-8 shadow-sm" onClick={handleExportCSV}>
                                    <Download className="w-3.5 h-3.5 mr-2" /> Export CSV
                                </Button>
                                <Button variant="outline" size="sm" className="h-8 shadow-sm" onClick={handlePrint}>
                                    <Printer className="w-3.5 h-3.5 mr-2" /> Print
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50/80 border-b border-slate-100">
                                            <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Date</th>
                                            <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Description</th>
                                            <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Debit (Payment / Asset Add)</th>
                                            <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Credit (Receipt / Income)</th>
                                            <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {ledger.map((entry) => (
                                            <tr key={entry.id} className="hover:bg-slate-50/50 transition-colors group">
                                                <td className="px-6 py-4 text-sm font-medium text-slate-900">
                                                    {new Date(entry.entry_date).toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-bold text-slate-800">{entry.category}</span>
                                                        <span className="text-xs text-slate-400 line-clamp-1">{entry.description}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-sm font-bold text-rose-600 text-right">
                                                    {entry.debit > 0 ? `₹${entry.debit.toLocaleString()}` : '—'}
                                                </td>
                                                <td className="px-6 py-4 text-sm font-bold text-emerald-600 text-right">
                                                    {entry.credit > 0 ? `₹${entry.credit.toLocaleString()}` : '—'}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    {entry.audit_locked ? (
                                                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none">
                                                            <Shield className="w-3 h-3 mr-1" /> Audited
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="text-slate-400 border-slate-100">
                                                            Pending
                                                        </Badge>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                        {ledger.length === 0 && (
                                            <tr>
                                                <td colSpan={5} className="px-6 py-24 text-center text-slate-400 italic">
                                                    No ledger entries found for this period.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Tax Report Tab */}
                <TabsContent value="tax" className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card className="border-none shadow-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white">
                            <CardContent className="p-6">
                                <p className="text-amber-100 font-medium text-sm">Input GST (Procurement)</p>
                                <h3 className="text-3xl font-bold mt-2">₹{taxReport.totalProcurementTax.toLocaleString()}</h3>
                                <p className="text-xs text-amber-200 mt-3">Tax paid on purchases from suppliers</p>
                            </CardContent>
                        </Card>
                        <Card className="border-none shadow-xl bg-gradient-to-br from-rose-500 to-pink-500 text-white">
                            <CardContent className="p-6">
                                <p className="text-rose-100 font-medium text-sm">Expense Tax</p>
                                <h3 className="text-3xl font-bold mt-2">₹{taxReport.totalExpenseTax.toLocaleString()}</h3>
                                <p className="text-xs text-rose-200 mt-3">Tax on operational expenses</p>
                            </CardContent>
                        </Card>
                        <Card className="border-none shadow-xl bg-gradient-to-br from-slate-700 to-slate-900 text-white">
                            <CardContent className="p-6">
                                <p className="text-slate-300 font-medium text-sm">Total Tax Outflow</p>
                                <h3 className="text-3xl font-bold mt-2">₹{(taxReport.totalProcurementTax + taxReport.totalExpenseTax).toLocaleString()}</h3>
                                <p className="text-xs text-slate-400 mt-3">Combined tax liability for the period</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Procurement Tax Table */}
                    <Card className="border-none shadow-sm">
                        <CardHeader className="border-b border-slate-100">
                            <CardTitle className="text-lg font-bold flex items-center gap-2">
                                <Receipt className="w-5 h-5 text-amber-500" />
                                Input GST Register (Procurement)
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50/80 border-b border-slate-100">
                                            <th className="px-6 py-3 text-xs font-black text-slate-400 uppercase tracking-widest">Item Name</th>
                                            <th className="px-6 py-3 text-xs font-black text-slate-400 uppercase tracking-widest text-right">GST Rate</th>
                                            <th className="px-6 py-3 text-xs font-black text-slate-400 uppercase tracking-widest text-right">CGST</th>
                                            <th className="px-6 py-3 text-xs font-black text-slate-400 uppercase tracking-widest text-right">SGST</th>
                                            <th className="px-6 py-3 text-xs font-black text-slate-400 uppercase tracking-widest text-right">IGST</th>
                                            <th className="px-6 py-3 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Total Tax</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {taxReport.procurementTax.map((item, i) => (
                                            <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-6 py-3 text-sm font-medium text-slate-900">{item.item_name}</td>
                                                <td className="px-6 py-3 text-sm text-right font-mono">{item.gst_rate}%</td>
                                                <td className="px-6 py-3 text-sm text-right font-mono">₹{item.cgst.toLocaleString()}</td>
                                                <td className="px-6 py-3 text-sm text-right font-mono">₹{item.sgst.toLocaleString()}</td>
                                                <td className="px-6 py-3 text-sm text-right font-mono">₹{item.igst.toLocaleString()}</td>
                                                <td className="px-6 py-3 text-sm text-right font-mono font-bold text-amber-600">₹{item.total_tax.toLocaleString()}</td>
                                            </tr>
                                        ))}
                                        {taxReport.procurementTax.length === 0 && (
                                            <tr><td colSpan={6} className="px-6 py-10 text-center text-slate-400 italic">No procurement tax entries found.</td></tr>
                                        )}
                                    </tbody>
                                    {taxReport.procurementTax.length > 0 && (
                                        <tfoot>
                                            <tr className="bg-amber-50 border-t-2 border-amber-200">
                                                <td colSpan={5} className="px-6 py-3 text-sm font-black text-amber-800 text-right">TOTAL INPUT GST</td>
                                                <td className="px-6 py-3 text-sm font-black text-amber-800 text-right">₹{taxReport.totalProcurementTax.toLocaleString()}</td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Expense Tax Table */}
                    <Card className="border-none shadow-sm">
                        <CardHeader className="border-b border-slate-100">
                            <CardTitle className="text-lg font-bold flex items-center gap-2">
                                <Receipt className="w-5 h-5 text-rose-500" />
                                Expense Tax Register
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50/80 border-b border-slate-100">
                                            <th className="px-6 py-3 text-xs font-black text-slate-400 uppercase tracking-widest">Expense Category</th>
                                            <th className="px-6 py-3 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Base Amount</th>
                                            <th className="px-6 py-3 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Tax %</th>
                                            <th className="px-6 py-3 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Tax Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {taxReport.expenseTax.map((item, i) => (
                                            <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-6 py-3 text-sm font-medium text-slate-900">{item.category}</td>
                                                <td className="px-6 py-3 text-sm text-right font-mono">₹{item.base.toLocaleString()}</td>
                                                <td className="px-6 py-3 text-sm text-right font-mono">{item.tax_pct}%</td>
                                                <td className="px-6 py-3 text-sm text-right font-mono font-bold text-rose-600">₹{item.tax_amt.toLocaleString()}</td>
                                            </tr>
                                        ))}
                                        {taxReport.expenseTax.length === 0 && (
                                            <tr><td colSpan={4} className="px-6 py-10 text-center text-slate-400 italic">No expense tax entries found.</td></tr>
                                        )}
                                    </tbody>
                                    {taxReport.expenseTax.length > 0 && (
                                        <tfoot>
                                            <tr className="bg-rose-50 border-t-2 border-rose-200">
                                                <td colSpan={3} className="px-6 py-3 text-sm font-black text-rose-800 text-right">TOTAL EXPENSE TAX</td>
                                                <td className="px-6 py-3 text-sm font-black text-rose-800 text-right">₹{taxReport.totalExpenseTax.toLocaleString()}</td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Bank Reconciliation Tab */}
                <TabsContent value="brs" className="space-y-6">
                    {/* BRS Summary Cards */}
                    {(() => {
                        const bookBalance = (bsData?.cash_balance || 0);
                        const bankTotalCredit = bankEntries.reduce((s, e) => s + (e.credit || 0), 0);
                        const bankTotalDebit = bankEntries.reduce((s, e) => s + (e.debit || 0), 0);
                        const bankBalance = bankEntries.length > 0
                            ? bankEntries[bankEntries.length - 1].running_balance
                            : (bankTotalCredit - bankTotalDebit);
                        const reconciledCount = bankEntries.filter(e => e.is_reconciled).length;
                        const unreconciledCount = bankEntries.length - reconciledCount;
                        const unreconciledDiff = bankEntries.filter(e => !e.is_reconciled).reduce((s, e) => s + (e.credit - e.debit), 0);

                        return (
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                <Card className="border-none shadow-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white">
                                    <CardContent className="p-6">
                                        <p className="text-indigo-100 font-medium text-sm">Balance as per Books</p>
                                        <h3 className="text-3xl font-bold mt-2">₹{bookBalance.toLocaleString()}</h3>
                                        <p className="text-xs text-indigo-200 mt-3">Cash & Bank ledger balance</p>
                                    </CardContent>
                                </Card>
                                <Card className="border-none shadow-xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white">
                                    <CardContent className="p-6">
                                        <p className="text-teal-100 font-medium text-sm">Balance as per Bank</p>
                                        <h3 className="text-3xl font-bold mt-2">₹{bankBalance.toLocaleString()}</h3>
                                        <p className="text-xs text-teal-200 mt-3">From bank statement entries</p>
                                    </CardContent>
                                </Card>
                                <Card className="border-none shadow-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white">
                                    <CardContent className="p-6">
                                        <p className="text-amber-100 font-medium text-sm">Unreconciled Diff</p>
                                        <h3 className="text-3xl font-bold mt-2">₹{Math.abs(unreconciledDiff).toLocaleString()}</h3>
                                        <p className="text-xs text-amber-200 mt-3">{unreconciledCount} entries pending</p>
                                    </CardContent>
                                </Card>
                                <Card className="border-none shadow-xl bg-gradient-to-br from-slate-600 to-slate-900 text-white">
                                    <CardContent className="p-6">
                                        <p className="text-slate-300 font-medium text-sm">Reconciliation Progress</p>
                                        <h3 className="text-3xl font-bold mt-2">{bankEntries.length > 0 ? Math.round((reconciledCount / bankEntries.length) * 100) : 0}%</h3>
                                        <div className="w-full bg-white/20 rounded-full h-2 mt-3">
                                            <div className="bg-emerald-400 h-2 rounded-full transition-all" style={{ width: `${bankEntries.length > 0 ? (reconciledCount / bankEntries.length) * 100 : 0}%` }} />
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        );
                    })()}

                    {/* BRS Transactions Table */}
                    <Card className="border-none shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100">
                            <div>
                                <CardTitle className="text-lg font-bold flex items-center gap-2">
                                    <Landmark className="w-5 h-5 text-indigo-500" />
                                    Bank Statement Entries
                                </CardTitle>
                                <p className="text-xs text-slate-400 uppercase tracking-widest mt-0.5">Click checkmark to reconcile</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Dialog open={isBrsModalOpen} onOpenChange={setIsBrsModalOpen}>
                                    <DialogTrigger asChild>
                                        <Button size="sm" className="h-8 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
                                            <Plus className="w-3.5 h-3.5 mr-2" /> Add Entry
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-[520px]">
                                        <DialogHeader>
                                            <DialogTitle>Add Bank Statement Entry</DialogTitle>
                                            <DialogDescription>Record a transaction from your bank passbook or statement.</DialogDescription>
                                        </DialogHeader>
                                        <form onSubmit={handleAddBankEntry} className="space-y-4 pt-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Date</label>
                                                    <input name="b_date" type="date" required defaultValue={dateRange.end} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Reference / Cheque No</label>
                                                    <input name="b_ref" type="text" placeholder="CHQ-001" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Description</label>
                                                <input name="b_desc" type="text" required placeholder="NEFT from ABC Pharma" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                                            </div>
                                            <div className="grid grid-cols-3 gap-4">
                                                <div className="space-y-2">
                                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Withdrawal (Dr)</label>
                                                    <input name="b_debit" type="number" step="0.01" min="0" defaultValue="0" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-rose-400 outline-none font-mono" />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Deposit (Cr)</label>
                                                    <input name="b_credit" type="number" step="0.01" min="0" defaultValue="0" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-400 outline-none font-mono" />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Balance</label>
                                                    <input name="b_balance" type="number" step="0.01" defaultValue="0" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-mono" />
                                                </div>
                                            </div>
                                            <div className="flex justify-end gap-3 pt-2">
                                                <Button type="button" variant="outline" onClick={() => setIsBrsModalOpen(false)}>Cancel</Button>
                                                <Button type="submit" disabled={isSubmittingBank} className="bg-indigo-600 text-white">
                                                    {isSubmittingBank ? 'Saving...' : 'Save Entry'}
                                                </Button>
                                            </div>
                                        </form>
                                    </DialogContent>
                                </Dialog>
                                <label className="cursor-pointer">
                                    <input type="file" accept=".csv" onChange={handleImportBankCSV} className="hidden" />
                                    <span className="inline-flex items-center h-8 px-3 text-sm font-medium border border-slate-200 rounded-lg bg-white hover:bg-slate-50 shadow-sm gap-2 transition-colors">
                                        <Upload className="w-3.5 h-3.5" /> Import CSV
                                    </span>
                                </label>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50/80 border-b border-slate-100">
                                            <th className="px-4 py-3 text-xs font-black text-slate-400 uppercase tracking-widest w-8"></th>
                                            <th className="px-4 py-3 text-xs font-black text-slate-400 uppercase tracking-widest">Date</th>
                                            <th className="px-4 py-3 text-xs font-black text-slate-400 uppercase tracking-widest">Description</th>
                                            <th className="px-4 py-3 text-xs font-black text-slate-400 uppercase tracking-widest">Ref No</th>
                                            <th className="px-4 py-3 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Withdrawal</th>
                                            <th className="px-4 py-3 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Deposit</th>
                                            <th className="px-4 py-3 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Balance</th>
                                            <th className="px-4 py-3 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {bankEntries.map((entry) => (
                                            <tr key={entry.id} className={`transition-colors ${entry.is_reconciled ? 'bg-emerald-50/40' : 'hover:bg-slate-50/50'}`}>
                                                <td className="px-4 py-3">
                                                    <button
                                                        onClick={() => handleToggleReconciled(entry)}
                                                        className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${entry.is_reconciled
                                                            ? 'bg-emerald-500 text-white shadow-md'
                                                            : 'bg-slate-100 text-slate-300 hover:bg-slate-200 hover:text-slate-500'
                                                            }`}
                                                        title={entry.is_reconciled ? 'Mark as unreconciled' : 'Mark as reconciled'}
                                                    >
                                                        {entry.is_reconciled ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                                                    </button>
                                                </td>
                                                <td className="px-4 py-3 text-sm font-medium text-slate-900">{new Date(entry.entry_date).toLocaleDateString()}</td>
                                                <td className="px-4 py-3 text-sm text-slate-700 max-w-[300px] truncate">{entry.description}</td>
                                                <td className="px-4 py-3 text-xs text-slate-400 font-mono">{entry.reference_no || '—'}</td>
                                                <td className="px-4 py-3 text-sm text-right font-mono text-rose-600 font-bold">{entry.debit > 0 ? `₹${entry.debit.toLocaleString()}` : '—'}</td>
                                                <td className="px-4 py-3 text-sm text-right font-mono text-emerald-600 font-bold">{entry.credit > 0 ? `₹${entry.credit.toLocaleString()}` : '—'}</td>
                                                <td className="px-4 py-3 text-sm text-right font-mono font-bold">₹{entry.running_balance.toLocaleString()}</td>
                                                <td className="px-4 py-3 text-center">
                                                    {entry.is_reconciled ? (
                                                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none">
                                                            <Shield className="w-3 h-3 mr-1" /> Reconciled
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="text-amber-500 border-amber-200">
                                                            Pending
                                                        </Badge>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                        {bankEntries.length === 0 && (
                                            <tr>
                                                <td colSpan={8} className="px-6 py-20 text-center">
                                                    <Landmark className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                                                    <p className="text-slate-400 italic">No bank entries for this period.</p>
                                                    <p className="text-xs text-slate-300 mt-1">Add entries manually or import your bank statement CSV.</p>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Print Styles */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    header, .tabs-list, .flex-wrap, button, .lucide { display: none !important; }
                    .card { border: 1px solid #e2e8f0 !important; box-shadow: none !important; }
                    body { background: white !important; }
                    .max-w-[1400px] { max-width: 100% !important; margin: 0 !important; padding: 0 !important; }
                    table { font-size: 10pt !important; }
                }
            `}} />

            {/* Detail Dialog */}
            <Dialog open={!!selectedDetail} onOpenChange={(open: boolean) => !open && setSelectedDetail(null)}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-2xl capitalize">
                            {selectedDetail?.replace('_', ' ')} Analysis
                        </DialogTitle>
                        <DialogDescription>
                            Detailed breakdown and calculation methodology for the selected financial metric.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="mt-4 space-y-6">
                        {selectedDetail === 'net_profit' && (
                            <>
                                <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-100">
                                    <h4 className="font-bold text-indigo-900 mb-1">Calculation Method</h4>
                                    <p className="text-sm text-indigo-700">Net Profit = Total Revenue (Sales) - Operating Expenses (Purchases, Utilities, Bills)</p>
                                </div>
                                <div className="space-y-3">
                                    <h4 className="font-bold text-slate-900">Revenue Contribution</h4>
                                    <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg">
                                        <span className="text-sm">Clinic Sales & Services</span>
                                        <span className="font-bold">₹{(plData?.total_income || 0).toLocaleString()}</span>
                                    </div>
                                    <h4 className="font-bold text-slate-900 mt-4">Expense Categories</h4>
                                    {Object.entries(plData?.breakdown || {}).map(([cat, val], i) => (
                                        <div key={i} className="flex justify-between items-center border-b border-slate-100 py-2">
                                            <span className="text-sm">{cat}</span>
                                            <span className="font-medium text-rose-600">₹{Math.abs(val as number).toLocaleString()}</span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}

                        {selectedDetail === 'total_assets' && (
                            <>
                                <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-100">
                                    <h4 className="font-bold text-indigo-900 mb-1">Calculation Method</h4>
                                    <p className="text-sm text-indigo-700">Total Assets = Inventory Stock (at Cost) + Fixed Assets (WDV) + Cash/Bank Balances</p>
                                </div>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                                        <div>
                                            <p className="font-bold text-slate-900">Inventory</p>
                                            <p className="text-xs text-slate-500">Live stock valuation based on cost price</p>
                                        </div>
                                        <span className="text-lg font-bold">₹{(bsData?.breakdown?.inventory || 0).toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                                        <div>
                                            <p className="font-bold text-slate-900">Fixed Assets</p>
                                            <p className="text-xs text-slate-500">Equipments after yearly depreciation</p>
                                        </div>
                                        <span className="text-lg font-bold">₹{(bsData?.breakdown?.equipment || 0).toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                                        <div>
                                            <p className="font-bold text-slate-900">Cash & Bank</p>
                                            <p className="text-xs text-slate-500">Current balance in financial ledger</p>
                                        </div>
                                        <span className="text-lg font-bold">₹{(bsData?.breakdown?.cash || 0).toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                                        <div>
                                            <p className="font-bold text-slate-900">Total Liabilities</p>
                                            <p className="text-xs text-slate-500">Subtracted from assets to find equity</p>
                                        </div>
                                        <span className="text-lg font-bold text-rose-600">- ₹{(bsData?.total_liabilities || 0).toLocaleString()}</span>
                                    </div>
                                </div>
                            </>
                        )}

                        {selectedDetail === 'total_liabilities' && (
                            <>
                                <div className="p-4 rounded-xl bg-rose-50 border border-rose-100">
                                    <h4 className="font-bold text-rose-900 mb-1">Calculation Method</h4>
                                    <p className="text-sm text-rose-700">Total Liabilities = Dues to Suppliers (Purchase Orders on Credit) + Other Payables</p>
                                </div>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                                        <div>
                                            <p className="font-bold text-slate-900">Sundry Creditors</p>
                                            <p className="text-xs text-slate-500">Outstanding payments to registered suppliers</p>
                                        </div>
                                        <span className="text-lg font-bold text-rose-600">₹{(bsData?.total_liabilities || 0).toLocaleString()}</span>
                                    </div>
                                    <div className="p-4 rounded-xl bg-slate-100/50 border border-dashed border-slate-200">
                                        <p className="text-xs text-slate-500 italic text-center">
                                            Currently tracking only Supplier Credit. Loans and other long-term liabilities to be integrated in future updates.
                                        </p>
                                    </div>
                                </div>
                            </>
                        )}

                        {(selectedDetail === 'income' || selectedDetail === 'expense') && (
                            <div className="py-8 text-center text-slate-500 italic">
                                Detailed {selectedDetail} breakdown is visible in the Profit & Loss tab charts and tables.
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
