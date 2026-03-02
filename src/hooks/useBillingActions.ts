import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';

/**
 * useBillingActions — provides functions to interact with billing Edge Functions.
 * Handles checkout creation, subscription management, and Razorpay integration.
 * 
 * Razorpay Checkout.js is loaded lazily when needed.
 * If Razorpay keys aren't configured yet, shows a friendly 503 message.
 */
export function useBillingActions() {
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    /**
     * Open Razorpay checkout for a plan upgrade
     */
    const initiateCheckout = async (
        planSlug: string,
        billingCycle: 'monthly' | 'annual' = 'monthly',
        onSuccess?: () => void
    ) => {
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                toast({ title: 'Session expired', description: 'Please log in again.', variant: 'destructive' });
                return;
            }

            // Call create-checkout Edge Function
            const res = await supabase.functions.invoke('create-checkout', {
                body: { plan_slug: planSlug, billing_cycle: billingCycle },
            });

            if (res.error) {
                throw new Error(res.error.message || 'Checkout failed');
            }

            const checkout = res.data;

            // If gateway returns 503 (not configured), show friendly message
            if (checkout.error && checkout.error.includes('not configured')) {
                toast({
                    title: 'Payment Gateway Setup Pending',
                    description: 'Razorpay integration is being set up. Your plan change has been noted and will be activated once payments are configured.',
                });
                return;
            }

            if (checkout.error) {
                throw new Error(checkout.error);
            }

            // If it was a free plan switch (handled server-side), reload
            if (checkout.success) {
                toast({ title: 'Plan Updated!', description: checkout.message });
                onSuccess?.();
                // Reload to refresh subscription data
                window.location.reload();
                return;
            }

            // Load Razorpay if not already loaded
            if (!(window as any).Razorpay) {
                await loadRazorpayScript();
            }

            if (!(window as any).Razorpay) {
                toast({
                    title: 'Payment gateway unavailable',
                    description: 'Could not load Razorpay. Please try again or contact support.',
                    variant: 'destructive',
                });
                return;
            }

            // Open Razorpay checkout modal
            const rzp = new (window as any).Razorpay({
                key: checkout.key_id,
                amount: checkout.amount,
                currency: checkout.currency,
                name: 'MedFlow',
                description: checkout.description,
                order_id: checkout.order_id,
                prefill: {
                    name: checkout.hospital_name,
                    email: checkout.hospital_email,
                },
                notes: {
                    plan_slug: checkout.plan_slug,
                    billing_cycle: checkout.billing_cycle,
                },
                theme: {
                    color: '#7c3aed', // violet-600
                },
                handler: function () {
                    // Payment successful (also handled by webhook)
                    toast({ title: '🎉 Payment Successful!', description: `You've been upgraded to the ${checkout.plan_name} plan.` });
                    onSuccess?.();
                    // Reload after a short delay to let webhook process
                    setTimeout(() => window.location.reload(), 2000);
                },
                modal: {
                    ondismiss: function () {
                        toast({ title: 'Payment cancelled', description: 'No charges were made.' });
                    },
                },
            });

            rzp.open();
        } catch (error: any) {
            console.error('Checkout error:', error);
            toast({
                title: 'Checkout Error',
                description: error.message || 'Something went wrong. Please try again.',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    /**
     * Cancel the current subscription (downgrades to Free)
     */
    const cancelSubscription = async (onSuccess?: () => void) => {
        setLoading(true);
        try {
            const res = await supabase.functions.invoke('manage-subscription', {
                body: { action: 'cancel' },
            });

            if (res.error) throw new Error(res.error.message);
            if (res.data?.error) throw new Error(res.data.error);

            toast({ title: 'Subscription Cancelled', description: res.data.message || 'Your plan has been downgraded to Free.' });
            onSuccess?.();
            setTimeout(() => window.location.reload(), 1000);
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    /**
     * Switch to a different plan (direct switch, for free/admin use)
     */
    const switchPlan = async (planSlug: string, billingCycle?: string, onSuccess?: () => void) => {
        setLoading(true);
        try {
            const res = await supabase.functions.invoke('manage-subscription', {
                body: { action: 'switch_plan', plan_slug: planSlug, billing_cycle: billingCycle },
            });

            if (res.error) throw new Error(res.error.message);
            if (res.data?.error) throw new Error(res.data.error);

            toast({ title: 'Plan Updated', description: res.data.message });
            onSuccess?.();
            setTimeout(() => window.location.reload(), 1000);
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    return {
        loading,
        initiateCheckout,
        cancelSubscription,
        switchPlan,
    };
}

/**
 * Dynamically load Razorpay Checkout.js script
 */
function loadRazorpayScript(): Promise<void> {
    return new Promise((resolve, reject) => {
        if ((window as any).Razorpay) {
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Razorpay'));
        document.body.appendChild(script);
    });
}
