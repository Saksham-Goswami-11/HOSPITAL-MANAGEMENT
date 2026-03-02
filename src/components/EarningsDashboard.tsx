import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useHospital } from '@/context/HospitalContext';
import { Loader2, TrendingUp, Download, Building2, Stethoscope, Pill } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/basic';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

import { Button } from '@/components/ui/basic';
import { jsPDF } from "jspdf";

type DateRange = 'today' | 'week' | 'month' | 'all';

function TransactionTable({ sales, clinics }: { sales: any[], clinics: any[] }) {
    return (
        <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b">
                    <tr>
                        <th className="px-4 py-3 font-semibold text-slate-700">Patient</th>
                        <th className="px-4 py-3 font-semibold text-slate-700">Clinic</th>
                        <th className="px-4 py-3 font-semibold text-slate-700">Type</th>
                        <th className="px-4 py-3 font-semibold text-slate-700">Amount</th>
                        <th className="px-4 py-3 font-semibold text-slate-700">Mode</th>
                        <th className="px-4 py-3 font-semibold text-slate-700 text-right">Time</th>
                    </tr>
                </thead>
                <tbody className="divide-y">
                    {sales.length === 0 ? (
                        <tr>
                            <td colSpan={6} className="px-4 py-8 text-center text-slate-500">No transactions found for this category.</td>
                        </tr>
                    ) : (
                        sales.map((sale) => (
                            <tr key={sale.id} className="hover:bg-slate-50/50">
                                <td className="px-4 py-3">
                                    <p className="font-medium text-slate-900">{sale.patient_name}</p>
                                    <p className="text-xs text-slate-500">Dr. {sale.doctor_name}</p>
                                </td>
                                <td className="px-4 py-3 text-slate-600">
                                    {clinics.find(c => c.id === sale.clinic_id)?.name || 'Unknown'}
                                </td>
                                <td className="px-4 py-3">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${sale.sale_type === 'CONSULTATION'
                                            ? 'bg-blue-100 text-blue-700'
                                            : sale.sale_type === 'SERVICE'
                                                ? 'bg-emerald-100 text-emerald-700'
                                                : 'bg-purple-100 text-purple-700'
                                        }`}>
                                        {sale.sale_type}
                                    </span>
                                </td>
                                <td className="px-4 py-3 font-mono font-bold text-slate-900">
                                    ₹{sale.amount?.toLocaleString()}
                                </td>
                                <td className="px-4 py-3 text-slate-600 italic">
                                    {sale.payment_mode}
                                </td>
                                <td className="px-4 py-3 text-right text-slate-500 text-xs">
                                    {new Date(sale.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}

export function EarningsDashboard() {

    const { hospital, clinics } = useHospital();
    const [sales, setSales] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState<DateRange>('today');

    useEffect(() => {
        fetchEarnings();
    }, [hospital?.id, dateRange]);

    const fetchEarnings = async () => {
        if (!hospital?.id) return;
        setLoading(true);

        try {
            let query = supabase
                .from('sales')
                .select('*')
                .eq('hospital_id', hospital.id);

            const now = new Date();
            if (dateRange === 'today') {
                const today = now.toISOString().split('T')[0];
                query = query.gte('timestamp', `${today}T00:00:00`);
            } else if (dateRange === 'week') {
                const weekAgo = new Date(now.setDate(now.getDate() - 7)).toISOString();
                query = query.gte('timestamp', weekAgo);
            } else if (dateRange === 'month') {
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
                query = query.gte('timestamp', startOfMonth);
            }

            const { data, error } = await query;
            if (error) throw error;
            setSales(data || []);
        } catch (error) {
            console.error('Error fetching earnings:', error);
        } finally {
            setLoading(false);
        }
    };

    const metrics = useMemo(() => {
        let total = 0;
        let consultancy = 0;
        let pharmacy = 0;

        const clinicStats: Record<string, { total: number, consultancy: number, pharmacy: number, transactions: number }> = {};

        // Initialize clinic stats
        clinics.forEach(c => {
            clinicStats[c.id] = { total: 0, consultancy: 0, pharmacy: 0, transactions: 0 };
        });

        sales.forEach(sale => {
            const amount = sale.amount || 0;
            const type = sale.sale_type; // e.g., 'CONSULTATION', 'PHARMACY'
            const cid = sale.clinic_id;

            total += amount;

            // Assume "CONSULTATION" is doc fees, everything else (PHARMACY/INVENTORY) is pharmacy
            // You can adjust these string matches to fit your exact DB ENUMs
            if (type === 'CONSULTATION' || type === 'SERVICE') {
                consultancy += amount;
                if (clinicStats[cid]) clinicStats[cid].consultancy += amount;
            } else {
                pharmacy += amount;
                if (clinicStats[cid]) clinicStats[cid].pharmacy += amount;
            }

            if (clinicStats[cid]) {
                clinicStats[cid].total += amount;
                clinicStats[cid].transactions += 1;
            }
        });

        return {
            total,
            consultancy,
            pharmacy,
            clinicStats
        };
    }, [sales, clinics]);

    const handleExportPDF = () => {
        const doc = new jsPDF();

        // --- SUMMARY SHEET --- //
        doc.setFontSize(18);
        doc.text(`Earnings Report - ${hospital?.name || 'Hospital'}`, 10, 15);
        doc.setFontSize(12);
        doc.text(`Date Range: ${dateRange.toUpperCase()}`, 10, 25);

        doc.setFontSize(14);
        doc.text(`Total Revenue: Rs. ${metrics.total.toLocaleString()}`, 10, 40);
        doc.setFontSize(11);
        doc.text(`Consultancy: Rs. ${metrics.consultancy.toLocaleString()}`, 10, 50);
        doc.text(`Pharmacy: Rs. ${metrics.pharmacy.toLocaleString()}`, 10, 60);

        let y = 80;
        doc.setFontSize(14);
        doc.text('Clinic Breakdown:', 10, y);
        doc.setFontSize(11);
        y += 10;

        clinics.forEach(c => {
            const stats = metrics.clinicStats[c.id];
            if (stats && stats.transactions > 0) {
                doc.text(`${c.name}: Rs ${stats.total.toLocaleString()} (${stats.transactions} txns)`, 10, y);
                y += 10;
            }
        });

        // --- DETAILED TRANSACTIONS LEDGER --- //
        doc.addPage();
        y = 20;
        doc.setFontSize(16);
        doc.text(`All Transactions (${dateRange.toUpperCase()})`, 10, y);
        y += 15;

        // Table Header
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Date', 10, y);
        doc.text('Clinic', 45, y);
        doc.text('Patient', 100, y);
        doc.text('Type', 150, y);
        doc.text('Amount', 180, y);
        y += 2;
        doc.line(10, y, 200, y); // Header underline
        y += 8;

        doc.setFont('helvetica', 'normal');

        sales.forEach(sale => {
            // Check for page overflow
            if (y > 280) {
                doc.addPage();
                y = 20;
            }

            const dateStr = new Date(sale.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
            const clinicName = clinics.find(c => c.id === sale.clinic_id)?.name || 'Unknown';
            const patient = (sale.patient_name || 'N/A').substring(0, 22);
            const type = sale.sale_type || 'Unknown';
            const amountStr = `Rs ${sale.amount?.toLocaleString() || 0}`;

            doc.text(dateStr, 10, y);
            doc.text(clinicName.substring(0, 22), 45, y); // Truncated clinic name
            doc.text(patient, 100, y);
            doc.text(type, 150, y);
            doc.text(amountStr, 180, y);

            y += 8; // Row spacing
        });

        doc.save(`earnings-report-${dateRange}.pdf`);
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500 max-w-[1600px] mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/60 pb-6">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Earnings Dashboard</h1>
                    <p className="text-slate-500 mt-1">Global Revenue Tracking across all Clinics</p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="bg-white border border-slate-200 rounded-lg p-1 shadow-sm flex items-center">
                        {(['today', 'week', 'month', 'all'] as DateRange[]).map(range => (
                            <button
                                key={range}
                                onClick={() => setDateRange(range)}
                                className={`px-4 py-1.5 text-sm font-medium rounded-md capitalize transition-colors ${dateRange === range
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'text-slate-600 hover:bg-slate-50'
                                    }`}
                            >
                                {range}
                            </button>
                        ))}
                    </div>

                    <Button onClick={handleExportPDF} className="bg-slate-900 text-white hover:bg-slate-800 shadow-md">
                        <Download className="w-4 h-4 mr-2" /> PDF Report
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center items-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
            ) : (
                <>
                    {/* Top KPI Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Total Revenue Modal */}
                        <Dialog>
                            <DialogTrigger asChild>
                                <Card className="border border-slate-200 shadow-sm bg-white overflow-hidden group cursor-pointer hover:ring-2 hover:ring-emerald-500/20 transition-all">
                                    <CardContent className="p-6">
                                        <div className="flex items-center justify-between pb-2">
                                            <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider">Total Revenue</h3>
                                            <TrendingUp className="w-5 h-5 text-emerald-500 bg-emerald-50 p-1 rounded-md" />
                                        </div>
                                        <div className="text-4xl font-bold text-slate-900 group-hover:scale-105 transition-transform origin-left">
                                            ₹{metrics.total.toLocaleString()}
                                        </div>
                                        <div className="text-xs text-slate-400 mt-2 font-medium flex justify-between items-center">
                                            <span>{sales.length} Total Transactions</span>
                                            <span className="text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity">Click for ledger →</span>
                                        </div>
                                    </CardContent>
                                </Card>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col p-0">
                                <DialogHeader className="p-6 pb-4 border-b">
                                    <DialogTitle>Total Revenue Ledger</DialogTitle>
                                    <p className="text-sm text-slate-500">Full transaction history for the selected {dateRange} period.</p>
                                </DialogHeader>
                                <div className="flex-1 overflow-y-auto p-6 pt-0">
                                    <TransactionTable sales={sales} clinics={clinics} />
                                </div>
                            </DialogContent>
                        </Dialog>

                        {/* Consultancy Modal */}
                        <Dialog>
                            <DialogTrigger asChild>
                                <Card className="border border-slate-200 shadow-sm bg-white overflow-hidden group cursor-pointer hover:ring-2 hover:ring-blue-500/20 transition-all">
                                    <CardContent className="p-6">
                                        <div className="flex items-center justify-between pb-2">
                                            <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider">Consultancy Services</h3>
                                            <Stethoscope className="w-5 h-5 text-blue-500 bg-blue-50 p-1 rounded-md" />
                                        </div>
                                        <div className="text-4xl font-bold text-slate-900 text-blue-900 group-hover:scale-105 transition-transform origin-left">
                                            ₹{metrics.consultancy.toLocaleString()}
                                        </div>
                                        <div className="text-xs text-blue-600/70 mt-2 font-medium flex justify-between">
                                            <span>Doctor Fees & Services</span>
                                            <span>{metrics.total > 0 ? Math.round((metrics.consultancy / metrics.total) * 100) : 0}% of Total</span>
                                        </div>
                                    </CardContent>
                                </Card>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col p-0">
                                <DialogHeader className="p-6 pb-4 border-b text-blue-900">
                                    <DialogTitle>Consultancy & Service Ledger</DialogTitle>
                                    <p className="text-sm text-blue-600/70">Breakdown of consultations and medical services.</p>
                                </DialogHeader>
                                <div className="flex-1 overflow-y-auto p-6 pt-0">
                                    <TransactionTable
                                        sales={sales.filter(s => s.sale_type === 'CONSULTATION' || s.sale_type === 'SERVICE')}
                                        clinics={clinics}
                                    />
                                </div>
                            </DialogContent>
                        </Dialog>

                        {/* Pharmacy Modal */}
                        <Dialog>
                            <DialogTrigger asChild>
                                <Card className="border border-slate-200 shadow-sm bg-white overflow-hidden group cursor-pointer hover:ring-2 hover:ring-purple-500/20 transition-all">
                                    <CardContent className="p-6">
                                        <div className="flex items-center justify-between pb-2">
                                            <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider">Pharmacy Sales</h3>
                                            <Pill className="w-5 h-5 text-purple-500 bg-purple-50 p-1 rounded-md" />
                                        </div>
                                        <div className="text-4xl font-bold text-slate-900 text-purple-900 group-hover:scale-105 transition-transform origin-left">
                                            ₹{metrics.pharmacy.toLocaleString()}
                                        </div>
                                        <div className="text-xs text-purple-600/70 mt-2 font-medium flex justify-between">
                                            <span>Medications & Items</span>
                                            <span>{metrics.total > 0 ? Math.round((metrics.pharmacy / metrics.total) * 100) : 0}% of Total</span>
                                        </div>
                                    </CardContent>
                                </Card>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col p-0">
                                <DialogHeader className="p-6 pb-4 border-b text-purple-900">
                                    <DialogTitle>Pharmacy & Inventory Ledger</DialogTitle>
                                    <p className="text-sm text-purple-600/70">Detailed records of medication and pharmacy item sales.</p>
                                </DialogHeader>
                                <div className="flex-1 overflow-y-auto p-6 pt-0">
                                    <TransactionTable
                                        sales={sales.filter(s => s.sale_type !== 'CONSULTATION' && s.sale_type !== 'SERVICE')}
                                        clinics={clinics}
                                    />
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>


                    {/* Clinic Performance Table */}
                    <Card className="border border-slate-200 shadow-sm bg-white">
                        <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
                            <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <Building2 className="w-5 h-5 text-slate-500" />
                                Clinic-wise Breakdown
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
                                        <tr>
                                            <th className="px-6 py-4">Clinic Name</th>
                                            <th className="px-6 py-4 text-right">Transactions</th>
                                            <th className="px-6 py-4 text-right">Consultancy (₹)</th>
                                            <th className="px-6 py-4 text-right">Pharmacy (₹)</th>
                                            <th className="px-6 py-4 text-right font-bold text-slate-900">Total Revenue (₹)</th>
                                            <th className="px-6 py-4 text-center">Split</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 pb-4">
                                        {clinics.map(clinic => {
                                            const stats = metrics.clinicStats[clinic.id];
                                            if (!stats || stats.total === 0) return null; // Hide empty clinics for cleaner view

                                            const consPct = stats.total > 0 ? (stats.consultancy / stats.total) * 100 : 0;
                                            const pharmPct = stats.total > 0 ? (stats.pharmacy / stats.total) * 100 : 0;

                                            return (
                                                <tr key={clinic.id} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="px-6 py-4 font-bold text-slate-800">{clinic.name}</td>
                                                    <td className="px-6 py-4 text-right text-slate-500">{stats.transactions}</td>
                                                    <td className="px-6 py-4 text-right text-blue-600 font-medium">{stats.consultancy.toLocaleString()}</td>
                                                    <td className="px-6 py-4 text-right text-purple-600 font-medium">{stats.pharmacy.toLocaleString()}</td>
                                                    <td className="px-6 py-4 text-right font-bold text-emerald-600 text-lg">
                                                        {stats.total.toLocaleString()}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex h-2 w-full bg-slate-100 rounded-full overflow-hidden" title={`Consultancy: ${Math.round(consPct)}% | Pharmacy: ${Math.round(pharmPct)}%`}>
                                                            <div style={{ width: `${consPct}%` }} className="bg-blue-500"></div>
                                                            <div style={{ width: `${pharmPct}%` }} className="bg-purple-500"></div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}

                                        {/* Show message if totally empty */}
                                        {Object.values(metrics.clinicStats).every(s => s.total === 0) && (
                                            <tr>
                                                <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                                                    No sales data found for the selected {dateRange} period.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    );
}
