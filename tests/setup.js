import { jest } from '@jest/globals';
import nock from 'nock';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });

// Global Mocking
global.jest = jest;

// Prevent real network calls during tests
nock.disableNetConnect();
// Allow localhost for edge functions if running locally
nock.enableNetConnect('127.0.0.1');
nock.enableNetConnect('localhost');

// Setup global mocks for Supabase/Razorpay if not using nock directly in tests
global.MOCK_SUPABASE_URL = process.env.SUPABASE_URL || 'https://mock.supabase.co';
global.MOCK_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'mock-anon-key';
