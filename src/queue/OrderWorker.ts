import { Worker, Job } from 'bullmq'
import { connection } from './redis'
import { ORDER_QUEUE_NAME } from './OrderQueue'
import { connectionManager } from '../sysbot/ConnectionManager'
import { discordBridge } from '../sysbot/DiscordBridge'
import { buildShowdownText } from '../lib/showdownBuilder'
import { PokemonBuildPayload } from '../lib/order-types'

/**
 * Worker that processes incoming web orders.
 * It continually runs in the background.
 */
export const orderWorker = new Worker(
  ORDER_QUEUE_NAME,
  async (job: Job) => {
    const { orderId, gameVersion, payload, tradeCode, userPlan } = job.data

    console.log(`[OrderWorker] Processing order ${orderId} for ${gameVersion} (Plan: ${userPlan || 'free'})`)

    // We no longer require BotConnector TCP presence locally.
    // The backend just sends orders straight to Discord for SysBot to read.
    const botTradeCode = tradeCode || Math.floor(10000000 + Math.random() * 90000000).toString()
    console.log(`[OrderWorker] ℹ️  User must enter code ${botTradeCode} on their Nintendo Switch`)

    try {
      console.log(`[OrderWorker] Sending order ${orderId} directly to Discord`)

      // Determine target channel based on gameVersion and user plan (PSAS-14)
      let targetChannelId: string | undefined;
      let commandPrefix = '!';
      
      if (gameVersion === 'scarlet' || gameVersion === 'violet') {
        targetChannelId = process.env.DISCORD_CHANNEL_ID_SV?.replace(/[^0-9]/g, '');
        commandPrefix = '!'; // SV
      } else if (gameVersion === 'legends-za') {
        if (userPlan === 'free') {
          targetChannelId = process.env.DISCORD_CHANNEL_ID_ZA_FREE?.replace(/[^0-9]/g, '');
          commandPrefix = '%'; // ZA Free
        } else {
          targetChannelId = (process.env.DISCORD_CHANNEL_ID_ZA_PREMIUM || process.env.DISCORD_CHANNEL_ID_ZA)?.replace(/[^0-9]/g, '');
          commandPrefix = '$'; // ZA Premium
        }
      }

      // 3. Generate and upload .pk9 files for the entire team
      const team = payload as PokemonBuildPayload[]
      const uploadedFiles: string[] = []

      for (let i = 0; i < team.length; i++) {
        const pokemon = team[i]
        try {
          // ── Event data injection ─────────────────────────────────────────────
          // For shiny event Pokémon, ALM requires OT + TID + Language to match the
          // official event record. Without them it fails with:
          //   "Requested shiny value (ShinyType.Always) is not possible for the given set"
          //
          // These OT/TID values are the official Pokémon HOME / Mystery Gift distributions.
          // Source: Serebii.net event database + Bulbapedia Mystery Gift pages.
          const EVENT_DATA: Record<string, { ot: string; tid: number; language: string }> = {
            genesect:  { ot: 'Plasma', tid: 10072, language: 'Japanese' },  // Plasma Genesect 2013
            groudon:   { ot: 'HOME',   tid: 240001, language: 'Spanish'  }, // HOME Shiny Gift ZA 2025
            kyogre:    { ot: 'HOME',   tid: 240001, language: 'Spanish'  }, // HOME Shiny Gift ZA 2025
            rayquaza:  { ot: 'HOME',   tid: 240001, language: 'Spanish'  }, // HOME Shiny Gift ZA 2025
          }

          const speciesKey = pokemon.species.toLowerCase()
          const eventData = pokemon.shiny ? EVENT_DATA[speciesKey] : undefined
          if (eventData) {
            (pokemon as any).eventOT       = eventData.ot
            ;(pokemon as any).eventTID     = eventData.tid
            ;(pokemon as any).eventLanguage = eventData.language
            console.log(`[OrderWorker] 🎁 Event data injected for ${pokemon.species}: OT=${eventData.ot} TID=${eventData.tid} Lang=${eventData.language}`)
          }

          // Convert payload to Showdown text directly using our builder
          const showdownText = buildShowdownText(pokemon, gameVersion)

          console.log(`[OrderWorker] === COMMAND PAYLOAD for ${pokemon.species} (${i+1}/${team.length}) ===`)
          console.log(showdownText)
          console.log(`[OrderWorker] ================================================================`)

          // Send to Discord via the selfbot bridge, passing the trade code and target channel
          const success = await discordBridge.sendTradeCommand(showdownText, botTradeCode, targetChannelId, commandPrefix)
          
          if (!success) {
            throw new Error(`DiscordBridge failed to send command for ${pokemon.species}. Please ensure the bridge is connected and the channel ID is valid.`)
          }
          
          uploadedFiles.push(`Sent via Discord: ${pokemon.species}`)

          // Wait between Pokémon in multi-Pokémon orders.
          // This prevents the trade code from expiring while the bot is still
          // processing the previous Pokémon. The game allows ~30s per trade.
          if (i < team.length - 1) {
            const delayMs = 8000
            console.log(`[OrderWorker] ⏳ Waiting ${delayMs}ms before sending next Pokémon (${i+2}/${team.length})...`)
            await new Promise(resolve => setTimeout(resolve, delayMs))
          }
          
        } catch (err) {
          console.error(`[OrderWorker] Failed to process ${pokemon.species} in order ${orderId}:`, err)
          throw err // BullMQ will retry or fail the job
        }
      }

      // ── Post-order cooldown ─────────────────────────────────────────────────
      // Give SysBot time to close the trade session and return to "ready" state
      // before processing the next queued order. Without this, back-to-back orders
      // send !trade commands while the bot is still wrapping up the previous trade,
      // which causes SysBot to cancel the new trade immediately.
      const postOrderDelay = 15000
      console.log(`[OrderWorker] ⏳ Post-order cooldown: waiting ${postOrderDelay}ms before next order...`)
      await new Promise(resolve => setTimeout(resolve, postOrderDelay))

      // Success
      return { success: true, uploadedFiles }
    } catch (error) {
      throw error
    }
  },
  {
    connection,
    // IMPORTANT: concurrency MUST stay at 1.
    // SysBot can only handle one !trade session at a time.
    // Parallel orders cause the bot to receive multiple codes simultaneously
    // and cancel all but the first. Process orders strictly one by one.
    concurrency: 1,
  }
)

orderWorker.on('completed', (job) => {
  console.log(`[OrderWorker] ✅ Order ${job.id} was delivered successfully.`)
})

orderWorker.on('failed', (job, err) => {
  console.log(`[OrderWorker] ❌ Order ${job?.id} failed (will retry): ${err.message}`)
})

