/**
 * Script to inspect and optionally fix a user's plan in Supabase app_metadata.
 * Usage: npx tsx scratch/fix_user_plan.ts
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Change this to the email you want to inspect/fix ──────────────────────────
const TARGET_EMAIL = 'superpokemastergo@gmail.com';

// Set to the plan you want to assign, or leave null to only inspect
// Valid plans: 'free' | 'gym' | 'elite' | 'champion' | 'premium'
const ASSIGN_PLAN: string | null = null; // e.g. 'champion'
// ──────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🔍 Looking up user: ${TARGET_EMAIL}`);

  // Find user by email using admin API
  const { data: listData, error: listErr } = await adminClient.auth.admin.listUsers();
  if (listErr) {
    console.error('Error listing users:', listErr.message);
    return;
  }

  const user = listData.users.find(u => u.email === TARGET_EMAIL);
  if (!user) {
    console.error(`❌ User not found: ${TARGET_EMAIL}`);
    return;
  }

  console.log('\n📋 Current user data:');
  console.log('  ID:              ', user.id);
  console.log('  Email:           ', user.email);
  console.log('  app_metadata:    ', JSON.stringify(user.app_metadata, null, 2));
  console.log('  user_metadata:   ', JSON.stringify(user.user_metadata, null, 2));
  console.log('  Created at:      ', user.created_at);
  console.log('  Last sign in:    ', user.last_sign_in_at);

  const currentPlan = user.app_metadata?.plan || user.user_metadata?.plan || 'free';
  console.log('\n  ⚡ Resolved plan (as auth middleware would see it):', currentPlan);

  if (ASSIGN_PLAN) {
    console.log(`\n🛠️  Assigning plan "${ASSIGN_PLAN}" to user ${user.id}...`);
    const { data: updatedUser, error: updateErr } = await adminClient.auth.admin.updateUserById(
      user.id,
      { app_metadata: { ...user.app_metadata, plan: ASSIGN_PLAN } }
    );
    if (updateErr) {
      console.error('❌ Error updating user:', updateErr.message);
    } else {
      console.log('✅ User plan updated successfully!');
      console.log('  New app_metadata:', JSON.stringify(updatedUser.user.app_metadata, null, 2));
    }
  } else {
    console.log('\n  ℹ️  ASSIGN_PLAN is null — only inspecting, not modifying.');
    console.log('  To fix the plan, set ASSIGN_PLAN to the correct tier (e.g. "champion") and re-run.');
  }
}

main().catch(console.error);
