import { useState, useEffect } from 'react'
import { Loader2, Plus, Pencil, Trash2, Clock, Users, AlertTriangle } from 'lucide-react'
import { dataService as db } from '@/lib/dataService'
import { useHospital } from '@/context/HospitalContext'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button, Input, Label } from '@/components/ui/basic'
import { useToast } from '@/components/ui/use-toast'

interface Shift {
    id: string
    clinic_id: string
    hospital_id: string
    name: string
    start_time: string
    end_time: string
    grace_minutes: number
    late_cutoff_minutes: number
    is_active: boolean
    created_at: string
    staff_count?: number
}

interface StaffMember {
    id: string
    full_name: string
    role: string
    shift_id: string | null
    department: string
    clinic_id?: string
    clinics?: any
}

interface ShiftManagementProps {
    clinicId: string
}

export function ShiftManagement({ clinicId }: ShiftManagementProps) {
    const { hospital, clinics: allClinics } = useHospital()
    const { toast } = useToast()

    const [shifts, setShifts] = useState<Shift[]>([])
    const [staffList, setStaffList] = useState<StaffMember[]>([])
    const [loading, setLoading] = useState(true)

    // Form state
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [isEditOpen, setIsEditOpen] = useState(false)
    const [editingShift, setEditingShift] = useState<Shift | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [formData, setFormData] = useState({
        name: '',
        start_time: '09:00',
        end_time: '17:00',
        grace_minutes: 5,
        late_cutoff_minutes: 30
    })

    // Assignment state
    const [isAssignOpen, setIsAssignOpen] = useState(false)
    const [assigningShift, setAssigningShift] = useState<Shift | null>(null)

    useEffect(() => {
        fetchData()
    }, [clinicId])

    const fetchData = async () => {
        setLoading(true)
        try {
            const shiftsFilters: any = {}
            if (clinicId !== 'all') {
                shiftsFilters.clinic_id = clinicId
            } else if (hospital?.id) {
                shiftsFilters.hospital_id = hospital.id
            }

            const shiftsData = await db.list('clinic_shifts', {
                filters: shiftsFilters,
                sort: { column: 'start_time', ascending: true }
            })

            const staffFilters: any = { status: 'Active' }
            if (clinicId !== 'all') {
                staffFilters.clinic_id = clinicId
            } else if (hospital?.id) {
                staffFilters.hospital_id = hospital.id
            }

            const staffRawData = await db.list('staff_details', {
                filters: staffFilters
            })

            // Manually map clinic names since we don't have joins in DataService.list
            const staffData = staffRawData.map((s: any) => ({
                ...s,
                clinics: allClinics.find(c => c.id === s.clinic_id)
            }))

            // Count staff per shift
            const enrichedShifts = (shiftsData || []).map((shift: any) => ({
                ...shift,
                staff_count: (staffData || []).filter((s: any) => s.shift_id === shift.id).length
            }))

            setShifts(enrichedShifts)
            setStaffList(staffData || [])
        } catch (error: any) {
            console.error('Error fetching shifts:', error)
            toast({ title: 'Error', description: 'Failed to load shift data.', variant: 'destructive' })
        } finally {
            setLoading(false)
        }
    }

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!hospital?.id) return
        setIsSubmitting(true)

        try {
            await db.create('clinic_shifts', {
                clinic_id: clinicId,
                hospital_id: hospital.id,
                name: formData.name,
                start_time: formData.start_time,
                end_time: formData.end_time,
                grace_minutes: formData.grace_minutes,
                late_cutoff_minutes: formData.late_cutoff_minutes
            })

            toast({ title: 'Shift Created', description: `"${formData.name}" has been added.` })
            setIsCreateOpen(false)
            resetForm()
            fetchData()
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' })
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleEdit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!editingShift) return
        setIsSubmitting(true)

        try {
            await db.update('clinic_shifts', editingShift.id, {
                name: formData.name,
                start_time: formData.start_time,
                end_time: formData.end_time,
                grace_minutes: formData.grace_minutes,
                late_cutoff_minutes: formData.late_cutoff_minutes
            })

            toast({ title: 'Shift Updated', description: `"${formData.name}" has been updated.` })
            setIsEditOpen(false)
            setEditingShift(null)
            resetForm()
            fetchData()
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' })
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleDelete = async (shift: Shift) => {
        if (!confirm(`Delete "${shift.name}"? Staff assigned to this shift will be unassigned.`)) return

        try {
            await db.remove('clinic_shifts', shift.id)
            toast({ title: 'Shift Deleted', description: `"${shift.name}" has been removed.` })
            fetchData()
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' })
        }
    }

    const handleAssignStaff = async (staffId: string, shiftId: string | null) => {
        try {
            await db.update('staff_details', staffId, { shift_id: shiftId })
            toast({ title: 'Updated', description: 'Staff shift assignment updated.' })
            fetchData()
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' })
        }
    }

    const openEdit = (shift: Shift) => {
        setEditingShift(shift)
        setFormData({
            name: shift.name,
            start_time: shift.start_time.slice(0, 5),
            end_time: shift.end_time.slice(0, 5),
            grace_minutes: shift.grace_minutes,
            late_cutoff_minutes: shift.late_cutoff_minutes
        })
        setIsEditOpen(true)
    }

    const openAssign = (shift: Shift) => {
        setAssigningShift(shift)
        setIsAssignOpen(true)
    }

    const resetForm = () => {
        setFormData({ name: '', start_time: '09:00', end_time: '17:00', grace_minutes: 5, late_cutoff_minutes: 30 })
    }

    const formatTime = (time: string) => {
        if (!time) return '--:--'
        const [h, m] = time.split(':')
        const hour = parseInt(h)
        const ampm = hour >= 12 ? 'PM' : 'AM'
        const h12 = hour % 12 || 12
        return `${h12}:${m} ${ampm}`
    }

    if (loading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        )
    }

    const unassignedStaff = staffList.filter(s => !s.shift_id)

    const renderShiftForm = (onSubmit: (e: React.FormEvent) => void, title: string) => (
        <form onSubmit={onSubmit} className="space-y-5 pt-2">
            <div className="space-y-2">
                <Label className="text-slate-700 font-medium">Shift Name</Label>
                <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    placeholder="e.g. Morning Shift"
                    className="h-11"
                />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label className="text-slate-700 font-medium">Start Time</Label>
                    <Input
                        type="time"
                        value={formData.start_time}
                        onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                        required
                        className="h-11"
                    />
                </div>
                <div className="space-y-2">
                    <Label className="text-slate-700 font-medium">End Time</Label>
                    <Input
                        type="time"
                        value={formData.end_time}
                        onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                        required
                        className="h-11"
                    />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label className="text-slate-700 font-medium">Early Grace (min)</Label>
                    <Input
                        type="number"
                        min={0}
                        max={60}
                        value={formData.grace_minutes}
                        onChange={(e) => setFormData({ ...formData, grace_minutes: parseInt(e.target.value) || 0 })}
                        className="h-11"
                    />
                    <p className="text-[10px] text-slate-400">How early staff can punch in before shift start</p>
                </div>
                <div className="space-y-2">
                    <Label className="text-slate-700 font-medium">Late Cutoff (min)</Label>
                    <Input
                        type="number"
                        min={1}
                        max={120}
                        value={formData.late_cutoff_minutes}
                        onChange={(e) => setFormData({ ...formData, late_cutoff_minutes: parseInt(e.target.value) || 30 })}
                        className="h-11"
                    />
                    <p className="text-[10px] text-slate-400">After this, punch-in is blocked (auto-absent)</p>
                </div>
            </div>

            {/* Preview */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Shift Preview</p>
                <div className="flex items-center gap-3 text-sm text-slate-700">
                    <Clock className="w-4 h-4 text-blue-600" />
                    <span className="font-bold">{formData.start_time ? formatTime(formData.start_time) : '--'}</span>
                    <span className="text-slate-300">→</span>
                    <span className="font-bold">{formData.end_time ? formatTime(formData.end_time) : '--'}</span>
                </div>
                <p className="text-xs text-slate-500">
                    Punch-in window: <span className="font-bold text-emerald-600">{formData.grace_minutes}min early</span> to
                    <span className="font-bold text-orange-600"> {formData.late_cutoff_minutes}min late</span> (then blocked)
                </p>
            </div>

            <Button type="submit" disabled={isSubmitting} className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-bold">
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {title}
            </Button>
        </form>
    )

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* HEADER */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-200/60 pb-8">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-200">
                            <span className="material-symbols-outlined text-[20px]">schedule</span>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Shift Operations</h2>
                            <p className="text-sm text-slate-500 font-medium">Manage staff schedules and attendance windows</p>
                        </div>
                    </div>
                </div>

                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogTrigger asChild>
                        <Button
                            onClick={() => { resetForm(); setIsCreateOpen(true) }}
                            className="bg-blue-600 hover:bg-blue-700 text-white gap-2 h-10"
                        >
                            <Plus className="w-4 h-4" /> New Shift
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[450px] bg-white border-slate-200">
                        <DialogHeader>
                            <DialogTitle className="text-xl font-bold text-slate-900">Create Shift Template</DialogTitle>
                        </DialogHeader>
                        {renderShiftForm(handleCreate, "Create Shift")}
                    </DialogContent>
                </Dialog>
            </div>

            {/* SHIFT CARDS */}
            {shifts.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200">
                    <Clock className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-slate-900">No Shifts Created</h3>
                    <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
                        Create your first shift template to start managing staff schedules and enforcing attendance windows.
                    </p>
                    <Button
                        onClick={() => { resetForm(); setIsCreateOpen(true) }}
                        className="mt-6 bg-blue-600 hover:bg-blue-700 text-white gap-2"
                    >
                        <Plus className="w-4 h-4" /> Create First Shift
                    </Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {shifts.map(shift => (
                        <div
                            key={shift.id}
                            className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-all group"
                        >
                            {/* Card Header */}
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                        <Clock className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-900">{shift.name}</h4>
                                        <p className="text-xs text-slate-500">
                                            {formatTime(shift.start_time)} — {formatTime(shift.end_time)}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => openEdit(shift)}
                                        className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                                        title="Edit shift"
                                    >
                                        <Pencil className="w-3.5 h-3.5 text-slate-400" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(shift)}
                                        className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Delete shift"
                                    >
                                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                    </button>
                                </div>
                            </div>

                            {/* Time Window */}
                            <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl mb-3">
                                <div className="flex-1 text-center">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Grace</p>
                                    <p className="text-sm font-bold text-emerald-600">{shift.grace_minutes}m early</p>
                                </div>
                                <div className="w-px h-8 bg-slate-200" />
                                <div className="flex-1 text-center">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Late Cutoff</p>
                                    <p className="text-sm font-bold text-orange-600">{shift.late_cutoff_minutes}m</p>
                                </div>
                            </div>

                            {/* Assigned Staff Count */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                    <Users className="w-3.5 h-3.5" />
                                    <span className="font-bold">{shift.staff_count || 0}</span> staff assigned
                                </div>
                                <button
                                    onClick={() => openAssign(shift)}
                                    className="text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors"
                                >
                                    Manage →
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* UNASSIGNED STAFF WARNING */}
            {unassignedStaff.length > 0 && shifts.length > 0 && (
                <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-bold text-amber-800">
                            {unassignedStaff.length} staff member{unassignedStaff.length > 1 ? 's' : ''} without a shift
                        </p>
                        <p className="text-xs text-amber-600 mt-0.5">
                            {unassignedStaff.map(s => s.full_name).join(', ')} — punch-in will work without time restrictions
                        </p>
                    </div>
                </div>
            )}

            {/* STAFF ASSIGNMENT TABLE */}
            {shifts.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                        <h3 className="font-bold text-slate-900 flex items-center gap-2">
                            <Users className="w-4 h-4 text-blue-600" />
                            Staff Assignments
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">Assign each staff member to a shift for attendance enforcement</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="px-5 py-3 font-bold text-slate-500 uppercase tracking-wider text-xs">Staff</th>
                                    <th className="px-5 py-3 font-bold text-slate-500 uppercase tracking-wider text-xs">Role</th>
                                    <th className="px-5 py-3 font-bold text-slate-500 uppercase tracking-wider text-xs">Department</th>
                                    {clinicId === 'all' && <th className="px-5 py-3 font-bold text-slate-500 uppercase tracking-wider text-xs">Clinic</th>}
                                    <th className="px-5 py-3 font-bold text-slate-500 uppercase tracking-wider text-xs">Assigned Shift</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {staffList.map(staff => (
                                    <tr key={staff.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                                                    {staff.full_name[0]}
                                                </div>
                                                <span className="font-bold text-slate-900">{staff.full_name}</span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3.5 text-slate-600 font-medium text-xs">{staff.role?.replace('_', ' ')}</td>
                                        <td className="px-5 py-3.5 text-slate-500 text-xs">{staff.department || '—'}</td>
                                        {clinicId === 'all' && (
                                            <td className="px-5 py-3.5 text-slate-500 text-xs font-medium">
                                                {staff.clinics?.name || 'N/A'}
                                            </td>
                                        )}
                                        <td className="px-5 py-3.5">
                                            <select
                                                value={staff.shift_id || ''}
                                                onChange={(e) => handleAssignStaff(staff.id, e.target.value || null)}
                                                className="h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer min-w-[180px]"
                                            >
                                                <option value="">No shift assigned</option>
                                                {shifts.map(shift => (
                                                    <option key={shift.id} value={shift.id}>
                                                        {shift.name} ({formatTime(shift.start_time)} - {formatTime(shift.end_time)})
                                                    </option>
                                                ))}
                                            </select>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* EDIT SHIFT DIALOG */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="sm:max-w-[450px] bg-white border-slate-200">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold text-slate-900">Edit Shift</DialogTitle>
                    </DialogHeader>
                    {renderShiftForm(handleEdit, "Save Changes")}
                </DialogContent>
            </Dialog>

            {/* ASSIGN STAFF DIALOG */}
            <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
                <DialogContent className="sm:max-w-[450px] bg-white border-slate-200">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold text-slate-900">
                            Assign Staff to "{assigningShift?.name}"
                        </DialogTitle>
                    </DialogHeader>
                    <div className="max-h-[400px] overflow-y-auto space-y-2 py-2">
                        {staffList.map(staff => {
                            const isAssigned = staff.shift_id === assigningShift?.id
                            return (
                                <div
                                    key={staff.id}
                                    className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${isAssigned
                                        ? 'bg-blue-50 border-blue-200'
                                        : 'bg-white border-slate-100 hover:border-blue-200'
                                        }`}
                                    onClick={() => handleAssignStaff(staff.id, isAssigned ? null : assigningShift?.id || null)}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${isAssigned ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                                            }`}>
                                            {staff.full_name[0]}
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm text-slate-900">{staff.full_name}</p>
                                            <p className="text-[10px] text-slate-500">{staff.role?.replace('_', ' ')}</p>
                                        </div>
                                    </div>
                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${isAssigned ? 'border-blue-600 bg-blue-600' : 'border-slate-300'
                                        }`}>
                                        {isAssigned && (
                                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                            </svg>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
