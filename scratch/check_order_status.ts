import dotenv from 'dotenv';
import { getSupabase } from '../src/lib/supabase';

dotenv.config();

async function run() {
  const supabase = getSupabase();
  const orderId = 'dd215d26-8df0-46d2-be9a-9903c71ab50a';
  
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single();
    
  if (error) {
    console.error('Error fetching order:', error);
    return;
  }
  
  console.log('Order status:', data.status);
  console.log('Order payload:', JSON.stringify(data.team_payload, null, 2));
}

run();
