import "functions-js-types";
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization');

    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('hospital_id, role')
      .eq('id', user.id)
      .single();

    if (!profile?.hospital_id) {
      return new Response(
        JSON.stringify({ error: 'No hospital found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const invoiceLimit = parseInt(url.searchParams.get('invoice_limit') || '10');
    const currentPeriod = url.searchParams.get('period') || 
      `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

    const [subsResult, plansResult, invoicesResult, usageResult, eventsResult] = await Promise.all([
      supabaseAdmin
        .from('subscriptions')
        .select('*, plans(*)')
        .eq('hospital_id', profile.hospital_id)
        .in('status', ['trialing', 'active', 'past_due'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),

      supabaseAdmin
        .from('plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order'),

      supabaseAdmin
        .from('invoices')
        .select('*')
        .eq('hospital_id', profile.hospital_id)
        .order('created_at', { ascending: false })
        .limit(invoiceLimit),

      supabaseAdmin
        .from('usage_metrics')
        .select('*')
        .eq('hospital_id', profile.hospital_id)
        .eq('period', currentPeriod),

      profile.role === 'SUPER_ADMIN' || profile.role === 'OWNER'
        ? supabaseAdmin
            .from('subscription_events')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(20)
        : supabaseAdmin
            .from('subscription_events')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(10),
    ]);

    const subscription = subsResult.data;
    const plan = subscription?.plans || null;

    const usageMap: Record<string, number> = {};
    if (usageResult.data) {
      for (const metric of usageResult.data) {
        usageMap[metric.metric_key] = metric.current_value;
      }
    }

    const isTrialing = subscription?.status === 'trialing';
    const isPastDue = subscription?.status === 'past_due';
    const trialDaysLeft = isTrialing && subscription?.trial_ends_at
      ? Math.max(0, Math.ceil((new Date(subscription.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : 0;

    return new Response(
      JSON.stringify({
        subscription: subscription ? {
          id: subscription.id,
          status: subscription.status,
          billing_cycle: subscription.billing_cycle,
          current_period_start: subscription.current_period_start,
          current_period_end: subscription.current_period_end,
          trial_ends_at: subscription.trial_ends_at,
          created_at: subscription.created_at,
        } : null,
        plan: plan ? {
          slug: plan.slug,
          name: plan.name,
          price_monthly_paise: plan.price_monthly_paise,
          price_annual_paise: plan.price_annual_paise,
          limits: plan.limits,
        } : null,
        all_plans: plansResult.data || [],
        invoices: invoicesResult.data || [],
        usage: usageMap,
        events: eventsResult.data || [],
        computed: {
          is_trialing: isTrialing,
          is_past_due: isPastDue,
          trial_days_left: trialDaysLeft,
          is_free: !plan || plan.slug === 'free',
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Billing portal error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
