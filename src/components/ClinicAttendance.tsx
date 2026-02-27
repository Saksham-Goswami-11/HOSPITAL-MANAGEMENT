import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useHospital } from '@/context/HospitalContext'
import { toast } from '@/components/ui/use-toast'

interface ClinicAttendanceProps {
    clinicId: string;
}

export function ClinicAttendance({ clinicId }: ClinicAttendanceProps) {
    const { hospital } = useHospital();
    const [staffList, setStaffList] = useState<any[]>([])
    const [attendanceToday, setAttendanceToday] = useState<Record<string, any>>({})
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchStaffAndAttendance()
    }, [clinicId])

    const fetchStaffAndAttendance = async () => {
        setLoading(true)
        try {
            // 1. Fetch all active staff for this clinic
            const { data: staffData, error: staffError } = await supabase
                .from('staff_details')
                .select('*')
                .eq('clinic_id', clinicId)
                .eq('status', 'Active')

            if (staffError) throw staffError
            setStaffList(staffData || [])

            // 2. Fetch today's attendance records for this clinic
            const today = new Date().toISOString().split('T')[0]
            const { data: attData, error: attError } = await supabase
                .from('staff_attendance')
                .select('*')
                .eq('clinic_id', clinicId)
                .eq('date', today)

            if (attError) throw attError

            // Map records by staff_id for easy lookup
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

    const handlePunchIn = async (staffId: string) => {
        if (!hospital?.id) return;
        const now = new Date().toISOString();
        const today = now.split('T')[0];

        try {
            const { data, error } = await supabase
                .from('staff_attendance')
                .insert({
                    hospital_id: hospital.id,
                    clinic_id: clinicId,
                    staff_id: staffId,
                    date: today,
                    clock_in_time: now,
                    status: 'PRESENT'
                })
                .select()
                .single()

            if (error) throw error;

            toast({ title: "Punched In", description: "Attendance recorded successfully." });
            setAttendanceToday(prev => ({ ...prev, [staffId]: data }));
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" })
        }
    }

    const handlePunchOut = async (attendanceRecord: any) => {
        const now = new Date();
        const clockIn = new Date(attendanceRecord.clock_in_time);

        // Calculate total hours
        const diffMs = now.getTime() - clockIn.getTime();
        const diffHrs = diffMs / (1000 * 60 * 60);

        try {
            const { data, error } = await supabase
                .from('staff_attendance')
                .update({
                    clock_out_time: now.toISOString(),
                    total_hours: parseFloat(diffHrs.toFixed(2))
                })
                .eq('id', attendanceRecord.id)
                .select()
                .single()

            if (error) throw error;

            toast({ title: "Punched Out", description: `Recorded ${diffHrs.toFixed(2)} hours.` });
            setAttendanceToday(prev => ({ ...prev, [attendanceRecord.staff_id]: data }));
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" })
        }
    }

    const handleMarkAbsent = async (staffId: string) => {
        if (!hospital?.id) return;
        const today = new Date().toISOString().split('T')[0];

        try {
            const { data, error } = await supabase
                .from('staff_attendance')
                .insert({
                    hospital_id: hospital.id,
                    clinic_id: clinicId,
                    staff_id: staffId,
                    date: today,
                    status: 'ABSENT',
                    total_hours: 0
                })
                .select()
                .single()

            if (error) throw error;

            toast({ title: "Marked Absent", description: "Staff marked as absent." });
            setAttendanceToday(prev => ({ ...prev, [staffId]: data }));
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" })
        }
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
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 border-y border-slate-200">
                        <tr>
                            <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-wider text-xs">Staff Member</th>
                            <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-wider text-xs">Role</th>
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

                                return (
                                    <tr key={staff.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-slate-900">{staff.full_name}</div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 font-medium">
                                            {staff.role.replace('_', ' ')}
                                        </td>
                                        <td className="px-6 py-4">
                                            {!record && <span className="inline-flex px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600">Pending</span>}
                                            {isPresent && !hasPunchedOut && <span className="inline-flex px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700 animate-pulse">On Duty</span>}
                                            {isPresent && hasPunchedOut && <span className="inline-flex px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700">Completed Shift</span>}
                                            {isAbsent && <span className="inline-flex px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-700">Absent</span>}
                                        </td>
                                        <td className="px-6 py-4 font-mono text-xs text-slate-600">
                                            {record?.clock_in_time ? new Date(record.clock_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                                        </td>
                                        <td className="px-6 py-4 font-mono text-xs text-slate-600">
                                            {record?.clock_out_time ? new Date(record.clock_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                                            {record?.total_hours ? <span className="block text-[10px] text-emerald-600 mt-1 font-sans font-bold">({record.total_hours} hrs)</span> : null}
                                        </td>
                                        <td className="px-6 py-4 text-right space-x-2">
                                            {!record && (
                                                <>
                                                    <button
                                                        onClick={() => handlePunchIn(staff.id)}
                                                        className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition"
                                                    >
                                                        Punch In
                                                    </button>
                                                    <button
                                                        onClick={() => handleMarkAbsent(staff.id)}
                                                        className="px-3 py-1.5 bg-white border border-slate-200 text-red-600 text-xs font-bold rounded-lg hover:bg-red-50 transition"
                                                    >
                                                        Absent
                                                    </button>
                                                </>
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
