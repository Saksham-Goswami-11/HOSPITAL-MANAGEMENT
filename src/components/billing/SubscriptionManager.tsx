import React, { useEffect, useState } from 'react';
import { dataService as db } from '@/lib/dataService';
import { Card, CardContent } from '@/components/ui/basic';
import { Button, Input } from '@/components/ui/basic';
import {
    CheckCircle2, XCircle, Clock, Star, Video, ExternalLink,
    Pause, Play, Trash2, Calendar, Loader2, Search
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export function SubscriptionManager() {
    const { toast } = useToast();
    const [requests, setRequests] = useState<any[]>([]);
    const [deletionRequests, setDeletionRequests] = useState<any[]>([]);
    const [hospitals, setHospitals] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [processingId, setProcessingId] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            // Fetch pending extension requests
            const reqData = await db.list('trial_extension_requests', {
                select: '*, hospitals(name)',
                filters: [{ column: 'status', operator: 'eq', value: 'pending' }],
                sort: { column: 'created_at', ascending: false }
            });

            setRequests(reqData || []);

            // Fetch pending data deletion requests
            const delData = await db.list('data_deletion_requests', {
                select: '*, hospitals(name)',
                filters: [{ column: 'status', operator: 'eq', value: 'pending' }],
                sort: { column: 'created_at', ascending: false }
            });

            setDeletionRequests(delData || []);

            // Fetch all hospitals with their subscription status
            const hospData = await db.list('hospital_stats_view', {
                sort: { column: 'name' }
            });

            setHospitals(hospData || []);
        } catch (err) {
            console.error('Fetch Error:', err);
        }
    };

    const handleExtensionAction = async (requestId: string, hospitalId: string, approve: boolean) => {
        setProcessingId(requestId);
        try {
            const { data, error } = await db.invokeFunction('manage-subscription', {
                body: {
                    action: 'approve_trial_extension',
                    hospitalId,
                    requestId,
                    approve
                }
            });

            if (error) throw error;

            toast({
                title: approve ? 'Trial Extended' : 'Request Rejected',
                description: data?.message || (approve ? 'Hospital has been granted 8 extra days.' : 'The extension request was denied.'),
                className: approve ? 'bg-green-50 text-green-900 border-green-200 shadow-sm' : 'bg-red-50 text-red-900 border-red-200'
            });

            fetchData();
        } catch (err: any) {
            console.error('Extension Action Error:', err);
            const errorMessage = typeof err.context?.json === 'function'
                ? await err.context.json().then((j: any) => j.error || err.message)
                : err.message;
            toast({
                title: 'Action Failed',
                description: errorMessage,
                variant: 'destructive'
            });
        } finally {
            setProcessingId(null);
        }
    };

    const handleSubscriptionAction = async (hospitalId: string, action: 'pause' | 'resume' | 'delete' | 'extend_trial') => {
        const isDelete = action === 'delete';
        if (isDelete && !confirm('CRITICAL: This will PERMANENTLY delete all data for this hospital. This cannot be undone. Are you sure?')) {
            return;
        }

        setProcessingId(hospitalId);
        try {
            const { data, error } = await db.invokeFunction('manage-subscription', {
                body: {
                    action: isDelete ? 'delete_hospital' : (action === 'extend_trial' ? 'approve_trial_extension' : action),
                    hospitalId,
                    approve: action === 'extend_trial' ? true : undefined,
                    requestId: action === 'extend_trial' ? 'manual_admin_override' : undefined
                }
            });

            if (error) throw error;

            toast({
                title: 'Action Successful',
                description: data?.message || `Hospital ${action}ed successfully.`,
                className: 'bg-blue-50 text-blue-900 border-blue-200 shadow-sm'
            });

            fetchData();
        } catch (err: any) {
            console.error('Subscription Action Error:', err);
            const errorMessage = typeof err.context?.json === 'function'
                ? await err.context.json().then((j: any) => j.error || err.message)
                : err.message;
            toast({
                title: 'Action Failed',
                description: errorMessage,
                variant: 'destructive'
            });
        } finally {
            setProcessingId(null);
        }
    };

    const filteredHospitals = hospitals.filter(h =>
        h.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        h.id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-8">
            {/* Testimonial Review Queue */}
            <section>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                        Trial Extension Requests
                        {requests.length > 0 && (
                            <span className="bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full animate-pulse">
                                {requests.length} Pending
                            </span>
                        )}
                    </h2>
                </div>

                {requests.length === 0 ? (
                    <Card className="border-dashed">
                        <CardContent className="py-8 text-center text-slate-400">
                            <Clock className="w-8 h-8 mx-auto mb-2 opacity-20" />
                            <p>No pending extension requests at the moment.</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-4">
                        {requests.map(req => (
                            <Card key={req.id} className="overflow-hidden border-blue-100 shadow-sm hover:shadow-md transition-shadow">
                                <CardContent className="p-0">
                                    <div className="flex flex-col md:flex-row">
                                        <div className="flex-1 p-5 border-b md:border-b-0 md:border-r border-slate-100">
                                            <div className="flex justify-between items-start mb-3">
                                                <div>
                                                    <h3 className="font-bold text-slate-900">{req.hospitals?.name}</h3>
                                                    <p className="text-xs text-slate-500">Submitted by {req.contact_name} ({req.contact_email})</p>
                                                </div>
                                                <div className="flex gap-1">
                                                    {[1, 2, 3, 4, 5].map(s => (
                                                        <Star key={s} className={`w-3 h-3 ${s <= req.rating ? 'text-yellow-400 fill-yellow-400' : 'text-slate-200'}`} />
                                                    ))}
                                                </div>
                                            </div>
                                            <p className="text-sm text-slate-600 italic bg-slate-50 p-3 rounded-lg border border-slate-100">
                                                "{req.testimonial_text}"
                                            </p>
                                            {req.video_url && (
                                                <a
                                                    href={req.video_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="mt-3 inline-flex items-center gap-1.5 text-xs text-blue-600 font-bold hover:underline"
                                                >
                                                    <Video className="w-3.5 h-3.5" /> View Video Testimonial <ExternalLink className="w-3 h-3" />
                                                </a>
                                            )}
                                        </div>
                                        <div className="bg-slate-50/50 p-5 w-full md:w-48 flex flex-row md:flex-col justify-center gap-2">
                                            <Button
                                                onClick={() => handleExtensionAction(req.id, req.hospital_id, true)}
                                                disabled={!!processingId}
                                                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 h-10 text-xs"
                                            >
                                                {processingId === req.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                                Approve
                                            </Button>
                                            <Button
                                                variant="outline"
                                                onClick={() => handleExtensionAction(req.id, req.hospital_id, false)}
                                                disabled={!!processingId}
                                                className="flex-1 border-red-200 text-red-600 hover:bg-red-50 gap-1.5 h-10 text-xs"
                                            >
                                                <XCircle className="w-3.5 h-3.5" />
                                                Reject
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </section>

            {/* Data Deletion Requests */}
            {deletionRequests.length > 0 && (
                <section className="bg-red-50/30 border border-red-100 rounded-xl p-6">
                    <div className="flex items-center gap-2 mb-4 text-red-900">
                        <Trash2 className="w-5 h-5" />
                        <h2 className="text-xl font-bold">Pending Data Deletion Requests</h2>
                        <span className="bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full">
                            {deletionRequests.length} Pending
                        </span>
                    </div>
                    <div className="grid gap-3">
                        {deletionRequests.map(del => (
                            <div key={del.id} className="bg-white border border-red-100 p-4 rounded-lg flex items-center justify-between shadow-sm">
                                <div>
                                    <h3 className="font-bold text-slate-900">{del.hospitals?.name || del.hospital_id}</h3>
                                    <p className="text-xs text-red-600">
                                        {del.reason}
                                    </p>
                                    <p className="text-[10px] text-slate-400 mt-1">
                                        Scheduled: {new Date(del.scheduled_at).toLocaleDateString()}
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        onClick={async () => {
                                            setProcessingId(del.id);
                                            try {
                                                const { data, error } = await db.invokeFunction('manage-subscription', {
                                                    body: {
                                                        action: 'approve_data_deletion',
                                                        hospitalId: del.hospital_id,
                                                        requestId: del.id
                                                    }
                                                });
                                                if (error) throw error;
                                                toast({ title: 'Deletion Approved', description: data?.message || 'Hospital data permanently deleted.', className: 'bg-red-50 text-red-900 border-red-200' });
                                                fetchData();
                                            } catch (err: any) {
                                                toast({ title: 'Action Failed', description: err.message, variant: 'destructive' });
                                            } finally {
                                                setProcessingId(null);
                                            }
                                        }}
                                        disabled={processingId === del.id}
                                        variant="outline"
                                        className="border-red-200 text-red-600 hover:bg-red-600 hover:text-white transition-all text-xs h-9 px-4 font-bold"
                                    >
                                        {processingId === del.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Approve Deletion'}
                                    </Button>
                                    <Button
                                        onClick={async () => {
                                            setProcessingId(del.id);
                                            try {
                                                const { error } = await db.invokeFunction('manage-subscription', {
                                                    body: {
                                                        action: 'reject_data_deletion',
                                                        hospitalId: del.hospital_id,
                                                        requestId: del.id
                                                    }
                                                });
                                                if (error) throw error;
                                                toast({ title: 'Deletion Rejected', description: 'Data preservation extended.', className: 'bg-green-50 text-green-900 border-green-200' });
                                                fetchData();
                                            } catch (err: any) {
                                                toast({ title: 'Action Failed', description: err.message, variant: 'destructive' });
                                            } finally {
                                                setProcessingId(null);
                                            }
                                        }}
                                        disabled={processingId === del.id}
                                        variant="outline"
                                        className="border-slate-200 text-slate-600 hover:bg-slate-100 text-xs h-9 px-4"
                                    >
                                        Reject
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Hospital Subscription Management */}
            <section>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                    <h2 className="text-xl font-bold text-slate-900">Subscription Management</h2>
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Search hospital..."
                            className="pl-10 h-9 text-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-5 py-3 font-bold text-slate-600 uppercase text-[10px] tracking-wider">Hospital</th>
                                <th className="px-5 py-3 font-bold text-slate-600 uppercase text-[10px] tracking-wider">Status</th>
                                <th className="px-5 py-3 font-bold text-slate-600 uppercase text-[10px] tracking-wider">Plan</th>
                                <th className="px-5 py-3 font-bold text-slate-600 uppercase text-[10px] tracking-wider">Expiry/Renews</th>
                                <th className="px-5 py-3 font-bold text-slate-600 text-right uppercase text-[10px] tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredHospitals.map(h => (
                                <tr key={h.id} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="px-5 py-4">
                                        <div className="font-bold text-slate-900">{h.name}</div>
                                        <div className="text-[10px] text-slate-400 font-mono">{h.id}</div>
                                    </td>
                                    <td className="px-5 py-4">
                                        <Badge className={`
                                            ${h.subscription_status === 'trialing' ? 'bg-blue-50 text-blue-600' : ''}
                                            ${h.subscription_status === 'trial_extended' ? 'bg-violet-50 text-violet-600' : ''}
                                            ${h.subscription_status === 'active' ? 'bg-emerald-50 text-emerald-600' : ''}
                                            ${h.subscription_status === 'paused' ? 'bg-amber-50 text-amber-600' : ''}
                                            ${h.subscription_status === 'expired' ? 'bg-red-50 text-red-600' : ''}
                                            text-[10px] px-2 py-0.5 rounded-full capitalize
                                        `}>
                                            {h.subscription_status || 'Incomplete'}
                                        </Badge>
                                    </td>
                                    <td className="px-5 py-4 font-medium uppercase text-[10px] text-slate-500">
                                        {h.subscription_plan || 'N/A'}
                                    </td>
                                    <td className="px-5 py-4 text-xs text-slate-600">
                                        {h.subscription_status === 'trialing'
                                            ? h.trial_ends_at ? new Date(h.trial_ends_at).toLocaleDateString() : '-'
                                            : h.current_period_end ? new Date(h.current_period_end).toLocaleDateString() : '-'
                                        }
                                    </td>
                                    <td className="px-5 py-4 text-right">
                                        <div className="flex justify-end gap-1 px-1">
                                            {h.subscription_status === 'paused' ? (
                                                <button
                                                    onClick={() => handleSubscriptionAction(h.id, 'resume')}
                                                    disabled={!!processingId}
                                                    title="Resume Subscription"
                                                    className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors border border-emerald-100"
                                                >
                                                    <Play className="w-4 h-4 fill-emerald-600" />
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleSubscriptionAction(h.id, 'pause')}
                                                    disabled={!!processingId}
                                                    title="Pause Subscription"
                                                    className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
                                                >
                                                    <Pause className="w-4 h-4 fill-slate-500" />
                                                </button>
                                            )}

                                            <button
                                                onClick={() => handleSubscriptionAction(h.id, 'extend_trial')}
                                                disabled={!!processingId}
                                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-blue-100"
                                                title="Manually Extend Trial (+8 days)"
                                            >
                                                <Calendar className="w-4 h-4" />
                                            </button>

                                            <button
                                                onClick={() => handleSubscriptionAction(h.id, 'delete')}
                                                disabled={!!processingId}
                                                className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-red-100"
                                                title="Permanently Delete Hospital Data"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>

                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}

function Badge({ children, className }: { children: React.ReactNode, className?: string }) {
    return (
        <span className={`inline-flex items-center font-bold font-sans ${className}`}>
            {children}
        </span>
    );
}
