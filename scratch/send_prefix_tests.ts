import { Client, GatewayIntentBits } from 'discord.js';
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

const channelId = process.env.DISCORD_CHANNEL_ID_ZA_PREMIUM || '1495899324436058252';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.on('ready', async () => {
  console.log(`Logged in as ${client.user?.tag}`);

  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) {
      console.error('Channel not found or not text-based');
      client.destroy();
      process.exit(1);
    }

    console.log(`Listening for responses in channel: ${channel.name} (${channel.id})...`);
    console.log('Sending test commands in 3 seconds...');

    setTimeout(async () => {
      // We will send multiple trade commands with different prefixes
      const prefixes = ['$', '%', '!', '.', '?', '*'];
      
      for (const prefix of prefixes) {
        const content = `${prefix}trade 88887777\nBulbasaur\nLevel: 10\nNaive Nature`;
        console.log(`Sending command with prefix '${prefix}'...`);
        await channel.send(content);
        // Wait 3 seconds between commands to avoid rate limit or bot confusion
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }, 3000);

  } catch (err: any) {
    console.error('Error in ready handler:', err.message || err);
    client.destroy();
    process.exit(1);
  }
});

// Listen to messages in the channel to see responses
client.on('messageCreate', (message) => {
  if (message.channel.id !== channelId) return;
  
  console.log(`[Message] ${message.author.tag}: ${message.content.replace(/\n/g, ' ')}`);
});

// Auto-exit after 30 seconds
setTimeout(() => {
  console.log('Timeout reached. Exiting...');
  client.destroy();
  process.exit(0);
}, 30000);

client.login(token).catch((err) => {
  console.error('Login failed:', err);
  process.exit(1);
});
