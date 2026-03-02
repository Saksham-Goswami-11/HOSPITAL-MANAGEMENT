import { useState } from 'react';
import { useHospital } from '@/context/HospitalContext';
import { X, Sparkles, AlertTriangle, CreditCard, ArrowUpRight, FileText, ShieldAlert } from 'lucide-react';

/**
 * TrialBanner — shows a countdown banner during the free trial period.
 * Includes CTA for trial extension via testimonial.
 */
export function TrialBanner({ onExtendClick, onUpgradeClick }: { onExtendClick?: () => void, onUpgradeClick?: () => void }) {
    const { billing } = useHospital();
    const [dismissed, setDismissed] = useState(false);

    if ((!billing.isTrialing && !billing.isTrialExtended) || dismissed) return null;

    const isUrgent = billing.daysLeftInTrial <= 3;

    return (
        <div className={`${isUrgent
            ? 'bg-gradient-to-r from-amber-500 to-orange-500'
            : 'bg-gradient-to-r from-blue-500 to-indigo-500'
            } text-white px-4 py-2.5 text-center text-sm relative`}>
            <div className="flex items-center justify-center gap-2 flex-wrap">
                <Sparkles className="w-4 h-4" />
                <span className="font-semibold">
                    {isUrgent ? '⏰ ' : ''}
                    {billing.daysLeftInTrial} day{billing.daysLeftInTrial !== 1 ? 's' : ''} left in your {billing.isTrialExtended ? 'extended ' : ''}free trial
                </span>
                <span className="hidden sm:inline text-white/80">
                    — Upgrade now to keep all your features
                </span>
                <div className="flex items-center gap-2 ml-2">
                    <button
                        onClick={onUpgradeClick}
                        className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                    >
                        Upgrade
                        <ArrowUpRight className="w-3 h-3" />
                    </button>
                    {billing.canExtendTrial && onExtendClick && (
                        <button
                            onClick={onExtendClick}
                            className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 border border-white/20"
                        >
                            <FileText className="w-3 h-3" />
                            Extend for free
                        </button>
                    )}
                </div>
            </div>
            <button
                onClick={() => setDismissed(true)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    );
}

/**
 * PastDueBanner — shows a warning when payment has failed.
 * Cannot be dismissed (requires action).
 */
export function PastDueBanner({ onUpgradeClick }: { onUpgradeClick?: () => void }) {
    const { billing } = useHospital();

    if (!billing.isPastDue) return null;

    return (
        <div className="bg-gradient-to-r from-red-500 to-rose-600 text-white px-4 py-3 text-center text-sm">
            <div className="flex items-center justify-center gap-2 flex-wrap">
                <AlertTriangle className="w-4 h-4" />
                <span className="font-semibold">
                    Payment failed — your account may be restricted soon
                </span>
                <button
                    onClick={onUpgradeClick}
                    className="ml-2 px-3 py-1.5 bg-white text-red-600 rounded-lg text-xs font-bold hover:shadow-lg transition-all flex items-center gap-1"
                >
                    <CreditCard className="w-3 h-3" />
                    Update Payment Method
                </button>
            </div>
        </div>
    );
}

/**
 * ReadOnlyBanner — shows when subscription is paused/expired and account is read-only.
 * Cannot be dismissed.
 */
export function ReadOnlyBanner({ onUpgradeClick }: { onUpgradeClick?: () => void }) {
    const { billing } = useHospital();

    if (!billing.isReadOnly) return null;

    const daysUntilDeletion = billing.dataDeletesAt
        ? Math.max(0, Math.ceil((new Date(billing.dataDeletesAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : null;

    return (
        <div className="bg-gradient-to-r from-slate-700 to-slate-800 text-white px-4 py-3 text-center text-sm">
            <div className="flex items-center justify-center gap-2 flex-wrap">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                <span className="font-semibold">
                    Your account is in read-only mode — subscribe to a plan to continue using MedFlow
                </span>
                {daysUntilDeletion !== null && (
                    <span className="text-amber-300 font-bold">
                        • Data will be removed in {daysUntilDeletion} day{daysUntilDeletion !== 1 ? 's' : ''}
                    </span>
                )}
                <button
                    onClick={onUpgradeClick}
                    className="ml-2 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                >
                    <ArrowUpRight className="w-3 h-3" />
                    Upgrade Now
                </button>
            </div>
        </div>
    );
}
