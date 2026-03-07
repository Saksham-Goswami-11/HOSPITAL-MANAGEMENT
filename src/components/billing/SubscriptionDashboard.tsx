import { useState, useEffect } from 'react';
import { useHospital } from '@/context/HospitalContext';
import { dataService as db } from '@/lib/dataService';
import { UsageOverview } from './UsageMeter';
import { UpgradeModal } from './UpgradeModal';
import { TestimonialForm } from './TestimonialForm';
import {
    Crown, Calendar, ArrowUpRight, Receipt,
    CheckCircle2, AlertTriangle, Clock, Sparkles, FileText, Loader2, X
} from 'lucide-react';

const PLAN_GRADIENT: Record<string, string> = {
    testing: 'from-teal-600 to-cyan-600',
    extended_testing: 'from-cyan-600 to-sky-600',
    starter: 'from-blue-600 to-indigo-600',
    professional: 'from-violet-600 to-purple-600',
    enterprise: 'from-amber-500 to-orange-600',
};

const STATUS_CONFIG: Record<string, { color: string; icon: any; label: string }> = {
    active: { color: 'text-emerald-600 bg-emerald-50', icon: CheckCircle2, label: 'Active' },
    trialing: { color: 'text-blue-600 bg-blue-50', icon: Clock, label: 'Free Trial' },
    trial_extended: { color: 'text-violet-600 bg-violet-50', icon: Sparkles, label: 'Extended Trial' },
    past_due: { color: 'text-red-600 bg-red-50', icon: AlertTriangle, label: 'Past Due' },
    cancelled: { color: 'text-slate-500 bg-slate-100', icon: AlertTriangle, label: 'Cancelled' },
    expired: { color: 'text-slate-400 bg-slate-50', icon: AlertTriangle, label: 'Expired' },
    paused: { color: 'text-amber-600 bg-amber-50', icon: AlertTriangle, label: 'Paused' },
};

function formatDate(dateStr: string | null) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
}

function formatPaise(paise: number) {
    if (paise === 0) return 'Free';
    return `₹${(paise / 100).toLocaleString('en-IN')}`;
}

export function SubscriptionDashboard() {
    const { hospital, billing } = useHospital();
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [showTestimonialModal, setShowTestimonialModal] = useState(false);
    const [extensionRequest, setExtensionRequest] = useState<any>(null);
    const [loadingRequest, setLoadingRequest] = useState(true);

    const { plan, subscription, isTrialing, isTrialExtended, isExpired, daysLeftInTrial, isPastDue, isPaused, canExtendTrial, dataDeletesAt } = billing;

    const gradient = PLAN_GRADIENT[plan?.slug || 'starter'] || PLAN_GRADIENT.starter;
    const statusConfig = STATUS_CONFIG[subscription?.status || 'active'] || STATUS_CONFIG.active;
    const StatusIcon = statusConfig.icon;

    const price = subscription?.billing_cycle === 'annual'
        ? (plan?.price_annual_paise || 0)
        : (plan?.price_monthly_paise || 0);

    // Fetch existing extension request
    useEffect(() => {
        const fetchRequest = async () => {
            if (!hospital?.id) return;
            const data = await db.list('trial_extension_requests', {
                filters: [{ column: 'hospital_id', operator: 'eq', value: hospital.id }],
                limit: 1
            });
            setExtensionRequest(data?.[0] || null);
            setLoadingRequest(false);
        };
        fetchRequest();
    }, [hospital?.id]);

    return (
        <div className="space-y-6">
            {/* Current Plan Hero Card */}
            <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} p-6 text-white shadow-lg`}>
                {/* Decorative elements */}
                <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

                <div className="relative z-10">
                    <div className="flex items-start justify-between mb-4">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <Crown className="w-5 h-5 text-white/80" />
                                <span className="text-sm font-medium text-white/70 uppercase tracking-wider">
                                    {(isTrialing || isTrialExtended) ? 'Trialing Plan' : 'Current Plan'}
                                </span>
                            </div>
                            <h2 className="text-3xl font-extrabold">
                                {(isTrialing || isTrialExtended) ? 'Free Trial' : (plan?.name || (loadingRequest ? 'Loading...' : 'Current Plan'))}
                            </h2>
                        </div>
                        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${statusConfig.color}`}>
                            <StatusIcon className="w-3.5 h-3.5" />
                            {statusConfig.label}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-6">
                        <div>
                            <p className="text-xs text-white/60 mb-0.5">Price</p>
                            <p className="text-lg font-bold">
                                {formatPaise(price)}
                                {price > 0 && <span className="text-sm font-normal text-white/60">/{subscription?.billing_cycle === 'annual' ? 'yr' : 'mo'}</span>}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-white/60 mb-0.5">
                                {(isTrialing || isTrialExtended) ? 'Trial Ends' : 'Renews On'}
                            </p>
                            <p className="text-lg font-bold">
                                {(isTrialing || isTrialExtended)
                                    ? formatDate(subscription?.trial_ends_at || null)
                                    : formatDate(subscription?.current_period_end || null)
                                }
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-white/60 mb-0.5">Billing Cycle</p>
                            <p className="text-lg font-bold capitalize">
                                {subscription?.billing_cycle || 'Monthly'}
                            </p>
                        </div>
                    </div>

                    {(isTrialing || isTrialExtended) && (
                        <div className="mt-4 p-3 rounded-xl bg-white/10 border border-white/20">
                            <div className="flex items-center gap-2">
                                <Sparkles className={`w-4 h-4 ${isTrialExtended ? 'text-violet-300' : 'text-yellow-300'}`} />
                                <span className="text-sm font-semibold">
                                    {daysLeftInTrial} days left in your {isTrialExtended ? 'extended ' : ''}free trial
                                </span>
                            </div>
                            <p className="text-xs text-white/70 mt-1">
                                {isTrialExtended
                                    ? 'Your trial has been extended! Support us by subscribing to a plan.'
                                    : 'Add a payment method or submit a testimonial to keep all features.'}
                            </p>
                        </div>
                    )}

                    {isPastDue && (
                        <div className="mt-4 p-3 rounded-xl bg-red-500/20 border border-red-400/30">
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-red-300" />
                                <span className="text-sm font-semibold text-red-100">
                                    Payment overdue — please update your payment method
                                </span>
                            </div>
                        </div>
                    )}

                    {isPaused && (
                        <div className="mt-4 p-3 rounded-xl bg-slate-800/40 border border-slate-600/50">
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-amber-400" />
                                <span className="text-sm font-semibold text-amber-100">
                                    Account Paused (Read-Only) — Subscribe to resume
                                </span>
                            </div>
                        </div>
                    )}

                    {isExpired && (
                        <div className="mt-4 p-3 rounded-xl bg-red-500/20 border border-red-400/30">
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-red-300" />
                                <span className="text-sm font-semibold text-red-100">
                                    Trial Expired — Upgrade to continue using all features
                                </span>
                            </div>
                            {dataDeletesAt && (
                                <p className="text-xs text-red-200/80 mt-1">
                                    Your data will be scheduled for deletion on {formatDate(dataDeletesAt)}. Upgrade now to keep all your data.
                                </p>
                            )}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap gap-3 mt-6">
                        <button
                            onClick={() => setShowUpgradeModal(true)}
                            className="px-5 py-2.5 bg-white text-slate-900 text-sm font-bold rounded-xl hover:shadow-lg transition-all duration-200 flex items-center gap-1.5"
                        >
                            <ArrowUpRight className="w-4 h-4" />
                            {(isTrialing || isTrialExtended) ? 'Upgrade Plan' : 'Change Plan'}
                        </button>

                        {canExtendTrial && !extensionRequest && !loadingRequest && (
                            <button
                                onClick={() => setShowTestimonialModal(true)}
                                className="px-5 py-2.5 bg-white/15 hover:bg-white/25 text-white text-sm font-semibold rounded-xl transition-all flex items-center gap-1.5 border border-white/20"
                            >
                                <FileText className="w-4 h-4" />
                                Extend Trial for Free
                            </button>
                        )}

                        {extensionRequest && extensionRequest.status === 'pending' && (
                            <div className="px-5 py-2.5 bg-white/10 text-white/80 text-sm font-medium rounded-xl border border-white/10 flex items-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Extension Request Pending
                            </div>
                        )}

                    </div>
                </div>
            </div>

            {/* Usage Overview */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-base font-bold text-slate-900">Usage Overview</h3>
                    <span className="text-xs text-slate-400">
                        <Calendar className="w-3.5 h-3.5 inline mr-1" />
                        Current billing period
                    </span>
                </div>
                <UsageOverview />
            </div>

            {/* Invoice History */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <Receipt className="w-4 h-4 text-slate-400" />
                        Invoice History
                    </h3>
                </div>
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <div className="p-8 text-center text-slate-400">
                        <Receipt className="w-10 h-10 mx-auto mb-3 text-slate-200" />
                        <p className="text-sm font-medium">No invoices yet</p>
                        <p className="text-xs text-slate-400 mt-1">
                            Invoices will appear here once you subscribe to a paid plan.
                        </p>
                    </div>
                </div>
            </div>

            {/* Upgrade Modal */}
            <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />

            {/* Testimonial Modal */}
            {showTestimonialModal && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowTestimonialModal(false)} />
                    <div className="relative min-h-full flex items-center justify-center p-4">
                        <div className="relative w-full max-w-2xl animate-in zoom-in-95 duration-300">
                            <button
                                onClick={() => setShowTestimonialModal(false)}
                                className="absolute -top-12 right-0 p-2 text-white/80 hover:text-white transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>
                            <TestimonialForm onSuccess={() => {
                                // Refresh request state
                                const fetchRequest = async () => {
                                    if (!hospital?.id) return;
                                    const data = await db.list('trial_extension_requests', {
                                        filters: [{ column: 'hospital_id', operator: 'eq', value: hospital.id }],
                                        limit: 1
                                    });
                                    setExtensionRequest(data?.[0] || null);
                                };
                                fetchRequest();
                            }} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
