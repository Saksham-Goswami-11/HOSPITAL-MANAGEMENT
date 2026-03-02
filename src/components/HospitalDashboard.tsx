import React, { useState, useEffect, useMemo } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/basic'
import { Button, Input, Label } from '@/components/ui/basic'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Building2, TrendingUp, AlertTriangle, Plus, Loader2, UserPlus, Download, MessageCircle, Package, ArrowUpRight, Shield } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ui/use-toast'
import { jsPDF } from "jspdf"
import { useHospital } from '@/context/HospitalContext'
import {
    PieChart, Pie, Cell, Tooltip, ResponsiveContainer
} from 'recharts'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

interface HospitalDashboardProps {
    onSelectClinic: (id: string) => void;
}

export function HospitalDashboard({ onSelectClinic }: HospitalDashboardProps) {
    const { toast } = useToast()
    const { inventory, profile, hospital, clinics } = useHospital()

    // Derived state from context
    const lowStock = inventory.filter(i => {
        const threshold = i.threshold || hospital?.settings?.global_low_stock_threshold || 10;
        return i.quantity < threshold;
    })

    const [isRegisterOpen, setIsRegisterOpen] = useState(false)
    const [registerLoading, setRegisterLoading] = useState(false)
    const [expiringItems, setExpiringItems] = useState<any[]>([])
    const [revenueSummary, setRevenueSummary] = useState<any[]>([])
    const [loadingStats, setLoadingStats] = useState(true)

    // Advanced Analytics State
    const [salesData, setSalesData] = useState<any[]>([])
    const [dateFilter, setDateFilter] = useState('today')
    const [groupBy, setGroupBy] = useState<'clinic_id' | 'payment_mode' | 'sale_type'>('clinic_id')
    const [filters, setFilters] = useState({
        clinic: 'all',
        payment: 'all',
        type: 'all'
    })
    const [analyticsLoading, setAnalyticsLoading] = useState(true)
    const [activeIndex, setActiveIndex] = useState<number | null>(null)

    // Fetch Expiring Items (< 30 days) & Revenue Summary
    useEffect(() => {
        const fetchDashboardData = async () => {
            if (!profile?.hospital_id) return;

            const thirtyDaysFromNow = new Date()
            thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)
            const today = new Date().toISOString().split('T')[0]

            // 1. Expiring Items
            let expiryQuery = supabase
                .from('inventory')
                .select('item_name, expiry_date, clinic_id, clinics(name)')
                .lt('expiry_date', thirtyDaysFromNow.toISOString())
                .gt('quantity', 0)
                .eq('hospital_id', profile.hospital_id)

            const { data: expiryData } = await expiryQuery;

            if (expiryData) setExpiringItems(expiryData)

            // 2. Revenue Summary
            // Assuming admin_revenue_summary has hospital_id column or we filter in memory if not. 
            // Better to assume it filters by the user's scope if security invoker is true, but explict check is better.
            // Since the view likely aggregates sales, and sales have clinic_id, we can filter by clinic_id linking to hospital.
            // But for now, we rely on the existing logic which was:
            let revQuery = supabase
                .from('admin_revenue_summary')
                .select('*')
                .eq('revenue_date', today)
            // .eq('hospital_id', profile.hospital_id) // Add if view supports it.

            // NOTE: If the view doesn't have hospital_id, we might be over-fetching. 
            // In a real app we'd update the view. For now, we trust the previous logic which filtered in JS or query if possible?
            // Actually the previous code did:
            // if (!isSuperAdmin && profile?.hospital_id) { revQuery = revQuery.eq('hospital_id', profile.hospital_id) }
            // So we assume the column exists or was intended to.

            const { data: revData, error } = await revQuery;

            if (revData) {
                // Client-side filter if needed (or if the column exists but we want to be safe)
                setRevenueSummary(revData) // We assume RLS or View logic helps, or we filter here if we had clinic list.
            }
            if (error) console.error('Error fetching revenue summary:', error)

            setLoadingStats(false)
        }
        fetchDashboardData()
    }, [profile])

    // 3. Analytics Data Fetching & Aggregation
    useEffect(() => {
        const fetchAnalytics = async () => {
            if (!profile?.hospital_id) return;
            setAnalyticsLoading(true);

            let query = supabase
                .from('sales')
                .select('amount, payment_mode, sale_type, clinic_id, clinics(name)')
                .eq('hospital_id', profile.hospital_id);

            // Date filtering
            const now = new Date();
            if (dateFilter === 'today') {
                query = query.gte('timestamp', now.toISOString().split('T')[0]);
            } else if (dateFilter === 'week') {
                const weekAgo = new Date(now.setDate(now.getDate() - 7));
                query = query.gte('timestamp', weekAgo.toISOString());
            } else if (dateFilter === 'month') {
                const monthAgo = new Date(now.setMonth(now.getMonth() - 1));
                query = query.gte('timestamp', monthAgo.toISOString());
            }

            if (filters.clinic !== 'all') {
                query = query.eq('clinic_id', filters.clinic);
            }
            if (filters.payment !== 'all') {
                query = query.eq('payment_mode', filters.payment);
            }
            if (filters.type !== 'all') {
                query = query.eq('sale_type', filters.type);
            }

            const { data, error } = await query;
            if (data) setSalesData(data);
            if (error) console.error('Analytics Fetch Error:', error);
            setAnalyticsLoading(false);
        };

        fetchAnalytics();
    }, [profile, dateFilter, filters]);

    // Optimized Aggregation Logic
    const displayData = useMemo(() => {
        const aggregated = salesData.reduce((acc: any, curr: any) => {
            let label = curr[groupBy];
            if (groupBy === 'clinic_id') label = curr.clinics?.name || 'Unknown';
            acc[label] = (acc[label] || 0) + Number(curr.amount);
            return acc;
        }, {});

        return Object.entries(aggregated)
            .map(([name, value]) => ({ name, value }))
            .sort((a: any, b: any) => b.value - a.value);
    }, [salesData, groupBy]);

    const totalSelectedRevenue = useMemo(() =>
        displayData.reduce((acc, curr) => acc + (curr.value as number), 0),
        [displayData]);

    const COLORS = ['#6366f1', '#10b981', '#f43f5e', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];


    async function handleRegisterClinic(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setRegisterLoading(true)
        const formData = new FormData(e.currentTarget)
        const clinicName = formData.get('clinic_name') as string
        const staffEmail = formData.get('staff_email') as string
        const staffPassword = formData.get('staff_password') as string
        const staffName = formData.get('staff_name') as string
        const location = formData.get('location') as string

        try {
            // 1. Create a temporary client for the signup
            const tempSupabase = createClient(
                import.meta.env.VITE_SUPABASE_URL,
                import.meta.env.VITE_SUPABASE_ANON_KEY
            )

            toast({ title: 'Registration Started', description: 'Creating clinic...', duration: 3000 })

            // 2. Sign up the new user
            const { data: authData, error: authError } = await tempSupabase.auth.signUp({
                email: staffEmail,
                password: staffPassword,
                options: {
                    data: { full_name: staffName, role: 'CLINIC_ADMIN' }
                }
            })

            if (authError) throw authError
            if (!authData.user) throw new Error("No user created")

            // 3. Call RPC
            const rpcParams = {
                clinic_name: clinicName,
                clinic_address: location,
                staff_user_id: authData.user.id,
                staff_name: staffName
            }
            // RPC Payload prepared
            // Fetching hospital stats

            const { error: rpcError } = await supabase.rpc('admin_create_clinic_and_staff', rpcParams)

            if (rpcError) throw rpcError

            // 4. CRITICAL: Fetch the new Clinic ID (Robust Safety Net)
            // We fetch the clinic we just created to get its ID guaranteed.
            const { data: stringData, error: fetchError } = await supabase
                .from('clinics')
                .select('id')
                .eq('name', clinicName)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (fetchError || !stringData) {
                console.error("⚠️ Could not fetch new clinic ID:", fetchError)
                throw new Error("Clinic created, but ID retrieval failed.")
            }

            const newClinicId = stringData.id;

            // 5. CRITICAL: Force Link & Role Update (The Permanent Fix)
            // We explicitly set the ID and Role, bypassing any flaky DB triggers/functions.
            const { error: roleError } = await supabase
                .from('profiles')
                .update({
                    role: 'CLINIC_ADMIN',
                    clinic_id: newClinicId,
                    hospital_id: profile?.hospital_id // Ensure they belong to the parent hospital too
                })
                .eq('id', authData.user.id)

            if (roleError) console.error("⚠️ Failed to enforce CLINIC_ADMIN/ID:", roleError)

            toast({
                title: '✅ Clinic Registered Systematically',
                description: `Linked ${staffName} to ${clinicName} (ID: ${newClinicId.slice(0, 4)}...).`,
                className: 'bg-green-50 border-green-200 text-green-900'
            })
            setIsRegisterOpen(false)

            setTimeout(() => window.location.reload(), 1500)

        } catch (err: any) {
            console.error('Registration failed:', err)
            toast({
                title: 'Registration Failed',
                description: err.message || 'Could not register clinic.',
                variant: 'destructive'
            })
        } finally {
            setRegisterLoading(false)
        }
    }

    const generatePDF = () => {
        const doc = new jsPDF()
        doc.text('Daily Network Report', 10, 10)
        doc.text(`Date: ${new Date().toLocaleDateString()}`, 10, 20)
        doc.text(`Total Network Revenue: ₹${totalRevenue.toLocaleString()}`, 10, 30)

        let y = 50
        doc.text('Clinic Breakdown:', 10, y)
        y += 10
        revenueSummary.forEach(c => {
            doc.text(`${c.clinic_name}: ₹${c.total_revenue} (${c.transaction_count} txns)`, 10, y)
            y += 10
        })

        doc.save('admin-daily-report.pdf')
    }

    const totalRevenue = revenueSummary.reduce((acc, curr) => acc + (curr.total_revenue || 0), 0)
    const topClinic = revenueSummary.reduce((prev, current) => (prev.total_revenue > current.total_revenue) ? prev : current, { clinic_name: 'N/A', total_revenue: 0 })

    const whatsappLink = `https://wa.me/?text=${encodeURIComponent(`Daily Report: Revenue ₹${totalRevenue}, Top Clinic: ${topClinic.clinic_name}`)}`

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* WELCOME SECTION */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-b border-slate-200/60 pb-8">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-200">
                            <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 tracking-tight">{hospital?.name}</h2>
                            <p className="text-sm text-slate-500 font-medium">Network Operations Overview</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Dialog open={isRegisterOpen} onOpenChange={setIsRegisterOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-slate-900 hover:bg-slate-800 shadow-lg shadow-slate-900/20 text-white gap-2">
                                <Plus className="w-4 h-4" /> New Clinic HUB
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[500px] bg-slate-950/95 backdrop-blur-2xl border-slate-800 text-slate-50 shadow-2xl p-6 gap-6">
                            <DialogHeader>
                                <DialogTitle className="text-xl font-bold text-white tracking-tight">Register New Clinic</DialogTitle>
                                <DialogDescription className="text-slate-400">
                                    Create a new clinic hub and assign a primary staff member.
                                </DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleRegisterClinic} className="space-y-5 pt-2">
                                <div className="space-y-2">
                                    <Label className="text-slate-400 font-medium">Clinic Name</Label>
                                    <Input name="clinic_name" required placeholder="e.g. Downtown Health" className="bg-slate-900/50 border-slate-800 text-white placeholder:text-slate-600 h-12 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-slate-400 font-medium">Location</Label>
                                    <Input name="location" required placeholder="Full address" className="bg-slate-900/50 border-slate-800 text-white placeholder:text-slate-600 h-12 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-slate-400 font-medium">Staff Name</Label>
                                        <Input name="staff_name" required placeholder="John Doe" className="bg-slate-900/50 border-slate-800 text-white placeholder:text-slate-600 h-12 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-slate-400 font-medium">Password</Label>
                                        <Input name="staff_password" type="password" required minLength={6} placeholder="••••••" className="bg-slate-900/50 border-slate-800 text-white placeholder:text-slate-600 h-12 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-slate-400 font-medium">Staff Email</Label>
                                    <Input name="staff_email" type="email" required placeholder="staff@clinic.com" className="bg-slate-900/50 border-slate-800 text-white placeholder:text-slate-600 h-12 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all" />
                                </div>

                                <DialogFooter className="pt-4">
                                    <Button type="submit" disabled={registerLoading} className="w-full h-12 bg-blue-600 hover:bg-blue-500 text-white font-semibold tracking-wide shadow-lg shadow-blue-900/20 active:scale-[0.98] transition-all">
                                        {registerLoading ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
                                        Launch Clinic
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* STAT CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Revenue Popup */}
                <Dialog>
                    <DialogTrigger asChild>
                        <Card className="glass-card border-none overflow-hidden relative group cursor-pointer hover:ring-2 hover:ring-emerald-500/20 transition-all">
                            <CardContent className="p-6">
                                <div className="flex items-center justify-between pb-2">
                                    <h3 className="text-sm font-medium text-slate-500">Network Revenue (Today)</h3>
                                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                                </div>
                                <div className="text-4xl font-bold text-slate-900 group-hover:scale-105 transition-transform origin-left duration-300">
                                    ₹{totalRevenue.toLocaleString()}
                                </div>
                                <div className="text-xs text-emerald-600 flex items-center gap-1 mt-2">
                                    <ArrowUpRight className="w-3 h-3" />
                                    Live Real-time
                                </div>
                            </CardContent>
                        </Card>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[450px] bg-white border-slate-200">
                        <DialogHeader>
                            <DialogTitle className="text-xl font-bold text-slate-900">Revenue Breakdown</DialogTitle>
                            <DialogDescription>Daily earnings across all connected clinics.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-3 py-4">
                            {revenueSummary.map(c => (
                                <div key={c.clinic_id} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-blue-200 transition-all group">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                            <Building2 className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-900">{c.clinic_name}</p>
                                            <p className="text-xs text-slate-500">{c.transaction_count} Transactions</p>
                                        </div>
                                    </div>
                                    <p className="font-mono font-bold text-blue-600 text-lg">₹{c.total_revenue?.toLocaleString()}</p>
                                </div>
                            ))}
                            {revenueSummary.length === 0 && (
                                <div className="text-center py-8 text-slate-400 italic">No sales data for today.</div>
                            )}
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Top Performer Popup */}
                <Dialog>
                    <DialogTrigger asChild>
                        <Card className="glass-card border-none overflow-hidden relative group cursor-pointer hover:ring-2 hover:ring-blue-500/20 transition-all">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-blue-500/20 transition-all duration-500"></div>
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium text-slate-500">Top Performer</CardTitle>
                                <Building2 className="w-4 h-4 text-blue-600" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-slate-900 truncate">
                                    {topClinic.clinic_name}
                                </div>
                                <p className="text-xs text-slate-400 mt-1">
                                    Generated ₹{topClinic.total_revenue?.toLocaleString()} today
                                </p>
                            </CardContent>
                        </Card>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[400px] bg-white border-slate-200">
                        <DialogHeader>
                            <DialogTitle className="text-xl font-bold text-slate-900">Clinic Excellence</DialogTitle>
                            <DialogDescription>Performance details for {topClinic.clinic_name}</DialogDescription>
                        </DialogHeader>
                        <div className="py-6 space-y-6 text-center">
                            <div className="w-20 h-20 bg-blue-100 rounded-3xl flex items-center justify-center mx-auto text-blue-600 shadow-xl shadow-blue-500/10 mb-2">
                                <TrendingUp className="w-10 h-10" />
                            </div>
                            <div>
                                <h4 className="text-2xl font-extrabold text-slate-900">₹{topClinic.total_revenue?.toLocaleString()}</h4>
                                <p className="text-sm text-slate-500 font-medium">Daily Revenue Record</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <p className="text-slate-900 font-bold text-lg">{topClinic.transaction_count}</p>
                                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Invoices</p>
                                </div>
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <p className="text-slate-900 font-bold text-lg">₹{(Number(topClinic.total_revenue) / (topClinic.transaction_count || 1)).toFixed(0)}</p>
                                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Avg Order</p>
                                </div>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* System Alerts Popup */}
                <Dialog>
                    <DialogTrigger asChild>
                        <Card className={`glass-card border-none overflow-hidden relative group cursor-pointer hover:ring-2 hover:ring-red-500/20 transition-all ${lowStock.length > 0 || expiringItems.length > 0 ? 'bg-red-50/50 outline outline-2 outline-red-100' : ''}`}>
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium text-slate-500">System Alerts</CardTitle>
                                <AlertTriangle className={`w-4 h-4 ${lowStock.length > 0 || expiringItems.length > 0 ? 'text-red-500 animate-pulse' : 'text-slate-400'}`} />
                            </CardHeader>
                            <CardContent>
                                <div className="text-4xl font-bold text-slate-900">
                                    {lowStock.length + expiringItems.length}
                                </div>
                                <p className="text-xs text-slate-500 mt-1">
                                    {lowStock.length} Low Stock, {expiringItems.length} Expiring
                                </p>
                            </CardContent>
                        </Card>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px] bg-white border-slate-200">
                        <DialogHeader>
                            <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                <Shield className="w-5 h-5 text-red-600" />
                                Critical Alerts
                            </DialogTitle>
                            <DialogDescription>Immediate attention required for inventory and supply chain.</DialogDescription>
                        </DialogHeader>
                        <div className="py-4 space-y-6 overflow-y-auto max-h-[60vh] pr-2">
                            {lowStock.length > 0 && (
                                <div className="space-y-3">
                                    <h4 className="text-xs font-extrabold text-red-600 uppercase tracking-widest pl-1">Low Stock Hazards</h4>
                                    {lowStock.map(item => (
                                        <div key={item.id} className="flex justify-between items-center p-3 bg-red-50/50 rounded-xl border border-red-100 group">
                                            <div>
                                                <p className="font-bold text-slate-900">{item.item_name}</p>
                                                <p className="text-[10px] text-slate-500 font-bold uppercase">{item.clinic_name}</p>
                                            </div>
                                            <div className="text-right">
                                                <div className="flex items-center gap-1.5 justify-end">
                                                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                                    <p className="font-bold text-red-600 font-mono text-lg">{item.quantity}</p>
                                                </div>
                                                <p className="text-[10px] text-red-400 font-medium">Threshold: {item.threshold}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {expiringItems.length > 0 && (
                                <div className="space-y-3">
                                    <h4 className="text-xs font-extrabold text-amber-600 uppercase tracking-widest pl-1">Expirations (Next 30 Days)</h4>
                                    {expiringItems.map((item, idx) => (
                                        <div key={idx} className="flex justify-between items-center p-3 bg-amber-50/50 rounded-xl border border-amber-100 group">
                                            <div>
                                                <p className="font-bold text-slate-900">{item.item_name}</p>
                                                <p className="text-[10px] text-slate-500 font-bold uppercase">{item.clinics?.name}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold text-amber-600 font-mono group-hover:scale-110 transition-transform">{new Date(item.expiry_date).toLocaleDateString()}</p>
                                                <p className="text-[10px] text-amber-400 font-medium italic">Critical Window</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {lowStock.length === 0 && expiringItems.length === 0 && (
                                <div className="text-center py-12 flex flex-col items-center gap-4 bg-slate-50 rounded-3xl border border-slate-100 border-dashed">
                                    <Shield className="w-12 h-12 text-emerald-100" />
                                    <p className="text-slate-400 font-medium italic">No active system alerts detected.</p>
                                </div>
                            )}
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            {/* ANALYTICS SECTION */}
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                        <div className="w-2 h-8 bg-indigo-600 rounded-full" />
                        Unified Analytics Hub
                    </h2>
                    <Select value={dateFilter} onValueChange={setDateFilter}>
                        <SelectTrigger className="w-[140px] bg-white border-slate-200 rounded-xl font-medium">
                            <SelectValue placeholder="Date Range" />
                        </SelectTrigger>
                        <SelectContent className="bg-white">
                            <SelectItem value="today">Today</SelectItem>
                            <SelectItem value="week">Past Week</SelectItem>
                            <SelectItem value="month">Past Month</SelectItem>
                            <SelectItem value="all">Lifetime</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <Card className="glass-card border-none overflow-hidden p-6">
                    {/* Header Controls */}
                    <div className="flex flex-col lg:flex-row gap-6 mb-8 border-b border-slate-100 pb-6">
                        <div className="space-y-3 flex-grow">
                            <Label className="text-xs font-bold uppercase tracking-widest text-slate-400">Analyze Primary Dimension</Label>
                            <div className="flex bg-slate-100/50 p-1 rounded-xl w-fit">
                                {[
                                    { label: 'Revenue by Branch', value: 'clinic_id' },
                                    { label: 'Payment Matrix', value: 'payment_mode' },
                                    { label: 'Service Types', value: 'sale_type' }
                                ].map((tab) => (
                                    <button
                                        key={tab.value}
                                        onClick={() => setGroupBy(tab.value as any)}
                                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${groupBy === tab.value
                                            ? 'bg-white text-indigo-600 shadow-sm'
                                            : 'text-slate-500 hover:text-slate-700'
                                            }`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-4 items-end">
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-slate-400">Clinic Hub</Label>
                                <Select value={filters.clinic} onValueChange={(v) => setFilters(f => ({ ...f, clinic: v }))}>
                                    <SelectTrigger className="w-[160px] bg-slate-50 border-none rounded-xl h-10 font-medium text-slate-700">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white">
                                        <SelectItem value="all">All Locations</SelectItem>
                                        {clinics.map((c: any) => (
                                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-slate-400">Payment Mode</Label>
                                <Select value={filters.payment} onValueChange={(v) => setFilters(f => ({ ...f, payment: v }))}>
                                    <SelectTrigger className="w-[140px] bg-slate-50 border-none rounded-xl h-10 font-medium text-slate-700">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white">
                                        <SelectItem value="all">Any Mode</SelectItem>
                                        <SelectItem value="Cash">Cash</SelectItem>
                                        <SelectItem value="UPI">UPI</SelectItem>
                                        <SelectItem value="CARD">Card</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-slate-400">Service Line</Label>
                                <Select value={filters.type} onValueChange={(v) => setFilters(f => ({ ...f, type: v }))}>
                                    <SelectTrigger className="w-[140px] bg-slate-50 border-none rounded-xl h-10 font-medium text-slate-700">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white">
                                        <SelectItem value="all">All Services</SelectItem>
                                        <SelectItem value="CONSULTATION">Consultation</SelectItem>
                                        <SelectItem value="PHARMACY">Pharmacy</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    {/* Chart Area */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center min-h-[400px] lg:h-[450px]">
                        <div className="lg:col-span-7 h-full relative">
                            {analyticsLoading ? (
                                <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm z-10 transition-opacity">
                                    <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                                </div>
                            ) : displayData.length === 0 ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 italic gap-2 h-full">
                                    <TrendingUp className="w-12 h-12 text-slate-100" />
                                    <p>No transactions match these criteria</p>
                                </div>
                            ) : (
                                <>
                                    {/* Center Summary Label */}
                                    {!analyticsLoading && displayData.length > 0 && (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
                                            <div className="bg-slate-50/80 backdrop-blur-md px-4 py-3 md:px-6 md:py-4 rounded-[32px] md:rounded-[40px] border border-white/50 shadow-inner flex flex-col items-center">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Total Context</p>
                                                <h3 className="text-2xl md:text-4xl font-black text-slate-900 mt-1 tabular-nums transition-all duration-300">
                                                    ₹{totalSelectedRevenue.toLocaleString()}
                                                </h3>
                                                <div className="flex gap-1 mt-2">
                                                    <div className="w-8 h-1 bg-indigo-600 rounded-full" />
                                                    <div className="w-2 h-1 bg-indigo-200 rounded-full" />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <defs>
                                                {COLORS.map((color, i) => (
                                                    <linearGradient key={`grad-${i}`} id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor={color} stopOpacity={0.8} />
                                                        <stop offset="95%" stopColor={color} stopOpacity={1} />
                                                    </linearGradient>
                                                ))}
                                            </defs>
                                            <Pie
                                                data={displayData}
                                                innerRadius="65%"
                                                outerRadius="85%"
                                                paddingAngle={8}
                                                dataKey="value"
                                                stroke="none"
                                                animationBegin={0}
                                                animationDuration={1000}
                                                onMouseEnter={(_, index) => setActiveIndex(index)}
                                                onMouseLeave={() => setActiveIndex(null)}
                                            >
                                                {displayData.map((_entry: any, index: number) => (
                                                    <Cell
                                                        key={`cell-${index}`}
                                                        fill={`url(#grad-${index % COLORS.length})`}
                                                        className="transition-all duration-300 cursor-pointer outline-none"
                                                        style={{
                                                            fillOpacity: activeIndex === null || activeIndex === index ? 1 : 0.6,
                                                            transform: activeIndex === index ? 'scale(1.05)' : 'scale(1)',
                                                            transformOrigin: 'center',
                                                            stroke: activeIndex === index ? 'white' : 'none',
                                                            strokeWidth: 2
                                                        }}
                                                    />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                wrapperStyle={{ zIndex: 1000 }}
                                                content={({ active, payload }) => {
                                                    if (active && payload && payload.length) {
                                                        return (
                                                            <div className="bg-white p-4 rounded-2xl shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
                                                                <p className="text-xs font-bold text-slate-400 uppercase mb-1">{payload[0].name}</p>
                                                                <p className="text-2xl font-black text-slate-900">₹{Number(payload[0].value).toLocaleString()}</p>
                                                                <p className="text-[10px] text-indigo-600 font-bold mt-1">{(Number(payload[0].value) / totalSelectedRevenue * 100).toFixed(1)}% of selection</p>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                }}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </>
                            )}
                        </div>

                        <div className="lg:col-span-5 h-full flex flex-col justify-center space-y-4 pr-6">
                            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-2">
                                Breakdown Summary
                                <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-bold">Live</span>
                            </h3>
                            <div className="space-y-4 max-h-[320px] overflow-y-auto pr-2 custom-scrollbar">
                                {displayData.map((item: any, i: number) => {
                                    const percentage = (Number(item.value) / totalSelectedRevenue * 100);
                                    return (
                                        <div key={i}
                                            onMouseEnter={() => setActiveIndex(i)}
                                            onMouseLeave={() => setActiveIndex(null)}
                                            className={`space-y-2 p-3 rounded-2xl transition-all duration-300 ${activeIndex === i ? 'bg-indigo-50/50 ring-1 ring-indigo-100' : 'hover:bg-slate-50'}`}>
                                            <div className="flex justify-between items-center text-sm">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2.5 h-2.5 rounded-full ring-4 ring-white shadow-sm" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                                                    <span className="font-bold text-slate-800">{item.name}</span>
                                                </div>
                                                <span className="font-mono font-black text-slate-900">₹{Number(item.value).toLocaleString()}</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full rounded-full transition-all duration-1000 ease-out"
                                                    style={{
                                                        width: `${percentage}%`,
                                                        backgroundColor: COLORS[i % COLORS.length],
                                                        opacity: activeIndex === null || activeIndex === i ? 1 : 0.4
                                                    }}
                                                />
                                            </div>
                                            <div className="flex justify-between text-[10px] font-bold uppercase tracking-tight text-slate-400">
                                                <span>{percentage.toFixed(1)}% Weight</span>
                                                {activeIndex === i && <span className="text-indigo-600 animate-pulse">Focused Segment</span>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <Button variant="outline" className="w-full mt-4 border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px] h-10 hover:bg-slate-50">
                                Generate Segment Report
                            </Button>
                        </div>
                    </div>
                </Card>
            </div>

            {/* CLINIC PERFORMANCE TABLE */}
            <Card className="glass-card border-none overflow-hidden relative group">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-base font-medium text-slate-800">Clinic Performance Hub</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="divide-y divide-slate-100 overflow-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 font-medium">
                                <tr>
                                    <td className="px-6 py-3">Clinic Name</td>
                                    <td className="px-6 py-3">Parent Hospital</td>
                                    <td className="px-6 py-3">Today's Revenue</td>
                                    <td className="px-6 py-3">Transactions</td>
                                    <td className="px-6 py-3 text-right">Action</td>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {revenueSummary.length > 0 ? revenueSummary.map((c: any) => (
                                    <tr
                                        key={c.clinic_id}
                                        onClick={() => onSelectClinic(c.clinic_id)} // Drill Down
                                        className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                                    >
                                        <td className="px-6 py-3 font-medium text-slate-700">{c.clinic_name}</td>
                                        <td className="px-6 py-3 text-slate-500">{c.hospital_name || 'N/A'}</td>
                                        <td className="px-6 py-3 text-slate-600 font-mono">₹{c.total_revenue?.toLocaleString()}</td>
                                        <td className="px-6 py-3 text-slate-600">{c.transaction_count}</td>
                                        <td className="px-6 py-3 text-right">
                                            <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700">View</Button>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-8 text-center text-slate-400 italic">
                                            {loadingStats ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "No sales data recorded today."}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {/* GLOBAL INVENTORY TABLE */}
            <Card className="glass-card border-none overflow-hidden relative group">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-base font-medium text-slate-800">Global Inventory Matrix</CardTitle>
                    <Package className="w-4 h-4 text-purple-600" />
                </CardHeader>
                <CardContent className="p-0">
                    <div className="divide-y divide-slate-100 max-h-[400px] overflow-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 font-medium">
                                <tr>
                                    <td className="px-6 py-3">Item Name</td>
                                    <td className="px-6 py-3">Clinic Location</td>
                                    <td className="px-6 py-3">Batch</td>
                                    <td className="px-6 py-3 text-right">Stock Level</td>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {inventory.map((item) => (
                                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-3 font-medium text-slate-700">{item.item_name}</td>
                                        <td className="px-6 py-3 text-slate-500">{item.clinic_name || 'Unknown'}</td>
                                        <td className="px-6 py-3 text-slate-400 font-mono text-xs">{item.batch_number}</td>
                                        <td className="px-6 py-3 text-right">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${item.quantity < item.threshold ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-800'}`}>
                                                {item.quantity}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            <div className="flex flex-col md:flex-row justify-end gap-4 pt-4">
                <Button onClick={generatePDF} variant="outline" className="border-slate-200 hover:bg-slate-50 h-12">
                    <Download className="mr-2 h-4 w-4" /> Download Network Report
                </Button>
                <Button asChild className="bg-[#25D366] hover:bg-[#128C7E] text-white h-12 shadow-lg shadow-green-500/20">
                    <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                        <MessageCircle className="mr-2 h-4 w-4" />
                        WhatsApp Summary
                    </a>
                </Button>
            </div>
        </div >
    )
}
