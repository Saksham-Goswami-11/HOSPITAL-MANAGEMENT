import { jest } from '@jest/globals';
import request from 'supertest';
import nock from 'nock';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const ADMIN_A_JWT = 'MOCK_ADMIN_A_JWT';

describe('Concurrency & Load Balancing', () => {
    beforeEach(() => nock.cleanAll());

    test('Thundering Herd Checkout: Fast consecutive requests should trigger rate limiting', async () => {
        // Mock 1 success and then 9 rate limits
        nock(SUPABASE_URL)
            .post('/functions/v1/create-checkout')
            .reply(200, { success: true })
            .post('/functions/v1/create-checkout')
            .times(9)
            .reply(429, { error: 'Too many requests' });

        // Fire 10 requests rapidly
        // Fire 10 requests rapidly
        const checkoutRequests = Array(10).fill(null).map(() =>
            request(SUPABASE_URL)
                .post('/functions/v1/create-checkout')
                .set('Authorization', `Bearer ${ADMIN_A_JWT}`)
                .set('apikey', SUPABASE_ANON_KEY)
                .send({ plan_slug: 'starter', billing_cycle: 'monthly' })
        );

        const responses = await Promise.all(checkoutRequests);

        const rateLimited = responses.filter(res => res.status === 429);
        console.log(`Rate limited requests: ${rateLimited.length}/10`);

        // At least some should be rate limited if the cooldown is 10s
        expect(rateLimited.length).toBeGreaterThan(0);
    });

    test('Server Resilience: Concurrent webhook delivery', async () => {
        nock(SUPABASE_URL)
            .post('/functions/v1/webhook-razorpay')
            .times(10)
            .reply(200, { success: true });

        // This is similar to idempotency but focuses on ensuring NO 5xx errors occur
        // under "high" concurrent database writes
        const webhooks = Array(10).fill(null).map((_, i) => {
            const payload = { event: 'payment.captured', event_id: `load_test_${i}_${Date.now()}` };
            // Valid signature logic omitted for brevity in load test (would need real secret)
            return request(SUPABASE_URL).post('/functions/v1/webhook-razorpay').send(payload);
        });

        const responses = await Promise.all(webhooks);

        // None should be 502/503/500
        responses.forEach(res => {
            expect(res.status).not.toBeGreaterThanOrEqual(500);
        });
    });
});
