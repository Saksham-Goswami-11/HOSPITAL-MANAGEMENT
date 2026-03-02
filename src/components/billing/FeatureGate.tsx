import { ReactNode } from 'react';
import { useHospital } from '@/context/HospitalContext';
import { PlanFeatures, UsageMetrics } from '@/hooks/useSubscription';
import { Lock, ArrowUpRight } from 'lucide-react';

interface FeatureGateProps {
    /** Which plan feature is required */
    feature?: keyof PlanFeatures;
    /** Or check a usage limit instead */
    usageMetric?: keyof UsageMetrics;
    /** Content to show when access is granted */
    children: ReactNode;
    /** Optional fallback when locked (defaults to built-in overlay) */
    fallback?: ReactNode;
    /** What plan slug is needed (for display purposes) */
    requiredPlan?: string;
    /** If true, renders nothing instead of the locked overlay */
    hideWhenLocked?: boolean;
    /** Callback when upgrade button is clicked */
    onUpgradeClick?: () => void;
}

/**
 * FeatureGate — wraps any component and locks it behind a plan requirement.
 * Works with both boolean features (e.g., `ai_insights`) and usage limits (e.g., `clinics_count`).
 */
export function FeatureGate({
    feature,
    usageMetric,
    children,
    fallback,
    requiredPlan = 'Starter',
    hideWhenLocked = false,
    onUpgradeClick,
}: FeatureGateProps) {
    const { billing } = useHospital();

    // Determine if feature is accessible
    let isLocked = false;

    if (feature) {
        isLocked = !billing.canUseFeature(feature);
    } else if (usageMetric) {
        isLocked = billing.isAtLimit(usageMetric);
    }

    // If accessible, just render children
    if (!isLocked) {
        return <>{children}</>;
    }

    // If explicitly hidden when locked
    if (hideWhenLocked) return null;

    // Custom fallback
    if (fallback) return <>{fallback}</>;

    // Default locked overlay
    return (
        <div className="relative group">
            {/* Blurred content preview */}
            <div className="pointer-events-none select-none blur-[2px] opacity-50 filter grayscale">
                {children}
            </div>

            {/* Lock overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-xl z-10">
                <div className="text-center p-6 max-w-sm">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-200/50">
                        <Lock className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-1">
                        {feature ? 'Premium Feature' : 'Limit Reached'}
                    </h3>
                    <p className="text-sm text-slate-500 mb-4">
                        {feature
                            ? `This feature is available on the ${requiredPlan} plan and above.`
                            : `You've reached the limit for your current plan. Upgrade to continue.`
                        }
                    </p>
                    <button
                        onClick={onUpgradeClick}
                        className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:shadow-lg hover:shadow-blue-200/50 transition-all duration-200 hover:-translate-y-0.5"
                    >
                        Upgrade Plan
                        <ArrowUpRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
