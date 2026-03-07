import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Roles allowed to initiate checkout / plan changes
const BILLING_ROLES = ['HOSPITAL_ADMIN', 'ADMIN', 'SUPER_ADMIN', 'OWNER'];

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
        const authHeader = req.headers.get('Authorization');

        if (!authHeader) {
            console.error('Missing authorization header');
            return new Response(
                JSON.stringify({ error: 'Missing authorization header' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
        const userClient = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader } }
        });

        // Verify user
        const { data: { user }, error: authError } = await userClient.auth.getUser();
        if (authError || !user) {
            console.error('Auth User Error:', authError?.message || 'No user found');
            return new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        console.log('Authenticated User:', user.id, user.email);

        const body = await req.json();
        const { plan_slug, billing_cycle = 'monthly' } = body;
        console.log('Checkout for:', plan_slug, billing_cycle);

        if (!plan_slug) {
            return new Response(JSON.stringify({ error: 'plan_slug is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // Get user profile
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('hospital_id, role, full_name')
            .eq('id', user.id)
            .single();

        if (profileError || !profile?.hospital_id) {
            console.error('Profile/Hospital Link Error:', profileError?.message || 'No hospital');
            return new Response(JSON.stringify({ error: 'No hospital found' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        if (!BILLING_ROLES.includes(profile.role)) {
            console.warn('Forbidden access by role:', profile.role);
            return new Response(JSON.stringify({ error: 'Admins only' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // Get plan details
        const { data: plan, error: planError } = await supabaseAdmin
            .from('plans')
            .select('*')
            .eq('slug', plan_slug)
            .eq('is_active', true)
            .single();

        if (planError || !plan) {
            console.error('Plan Fetch Error:', planError?.message || 'Plan not found');
            return new Response(JSON.stringify({ error: 'Plan not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // For paid plans, create Razorpay order
        const RZP_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID');
        const RZP_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET');

        if (!RZP_KEY_ID || !RZP_KEY_SECRET) {
            // Fallback for demo/dev if keys aren't set
            console.warn('Razorpay keys not configured');
            return new Response(
                JSON.stringify({
                    error: 'Payment gateway not configured.',
                    demo_checkout: true,
                    message: 'Razorpay keys missing from Supabase Secrets'
                }),
                { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const { data: hospital } = await supabaseAdmin
            .from('hospitals')
            .select('name, contact_email')
            .eq('id', profile.hospital_id)
            .single();

        const amount = billing_cycle === 'annual' ? plan.price_annual_paise : plan.price_monthly_paise;
        const description = `MedFlow ${plan.name} Plan (${billing_cycle})`;

        const rzpAuth = btoa(`${RZP_KEY_ID}:${RZP_KEY_SECRET}`);
        const orderRes = await fetch('https://api.razorpay.com/v1/orders', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${rzpAuth}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                amount: amount,
                currency: 'INR',
                receipt: `receipt_${Date.now()}`,
                notes: {
                    hospital_id: profile.hospital_id,
                    plan_slug: plan_slug,
                    billing_cycle: billing_cycle,
                    user_id: user.id,
                },
            }),
        });

        if (!orderRes.ok) {
            const errorText = await orderRes.text();
            console.error('Razorpay Error:', errorText);
            return new Response(JSON.stringify({ error: 'Order creation failed', details: errorText }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const order = await orderRes.json();

        return new Response(
            JSON.stringify({
                key_id: RZP_KEY_ID,
                order_id: order.id,
                amount: order.amount,
                currency: order.currency,
                description: description,
                plan_slug: plan_slug,
                plan_name: plan.name,
                billing_cycle: billing_cycle,
                hospital_name: hospital?.name || '',
                hospital_email: hospital?.contact_email || user.email || '',
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    } catch (error: any) {
        console.error('Checkout error:', error);
        return new Response(
            JSON.stringify({ error: error.message || 'Internal server error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
