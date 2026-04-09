import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/basic'
import { Button, Input, Label } from '@/components/ui/basic'
import { Building2, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react'
import { dataService as db } from '@/lib/dataService'
import { useToast } from '@/components/ui/use-toast'

export function AdminSetup({ userProfile, onComplete }: { userProfile: any, onComplete: () => void }) {
    const [searchParams] = useSearchParams()
    const { toast } = useToast()
    const [loading, setLoading] = useState(false)

    // Get plan from URL (primary) or user metadata (fallback)
    const urlPlan = searchParams.get('plan')
    const urlBilling = searchParams.get('billing')
    const metaPlan = userProfile?.user_metadata?.onboarding_plan
    const metaBilling = userProfile?.user_metadata?.onboarding_billing

    const selectedPlan = urlPlan || metaPlan || 'free'
    const selectedBilling = urlBilling || metaBilling || 'monthly'

    // If user has no hospital_id, start at 'hospital' step, otherwise 'clinic'
    const [step, setStep] = useState<'hospital' | 'clinic'>(userProfile?.hospital_id ? 'clinic' : 'hospital')
    const [localHospitalId, setLocalHospitalId] = useState<string | null>(userProfile?.hospital_id || null)

    // Ensure user role is HOSPITAL_ADMIN for self-service
    useEffect(() => {
        const fixRole = async () => {
            if (userProfile && userProfile.role !== 'HOSPITAL_ADMIN' && userProfile.role !== 'SUPER_ADMIN') {
                await db.update('profiles', userProfile.id, { role: 'HOSPITAL_ADMIN' });
            }
        };
        fixRole();
    }, [userProfile]);

    const [hospitalName, setHospitalName] = useState('')
    const [hospitalSlug, setHospitalSlug] = useState('')
    const [hospitalAdminEmail, setHospitalAdminEmail] = useState(userProfile?.email || '')

    // Helper to generate a clean slug from name
    const slugify = (text: string) => {
        return text
            .toLowerCase()
            .replace(/[^\w\s-]/g, '') // Remove non-word chars (except space and hyphen)
            .replace(/\s+/g, '-')     // Replace spaces with hyphens
            .replace(/-+/g, '-')      // Replace multiple hyphens with single hyphen
            .trim();                  // Trim from both ends
    }

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newName = e.target.value;
        setHospitalName(newName);
        setHospitalSlug(slugify(newName));
    }

    async function handleHospitalSetup(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setLoading(true)
        const formData = new FormData(e.currentTarget)
        const name = formData.get('name') as string
        const slug = formData.get('slug') as string
        const color = formData.get('branding_color') as string

        try {
            // Use the secure RPC to initialize the hospital onboarding
            // This bypasses RLS for the initial setup and ensures atomicity
            const planSlug = selectedPlan === 'free' ? 'testing' : selectedPlan;

            const hospitalId = await db.callRpc('initialize_hospital_onboarding', {
                p_name: name,
                p_slug: slug,
                p_branding_color: color,
                p_owner_id: userProfile.id,
                p_plan_slug: planSlug,
                p_billing_cycle: selectedBilling,
                p_admin_email: formData.get('admin_email') as string
            });

            // 3. Update Local State & Prepare to Move Next
            userProfile.hospital_id = hospitalId
            setLocalHospitalId(hospitalId)
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
            await db.create('clinics', {
                name: clinicName,
                location: location,
                hospital_id: localHospitalId
            })

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
                                <Input
                                    name="name"
                                    placeholder="e.g. City General Hospital"
                                    required
                                    className="h-12 text-lg"
                                    value={hospitalName}
                                    onChange={handleNameChange}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Unique Slug (ID)</Label>
                                <Input
                                    name="slug"
                                    placeholder="e.g. city-general-ny"
                                    required
                                    className="h-12 text-lg font-mono"
                                    value={hospitalSlug}
                                    onChange={(e) => setHospitalSlug(e.target.value)}
                                />
                                <p className="text-xs text-slate-400">Used for URL identification. Must be unique.</p>
                            </div>
                            <div className="space-y-2">
                                <Label>Administrative Email</Label>
                                <Input
                                    name="admin_email"
                                    type="email"
                                    placeholder="admin@hospital.com"
                                    required
                                    className="h-12 text-lg"
                                    value={hospitalAdminEmail}
                                    onChange={(e) => setHospitalAdminEmail(e.target.value)}
                                />
                                <p className="text-xs text-slate-400">Primary contact for billing and verification links.</p>
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
                                try {
                                    await db.update('profiles', userProfile.id, { role: 'CLINIC_ADMIN' })
                                    window.location.reload()
                                } catch (error: any) {
                                    alert("Error fixing role: " + error.message)
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
