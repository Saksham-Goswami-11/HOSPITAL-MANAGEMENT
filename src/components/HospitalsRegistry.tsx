import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ui/use-toast'
import { GlobalSearch } from './GlobalSearch'

interface HospitalsRegistryProps {
    onView?: (id: string) => void
}

export function HospitalsRegistry({ onView }: HospitalsRegistryProps) {
    const { toast } = useToast()
    const [hospitals, setHospitals] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    // Filters State
    const [searchQuery, setSearchQuery] = useState('')
    const [planFilter, setPlanFilter] = useState('All Plans')
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all')

    useEffect(() => {
        fetchHospitals()
    }, [])

    const fetchHospitals = async () => {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('hospital_stats_view')
                .select('*')
                .order('created_at', { ascending: false })

            if (error) throw error
            setHospitals(data || [])
        } catch (error) {
            console.error("Error fetching hospitals:", error)
            toast({ title: 'Error', description: 'Failed to load hospital registry', variant: 'destructive' })
        } finally {
            setLoading(false)
        }
    }

    const toggleHospitalStatus = async (id: string, currentStatus: boolean) => {
        try {
            const { error } = await supabase
                .from('hospitals')
                .update({ is_active: !currentStatus })
                .eq('id', id)

            if (error) throw error

            setHospitals(prev => prev.map(h => h.id === id ? { ...h, is_active: !currentStatus } : h))

            toast({
                title: !currentStatus ? "Hospital Activated" : "Hospital Suspended",
                description: `Access has been ${!currentStatus ? 'restored' : 'revoked'}.`,
                className: !currentStatus ? "bg-green-50 text-green-900" : "bg-red-50 text-red-900"
            })
        } catch (error: any) {
            toast({ title: "Update Failed", description: error.message, variant: "destructive" })
        }
    }

    const handleViewUsage = (hospital: any) => {
        toast({
            title: `${hospital.name} Usage`,
            description: `Storage: ${hospital.storage_used_mb || 0} MB; Clinics: ${hospital.total_clinics || 0}; Users: ${hospital.total_users || 0}`,
        })
    }

    const filteredHospitals = useMemo(() => {
        return hospitals.filter(h => {
            // Search filter
            const matchesSearch = h.name.toLowerCase().includes(searchQuery.toLowerCase()) || h.id.toLowerCase().includes(searchQuery.toLowerCase())

            // Status filter
            const isActive = h.is_active !== false;
            let matchesStatus = true;
            if (statusFilter === 'active') matchesStatus = isActive;
            if (statusFilter === 'suspended') matchesStatus = !isActive;

            // Plan filter
            let matchesPlan = true;
            const hPlan = (h.subscription_plan || 'Basic').toLowerCase();
            if (planFilter !== 'All Plans') {
                matchesPlan = hPlan === planFilter.toLowerCase();
            }

            return matchesSearch && matchesStatus && matchesPlan;
        });
    }, [hospitals, searchQuery, statusFilter, planFilter]);

    const getPlanBadge = (plan: string) => {
        const p = plan.toLowerCase();
        if (p === 'enterprise') return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700">ENTERPRISE</span>;
        if (p === 'pro' || p === 'professional') return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">PROFESSIONAL</span>;
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700">BASIC</span>;
    }

    const formatStorage = (mb: number) => {
        if (!mb) return '0 MB';
        if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
        return `${Math.round(mb)} MB`;
    }

    return (
        <div className="flex flex-col min-h-screen bg-[#f8fafc] animate-in fade-in duration-500 max-w-[1600px] mx-auto pb-24">

            {/* Header Area */}
            <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border border-slate-200 rounded-t-2xl px-6 py-4 flex flex-col md:flex-row items-start md:items-center justify-between shadow-sm mt-4 mx-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-sm shrink-0">
                        <span className="material-symbols-outlined text-2xl">corporate_fare</span>
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-slate-900 leading-tight tracking-tight">Registry Management</h1>
                        <p className="text-[11px] text-blue-600 font-bold uppercase tracking-widest mt-0.5">Super Admin</p>
                    </div>
                </div>

                <div className="mt-4 md:mt-0 w-full md:w-auto self-stretch">
                    {/* The existing GlobalSearch is integrated here for system-wide lookup if needed */}
                    <div className="w-full max-w-sm hidden md:block">
                        <GlobalSearch
                            className="w-full"
                            onNavigate={(type, id) => {
                                if (type === 'hospital' && onView) {
                                    onView(id)
                                } else {
                                    toast({ title: "Navigation", description: "Navigating to " + type + " " + id })
                                }
                            }}
                        />
                    </div>
                </div>
            </header>

            {/* Sticky Filters Bar */}
            <div className="bg-white border-x border-b border-slate-200 p-4 sticky top-[89px] z-40 shadow-sm mx-4">
                <div className="flex flex-col lg:flex-row gap-3">

                    {/* Search Input */}
                    <div className="relative flex-1">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                        <input
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400"
                            placeholder="Search hospitals by name or ID..."
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    {/* Filter Controls */}
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 items-center shrink-0">
                        <select
                            className="text-[12px] font-medium py-1.5 pl-3 pr-8 border border-slate-200 rounded-lg bg-white text-slate-600 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                            value={planFilter}
                            onChange={(e) => setPlanFilter(e.target.value)}
                        >
                            <option>All Plans</option>
                            <option value="Enterprise">Enterprise</option>
                            <option value="Professional">Professional</option>
                            <option value="Basic">Basic</option>
                        </select>

                        <div className="flex p-0.5 bg-slate-100 rounded-lg border border-slate-200 shrink-0">
                            <button
                                onClick={() => setStatusFilter('all')}
                                className={`px-3 py-1 text-[11px] font-bold rounded-md transition-all ${statusFilter === 'all' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                All
                            </button>
                            <button
                                onClick={() => setStatusFilter('active')}
                                className={`px-3 py-1 text-[11px] font-bold rounded-md transition-all ${statusFilter === 'active' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Active
                            </button>
                            <button
                                onClick={() => setStatusFilter('suspended')}
                                className={`px-3 py-1 text-[11px] font-bold rounded-md transition-all ${statusFilter === 'suspended' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Suspended
                            </button>
                        </div>

                        <button onClick={() => fetchHospitals()} disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 text-xs font-medium whitespace-nowrap bg-white hover:bg-slate-50 transition-colors">
                            <span className={`material-symbols-outlined !text-[16px] ${loading ? 'animate-spin' : ''}`}>sync</span>
                            Refresh
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Table Area */}
            <main className="p-4 mx-0 md:mx-4 flex-1">
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[800px]">
                            <thead>
                                <tr className="bg-slate-50/50 border-b border-slate-200">
                                    <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Hospital Name</th>
                                    <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Plan</th>
                                    <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center">Stats</th>
                                    <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center">Users</th>
                                    <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading && filteredHospitals.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                                            <div className="flex flex-col items-center justify-center gap-3">
                                                <span className="material-symbols-outlined animate-spin text-4xl">sync</span>
                                                <span className="text-sm font-medium">Loading Hospitals...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredHospitals.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-16 text-center text-slate-400">
                                            <div className="flex flex-col items-center justify-center gap-3">
                                                <span className="material-symbols-outlined text-5xl opacity-50">search_off</span>
                                                <span className="text-sm font-medium">No hospitals found matching filters.</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredHospitals.map(h => (
                                        <tr key={h.id} className="hover:bg-blue-50/30 transition-colors group">

                                            {/* Name & ID */}
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-semibold text-slate-800">{h.name}</span>
                                                    <span className="text-[10px] text-slate-400 font-mono mt-0.5" title={h.id}>
                                                        #HOSP-{h.id.substring(0, 4).toUpperCase()}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Plan Badge */}
                                            <td className="px-6 py-4">
                                                {getPlanBadge(h.subscription_plan || 'Basic')}
                                            </td>

                                            {/* Stats (Clinics / Storage) */}
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex flex-col items-center">
                                                    <span className="text-xs font-medium text-slate-700">{h.total_clinics || 0} Units</span>
                                                    <span className="text-[10px] text-slate-400 mt-0.5">{formatStorage(h.storage_used_mb)}</span>
                                                </div>
                                            </td>

                                            {/* Users Count */}
                                            <td className="px-6 py-4">
                                                <div className="flex justify-center">
                                                    <div className="flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-100">
                                                        <span className="material-symbols-outlined text-[14px] text-slate-400">group</span>
                                                        <span className="text-xs font-bold text-slate-600 tabular-nums">{h.total_users || 0}</span>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Status Badge */}
                                            <td className="px-6 py-4">
                                                <span className={`flex items-center gap-1.5 text-xs font-semibold ${h.is_active !== false ? 'text-emerald-600' : 'text-red-500'}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${h.is_active !== false ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                                                    {h.is_active !== false ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>

                                            {/* Actions */}
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => onView ? onView(h.id) : handleViewUsage(h)}
                                                        title="View Usage Details"
                                                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all focus:outline-none"
                                                    >
                                                        <span className="material-symbols-outlined !text-[18px]">visibility</span>
                                                    </button>

                                                    <button
                                                        onClick={() => toggleHospitalStatus(h.id, h.is_active !== false)}
                                                        title={h.is_active !== false ? 'Suspend Hospital' : 'Activate Hospital'}
                                                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all focus:outline-none"
                                                    >
                                                        <span className="material-symbols-outlined !text-[18px]">
                                                            {h.is_active !== false ? 'block' : 'power_settings_new'}
                                                        </span>
                                                    </button>
                                                </div>
                                            </td>

                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Fake Footer for Pagination as in mock */}
                    {!loading && filteredHospitals.length > 0 && (
                        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                            <span className="text-[11px] text-slate-500 font-medium">Showing {filteredHospitals.length} entries</span>
                        </div>
                    )}
                </div>
            </main>

            {/* Floating Action Button for adding a Hospital (Mock usage, might open a modal later) */}
            <button
                title="Register New Hospital"
                className="fixed bottom-10 right-10 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg shadow-blue-200 flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-40"
            >
                <span className="material-symbols-outlined !text-[28px]">add</span>
            </button>

        </div>
    )
}
