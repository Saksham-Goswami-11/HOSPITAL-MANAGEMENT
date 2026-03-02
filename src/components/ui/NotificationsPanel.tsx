import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '@/lib/supabase'
import { useHospital } from '@/context/HospitalContext'
import { X, Stethoscope, AlertTriangle, User, Clock, MapPin, Tablet } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'

interface Notification {
    id: string
    type: 'sale' | 'low_stock' | 'consultation' | 'pharmacy'
    title: string
    message: string
    timestamp: string
    clinicName?: string
    icon: string
    color: string
    data?: any // RAW record data for detail view
}

export function NotificationsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
    const { profile, inventory, clinics } = useHospital()
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [loading, setLoading] = useState(false)
    const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null)

    const role = profile?.role
    const isHospitalLevel = ['HOSPITAL_ADMIN', 'SUPER_ADMIN', 'OWNER'].includes(role || '')

    useEffect(() => {
        if (open) {
            fetchNotifications()
        }
    }, [open])

    const fetchNotifications = async () => {
        setLoading(true)
        const notifs: Notification[] = []
        const today = new Date().toISOString().split('T')[0]

        try {
            // 1. RECENT SALES (today)
            let salesQuery = supabase
                .from('sales')
                .select('*, clinics(name)')
                .gte('timestamp', `${today}T00:00:00`)
                .order('timestamp', { ascending: false })
                .limit(10)

            if (!isHospitalLevel && profile?.clinic_id) {
                salesQuery = salesQuery.eq('clinic_id', profile.clinic_id)
            }

            const { data: salesData } = await salesQuery

            if (salesData) {
                salesData.forEach((sale: any) => {
                    const clinicName = Array.isArray(sale.clinics) ? sale.clinics[0]?.name : sale.clinics?.name
                    const isConsultation = sale.sale_type === 'CONSULTATION'

                    notifs.push({
                        id: `sale-${sale.id}`,
                        type: isConsultation ? 'consultation' : 'pharmacy',
                        title: isConsultation ? 'Consultation Fee Collected' : 'Pharmacy Sale',
                        message: `₹${sale.amount?.toLocaleString()} • ${sale.patient_name} • ${sale.doctor_name}`,
                        timestamp: sale.timestamp,
                        clinicName: isHospitalLevel ? clinicName : undefined,
                        icon: isConsultation ? 'stethoscope' : 'medication',
                        color: isConsultation ? 'blue' : 'emerald',
                        data: sale
                    })
                })
            }

            // 2. LOW STOCK ALERTS
            const clinicInventory = isHospitalLevel
                ? inventory
                : inventory.filter(i => i.clinic_id === profile?.clinic_id)

            const lowStockItems = clinicInventory.filter(i => i.quantity < (i.threshold || 10))

            lowStockItems.forEach((item: any) => {
                const clinic = clinics.find(c => c.id === item.clinic_id)
                notifs.push({
                    id: `stock-${item.id}`,
                    type: 'low_stock',
                    title: 'Low Stock Alert',
                    message: `${item.item_name} — only ${item.quantity} units left`,
                    timestamp: item.updated_at || new Date().toISOString(),
                    clinicName: isHospitalLevel ? clinic?.name : undefined,
                    icon: 'warning',
                    color: 'orange',
                    data: item
                })
            })

        } catch (e) {
            console.error('Error fetching notifications:', e)
        } finally {
            // Sort all by timestamp descending
            notifs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            setNotifications(notifs)
            setLoading(false)
        }
    }

    if (!open) return null

    const getColorClasses = (color: string) => {
        const map: Record<string, { bg: string; text: string; dot: string }> = {
            blue: { bg: 'bg-blue-50', text: 'text-blue-600', dot: 'bg-blue-500' },
            emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', dot: 'bg-emerald-500' },
            orange: { bg: 'bg-orange-50', text: 'text-orange-600', dot: 'bg-orange-500' },
        }
        return map[color] || map.blue
    }

    const timeAgo = (timestamp: string) => {
        const diff = Date.now() - new Date(timestamp).getTime()
        const mins = Math.floor(diff / 60000)
        if (mins < 1) return 'Just now'
        if (mins < 60) return `${mins}m ago`
        const hrs = Math.floor(mins / 60)
        if (hrs < 24) return `${hrs}h ago`
        return new Date(timestamp).toLocaleDateString()
    }

    const panelContent = (
        <div className="fixed inset-0 z-[60]" onClick={onClose}>
            {/* Transparent backdrop */}
            <div className="absolute inset-0" />

            {/* Panel */}
            <div
                className="absolute right-4 top-16 w-96 max-h-[70vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in slide-in-from-top-2 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-slate-700">notifications</span>
                        <h3 className="font-bold text-slate-900">Notifications</h3>
                        {notifications.length > 0 && (
                            <span className="text-[10px] font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                                {notifications.length}
                            </span>
                        )}
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg transition-colors">
                        <X className="w-4 h-4 text-slate-400" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : notifications.length === 0 ? (
                        <div className="text-center py-12 px-4">
                            <span className="material-symbols-outlined text-4xl text-slate-300">notifications_off</span>
                            <p className="text-sm text-slate-400 mt-2 font-medium">No notifications yet today</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-50">
                            {notifications.map((notif) => {
                                const colors = getColorClasses(notif.color)
                                return (
                                    <div
                                        key={notif.id}
                                        className="flex items-start gap-3 p-4 hover:bg-slate-50 transition-colors cursor-pointer group"
                                        onClick={() => setSelectedNotification(notif)}
                                    >
                                        <div className={`w-9 h-9 rounded-xl ${colors.bg} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
                                            <span className={`material-symbols-outlined text-[18px] ${colors.text}`}>{notif.icon}</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-bold text-slate-800 truncate group-hover:text-blue-600 transition-colors">{notif.title}</p>
                                                <span className={`w-1.5 h-1.5 rounded-full ${colors.dot} shrink-0`} />
                                            </div>
                                            <p className="text-xs text-slate-500 mt-0.5 truncate">{notif.message}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[10px] text-slate-400 font-medium">{timeAgo(notif.timestamp)}</span>
                                                {notif.clinicName && (
                                                    <>
                                                        <span className="text-slate-200">•</span>
                                                        <span className="text-[10px] text-slate-400 font-medium truncate">{notif.clinicName}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {notifications.length > 0 && (
                    <div className="p-3 border-t border-slate-100 bg-slate-50">
                        <p className="text-[10px] text-center text-slate-400 font-medium">
                            Showing {isHospitalLevel ? 'all clinics' : 'your clinic'} • Today's activity
                        </p>
                    </div>
                )}
            </div>
        </div>
    )

    const modalContent = (
        <Dialog open={!!selectedNotification} onOpenChange={(open) => !open && setSelectedNotification(null)}>
            <DialogContent className="sm:max-w-md bg-white border border-slate-200 shadow-2xl p-0 overflow-hidden rounded-2xl">
                {selectedNotification && (
                    <div className="animate-in fade-in zoom-in-95 duration-200">
                        <div className={`p-6 ${getColorClasses(selectedNotification.color).bg} border-b border-slate-100 flex items-center gap-4`}>
                            <div className={`w-12 h-12 rounded-2xl bg-white shadow-sm border border-slate-100 flex items-center justify-center text-${selectedNotification.color}-600`}>
                                <span className="material-symbols-outlined text-2xl">{selectedNotification.icon}</span>
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-bold text-slate-900">{selectedNotification.title}</DialogTitle>
                                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">{timeAgo(selectedNotification.timestamp)}</p>
                            </div>
                        </div>

                        <div className="p-6 space-y-6">
                            {selectedNotification.type === 'low_stock' ? (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3 p-4 bg-orange-50 border border-orange-100 rounded-xl">
                                        <AlertTriangle className="w-5 h-5 text-orange-600" />
                                        <p className="text-sm font-medium text-orange-800">Critical Stock Alert</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                            <p className="text-[10px] font-bold text-slate-500 uppercase">Item Name</p>
                                            <p className="text-sm font-bold text-slate-900 mt-1">{selectedNotification.data?.item_name}</p>
                                        </div>
                                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                            <p className="text-[10px] font-bold text-slate-500 uppercase">Batch</p>
                                            <p className="text-sm font-mono text-slate-900 mt-1">{selectedNotification.data?.batch_number}</p>
                                        </div>
                                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                            <p className="text-[10px] font-bold text-slate-500 uppercase">Current Stock</p>
                                            <p className="text-lg font-bold text-orange-600 mt-1">{selectedNotification.data?.quantity}</p>
                                        </div>
                                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                            <p className="text-[10px] font-bold text-slate-500 uppercase">Threshold</p>
                                            <p className="text-lg font-bold text-slate-900 mt-1">{selectedNotification.data?.threshold || 10}</p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
                                        <div className="flex items-center gap-3">
                                            <Tablet className="w-5 h-5 text-emerald-600" />
                                            <p className="text-sm font-medium text-emerald-800">Revenue Generated</p>
                                        </div>
                                        <p className="text-xl font-bold text-emerald-700">₹{selectedNotification.data?.amount?.toLocaleString()}</p>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                            <User className="w-4 h-4 text-slate-400" />
                                            <div>
                                                <p className="text-[10px] font-bold text-slate-500 uppercase">Patient</p>
                                                <p className="text-sm font-bold text-slate-900">{selectedNotification.data?.patient_name}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                            <Stethoscope className="w-4 h-4 text-slate-400" />
                                            <div>
                                                <p className="text-[10px] font-bold text-slate-500 uppercase">Treating Doctor</p>
                                                <p className="text-sm font-bold text-slate-900">{selectedNotification.data?.doctor_name}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                            <Clock className="w-4 h-4 text-slate-400" />
                                            <div>
                                                <p className="text-[10px] font-bold text-slate-500 uppercase">Transaction ID</p>
                                                <p className="text-xs font-mono text-slate-600">{selectedNotification.data?.id}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-100">
                                <MapPin className="w-3.5 h-3.5" />
                                <span>Clinic: {clinics.find(c => c.id === selectedNotification.data?.clinic_id)?.name || 'Main Centre'}</span>
                            </div>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );

    return (
        <>
            {createPortal(panelContent, document.body)}
            {createPortal(modalContent, document.body)}
        </>
    )
}
