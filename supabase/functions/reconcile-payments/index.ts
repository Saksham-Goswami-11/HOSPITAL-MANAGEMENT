import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * reconcile-payments
 * 
 * Scheduled cron job (or manual trigger) that polls Razorpay for
 * recent "captured" payments and reconciles them against our DB.
 * Catches "ghost payments" where money was deducted but webhook failed.
 * 
 * Called by pg_cron: SELECT net.http_post(...) every 15 minutes.
 */
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const RZP_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID');
    const RZP_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET');

    if (!RZP_KEY_ID || !RZP_KEY_SECRET) {
      return new Response(
        JSON.stringify({ error: 'Razorpay keys not configured' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const rzpAuth = btoa(`${RZP_KEY_ID}:${RZP_KEY_SECRET}`);

    // Fetch payments captured in the last 2 hours from Razorpay
    const fromTimestamp = Math.floor((Date.now() - 2 * 60 * 60 * 1000) / 1000);
    const toTimestamp = Math.floor(Date.now() / 1000);

    const rzpRes = await fetch(
      `https://api.razorpay.com/v1/payments?from=${fromTimestamp}&to=${toTimestamp}&count=100`,
      {
        headers: { 'Authorization': `Basic ${rzpAuth}` },
      }
    );

    if (!rzpRes.ok) {
      const errBody = await rzpRes.text();
      console.error('Razorpay API error:', rzpRes.status, errBody);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch payments from Razorpay' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rzpData = await rzpRes.json();
    const payments = rzpData.items || [];

    let reconciled = 0;
    let skipped = 0;
    let errors = 0;

    for (const payment of payments) {
      // Only process captured payments with our notes
      if (payment.status !== 'captured') {
        skipped++;
        continue;
      }

      const notes = payment.notes || {};
      const hospitalId = notes.hospital_id;
      const planSlug = notes.plan_slug;
      const billingCycle = notes.billing_cycle || 'monthly';

      if (!hospitalId || !planSlug) {
        skipped++;
        continue;
      }

      // Check if we already have an invoice for this payment
      const { data: existingInvoice } = await supabase
        .from('invoices')
        .select('id')
        .eq('razorpay_payment_id', payment.id)
        .single();

      if (existingInvoice) {
        skipped++;
        continue;
      }

      // GHOST PAYMENT FOUND — webhook missed this!
      console.warn(`🔄 Ghost payment detected: ${payment.id} for hospital ${hospitalId}`);

      // Use the same atomic RPC as the webhook
      const { data: result, error: rpcError } = await supabase.rpc('process_payment_captured', {
        p_hospital_id: hospitalId,
        p_plan_slug: planSlug,
        p_billing_cycle: billingCycle,
        p_razorpay_payment_id: payment.id,
        p_razorpay_subscription_id: payment.subscription_id || null,
        p_amount_paise: payment.amount,
      });

      if (rpcError) {
        console.error(`❌ Reconciliation failed for ${payment.id}:`, rpcError.message);
        errors++;
      } else if (result?.already_processed) {
        skipped++;
      } else {
        console.log(`✅ Reconciled ghost payment: ${payment.id} → plan ${planSlug}`);

        // Log as reconciliation event
        if (result?.subscription_id) {
          await supabase.from('subscription_events').insert({
            subscription_id: result.subscription_id,
            event_type: 'reconciled',
            event_data: {
              razorpay_payment_id: payment.id,
              method: 'cron_reconciliation',
              plan_slug: planSlug,
            },
          });
        }

        reconciled++;
      }
    }

    const summary = {
      total_payments_checked: payments.length,
      reconciled,
      skipped,
      errors,
      timestamp: new Date().toISOString(),
    };

    console.log('Reconciliation complete:', JSON.stringify(summary));

    return new Response(
      JSON.stringify(summary),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Reconciliation error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
