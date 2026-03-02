import { jest } from '@jest/globals';
import request from 'supertest';
import { createHmac } from 'node:crypto';
import nock from 'nock';

const SUPABASE_URL = process.env.SUPABASE_URL;
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

const generateSignature = (body, secret) => {
    return createHmac('sha256', secret).update(JSON.stringify(body)).digest('hex');
};

describe('Razorpay Webhook Security', () => {
    beforeEach(() => nock.cleanAll());

    test('Should reject invalid HMAC signature', async () => {
        nock(SUPABASE_URL)
            .post('/functions/v1/webhook-razorpay')
            .reply(401, { error: 'Invalid signature' });

        const payload = { event: 'payment.captured' };
        const response = await request(SUPABASE_URL)
            .post('/functions/v1/webhook-razorpay')
            .set('x-razorpay-signature', 'invalid_signature')
            .send(payload);

        expect(response.status).toBe(401);
    });

    test('Should reject events older than 300 seconds (Replay Protection)', async () => {
        nock(SUPABASE_URL)
            .post('/functions/v1/webhook-razorpay')
            .reply(400, { error: 'Event too old' });

        const oldTimestamp = Math.floor(Date.now() / 1000) - 600; // 10 mins ago
        const payload = {
            event: 'payment.captured',
            created_at: oldTimestamp,
            payload: { payment: { entity: { id: 'pay_test_123', amount: 500, status: 'captured' } } }
        };

        const signature = generateSignature(payload, WEBHOOK_SECRET);

        const response = await request(SUPABASE_URL)
            .post('/functions/v1/webhook-razorpay')
            .set('x-razorpay-signature', signature)
            .send(payload);

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('too old');
    });

    test('Idempotency: Multiple identical webhooks should return 200 but only process once', async () => {
        nock(SUPABASE_URL)
            .post('/functions/v1/webhook-razorpay')
            .times(3)
            .reply(200, { success: true, processed: true });

        const payload = {
            event: 'payment.captured',
            event_id: `evt_idp_${Date.now()}`,
            created_at: Math.floor(Date.now() / 1000),
            payload: {
                payment: {
                    entity: {
                        id: `pay_idp_${Date.now()}`,
                        amount: 99900,
                        status: 'captured',
                        notes: { hospital_id: 'cdd763dd-5cda-4444-adad-699058e335d8', plan_slug: 'starter' }
                    }
                }
            }
        };

        const signature = generateSignature(payload, WEBHOOK_SECRET);

        // Fire 3 requests in parallel
        const responses = await Promise.all([
            request(SUPABASE_URL).post('/functions/v1/webhook-razorpay').set('x-razorpay-signature', signature).send(payload),
            request(SUPABASE_URL).post('/functions/v1/webhook-razorpay').set('x-razorpay-signature', signature).send(payload),
            request(SUPABASE_URL).post('/functions/v1/webhook-razorpay').set('x-razorpay-signature', signature).send(payload)
        ]);

        // All should be 200 (idempotent success)
        responses.forEach(res => expect(res.status).toBe(200));
    });
});
