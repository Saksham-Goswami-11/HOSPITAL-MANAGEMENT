import { useState } from 'react'
import { useHospital } from '@/context/HospitalContext'
import { CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button, Input, Label } from '@/components/ui/basic'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Building2, Shield, Settings2, Bell, Receipt, Clock, Plug, Crown, Package } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { SubscriptionDashboard } from '@/components/billing'
import { WhatsAppSettings } from '@/components/WhatsAppSettings'
import { Smartphone } from 'lucide-react'

export function SettingsDashboard() {
    const {
        profile: userProfile, hospital, clinics, managedClinic,
        updateHospitalSettings, updateClinicSettings,
        updateHospitalProfile, updateClinicProfile
    } = useHospital()
    const { toast } = useToast()
    const [loading, setLoading] = useState(false)
    const role = userProfile?.role

    const isHospitalAdmin = ['ADMIN', 'HOSPITAL_ADMIN', 'SUPER_ADMIN', 'OWNER'].includes(role || '')
    const isClinicAdmin = role === 'CLINIC_ADMIN'

    const myClinic = userProfile?.clinic_id ? clinics.find(c => c.id === userProfile.clinic_id) : null
    const activeClinic = managedClinic || myClinic; // Use managedClinic first, fallback to user's direct clinic

    // Form States - Hospital
    const [hospitalSettings, setHospitalSettings] = useState({
        ...hospital?.settings
    });
    const [hospitalProfile, setHospitalProfile] = useState({
        name: hospital?.name || '',
        registration_number: hospital?.registration_number || '',
        primary_email: hospital?.primary_email || '',
        address: hospital?.address || ''
    });

    // Form States - Clinic
    const [clinicSettings, setClinicSettings] = useState({
        ...activeClinic?.settings
    });
    const [clinicProfile, setClinicProfile] = useState({
        name: activeClinic?.name || '',
        contact_number: activeClinic?.contact_number || '',
        gst_number: activeClinic?.gst_number || '',
        address: activeClinic?.address || ''
    });

    const handleHospitalSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!hospital) return;
        setLoading(true);
        try {
            await updateHospitalSettings(hospital.id, hospitalSettings);
            toast({
                title: "Hospital Settings Saved",
                description: "Your configurations have been updated organization-wide.",
            })
        } catch (error) {
            console.error('Hospital settings save error:', error);
            toast({ title: "Error", description: "Failed to save settings.", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }

    const handleClinicSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeClinic) return;
        setLoading(true);
        try {
            await updateClinicSettings(activeClinic.id, clinicSettings);
            toast({
                title: "Clinic Settings Saved",
                description: "Your local clinic configurations have been updated.",
            })
        } catch (error) {
            console.error('Clinic settings save error:', error);
            toast({ title: "Error", description: "Failed to save settings.", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }


    const handleHospitalProfileSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!hospital) return;
        setLoading(true);
        try {
            // Base table update
            await updateHospitalProfile(hospital.id, { name: hospitalProfile.name });
            // Settings JSONB update
            const updatedSettings = {
                ...hospitalSettings,
                registration_number: hospitalProfile.registration_number,
                primary_email: hospitalProfile.primary_email,
                address: hospitalProfile.address
            };
            setHospitalSettings(updatedSettings);
            await updateHospitalSettings(hospital.id, updatedSettings);

            toast({
                title: "Hospital Profile Saved",
                description: "Primary organization details updated.",
            })
        } catch (error) {
            console.error('Hospital profile save error:', error);
            toast({ title: "Error", description: "Failed to save profile.", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }

    const handleClinicProfileSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeClinic) return;
        setLoading(true);
        try {
            // Base table update
            await updateClinicProfile(activeClinic.id, {
                name: clinicProfile.name,
                address: clinicProfile.address
            });
            // Settings JSONB update
            const updatedSettings = {
                ...clinicSettings,
                contact_number: clinicProfile.contact_number,
                gst_number: clinicProfile.gst_number
            };
            setClinicSettings(updatedSettings);
            await updateClinicSettings(activeClinic.id, updatedSettings);

            toast({
                title: "Clinic Profile Saved",
                description: "Local clinic identity updated.",
            })
        } catch (error) {
            console.error('Clinic profile save error:', error);
            toast({ title: "Error", description: "Failed to save profile.", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }

    if (!isHospitalAdmin && !isClinicAdmin) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
                <Shield className="w-16 h-16 mb-4 text-slate-200" />
                <h2 className="text-xl font-bold text-slate-700">Access Denied</h2>
                <p>You need administrative privileges to view settings.</p>
            </div>
        )
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-6xl mx-auto pb-10">
            <div>
                <h2 className="text-3xl font-bold text-slate-900 tracking-tight">System Settings</h2>
                <p className="text-slate-500 text-sm mt-1">
                    Manage {isHospitalAdmin ? 'global hospital' : 'local clinic'} configurations and preferences.
                </p>
            </div>

            <Tabs defaultValue="profile" className="flex flex-col md:flex-row gap-6">
                <TabsList className="flex flex-row md:flex-col h-auto w-full md:w-64 bg-transparent space-x-2 md:space-x-0 space-y-0 md:space-y-2 justify-start overflow-x-auto md:overflow-visible shrink-0 pb-2 md:pb-0">

                    {/* HOSPITAL TABS */}
                    {isHospitalAdmin && (
                        <>
                            <TabsTrigger value="profile" className="justify-start gap-2 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:shadow-sm border border-transparent">
                                <Building2 className="w-4 h-4" /> Hospital Profile
                            </TabsTrigger>
                            <TabsTrigger value="security" className="justify-start gap-2 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:shadow-sm border border-transparent">
                                <Shield className="w-4 h-4" /> Global Security
                            </TabsTrigger>
                            <TabsTrigger value="policies" className="justify-start gap-2 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:shadow-sm border border-transparent">
                                <Settings2 className="w-4 h-4" /> Global Policies
                            </TabsTrigger>
                            <TabsTrigger value="integrations" className="justify-start gap-2 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:shadow-sm border border-transparent">
                                <Plug className="w-4 h-4" /> Integrations
                            </TabsTrigger>
                            <TabsTrigger value="subscription" className="justify-start gap-2 data-[state=active]:bg-violet-50 data-[state=active]:text-violet-700 data-[state=active]:shadow-sm border border-transparent">
                                <Crown className="w-4 h-4" /> Subscription & Billing
                            </TabsTrigger>
                            <TabsTrigger value="whatsapp" className="justify-start gap-2 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm border border-transparent">
                                <Smartphone className="w-4 h-4" /> WhatsApp Bot
                            </TabsTrigger>
                        </>
                    )}

                    {/* CLINIC TABS */}
                    {isClinicAdmin && (
                        <>
                            <TabsTrigger value="profile" className="justify-start gap-2 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:shadow-sm border border-transparent">
                                <Building2 className="w-4 h-4" /> Clinic Profile
                            </TabsTrigger>
                            <TabsTrigger value="hours" className="justify-start gap-2 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:shadow-sm border border-transparent">
                                <Clock className="w-4 h-4" /> Working Hours
                            </TabsTrigger>
                            <TabsTrigger value="billing" className="justify-start gap-2 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:shadow-sm border border-transparent">
                                <Receipt className="w-4 h-4" /> Billing Defaults
                            </TabsTrigger>
                            <TabsTrigger value="notifications" className="justify-start gap-2 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:shadow-sm border border-transparent">
                                <Bell className="w-4 h-4" /> Notifications
                            </TabsTrigger>
                        </>
                    )}
                </TabsList>

                <div className="flex-1 bg-white border border-slate-200/60 rounded-2xl shadow-sm min-h-[500px]">

                    {/* --- HOSPITAL CONTENT --- */}
                    {isHospitalAdmin && (
                        <>
                            <TabsContent value="profile" className="m-0 p-6 md:p-8 animation-in fade-in slide-in-from-bottom-2">
                                <CardHeader className="p-0 mb-6">
                                    <CardTitle>Hospital Information</CardTitle>
                                    <CardDescription>Update your primary healthcare organization details.</CardDescription>
                                </CardHeader>
                                <form onSubmit={handleHospitalProfileSave} className="space-y-6 max-w-2xl">
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label>Hospital Name</Label>
                                            <Input
                                                value={hospitalProfile.name}
                                                onChange={(e) => setHospitalProfile({ ...hospitalProfile, name: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Registration Number (CIN)</Label>
                                            <Input
                                                value={hospitalProfile.registration_number}
                                                onChange={(e) => setHospitalProfile({ ...hospitalProfile, registration_number: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Primary Contact Email</Label>
                                        <Input
                                            type="email"
                                            value={hospitalProfile.primary_email}
                                            onChange={(e) => setHospitalProfile({ ...hospitalProfile, primary_email: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Headquarters Address</Label>
                                        <Input
                                            value={hospitalProfile.address}
                                            onChange={(e) => setHospitalProfile({ ...hospitalProfile, address: e.target.value })}
                                        />
                                    </div>
                                    <div className="pt-4 border-t border-slate-100">
                                        <Button type="submit" disabled={loading} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700">
                                            {loading ? 'Saving...' : 'Save Changes'}
                                        </Button>
                                    </div>
                                </form>
                            </TabsContent>

                            <TabsContent value="security" className="m-0 p-6 md:p-8 animation-in fade-in slide-in-from-bottom-2">
                                <CardHeader className="p-0 mb-6">
                                    <CardTitle>Network Security Policies</CardTitle>
                                    <CardDescription>Enforce security across all integrated clinics.</CardDescription>
                                </CardHeader>
                                <form onSubmit={handleHospitalSave} className="space-y-6 max-w-2xl">
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between p-4 border border-slate-100 rounded-xl bg-slate-50/50">
                                            <div>
                                                <h4 className="font-semibold text-sm">Require 2-Factor Authentication</h4>
                                                <p className="text-xs text-slate-500">Force all medical staff to use SMS or Authenticator App.</p>
                                            </div>
                                            <input
                                                type="checkbox"
                                                className="w-5 h-5 accent-blue-600 cursor-pointer"
                                                checked={hospitalSettings?.require_2fa ?? true}
                                                onChange={(e) => setHospitalSettings({ ...hospitalSettings, require_2fa: e.target.checked })}
                                            />
                                        </div>

                                        <div className="flex items-center justify-between p-4 border border-slate-100 rounded-xl bg-slate-50/50">
                                            <div>
                                                <h4 className="font-semibold text-sm">Session Timeout (Idle Minutes)</h4>
                                                <p className="text-xs text-slate-500">Automatically log out inactive terminals.</p>
                                            </div>
                                            <Input
                                                type="number"
                                                className="w-24 text-center"
                                                value={hospitalSettings?.session_timeout ?? 30}
                                                onChange={(e) => setHospitalSettings({ ...hospitalSettings, session_timeout: parseInt(e.target.value) })}
                                            />
                                        </div>
                                    </div>
                                    <div className="pt-4 border-t border-slate-100">
                                        <Button type="submit" disabled={loading} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700">Save Security Rules</Button>
                                    </div>
                                </form>
                            </TabsContent>

                            <TabsContent value="policies" className="m-0 p-6 md:p-8 animation-in fade-in slide-in-from-bottom-2">
                                <CardHeader className="p-0 mb-6">
                                    <CardTitle>Global Operation Policies</CardTitle>
                                    <CardDescription>Define standards applied instantly across the network.</CardDescription>
                                </CardHeader>
                                <form onSubmit={handleHospitalSave} className="space-y-6 max-w-2xl">
                                    <div className="space-y-4">
                                        <div className="p-4 border border-blue-100 rounded-xl bg-blue-50/30">
                                            <div className="flex items-center gap-3 mb-4">
                                                <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                                                    <Package className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <h4 className="font-semibold text-sm text-slate-900">Inventory Alert Policy</h4>
                                                    <p className="text-xs text-slate-500">Master threshold for low-stock warnings (in packs) across all clinics.</p>
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Global Low Stock Threshold (Packs)</Label>
                                                <div className="flex items-center gap-3">
                                                    <Input
                                                        type="number"
                                                        className="w-32 font-mono font-bold text-lg"
                                                        value={hospitalSettings?.global_low_stock_threshold ?? 20}
                                                        onChange={(e) => setHospitalSettings({ ...hospitalSettings, global_low_stock_threshold: parseInt(e.target.value) })}
                                                    />
                                                    <span className="text-sm text-slate-500 font-medium">Packs remaining before warning</span>
                                                </div>
                                                <p className="text-[10px] text-slate-400 mt-2 italic">
                                                    *Individual item overrides in clinic inventory will prioritize over this global value.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="p-4 border border-slate-100 rounded-xl bg-slate-50/50 opacity-60 grayscale cursor-not-allowed">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-slate-100 rounded-lg text-slate-400">
                                                    <Clock className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <h4 className="font-semibold text-sm">Automated Procurement</h4>
                                                    <p className="text-xs text-slate-500">Auto-generate purchase orders when stock is low. (Coming Soon)</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t border-slate-100">
                                        <Button type="submit" disabled={loading} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700">
                                            Save Global Policies
                                        </Button>
                                    </div>
                                </form>
                            </TabsContent>

                            <TabsContent value="integrations" className="m-0 p-6 md:p-8 animation-in fade-in slide-in-from-bottom-2">
                                <CardHeader className="p-0 mb-6">
                                    <CardTitle>Partner Integrations</CardTitle>
                                    <CardDescription>Manage connection keys to external gateways.</CardDescription>
                                </CardHeader>
                                <form onSubmit={handleHospitalSave} className="space-y-6 max-w-2xl">
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <Label>Twilio SMS Gateway Key (Patient Alerts)</Label>
                                            <Input
                                                type="password"
                                                value={hospitalSettings?.twilio_key ?? ''}
                                                onChange={(e) => setHospitalSettings({ ...hospitalSettings, twilio_key: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Razorpay / Stripe Webhook Secret</Label>
                                            <Input
                                                type="password"
                                                value={hospitalSettings?.payment_webhook_secret ?? ''}
                                                onChange={(e) => setHospitalSettings({ ...hospitalSettings, payment_webhook_secret: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div className="pt-4 border-t border-slate-100">
                                        <Button type="submit" disabled={loading} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700">Update Credentials</Button>
                                    </div>
                                </form>
                            </TabsContent>

                            <TabsContent value="subscription" className="m-0 p-6 md:p-8 animation-in fade-in slide-in-from-bottom-2">
                                <SubscriptionDashboard />
                            </TabsContent>

                            <TabsContent value="whatsapp" className="m-0 p-6 md:p-8 animation-in fade-in slide-in-from-bottom-2">
                                <WhatsAppSettings hospitalId={hospital?.id || ''} />
                            </TabsContent>
                        </>
                    )}

                    {/* --- CLINIC CONTENT --- */}
                    {isClinicAdmin && (
                        <>
                            <TabsContent value="profile" className="m-0 p-6 md:p-8 animation-in fade-in slide-in-from-bottom-2">
                                <CardHeader className="p-0 mb-6">
                                    <CardTitle>Clinic Identity</CardTitle>
                                    <CardDescription>Local contact and identification details for receipts.</CardDescription>
                                </CardHeader>
                                <form onSubmit={handleClinicProfileSave} className="space-y-6 max-w-2xl">
                                    <div className="space-y-2">
                                        <Label>Clinic Name</Label>
                                        <Input
                                            value={clinicProfile.name}
                                            onChange={(e) => setClinicProfile({ ...clinicProfile, name: e.target.value })}
                                        />
                                    </div>
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label>Public Contact Number</Label>
                                            <Input
                                                type="tel"
                                                placeholder="+91"
                                                value={clinicProfile.contact_number}
                                                onChange={(e) => setClinicProfile({ ...clinicProfile, contact_number: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Local Tax / GST Number</Label>
                                            <Input
                                                placeholder="e.g. 22AAAAA0000A1Z5"
                                                value={clinicProfile.gst_number}
                                                onChange={(e) => setClinicProfile({ ...clinicProfile, gst_number: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Local Address</Label>
                                        <Input
                                            placeholder="Clinic street address for receipts"
                                            value={clinicProfile.address}
                                            onChange={(e) => setClinicProfile({ ...clinicProfile, address: e.target.value })}
                                        />
                                    </div>
                                    <div className="pt-4 border-t border-slate-100">
                                        <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700">Update Profile</Button>
                                    </div>
                                </form>
                            </TabsContent>

                            <TabsContent value="hours" className="m-0 p-6 md:p-8 animation-in fade-in slide-in-from-bottom-2">
                                <CardHeader className="p-0 mb-6">
                                    <CardTitle>Working Hours & Shifts</CardTitle>
                                    <CardDescription>Define operational boundaries for attendance tracking.</CardDescription>
                                </CardHeader>
                                <form onSubmit={handleClinicSave} className="space-y-6 max-w-2xl">
                                    <div className="grid gap-6 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label>Clinic Opening Time</Label>
                                            <Input
                                                type="time"
                                                value={clinicSettings?.opening_time ?? "09:00"}
                                                onChange={(e) => setClinicSettings({ ...clinicSettings, opening_time: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Clinic Closing Time</Label>
                                            <Input
                                                type="time"
                                                value={clinicSettings?.closing_time ?? "21:00"}
                                                onChange={(e) => setClinicSettings({ ...clinicSettings, closing_time: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-4 pt-4 border-t border-slate-100">
                                        <h4 className="font-semibold text-sm">Shift Overrides</h4>
                                        <div className="flex items-center justify-between p-4 border border-slate-100 rounded-xl bg-slate-50/50">
                                            <div>
                                                <h4 className="font-semibold text-sm">Allow Overnight Shifts</h4>
                                                <p className="text-xs text-slate-500">Enable check-ins spanning across midnight.</p>
                                            </div>
                                            <input
                                                type="checkbox"
                                                className="w-5 h-5 accent-blue-600 cursor-pointer"
                                                checked={clinicSettings?.overnight_shifts ?? false}
                                                onChange={(e) => setClinicSettings({ ...clinicSettings, overnight_shifts: e.target.checked })}
                                            />
                                        </div>
                                    </div>
                                    <div className="pt-4 border-t border-slate-100">
                                        <Button type="submit" disabled={loading} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700">Save Schedule</Button>
                                    </div>
                                </form>
                            </TabsContent>

                            <TabsContent value="billing" className="m-0 p-6 md:p-8 animation-in fade-in slide-in-from-bottom-2">
                                <CardHeader className="p-0 mb-6">
                                    <CardTitle>Billing Constraints</CardTitle>
                                    <CardDescription>Customize the local Point of Sale experience.</CardDescription>
                                </CardHeader>
                                <form onSubmit={handleClinicSave} className="space-y-6 max-w-2xl">
                                    <div className="space-y-2">
                                        <Label>Default Receipt Footer Message</Label>
                                        <Input
                                            value={clinicSettings?.receipt_footer ?? "Thank you for trusting us with your health!"}
                                            onChange={(e) => setClinicSettings({ ...clinicSettings, receipt_footer: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-4 pt-4 border-t border-slate-100">
                                        <div className="flex items-center justify-between p-4 border border-slate-100 rounded-xl bg-slate-50/50">
                                            <div>
                                                <h4 className="font-semibold text-sm">Enforce Exact MRP Match</h4>
                                                <p className="text-xs text-slate-500">Staff cannot manually discount items at POS.</p>
                                            </div>
                                            <input
                                                type="checkbox"
                                                className="w-5 h-5 accent-blue-600 cursor-pointer"
                                                checked={clinicSettings?.enforce_mrp ?? true}
                                                onChange={(e) => setClinicSettings({ ...clinicSettings, enforce_mrp: e.target.checked })}
                                            />
                                        </div>
                                    </div>
                                    <div className="pt-4 border-t border-slate-100">
                                        <Button type="submit" disabled={loading} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700">Apply Constraints</Button>
                                    </div>
                                </form>
                            </TabsContent>

                            <TabsContent value="notifications" className="m-0 p-6 md:p-8 animation-in fade-in slide-in-from-bottom-2">
                                <CardHeader className="p-0 mb-6">
                                    <CardTitle>Alert Preferences</CardTitle>
                                    <CardDescription>Determine what events trigger push or email notifications to you.</CardDescription>
                                </CardHeader>
                                <form onSubmit={handleClinicSave} className="space-y-6 max-w-2xl">
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between p-4 border border-slate-100 rounded-xl bg-slate-50/50">
                                            <div>
                                                <h4 className="font-semibold text-sm">Inventory Low-Stock Alerts</h4>
                                                <p className="text-xs text-slate-500">Daily summary of items below threshold.</p>
                                            </div>
                                            <input
                                                type="checkbox"
                                                className="w-5 h-5 accent-blue-600 cursor-pointer"
                                                checked={clinicSettings?.alert_low_stock ?? true}
                                                onChange={(e) => setClinicSettings({ ...clinicSettings, alert_low_stock: e.target.checked })}
                                            />
                                        </div>
                                        <div className="flex items-center justify-between p-4 border border-slate-100 rounded-xl bg-slate-50/50">
                                            <div>
                                                <h4 className="font-semibold text-sm">Shift Anomaly Warnings</h4>
                                            </div>
                                            <input
                                                type="checkbox"
                                                className="w-5 h-5 accent-blue-600 cursor-pointer"
                                                checked={clinicSettings?.alert_shift_anomalies ?? true}
                                                onChange={(e) => setClinicSettings({ ...clinicSettings, alert_shift_anomalies: e.target.checked })}
                                            />
                                        </div>
                                        <div className="flex items-center justify-between p-4 border border-slate-100 rounded-xl bg-slate-50/50">
                                            <div>
                                                <h4 className="font-semibold text-sm">Daily Revenue Summary</h4>
                                            </div>
                                            <input
                                                type="checkbox"
                                                className="w-5 h-5 accent-blue-600 cursor-pointer"
                                                checked={clinicSettings?.alert_daily_revenue ?? false}
                                                onChange={(e) => setClinicSettings({ ...clinicSettings, alert_daily_revenue: e.target.checked })}
                                            />
                                        </div>
                                    </div>
                                    <div className="pt-4 border-t border-slate-100">
                                        <Button type="submit" disabled={loading} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700">Save Preferences</Button>
                                    </div>
                                </form>
                            </TabsContent>
                        </>
                    )}

                </div>
            </Tabs>
        </div>
    )
}
