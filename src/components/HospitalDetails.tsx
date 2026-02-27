import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/basic'
import { Button } from '@/components/ui/basic'
import {
    ArrowLeft, Building2, User, Mail, Phone,
    Database, Users, CreditCard,
    AlertTriangle, FileText, CheckCircle2, XCircle
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

interface HospitalDetailsProps {
    hospitalId: string
    onBack: () => void
}

export function HospitalDetails({ hospitalId, onBack }: HospitalDetailsProps) {
    const { toast } = useToast()
    const [hospital, setHospital] = useState<any>(null)
    const [owner, setOwner] = useState<any>(null)
    // Stats now come directly from hospital_stats_view in 'hospital' state
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchDetails()
    }, [hospitalId])

    const fetchDetails = async () => {
        setLoading(true)
        try {
            // 1. Fetch Hospital Metadata & Stats
            const { data: hospData, error: hospError } = await supabase
                .from('hospital_stats_view')
                .select('*')
                .eq('id', hospitalId)
                .single()

            if (hospError) throw hospError
            setHospital(hospData)

            // 2. Fetch Owner Info
            let finalOwner = null;

            // Try fetching by owner_id if present
            if (hospData.owner_id) {
                const { data } = await supabase.from('profiles').select('*').eq('id', hospData.owner_id).single();
                finalOwner = data;
            }

            // Fallback: Find any Hospital Admin linked to this hospital if no direct owner_id
            if (!finalOwner) {
                const { data: fallbackOwner } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('hospital_id', hospitalId)
                    .eq('role', 'HOSPITAL_ADMIN')
                    .limit(1)
                    .maybeSingle();

                finalOwner = fallbackOwner;
            }

            setOwner(finalOwner);

        } catch (error: any) {
            console.error("Error fetching hospital details:", error)
            toast({
                title: "Error Loading Details",
                description: error.message,
                variant: 'destructive'
            })
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center p-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        )
    }

    if (!hospital) {
        return (
            <div className="p-8 text-center text-slate-500">
                <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-amber-500" />
                <h3 className="text-lg font-semibold text-slate-900">Hospital Not Found</h3>
                <p>The requested hospital ID could not be loaded.</p>
                <Button variant="outline" onClick={onBack} className="mt-4">
                    Go Back
                </Button>
            </div>
        )
    }

    return (
        <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
            {/* HEADER */}
            <div className="flex items-center gap-4 border-b border-slate-200/60 pb-6">
                <Button variant="ghost" onClick={onBack} className="hover:bg-slate-100 rounded-full h-10 w-10 p-0">
                    <ArrowLeft className="w-5 h-5 text-slate-500" />
                </Button>
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{hospital.name}</h1>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border flex items-center gap-1.5 ${hospital.is_active
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                            : 'bg-red-50 text-red-700 border-red-100'
                            }`}>
                            {hospital.is_active ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                            {hospital.is_active ? 'Active Tenant' : 'Suspended'}
                        </span>
                    </div>
                    <p className="text-slate-500 text-sm mt-1 flex items-center gap-2">
                        <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">ID: {hospital.id}</span>
                        <span>•</span>
                        <span>Joined {new Date(hospital.created_at).toLocaleDateString()}</span>
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* 1. OWNER INFO */}
                <Card className="glass-card border-slate-200/50 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base font-semibold flex items-center gap-2 text-slate-800">
                            <User className="w-4 h-4 text-blue-500" /> Owner Information
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-4">
                        {owner ? (
                            <>
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-lg">
                                        {owner.full_name?.charAt(0) || 'A'}
                                    </div>
                                    <div>
                                        <p className="font-medium text-slate-900">{owner.full_name || 'Unknown Name'}</p>
                                        <p className="text-sm text-slate-500">Hospital Administrator</p>
                                    </div>
                                </div>
                                <div className="space-y-3 pt-2">
                                    <div className="flex items-center gap-3 text-sm text-slate-600 bg-slate-50 p-2 rounded-lg">
                                        <Mail className="w-4 h-4 text-slate-400" />
                                        {hospital.admin_email || owner.email || 'No Email'}
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-slate-600 bg-slate-50 p-2 rounded-lg">
                                        <Phone className="w-4 h-4 text-slate-400" />
                                        {owner.phone || 'No Phone Number'}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="text-center py-6 text-slate-400 italic bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                <User className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                <p>Unclaimed / No Admin</p>
                                <p className="text-xs">This hospital has no linked admin profile.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* 2. CONSUMPTION & USAGE */}
                <Card className="glass-card border-slate-200/50 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base font-semibold flex items-center gap-2 text-slate-800">
                            <Database className="w-4 h-4 text-purple-500" /> Consumption
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 grid grid-cols-2 gap-4">
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
                            <Users className="w-5 h-5 mx-auto text-slate-400 mb-2" />
                            <h3 className="text-2xl font-bold text-slate-900">{hospital.total_users || 0}</h3>
                            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Total Users</p>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
                            <Building2 className="w-5 h-5 mx-auto text-slate-400 mb-2" />
                            <h3 className="text-2xl font-bold text-slate-900">{hospital.total_clinics || 0}</h3>
                            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Clinics</p>
                        </div>
                        <div className="col-span-2 bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Database className="w-5 h-5 text-slate-400" />
                                <div>
                                    <p className="text-sm font-medium text-slate-900">Storage Used</p>
                                    <p className="text-xs text-slate-500">Database & Media</p>
                                </div>
                            </div>
                            <span className="text-lg font-bold text-slate-700">
                                {hospital.storage_used_mb
                                    ? (hospital.storage_used_mb < 1024
                                        ? `${hospital.storage_used_mb} MB`
                                        : `${(hospital.storage_used_mb / 1024).toFixed(1)} GB`)
                                    : '0 MB'}
                            </span>
                        </div>
                    </CardContent>
                </Card>

                {/* 3. SUBSCRIPTION & BILLING */}
                <Card className="glass-card border-slate-200/50 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base font-semibold flex items-center gap-2 text-slate-800">
                            <CreditCard className="w-4 h-4 text-emerald-500" /> Subscription
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-4">
                        <div className="flex justify-between items-center p-3 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100 rounded-lg">
                            <div>
                                <p className="text-xs text-emerald-600 font-bold uppercase tracking-wider">Current Plan</p>
                                <p className="text-lg font-bold text-emerald-900">{hospital.subscription_plan || 'Basic'}</p>
                            </div>
                            <span className="text-xl font-bold text-emerald-700">₹0<span className="text-xs font-normal text-emerald-600">/mo</span></span>
                        </div>

                        <div>
                            <p className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wider">Billing History</p>
                            <div className="space-y-2">
                                <div className="flex justify-between items-center text-sm p-2 hover:bg-slate-50 rounded transition-colors border border-transparent hover:border-slate-100 cursor-pointer">
                                    <div className="flex items-center gap-2">
                                        <FileText className="w-4 h-4 text-slate-400" />
                                        <span className="text-slate-700">Invoice #INV-001</span>
                                    </div>
                                    <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-medium">PAID</span>
                                </div>
                                <div className="flex justify-between items-center text-sm p-2 hover:bg-slate-50 rounded transition-colors border border-transparent hover:border-slate-100 cursor-pointer">
                                    <div className="flex items-center gap-2">
                                        <FileText className="w-4 h-4 text-slate-400" />
                                        <span className="text-slate-700">Invoice #Start-Up</span>
                                    </div>
                                    <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-medium">FREE</span>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* DANGER ZONE */}
            <Card className="border-red-100 shadow-none bg-red-50/30">
                <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold flex items-center gap-2 text-red-800">
                        <AlertTriangle className="w-4 h-4" /> Danger Zone
                    </CardTitle>
                    <CardDescription className="text-red-600/80">
                        Actions here can have specific consequences. Proceed with caution.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex gap-4 pt-2">
                    <Button variant="outline" className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800">
                        Suspend Tenant Access
                    </Button>
                    <Button variant="outline" className="border-slate-200 text-slate-600 hover:bg-slate-50">
                        Reset Admin Password
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}
