import { useState, useEffect } from 'react'
import { Button, Input, Label } from '@/components/ui/basic'
import { Smartphone, ShieldCheck, Zap, Copy, Download, RefreshCw, Key } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { dataService as db } from '@/lib/dataService'

export function WhatsAppSettings({ hospitalId }: { hospitalId: string }) {
    const { toast } = useToast()
    const [loading, setLoading] = useState(false)
    const [config, setConfig] = useState<any>(null)
    const [status, setStatus] = useState<'online' | 'offline'>('offline')

    const fetchConfig = async () => {
        try {
            const list = await db.list('whatsapp_configs', {
                filters: [{ column: 'hospital_id', operator: 'eq', value: hospitalId }]
            })
            if (list && list.length > 0) {
                setConfig(list[0])
                // Check Heartbeat (Online if < 2 mins)
                if (list[0].last_heartbeat) {
                    const last = new Date(list[0].last_heartbeat).getTime()
                    const now = new Date().getTime()
                    if (now - last < 120000) setStatus('online')
                    else setStatus('offline')
                }
            }
        } catch (err) {
            console.error('Error fetching whatsapp config:', err)
        }
    }

    useEffect(() => {
        fetchConfig()
        const poller = setInterval(fetchConfig, 30000)
        return () => clearInterval(poller)
    }, [hospitalId])

    const handleToggle = async (field: string, value: any) => {
        if (!config) return
        try {
            const updated = await db.update('whatsapp_configs', config.id, {
                [field]: value
            })
            setConfig(updated)
            toast({ title: "Settings Updated", description: "WhatsApp preferences saved." })
        } catch (err) {
            toast({ title: "Error", description: "Failed to update settings.", variant: "destructive" })
        }
    }

    const handleSettingChange = async (key: string, value: boolean) => {
        if (!config) return
        const newSettings = { ...config.settings, [key]: value }
        handleToggle('settings', newSettings)
    }

    const generateSecret = async () => {
        setLoading(true)
        try {
            const secret = `wa_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`
            if (config) {
                const updated = await db.update('whatsapp_configs', config.id, { agent_secret_key: secret })
                setConfig(updated)
            } else {
                const created = await db.create('whatsapp_configs', {
                    hospital_id: hospitalId,
                    agent_secret_key: secret,
                    is_enabled: true
                })
                setConfig(created)
            }
            toast({ title: "New Key Generated", description: "Please update your local agent." })
        } catch (err) {
            toast({ title: "Error", description: "Failed to generate key." })
        } finally {
            setLoading(false)
        }
    }

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text)
        toast({ title: "Copied!", description: `${label} copied to clipboard.` })
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
                        <Smartphone className="w-5 h-5 text-emerald-600" /> 
                        WhatsApp Automation Agent
                    </h3>
                    <p className="text-sm text-slate-500">Use your own phone to send automated OPD token and billing alerts.</p>
                </div>
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                    status === 'online' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-50 text-slate-500 border border-slate-200'
                }`}>
                    <div className={`w-2 h-2 rounded-full ${status === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                    Agent: {status}
                </div>
            </div>

            {!config ? (
                <div className="p-8 border-2 border-dashed border-slate-100 rounded-2xl text-center space-y-4">
                    <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                        <Zap className="w-8 h-8" />
                    </div>
                    <div className="max-w-md mx-auto">
                        <h4 className="font-bold text-slate-900">Setup Your WhatsApp Gateway</h4>
                        <p className="text-sm text-slate-500 mt-1">Ready to automate your patient communication? Click below to generate your private connection keys.</p>
                    </div>
                    <Button onClick={generateSecret} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
                        <Zap className="w-4 h-4" /> Start Setup Now
                    </Button>
                </div>
            ) : (
                <>
                    {/* 1. OVERALL STATUS & CONTROLS */}
                    <div className="grid gap-6 md:grid-cols-2">
                        <div className="p-6 border border-slate-100 rounded-2xl bg-white shadow-sm space-y-4">
                            <div className="flex items-center justify-between">
                                <h4 className="font-bold text-slate-800 flex items-center gap-2">
                                    <ShieldCheck className="w-4 h-4 text-blue-600" /> Master Controls
                                </h4>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Enabled</span>
                                    <input 
                                        type="checkbox" 
                                        className="w-5 h-5 accent-emerald-600"
                                        checked={config.is_enabled}
                                        onChange={(e) => handleToggle('is_enabled', e.target.checked)}
                                    />
                                </div>
                            </div>
                            
                            <div className="space-y-3 pt-2">
                                <Label className="text-xs text-slate-500">Automated Alerts</Label>
                                <div className="space-y-2">
                                    {['opd_enabled', 'ipd_enabled', 'pharmacy_enabled'].map((key) => (
                                        <div key={key} className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50/80 transition-colors border border-transparent hover:border-slate-100">
                                            <span className="text-sm font-medium text-slate-700 capitalize">{key.replace('_enabled', '').replace('opd', 'OPD Token').replace('ipd', 'IPD Admission').replace('pharmacy', 'Pharmacy Billing')}</span>
                                            <input 
                                                type="checkbox" 
                                                className="w-4 h-4 accent-emerald-500"
                                                checked={config.settings[key]}
                                                onChange={(e) => handleSettingChange(key, e.target.checked)}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* 2. AGENT CONNECTION INFO */}
                        <div className="p-6 border border-slate-100 rounded-2xl bg-slate-900 text-slate-100 space-y-5">
                            <div className="flex items-center justify-between">
                                <h4 className="font-bold flex items-center gap-2">
                                    <Key className="w-4 h-4 text-emerald-400" /> Private Agent Credentials
                                </h4>
                                <Button variant="ghost" size="sm" onClick={generateSecret} className="h-7 text-[11px] text-slate-400 hover:text-white border border-slate-800">
                                    <RefreshCw className="w-3 h-3 mr-1" /> Regenerate
                                </Button>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Your Hospital ID</Label>
                                    <div className="flex gap-2">
                                        <Input readOnly value={hospitalId} className="h-8 bg-slate-800 border-slate-700 text-[11px] font-mono text-emerald-400" />
                                        <Button variant="ghost" size="sm" onClick={() => copyToClipboard(hospitalId, 'Hospital ID')} className="h-8 w-8 p-0 text-slate-400"><Copy className="w-3.5 h-3.5"/></Button>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Agent Secret Key</Label>
                                    <div className="flex gap-2">
                                        <Input type="password" readOnly value={config.agent_secret_key} className="h-8 bg-slate-800 border-slate-700 text-[11px] font-mono text-emerald-400" />
                                        <Button variant="ghost" size="sm" onClick={() => copyToClipboard(config.agent_secret_key, 'Secret Key')} className="h-8 w-8 p-0 text-slate-400"><Copy className="w-3.5 h-3.5"/></Button>
                                    </div>
                                </div>
                            </div>

                            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                                <p className="text-[11px] text-blue-300 leading-relaxed font-medium">
                                    🚀 *Installation*: Download the agent script, install Python, and run it on any office PC. It will ask for these two keys. One scan, and you're set!
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* 3. STEP-BY-STEP INSTALLATION */}
                    <div className="p-6 border border-slate-100 rounded-2xl bg-white space-y-4">
                        <h4 className="font-bold text-slate-800 flex items-center gap-2">
                            How to set up your phone (3 mins)
                        </h4>
                        <div className="grid gap-4 md:grid-cols-3">
                            <div className="space-y-2">
                                <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-sm font-bold text-slate-500 border border-slate-100">1</div>
                                <h5 className="font-semibold text-sm">Download Agent</h5>
                                <p className="text-xs text-slate-500">Download the `whatsapp_agent.py` script to a Windows/Mac PC at your clinic.</p>
                                <Button variant="outline" size="sm" className="h-8 text-xs gap-2"><Download className="w-3 h-3" /> Download Script</Button>
                            </div>
                            <div className="space-y-2">
                                <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-sm font-bold text-slate-500 border border-slate-100">2</div>
                                <h5 className="font-semibold text-sm">Paste Keys</h5>
                                <p className="text-xs text-slate-500">Open the script and paste your Hospital ID and Secret Key provided above.</p>
                            </div>
                            <div className="space-y-2">
                                <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-sm font-bold text-slate-500 border border-slate-100">3</div>
                                <h5 className="font-semibold text-sm">Scan QR Code</h5>
                                <p className="text-xs text-slate-500">Run the script. A window will pop up. Scan it once with your phone. That's it!</p>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
