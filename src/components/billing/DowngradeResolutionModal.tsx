import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useHospital } from '@/context/HospitalContext'
import { useToast } from '@/components/ui/use-toast'
import { authService } from '@/lib/authService'

interface DowngradeResolutionModalProps {
    isOpen: boolean;
}

export function DowngradeResolutionModal({ isOpen }: DowngradeResolutionModalProps) {
    const { activeClinics, billing, updateClinicProfile, profile } = useHospital()
    const { toast } = useToast()
    const [selectedToPause, setSelectedToPause] = useState<string[]>([])
    const [isSaving, setIsSaving] = useState(false)

    // Reset selection when modal opens or clinics change
    useEffect(() => {
        setSelectedToPause([])
    }, [isOpen])

    if (!isOpen) return null

    const limit = billing.getLimit('clinics_count')
    const activeCount = activeClinics.length
    const excessCount = activeCount - limit

    if (excessCount <= 0) return null

    const handleTogglePause = (clinicId: string) => {
        setSelectedToPause(prev =>
            prev.includes(clinicId)
                ? prev.filter(id => id !== clinicId)
                : [...prev, clinicId]
        )
    }

    const handleConfirm = async () => {
        if (selectedToPause.length !== excessCount) {
            toast({
                title: "Selection Incomplete",
                description: `Please select exactly ${excessCount} clinic(s) to pause.`,
                variant: "destructive"
            })
            return
        }

        setIsSaving(true)
        try {
            // Calculate deletion date (30 days from now)
            const thirtyDaysFromNow = new Date()
            thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

            // Update all selected clinics
            const updatePromises = selectedToPause.map(id =>
                updateClinicProfile(id, {
                    status: 'paused',
                    scheduled_deletion_date: thirtyDaysFromNow.toISOString()
                })
            )

            await Promise.all(updatePromises)

            toast({
                title: "Clinics Paused",
                description: "The selected clinics have been paused and will be deleted in 30 days."
            })
        } catch (error: any) {
            console.error("Error pausing clinics:", error)
            toast({
                title: "Error",
                description: "Failed to pause clinics. Please try again or contact support.",
                variant: "destructive"
            })
        } finally {
            setIsSaving(false)
        }
    }

    // If the user is not an admin, they can't resolve this. Show a blocked screen.
    if (profile?.role !== 'ADMIN' && profile?.role !== 'HOSPITAL_ADMIN') {
        return (
            <AnimatePresence>
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 text-center"
                    >
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <span className="material-symbols-outlined text-3xl text-red-600">block</span>
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900 mb-2">Hospital Usage Limit Reached</h2>
                        <p className="text-slate-600 mb-8">
                            This hospital has exceeded the limits of its current subscription plan.
                            Please contact your hospital administrator to resolve this issue.
                        </p>
                        <button
                            onClick={() => authService.signOut()}
                            className="w-full bg-slate-100 text-slate-700 font-medium py-3 rounded-xl hover:bg-slate-200 transition-colors"
                        >
                            Sign Out
                        </button>
                    </motion.div>
                </div>
            </AnimatePresence>
        )
    }

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 overflow-y-auto">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8 overflow-hidden flex flex-col max-h-[90vh]"
                >
                    <div className="bg-red-50 p-6 border-b border-red-100 shrink-0">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined text-red-600">warning</span>
                            </div>
                            <h2 className="text-xl font-bold text-red-900">Subscription Downgrade Requires Action</h2>
                        </div>
                        <p className="text-red-800 text-sm ml-13">
                            You currently have <strong className="font-bold">{activeCount}</strong> active clinics, but your current plan only supports <strong className="font-bold">{limit}</strong>.
                            To continue using the application, you must select <strong className="font-bold">{excessCount}</strong> clinic(s) to pause.
                        </p>

                        <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-xl flex gap-3">
                            <span className="material-symbols-outlined text-orange-600 shrink-0">info</span>
                            <div className="text-sm text-orange-800">
                                <span className="font-semibold block mb-1">Important Data Deletion Notice</span>
                                Paused clinics will be completely inaccessible and their data will be <strong>permanently deleted after 30 days</strong>.
                                <br />You can prevent this deletion by upgrading your plan and unpausing the clinics before the 30-day period ends.
                            </div>
                        </div>
                    </div>

                    <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-semibold text-slate-900">Select clinics to pause</h3>
                            <span className={`text-sm font-medium px-2.5 py-1 rounded-full ${selectedToPause.length === excessCount
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-slate-200 text-slate-700'
                                }`}>
                                Selected: {selectedToPause.length} / {excessCount}
                            </span>
                        </div>

                        <div className="space-y-3">
                            {activeClinics.map(clinic => (
                                <label
                                    key={clinic.id}
                                    className={`
                                        flex items-center p-4 rounded-xl border-2 cursor-pointer transition-all
                                        ${selectedToPause.includes(clinic.id)
                                            ? 'border-red-500 bg-red-50/50'
                                            : 'border-slate-200 bg-white hover:border-slate-300'
                                        }
                                        ${selectedToPause.length >= excessCount && !selectedToPause.includes(clinic.id)
                                            ? 'opacity-50 cursor-not-allowed'
                                            : ''
                                        }
                                    `}
                                >
                                    <div className="flex-1">
                                        <div className="font-semibold text-slate-900">{clinic.name}</div>
                                        {clinic.address && <div className="text-sm text-slate-500">{clinic.address}</div>}
                                    </div>
                                    <div className={`w-6 h-6 rounded-md border flex items-center justify-center transition-colors ${selectedToPause.includes(clinic.id)
                                        ? 'bg-red-500 border-red-500 text-white'
                                        : 'border-slate-300 bg-white'
                                        }`}>
                                        {selectedToPause.includes(clinic.id) && (
                                            <span className="material-symbols-outlined text-[16px]">check</span>
                                        )}
                                    </div>
                                    <input
                                        type="checkbox"
                                        className="hidden"
                                        checked={selectedToPause.includes(clinic.id)}
                                        disabled={selectedToPause.length >= excessCount && !selectedToPause.includes(clinic.id)}
                                        onChange={() => handleTogglePause(clinic.id)}
                                    />
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="p-6 border-t border-slate-200 bg-white shrink-0 flex gap-4">
                        <button
                            onClick={() => authService.signOut()}
                            className="px-6 py-2.5 rounded-xl font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                        >
                            Sign Out Instead
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={selectedToPause.length !== excessCount || isSaving}
                            className={`flex-1 py-2.5 rounded-xl font-medium text-white transition-all shadow-sm flex items-center justify-center gap-2
                                ${selectedToPause.length === excessCount && !isSaving
                                    ? 'bg-red-600 hover:bg-red-700 hover:shadow-md'
                                    : 'bg-slate-300 cursor-not-allowed'
                                }
                            `}
                        >
                            {isSaving ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Pausing Clinics...
                                </>
                            ) : (
                                `Pause Selected Clinics (${selectedToPause.length}/${excessCount})`
                            )}
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    )
}
