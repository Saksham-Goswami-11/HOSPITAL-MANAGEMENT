import { useState } from 'react'
import { Building2, ArrowRight, Clock, Users, ChevronRight } from 'lucide-react'
import { useHospital } from '@/context/HospitalContext'
import { ShiftManagement } from './ShiftManagement'
import { Button } from '@/components/ui/basic'

export function HospitalShiftManagement() {
    const { clinics } = useHospital()
    const [selectedClinicId, setSelectedClinicId] = useState<string | null>(null)

    if (selectedClinicId) {
        return (
            <div className="space-y-4">
                <Button
                    variant="ghost"
                    onClick={() => setSelectedClinicId(null)}
                    className="flex items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors mb-2"
                >
                    <ChevronRight className="w-4 h-4 rotate-180" />
                    Back to Clinic Selection
                </Button>
                <ShiftManagement clinicId={selectedClinicId} />
            </div>
        )
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* HEADER */}
            <div>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
                    <div className="w-2 h-8 bg-blue-600 rounded-full" />
                    Hospital Shift Management
                </h2>
                <p className="text-sm text-slate-500 mt-1">Select a clinic to manage its staff shifts and attendance windows</p>
            </div>

            {/* CLINIC SELECTION GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* GLOBAL VIEW CARD */}
                <div
                    onClick={() => setSelectedClinicId('all')}
                    className="group bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 hover:shadow-xl transition-all cursor-pointer relative overflow-hidden text-white"
                >
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Users className="w-24 h-24" />
                    </div>

                    <div className="relative z-10">
                        <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-white mb-4 group-hover:bg-white group-hover:text-blue-600 transition-colors">
                            <Users className="w-6 h-6" />
                        </div>

                        <h3 className="text-xl font-bold mb-1">View All Staff Shifts</h3>
                        <p className="text-xs text-white/70 mb-6">Aggregate view of all clinics and staff across the hospital</p>

                        <div className="flex items-center justify-between pt-4 border-t border-white/10">
                            <div className="flex items-center gap-1.5 text-xs text-white/80 font-medium">
                                <Building2 className="w-3.5 h-3.5" />
                                <span>{clinics.length} Clinics managed</span>
                            </div>
                            <div className="text-white flex items-center gap-1 text-sm font-bold group-hover:translate-x-1 transition-transform">
                                View Global <ArrowRight className="w-4 h-4" />
                            </div>
                        </div>
                    </div>
                </div>

                {clinics.map((clinic) => (
                    <div
                        key={clinic.id}
                        onClick={() => setSelectedClinicId(clinic.id)}
                        className="group bg-white rounded-2xl border border-slate-200 p-6 hover:border-blue-300 hover:shadow-lg transition-all cursor-pointer relative overflow-hidden"
                    >
                        {/* Decorative Background */}
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Building2 className="w-24 h-24" />
                        </div>

                        <div className="relative z-10">
                            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 mb-4 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                <Building2 className="w-6 h-6" />
                            </div>

                            <h3 className="text-lg font-bold text-slate-900 mb-1">{clinic.name}</h3>
                            <p className="text-xs text-slate-500 mb-6 line-clamp-1">{clinic.address || 'No address provided'}</p>

                            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                        <Clock className="w-3.5 h-3.5" />
                                        <span>Manage Shifts</span>
                                    </div>
                                </div>
                                <div className="text-blue-600 flex items-center gap-1 text-sm font-bold group-hover:translate-x-1 transition-transform">
                                    Open <ArrowRight className="w-4 h-4" />
                                </div>
                            </div>
                        </div>
                    </div>
                ))}

                {clinics.length === 0 && (
                    <div className="col-span-full py-20 text-center bg-white rounded-2xl border border-dashed border-slate-200">
                        <Building2 className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-slate-900">No Clinics Found</h3>
                        <p className="text-sm text-slate-500 mt-1">You need to add clinics before managing shifts.</p>
                    </div>
                )}
            </div>
        </div>
    )
}
