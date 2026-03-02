import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ui/use-toast'

export function AuditLogs() {
    const { toast } = useToast()
    const [logs, setLogs] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    // Filters State
    const [searchQuery, setSearchQuery] = useState('')
    const [showInfo, setShowInfo] = useState(true)
    const [showWarning, setShowWarning] = useState(true)
    const [showError, setShowError] = useState(true)

    useEffect(() => {
        fetchLogs()
    }, [])

    const fetchLogs = async () => {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('audit_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100)

            if (error) throw error
            setLogs(data || [])
        } catch (error) {
            console.error("Error fetching logs:", error)
            toast({ title: 'Error', description: 'Failed to load audit logs', variant: 'destructive' })
        } finally {
            setLoading(false)
        }
    }

    const filteredLogs = useMemo(() => {
        return logs.filter(log => {
            // Severity Filter
            if (log.status === 'INFO' && !showInfo) return false;
            if (log.status === 'WARNING' && !showWarning) return false;
            if (log.status === 'ERROR' && !showError) return false;

            // Search Filter
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                const matchesStr =
                    (log.action || '').toLowerCase().includes(query) ||
                    (log.details || '').toLowerCase().includes(query) ||
                    (log.performed_by || '').toLowerCase().includes(query);
                if (!matchesStr) return false;
            }

            return true;
        });
    }, [logs, showInfo, showWarning, showError, searchQuery]);

    const getStatusUI = (status: string) => {
        switch (status) {
            case 'ERROR':
                return {
                    icon: 'security',
                    iconBg: 'bg-red-50 text-red-500',
                    badge: 'Critical',
                    badgeClasses: 'bg-red-100 text-red-700 border-red-200'
                }
            case 'WARNING':
                return {
                    icon: 'emergency',
                    iconBg: 'bg-amber-50 text-amber-500',
                    badge: 'Warning',
                    badgeClasses: 'bg-amber-100 text-amber-700 border-amber-200'
                }
            case 'INFO':
            default:
                return {
                    icon: 'info',
                    iconBg: 'bg-blue-50 text-blue-500',
                    badge: 'Info',
                    badgeClasses: 'bg-slate-100 text-slate-600 border-slate-200'
                }
        }
    }

    const formatTimestamp = (dateString: string) => {
        const date = new Date(dateString)
        const datePart = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
        const timePart = date.toLocaleTimeString(undefined, { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
        const msPart = String(date.getMilliseconds()).padStart(2, '0').substring(0, 2)
        return `${datePart} • ${timePart}.${msPart}`
    }

    return (
        <div className="flex flex-col h-[calc(100vh-80px)] animate-in fade-in duration-500 max-w-[1600px] mx-auto bg-[#F1F5F9]">
            {/* Sub-Header Area */}
            <div className="h-16 border-b border-gray-100 px-6 md:px-8 flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-0 bg-white shadow-sm shrink-0 rounded-t-2xl">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-lg">
                        <span className="material-symbols-outlined text-[20px]">security</span>
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-900 tracking-tight">Security Audit Logs</h2>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">System Monitoring</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full border border-slate-200">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span className="text-xs font-semibold text-slate-700 uppercase tracking-tight">Live View</span>
                    </div>
                    <button onClick={fetchLogs} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-md hover:bg-slate-50 transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-300">
                        <span className={`material-symbols-outlined text-lg ${loading ? 'animate-spin' : ''}`}>sync</span>
                        <span className="hidden sm:inline">Refresh</span>
                    </button>
                    <button className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-md hover:bg-slate-50 transition-all shadow-sm">
                        <span className="material-symbols-outlined text-lg">download</span>
                        <span>Export to CSV</span>
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex flex-1 overflow-hidden border-x border-b border-slate-200 rounded-b-2xl bg-white shadow-sm">

                {/* Sidebar Filters */}
                <aside className="hidden lg:flex w-72 bg-white border-r border-slate-200 flex-col overflow-y-auto z-10">
                    <div className="p-6 space-y-8 flex-1">
                        <div>
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Filters</h3>
                            <div className="space-y-6">

                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-slate-700">Date Range (Read-Only)</label>
                                    <div className="relative">
                                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">calendar_today</span>
                                        <input
                                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm focus:ring-1 focus:ring-slate-400 outline-none text-slate-500 cursor-not-allowed"
                                            readOnly
                                            type="text"
                                            value="Last 24 Hours / 100 Logs"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-slate-700">Severity</label>
                                    <div className="space-y-3">
                                        <label className="flex items-center gap-3 cursor-pointer group">
                                            <input
                                                checked={showError}
                                                onChange={(e) => setShowError(e.target.checked)}
                                                className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                                                type="checkbox"
                                            />
                                            <span className="text-sm text-slate-600 group-hover:text-slate-900">Critical (ERROR)</span>
                                        </label>
                                        <label className="flex items-center gap-3 cursor-pointer group">
                                            <input
                                                checked={showWarning}
                                                onChange={(e) => setShowWarning(e.target.checked)}
                                                className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                                                type="checkbox"
                                            />
                                            <span className="text-sm text-slate-600 group-hover:text-slate-900">Warning (WARNING)</span>
                                        </label>
                                        <label className="flex items-center gap-3 cursor-pointer group">
                                            <input
                                                checked={showInfo}
                                                onChange={(e) => setShowInfo(e.target.checked)}
                                                className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                                                type="checkbox"
                                            />
                                            <span className="text-sm text-slate-600 group-hover:text-slate-900">Information (INFO)</span>
                                        </label>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-slate-700">Hospital ID (Read-Only)</label>
                                    <select disabled className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm text-slate-500 outline-none appearance-none cursor-not-allowed">
                                        <option>All Facilities</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                </aside>

                {/* Log List View */}
                <main className="flex-1 overflow-y-auto bg-slate-50 relative">
                    <div className="p-6 max-w-[1200px] mx-auto min-h-full flex flex-col">

                        {/* Search Bar */}
                        <div className="flex flex-col sm:flex-row gap-4 mb-6 shrink-0">
                            <div className="relative flex-1">
                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                                <input
                                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm shadow-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-400"
                                    placeholder="Search event action, details, or user ID..."
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Table Header Wrapper for clean scrolling text alignment */}
                        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex-1 flex flex-col">
                            {/* Table Header (Grid) */}
                            <div className="hidden md:grid md:grid-cols-[60px_3fr_1.5fr_100px_160px] gap-4 px-6 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-200 bg-slate-50 sticky top-0 z-10">
                                <div className="text-center">Type</div>
                                <div>Event Details</div>
                                <div>Entity / Source</div>
                                <div className="text-center">Severity</div>
                                <div className="text-right">Timestamp</div>
                            </div>

                            {/* Table Body (List) */}
                            <div className="divide-y divide-slate-100 flex-1 overflow-y-auto">
                                {loading && filteredLogs.length === 0 ? (
                                    <div className="p-12 text-center text-slate-400 flex flex-col items-center">
                                        <span className="material-symbols-outlined animate-spin text-4xl mb-4">sync</span>
                                        <p className="text-sm font-medium">Loading Audit Logs...</p>
                                    </div>
                                ) : filteredLogs.length === 0 ? (
                                    <div className="p-16 text-center text-slate-400 flex flex-col items-center">
                                        <span className="material-symbols-outlined text-5xl mb-4 opacity-50">search_off</span>
                                        <p className="text-sm font-medium">No logs found matching criteria.</p>
                                    </div>
                                ) : (
                                    filteredLogs.map(log => {
                                        const ui = getStatusUI(log.status);
                                        return (
                                            <div key={log.id} className="bg-white hover:bg-slate-50 transition-colors group">
                                                <div className="grid grid-cols-1 md:grid-cols-[60px_3fr_1.5fr_100px_160px] items-start md:items-center gap-3 md:gap-4 px-6 py-4">

                                                    {/* Icon */}
                                                    <div className="hidden md:flex items-center justify-center">
                                                        <span className={`material-symbols-outlined p-2 rounded-lg ${ui.iconBg}`}>{ui.icon}</span>
                                                    </div>

                                                    {/* Details (Mobile includes Icon & other inline hints) */}
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2 md:hidden mb-2">
                                                            <span className={`material-symbols-outlined p-1 rounded-md text-sm ${ui.iconBg}`}>{ui.icon}</span>
                                                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase border ${ui.badgeClasses}`}>{ui.badge}</span>
                                                        </div>
                                                        <h4 className="text-sm font-bold text-slate-900 truncate">{log.action || 'SYSTEM_EVENT'}</h4>
                                                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{log.details || 'No details provided.'}</p>
                                                    </div>

                                                    {/* Source / Entity */}
                                                    <div className="hidden md:block truncate">
                                                        {log.performed_by ? (
                                                            <span className="text-xs font-mono text-slate-600 bg-slate-100 px-2 py-1 rounded truncate inline-block max-w-full" title={log.performed_by}>
                                                                USR: {log.performed_by.split('-')[0]}...
                                                            </span>
                                                        ) : (
                                                            <span className="text-xs font-mono text-slate-400 bg-slate-50 px-2 py-1 rounded">SYSTEM_PROD</span>
                                                        )}
                                                    </div>

                                                    {/* Severity Badge */}
                                                    <div className="hidden md:flex justify-center">
                                                        <span className={`px-2 py-1 text-[10px] font-bold rounded uppercase border ${ui.badgeClasses}`}>
                                                            {ui.badge}
                                                        </span>
                                                    </div>

                                                    {/* Timestamp */}
                                                    <div className="text-[11px] font-medium text-slate-500 tabular-nums md:text-right">
                                                        {formatTimestamp(log.created_at)}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                    </div>
                </main>
            </div>
        </div>
    )
}
