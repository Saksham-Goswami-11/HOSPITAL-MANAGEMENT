import { useState, useEffect, useMemo } from 'react'
import { Dialog, DialogContent, DialogTitle, DialogHeader } from '@/components/ui/dialog'
import { Button, Input, Label } from '@/components/ui/basic'
import { Plus, Key, Banknote } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { useHospital } from '@/context/HospitalContext'
import { dataService as db } from '@/lib/dataService'

export function StaffPortal({ clinicIdOverride }: { clinicIdOverride?: string }) {
    const { profile, hospital, clinics, billing } = useHospital()
    const { toast } = useToast()

    // Determine effective clinic ID (useful if super_admin is viewing)
    const effectiveClinicId = clinicIdOverride || profile?.clinic_id;
    const isHospitalAdmin = profile?.role === 'SUPER_ADMIN' || profile?.role === 'HOSPITAL_ADMIN' || profile?.role === 'HOSPITAL_OWNER';

    // Data State
    const [staffList, setStaffList] = useState<any[]>([])
    const [dailyAttendance, setDailyAttendance] = useState<Record<string, any>>({})
    const [isLoading, setIsLoading] = useState(true)

    // Derived State for Daily Snapshot
    const attendanceStats = useMemo(() => {
        const stats = {
            onDuty: staffList.filter(s => dailyAttendance[s.id]?.status === 'PRESENT' && !dailyAttendance[s.id]?.clock_out_time).length,
            completed: staffList.filter(s => dailyAttendance[s.id]?.status === 'PRESENT' && dailyAttendance[s.id]?.clock_out_time).length,
            absent: staffList.filter(s => dailyAttendance[s.id]?.status === 'ABSENT').length,
            pending: staffList.filter(s => !dailyAttendance[s.id]).length,
            total: staffList.length
        };
        return stats;
    }, [staffList, dailyAttendance]);

    const groupedStaff = useMemo(() => {
        return {
            active: staffList.filter(s => dailyAttendance[s.id]?.status === 'PRESENT'),
            absent: staffList.filter(s => dailyAttendance[s.id]?.status === 'ABSENT'),
            pending: staffList.filter(s => !dailyAttendance[s.id])
        };
    }, [staffList, dailyAttendance]);

    // Form State for "Add Staff"
    const [isAddStaffOpen, setIsAddStaffOpen] = useState(false)
    const [newStaff, setNewStaff] = useState({
        full_name: '', phone: '', email: '', role: 'CLINIC_STAFF', base_salary: '', department: '', password: '', joining_date: ''
    })
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Form State for "Edit Staff"
    const [isEditStaffOpen, setIsEditStaffOpen] = useState(false)
    const [editStaffData, setEditStaffData] = useState<any>({
        full_name: '', phone: '', email: '', role: 'CLINIC_STAFF', base_salary: '', department: '', joining_date: ''
    })

    // Form State for "Edit/View Staff"
    const [selectedStaff, setSelectedStaff] = useState<any | null>(null)
    const [isGrantLoginOpen, setIsGrantLoginOpen] = useState(false)
    const [loginEmail, setLoginEmail] = useState('')
    const [loginRole, setLoginRole] = useState('CLINIC_STAFF')

    // Form State for "Payroll"
    const [isPayrollOpen, setIsPayrollOpen] = useState(false)
    const [payrollData, setPayrollData] = useState({ amount: '', notes: '' })
    const [payrollStats, setPayrollStats] = useState({ presentDays: 0, totalHours: 0, isLoading: false })

    // Form State for "Attendance Log"
    const [isAttendanceLogOpen, setIsAttendanceLogOpen] = useState(false)
    const [isAttendanceHubOpen, setIsAttendanceHubOpen] = useState(false)
    const [attendanceHistory, setAttendanceHistory] = useState<any[]>([])
    const [isHistoryLoading, setIsHistoryLoading] = useState(false)

    // UI state
    const [searchQuery, setSearchQuery] = useState('')
    const [departmentFilter, setDepartmentFilter] = useState('All Departments')
    const [selectedClinicFilter, setSelectedClinicFilter] = useState<string>('All Clinics')

    useEffect(() => {
        if (effectiveClinicId) {
            fetchStaff(effectiveClinicId)
        } else if (isHospitalAdmin && hospital?.id) {
            fetchStaff()
        }
    }, [effectiveClinicId, isHospitalAdmin, hospital?.id])

    const fetchStaff = async (cId?: string) => {
        try {
            setIsLoading(true)
            const filters: any = {}
            if (cId) {
                filters.clinic_id = cId
            } else if (hospital?.id) {
                filters.hospital_id = hospital.id
            } else {
                setStaffList([])
                return;
            }

            const data = await db.list('staff_details', {
                filters,
                sort: { column: 'created_at', ascending: false }
            });

            setStaffList(data || [])

            // Fetch today's attendance for those staff
            const today = new Date().toISOString().split('T')[0]
            if (data && data.length > 0) {
                const staffIds = data.map((s: any) => s.id)
                const attData = await db.list('staff_attendance', {
                    filters: {
                        date: today
                    }
                });

                // Filter manually for staffIds since DataService.list might not support 'in' yet or needs complex filters
                // Actually, let's assume we can add 'in' filter to list or just filter the result
                if (attData) {
                    const attMap: Record<string, any> = {}
                    attData.filter((a: any) => staffIds.includes(a.staff_id)).forEach((a: any) => {
                        attMap[a.staff_id] = a
                    })
                    setDailyAttendance(attMap)
                }
            }
        } catch (error) {
            console.error('Error fetching staff:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleAddStaff = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!hospital?.id) return;
        if (!effectiveClinicId && !isHospitalAdmin) return;

        if (billing?.isAtLimit('staff_count')) {
            toast({
                title: 'Limit Reached',
                description: `Your current plan allows a maximum of ${billing.getLimit('staff_count')} staff members. Please upgrade to add more.`,
                variant: 'destructive'
            });
            setIsAddStaffOpen(false);
            return;
        }

        setIsSubmitting(true)
        try {
            await db.create('staff_details', {
                hospital_id: hospital.id,
                clinic_id: effectiveClinicId || null,
                full_name: newStaff.full_name,
                phone: newStaff.phone || null,
                email: newStaff.email || null,
                role: newStaff.role.toUpperCase(),
                department: newStaff.department,
                base_salary: newStaff.base_salary ? parseFloat(newStaff.base_salary) : 0,
                joining_date: newStaff.joining_date || new Date().toISOString().split('T')[0]
            })

            toast({ title: 'Success', description: 'Staff member added successfully.' })
            setIsAddStaffOpen(false)
            setNewStaff({ full_name: '', phone: '', email: '', role: 'CLINIC_STAFF', base_salary: '', department: '', password: '', joining_date: '' })
            fetchStaff(effectiveClinicId)
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' })
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleEditStaff = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedStaff || !hospital?.id) return;

        if (isHospitalAdmin && !window.confirm("WARNING: You are editing this staff record at the hospital-admin level. This is a global change and will permanently alter the staff's credential across all linked clinics. Do you wish to proceed?")) {
            return;
        }

        setIsSubmitting(true)
        try {
            await db.update('staff_details', selectedStaff.id, {
                full_name: editStaffData.full_name,
                phone: editStaffData.phone || null,
                email: editStaffData.email || null,
                role: editStaffData.role.toUpperCase(),
                department: editStaffData.department,
                base_salary: editStaffData.base_salary ? parseFloat(editStaffData.base_salary) : 0,
                joining_date: editStaffData.joining_date || null
            })

            toast({ title: 'Success', description: 'Staff member updated globally.', className: "bg-green-50 text-green-900 border-green-200" })
            setIsEditStaffOpen(false)
            fetchStaff(effectiveClinicId)
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' })
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleGrantLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedStaff || !hospital?.id) return;

        setIsSubmitting(true)
        try {
            // Check if profile with email already exists
            const existingProfiles = await db.list('profiles', {
                filters: { email: loginEmail.toLowerCase() },
                limit: 1
            });
            const existing = existingProfiles && existingProfiles.length > 0 ? existingProfiles[0] : null;

            if (existing) {
                // If profile exists, link it
                await db.update('profiles', existing.id, {
                    hospital_id: hospital?.id,
                    clinic_id: effectiveClinicId || null,
                    role: loginRole,
                    linked_staff_id: selectedStaff.id
                })

                toast({ title: 'Auth Linked', description: 'Existing user account linked to this staff profile.' })
            } else {
                toast({ title: 'Important', description: 'User must sign up with this email first to link accounts automatically.', variant: 'default' })
            }

            // Update staff record
            await db.update('staff_details', selectedStaff.id, { email: loginEmail.toLowerCase() })

            setIsGrantLoginOpen(false)
            fetchStaff(effectiveClinicId)
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' })
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleOpenPayroll = async (staff: any) => {
        setSelectedStaff(staff);
        setIsPayrollOpen(true);
        setPayrollStats({ presentDays: 0, totalHours: 0, isLoading: true });

        try {
            // Get first day of current month
            const date = new Date();
            const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
            const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];

            const data = await db.list('staff_attendance', {
                filters: {
                    staff_id: staff.id
                }
            });

            let present = 0;
            let hours = 0;
            data?.filter((r: any) => r.date >= firstDay && r.date <= lastDay).forEach((r: any) => {
                if (r.status === 'PRESENT') {
                    present++;
                    hours += (r.total_hours || 0);
                }
            });
            setPayrollStats({ presentDays: present, totalHours: hours, isLoading: false })
        } catch (error) {
            setPayrollStats({ presentDays: 0, totalHours: 0, isLoading: false })
        }
    }

    const handleProcessPayroll = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedStaff || !hospital?.id) return;

        setIsSubmitting(true)
        try {
            await db.create('payroll_history', {
                hospital_id: hospital.id,
                clinic_id: effectiveClinicId || null,
                user_id: selectedStaff.user_id || null, // Map payroll to user if available
                amount_paid: parseFloat(payrollData.amount),
                payment_date: new Date().toISOString().split('T')[0],
                status: 'Paid'
            })

            toast({ title: 'Success', description: 'Payroll processed and recorded.', className: "bg-green-50 text-green-900 border-green-200" })
            setIsPayrollOpen(false)
            setPayrollData({ amount: '', notes: '' })
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' })
        } finally {
            setIsSubmitting(false)
        }
    }

    const fetchAttendanceHistory = async (staffId: string) => {
        setIsHistoryLoading(true)
        try {
            const data = await db.list('staff_attendance', {
                filters: { staff_id: staffId },
                sort: { column: 'date', ascending: false },
                limit: 30
            });
            setAttendanceHistory(data || [])
        } catch (error: any) {
            toast({ title: 'Error', description: 'Failed to fetch attendance history.', variant: 'destructive' })
        } finally {
            setIsHistoryLoading(false)
        }
    }

    const activeClinicData = clinics.find(c => c.id === effectiveClinicId)

    if (!effectiveClinicId && !isHospitalAdmin) {
        return <div className="p-8 text-center text-slate-500">Please select a clinic to view staff.</div>
    }

    const filteredStaff = staffList.filter(s => {
        const matchesSearch = s.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) || s.id.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesDept = departmentFilter === 'All Departments' || s.department === departmentFilter;
        const matchesClinic = selectedClinicFilter === 'All Clinics' || s.clinic_id === selectedClinicFilter;
        return matchesSearch && matchesDept && matchesClinic;
    });

    return (
        <div className="space-y-6 animate-in fade-in duration-500 w-full max-w-[1600px] mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Staff Overview</h2>
                    <p className="text-sm text-slate-500">
                        {activeClinicData ? `Manage personnel for ${activeClinicData.name}` : `Manage personnel for all clinics`}
                    </p>
                </div>
                <button
                    onClick={() => setIsAddStaffOpen(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-blue-700 transition-colors shadow-sm">
                    <span className="material-symbols-outlined text-sm">add</span>
                    New Staff Member
                </button>
            </div>

            {/* TOP STATS GRID */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex items-center gap-5">
                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                        <span className="material-symbols-outlined text-2xl">groups</span>
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-500">Total Staff</p>
                        <p className="text-2xl font-bold">{attendanceStats.total}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex items-center gap-5 border-l-4 border-l-green-500">
                    <div className="w-12 h-12 bg-green-50 text-green-600 rounded-lg flex items-center justify-center">
                        <span className="material-symbols-outlined text-2xl">person_check</span>
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-500">Active Duty</p>
                        <p className="text-2xl font-bold">{attendanceStats.onDuty}</p>
                    </div>
                </div>
                <button
                    onClick={() => setIsAttendanceHubOpen(true)}
                    className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4 hover:border-blue-200 hover:shadow-md transition-all text-left w-full group"
                >
                    <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        <span className="material-symbols-outlined text-xl">hub</span>
                    </div>
                    <div className="flex-1">
                        <div className="flex justify-between items-center">
                            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Live Attendance Hub</p>
                            <span className="material-symbols-outlined text-slate-300 text-sm group-hover:text-blue-500 transition-colors">open_in_new</span>
                        </div>
                        <div className="flex gap-3 mt-0.5">
                            <span className="text-xs font-bold text-emerald-600">● {attendanceStats.onDuty} Active</span>
                            <span className="text-xs font-bold text-red-500">● {attendanceStats.absent} Absent</span>
                        </div>
                    </div>
                </button>
            </div>

            {/* Attendance Hub Modal */}
            <Dialog open={isAttendanceHubOpen} onOpenChange={setIsAttendanceHubOpen}>
                <DialogContent className="max-w-4xl p-0 overflow-hidden border-none shadow-2xl bg-slate-50">
                    <DialogHeader className="p-6 bg-white border-b border-slate-100">
                        <DialogTitle className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
                                    <span className="material-symbols-outlined">analytics</span>
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-slate-900 tracking-tight">Today's Workforce Hub</h2>
                                    <p className="text-xs text-slate-500 font-medium">Real-time presence and absence monitoring</p>
                                </div>
                            </div>
                            <div className="text-right pr-8">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Current Status</p>
                                <p className="text-sm font-black text-blue-600">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</p>
                            </div>
                        </DialogTitle>
                    </DialogHeader>

                    <div className="p-6 overflow-y-auto max-h-[80vh]">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Present & Active */}
                            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                                <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-50">
                                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                        Live Workforce
                                    </h3>
                                    <span className="text-[10px] font-black bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full uppercase">
                                        {attendanceStats.onDuty} Active Now
                                    </span>
                                </div>
                                <div className="space-y-3">
                                    {groupedStaff.active.length === 0 ? (
                                        <div className="py-12 flex flex-col items-center justify-center text-slate-400">
                                            <span className="material-symbols-outlined text-4xl mb-2 opacity-20">person_off</span>
                                            <p className="text-xs italic">No staff currently clocked in.</p>
                                        </div>
                                    ) : (
                                        groupedStaff.active.map(s => {
                                            const record = dailyAttendance[s.id];
                                            return (
                                                <div key={s.id} className="flex items-center justify-between p-3 bg-slate-50/50 hover:bg-white hover:border-blue-100 border border-transparent rounded-xl transition-all group/item">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600 shadow-sm">
                                                            {s.full_name?.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-bold text-slate-900 group-hover/item:text-blue-600 transition-colors">{s.full_name}</p>
                                                            <p className="text-[10px] text-slate-500">{s.role.replace('_', ' ')}</p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-[10px] font-bold text-emerald-600">
                                                            IN: {new Date(record.clock_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </p>
                                                        {record.clock_out_time ? (
                                                            <p className="text-[10px] text-slate-400 font-medium">OUT: {new Date(record.clock_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                                        ) : (
                                                            <div className="flex items-center gap-1 justify-end">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                                                                <p className="text-[10px] text-blue-500 font-bold uppercase tracking-tighter">on duty</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>

                            {/* Absent & Pending */}
                            <div className="space-y-6">
                                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                                    <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-50">
                                        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                            <span className="material-symbols-outlined text-lg text-red-500">event_busy</span>
                                            Absence & Records
                                        </h3>
                                        <span className="text-[10px] font-black bg-red-100 text-red-700 px-2 py-0.5 rounded-full uppercase">
                                            {attendanceStats.absent} Absent
                                        </span>
                                    </div>
                                    <div className="space-y-3">
                                        {groupedStaff.absent.length === 0 ? (
                                            <div className="py-6 flex flex-col items-center justify-center text-slate-300">
                                                <span className="material-symbols-outlined text-3xl mb-1 opacity-20">verified_user</span>
                                                <p className="text-[10px] font-bold italic">Full attendance today!</p>
                                            </div>
                                        ) : (
                                            groupedStaff.absent.map(s => (
                                                <div key={s.id} className="flex items-center justify-between p-3 bg-red-50/30 border border-red-100/50 rounded-xl hover:bg-white transition-all">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-[10px] font-bold text-red-600">
                                                            {s.full_name?.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-bold text-slate-900">{s.full_name}</p>
                                                            <p className="text-[10px] text-red-500 font-bold uppercase tracking-tighter">Marked Absent</p>
                                                        </div>
                                                    </div>
                                                    <div className="px-2 py-1 bg-red-100 text-red-700 rounded-md text-[9px] font-black uppercase">
                                                        off
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                                <div className="bg-white/40 border border-slate-200 border-dashed rounded-2xl p-5">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                        Expected / Pending ({groupedStaff.pending.length})
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {groupedStaff.pending.length === 0 ? (
                                            <p className="text-[10px] text-slate-400 italic">No pending actions.</p>
                                        ) : (
                                            groupedStaff.pending.map(s => (
                                                <div key={s.id} className="text-[10px] px-2.5 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg font-bold shadow-sm">
                                                    {s.full_name}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* FILTER BAR */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6 flex flex-wrap gap-4 items-center">
                <div className="flex-1 relative min-w-[300px]">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                    <input
                        className="w-full bg-white border-slate-200 rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-blue-500"
                        placeholder="Search staff by name or ID..."
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-3">
                    {/* Clinic Filter for Admins */}
                    {isHospitalAdmin && clinics.length > 0 && (
                        <div className="relative">
                            <select
                                className="appearance-none bg-white border-slate-200 rounded-lg pl-4 pr-10 py-2 text-sm font-medium focus:ring-blue-500"
                                value={selectedClinicFilter}
                                onChange={(e) => setSelectedClinicFilter(e.target.value)}
                            >
                                <option value="All Clinics">All Clinics</option>
                                {clinics.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                            <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-sm">filter_list</span>
                        </div>
                    )}

                    <div className="relative">
                        <select
                            className="appearance-none bg-white border-slate-200 rounded-lg pl-4 pr-10 py-2 text-sm font-medium focus:ring-blue-500"
                            value={departmentFilter}
                            onChange={(e) => setDepartmentFilter(e.target.value)}
                        >
                            <option>All Departments</option>
                            <option>Medical</option>
                            <option>Nursing</option>
                            <option>Administration</option>
                            <option>Support</option>
                        </select>
                        <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-sm">expand_more</span>
                    </div>
                    <button className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200/50 rounded-lg transition-colors">
                        <span className="material-symbols-outlined text-lg">tune</span>
                        Filters
                    </button>
                </div>
            </div>

            {/* DATA TABLE */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto min-h-[400px]">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Staff Name</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Department / Role</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Base Salary</th>
                                {isHospitalAdmin && <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Joining Date</th>}
                                {isHospitalAdmin && <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={isHospitalAdmin ? 6 : 4} className="py-20 text-center text-slate-400">Loading staff data...</td>
                                </tr>
                            ) : filteredStaff.length === 0 ? (
                                <tr>
                                    <td colSpan={isHospitalAdmin ? 6 : 4} className="py-20 text-center text-slate-400 bg-slate-50/50">
                                        <div className="flex flex-col items-center">
                                            <span className="material-symbols-outlined text-4xl mb-2 opacity-50">person_off</span>
                                            <p>No staff records found.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredStaff.map((staff) => (
                                    <tr key={staff.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full border border-slate-100 bg-blue-50 flex items-center justify-center text-blue-600 font-bold shrink-0">
                                                    {staff.full_name?.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-slate-900">{staff.full_name}</p>
                                                    <p className="text-xs text-slate-500">ID: {staff.id.substring(0, 8).toUpperCase()} • {staff.phone || 'No Phone'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <p className="text-sm font-medium text-slate-900">{staff.department || 'Unassigned'}</p>
                                            <p className="text-xs text-slate-500">{staff.role.replace('_', ' ')}</p>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase ${staff.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                                                {staff.status || 'ACTIVE'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-700">
                                            ₹{staff.base_salary?.toLocaleString() || '0'}
                                        </td>
                                        {isHospitalAdmin && (
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                                                {new Date(staff.joining_date || staff.created_at).toLocaleDateString()}
                                            </td>
                                        )}
                                        {isHospitalAdmin && (
                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                <div className="flex justify-end gap-2 text-slate-400">
                                                    <button
                                                        onClick={() => { setSelectedStaff(staff); setIsAttendanceLogOpen(true); fetchAttendanceHistory(staff.id); }}
                                                        className="p-2 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Attendance History">
                                                        <span className="material-symbols-outlined text-xl">calendar_month</span>
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setSelectedStaff(staff);
                                                            setEditStaffData({
                                                                full_name: staff.full_name || '',
                                                                phone: staff.phone || '',
                                                                email: staff.email || '',
                                                                role: staff.role || 'CLINIC_STAFF',
                                                                base_salary: staff.base_salary || '',
                                                                department: staff.department || '',
                                                                joining_date: staff.joining_date ? staff.joining_date.split('T')[0] : ''
                                                            });
                                                            setIsEditStaffOpen(true);
                                                        }}
                                                        className="p-2 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Edit Staff globally">
                                                        <span className="material-symbols-outlined text-xl">edit_document</span>
                                                    </button>
                                                    <button
                                                        onClick={() => handleOpenPayroll(staff)}
                                                        className="p-2 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Process Payroll">
                                                        <span className="material-symbols-outlined text-xl">payments</span>
                                                    </button>
                                                    <button
                                                        onClick={() => { setSelectedStaff(staff); setIsGrantLoginOpen(true); }}
                                                        className="p-2 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Auth Access">
                                                        <span className="material-symbols-outlined text-xl">key</span>
                                                    </button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination (Visual only for now) */}
                <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/30">
                    <p className="text-sm text-slate-500 font-medium">Showing {filteredStaff.length} of {attendanceStats.total} staff members</p>
                    <div className="flex gap-2">
                        <button className="px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-md hover:bg-white transition-colors disabled:opacity-50" disabled>Previous</button>
                        <button className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 rounded-md">1</button>
                        <button className="px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-md hover:bg-white transition-colors">Next</button>
                    </div>
                </div>
            </div>

            {/* --- MODALS --- */}

            {/* Add Staff Dialog */}
            <Dialog open={isAddStaffOpen} onOpenChange={setIsAddStaffOpen}>
                <DialogContent className="sm:max-w-md bg-white border border-slate-200 shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold flex items-center gap-2"><span className="text-blue-600 p-1 bg-blue-50 rounded"><Plus className="w-5 h-5" /></span> Add New Staff</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleAddStaff} className="space-y-4 pt-4">
                        <div className="space-y-2">
                            <Label>Full Name*</Label>
                            <Input required value={newStaff.full_name} onChange={e => setNewStaff({ ...newStaff, full_name: e.target.value })} placeholder="e.g. Rahul Sharma" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Role*</Label>
                                <select className="flex h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50" value={newStaff.role} onChange={e => setNewStaff({ ...newStaff, role: e.target.value })}>
                                    <option value="CLINIC_ADMIN">Clinic Admin</option>
                                    <option value="CLINIC_STAFF">Regular Staff</option>
                                    <option value="DOCTOR">Doctor</option>
                                    <option value="NURSE">Nurse</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label>Department*</Label>
                                <select className="flex h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50" value={newStaff.department} onChange={e => setNewStaff({ ...newStaff, department: e.target.value })}>
                                    <option value="">Select Dept</option>
                                    <option value="Medical">Medical</option>
                                    <option value="Nursing">Nursing</option>
                                    <option value="Administration">Administration</option>
                                    <option value="Support">Support</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Phone</Label>
                                <Input type="tel" value={newStaff.phone} onChange={e => setNewStaff({ ...newStaff, phone: e.target.value })} placeholder="+91..." />
                            </div>
                            <div className="space-y-2">
                                <Label>Base Salary (M)</Label>
                                <Input type="number" value={newStaff.base_salary} onChange={e => setNewStaff({ ...newStaff, base_salary: e.target.value })} placeholder="₹ amount" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Joining Date</Label>
                            <Input type="date" value={newStaff.joining_date} onChange={e => setNewStaff({ ...newStaff, joining_date: e.target.value })} />
                            <p className="text-xs text-slate-500">Defaults to today if left blank.</p>
                        </div>
                        <div className="flex justify-end pt-4">
                            <Button type="submit" disabled={isSubmitting} className="bg-blue-600 text-white hover:bg-blue-700 w-full shadow-lg">
                                {isSubmitting ? 'Saving...' : 'Create Record'}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Edit Staff Dialog */}
            <Dialog open={isEditStaffOpen} onOpenChange={setIsEditStaffOpen}>
                <DialogContent className="sm:max-w-md bg-amber-50 border border-amber-200 shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold flex items-center gap-2 text-amber-900"><span className="text-amber-600 p-1 bg-amber-100 rounded"><span className="material-symbols-outlined text-sm">edit_document</span></span> Global Edit Staff</DialogTitle>
                    </DialogHeader>
                    {selectedStaff && (
                        <form onSubmit={handleEditStaff} className="space-y-4 pt-4">
                            <p className="text-xs font-semibold text-amber-700 bg-amber-100 p-2 rounded border border-amber-200">
                                ⚠️ Changing details here will update the staff member's record across the entire platform globally.
                            </p>
                            <div className="space-y-2">
                                <Label className="text-amber-900">Full Name*</Label>
                                <Input required className="border-amber-300 bg-white focus:ring-amber-500" value={editStaffData.full_name} onChange={e => setEditStaffData({ ...editStaffData, full_name: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-amber-900">Role*</Label>
                                    <select className="flex h-10 w-full rounded-md border border-amber-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500" value={editStaffData.role} onChange={e => setEditStaffData({ ...editStaffData, role: e.target.value })}>
                                        <option value="CLINIC_ADMIN">Clinic Admin</option>
                                        <option value="CLINIC_STAFF">Regular Staff</option>
                                        <option value="DOCTOR">Doctor</option>
                                        <option value="NURSE">Nurse</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-amber-900">Department*</Label>
                                    <select className="flex h-10 w-full rounded-md border border-amber-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500" value={editStaffData.department} onChange={e => setEditStaffData({ ...editStaffData, department: e.target.value })}>
                                        <option value="">Select Dept</option>
                                        <option value="Medical">Medical</option>
                                        <option value="Nursing">Nursing</option>
                                        <option value="Administration">Administration</option>
                                        <option value="Support">Support</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-amber-900">Phone</Label>
                                    <Input type="tel" className="border-amber-300 bg-white focus:ring-amber-500" value={editStaffData.phone} onChange={e => setEditStaffData({ ...editStaffData, phone: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-amber-900">Base Salary (M)</Label>
                                    <Input type="number" className="border-amber-300 bg-white focus:ring-amber-500" value={editStaffData.base_salary} onChange={e => setEditStaffData({ ...editStaffData, base_salary: e.target.value })} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-amber-900">Joining Date</Label>
                                <Input type="date" className="border-amber-300 bg-white focus:ring-amber-500 text-slate-600" value={editStaffData.joining_date} onChange={e => setEditStaffData({ ...editStaffData, joining_date: e.target.value })} />
                            </div>
                            <div className="flex justify-end pt-4">
                                <Button type="submit" disabled={isSubmitting} className="bg-amber-600 text-white hover:bg-amber-700 w-full shadow-lg">
                                    {isSubmitting ? 'Updating...' : `Confirm Global Update`}
                                </Button>
                            </div>
                        </form>
                    )}
                </DialogContent>
            </Dialog>

            {/* Grant Login Dialog */}
            <Dialog open={isGrantLoginOpen} onOpenChange={setIsGrantLoginOpen}>
                <DialogContent className="sm:max-w-md bg-white border border-slate-200 shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold flex items-center gap-2"><span className="text-emerald-600 p-1 bg-emerald-50 rounded"><Key className="w-5 h-5" /></span> Grant Web/App Login Access</DialogTitle>
                    </DialogHeader>
                    {selectedStaff && (
                        <form onSubmit={handleGrantLogin} className="space-y-4 pt-4">
                            <p className="text-sm text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-100">
                                This will pair the staff profile of <b>{selectedStaff.full_name}</b> with an authentication account.
                                They must sign up with this exact email to gain access.
                            </p>
                            <div className="space-y-2 pt-2">
                                <Label className="text-slate-700 font-semibold">User Login Email</Label>
                                <Input
                                    type="email" required
                                    value={loginEmail}
                                    onChange={e => setLoginEmail(e.target.value)}
                                    placeholder="doctor@hospital.com"
                                    className="border-slate-300"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-slate-700 font-semibold">Access Privilege Role</Label>
                                <select className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-700" value={loginRole} onChange={e => setLoginRole(e.target.value)}>
                                    <option value="CLINIC_STAFF">Staff Member (Limited View)</option>
                                    <option value="CLINIC_ADMIN">Clinic Manager (Full Local Admin)</option>
                                </select>
                            </div>
                            <div className="flex justify-end pt-4">
                                <Button type="submit" disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700 text-white w-full shadow-lg shadow-emerald-500/20">
                                    {isSubmitting ? 'Linking...' : 'Grant Access Privileges'}
                                </Button>
                            </div>
                        </form>
                    )}
                </DialogContent>
            </Dialog>

            {/* Process Payroll Dialog */}
            <Dialog open={isPayrollOpen} onOpenChange={setIsPayrollOpen}>
                <DialogContent className="sm:max-w-md bg-slate-900 text-white border-0 shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold flex items-center gap-2"><span className="text-green-400 p-1 bg-green-400/10 rounded"><Banknote className="w-5 h-5" /></span> Process Payroll</DialogTitle>
                    </DialogHeader>
                    {selectedStaff && (
                        <form onSubmit={handleProcessPayroll} className="space-y-4 pt-4">
                            <div className="p-4 bg-slate-800 rounded-xl mb-4 border border-slate-700">
                                <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1">Paying To</p>
                                <p className="font-bold text-lg">{selectedStaff.full_name}</p>
                                <p className="text-sm text-slate-400 mt-1">Base Salary: <span className="text-slate-300 font-mono">₹{selectedStaff.base_salary?.toLocaleString()}</span></p>
                                {payrollStats.isLoading ? (
                                    <p className="text-xs text-slate-500 mt-2 animate-pulse">Calculating month's attendance...</p>
                                ) : (
                                    <div className="flex gap-4 mt-3 pt-3 border-t border-slate-700/50">
                                        <div>
                                            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Days Present (This Month)</p>
                                            <p className="font-mono text-emerald-400 font-semibold">{payrollStats.presentDays} days</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Total logged (This Month)</p>
                                            <p className="font-mono text-blue-400 font-semibold">{payrollStats.totalHours.toFixed(1)} hrs</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label className="text-slate-300">Payment Amount Released (₹)</Label>
                                <Input
                                    type="number" required
                                    value={payrollData.amount || selectedStaff.base_salary}
                                    onChange={e => setPayrollData({ ...payrollData, amount: e.target.value })}
                                    className="bg-slate-800 border-slate-600 text-white font-mono text-lg"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-slate-300">Payment Notes / Ref</Label>
                                <Input
                                    value={payrollData.notes}
                                    onChange={e => setPayrollData({ ...payrollData, notes: e.target.value })}
                                    placeholder="e.g. October 2023 Salary..."
                                    className="bg-slate-800 border-slate-600 text-white"
                                />
                            </div>
                            <div className="flex justify-end pt-4 gap-3">
                                <Button type="button" variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-700" onClick={() => setIsPayrollOpen(false)}>Cancel</Button>
                                <Button type="submit" disabled={isSubmitting} className="bg-green-600 hover:bg-green-700 text-white flex-1 hover:shadow-lg hover:shadow-green-500/20 transition-all shadow-md">
                                    {isSubmitting ? 'Processing...' : 'Confirm Payment'}
                                </Button>
                            </div>
                        </form>
                    )}
                </DialogContent>
            </Dialog>

            {/* Attendance History Dialog */}
            <Dialog open={isAttendanceLogOpen} onOpenChange={setIsAttendanceLogOpen}>
                <DialogContent className="sm:max-w-xl bg-white border border-slate-200 shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold flex items-center gap-2"><span className="text-indigo-600 p-1 bg-indigo-50 rounded"><span className="material-symbols-outlined text-sm">calendar_month</span></span> Attendance Log</DialogTitle>
                    </DialogHeader>
                    {selectedStaff && (
                        <div className="pt-4 space-y-4">
                            <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <div>
                                    <p className="font-bold text-lg text-slate-900">{selectedStaff.full_name}</p>
                                    <p className="text-sm text-slate-500">{selectedStaff.role?.replace('_', ' ')}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-semibold text-slate-700">Recent 30 Days</p>
                                </div>
                            </div>

                            <div className="max-h-[300px] overflow-y-auto pr-2">
                                {isHistoryLoading ? (
                                    <div className="py-8 text-center text-slate-500">Loading history...</div>
                                ) : attendanceHistory.length === 0 ? (
                                    <div className="py-8 text-center text-slate-500">No attendance records found yet.</div>
                                ) : (
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-50 sticky top-0">
                                            <tr>
                                                <th className="px-4 py-2 font-bold text-slate-500 border-b border-slate-200">Date</th>
                                                <th className="px-4 py-2 font-bold text-slate-500 border-b border-slate-200">Status</th>
                                                <th className="px-4 py-2 font-bold text-slate-500 border-b border-slate-200 text-right">Hours</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {attendanceHistory.map(record => (
                                                <tr key={record.id} className="hover:bg-slate-50">
                                                    <td className="px-4 py-3 font-medium text-slate-900">{new Date(record.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</td>
                                                    <td className="px-4 py-3">
                                                        <span className={`px-2 py-1 rounded text-[10px] font-bold tracking-wider ${record.status === 'PRESENT' ? 'bg-emerald-100 text-emerald-700' :
                                                            record.status === 'ABSENT' ? 'bg-red-100 text-red-700' :
                                                                'bg-slate-100 text-slate-700'
                                                            }`}>
                                                            {record.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-600 font-mono text-right">
                                                        {record.total_hours ? `${record.total_hours}h` : '-'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

        </div>
    )
}
