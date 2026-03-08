import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // 1. Authenticate the Admin calling this function
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        )

        const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
        if (authError || !user) throw new Error('Unauthorized')

        // 2. Verify Role is ADMIN (Double Check via DB)
        const { data: profile } = await supabaseClient
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()

        if (!profile || profile.role !== 'ADMIN') {
            throw new Error('Forbidden: Only Admins can register new clinics.')
        }

        // 3. Initialize Admin Client (Service Role) for privileged operations
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // 4. Parse Request Body
        const { clinicName, location, staffEmail, staffName, staffPassword } = await req.json()
        if (!clinicName || !staffEmail || !staffPassword) throw new Error('Missing required fields')

        // 5. Create Clinic
        const { data: clinic, error: clinicError } = await supabaseAdmin
            .from('clinics')
            .insert({ name: clinicName, location: location || 'Unknown' })
            .select()
            .single()

        if (clinicError) throw clinicError

        // 6. Create Staff User
        const { data: newUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
            email: staffEmail,
            password: staffPassword,
            email_confirm: true,
            user_metadata: {
                full_name: staffName,
                role: 'CLINIC_STAFF' // This triggers the handle_new_user trigger logic
            }
        })

        if (createUserError) throw createUserError

        // 7. Link User to Clinic (Update Profile)
        // The handle_new_user trigger creates the profile, but with NULL clinic_id. We must update it.
        // We wait briefly or just allow the update to fail/retry if race condition (but usually fast enough).
        // Better: Update directly.
        const { error: updateProfileError } = await supabaseAdmin
            .from('profiles')
            .update({ clinic_id: clinic.id, role: 'CLINIC_STAFF' })
            .eq('id', newUser.user.id)

        if (updateProfileError) throw updateProfileError

        return new Response(
            JSON.stringify({ message: 'Clinic & Staff Registered Successfully', clinic, user: newUser.user }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )

    } catch (error: any) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }
})
