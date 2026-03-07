import { useState, useEffect, useCallback, useMemo } from 'react';
import { dataService as db } from '@/lib/dataService';

// ─── Types ───────────────────────────────────────────────────
export type PlanFeatures = {
    earnings_dashboard: boolean;
    pdf_export: boolean;
    staff_payroll: boolean | string; // false | "basic" | "full"
    audit_log_days: number;          // 7 | 30 | 90 | -1 (unlimited)
    ai_insights: boolean;
    data_exports: boolean;
    branding: boolean | string;      // false | "logo" | "full"
    priority_support: boolean | string;
};

export type PlanLimits = {
    max_clinics: number;
    max_staff: number;
    max_monthly_sales: number;
    max_inventory_items: number;
    features: PlanFeatures;
};

export type Plan = {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    price_monthly_paise: number;
    price_annual_paise: number;
    price_mrp_monthly_paise: number;
    price_mrp_annual_paise: number;
    limits: PlanLimits;
    is_active: boolean;
    sort_order: number;
};

export type Subscription = {
    id: string;
    hospital_id: string;
    plan_id: string;
    status: 'trialing' | 'trial_extended' | 'active' | 'past_due' | 'cancelled' | 'expired' | 'paused';
    billing_cycle: 'monthly' | 'annual';
    current_period_start: string | null;
    current_period_end: string | null;
    trial_ends_at: string | null;
    razorpay_subscription_id: string | null;
    razorpay_customer_id: string | null;
    is_read_only: boolean;
    paused_at: string | null;
    data_deletion_scheduled_at: string | null;
    metadata: Record<string, any>;
    created_at: string;
    updated_at: string;
    plans?: Plan;
};

export type UsageMetric = {
    metric_key: string;
    current_value: number;
    period: string;
};

export type UsageMetrics = {
    clinics_count: number;
    staff_count: number;
    monthly_sales: number;
    inventory_items: number;
};

export interface SubscriptionContextValue {
    // Data
    plan: Plan | null;
    allPlans: Plan[];
    subscription: Subscription | null;
    usage: UsageMetrics;
    limits: PlanLimits | null;
    loading: boolean;

    // Helpers
    canUseFeature: (feature: keyof PlanFeatures) => boolean;
    isAtLimit: (metric: keyof UsageMetrics) => boolean;
    getUsagePercent: (metric: keyof UsageMetrics) => number;
    getRemainingQuota: (metric: keyof UsageMetrics) => number;
    getLimit: (metric: keyof UsageMetrics) => number;

    // State helpers
    isTrialing: boolean;
    isTrialExtended: boolean;
    isExpired: boolean;
    isTestingPlan: boolean;
    isExtendedTestingPlan: boolean;
    daysLeftInTrial: number;
    isPastDue: boolean;
    isFree: boolean;
    isActive: boolean;
    isReadOnly: boolean;
    isPaused: boolean;
    canExtendTrial: boolean;
    dataDeletesAt: string | null;

    // Actions
    refreshSubscription: () => Promise<void>;
}

// ─── Limit Key Mapping ──────────────────────────────────────
const METRIC_TO_LIMIT_KEY: Record<keyof UsageMetrics, keyof PlanLimits> = {
    clinics_count: 'max_clinics',
    staff_count: 'max_staff',
    monthly_sales: 'max_monthly_sales',
    inventory_items: 'max_inventory_items',
};

// ─── Default Free Plan Limits (fallback) ────────────────────
const DEFAULT_LIMITS: PlanLimits = {
    max_clinics: 1,
    max_staff: 3,
    max_monthly_sales: 100,
    max_inventory_items: 50,
    features: {
        earnings_dashboard: false,
        pdf_export: false,
        staff_payroll: false,
        audit_log_days: 7,
        ai_insights: false,
        data_exports: false,
        branding: false,
        priority_support: false,
    },
};

// ─── Trial Limits (all features unlocked, generous limits) ──
const TRIAL_LIMITS: PlanLimits = {
    max_clinics: -1,
    max_staff: -1,
    max_monthly_sales: -1,
    max_inventory_items: -1,
    features: {
        earnings_dashboard: true,
        pdf_export: true,
        staff_payroll: 'full',
        audit_log_days: 90,
        ai_insights: true,
        data_exports: true,
        branding: 'full',
        priority_support: 'email_chat',
    },
};

const DEFAULT_USAGE: UsageMetrics = {
    clinics_count: 0,
    staff_count: 0,
    monthly_sales: 0,
    inventory_items: 0,
};

// ─── Hook ───────────────────────────────────────────────────
export function useSubscription(hospitalId: string | null | undefined): SubscriptionContextValue {
    const [plan, setPlan] = useState<Plan | null>(null);
    const [allPlans, setAllPlans] = useState<Plan[]>([]);
    const [subscription, setSubscription] = useState<Subscription | null>(null);
    const [usage, setUsage] = useState<UsageMetrics>(DEFAULT_USAGE);
    const [loading, setLoading] = useState(true);

    // Current period string for usage lookup
    const currentPeriod = useMemo(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }, []);

    const fetchSubscription = useCallback(async () => {
        if (!hospitalId) {
            setLoading(false);
            return;
        }

        try {
            // Parallel fetches using abstracted db service
            const [subData, plansData, usageData] = await Promise.all([
                // 1. Active subscription
                db.list('subscriptions', {
                    filters: [
                        { column: 'hospital_id', operator: 'eq', value: hospitalId },
                        { column: 'status', operator: 'in', value: ['trialing', 'trial_extended', 'active', 'past_due', 'expired'] }
                    ],
                    sort: { column: 'created_at', ascending: false },
                    limit: 1
                }),

                // 2. All available plans
                db.list('plans', {
                    filters: [{ column: 'is_active', operator: 'eq', value: true }],
                    sort: { column: 'sort_order', ascending: true }
                }),

                // 3. Usage metrics for current period
                db.list('usage_metrics', {
                    filters: [
                        { column: 'hospital_id', operator: 'eq', value: hospitalId },
                        { column: 'period', operator: 'eq', value: currentPeriod }
                    ]
                })
            ]);

            // Set subscription and plan
            if (subData && subData.length > 0) {
                const sub = subData[0];
                setSubscription(sub);

                // Fetch full plan details if needed (Supabase usually joins with select('*', plans(*)), but for DataService abstraction we might need to fetch separately if not handled)
                // Assuming DataService doesn't do joins automatically, let's fetch plan if sub has plan_id
                if (sub.plan_id) {
                    const planDetails = await db.get('plans', sub.plan_id);
                    setPlan(planDetails);
                }
            } else {
                setSubscription(null);
                setPlan(null);
            }

            // Set all plans
            if (plansData) {
                setAllPlans(plansData);
                // If no subscription, at least set the free plan
                if (!subData?.length && plansData.length > 0) {
                    const freePlan = plansData.find(p => p.slug === 'free');
                    if (freePlan) setPlan(freePlan);
                }
            }

            // Set usage metrics
            if (usageData) {
                const usageMap = { ...DEFAULT_USAGE };
                for (const metric of usageData as UsageMetric[]) {
                    if (metric.metric_key in usageMap) {
                        (usageMap as any)[metric.metric_key] = metric.current_value;
                    }
                }
                setUsage(usageMap);
            }
        } catch (err) {
            console.error('Error fetching subscription data:', err);
        } finally {
            setLoading(false);
        }
    }, [hospitalId, currentPeriod]);

    useEffect(() => {
        fetchSubscription();
    }, [fetchSubscription]);

    // ─── Derived Values ─────────────────────────────────────
    const isTrialing = subscription?.status === 'trialing';
    const isTrialExtended = subscription?.status === 'trial_extended';
    const isExpired = subscription?.status === 'expired';
    const isInTrial = isTrialing || isTrialExtended;
    const isPastDue = subscription?.status === 'past_due';
    const isPaused = subscription?.status === 'paused';
    const isFree = !plan;
    const isActive = subscription?.status === 'active' || isInTrial;
    const isReadOnly = subscription?.is_read_only === true || isPaused || isExpired;
    const canExtendTrial = isTrialing && !isTrialExtended;
    const dataDeletesAt = subscription?.data_deletion_scheduled_at || null;
    const isTestingPlan = plan?.slug === 'testing';
    const isExtendedTestingPlan = plan?.slug === 'extended_testing';

    // During trial, unlock ALL features with generous limits
    const limits = useMemo<PlanLimits | null>(() => {
        if (isInTrial) return TRIAL_LIMITS;
        if (!plan) return DEFAULT_LIMITS;
        return plan.limits || DEFAULT_LIMITS;
    }, [plan, isInTrial]);

    const daysLeftInTrial = useMemo(() => {
        if (!isInTrial || !subscription?.trial_ends_at) return 0;
        const trialEnd = new Date(subscription.trial_ends_at);
        const now = new Date();
        const diff = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return Math.max(0, diff);
    }, [isInTrial, subscription?.trial_ends_at]);

    // ─── Helper Methods ─────────────────────────────────────
    const canUseFeature = useCallback(
        (feature: keyof PlanFeatures): boolean => {
            if (!limits) return false;
            const val = limits.features[feature];
            return val !== false && val !== undefined;
        },
        [limits]
    );

    const getLimit = useCallback(
        (metric: keyof UsageMetrics): number => {
            if (!limits) return 0;
            const limitKey = METRIC_TO_LIMIT_KEY[metric];
            const val = (limits as any)[limitKey] as number;
            return val ?? 0;
        },
        [limits]
    );

    const isAtLimit = useCallback(
        (metric: keyof UsageMetrics): boolean => {
            const max = getLimit(metric);
            if (max === -1) return false;
            return usage[metric] >= max;
        },
        [usage, getLimit]
    );

    const getUsagePercent = useCallback(
        (metric: keyof UsageMetrics): number => {
            const max = getLimit(metric);
            if (max === -1) return 0;
            if (max === 0) return 100;
            return Math.min(100, Math.round((usage[metric] / max) * 100));
        },
        [usage, getLimit]
    );

    const getRemainingQuota = useCallback(
        (metric: keyof UsageMetrics): number => {
            const max = getLimit(metric);
            if (max === -1) return Infinity;
            return Math.max(0, max - usage[metric]);
        },
        [usage, getLimit]
    );

    return {
        plan,
        allPlans,
        subscription,
        usage,
        limits,
        loading,
        canUseFeature,
        isAtLimit,
        getUsagePercent,
        getRemainingQuota,
        getLimit,
        isTrialing,
        isTrialExtended,
        isExpired,
        isTestingPlan,
        isExtendedTestingPlan,
        daysLeftInTrial,
        isPastDue,
        isFree,
        isActive,
        isReadOnly,
        isPaused,
        canExtendTrial,
        dataDeletesAt,
        refreshSubscription: fetchSubscription,
    };
}
