import { useState, useEffect } from 'react'
import { Loader2, Clock, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import { dataService as db } from '@/lib/dataService'
import { useHospital } from '@/context/HospitalContext'
import { toast } from '@/components/ui/use-toast'
import { getTodayIST } from '@/lib/utils'

interface ClinicAttendanceProps {
    clinicId: string;
    onNavigate?: (view: string) => void;
}

interface ShiftInfo {
    id: string
    name: string
    start_time: string
    end_time: string
    grace_minutes: number
    late_cutoff_minutes: number
}

export function ClinicAttendance({ clinicId, onNavigate }: ClinicAttendanceProps) {
    const { hospital } = useHospital();
    const [staffList, setStaffList] = useState<any[]>([])
    const [attendanceToday, setAttendanceToday] = useState<Record<string, any>>({})
    const [shiftsMap, setShiftsMap] = useState<Record<string, ShiftInfo>>({})
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchStaffAndAttendance()
    }, [clinicId])

    const fetchStaffAndAttendance = async () => {
        setLoading(true)
        try {
            // 1. Fetch all shifts for this clinic
            const shiftsData = await db.list('clinic_shifts', {
                filters: { clinic_id: clinicId, is_active: true }
            })

            const sMap: Record<string, ShiftInfo> = {}
            shiftsData?.forEach((s: any) => { sMap[s.id] = s })
            setShiftsMap(sMap)

            // 2. Fetch all active staff for this clinic (with shift_id)
            const staffData = await db.list('staff_details', {
                filters: { clinic_id: clinicId, status: 'Active' }
            })
            setStaffList(staffData || [])

            // 3. Fetch today's attendance records
            const today = getTodayIST()
            const attData = await db.list('staff_attendance', {
                filters: { clinic_id: clinicId, date: today }
            })

            const attMap: Record<string, any> = {}
            attData?.forEach(record => {
                attMap[record.staff_id] = record
            })
            setAttendanceToday(attMap)

        } catch (error: any) {
            console.error("Error fetching attendance:", error)
            toast({ title: "Error", description: "Failed to load attendance roster.", variant: "destructive" })
        } finally {
            setLoading(false)
        }
    }

    // Check shift eligibility for a staff member
    const getShiftStatus = (staff: any) => {
        const shift = staff.shift_id ? shiftsMap[staff.shift_id] : null
        if (!shift) return { canPunchIn: true, status: 'no-shift', message: 'No shift assigned', shift: null }

        const now = new Date()
        const [startH, startM] = shift.start_time.split(':').map(Number)
        const [endH, endM] = shift.end_time.split(':').map(Number)

        // Build today's shift start and end as Dates
        const shiftStart = new Date()
        shiftStart.setHours(startH, startM, 0, 0)

        const shiftEnd = new Date()
        shiftEnd.setHours(endH, endM, 0, 0)

        // Detect overnight shifts (end < start, e.g. 22:00 - 06:00) 
        // OR shifts that already ended today and the next occurrence is later
        const isOvernightShift = endH < startH || (endH === startH && endM < startM)

        if (!isOvernightShift && now > shiftEnd) {
            // Shift already completed for today — next run is tomorrow
            const tomorrowStart = new Date(shiftStart.getTime() + 24 * 60 * 60 * 1000)
            const graceStart = new Date(tomorrowStart.getTime() - shift.grace_minutes * 60 * 1000)
            const minsUntil = Math.round((graceStart.getTime() - now.getTime()) / 60000)
            const hoursUntil = Math.floor(minsUntil / 60)
            const remainMins = minsUntil % 60

            return {
                canPunchIn: false,
                status: 'upcoming',
                message: `Next shift at ${formatTime(shift.start_time)} (in ${hoursUntil}h ${remainMins}m)`,
                shift
            }
        }

        // For overnight shifts: if now is after the end time but before the start time,
        // the shift is upcoming tonight
        if (isOvernightShift && now > shiftEnd && now < shiftStart) {
            const graceStart = new Date(shiftStart.getTime() - shift.grace_minutes * 60 * 1000)
            const minsUntil = Math.round((graceStart.getTime() - now.getTime()) / 60000)
            const hoursUntil = Math.floor(minsUntil / 60)
            const remainMins = minsUntil % 60

            return {
                canPunchIn: false,
                status: 'upcoming',
                message: `Shift starts at ${formatTime(shift.start_time)} (in ${hoursUntil}h ${remainMins}m)`,
                shift
            }
        }

        const graceStart = new Date(shiftStart.getTime() - shift.grace_minutes * 60 * 1000)
        const lateCutoff = new Date(shiftStart.getTime() + shift.late_cutoff_minutes * 60 * 1000)

        if (now < graceStart) {
            const minsUntil = Math.round((graceStart.getTime() - now.getTime()) / 60000)
            return {
                canPunchIn: false,
                status: 'too-early',
                message: `Shift starts at ${formatTime(shift.start_time)}. Come back in ${minsUntil} min.`,
                shift
            }
        } else if (now >= graceStart && now <= shiftStart) {
            return { canPunchIn: true, status: 'on-time', message: 'Within punch-in window', shift }
        } else if (now > shiftStart && now <= lateCutoff) {
            const minsLate = Math.round((now.getTime() - shiftStart.getTime()) / 60000)
            return {
                canPunchIn: true,
                status: 'late',
                message: `${minsLate} min late — will be flagged`,
                shift
            }
        } else {
            return {
                canPunchIn: false,
                status: 'blocked',
                message: `Past ${shift.late_cutoff_minutes}min cutoff — punch-in blocked`,
                shift
            }
        }
    }

    const handlePunchIn = async (staffId: string, isLate: boolean) => {
        if (!hospital?.id) return;
        const now = new Date().toISOString();
        const today = getTodayIST();

        try {
            const data = await db.create('staff_attendance', {
                hospital_id: hospital.id,
                clinic_id: clinicId,
                staff_id: staffId,
                date: today,
                clock_in_time: now,
                status: 'PRESENT',
                is_late: isLate
            })

            toast({
                title: isLate ? "Punched In (Late)" : "Punched In",
                description: isLate ? "Attendance recorded. This punch-in has been flagged as late." : "Attendance recorded successfully.",
                variant: isLate ? "destructive" : undefined
            });
            setAttendanceToday(prev => ({ ...prev, [staffId]: data }));
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" })
        }
    }

    const handlePunchOut = async (attendanceRecord: any) => {
        const now = new Date();
        const clockIn = new Date(attendanceRecord.clock_in_time);
        const diffMs = now.getTime() - clockIn.getTime();
        const diffHrs = diffMs / (1000 * 60 * 60);

        try {
            const data = await db.update('staff_attendance', attendanceRecord.id, {
                clock_out_time: now.toISOString(),
                total_hours: parseFloat(diffHrs.toFixed(2))
            })

            toast({ title: "Punched Out", description: `Recorded ${diffHrs.toFixed(2)} hours.` });
            setAttendanceToday(prev => ({ ...prev, [attendanceRecord.staff_id]: data }));
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" })
        }
    }

    const handleMarkAbsent = async (staffId: string) => {
        if (!hospital?.id) return;
        const today = getTodayIST();

        try {
            const data = await db.create('staff_attendance', {
                hospital_id: hospital.id,
                clinic_id: clinicId,
                staff_id: staffId,
                date: today,
                status: 'ABSENT',
                total_hours: 0,
                is_late: false
            })

            toast({ title: "Marked Absent", description: "Staff marked as absent." });
            setAttendanceToday(prev => ({ ...prev, [staffId]: data }));
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" })
        }
    }

    const formatTime = (time: string) => {
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

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                        <span className="material-symbols-outlined text-blue-600">how_to_reg</span>
                        Daily Roster & Attendance
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">Record punches for {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>
                {onNavigate && (
                    <button
                        onClick={() => onNavigate('shift-management')}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-xl hover:bg-blue-100 transition-colors text-sm font-bold"
                    >
                        <Clock className="w-4 h-4" />
                        Manage Shifts
                    </button>
                )}
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 border-y border-slate-200">
                        <tr>
                            <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-wider text-xs">Staff Member</th>
                            <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-wider text-xs">Shift</th>
                            <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-wider text-xs">Status</th>
                            <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-wider text-xs">Clock In</th>
                            <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-wider text-xs">Clock Out</th>
                            <th className="px-6 py-4 text-right font-bold text-slate-500 uppercase tracking-wider text-xs">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {staffList.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                                    No active staff found for this clinic.
                                </td>
                            </tr>
                        ) : (
                            staffList.map(staff => {
                                const record = attendanceToday[staff.id];
                                const isPresent = record?.status === 'PRESENT';
                                const isAbsent = record?.status === 'ABSENT';
                                const hasPunchedOut = !!record?.clock_out_time;
                                const shiftStatus = getShiftStatus(staff);
                                const shift = shiftStatus.shift;

                                return (
                                    <tr key={staff.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-slate-900">{staff.full_name}</div>
                                            <div className="text-xs text-slate-500">{staff.role?.replace('_', ' ')}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {shift ? (
                                                <div>
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-bold">
                                                        <Clock className="w-3 h-3" />
                                                        {shift.name}
                                                    </span>
                                                    <p className="text-[10px] text-slate-400 mt-1 font-mono">
                                                        {formatTime(shift.start_time)} – {formatTime(shift.end_time)}
                                                    </p>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-400 italic">No shift</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            {!record && shiftStatus.status === 'too-early' && (
                                                <div>
                                                    <span className="inline-flex px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600">
                                                        Too Early
                                                    </span>
                                                    <p className="text-[10px] text-slate-400 mt-0.5">{shiftStatus.message}</p>
                                                </div>
                                            )}
                                            {!record && shiftStatus.status === 'upcoming' && (
                                                <div>
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-600">
                                                        <Clock className="w-3 h-3" />
                                                        Upcoming
                                                    </span>
                                                    <p className="text-[10px] text-blue-500 mt-0.5">{shiftStatus.message}</p>
                                                </div>
                                            )}
                                            {!record && shiftStatus.status === 'blocked' && (
                                                <div>
                                                    <span className="inline-flex px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-700">
                                                        Blocked
                                                    </span>
                                                    <p className="text-[10px] text-red-500 mt-0.5">{shiftStatus.message}</p>
                                                </div>
                                            )}
                                            {!record && (shiftStatus.status === 'on-time' || shiftStatus.status === 'no-shift') && (
                                                <span className="inline-flex px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600">Pending</span>
                                            )}
                                            {!record && shiftStatus.status === 'late' && (
                                                <div>
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700">
                                                        <AlertTriangle className="w-3 h-3" />
                                                        Late Window
                                                    </span>
                                                    <p className="text-[10px] text-amber-600 mt-0.5">{shiftStatus.message}</p>
                                                </div>
                                            )}
                                            {isPresent && !hasPunchedOut && (
                                                <div className="flex items-center gap-1.5">
                                                    <span className="inline-flex px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700 animate-pulse">On Duty</span>
                                                    {record?.is_late && (
                                                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase bg-amber-100 text-amber-700">
                                                            <AlertTriangle className="w-2.5 h-2.5" /> Late
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                            {isPresent && hasPunchedOut && (
                                                <div className="flex items-center gap-1.5">
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700">
                                                        <CheckCircle2 className="w-3 h-3" /> Done
                                                    </span>
                                                    {record?.is_late && (
                                                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase bg-amber-100 text-amber-700">
                                                            Late
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                            {isAbsent && (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-700">
                                                    <XCircle className="w-3 h-3" /> Absent
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 font-mono text-xs text-slate-600">
                                            {record?.clock_in_time ? new Date(record.clock_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                                        </td>
                                        <td className="px-6 py-4 font-mono text-xs text-slate-600">
                                            {record?.clock_out_time ? new Date(record.clock_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                                            {record?.total_hours ? <span className="block text-[10px] text-emerald-600 mt-1 font-sans font-bold">({record.total_hours} hrs)</span> : null}
                                        </td>
                                        <td className="px-6 py-4 text-right space-x-2">
                                            {!record && shiftStatus.canPunchIn && (
                                                <>
                                                    <button
                                                        onClick={() => handlePunchIn(staff.id, shiftStatus.status === 'late')}
                                                        className={`px-3 py-1.5 text-white text-xs font-bold rounded-lg transition ${shiftStatus.status === 'late'
                                                            ? 'bg-amber-500 hover:bg-amber-600'
                                                            : 'bg-blue-600 hover:bg-blue-700'
                                                            }`}
                                                    >
                                                        {shiftStatus.status === 'late' ? 'Punch In (Late)' : 'Punch In'}
                                                    </button>
                                                    <button
                                                        onClick={() => handleMarkAbsent(staff.id)}
                                                        className="px-3 py-1.5 bg-white border border-slate-200 text-red-600 text-xs font-bold rounded-lg hover:bg-red-50 transition"
                                                    >
                                                        Absent
                                                    </button>
                                                </>
                                            )}
                                            {!record && !shiftStatus.canPunchIn && shiftStatus.status === 'blocked' && (
                                                <button
                                                    onClick={() => handleMarkAbsent(staff.id)}
                                                    className="px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition"
                                                >
                                                    Mark Absent
                                                </button>
                                            )}
                                            {!record && !shiftStatus.canPunchIn && shiftStatus.status === 'too-early' && (
                                                <span className="text-[10px] font-bold text-slate-400 italic">Not available yet</span>
                                            )}
                                            {!record && !shiftStatus.canPunchIn && shiftStatus.status === 'upcoming' && (
                                                <span className="text-[10px] font-bold text-blue-400 italic">Shift not started</span>
                                            )}
                                            {isPresent && !hasPunchedOut && (
                                                <button
                                                    onClick={() => handlePunchOut(record)}
                                                    className="px-3 py-1.5 bg-slate-800 text-white text-xs font-bold rounded-lg hover:bg-slate-900 transition"
                                                >
                                                    Punch Out
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
