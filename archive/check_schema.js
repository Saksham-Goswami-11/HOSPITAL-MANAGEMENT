import https from 'https';

const query = `
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'clinics';
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
    res.on('data', (d) => {
        process.stdout.write(d);
    });
});

req.write(data);
req.end();
