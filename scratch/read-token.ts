import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

let token = process.env.DISCORD_TOKEN;
if (token && token.startsWith('"') && token.endsWith('"')) {
  token = token.slice(1, -1);
}

if (!token) {
  console.error('No DISCORD_TOKEN found in .env');
  process.exit(1);
}

async function testToken() {
  // Test as Bot token
  try {
    console.log('Testing as BOT token...');
    const res = await fetch('https://discord.com/api/v9/users/@me', {
      headers: {
        Authorization: `Bot ${token}`
      }
    });
    console.log(`Bot auth status: ${res.status} ${res.statusText}`);
    if (res.ok) {
      const data = await res.json();
      console.log('BOT User details:', data);
      return;
    }
  } catch (err: any) {
    console.error('Error testing BOT token:', err.message);
  }

  // Test as User token
  try {
    console.log('\nTesting as USER token...');
    const res = await fetch('https://discord.com/api/v9/users/@me', {
      headers: {
        Authorization: token
      }
    });
    console.log(`User auth status: ${res.status} ${res.statusText}`);
    if (res.ok) {
      const data = await res.json();
      console.log('USER details:', data);
      return;
    }
  } catch (err: any) {
    console.error('Error testing USER token:', err.message);
  }
}

testToken();
