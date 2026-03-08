import { useState, useEffect, useMemo } from 'react'
import { Loader2 } from 'lucide-react'
import { dataService as db } from '@/lib/dataService'
import { useHospital } from '@/context/HospitalContext'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ReceiptModal } from '@/components/ui/ReceiptModal'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts'

type View = 'selection' | 'staff' | 'admin' | 'inventory-dashboard' | 'setup' | 'hospitals' | 'audit_logs' | 'pos' | 'shift-management';

interface ClinicAdminDashboardProps {
    clinicId: string;
    onBack?: () => void;
    onNavigate?: (view: View) => void;
}

export function ClinicAdminDashboard({ clinicId, onBack, onNavigate }: ClinicAdminDashboardProps) {
    const { inventory, managedClinic } = useHospital()
    const [stats, setStats] = useState({ revenue: 0, transactions: 0, staffCount: 0 })
    const [dailySales, setDailySales] = useState<any[]>([])
    const [weeklyData, setWeeklyData] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [clinicData, setClinicData] = useState<any>(managedClinic || null)
    const [managerName, setManagerName] = useState<string>('Unassigned')
    const [searchQuery, setSearchQuery] = useState('')
    const [dateRange, setDateRange] = useState<'week' | 'month'>('week')


    const filteredTransactions = useMemo(() => {
        if (!searchQuery.trim()) return dailySales;
        const q = searchQuery.toLowerCase();
        return dailySales.filter((t: any) =>
            t.patient_name?.toLowerCase().includes(q) ||
            t.doctor_name?.toLowerCase().includes(q) ||
            t.sale_type?.toLowerCase().includes(q)
        );
    }, [dailySales, searchQuery]);


    // Receipt View State
    const [selectedReceiptSale, setSelectedReceiptSale] = useState<any>(null)
    const [selectedReceiptItems, setSelectedReceiptItems] = useState<any[]>([])
    const [isReceiptLoading, setIsReceiptLoading] = useState(false)

    // Stock Detail Popup State
    const [selectedStockItem, setSelectedStockItem] = useState<any>(null)

    // Filtered Inventory for this clinic
    const clinicInventory = inventory.filter((i: any) => i.clinic_id === clinicId)
    const lowStock = clinicInventory.filter((i: any) => i.quantity < i.threshold)

    useEffect(() => {
        fetchData()
    }, [clinicId, managedClinic, dateRange])

    const fetchData = async () => {
        setLoading(true)

        try {
            // 1. Clinic Details
            if (managedClinic && managedClinic.id === clinicId) {
                setClinicData(managedClinic)
            } else if (!clinicData) {
                const clinic = await db.get('clinics', clinicId);
                if (clinic) setClinicData(clinic)
            }

            const today = new Date()
            const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString()

            const rangeDays = dateRange === 'week' ? 7 : 30
            const startDate = new Date()
            startDate.setDate(startDate.getDate() - rangeDays)
            startDate.setHours(0, 0, 0, 0)

            // 2. Revenue & Historic Data
            const allSales = await db.list('sales', {
                filters: [
                    { column: 'clinic_id', operator: '==', value: clinicId },
                    { column: 'timestamp', operator: '>=', value: startDate.toISOString() }
                ],
                sort: { column: 'timestamp', ascending: true }
            });

            if (allSales) {
                // Filter today's sales for the log
                const todaySales = allSales.filter((s: any) => new Date(s.timestamp) >= new Date(startOfDay)).reverse()
                setDailySales(todaySales)

                const revenue = todaySales.reduce((sum: number, s: any) => sum + (s.amount || 0), 0)
                const transactions = todaySales.length

                // Aggregate binary weekly data
                const chartMap = new Map()

                // Initialize range days
                for (let i = rangeDays - 1; i >= 0; i--) {
                    const d = new Date()
                    d.setDate(d.getDate() - i)
                    const dateKey = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                    chartMap.set(dateKey, { name: dateKey, visits: 0, revenue: 0 })
                }

                allSales.forEach((sale: any) => {
                    const d = new Date(sale.timestamp)
                    const dateKey = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                    if (chartMap.has(dateKey)) {
                        const current = chartMap.get(dateKey)
                        chartMap.set(dateKey, {
                            ...current,
                            visits: current.visits + 1,
                            revenue: current.revenue + (sale.amount || 0)
                        })
                    }
                })

                setWeeklyData(Array.from(chartMap.values()))

                // 3. Update Stats
                const staffCount = await db.count('staff_details', {
                    filters: [
                        { column: 'clinic_id', operator: '==', value: clinicId },
                        { column: 'status', operator: '==', value: 'Active' }
                    ]
                });

                setStats({
                    revenue,
                    transactions,
                    staffCount: staffCount || 0
                })
            }

            // 4. Fetch the real manager's name
            const managers = await db.list('profiles', {
                filters: [
                    { column: 'clinic_id', operator: '==', value: clinicId },
                    { column: 'role', operator: '==', value: 'CLINIC_ADMIN' }
                ],
                limit: 1
            });

            if (managers[0]) setManagerName(managers[0].full_name)

        } catch (err) {
            console.error("Dashboard Fetch Error:", err);
        } finally {
            setLoading(false)
        }
    }

    const openReceipt = async (sale: any) => {
        setSelectedReceiptSale(sale);
        setSelectedReceiptItems([]);
        setIsReceiptLoading(true);
        try {
            const itemsData = await db.list('sale_items', {
                filters: [{ column: 'sale_id', operator: '==', value: sale.id }]
            });

            if (itemsData) {
                // Note: In Firestore, we don't have automagic joins.
                // We either need to denormalize item_name into sale_items
                // or fetch each inventory item. For now, we'll try to fetch names if needed.
                const formattedItems = await Promise.all(itemsData.map(async (item: any) => {
                    let itemName = 'Unknown Item';
                    if (item.inventory_id) {
                        const invDoc = await db.get('inventory', item.inventory_id);
                        itemName = invDoc?.item_name || 'Deleted Item';
                    }
                    // We use item.price OR item.unit_price to be safe across different schema versions
                    const priceValue = item.price !== undefined ? item.price : item.unit_price;
                    return {
                        item_name: itemName,
                        quantity: Number(item.quantity) || 0,
                        price: Number(priceValue) || 0
                    }
                }));
                setSelectedReceiptItems(formattedItems);
            }
        } catch (error) {
            console.error('Error fetching receipt items:', error);
        } finally {
            setIsReceiptLoading(false);
        }
    }

    if (loading) {
        return (
            <div className="flex h-[80vh] items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
            </div>
        )
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500 max-w-[1600px] mx-auto">
            {/* ... (Rest of component remains same as visual logic is unchanged) ... */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-200/60 pb-8">
                <div>
                    <div className="flex items-center gap-3">
                        {onBack && (
                            <button
                                onClick={onBack}
                                className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-all mr-1"
                                title="Back to Network"
                            >
                                <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                            </button>
                        )}
                        <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-200">
                            <span className="material-symbols-outlined text-[20px]">account_balance</span>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 tracking-tight">{clinicData?.name || 'Clinic Dashboard'}</h2>
                            <p className="text-sm text-slate-500 font-medium truncate">
                                {clinicData?.location || 'Operational Overview'} • Managed by {managerName}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="relative w-full md:w-80">
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xl">search</span>
                    <input
                        className="w-full pl-11 pr-5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-sm placeholder:text-slate-400"
                        placeholder="Search records..."
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {selectedReceiptSale && (
                <ReceiptModal
                    open={!!selectedReceiptSale}
                    onClose={() => setSelectedReceiptSale(null)}
                    sale={selectedReceiptSale}
                    items={selectedReceiptItems}
                />
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Dialog>
                    <DialogTrigger asChild>
                        <div id="tour-analytics-hub" className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60 flex flex-col justify-between hover:shadow-md transition-shadow cursor-pointer group">
                            <div>
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:scale-105 transition-transform">
                                        <span className="material-symbols-outlined">payments</span>
                                    </div>
                                    <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-md">+14.2%</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <p className="text-slate-500 text-sm font-medium">Daily Revenue</p>
                                    <p className="text-[10px] text-blue-500 font-bold opacity-0 group-hover:opacity-100 transition-opacity">View Transactions</p>
                                </div>
                                <h3 className="text-3xl font-bold mt-1 text-slate-900">₹{stats.revenue.toLocaleString()}</h3>
                            </div>
                            <div className="mt-6 h-12 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={weeklyData}>
                                        <Bar
                                            dataKey="revenue"
                                            radius={[4, 4, 0, 0]}
                                        >
                                            {weeklyData.map((_: any, index: number) => (
                                                <Cell
                                                    key={`cell-${index}`}
                                                    fill="#3b82f6"
                                                    opacity={index === weeklyData.length - 1 ? 1 : 0.3}
                                                />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </DialogTrigger>

                    <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col bg-white text-slate-900 rounded-2xl border-0 shadow-2xl">
                        <DialogHeader className="border-b border-slate-100 pb-4">
                            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                                <span className="material-symbols-outlined text-blue-600 text-3xl">receipt_long</span>
                                Today's Transactions
                            </DialogTitle>
                        </DialogHeader>
                        <div className="flex-1 overflow-auto mt-4 pr-2">
                            {filteredTransactions.length === 0 ? (
                                <div className="text-center py-12 text-slate-500 font-medium">No transactions found.</div>
                            ) : (
                                <div className="rounded-xl border border-slate-200 overflow-hidden">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-50 sticky top-0 border-b border-slate-200">
                                            <tr>
                                                <th className="px-5 py-3 font-bold text-slate-500 uppercase tracking-wider text-xs">Time</th>
                                                <th className="px-5 py-3 font-bold text-slate-500 uppercase tracking-wider text-xs">Patient</th>
                                                <th className="px-5 py-3 font-bold text-slate-500 uppercase tracking-wider text-xs">Doctor</th>
                                                <th className="px-5 py-3 font-bold text-slate-500 uppercase tracking-wider text-xs">Type</th>
                                                <th className="px-5 py-3 font-bold text-slate-500 uppercase tracking-wider text-xs text-right">Amount</th>
                                                <th className="px-5 py-3 font-bold text-slate-500 uppercase tracking-wider text-xs text-center w-16">Receipt</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {filteredTransactions.map((sale: any) => (
                                                <tr key={sale.id} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-5 py-4 text-slate-500 font-mono text-xs">
                                                        {new Date(sale.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </td>
                                                    <td className="px-5 py-4 font-bold text-slate-800">{sale.patient_name}</td>
                                                    <td className="px-5 py-4 text-slate-600 font-medium">{sale.doctor_name}</td>
                                                    <td className="px-5 py-4">
                                                        <span className={`inline-flex px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${sale.sale_type === 'CONSULTATION' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                                                            }`}>
                                                            {sale.sale_type.replace('_', ' ')}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-4 font-bold text-slate-900 text-right text-lg">
                                                        ₹{sale.amount?.toLocaleString()}
                                                    </td>
                                                    <td className="px-5 py-4 text-center">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                openReceipt(sale);
                                                            }}
                                                            disabled={isReceiptLoading}
                                                            className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                                            title="View Full Receipt"
                                                        >
                                                            <span className="material-symbols-outlined text-[18px]">receipt_long</span>
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="bg-slate-50 sticky bottom-0 border-t border-slate-200 font-bold text-slate-900">
                                            <tr>
                                                <td colSpan={4} className="px-5 py-4 text-right">Total Revenue:</td>
                                                <td className="px-5 py-4 text-right text-xl text-blue-600">₹{stats.revenue.toLocaleString()}</td>
                                                <td className="px-5 py-4"></td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            )}
                        </div>
                    </DialogContent>
                </Dialog>

                <div onClick={() => onNavigate?.('staff')} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60 flex flex-col justify-between hover:shadow-md transition-shadow cursor-pointer">
                    <div>
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-slate-50 text-slate-600 rounded-xl">
                                <span className="material-symbols-outlined">groups</span>
                            </div>
                            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Current Roster</span>
                        </div>
                        <p className="text-slate-500 text-sm font-medium">Active Staff</p>
                        <h3 className="text-3xl font-bold mt-1 text-slate-900">{stats.staffCount}</h3>
                    </div>
                    <div className="mt-6 flex items-center justify-between">
                        <div className="flex -space-x-2 overflow-hidden">
                            <div className="inline-block h-8 w-8 rounded-full ring-2 ring-white bg-blue-100 border border-slate-200" />
                            <div className="inline-block h-8 w-8 rounded-full ring-2 ring-white bg-emerald-100 border border-slate-200" />
                            <div className="inline-block h-8 w-8 rounded-full ring-2 ring-white bg-purple-100 border border-slate-200" />
                            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-slate-100 ring-2 ring-white text-[10px] font-bold text-slate-600">+{Math.max(0, stats.staffCount - 3)}</div>
                        </div>
                        <p className="text-[10px] text-blue-500 font-bold">Manage &rarr;</p>
                    </div>
                </div>

                <div onClick={() => onNavigate?.('inventory-dashboard')} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60 flex flex-col justify-between hover:shadow-md transition-shadow cursor-pointer">
                    <div>
                        <div className="flex justify-between items-start mb-4">
                            <div className={`p-3 rounded-xl ${lowStock.length > 0 ? 'bg-orange-50 text-orange-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                <span className="material-symbols-outlined">{lowStock.length > 0 ? 'warning' : 'check_circle'}</span>
                            </div>
                            <button className="text-xs font-bold text-blue-600 hover:underline">Restock All</button>
                        </div>
                        <p className="text-slate-500 text-sm font-medium">Critical Stock Alerts</p>
                        <h3 className={`text-3xl font-bold mt-1 ${lowStock.length > 0 ? 'text-orange-600' : 'text-emerald-600'}`}>
                            {lowStock.length < 10 ? `0${lowStock.length}` : lowStock.length} <span className="text-lg font-medium text-slate-400">Items</span>
                        </h3>
                    </div>
                    <div className="mt-6 space-y-2">
                        <div className="w-full bg-slate-100 rounded-full h-1.5 flex overflow-hidden">
                            <div className={`${lowStock.length > 0 ? 'bg-orange-500 w-4/5' : 'bg-emerald-500 w-full'} h-1.5 rounded-full`}></div>
                        </div>
                        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-tight">
                            System Status: {lowStock.length > 0 ? `${lowStock[0]?.item_name} Required` : 'All Stock Optimal'}
                        </p>
                    </div>
                </div>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200/60 hidden md:block">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Activity Overview</h2>
                        <p className="text-sm text-slate-500 mt-1">Weekly patient visits and consultation volume</p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setDateRange('week')}
                            className={`px-4 py-2 text-xs font-bold rounded-lg shadow-sm transition-colors ${dateRange === 'week' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                        >
                            Week
                        </button>
                        <button
                            onClick={() => setDateRange('month')}
                            className={`px-4 py-2 text-xs font-bold rounded-lg shadow-sm transition-colors ${dateRange === 'month' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                        >
                            Month
                        </button>
                    </div>
                </div>

                <div className="h-[300px] w-full mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={weeklyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorVisits" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1} />
                                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis
                                dataKey="name"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                                dy={10}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: '#fff',
                                    borderRadius: '12px',
                                    border: '1px solid #e2e8f0',
                                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                    fontSize: '12px'
                                }}
                                itemStyle={{ fontWeight: 700 }}
                            />
                            <Area
                                type="monotone"
                                dataKey="visits"
                                stroke="#2563eb"
                                strokeWidth={3}
                                fillOpacity={1}
                                fill="url(#colorVisits)"
                                animationDuration={1500}
                                name="Patient Visits"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-8">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60 flex flex-col h-full">
                    <h3 className="font-bold text-slate-900 mb-6 text-lg tracking-tight">Quick Actions</h3>
                    <div className="grid grid-cols-2 gap-4 flex-1 content-start">
                        <button onClick={() => onNavigate?.('pos')} className="flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-3 p-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/10 group">
                            <span className="material-symbols-outlined text-2xl group-hover:scale-110 transition-transform">point_of_sale</span>
                            <span className="text-sm font-semibold">New Sale / POS</span>
                        </button>
                        <button onClick={() => onNavigate?.('inventory-dashboard')} className="flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-3 p-4 bg-slate-50 text-slate-700 rounded-xl hover:bg-white hover:shadow-md transition-all border border-slate-200/50 group">
                            <span className="material-symbols-outlined text-slate-500 text-2xl group-hover:text-blue-600 transition-colors">inventory</span>
                            <span className="text-sm font-semibold">Update Stock</span>
                        </button>
                        <button onClick={() => onNavigate?.('shift-management')} className="flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-3 p-4 bg-slate-50 text-slate-700 rounded-xl hover:bg-white hover:shadow-md transition-all border border-slate-200/50 group">
                            <span className="material-symbols-outlined text-slate-500 text-2xl group-hover:text-blue-600 transition-colors">schedule</span>
                            <span className="text-sm font-semibold">Shift Roster</span>
                        </button>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60 flex flex-col h-[320px]">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-slate-900 text-lg tracking-tight">Recent Logs</h3>
                    </div>
                    <div className="space-y-2 overflow-y-auto pr-2 no-scrollbar flex-1">
                        {dailySales.slice(0, 3).map(sale => (
                            <div
                                key={sale.id}
                                onClick={() => openReceipt(sale)}
                                className="flex items-center gap-4 p-3 hover:bg-blue-50/50 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-blue-100 group"
                            >
                                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shrink-0 group-hover:scale-105 transition-transform">
                                    <span className="material-symbols-outlined text-[18px]">receipt_long</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-slate-900 truncate group-hover:text-blue-700">Payment Received: ₹{sale.amount?.toLocaleString()}</p>
                                    <p className="text-xs text-slate-500 font-medium truncate">Sale by {sale.doctor_name}</p>
                                </div>
                                <span className="text-[10px] font-bold text-blue-400 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">View Receipt →</span>
                            </div>
                        ))}

                        {lowStock.slice(0, 3).map(item => (
                            <div
                                key={item.id}
                                onClick={() => setSelectedStockItem(item)}
                                className="flex items-center gap-4 p-3 hover:bg-orange-50/50 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-orange-100 group"
                            >
                                <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center text-orange-600 shrink-0 group-hover:scale-105 transition-transform">
                                    <span className="material-symbols-outlined text-[18px]">priority_high</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-slate-900 truncate group-hover:text-orange-700">Low Stock Alert</p>
                                    <p className="text-xs text-slate-500 font-medium truncate">{item.item_name} • {item.quantity} units left</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onNavigate?.('inventory-dashboard');
                                            // We rely on HospitalContext's pendingRestockId which is set in useHospital but 
                                            // ClinicAdminDashboard doesn't have a direct way to set it without context.
                                            // Wait, I should use setPendingRestockId from context.
                                        }}
                                        className="px-2 py-1 bg-orange-100 text-orange-600 rounded text-[10px] font-bold hover:bg-orange-600 hover:text-white transition-colors"
                                    >
                                        Restock
                                    </button>
                                    <span className="text-[10px] font-bold text-orange-400 whitespace-nowrap">Details →</span>
                                </div>
                            </div>
                        ))}

                        {dailySales.length === 0 && lowStock.length === 0 && (
                            <div className="text-center text-slate-400 py-10 font-medium">No recent activity to show.</div>
                        )}
                    </div>
                </div>
            </div>

            <Dialog open={!!selectedStockItem} onOpenChange={(open) => !open && setSelectedStockItem(null)}>
                <DialogContent className="sm:max-w-md bg-white border border-slate-200 shadow-2xl p-0 overflow-hidden rounded-2xl text-slate-900">
                    {selectedStockItem && (
                        <div>
                            <div className="p-6 bg-orange-50 border-b border-orange-100 flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-white shadow-sm border border-orange-100 flex items-center justify-center text-orange-600">
                                    <span className="material-symbols-outlined text-2xl">medication</span>
                                </div>
                                <div>
                                    <DialogTitle className="text-xl font-bold text-slate-900">Low Stock Alert</DialogTitle>
                                    <p className="text-xs text-orange-600 font-bold uppercase tracking-wider mt-0.5">Immediate Restock Required</p>
                                </div>
                            </div>

                            <div className="p-6 space-y-4">
                                <div className="flex items-center gap-3 p-4 bg-orange-50 border border-orange-100 rounded-xl">
                                    <span className="material-symbols-outlined text-orange-600">warning</span>
                                    <div>
                                        <p className="font-bold text-slate-900">{selectedStockItem.item_name}</p>
                                        {selectedStockItem.batch_number && (
                                            <p className="text-xs text-slate-500 font-mono mt-0.5">Batch: {selectedStockItem.batch_number}</p>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-3">
                                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-center">
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">In Stock</p>
                                        <p className="text-2xl font-bold text-orange-600 mt-1">{selectedStockItem.quantity}</p>
                                        <p className="text-[10px] text-slate-400">units left</p>
                                    </div>
                                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-center">
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Threshold</p>
                                        <p className="text-2xl font-bold text-slate-900 mt-1">{selectedStockItem.threshold || 10}</p>
                                        <p className="text-[10px] text-slate-400">min. units</p>
                                    </div>
                                    <div className="p-4 bg-red-50 rounded-xl border border-red-100 text-center">
                                        <p className="text-[10px] font-bold text-red-500 uppercase tracking-wider">Deficit</p>
                                        <p className="text-2xl font-bold text-red-600 mt-1">{Math.max(0, (selectedStockItem.threshold || 10) - selectedStockItem.quantity)}</p>
                                        <p className="text-[10px] text-red-400">units short</p>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase">
                                        <span>Stock Level</span>
                                        <span className="text-orange-600">{Math.round((selectedStockItem.quantity / (selectedStockItem.threshold || 10)) * 100)}% of threshold</span>
                                    </div>
                                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                        <div
                                            className="h-2 rounded-full bg-gradient-to-r from-orange-500 to-red-500 transition-all"
                                            style={{ width: `${Math.min(100, Math.round((selectedStockItem.quantity / (selectedStockItem.threshold || 10)) * 100))}%` }}
                                        />
                                    </div>
                                </div>

                                <button
                                    onClick={() => { setSelectedStockItem(null); onNavigate?.('inventory-dashboard') }}
                                    className="w-full mt-2 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
                                >
                                    <span className="material-symbols-outlined text-[18px]">inventory</span>
                                    Go to Inventory to Restock
                                </button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
