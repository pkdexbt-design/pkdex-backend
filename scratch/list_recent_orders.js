const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL || 'https://owzfcsfykvfzumfqqkjs.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function check() {
  console.log('Fetching 10 most recent orders...');
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error fetching orders:', error);
    return;
  }

  for (const order of data) {
    console.log(`ID: ${order.id} | Created: ${order.created_at} | Game: ${order.game_version} | Code: ${order.trade_code} | Status: ${order.status}`);
    console.log(`Payload:`, JSON.stringify(order.team_payload));
    console.log('----------------------------------------------------');
  }
}

check();
