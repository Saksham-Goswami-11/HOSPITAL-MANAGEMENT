const { createClient } = require('@supabase/supabase-js')
const dotenv = require('dotenv')
const path = require('path')

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Error: Missing Supabase URL or Anon Key.')
    console.error('URL:', supabaseUrl)
    console.error('KEY:', supabaseAnonKey ? 'FOUND' : 'MISSING')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testUnauthenticatedAccess() {
    console.log('--- Starting Vulnerability Test: Unauthenticated Access ---')

    // 1. Try to fetch SALES
    console.log('\n[TEST 1] Fetching Sales without Session...')
    const { data: sales, error: salesError } = await supabase.from('sales').select('*')

    if (salesError) {
        console.log('✅ PASS: Database returned error (expected).', salesError.message)
    } else if (sales && sales.length === 0) {
        console.log('✅ PASS: Database returned 0 rows (RLS active).')
    } else {
        console.error('❌ FAIL: Database returned rows! RLS Breach?', sales)
    }

    // 2. Try to fetch INVENTORY
    console.log('\n[TEST 2] Fetching Inventory without Session...')
    const { data: inv, error: invError } = await supabase.from('inventory').select('*')

    if (invError) {
        console.log('✅ PASS: Database returned error (expected).', invError.message)
    } else if (inv && inv.length === 0) {
        console.log('✅ PASS: Database returned 0 rows (RLS active).')
    } else {
        console.error('❌ FAIL: Database returned rows!', inv)
    }

    // 3. Try to fetch PROFILES (Should fail or return empty)
    console.log('\n[TEST 3] Fetching Profiles without Session...')
    const { data: prof, error: profError } = await supabase.from('profiles').select('*')

    if (profError) {
        console.log('✅ PASS: Database returned error (expected).', profError.message)
    } else if (prof && prof.length === 0) {
        console.log('✅ PASS: Database returned 0 rows (RLS active).')
    } else {
        console.error('❌ FAIL: Database returned rows!', prof)
    }

    console.log('\n--- Vulnerability Test Complete ---')
}

testUnauthenticatedAccess()
