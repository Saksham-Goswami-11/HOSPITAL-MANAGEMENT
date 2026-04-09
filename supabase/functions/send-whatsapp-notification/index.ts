import "functions-js-types";

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
    const gatewayUrl = Deno.env.get('WHATSAPP_GATEWAY_URL');

    if (!gatewayUrl) {
      console.error('WHATSAPP_GATEWAY_URL not configured');
      return new Response(JSON.stringify({ error: 'WhatsApp Gateway not configured' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Webhook from Supabase Database on 'whatsapp_logs' table
    const { record, type } = await req.json();

    // Only process inserts into the logs table
    if (type !== 'INSERT') {
      return new Response(JSON.stringify({ message: 'Ignoring non-insert event' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { recipient_number, patient_name, event_type, meta_data } = record;
    const hospitalName = meta_data.hospital_name || 'Your Hospital';
    const doctorName = meta_data.doctor_name || 'Assigned Doctor';
    const today = new Date().toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });

    let message = '';

    if (event_type === 'OPD_BOOKING') {
      message = `Hello *${patient_name}*,\n\nYour OPD booking at *${hospitalName}* is confirmed!\n\n🎟️ Token No: *${meta_data.token_number}*\n👨‍⚕️ Doctor: *Dr. ${doctorName}*\n📅 Date: ${today}\n\nPlease arrive 15 mins early. Thank you!`;
    } else if (event_type === 'IPD_ADMISSION') {
      message = `Hello *${patient_name}*,\n\nYou have been successfully admitted to *${hospitalName}*.\n\n🏥 Ward: *${meta_data.ward_name}*\n🛌 Bed: *${meta_data.bed_number}*\n👨‍⚕️ Admitting Doctor: *Dr. ${doctorName}*\n📅 Admission Date: ${today}\n\nWe wish you a speedy recovery.`;
    } else {
      return new Response(JSON.stringify({ error: 'Unknown event type' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Sanitize phone number (remove +, spaces, dashes if any)
    const sanitizedNumber = recipient_number.replace(/\D/g, '');

    // Forward to WhatsApp Gateway
    console.log(`Sending WhatsApp to ${sanitizedNumber}...`);
    const res = await fetch(`${gatewayUrl}/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        number: sanitizedNumber,
        message: message,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Gateway error:', err);
      return new Response(JSON.stringify({ error: 'Failed to trigger gateway', details: err }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, message: 'Forwarded to gateway' }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    console.error('WhatsApp function error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
