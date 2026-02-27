import https from 'https';

const query = `
ALTER TABLE public.hospitals ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;
COMMENT ON COLUMN public.hospitals.settings IS 'Stores global hospital configurations';
COMMENT ON COLUMN public.clinics.settings IS 'Stores local clinic configurations';
`;

const data = JSON.stringify({ query });

const options = {
    hostname: 'api.supabase.com',
    port: 443,
    path: '/v1/projects/uokqixbhmowvjddttixf/database/query',
    method: 'POST',
    headers: {
        'Authorization': 'Bearer sbp_f2bb555d99dc8c6b79abb59a45f31ed718034cab',
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = https.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    res.on('data', (d) => {
        process.stdout.write(d);
    });
});

req.on('error', (error) => {
    console.error('Error posting migration:', error);
});

req.write(data);
req.end();
