import { Client as SelfClient } from 'discord.js-selfbot-v13';
import { Client as BotClient, GatewayIntentBits } from 'discord.js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

let token = process.env.DISCORD_TOKEN;
if (token && token.startsWith('"') && token.endsWith('"')) {
  token = token.slice(1, -1);
}
const isBot = process.env.DISCORD_IS_BOT === 'true';

if (!token) {
  console.error('No DISCORD_TOKEN found in .env');
  process.exit(1);
}

console.log('DISCORD_IS_BOT:', isBot);
console.log('Token (first 15 chars):', token.substring(0, 15) + '...');

const client = isBot
  ? new BotClient({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    })
  : new SelfClient();

client.on('ready', async () => {
  console.log(`Logged in as ${client.user?.tag}`);

  const channelsToFetch = [
    { name: '#pedidos-sv-free', id: process.env.DISCORD_CHANNEL_ID_SV_FREE || '1511960316471152660' },
    { name: '#pedidos-sv-premium', id: process.env.DISCORD_CHANNEL_ID_SV_PREMIUM || '1495899209923039302' },
    { name: '#pedidos-za-free', id: process.env.DISCORD_CHANNEL_ID_ZA_FREE || '1498832934927601734' },
    { name: '#pedidos-za-premium', id: process.env.DISCORD_CHANNEL_ID_ZA_PREMIUM || '1495899324436058252' }
  ];

  for (const ch of channelsToFetch) {
    console.log(`\n=== Fetching last 15 messages from ${ch.name} (${ch.id}) ===`);
    try {
      const channel = await client.channels.fetch(ch.id);
      if (!channel) {
        console.error(`Channel ${ch.id} not found.`);
        continue;
      }
      if (channel.isTextBased()) {
        const messages = await channel.messages.fetch({ limit: 15 });
        console.log(`Found ${messages.size} messages.`);
        
        // Print in chronological order (oldest to newest)
        const sorted = Array.from(messages.values()).reverse();
        for (const msg of sorted) {
          const attachmentsStr = msg.attachments.size > 0 
            ? ` [Attachments: ${Array.from(msg.attachments.values()).map(a => a.name).join(', ')}]` 
            : '';
          console.log(`[${msg.createdAt.toLocaleTimeString()}] ${msg.author.tag}: ${msg.content.replace(/\n/g, ' ')}${attachmentsStr}`);
        }
      } else {
        console.error(`Channel ${ch.id} is not text based.`);
      }
    } catch (err: any) {
      console.error(`Error fetching messages for ${ch.name}:`, err.message || err);
    }
  }

  client.destroy();
  process.exit(0);
});

client.login(token).catch(err => {
  console.error('Login failed:', err);
  process.exit(1);
});
