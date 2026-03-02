import { useMemo } from 'react';
import { UsageMetrics } from '@/hooks/useSubscription';
import { useHospital } from '@/context/HospitalContext';
import { Building2, Users, ShoppingCart, Package } from 'lucide-react';

interface UsageMeterProps {
    /** Which metric to display */
    metric: keyof UsageMetrics;
    /** Optional label override */
    label?: string;
    /** Show compact version */
    compact?: boolean;
}

const METRIC_CONFIG: Record<keyof UsageMetrics, { label: string; icon: any; color: string; bgColor: string }> = {
    clinics_count: {
        label: 'Clinics',
        icon: Building2,
        color: 'text-blue-600',
        bgColor: 'bg-blue-500',
    },
    staff_count: {
        label: 'Staff Members',
        icon: Users,
        color: 'text-emerald-600',
        bgColor: 'bg-emerald-500',
    },
    monthly_sales: {
        label: 'Monthly Sales',
        icon: ShoppingCart,
        color: 'text-violet-600',
        bgColor: 'bg-violet-500',
    },
    inventory_items: {
        label: 'Inventory Items',
        icon: Package,
        color: 'text-amber-600',
        bgColor: 'bg-amber-500',
    },
};

export function UsageMeter({ metric, label, compact = false }: UsageMeterProps) {
    const { billing } = useHospital();
    const config = METRIC_CONFIG[metric];
    const Icon = config.icon;

    const current = billing.usage[metric];
    const max = billing.getLimit(metric);
    const percent = billing.getUsagePercent(metric);
    const isUnlimited = max === -1;
    const isNearLimit = percent >= 80 && !isUnlimited;
    const isAtLimit = percent >= 100 && !isUnlimited;

    const barColor = useMemo(() => {
        if (isAtLimit) return 'bg-red-500';
        if (isNearLimit) return 'bg-amber-500';
        return config.bgColor;
    }, [isAtLimit, isNearLimit, config.bgColor]);

    if (compact) {
        return (
            <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg ${config.bgColor}/10 flex items-center justify-center`}>
                    <Icon className={`w-4 h-4 ${config.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-slate-600">{label || config.label}</span>
                        <span className="text-xs font-bold text-slate-900">
                            {current}{isUnlimited ? '' : ` / ${max}`}
                        </span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                            style={{ width: isUnlimited ? '15%' : `${Math.min(100, percent)}%` }}
                        />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`p-4 rounded-xl border transition-all ${isAtLimit
                ? 'border-red-200 bg-red-50/50'
                : isNearLimit
                    ? 'border-amber-200 bg-amber-50/50'
                    : 'border-slate-200 bg-white'
            }`}>
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-xl ${config.bgColor}/10 flex items-center justify-center`}>
                        <Icon className={`w-4.5 h-4.5 ${config.color}`} />
                    </div>
                    <div>
                        <h4 className="text-sm font-semibold text-slate-900">{label || config.label}</h4>
                        <p className="text-xs text-slate-500">
                            {isUnlimited ? 'Unlimited' : `${max - current} remaining`}
                        </p>
                    </div>
                </div>
                <span className={`text-lg font-bold ${isAtLimit ? 'text-red-600' : isNearLimit ? 'text-amber-600' : 'text-slate-900'}`}>
                    {current}
                    {!isUnlimited && <span className="text-sm font-normal text-slate-400">/{max}</span>}
                </span>
            </div>

            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-700 ease-out ${barColor}`}
                    style={{ width: isUnlimited ? '10%' : `${Math.min(100, percent)}%` }}
                />
            </div>

            {isAtLimit && (
                <p className="text-xs text-red-600 font-medium mt-2 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    Limit reached — upgrade to add more
                </p>
            )}
            {isNearLimit && !isAtLimit && (
                <p className="text-xs text-amber-600 font-medium mt-2">
                    Approaching limit ({percent}% used)
                </p>
            )}
        </div>
    );
}

/** Grid of all 4 usage meters */
export function UsageOverview() {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <UsageMeter metric="clinics_count" />
            <UsageMeter metric="staff_count" />
            <UsageMeter metric="monthly_sales" />
            <UsageMeter metric="inventory_items" />
        </div>
    );
}
