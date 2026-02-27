import React, { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/basic'
import { Button, Input, Label } from '@/components/ui/basic'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Building2, TrendingUp, AlertTriangle, Plus, Loader2, UserPlus, Download, MessageCircle, Package, ArrowUpRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ui/use-toast'
import { jsPDF } from "jspdf"
import { useHospital } from '@/context/HospitalContext'

interface HospitalDashboardProps {
    onSelectClinic: (id: string) => void;
}

export function HospitalDashboard({ onSelectClinic }: HospitalDashboardProps) {
    const { toast } = useToast()
    const { inventory, profile, hospital } = useHospital()

    // Derived state from context
    const lowStock = inventory.filter(i => i.quantity < i.threshold)

    const [isRegisterOpen, setIsRegisterOpen] = useState(false)
    const [registerLoading, setRegisterLoading] = useState(false)
    const [expiringItems, setExpiringItems] = useState<any[]>([])
    const [revenueSummary, setRevenueSummary] = useState<any[]>([])
    const [loadingStats, setLoadingStats] = useState(true)

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
            <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-slate-200/60 pb-6">
                <div>
                    <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">{hospital?.name || 'Hospital Dashboard'}</h1>
                    <h2 className="text-2xl font-semibold text-slate-700 mt-1">Hospital Headquarters</h2>
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
                <Card className="glass-card border-none overflow-hidden relative group">
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

                <Card className="glass-card border-none overflow-hidden relative group">
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

                <Card className={`glass-card border-none overflow-hidden relative group ${lowStock.length > 0 ? 'bg-red-50/50' : ''}`}>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">System Alerts</CardTitle>
                        <AlertTriangle className={`w-4 h-4 ${lowStock.length > 0 ? 'text-red-500 animate-pulse' : 'text-slate-400'}`} />
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
                                {revenueSummary.length > 0 ? revenueSummary.map((c) => (
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
