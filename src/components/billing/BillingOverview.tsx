import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
    Crown, TrendingUp, Users, CreditCard,
    AlertTriangle, CheckCircle2
} from 'lucide-react';

interface PlanDistribution {
    plan_name: string;
    slug: string;
    count: number;
    mrr_paise: number;
}

interface RevenueMetrics {
    total_mrr_paise: number;
    total_arr_paise: number;
    total_hospitals: number;
    paid_hospitals: number;
    free_hospitals: number;
    trial_hospitals: number;
    past_due_hospitals: number;
    plan_distribution: PlanDistribution[];
}

function formatRupees(paise: number): string {
    if (paise === 0) return '₹0';
    const amount = paise / 100;
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
    if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
    return `₹${amount.toLocaleString('en-IN')}`;
}

const PLAN_COLORS: Record<string, string> = {
    free: 'bg-slate-400',
    starter: 'bg-blue-500',
    professional: 'bg-violet-500',
    enterprise: 'bg-amber-500',
};

const PLAN_BG_COLORS: Record<string, string> = {
    free: 'bg-slate-50 text-slate-700 border-slate-200',
    starter: 'bg-blue-50 text-blue-700 border-blue-200',
    professional: 'bg-violet-50 text-violet-700 border-violet-200',
    enterprise: 'bg-amber-50 text-amber-700 border-amber-200',
};

export function BillingOverview() {
    const [metrics, setMetrics] = useState<RevenueMetrics | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchBillingMetrics();
    }, []);

    async function fetchBillingMetrics() {
        try {
            setLoading(true);

            // Fetch all subscriptions with their plans
            const { data: subscriptions } = await supabase
                .from('subscriptions')
                .select('*, plans(*)');

            if (!subscriptions) return;

            const planMap = new Map<string, PlanDistribution>();
            let totalMrr = 0;
            let paidCount = 0;
            let freeCount = 0;
            let trialCount = 0;
            let pastDueCount = 0;

            for (const sub of subscriptions) {
                const plan = sub.plans as any;
                if (!plan) continue;

                const slug = plan.slug;
                const planName = plan.name;

                // Calculate MRR contribution
                let monthlyAmount = 0;
                if (sub.status === 'active' || sub.status === 'past_due') {
                    monthlyAmount = sub.billing_cycle === 'annual'
                        ? Math.round(plan.price_annual_paise / 12)
                        : plan.price_monthly_paise;
                }

                // Update plan distribution
                const existing = planMap.get(slug) || {
                    plan_name: planName,
                    slug,
                    count: 0,
                    mrr_paise: 0,
                };
                existing.count++;
                existing.mrr_paise += monthlyAmount;
                planMap.set(slug, existing);

                totalMrr += monthlyAmount;

                // Status counts
                if (sub.status === 'trialing') trialCount++;
                else if (sub.status === 'past_due') pastDueCount++;
                else if (plan.price_monthly_paise === 0) freeCount++;
                else paidCount++;
            }

            setMetrics({
                total_mrr_paise: totalMrr,
                total_arr_paise: totalMrr * 12,
                total_hospitals: subscriptions.length,
                paid_hospitals: paidCount,
                free_hospitals: freeCount,
                trial_hospitals: trialCount,
                past_due_hospitals: pastDueCount,
                plan_distribution: Array.from(planMap.values()).sort((a, b) => {
                    const order = ['free', 'starter', 'professional', 'enterprise'];
                    return order.indexOf(a.slug) - order.indexOf(b.slug);
                }),
            });
        } catch (error) {
            console.error('Failed to fetch billing metrics:', error);
        } finally {
            setLoading(false);
        }
    }

    if (loading || !metrics) {
        return (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
                <div className="animate-pulse space-y-4">
                    <div className="h-6 bg-slate-200 rounded w-48" />
                    <div className="grid grid-cols-4 gap-4">
                        {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-slate-100 rounded-xl" />)}
                    </div>
                </div>
            </div>
        );
    }

    const totalBars = metrics.plan_distribution.reduce((s, p) => s + p.count, 0) || 1;

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-50 flex items-center justify-between">
                <div>
                    <h2 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                        <Crown className="w-5 h-5 text-violet-500" />
                        Revenue & Subscriptions
                    </h2>
                    <p className="text-xs text-gray-500 mt-1">Platform-wide billing overview</p>
                </div>
            </div>

            <div className="p-6 space-y-6">
                {/* Revenue KPIs */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl p-4 text-white">
                        <div className="flex items-center gap-1.5 mb-2">
                            <TrendingUp className="w-4 h-4 text-white/70" />
                            <span className="text-xs font-medium text-white/70">MRR</span>
                        </div>
                        <p className="text-2xl font-extrabold">{formatRupees(metrics.total_mrr_paise)}</p>
                        <p className="text-[10px] text-white/60 mt-1">ARR: {formatRupees(metrics.total_arr_paise)}</p>
                    </div>

                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                        <div className="flex items-center gap-1.5 mb-2">
                            <CreditCard className="w-4 h-4 text-emerald-500" />
                            <span className="text-xs font-medium text-slate-500">Paid</span>
                        </div>
                        <p className="text-2xl font-extrabold text-slate-900">{metrics.paid_hospitals}</p>
                        <p className="text-[10px] text-slate-400 mt-1">of {metrics.total_hospitals} hospitals</p>
                    </div>

                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                        <div className="flex items-center gap-1.5 mb-2">
                            <Users className="w-4 h-4 text-blue-500" />
                            <span className="text-xs font-medium text-slate-500">Trialing</span>
                        </div>
                        <p className="text-2xl font-extrabold text-slate-900">{metrics.trial_hospitals}</p>
                        <p className="text-[10px] text-slate-400 mt-1">active trials</p>
                    </div>

                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                        <div className="flex items-center gap-1.5 mb-2">
                            <AlertTriangle className={`w-4 h-4 ${metrics.past_due_hospitals > 0 ? 'text-red-500' : 'text-slate-300'}`} />
                            <span className="text-xs font-medium text-slate-500">Past Due</span>
                        </div>
                        <p className={`text-2xl font-extrabold ${metrics.past_due_hospitals > 0 ? 'text-red-600' : 'text-slate-900'}`}>
                            {metrics.past_due_hospitals}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1">failed payments</p>
                    </div>
                </div>

                {/* Plan Distribution */}
                <div>
                    <h3 className="text-sm font-bold text-slate-700 mb-3">Plan Distribution</h3>

                    {/* Visual bar */}
                    <div className="flex gap-0.5 h-3 rounded-full overflow-hidden bg-slate-100 mb-4">
                        {metrics.plan_distribution.map(p => (
                            <div
                                key={p.slug}
                                className={`${PLAN_COLORS[p.slug] || 'bg-slate-300'} transition-all duration-500`}
                                style={{ width: `${(p.count / totalBars) * 100}%` }}
                                title={`${p.plan_name}: ${p.count}`}
                            />
                        ))}
                    </div>

                    {/* Legend */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        {metrics.plan_distribution.map(p => (
                            <div
                                key={p.slug}
                                className={`rounded-xl border px-4 py-3 ${PLAN_BG_COLORS[p.slug] || 'bg-slate-50 border-slate-200 text-slate-700'}`}
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-bold">{p.plan_name}</span>
                                    <span className="text-lg font-extrabold">{p.count}</span>
                                </div>
                                {p.mrr_paise > 0 && (
                                    <p className="text-[10px] opacity-70">
                                        MRR: {formatRupees(p.mrr_paise)}
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Subscription Health */}
                <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                    <div className="flex-1">
                        <p className="text-sm font-semibold text-slate-800">Subscription Health</p>
                        <p className="text-xs text-slate-500">
                            {metrics.paid_hospitals + metrics.trial_hospitals} active subscriptions
                            {metrics.past_due_hospitals > 0 && ` · ${metrics.past_due_hospitals} need attention`}
                            {metrics.free_hospitals > 0 && ` · ${metrics.free_hospitals} on free tier`}
                        </p>
                    </div>
                    {metrics.past_due_hospitals > 0 ? (
                        <span className="px-3 py-1 text-xs font-bold bg-red-100 text-red-700 rounded-full">
                            {metrics.past_due_hospitals} Overdue
                        </span>
                    ) : (
                        <span className="px-3 py-1 text-xs font-bold bg-emerald-100 text-emerald-700 rounded-full">
                            All Clear
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
