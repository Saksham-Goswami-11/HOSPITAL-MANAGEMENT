
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { dataService as db } from '@/lib/dataService';
import {
    Check, X, ArrowRight, Sparkles, Crown,
    Zap, Star, Clock, Shield
} from 'lucide-react';

interface PlanData {
    id: string;
    slug: string;
    name: string;
    description: string;
    price_monthly_paise: number;
    price_annual_paise: number;
    price_mrp_monthly_paise: number;
    price_mrp_annual_paise: number;
    limits: any;
    sort_order: number;
}

const PLAN_ICONS: Record<string, any> = {
    starter: Zap,
    professional: Sparkles,
    enterprise: Crown,
};

const PLAN_GRADIENTS: Record<string, { from: string; to: string; bg: string; border: string; glow: string }> = {
    starter: {
        from: 'from-blue-500',
        to: 'to-blue-600',
        bg: 'bg-blue-50',
        border: 'border-blue-200 hover:border-blue-400',
        glow: 'bg-blue-400',
    },
    professional: {
        from: 'from-violet-500',
        to: 'to-purple-600',
        bg: 'bg-violet-50',
        border: 'border-violet-300 hover:border-violet-500',
        glow: 'bg-violet-400',
    },
    enterprise: {
        from: 'from-amber-500',
        to: 'to-orange-600',
        bg: 'bg-amber-50',
        border: 'border-amber-200 hover:border-amber-400',
        glow: 'bg-amber-400',
    },
    testing: {
        from: 'from-teal-500',
        to: 'to-cyan-600',
        bg: 'bg-teal-50',
        border: 'border-teal-200 hover:border-teal-400',
        glow: 'bg-teal-400',
    },
    extended_testing: {
        from: 'from-cyan-500',
        to: 'to-sky-600',
        bg: 'bg-cyan-50',
        border: 'border-cyan-200 hover:border-cyan-400',
        glow: 'bg-cyan-400',
    },
};

const FEATURE_LIST = [
    { label: 'Clinics', key: 'max_clinics' },
    { label: 'Staff Users', key: 'max_staff' },
    { label: 'Monthly Sales', key: 'max_monthly_sales' },
    { label: 'Inventory Items', key: 'max_inventory_items' },
    { label: 'Earnings Dashboard', key: 'features.earnings_dashboard' },
    { label: 'PDF Export', key: 'features.pdf_export' },
    { label: 'AI Insights', key: 'features.ai_insights' },
    { label: 'Data Exports', key: 'features.data_exports' },
    { label: 'Custom Branding', key: 'features.branding' },
];

function getLimitValue(limits: any, key: string): any {
    const parts = key.split('.');
    let val = limits;
    for (const p of parts) {
        val = val?.[p];
    }
    return val;
}

function formatLimit(val: any): string {
    if (val === -1 || val === true) return 'Unlimited';
    if (val === false || val === undefined || val === null) return '';
    if (typeof val === 'number') return val.toLocaleString('en-IN');
    if (typeof val === 'string' && val !== 'false') return val;
    return '';
}

function formatPrice(paise: number): string {
    if (paise === 0) return '₹0';
    return `₹${(paise / 100).toLocaleString('en-IN')}`;
}

function getDiscount(mrp: number, price: number): number {
    if (mrp <= 0 || price <= 0) return 0;
    return Math.round(((mrp - price) / mrp) * 100);
}

const PricingSection: React.FC = () => {
    const [plans, setPlans] = useState<PlanData[]>([]);
    const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPlans = async () => {
            try {
                const data = await db.list('plans', {
                    filters: { is_active: true },
                    sort: { column: 'sort_order' }
                });
                setPlans(data || []);
            } catch (error) {
                console.error('Error fetching plans:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchPlans();
    }, []);

    if (loading) {
        return (
            <section id="pricing" className="py-24 bg-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <div className="h-10 bg-slate-200 rounded-xl w-96 mx-auto animate-pulse" />
                        <div className="h-5 bg-slate-100 rounded-lg w-64 mx-auto mt-4 animate-pulse" />
                    </div>
                    <div className="grid md:grid-cols-3 gap-8">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-[500px] bg-slate-50 rounded-[2rem] animate-pulse" />
                        ))}
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section id="pricing" className="py-24 bg-white relative overflow-hidden">
            {/* Background decorative elements */}
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-100 rounded-full opacity-20 blur-3xl -translate-y-1/2" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-100 rounded-full opacity-20 blur-3xl translate-y-1/2" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
                {/* Header */}
                <div className="text-center mb-16">
                    <div className="inline-flex items-center gap-2 bg-violet-100 text-violet-700 px-4 py-1.5 rounded-full text-sm font-bold mb-4">
                        <Star className="w-4 h-4" />
                        Simple, Transparent Pricing
                    </div>
                    <h2 className="text-3xl md:text-5xl font-extrabold text-slate-900 mb-4 tracking-tight">
                        Plans That Scale With You
                    </h2>
                    <p className="text-slate-600 max-w-2xl mx-auto text-lg font-medium">
                        Start with a 7-day free trial — all features unlocked. No credit card required.
                    </p>

                    {/* Trial highlight */}
                    <div className="inline-flex items-center gap-3 bg-emerald-50 border border-emerald-200 text-emerald-700 px-5 py-2.5 rounded-2xl text-sm font-semibold mt-6">
                        <Clock className="w-4 h-4" />
                        <span>7-day free trial with <strong>all features</strong> unlocked</span>
                        <span className="text-emerald-500">•</span>
                        <Shield className="w-4 h-4" />
                        <span>No credit card needed</span>
                    </div>

                    {/* Billing toggle */}
                    <div className="flex items-center justify-center gap-3 mt-8">
                        <button
                            onClick={() => setBilling('monthly')}
                            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${billing === 'monthly'
                                ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/25'
                                : 'bg-slate-100 text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            Monthly
                        </button>
                        <button
                            onClick={() => setBilling('annual')}
                            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${billing === 'annual'
                                ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/25'
                                : 'bg-slate-100 text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            Annual
                            <span className="text-[10px] font-bold bg-emerald-400 text-white px-2 py-0.5 rounded-md">
                                Save 17%
                            </span>
                        </button>
                    </div>
                </div>

                {/* Plans Grid */}
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-5 max-w-5xl mx-auto">
                    {plans.filter(p => !['testing', 'extended_testing'].includes(p.slug)).map((plan) => {
                        const style = PLAN_GRADIENTS[plan.slug] || PLAN_GRADIENTS.starter;
                        const Icon = PLAN_ICONS[plan.slug] || Zap;
                        const isPro = plan.slug === 'professional';
                        const isEnterprise = plan.slug === 'enterprise';

                        const price = billing === 'monthly'
                            ? plan.price_monthly_paise
                            : Math.round(plan.price_annual_paise / 12);
                        const mrpPrice = billing === 'monthly'
                            ? plan.price_mrp_monthly_paise
                            : Math.round(plan.price_mrp_annual_paise / 12);
                        const discount = getDiscount(mrpPrice, price);

                        return (
                            <div
                                key={plan.id}
                                className={`relative rounded-[2rem] border-2 ${style.border} ${isPro ? 'ring-2 ring-violet-300 shadow-2xl shadow-violet-200/40 scale-[1.03] lg:scale-105' : 'shadow-lg shadow-slate-200/50'
                                    } bg-white flex flex-col overflow-hidden hover:-translate-y-2 transition-all duration-500 group`}
                            >
                                {/* Popular badge */}
                                {isPro && (
                                    <div className="absolute -top-0 left-0 right-0">
                                        <div className={`bg-gradient-to-r ${style.from} ${style.to} text-white text-center py-2 text-xs font-bold uppercase tracking-widest`}>
                                            ✦ Most Popular
                                        </div>
                                    </div>
                                )}

                                <div className={`p-6 sm:p-8 flex flex-col flex-1 ${isPro ? 'pt-12' : ''}`}>
                                    {/* Icon + Name */}
                                    <div className="relative mb-6 flex items-center gap-3">
                                        <div className="relative">
                                            <div className={`absolute inset-0 ${style.glow} opacity-20 blur-xl rounded-full group-hover:opacity-40 transition-opacity duration-300`} />
                                            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${style.from} ${style.to} flex items-center justify-center shadow-md relative transform group-hover:rotate-6 transition-transform duration-300`}>
                                                <Icon className="w-6 h-6 text-white" />
                                            </div>
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold text-slate-900">{plan.name}</h3>
                                            <p className="text-xs text-slate-500 line-clamp-1">{plan.description}</p>
                                        </div>
                                    </div>

                                    {/* Price */}
                                    <div className="mb-6">
                                        {isEnterprise ? (
                                            <div>
                                                <div className="text-3xl font-extrabold text-slate-900">Custom</div>
                                                <p className="text-xs text-slate-500 mt-1">
                                                    Tailored pricing for your organization
                                                </p>
                                            </div>
                                        ) : (
                                            <>
                                                {/* MRP strikethrough */}
                                                {mrpPrice > 0 && discount > 0 && (
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-sm text-slate-400 line-through font-medium">
                                                            {formatPrice(mrpPrice)}/mo
                                                        </span>
                                                        <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md">
                                                            {discount}% OFF
                                                        </span>
                                                    </div>
                                                )}
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-4xl font-extrabold text-slate-900">
                                                        {formatPrice(price)}
                                                    </span>
                                                    {price > 0 && (
                                                        <span className="text-sm text-slate-400 font-medium">/month</span>
                                                    )}
                                                </div>
                                                {billing === 'annual' && plan.price_annual_paise > 0 && (
                                                    <p className="text-xs text-slate-500 mt-1">
                                                        Billed ₹{(plan.price_annual_paise / 100).toLocaleString('en-IN')}/year
                                                    </p>
                                                )}
                                            </>
                                        )}
                                    </div>

                                    {/* Features */}
                                    <ul className="space-y-3 flex-1 mb-6">
                                        {FEATURE_LIST.map((feat) => {
                                            const val = getLimitValue(plan.limits, feat.key);
                                            const formatted = formatLimit(val);
                                            const isAvailable = val !== false && val !== undefined && val !== null && val !== 0 && val !== 'false';

                                            return (
                                                <li key={feat.key} className="flex items-center gap-2.5">
                                                    {isAvailable ? (
                                                        <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                                                    ) : (
                                                        <X className="w-4 h-4 text-slate-300 shrink-0" />
                                                    )}
                                                    <span className={`text-sm ${isAvailable ? 'text-slate-700 font-medium' : 'text-slate-400'}`}>
                                                        {formatted ? `${formatted} ${feat.label}` : feat.label}
                                                    </span>
                                                </li>
                                            );
                                        })}
                                    </ul>

                                    {/* CTA */}
                                    <Link
                                        to={isEnterprise ? '/login' : `/register?plan=${plan.slug}&billing=${billing}`}
                                        className={`w-full py-3.5 rounded-xl font-bold text-center transition-all duration-300 flex items-center justify-center gap-2 group/btn ${isPro
                                            ? `bg-gradient-to-r ${style.from} ${style.to} text-white shadow-lg shadow-violet-500/25 hover:shadow-xl hover:shadow-violet-500/40 hover:-translate-y-0.5`
                                            : isEnterprise
                                                ? 'border-2 border-amber-300 text-amber-700 hover:bg-amber-50 hover:shadow-lg'
                                                : 'border-2 border-slate-200 text-slate-700 hover:border-primary hover:text-primary hover:shadow-lg hover:shadow-primary/10'
                                            }`}
                                    >
                                        {isEnterprise ? 'Contact Us' : 'Start 7-Day Free Trial'}
                                        <ArrowRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
                                    </Link>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Footer note */}
                <div className="text-center mt-12">
                    <p className="text-sm text-slate-500">
                        All plans include POS & clinical billing. Prices exclude applicable GST.
                        <br />
                        Need a custom deployment? <Link to="/login" className="text-primary font-bold hover:underline">Talk to our team</Link>
                    </p>
                </div>
            </div>
        </section>
    );
};

export default PricingSection;
