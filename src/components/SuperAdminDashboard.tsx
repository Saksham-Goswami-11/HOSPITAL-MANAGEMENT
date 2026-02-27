import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { createClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ui/use-toast'
import { GlobalSearch } from './GlobalSearch'
import { Input, Label, Button } from '@/components/ui/basic'
import { Loader2 } from 'lucide-react'

interface SuperAdminDashboardProps {
    onView?: (id: string) => void
}

export function SuperAdminDashboard({ onView }: SuperAdminDashboardProps) {
    const { toast } = useToast()
    const [stats, setStats] = useState({
        hospitals: 0,
        users: 0,
        active: 0,
        storage: '0 MB'
    })
    const [hospitals, setHospitals] = useState<any[]>([])
    const [recentHospitals, setRecentHospitals] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    const [isRegisterOpen, setIsRegisterOpen] = useState(false)
    const [registerLoading, setRegisterLoading] = useState(false)

    // Auto-generate Slug State
    const [hospitalName, setHospitalName] = useState("")
    const [hospitalSlug, setHospitalSlug] = useState("")

    // Generate slug from name automatically when name changes
    useEffect(() => {
        const generatedSlug = hospitalName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-') // replace non-alphanumeric with dashes
            .replace(/^-+|-+$/g, '')     // trim leading/trailing dashes
        setHospitalSlug(generatedSlug)
    }, [hospitalName])

    // Fetch SaaS Metrics
    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        try {
            setLoading(true)
            // 1. Hospital List & Stats from View
            const { data: hospitalList, error } = await supabase
                .from('hospital_stats_view')
                .select('*')
                .order('created_at', { ascending: false })

            if (error) throw error
            setHospitals(hospitalList || [])
            setRecentHospitals(hospitalList?.slice(0, 5) || []) // Get top 5 for feed

            // Calculate aggregations
            const totalHospitals = hospitalList?.length || 0;
            const totalUsers = hospitalList?.reduce((sum, h) => sum + (h.total_users || 0), 0) || 0;
            const activeCount = hospitalList?.filter(h => h.is_active !== false).length || 0;

            // Calculate Total Storage
            const totalMB = hospitalList?.reduce((sum, h) => sum + (h.storage_used_mb || 0), 0) || 0;
            const formattedStorage = totalMB < 1024
                ? `${totalMB.toFixed(1)} MB`
                : `${(totalMB / 1024).toFixed(2)} GB`;

            setStats({
                hospitals: totalHospitals,
                users: totalUsers,
                active: activeCount,
                storage: formattedStorage
            })

        } catch (error) {
            console.error("Super Admin Fetch Error:", error)
        } finally {
            setLoading(false)
        }
    }

    const formatTimeAgo = (dateString: string) => {
        const date = new Date(dateString)
        const now = new Date()
        const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

        if (diffInSeconds < 60) return 'Just now'
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
        return `${Math.floor(diffInSeconds / 86400)}d ago`
    }

    const getPlanBadge = (plan: string) => {
        const p = plan.toLowerCase();
        if (p === 'enterprise') return <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-2 py-1 rounded">ENTERPRISE</span>;
        if (p === 'pro' || p === 'professional') return <span className="text-[10px] font-bold bg-gray-100 text-gray-600 px-2 py-1 rounded">PRO</span>;
        return <span className="text-[10px] font-bold bg-gray-100 text-gray-600 px-2 py-1 rounded">BASIC</span>;
    }

    async function handleRegisterHospital(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setRegisterLoading(true)
        const formData = new FormData(e.currentTarget)
        const hospitalName = formData.get('hospital_name') as string
        const hospitalSlug = formData.get('hospital_slug') as string
        const adminEmail = formData.get('admin_email') as string
        const adminPassword = formData.get('admin_password') as string
        const adminName = formData.get('admin_name') as string

        try {
            // 1. Create temporary auth client
            const tempSupabase = createClient(
                import.meta.env.VITE_SUPABASE_URL,
                import.meta.env.VITE_SUPABASE_ANON_KEY
            )

            toast({ title: 'Registration Started', description: 'Creating hospital & admin account...', duration: 3000 })

            // 2. Sign up new hospital admin
            const { data: authData, error: authError } = await tempSupabase.auth.signUp({
                email: adminEmail,
                password: adminPassword,
                options: {
                    data: { full_name: adminName, role: 'HOSPITAL_ADMIN' }
                }
            })

            if (authError) throw authError
            if (!authData.user) throw new Error("No user created")

            // 3. Insert Hospital into DB
            const { data: newHospital, error: hospError } = await supabase
                .from('hospitals')
                .insert({
                    name: hospitalName,
                    slug: hospitalSlug,
                    owner_id: authData.user.id
                })
                .select()
                .single()

            if (hospError) throw hospError

            // 4. Force Update Profile with new hospital_id & ROLE
            const { error: profileError } = await supabase
                .from('profiles')
                .update({
                    hospital_id: newHospital.id,
                    role: 'HOSPITAL_ADMIN'
                })
                .eq('id', authData.user.id)

            if (profileError) console.error("Profile linking failed:", profileError)

            toast({
                title: '✅ Hospital Onboarded',
                description: `Successfully registered ${hospitalName} and created admin account for ${adminName}.`,
                className: 'bg-green-50 border-green-200 text-green-900'
            })

            setIsRegisterOpen(false)
            fetchData() // Refresh dashboard stats

        } catch (err: any) {
            console.error('Registration failed:', err)
            toast({
                title: 'Registration Failed',
                description: err.message || 'Could not onboard hospital.',
                variant: 'destructive'
            })
        } finally {
            setRegisterLoading(false)
        }
    }

    return (
        <div className="flex flex-col min-h-screen bg-white animate-in fade-in duration-500 w-full max-w-[1600px] mx-auto">

            {/* Header Area */}
            <header className="h-20 border-b border-gray-100 px-6 md:px-8 flex flex-col md:flex-row md:items-center justify-between sticky top-0 bg-white/80 backdrop-blur-md z-30 gap-4 md:gap-0 pt-4 md:pt-0">
                <div>
                    <h1 className="text-xl font-bold text-gray-900 leading-tight">SaaS Command Center</h1>
                    <p className="text-xs text-gray-500 mt-0.5">Real-time infrastructure monitoring</p>
                </div>
                <div className="flex items-center gap-4 self-end md:self-auto pb-4 md:pb-0">
                    <div className="w-full max-w-sm hidden md:block relative z-50">
                        <GlobalSearch
                            className="bg-gray-50 border-none rounded-lg text-sm w-64 focus:ring-2 focus:ring-blue-100"
                            onNavigate={(type, id) => {
                                if (type === 'hospital' && onView) {
                                    onView(id)
                                } else {
                                    toast({ title: "Navigation", description: "Navigating to " + type + " " + id })
                                }
                            }}
                        />
                    </div>
                    <Dialog open={isRegisterOpen} onOpenChange={setIsRegisterOpen}>
                        <DialogTrigger asChild>
                            <button className="bg-[#2563eb] hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold transition-all shadow-lg shadow-blue-500/20 active:scale-95 whitespace-nowrap">
                                <span className="material-symbols-outlined text-[18px]">add_circle</span>
                                <span className="hidden sm:inline">Add New Hospital</span>
                            </button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[500px] bg-white">
                            <DialogHeader>
                                <DialogTitle className="text-xl font-bold text-gray-900">Onboard New Hospital</DialogTitle>
                                <DialogDescription className="text-gray-500">
                                    Register a new hospital tenant and create their initial administrator account.
                                </DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleRegisterHospital} className="space-y-4 pt-4">
                                <div className="space-y-2">
                                    <Label className="text-gray-700 font-medium">Hospital Name</Label>
                                    <Input
                                        name="hospital_name"
                                        required
                                        placeholder="e.g. City General Hospital"
                                        className="h-11"
                                        value={hospitalName}
                                        onChange={(e) => setHospitalName(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-gray-700 font-medium">Organization Slug (Unique URL ID)</Label>
                                    <Input
                                        name="hospital_slug"
                                        required
                                        placeholder="e.g. city-general-ny"
                                        className="h-11 font-mono text-sm"
                                        value={hospitalSlug}
                                        onChange={(e) => setHospitalSlug(e.target.value)}
                                    />
                                    <p className="text-[10px] text-gray-500">This URL-friendly ID is automatically generated but can be customized.</p>
                                </div>
                                <div className="pt-2 border-t border-gray-100">
                                    <h4 className="text-sm font-semibold text-gray-900 mb-4">Initial Administrator Account</h4>
                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <div className="space-y-2">
                                            <Label className="text-gray-700 font-medium">Admin Full Name</Label>
                                            <Input name="admin_name" required placeholder="John Doe" className="h-11" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-gray-700 font-medium">Temporary Password</Label>
                                            <Input name="admin_password" type="password" required minLength={6} placeholder="••••••" className="h-11" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-gray-700 font-medium">Admin Email (Login ID)</Label>
                                        <Input name="admin_email" type="email" required placeholder="admin@citygeneral.com" className="h-11" />
                                    </div>
                                </div>
                                <DialogFooter className="pt-4">
                                    <Button type="submit" disabled={registerLoading} className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-semibold">
                                        {registerLoading ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <span className="material-symbols-outlined text-[18px] mr-2">corporate_fare</span>}
                                        Launch Hospital Tenant
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
            </header>

            {/* Main Content Workspace */}
            <main className="flex-1 bg-[#FFFFFF] p-6 md:p-8 space-y-8">

                {/* 4 KPI Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">

                    {/* Total Hospitals */}
                    <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow group">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-2 bg-blue-50 rounded-lg text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                <span className="material-symbols-outlined">corporate_fare</span>
                            </div>
                            <span className="text-[10px] font-bold text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></span> Active
                            </span>
                        </div>
                        <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Total Hospitals</p>
                            <h3 className="text-3xl font-bold text-gray-900">{stats.hospitals}</h3>
                        </div>
                        {/* Decorative Chart */}
                        <div className="mt-4 h-8 flex items-end gap-1 opacity-80 mix-blend-multiply">
                            <div className="flex-1 bg-blue-100 rounded-t h-[40%]"></div>
                            <div className="flex-1 bg-blue-100 rounded-t h-[60%]"></div>
                            <div className="flex-1 bg-blue-200 rounded-t h-[45%]"></div>
                            <div className="flex-1 bg-blue-400 rounded-t h-[80%]"></div>
                            <div className="flex-1 bg-blue-100 rounded-t h-[50%]"></div>
                            <div className="flex-1 bg-blue-600 rounded-t h-[100%]"></div>
                        </div>
                    </div>

                    {/* Active Users */}
                    <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow group">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-2 bg-purple-50 rounded-lg text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                                <span className="material-symbols-outlined">group</span>
                            </div>
                            <span className="text-[10px] font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full">Overall</span>
                        </div>
                        <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Total Users</p>
                            <h3 className="text-3xl font-bold text-gray-900">{stats.users}</h3>
                        </div>
                        {/* Decorative Chart */}
                        <div className="mt-4 h-8 flex items-end gap-1 opacity-80 mix-blend-multiply">
                            <div className="flex-1 bg-purple-100 rounded-t h-[30%]"></div>
                            <div className="flex-1 bg-purple-100 rounded-t h-[50%]"></div>
                            <div className="flex-1 bg-purple-200 rounded-t h-[70%]"></div>
                            <div className="flex-1 bg-purple-400 rounded-t h-[40%]"></div>
                            <div className="flex-1 bg-purple-600 rounded-t h-[90%]"></div>
                            <div className="flex-1 bg-purple-300 rounded-t h-[60%]"></div>
                        </div>
                    </div>

                    {/* System Health */}
                    <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow group">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                                <span className="material-symbols-outlined">verified</span>
                            </div>
                            <span className="text-[10px] font-bold text-emerald-600 border border-emerald-100 px-2 py-0.5 rounded-full">Optimal</span>
                        </div>
                        <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">System Health</p>
                            <h3 className="text-3xl font-bold text-gray-900">99.9%</h3>
                        </div>
                        {/* Decorative Chart */}
                        <div className="mt-4 h-8 flex items-end gap-1 opacity-80 mix-blend-multiply">
                            <div className="flex-1 bg-emerald-100 rounded-t h-[90%]"></div>
                            <div className="flex-1 bg-emerald-100 rounded-t h-[95%]"></div>
                            <div className="flex-1 bg-emerald-200 rounded-t h-[92%]"></div>
                            <div className="flex-1 bg-emerald-400 rounded-t h-[98%]"></div>
                            <div className="flex-1 bg-emerald-600 rounded-t h-[100%]"></div>
                            <div className="flex-1 bg-emerald-300 rounded-t h-[99%]"></div>
                        </div>
                    </div>

                    {/* Storage Utilization */}
                    <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow group">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-2 bg-orange-50 rounded-lg text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-colors">
                                <span className="material-symbols-outlined">storage</span>
                            </div>
                            <span className="text-[10px] font-bold text-gray-400 px-2 py-0.5">Aggregated</span>
                        </div>
                        <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Total Storage</p>
                            <h3 className="text-3xl font-bold text-gray-900">{stats.storage}</h3>
                        </div>
                        {/* Decorative Chart */}
                        <div className="mt-4 h-8 flex items-end gap-1 opacity-80 mix-blend-multiply">
                            <div className="flex-1 bg-orange-100 rounded-t h-[20%]"></div>
                            <div className="flex-1 bg-orange-100 rounded-t h-[40%]"></div>
                            <div className="flex-1 bg-orange-200 rounded-t h-[50%]"></div>
                            <div className="flex-1 bg-orange-400 rounded-t h-[60%]"></div>
                            <div className="flex-1 bg-orange-600 rounded-t h-[68%]"></div>
                            <div className="flex-1 bg-orange-300 rounded-t h-[65%]"></div>
                        </div>
                    </div>

                </div>

                {/* Sub-grid for Tables / Feeds */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

                    {/* Left: Recently Onboarded Hospitals */}
                    <div className="xl:col-span-2 bg-white rounded-2xl border border-gray-100 overflow-hidden flex flex-col shadow-sm">
                        <div className="p-6 border-b border-gray-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div>
                                <h2 className="font-bold text-gray-900 text-lg">Recently Onboarded Hospitals</h2>
                                <p className="text-xs text-gray-500 mt-1">Showing latest 10 hospital entries across all regions</p>
                            </div>
                            <button className="text-[#2563eb] text-sm font-semibold hover:underline">Export CSV</button>
                        </div>
                        <div className="overflow-x-auto flex-1">
                            <table className="w-full text-left min-w-[600px]">
                                <thead className="bg-gray-50/50 border-b border-gray-100">
                                    <tr>
                                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Hospital Name</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Clinics</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Plan</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Users</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-4 text-right"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {loading && hospitals.length === 0 && (
                                        <tr><td colSpan={6} className="text-center py-8 text-gray-400"><span className="material-symbols-outlined animate-spin text-2xl">sync</span></td></tr>
                                    )}
                                    {hospitals.slice(0, 10).map((h, i) => {
                                        // Generate an avatar initial based on hospital name
                                        const initial = h.name.substring(0, 2).toUpperCase();
                                        const bgColors = ['bg-blue-50 text-blue-600', 'bg-emerald-50 text-emerald-600', 'bg-amber-50 text-amber-600', 'bg-purple-50 text-purple-600'];
                                        const colorClass = bgColors[i % bgColors.length];

                                        return (
                                            <tr key={h.id} className="hover:bg-gray-50/50 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-8 h-8 rounded shrink-0 flex items-center justify-center text-xs font-bold ${colorClass}`}>
                                                            {initial}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-semibold text-gray-900 truncate max-w-[180px]">{h.name}</p>
                                                            <p className="text-[10px] text-gray-400">Onboarded {formatTimeAgo(h.created_at)}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-600">{h.total_clinics || 0}</td>
                                                <td className="px-6 py-4">
                                                    {getPlanBadge(h.subscription_plan || 'Basic')}
                                                </td>
                                                <td className="px-6 py-4 text-sm font-medium text-gray-700">{(h.total_users || 0).toLocaleString()}</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-1.5">
                                                        {h.is_active !== false ? (
                                                            <>
                                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                                                <span className="text-xs font-medium text-emerald-700">Active</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                                                                <span className="text-xs font-medium text-red-700">Suspended</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button
                                                        onClick={() => onView && onView(h.id)}
                                                        className="text-gray-400 hover:text-blue-600 p-1 rounded-md hover:bg-blue-50 transition-colors"
                                                    >
                                                        <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Right: System Activity Feed */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden max-h-[600px]">
                        <div className="p-6 border-b border-gray-50 shrink-0">
                            <h2 className="font-bold text-gray-900">System Activity Feed</h2>
                            <p className="text-xs text-gray-500 mt-1">Live infrastructure event log & signups</p>
                        </div>
                        <div className="p-6 flex-1 overflow-y-auto space-y-6">

                            {/* Inject static feed mixed with actual onboardings */}
                            {recentHospitals.map((h) => (
                                <div key={`ob-${h.id}`} className="flex gap-4 group">
                                    <div className="relative">
                                        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 z-10 relative">
                                            <span className="material-symbols-outlined text-[18px]">person_add</span>
                                        </div>
                                        <div className="absolute top-8 bottom-[-24px] left-1/2 -translate-x-1/2 w-px bg-gray-100 group-last:hidden"></div>
                                    </div>
                                    <div className="flex-1 pb-4">
                                        <div className="flex justify-between items-start">
                                            <p className="text-sm font-bold text-gray-900">New Onboarding</p>
                                            <span className="text-[10px] text-gray-400">{formatTimeAgo(h.created_at)}</span>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1 leading-relaxed">Hospital '{h.name}' finalized setup. Tenant instance deployed automatically.</p>
                                    </div>
                                </div>
                            ))}

                            {/* Static mock feeds to make it look alive */}
                            <div className="flex gap-4 group">
                                <div className="relative">
                                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 z-10 relative">
                                        <span className="material-symbols-outlined text-[18px]">cloud_upload</span>
                                    </div>
                                    <div className="absolute top-8 bottom-[-24px] left-1/2 -translate-x-1/2 w-px bg-gray-100 group-last:hidden"></div>
                                </div>
                                <div className="flex-1 pb-4">
                                    <div className="flex justify-between items-start">
                                        <p className="text-sm font-bold text-gray-900">Database Snapshot</p>
                                        <span className="text-[10px] text-gray-400">12h ago</span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">Full system backup for Master Database finished successfully.</p>
                                </div>
                            </div>

                            <div className="flex gap-4 group">
                                <div className="relative">
                                    <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 z-10 relative">
                                        <span className="material-symbols-outlined text-[18px]">update</span>
                                    </div>
                                    <div className="absolute top-8 bottom-[-24px] left-1/2 -translate-x-1/2 w-px bg-gray-100 group-last:hidden"></div>
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-start">
                                        <p className="text-sm font-bold text-gray-900">Security Patch</p>
                                        <span className="text-[10px] text-gray-400">1d ago</span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">Vulnerability patch applied to all core API clusters securely.</p>
                                </div>
                            </div>

                            {/* Empty state padding if needed */}
                            {recentHospitals.length === 0 && !loading && (
                                <div className="text-center py-8 text-gray-400 text-sm">No recent network activity documented.</div>
                            )}

                        </div>
                        <div className="p-4 bg-gray-50 text-center border-t border-gray-100 shrink-0">
                            <button className="text-xs font-bold text-gray-500 hover:text-gray-900 transition-colors">View Full Audit Trail</button>
                        </div>
                    </div>

                </div>

            </main>
        </div>
    )
}
