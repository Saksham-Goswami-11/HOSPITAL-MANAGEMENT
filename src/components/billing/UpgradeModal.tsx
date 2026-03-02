import { useState } from 'react';
import { useHospital } from '@/context/HospitalContext';
import { useBillingActions } from '@/hooks/useBillingActions';
import { X, Check, ArrowRight, Sparkles, Crown, Zap, Loader2, Clock } from 'lucide-react';

interface UpgradeModalProps {
    isOpen: boolean;
    onClose: () => void;
    highlightPlan?: string; // slug to highlight
}

const PLAN_ICONS: Record<string, any> = {
    starter: Zap,
    professional: Sparkles,
    enterprise: Crown,
};

const PLAN_COLORS: Record<string, { gradient: string; badge: string; ring: string }> = {
    starter: {
        gradient: 'from-blue-500 to-blue-600',
        badge: 'bg-blue-100 text-blue-700',
        ring: 'ring-blue-200',
    },
    professional: {
        gradient: 'from-violet-500 to-purple-600',
        badge: 'bg-violet-100 text-violet-700',
        ring: 'ring-violet-300',
    },
    enterprise: {
        gradient: 'from-amber-500 to-orange-600',
        badge: 'bg-amber-100 text-amber-700',
        ring: 'ring-amber-200',
    },
};

const FEATURE_LIST = [
    { key: 'clinics', label: 'Clinics', getter: (l: any) => l.max_clinics === -1 ? 'Unlimited' : `Up to ${l.max_clinics}` },
    { key: 'staff', label: 'Staff Users', getter: (l: any) => l.max_staff === -1 ? 'Unlimited' : `Up to ${l.max_staff}` },
    { key: 'sales', label: 'Monthly Sales', getter: (l: any) => l.max_monthly_sales === -1 ? 'Unlimited' : `Up to ${l.max_monthly_sales?.toLocaleString()}` },
    { key: 'inventory', label: 'Inventory Items', getter: (l: any) => l.max_inventory_items === -1 ? 'Unlimited' : `Up to ${l.max_inventory_items?.toLocaleString()}` },
    { key: 'earnings', label: 'Earnings Dashboard', getter: (l: any) => l.features?.earnings_dashboard },
    { key: 'pdf', label: 'PDF Export', getter: (l: any) => l.features?.pdf_export },
    { key: 'payroll', label: 'Staff Payroll', getter: (l: any) => l.features?.staff_payroll },
    { key: 'ai', label: 'AI Insights', getter: (l: any) => l.features?.ai_insights },
    { key: 'exports', label: 'Data Exports', getter: (l: any) => l.features?.data_exports },
    { key: 'branding', label: 'Custom Branding', getter: (l: any) => l.features?.branding },
];

function formatPrice(paise: number) {
    if (paise === 0) return 'Free';
    const amount = paise / 100;
    return `₹${amount.toLocaleString('en-IN')}`;
}

function FeatureValue({ value }: { value: any }) {
    if (typeof value === 'boolean') {
        return value ? (
            <Check className="w-4 h-4 text-emerald-500" />
        ) : (
            <X className="w-3.5 h-3.5 text-slate-300" />
        );
    }
    if (typeof value === 'string') {
        if (value === 'false') return <X className="w-3.5 h-3.5 text-slate-300" />;
        return <span className="text-xs font-medium text-slate-700 capitalize">{value}</span>;
    }
    return <span className="text-xs font-medium text-slate-700">{value}</span>;
}

export function UpgradeModal({ isOpen, onClose, highlightPlan }: UpgradeModalProps) {
    const { billing } = useHospital();
    const { initiateCheckout, switchPlan, loading: checkoutLoading } = useBillingActions();
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
    const [activePlan, setActivePlan] = useState<string | null>(null);

    if (!isOpen) return null;

    const currentSlug = billing.plan?.slug || 'free';

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

            {/* Modal */}
            <div className="relative min-h-full flex items-center justify-center p-4">
                <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
                    {/* Header */}
                    <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-slate-100 px-6 py-4 flex items-center justify-between z-10 rounded-t-2xl">
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">Choose Your Plan</h2>
                            <p className="text-sm text-slate-500">Scale your hospital management as you grow</p>
                            {billing.isTrialing && (
                                <div className="mt-2 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-100 w-fit">
                                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                                    <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wide">
                                        Free Trial: {billing.daysLeftInTrial} {billing.daysLeftInTrial === 1 ? 'day' : 'days'} remaining
                                    </span>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-4">
                            {/* Billing cycle toggle */}
                            <div className="flex items-center bg-slate-100 rounded-xl p-1">
                                <button
                                    onClick={() => setBillingCycle('monthly')}
                                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${billingCycle === 'monthly'
                                        ? 'bg-white text-slate-900 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                >
                                    Monthly
                                </button>
                                <button
                                    onClick={() => setBillingCycle('annual')}
                                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 ${billingCycle === 'annual'
                                        ? 'bg-white text-slate-900 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                >
                                    Annual
                                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                                        -17%
                                    </span>
                                </button>
                            </div>
                            <button
                                onClick={onClose}
                                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors"
                            >
                                <X className="w-5 h-5 text-slate-400" />
                            </button>
                        </div>
                    </div>

                    {/* Plans Grid */}
                    <div className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {billing.allPlans.filter(p => p.is_active && p.slug !== 'free').map((plan) => {
                                const isCurrentPlan = plan.slug === currentSlug;
                                const isHighlighted = plan.slug === (highlightPlan || 'professional');
                                const colors = PLAN_COLORS[plan.slug] || PLAN_COLORS.starter;
                                const Icon = PLAN_ICONS[plan.slug] || Zap;
                                const price = billingCycle === 'monthly'
                                    ? plan.price_monthly_paise
                                    : Math.round(plan.price_annual_paise / 12);
                                const isEnterprise = plan.slug === 'enterprise';

                                return (
                                    <div
                                        key={plan.id}
                                        className={`relative rounded-2xl border-2 p-5 transition-all duration-300 flex flex-col ${isHighlighted
                                            ? `${colors.ring} ring-2 border-transparent shadow-lg scale-[1.02]`
                                            : 'border-slate-200 hover:border-slate-300'
                                            }`}
                                    >
                                        {/* Popular badge */}
                                        {isHighlighted && (
                                            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                                <span className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white rounded-full bg-gradient-to-r ${colors.gradient} shadow-md`}>
                                                    Most Popular
                                                </span>
                                            </div>
                                        )}

                                        {/* Plan header */}
                                        <div className="mb-4">
                                            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colors.gradient} flex items-center justify-center mb-3 shadow-sm`}>
                                                <Icon className="w-5 h-5 text-white" />
                                            </div>
                                            <h3 className="text-lg font-bold text-slate-900">{plan.name}</h3>
                                            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{plan.description}</p>
                                        </div>

                                        {/* Pricing */}
                                        <div className="mb-5">
                                            {isEnterprise ? (
                                                <div>
                                                    <div className="text-2xl font-bold text-slate-900">Custom</div>
                                                    <p className="text-xs text-slate-500 mt-1">Contact us for pricing</p>
                                                </div>
                                            ) : (
                                                <>
                                                    {/* MRP strikethrough */}
                                                    {(() => {
                                                        const mrp = billingCycle === 'monthly' ? plan.price_mrp_monthly_paise : Math.round(plan.price_mrp_annual_paise / 12);
                                                        const discount = mrp > 0 && price > 0 ? Math.round(((mrp - price) / mrp) * 100) : 0;
                                                        return mrp > 0 && discount > 0 ? (
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="text-sm text-slate-400 line-through">{formatPrice(mrp)}</span>
                                                                <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-md">{discount}% OFF</span>
                                                            </div>
                                                        ) : null;
                                                    })()}
                                                    <div className="flex items-baseline gap-1">
                                                        <span className="text-3xl font-extrabold text-slate-900">
                                                            {formatPrice(price)}
                                                        </span>
                                                        {price > 0 && (
                                                            <span className="text-sm text-slate-400">/mo</span>
                                                        )}
                                                    </div>
                                                    {billingCycle === 'annual' && plan.price_annual_paise > 0 && (
                                                        <p className="text-xs text-slate-500 mt-1">
                                                            Billed ₹{(plan.price_annual_paise / 100).toLocaleString('en-IN')}/year
                                                        </p>
                                                    )}
                                                </>
                                            )}
                                        </div>

                                        {/* Features */}
                                        <div className="space-y-2.5 flex-1">
                                            {FEATURE_LIST.map((feat) => {
                                                const val = feat.getter(plan.limits);
                                                return (
                                                    <div key={feat.key} className="flex items-center justify-between gap-2">
                                                        <span className="text-xs text-slate-600">{feat.label}</span>
                                                        <FeatureValue value={val} />
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* CTA */}
                                        <div className="mt-5 pt-4 border-t border-slate-100">
                                            {isCurrentPlan ? (
                                                <button disabled className={`w-full py-2.5 text-sm font-semibold rounded-xl ${billing.isTrialing ? 'bg-amber-50 text-amber-700 border-amber-100 border' : 'bg-slate-100 text-slate-400'} cursor-not-allowed flex items-center justify-center gap-1.5`}>
                                                    {billing.isTrialing && <Clock className="w-3.5 h-3.5" />}
                                                    {billing.isTrialing ? 'Trial Active' : 'Current Plan'}
                                                </button>
                                            ) : isEnterprise ? (
                                                <button className="w-full py-2.5 text-sm font-semibold rounded-xl border-2 border-amber-200 text-amber-700 hover:bg-amber-50 transition-colors flex items-center justify-center gap-1.5">
                                                    Contact Sales
                                                    <ArrowRight className="w-3.5 h-3.5" />
                                                </button>
                                            ) : (
                                                <button
                                                    disabled={checkoutLoading}
                                                    onClick={async () => {
                                                        setActivePlan(plan.slug);
                                                        if (plan.price_monthly_paise === 0) {
                                                            await switchPlan(plan.slug, billingCycle, onClose);
                                                        } else {
                                                            await initiateCheckout(plan.slug, billingCycle, onClose);
                                                        }
                                                        setActivePlan(null);
                                                    }}
                                                    className={`w-full py-2.5 text-sm font-semibold rounded-xl text-white bg-gradient-to-r ${colors.gradient} hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed`}
                                                >
                                                    {checkoutLoading && activePlan === plan.slug ? (
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                    ) : (
                                                        <>
                                                            {plan.sort_order > (billing.plan?.sort_order ?? 0) ? 'Upgrade' : 'Switch'} to {plan.name}
                                                            <ArrowRight className="w-3.5 h-3.5" />
                                                        </>
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="border-t border-slate-100 px-6 py-4 text-center">
                        <p className="text-xs text-slate-400">
                            All plans include POS & clinical billing. Prices exclude applicable taxes.
                            <br />
                            Need a custom plan? <button className="text-blue-600 hover:underline font-medium">Contact us</button>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
