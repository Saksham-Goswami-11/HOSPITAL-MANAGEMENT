import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/basic'
import { Button, Input, Label } from '@/components/ui/basic'
import { Building2, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ui/use-toast'

export function AdminSetup({ userProfile, onComplete }: { userProfile: any, onComplete: () => void }) {
    const { toast } = useToast()
    const [loading, setLoading] = useState(false)
    // If user has no hospital_id, start at 'hospital' step, otherwise 'clinic'
    const [step, setStep] = useState<'hospital' | 'clinic'>(userProfile?.hospital_id ? 'clinic' : 'hospital')
    const [localHospitalId, setLocalHospitalId] = useState<string | null>(userProfile?.hospital_id || null)

    async function handleHospitalSetup(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setLoading(true)
        const formData = new FormData(e.currentTarget)
        const name = formData.get('name') as string
        const slug = formData.get('slug') as string
        const color = formData.get('branding_color') as string

        try {
            // 1. Create Hospital
            const { data: hospital, error: hospError } = await supabase
                .from('hospitals')
                .insert({
                    name,
                    slug,
                    branding_color: color,
                    owner_id: userProfile.id
                })
                .select()
                .single()

            if (hospError) throw hospError

            // 2. Link to Profile
            const { error: profileError } = await supabase
                .from('profiles')
                .update({ hospital_id: hospital.id })
                .eq('id', userProfile.id)

            if (profileError) throw profileError

            // 3. Update State & Move Next
            userProfile.hospital_id = hospital.id
            setLocalHospitalId(hospital.id)
            setStep('clinic')
            toast({ title: 'Hospital Created', description: 'Now let\'s set up your first clinic.' })

            // Force refresh to clear SETUP mode from parent
            window.location.reload()

        } catch (err: any) {
            console.error(err)
            toast({ title: 'Error', description: err.message, variant: 'destructive' })
        } finally {
            setLoading(false)
        }
    }

    async function handleFirstClinic(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        if (!localHospitalId) {
            toast({ title: 'Error', description: 'Hospital ID missing. Please refresh.', variant: 'destructive' })
            return
        }

        setLoading(true)
        const formData = new FormData(e.currentTarget)
        const clinicName = formData.get('clinic_name') as string
        const location = formData.get('location') as string

        try {
            // Create Clinic
            const { error } = await supabase.from('clinics').insert({
                name: clinicName,
                location: location,
                hospital_id: localHospitalId
            })

            if (error) throw error

            toast({ title: 'Success', description: 'Headquarters registered successfully.' })
            // Trigger completion callback
            onComplete()

        } catch (err: any) {
            console.error(err)
            toast({ title: 'Error', description: err.message, variant: 'destructive' })
        } finally {
            setLoading(false)
        }
    }

    // --- RENDER HOSPITAL FORM ---
    if (step === 'hospital') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
                <Card className="w-full max-w-lg glass-card shadow-xl border-blue-100">
                    <CardHeader className="text-center pb-8 border-b border-slate-100/50">
                        <div className="mx-auto w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                            <Building2 className="w-8 h-8 text-blue-600" />
                        </div>
                        <CardTitle className="text-2xl font-bold text-slate-900">Setup Organization</CardTitle>
                        <CardDescription className="text-lg mt-2">
                            Register your Hospital / Medical Center
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-8">
                        <form onSubmit={handleHospitalSetup} className="space-y-6">
                            <div className="space-y-2">
                                <Label>Hospital Entity Name</Label>
                                <Input name="name" placeholder="e.g. City General Hospital" required className="h-12 text-lg" />
                            </div>
                            <div className="space-y-2">
                                <Label>Unique Slug (ID)</Label>
                                <Input name="slug" placeholder="e.g. city-general-ny" required className="h-12 text-lg font-mono" />
                                <p className="text-xs text-slate-400">Used for URL identification. Must be unique.</p>
                            </div>
                            <div className="space-y-2">
                                <Label>Branding Color</Label>
                                <div className="flex gap-2">
                                    <Input name="branding_color" type="color" defaultValue="#2563eb" className="w-20 h-12 p-1 cursor-pointer" />
                                    <div className="flex-1 flex items-center text-sm text-slate-500 italic px-2">
                                        Choose your primary brand color
                                    </div>
                                </div>
                            </div>
                            <Button type="submit" disabled={loading} className="w-full h-12 text-lg font-medium bg-blue-600 hover:bg-blue-700">
                                {loading ? <Loader2 className="animate-spin" /> : (
                                    <span className="flex items-center gap-2">
                                        Create Organization <ArrowRight className="w-5 h-5" />
                                    </span>
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* TROUBLESHOOTING: Self-Correction for Misclassified Users */}
                <div className="mt-8 text-center">
                    <p className="text-slate-500 text-sm mb-2">Not a Hospital Owner?</p>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-slate-400 hover:text-blue-600"
                        onClick={async () => {
                            if (confirm("Are you a Clinic Admin/Staff erroneously sent here? This will switch your role to CLINIC_ADMIN.")) {
                                const { error } = await supabase.from('profiles').update({ role: 'CLINIC_ADMIN' }).eq('id', userProfile.id)
                                if (error) {
                                    alert("Error fixing role: " + error.message)
                                } else {
                                    window.location.reload()
                                }
                            }
                        }}
                    >
                        I am a Clinic Admin (Fix My Role)
                    </Button>
                </div>
            </div>
        )
    }

    // --- RENDER CLINIC FORM ---
    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
            <Card className="w-full max-w-lg glass-card shadow-xl border-blue-100 animate-in slide-in-from-right duration-500">
                <CardHeader className="text-center pb-8 border-b border-slate-100/50">
                    <div className="mx-auto w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-4">
                        <CheckCircle2 className="w-8 h-8 text-green-600" />
                    </div>
                    <CardTitle className="text-2xl font-bold text-slate-900">Hospital Registered!</CardTitle>
                    <CardDescription className="text-lg mt-2">
                        Now, let's set up your first clinic location.
                    </CardDescription>
                </CardHeader>
                <CardContent className="pt-8">
                    <form onSubmit={handleFirstClinic} className="space-y-6">
                        <div className="space-y-2">
                            <Label>Clinic / Branch Name</Label>
                            <Input name="clinic_name" placeholder="e.g. Main Street HQ" required className="h-12 text-lg" />
                        </div>
                        <div className="space-y-2">
                            <Label>Address / Location</Label>
                            <Input name="location" placeholder="e.g. 123 Health Blvd, NY" required className="h-12 text-lg" />
                        </div>

                        <Button type="submit" disabled={loading} className="w-full h-12 text-lg font-medium bg-green-600 hover:bg-green-700 shadow-lg shadow-green-600/20">
                            {loading ? <Loader2 className="animate-spin" /> : (
                                <span className="flex items-center gap-2">
                                    Launch Dashboard <ArrowRight className="w-5 h-5" />
                                </span>
                            )}
                        </Button>
                    </form>

                    <div className="mt-8 p-4 bg-blue-50 rounded-xl flex gap-3 text-sm text-blue-800">
                        <Building2 className="w-5 h-5 shrink-0" />
                        <p>You can add more clinics and pharmacy counters later from the dashboard.</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
