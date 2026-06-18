import dotenv from 'dotenv';
import { Client, GatewayIntentBits } from 'discord.js';

dotenv.config();

async function run() {
  const token = process.env.DISCORD_TOKEN?.trim().replace(/^"|"$/g, '');
  if (!token) {
    console.error('No DISCORD_TOKEN defined.');
    return;
  }
  
  console.log('Connecting as bot...');
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages
    ]
  });
  
  client.on('ready', async () => {
    console.log('✅ Connected successfully as:', client.user?.tag);
    
    console.log('\n--- Channels ---');
    client.guilds.cache.forEach(guild => {
      console.log(`Guild: ${guild.name} (${guild.id})`);
      guild.channels.cache.forEach(channel => {
        if (channel.isTextBased()) {
          console.log(`  - #${channel.name}: ${channel.id}`);
        }
      });
    });
    
    client.destroy();
  });
  
  try {
    await client.login(token);
  } catch (err) {
    console.error('❌ Login failed with error:', err);
  }
}

run();
