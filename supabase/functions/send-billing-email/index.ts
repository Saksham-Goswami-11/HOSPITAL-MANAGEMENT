import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    if (!resendApiKey) {
      console.error('RESEND_API_KEY not configured');
      return new Response(JSON.stringify({ error: 'Email service not configured' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { email_type, data } = await req.json();
    const hospitalName = data.hospital_name || 'Your Hospital';
    const recipientEmail = data.email;

    if (!recipientEmail) {
      console.warn(`No recipient email provided for ${email_type}`);
      // return new Response(JSON.stringify({ error: 'No recipient email' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let subject = '';
    let html = '';

    switch (email_type) {
      case 'trial_expiry':
        subject = `⏳ Your MedFlow trial ends in ${Math.ceil(data.days_remaining)} days`;
        html = `
          <h1>Your Trial is Ending Soon</h1>
          <p>Hello ${hospitalName},</p>
          <p>Your 14-day free trial of MedFlow premium features will expire in <strong>${Math.ceil(data.days_remaining)} days</strong>.</p>
          <p>To avoid any disruption in your clinical operations, please upgrade to a paid plan.</p>
          <a href="${data.app_url || 'https://medflow.app'}/billing" style="background:#007bff;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;">Upgrade Now</a>
        `;
        break;
      case 'payment_failed':
        subject = `❌ Payment failed for ${hospitalName}`;
        html = `
          <h1>Payment Failed</h1>
          <p>Hello ${hospitalName},</p>
          <p>We were unable to process your payment of <strong>${data.amount}</strong> for your MedFlow subscription.</p>
          <p>Please update your payment method to keep your account active.</p>
          <a href="${data.app_url || 'https://medflow.app'}/billing" style="background:#dc3545;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;">Update Payment Method</a>
        `;
        break;
      case 'subscription_upgraded':
        subject = `🎉 Welcome to MedFlow ${data.plan_name}!`;
        html = `
          <h1>Subscription Upgraded</h1>
          <p>Hello ${hospitalName},</p>
          <p>Congratulations! Your hospital has been successfully upgraded to the <strong>${data.plan_name}</strong> plan.</p>
          <p>Your subscription ID is ${data.subscription_id}.</p>
          <p>Thank you for choosing MedFlow!</p>
        `;
        break;
      case 'subscription_cancelled':
        subject = `Your MedFlow plan has been downgraded`;
        html = `
          <h1>Subscription Cancelled</h1>
          <p>Hello ${hospitalName},</p>
          <p>Your MedFlow subscription has been cancelled and your account has been moved to the Free plan.</p>
          <p>Your data is safe, but some premium features may no longer be available.</p>
          <p>You can upgrade again at any time.</p>
        `;
        break;
      default:
        return new Response(
          JSON.stringify({ error: `Unknown email_type: ${email_type}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    // Send email via Resend API
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'MedFlow Billing <billing@medflow.app>',
        to: [recipientEmail || 'billing@aarogyanidhi.org'], // Fallback email
        subject: subject,
        html: html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Resend API error:', err);
      return new Response(JSON.stringify({ error: 'Failed to send email', details: err }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  } catch (error) {
    console.error('Email function error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
