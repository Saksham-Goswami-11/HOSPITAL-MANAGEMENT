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
        const authHeader = req.headers.get('Authorization');

        console.log('Incoming request:', req.method);
        console.log('Auth Header present:', !!authHeader);

        if (!authHeader) {
            console.error('No Authorization header provided');
            return new Response(
                JSON.stringify({ error: 'Unauthorized: No Auth Header' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
        const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
            global: { headers: { Authorization: authHeader } }
        });

        const { data: { user }, error: authError } = await userClient.auth.getUser();

        if (authError || !user) {
            console.error('Auth User Error:', authError?.message || 'No user found');
            return new Response(
                JSON.stringify({ error: `Unauthorized: ${authError?.message || 'Invalid Token'}` }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        console.log('Authenticated User:', user.id, user.email);

        const { action, hospitalId, requestId, approve, plan_slug, billing_cycle } = await req.json();
        console.log('Action:', action, 'Hospital:', hospitalId, 'Request:', requestId);

        // Get user profile
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('hospital_id, role')
            .eq('id', user.id)
            .single();

        if (profileError || !profile) {
            console.error('Profile Fetch Error:', profileError?.message || 'No profile');
            return new Response(
                JSON.stringify({ error: 'Profile not found' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        console.log('User Role:', profile.role);

        const isSuperAdmin = ['SUPER_ADMIN', 'OWNER'].includes(profile.role);
        const targetHospitalId = isSuperAdmin && hospitalId ? hospitalId : profile.hospital_id;

        if (!targetHospitalId) {
            return new Response(JSON.stringify({ error: 'Hospital ID not found' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // Permission check for sensitive actions
        if (['approve_trial_extension', 'approve_data_deletion', 'reject_data_deletion', 'pause', 'resume', 'delete_hospital'].includes(action) && !isSuperAdmin) {
            console.warn('Forbidden access attempt by:', user.email);
            return new Response(JSON.stringify({ error: 'Super Admin privileges required' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        switch (action) {
            case 'approve_trial_extension': {
                if (!requestId || !hospitalId) return new Response(JSON.stringify({ error: 'Missing parameters' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

                if (approve) {
                    // Get current trialing subscription
                    const { data: sub, error: subError } = await supabaseAdmin
                        .from('subscriptions')
                        .select('*')
                        .eq('hospital_id', hospitalId)
                        .eq('status', 'trialing')
                        .single();

                    if (subError || !sub) {
                        console.error('Subscription Fetch Error:', subError?.message || 'No sub found');
                        return new Response(JSON.stringify({ error: 'Trial subscription not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
                    }

                    // Get the extended_testing plan
                    const { data: extPlan } = await supabaseAdmin
                        .from('plans')
                        .select('id')
                        .eq('slug', 'extended_testing')
                        .single();

                    // Calculate new trial end (+8 days from current end)
                    const newEnd = new Date(sub.trial_ends_at || new Date());
                    newEnd.setDate(newEnd.getDate() + 8);

                    const { error: updateSubError } = await supabaseAdmin
                        .from('subscriptions')
                        .update({
                            trial_ends_at: newEnd.toISOString(),
                            status: 'trial_extended',
                            plan_id: extPlan?.id || sub.plan_id,
                        })
                        .eq('id', sub.id);

                    if (updateSubError) throw updateSubError;

                    // Update hospital subscription_plan field
                    await supabaseAdmin
                        .from('hospitals')
                        .update({ subscription_plan: 'extended_testing' })
                        .eq('id', hospitalId);

                    const { error: updateReqError } = await supabaseAdmin
                        .from('trial_extension_requests')
                        .update({ status: 'approved', reviewed_by: user.id, reviewed_at: new Date().toISOString() })
                        .eq('id', requestId);

                    if (updateReqError) throw updateReqError;

                    console.log('Trial extension approved for:', hospitalId, '→ extended_testing plan');
                    return new Response(JSON.stringify({ success: true, message: 'Trial extended by 8 days (Extended Testing plan)' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
                } else {
                    await supabaseAdmin
                        .from('trial_extension_requests')
                        .update({ status: 'rejected', reviewed_by: user.id, reviewed_at: new Date().toISOString() })
                        .eq('id', requestId);

                    console.log('Trial extension rejected for:', hospitalId);
                    return new Response(JSON.stringify({ success: true, message: 'Request rejected' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
                }
            }

            case 'approve_data_deletion': {
                if (!requestId || !hospitalId) return new Response(JSON.stringify({ error: 'Missing parameters' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

                // Approve the deletion request
                await supabaseAdmin
                    .from('data_deletion_requests')
                    .update({ status: 'approved', approved_by: user.id, approved_at: new Date().toISOString() })
                    .eq('id', requestId);

                // Delete the hospital and all cascaded data
                const { error: deleteError } = await supabaseAdmin
                    .from('hospitals')
                    .delete()
                    .eq('id', hospitalId);

                if (deleteError) throw deleteError;

                console.log('Data deletion approved and executed for hospital:', hospitalId);
                return new Response(JSON.stringify({ success: true, message: 'Hospital data permanently deleted' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }

            case 'reject_data_deletion': {
                if (!requestId) return new Response(JSON.stringify({ error: 'Missing requestId' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

                await supabaseAdmin
                    .from('data_deletion_requests')
                    .update({ status: 'rejected', approved_by: user.id, approved_at: new Date().toISOString() })
                    .eq('id', requestId);

                // Clear the deletion schedule on the subscription
                if (hospitalId) {
                    await supabaseAdmin
                        .from('subscriptions')
                        .update({ data_deletion_scheduled_at: null })
                        .eq('hospital_id', hospitalId);
                }

                return new Response(JSON.stringify({ success: true, message: 'Deletion request rejected' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }

            case 'pause': {
                const { error: updateError } = await supabaseAdmin
                    .from('subscriptions')
                    .update({
                        status: 'paused',
                        is_read_only: true,
                        paused_at: new Date().toISOString()
                    })
                    .eq('hospital_id', targetHospitalId);

                if (updateError) throw updateError;
                return new Response(JSON.stringify({ success: true, message: 'Subscription paused' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }

            case 'resume': {
                const { error: updateError } = await supabaseAdmin
                    .from('subscriptions')
                    .update({
                        status: 'active',
                        is_read_only: false,
                        paused_at: null
                    })
                    .eq('hospital_id', targetHospitalId)
                    .eq('status', 'paused');

                if (updateError) throw updateError;
                return new Response(JSON.stringify({ success: true, message: 'Subscription resumed' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }

            case 'delete_hospital': {
                // High risk permanent deletion
                const { error: deleteError } = await supabaseAdmin
                    .from('hospitals')
                    .delete()
                    .eq('id', hospitalId);

                if (deleteError) throw deleteError;
                return new Response(JSON.stringify({ success: true, message: 'Hospital permanently deleted' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }

            default:
                return new Response(
                    JSON.stringify({ error: `Unknown action: ${action}` }),
                    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
        }
    } catch (error: any) {
        console.error('Manage subscription error:', error);
        return new Response(
            JSON.stringify({ error: error.message || 'Internal server error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
