import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-razorpay-signature',
};

// Max payload size: 64KB (Razorpay payloads are typically <10KB)
const MAX_PAYLOAD_SIZE = 65536;
// Max webhook age: 5 minutes (300 seconds)
const MAX_EVENT_AGE_SECONDS = 300;

// ============================================================
// Timing-safe HMAC-SHA256 signature verification
// ============================================================
async function verifySignature(body: string, signature: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signed = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  const computed = Array.from(new Uint8Array(signed))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // Constant-time comparison
  if (computed.length !== signature.length) return false;
  let result = 0;
  for (let i = 0; i < computed.length; i++) {
    result |= computed.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return result === 0;
}

// Fire-and-forget email notification
async function sendBillingEmail(supabaseUrl: string, emailType: string, data: Record<string, any>) {
  try {
    await fetch(`${supabaseUrl}/functions/v1/send-billing-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email_type: emailType, data }),
    });
    console.log(`📧 Triggered ${emailType} email for hospital ${data.hospital_id}`);
  } catch (err) {
    console.warn(`⚠️ Failed to trigger ${emailType} email:`, err);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const RZP_WEBHOOK_SECRET = Deno.env.get('RAZORPAY_WEBHOOK_SECRET');
    if (!RZP_WEBHOOK_SECRET) {
      console.error('RAZORPAY_WEBHOOK_SECRET not configured');
      return new Response(JSON.stringify({ error: 'Webhook secret not configured' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ============================================================
    // FIX 1: Payload size limit (anti-DDoS)
    // ============================================================
    const contentLength = parseInt(req.headers.get('content-length') || '0');
    if (contentLength > MAX_PAYLOAD_SIZE) {
      console.warn(`❌ Oversized payload rejected: ${contentLength} bytes`);
      return new Response(JSON.stringify({ error: 'Payload too large' }), {
        status: 413,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const rawBody = await req.text();

    // Double-check actual size after reading
    if (rawBody.length > MAX_PAYLOAD_SIZE) {
      console.warn(`❌ Oversized body rejected: ${rawBody.length} chars`);
      return new Response(JSON.stringify({ error: 'Payload too large' }), {
        status: 413,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const signature = req.headers.get('x-razorpay-signature') || '';

    // Verify webhook signature (timing-safe)
    const isValid = await verifySignature(rawBody, signature, RZP_WEBHOOK_SECRET);
    if (!isValid) {
      console.error('❌ Invalid webhook signature');
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = JSON.parse(rawBody);
    const event = payload.event;
    const eventId = payload.event_id || payload.id || `${event}_${Date.now()}`;

    console.log(`✅ Webhook verified: ${event} (id: ${eventId})`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // ============================================================
    // FIX 2: Timestamp TTL — reject stale events
    // ============================================================
    const eventTimestamp = payload.created_at
      || payload.payload?.payment?.entity?.created_at
      || payload.payload?.subscription?.entity?.created_at;

    if (eventTimestamp) {
      const eventAge = Math.floor(Date.now() / 1000) - eventTimestamp;
      if (eventAge > MAX_EVENT_AGE_SECONDS) {
        console.warn(`⏰ Stale webhook rejected: event_id=${eventId}, age=${eventAge}s (max ${MAX_EVENT_AGE_SECONDS}s)`);
        return new Response(
          JSON.stringify({ error: 'Event too old', age_seconds: eventAge }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ============================================================
    // FIX 3: Event-level dedup (defense-in-depth)
    // ============================================================
    const { data: existingEvent } = await supabase
      .from('webhook_events_log')
      .select('razorpay_event_id')
      .eq('razorpay_event_id', eventId)
      .single();

    if (existingEvent) {
      console.log(`⏭️ Duplicate event ${eventId}, skipping`);
      return new Response(
        JSON.stringify({ received: true, duplicate: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log event as processed (before processing for crash safety)
    const { error: logError } = await supabase.from('webhook_events_log').insert({
      razorpay_event_id: eventId,
      event_type: event,
    });

    if (logError) {
      console.warn(`⚠️ Failed to log event (may be race duplicate): ${logError.message}`);
      // If it's a unique violation, another instance is handling it
      if (logError.code === '23505') {
        return new Response(
          JSON.stringify({ received: true, duplicate: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ============================================================
    // EVENT HANDLERS
    // ============================================================
    switch (event) {
      case 'payment.captured': {
        const payment = payload.payload.payment.entity;
        const notes = payment.notes || {};
        const hospitalId = notes.hospital_id;
        const planSlug = notes.plan_slug;
        const billingCycle = notes.billing_cycle || 'monthly';

        if (!hospitalId || !planSlug) {
          console.log('Missing hospital_id or plan_slug in payment notes, skipping');
          break;
        }

        // Atomic RPC (handles idempotency + transaction + FOR UPDATE SKIP LOCKED)
        const { data: result, error: rpcError } = await supabase.rpc('process_payment_captured', {
          p_hospital_id: hospitalId,
          p_plan_slug: planSlug,
          p_billing_cycle: billingCycle,
          p_razorpay_payment_id: payment.id,
          p_razorpay_subscription_id: payment.subscription_id || null,
          p_amount_paise: payment.amount,
        });

        if (rpcError) {
          console.error('❌ process_payment_captured RPC failed:', rpcError.message);
          return new Response(
            JSON.stringify({ error: 'Processing failed', details: rpcError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (result?.already_processed) {
          console.log(`⏭️ Payment ${payment.id} already processed, skipping`);
          break;
        }

        console.log(`✅ Payment captured: hospital=${hospitalId}, plan=${planSlug}, invoice=${result?.invoice_id}`);

        // Send upgrade email (fire-and-forget)
        const { data: hospital } = await supabase
          .from('hospitals')
          .select('name, email')
          .eq('id', hospitalId)
          .single();

        sendBillingEmail(supabaseUrl, 'subscription_upgraded', {
          hospital_id: hospitalId,
          hospital_name: hospital?.name || 'Your Hospital',
          email: hospital?.email,
          plan_name: result?.plan_name,
          subscription_id: result?.subscription_id,
        });
        break;
      }

      case 'payment.failed': {
        const payment = payload.payload.payment.entity;
        const notes = payment.notes || {};
        const hospitalId = notes.hospital_id;

        if (!hospitalId) {
          console.log('Missing hospital_id in payment.failed notes, skipping');
          break;
        }

        const { data: result, error: rpcError } = await supabase.rpc('process_payment_failed', {
          p_hospital_id: hospitalId,
          p_razorpay_payment_id: payment.id,
          p_error_code: payment.error_code || null,
          p_error_description: payment.error_description || null,
        });

        if (rpcError) {
          console.error('❌ process_payment_failed RPC failed:', rpcError.message);
        } else if (result?.skipped) {
          console.log(`⏭️ No active subscription for hospital ${hospitalId}`);
        } else {
          console.log(`⚠️ Payment failed: hospital=${hospitalId}`);
        }

        const { data: hospital } = await supabase
          .from('hospitals')
          .select('name, email')
          .eq('id', hospitalId)
          .single();

        sendBillingEmail(supabaseUrl, 'payment_failed', {
          hospital_id: hospitalId,
          hospital_name: hospital?.name || 'Your Hospital',
          email: hospital?.email,
          amount: `₹${(payment.amount / 100).toLocaleString('en-IN')}`,
          subscription_id: result?.subscription_id,
        });
        break;
      }

      case 'subscription.cancelled':
      case 'subscription.halted': {
        const sub = payload.payload.subscription.entity;
        const notes = sub.notes || {};
        const hospitalId = notes.hospital_id;

        if (!hospitalId) {
          console.log('Missing hospital_id in subscription event notes, skipping');
          break;
        }

        const { data: dbSub, error: subError } = await supabase
          .from('subscriptions')
          .select('id')
          .eq('hospital_id', hospitalId)
          .in('status', ['active', 'past_due', 'trialing'])
          .single();

        if (subError || !dbSub) {
          console.log(`No active subscription found for hospital ${hospitalId}`);
          break;
        }

        const { error: updateError } = await supabase
          .from('subscriptions')
          .update({ status: 'cancelled', updated_at: new Date().toISOString() })
          .eq('id', dbSub.id);

        if (updateError) console.error('❌ Subscription cancel failed:', updateError.message);

        const { error: eventError } = await supabase.from('subscription_events').insert({
          subscription_id: dbSub.id,
          event_type: 'cancelled',
          event_data: { razorpay_subscription_id: sub.id, reason: event },
        });

        if (eventError) console.error('❌ Cancel event insert failed:', eventError.message);

        const { error: hospitalError } = await supabase
          .from('hospitals')
          .update({ subscription_plan: 'Free' })
          .eq('id', hospitalId);

        if (hospitalError) console.error('❌ Hospital downgrade failed:', hospitalError.message);

        const { data: hospital } = await supabase
          .from('hospitals')
          .select('name, email')
          .eq('id', hospitalId)
          .single();

        sendBillingEmail(supabaseUrl, 'subscription_cancelled', {
          hospital_id: hospitalId,
          hospital_name: hospital?.name || 'Your Hospital',
          email: hospital?.email,
          subscription_id: dbSub.id,
        });

        console.log(`🔴 Subscription ${event} for hospital ${hospitalId}`);
        break;
      }

      default:
        console.log(`Unhandled webhook event: ${event}`);
    }

    return new Response(
      JSON.stringify({ received: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Webhook processing error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
