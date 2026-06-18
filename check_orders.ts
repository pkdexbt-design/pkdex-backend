import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { join } from 'path';

// Load env from backend .env
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://owzfcsfykvfzumfqqkjs.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY in backend env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('Fetching last 5 orders...');
  const { data: orders, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error fetching orders:', error.message);
    return;
  }

  for (const o of orders) {
    console.log(`Order ID: ${o.id}`);
    console.log(`Created At: ${o.created_at}`);
    console.log(`User ID: ${o.user_id}`);
    console.log(`Trade Code: ${o.trade_code}`);
    console.log(`Game: ${o.game_version}`);
    console.log(`Status: ${o.status}`);
    
    // Fetch user details
    const { data: { user }, error: userErr } = await supabase.auth.admin.getUserById(o.user_id);
    if (userErr || !user) {
      console.log(`User Plan: Error or not found: ${userErr?.message}`);
    } else {
      console.log(`User Email: ${user.email}`);
      console.log(`User App Metadata Plan: ${JSON.stringify(user.app_metadata?.plan)}`);
      console.log(`User User Metadata Plan: ${JSON.stringify(user.user_metadata?.plan)}`);
    }
    console.log('--------------------------------------------');
  }
}

main();
