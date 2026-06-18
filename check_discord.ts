import { Client, Intents } from 'discord.js-selfbot-v13';
import dotenv from 'dotenv';
import { join } from 'path';

// Try loading frontend env
dotenv.config({ path: join(__dirname, '../frontend/.env.local') });

let token = process.env.DISCORD_TOKEN?.trim();
if (!token) {
  // Try backend env
  dotenv.config();
  token = process.env.DISCORD_TOKEN?.trim();
}

if (!token) {
  console.error('Missing DISCORD_TOKEN in env files');
  process.exit(1);
}

console.log('Using token starting with:', token.substring(0, 30));

const client = new Client();

client.on('ready', async () => {
  console.log(`Logged in as ${client.user?.tag}`);
  
  try {
    const guilds = await client.guilds.fetch();
    console.log(`Found ${guilds.size} guilds:`);
    
    for (const [guildId, oauthGuild] of guilds.entries()) {
      console.log(`Guild: ${oauthGuild.name} (${guildId})`);
      const guild = await oauthGuild.fetch();
      const channels = await guild.channels.fetch();
      
      console.log('Text Channels:');
      channels.forEach(ch => {
        if (ch.isText()) {
          console.log(`  - #${ch.name} (ID: ${ch.id})`);
        }
      });
      console.log('---------------------------------');
    }
  } catch (err: any) {
    console.error('Error:', err.message);
  }
  
  client.destroy();
  process.exit(0);
});

client.login(token).catch(err => {
  console.error('Login failed:', err.message);
  process.exit(1);
});
