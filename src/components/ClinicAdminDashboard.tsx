import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useHospital } from '@/context/HospitalContext'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ReceiptModal } from '@/components/ui/ReceiptModal'

type View = 'selection' | 'staff' | 'admin' | 'inventory-dashboard' | 'setup' | 'hospitals' | 'audit_logs' | 'pos';

interface ClinicAdminDashboardProps {
    clinicId: string;
    onBack?: () => void;
    onNavigate?: (view: View) => void;
}

export function ClinicAdminDashboard({ clinicId, onBack, onNavigate }: ClinicAdminDashboardProps) {
    const { inventory, managedClinic } = useHospital()
    const [stats, setStats] = useState({ revenue: 0, transactions: 0, staffCount: 0 })
    const [dailySales, setDailySales] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [clinicData, setClinicData] = useState<any>(managedClinic || null)
    const [managerName, setManagerName] = useState<string>('Unassigned')

    // Receipt View State
    const [selectedReceiptSale, setSelectedReceiptSale] = useState<any>(null)
    const [selectedReceiptItems, setSelectedReceiptItems] = useState<any[]>([])
    const [isReceiptLoading, setIsReceiptLoading] = useState(false)

    // Filtered Inventory for this clinic
    const clinicInventory = inventory.filter(i => i.clinic_id === clinicId)
    const lowStock = clinicInventory.filter(i => i.quantity < i.threshold)

    useEffect(() => {
        fetchData()
    }, [clinicId, managedClinic])

    const fetchData = async () => {
        setLoading(true)

        // 1. Clinic Details (Use Context if available, else fetch)
        if (managedClinic && managedClinic.id === clinicId) {
            setClinicData(managedClinic)
        } else if (!clinicData) {
            const { data: clinic } = await supabase
                .from('clinics')
                .select('*')
                .eq('id', clinicId)
                .single()
            if (clinic) setClinicData(clinic)
        }

        const today = new Date().toISOString().split('T')[0]

        // 2. Revenue (Fetch full details)
        const { data: salesData } = await supabase
            .from('sales')
            .select('*')
            .eq('clinic_id', clinicId)
            .gte('timestamp', `${today}T00:00:00`)
            .order('timestamp', { ascending: false })

        if (salesData) {
            setDailySales(salesData)
        }

        const revenue = salesData?.reduce((sum, s) => sum + (s.amount || 0), 0) || 0
        const transactions = salesData?.length || 0

        // 3. Staff Count
        const { count } = await supabase
            .from('staff_details')
            .select('*', { count: 'exact', head: true })
            .eq('clinic_id', clinicId)
            .eq('status', 'Active')

        setStats({
            revenue,
            transactions,
            staffCount: count || 0
        })

        // 4. Fetch the real manager's name
        const { data: managerData } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('clinic_id', clinicId)
            .eq('role', 'CLINIC_ADMIN')
            .limit(1)
            .single()

        if (managerData) {
            setManagerName(managerData.full_name)
        }

        setLoading(false)
    }

    const openReceipt = async (sale: any) => {
        // Always open the modal immediately with the sale data
        setSelectedReceiptSale(sale);
        setSelectedReceiptItems([]);
        setIsReceiptLoading(true);

        try {
            // Best-effort: fetch associated items for pharmacy sales
            const { data: itemsData, error } = await supabase
                .from('sale_items')
                .select('quantity, price, inventory(item_name)')
                .eq('sale_id', sale.id);

            if (!error && itemsData) {
                const formattedItems = itemsData.map((item: any) => ({
                    item_name: (Array.isArray(item.inventory) ? item.inventory[0]?.item_name : item.inventory?.item_name) || 'Unknown Item',
                    quantity: item.quantity,
                    price: item.price
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
            {/* HEADER AREA */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    {onBack && (
                        <button onClick={onBack} className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors mb-2">
                            <span className="material-symbols-outlined text-lg">arrow_back</span>
                            Back to Network View
                        </button>
                    )}
                    <div className="flex items-center gap-4">
                        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{clinicData?.name || 'Clinic Dashboard'}</h1>
                        <div className="flex items-center gap-1 bg-green-50 text-green-700 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border border-green-100">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                            Live System
                        </div>
                    </div>
                    <p className="text-slate-500 mt-1 flex items-center gap-2 text-sm">
                        {clinicData?.hospital_name && (
                            <span className="font-medium text-slate-700">{clinicData.hospital_name}</span>
                        )}
                        {clinicData?.hospital_name && <span>•</span>}
                        {clinicData?.location && <span>{clinicData.location}</span>}
                        {(clinicData?.hospital_name || clinicData?.location) && <span>•</span>}
                        <span>Managed by {managerName}</span>
                    </p>
                </div>
                <div className="relative w-full sm:w-96">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl">search</span>
                    <input className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-sm" placeholder="Search patients, staff, or inventory..." type="text" />
                </div>
            </div>

            {/* TOP CARDS */}
            {/* Receipt Modal Viewer (Moved outside parent dialog for z-index layering) */}
            {selectedReceiptSale && (
                <ReceiptModal
                    open={!!selectedReceiptSale}
                    onClose={() => setSelectedReceiptSale(null)}
                    sale={selectedReceiptSale}
                    items={selectedReceiptItems}
                />
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Revenue Card - using Dialog to keep historic txn logic */}
                <Dialog>
                    <DialogTrigger asChild>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60 flex flex-col justify-between hover:shadow-md transition-shadow cursor-pointer group">
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
                            <div className="mt-6 h-12 w-full flex items-end gap-1">
                                <div className="flex-1 bg-blue-100 rounded-t h-[40%]"></div>
                                <div className="flex-1 bg-blue-100 rounded-t h-[60%]"></div>
                                <div className="flex-1 bg-blue-100 rounded-t h-[50%]"></div>
                                <div className="flex-1 bg-blue-200 rounded-t h-[80%]"></div>
                                <div className="flex-1 bg-blue-100 rounded-t h-[45%]"></div>
                                <div className="flex-1 bg-blue-500 rounded-t h-[100%]"></div>
                                <div className="flex-1 bg-blue-300 rounded-t h-[70%]"></div>
                            </div>
                        </div>
                    </DialogTrigger>

                    {/* Transactions Modal */}
                    <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col bg-white text-slate-900 rounded-2xl border-0 shadow-2xl">
                        <DialogHeader className="border-b border-slate-100 pb-4">
                            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                                <span className="material-symbols-outlined text-blue-600 text-3xl">receipt_long</span>
                                Today's Transactions
                            </DialogTitle>
                        </DialogHeader>
                        <div className="flex-1 overflow-auto mt-4 pr-2">
                            {dailySales.length === 0 ? (
                                <div className="text-center py-12 text-slate-500 font-medium">No transactions recorded today.</div>
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
                                            {dailySales.map(sale => (
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

                {/* Staff Card */}
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

                {/* Alerts Card */}
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

            {/* ACTIVITY OVERVIEW CHART (Visual only matching HTML) */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200/60 hidden md:block">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Activity Overview</h2>
                        <p className="text-sm text-slate-500 mt-1">Weekly patient visits and consultation volume</p>
                    </div>
                    <div className="flex gap-2">
                        <button className="px-4 py-2 text-xs font-bold bg-slate-100 text-slate-900 rounded-lg hover:bg-slate-200 transition-colors shadow-sm">Week</button>
                        <button className="px-4 py-2 text-xs font-bold bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors">Month</button>
                    </div>
                </div>
                <div className="relative h-[300px] w-full mt-4">
                    <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 1000 300">
                        <defs>
                            <linearGradient id="chartGradient" x1="0%" x2="0%" y1="0%" y2="100%">
                                <stop offset="0%" stopColor="rgba(37, 99, 235, 0.15)"></stop>
                                <stop offset="100%" stopColor="rgba(37, 99, 235, 0)"></stop>
                            </linearGradient>
                        </defs>
                        <line stroke="#f1f5f9" strokeWidth="1" x1="0" x2="1000" y1="0" y2="0"></line>
                        <line stroke="#f1f5f9" strokeWidth="1" x1="0" x2="1000" y1="75" y2="75"></line>
                        <line stroke="#f1f5f9" strokeWidth="1" x1="0" x2="1000" y1="150" y2="150"></line>
                        <line stroke="#f1f5f9" strokeWidth="1" x1="0" x2="1000" y1="225" y2="225"></line>
                        <line stroke="#f1f5f9" strokeWidth="1" x1="0" x2="1000" y1="300" y2="300"></line>
                        <path d="M0,250 Q150,180 300,220 T600,120 T1000,180 L1000,300 L0,300 Z" fill="url(#chartGradient)"></path>
                        <path d="M0,250 Q150,180 300,220 T600,120 T1000,180" fill="none" stroke="#2563eb" strokeLinecap="round" strokeWidth="3"></path>
                        <circle cx="0" cy="250" fill="white" r="4" stroke="#2563eb" strokeWidth="2"></circle>
                        <circle cx="300" cy="220" fill="white" r="4" stroke="#2563eb" strokeWidth="2"></circle>
                        <circle cx="600" cy="120" fill="white" r="4" stroke="#2563eb" strokeWidth="2"></circle>
                        <circle cx="1000" cy="180" fill="white" r="4" stroke="#2563eb" strokeWidth="2"></circle>
                    </svg>
                    <div className="absolute bottom-0 w-full flex justify-between px-2 pt-4 border-t border-slate-100">
                        {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(day => (
                            <span key={day} className="text-[10px] font-bold text-slate-400">{day}</span>
                        ))}
                    </div>
                </div>
            </div>

            {/* BOTTOM SECTION */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-8">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60 flex flex-col h-full">
                    <h3 className="font-bold text-slate-900 mb-6 text-lg tracking-tight">Quick Actions</h3>
                    <div className="grid grid-cols-2 gap-4 flex-1 content-start">
                        {/* Point of Sale Shortcut */}
                        <button onClick={() => onNavigate?.('pos')} className="flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-3 p-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/10 group">
                            <span className="material-symbols-outlined text-2xl group-hover:scale-110 transition-transform">point_of_sale</span>
                            <span className="text-sm font-semibold">New Sale / POS</span>
                        </button>

                        {/* Inventory Update Shortcut */}
                        <button onClick={() => onNavigate?.('inventory-dashboard')} className="flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-3 p-4 bg-slate-50 text-slate-700 rounded-xl hover:bg-white hover:shadow-md transition-all border border-slate-200/50 group">
                            <span className="material-symbols-outlined text-slate-500 text-2xl group-hover:text-blue-600 transition-colors">inventory</span>
                            <span className="text-sm font-semibold">Update Stock</span>
                        </button>

                        {/* Staff Roster Shortcut */}
                        <button onClick={() => onNavigate?.('staff')} className="flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-3 p-4 bg-slate-50 text-slate-700 rounded-xl hover:bg-white hover:shadow-md transition-all border border-slate-200/50 group">
                            <span className="material-symbols-outlined text-slate-500 text-2xl group-hover:text-blue-600 transition-colors">calendar_month</span>
                            <span className="text-sm font-semibold">Shift Roster</span>
                        </button>
                    </div>


                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60 flex flex-col h-[320px]">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-slate-900 text-lg tracking-tight">Recent Logs</h3>
                        <button className="text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors">See All System Activity</button>
                    </div>
                    <div className="space-y-2 overflow-y-auto pr-2 no-scrollbar flex-1">
                        {dailySales.slice(0, 3).map(sale => (
                            <div key={sale.id} className="flex items-center gap-4 p-3 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-slate-100">
                                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                                    <span className="material-symbols-outlined text-[18px]">receipt_long</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-slate-900 truncate">Payment Received: ₹{sale.amount?.toLocaleString()}</p>
                                    <p className="text-xs text-slate-500 font-medium truncate">Sale by {sale.doctor_name}</p>
                                </div>
                                <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap">
                                    {new Date(sale.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        ))}

                        {lowStock.slice(0, 3).map(item => (
                            <div key={item.id} className="flex items-center gap-4 p-3 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-slate-100">
                                <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center text-orange-600 shrink-0">
                                    <span className="material-symbols-outlined text-[18px]">priority_high</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-slate-900 truncate">Low Stock Alert</p>
                                    <p className="text-xs text-slate-500 font-medium truncate">{item.item_name} • {item.quantity} units left</p>
                                </div>
                                <span className="text-[10px] font-bold text-orange-400 whitespace-nowrap">ACTION REQUIRED</span>
                            </div>
                        ))}

                        {dailySales.length === 0 && lowStock.length === 0 && (
                            <div className="text-center text-slate-400 py-10 font-medium">No recent activity to show.</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
