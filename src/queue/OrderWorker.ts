import { Worker, Job } from 'bullmq'
import { connection } from './redis'
import { ORDER_QUEUE_NAME } from './OrderQueue'
import { connectionManager } from '../sysbot/ConnectionManager'
import { discordBridge } from '../sysbot/DiscordBridge'
import { buildShowdownText } from '../lib/showdownBuilder'
import { PokemonBuildPayload } from '../lib/order-types'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { games, loadEncounters } from '../lib/gameDb'
import { findHomeEventProfile, formatHomeEventSysbotCommand } from '../lib/homeEventPatch'
import { ordersStore, updateOrderState } from '../routes/publicOrders'

const PROFILE_PA9_MAP: Record<string, string> = {
  'home-shiny-zeraora':                'HOME Shiny Zeraora ZA.pa9',
  'home-movie-2013-shiny-genesect-jpn':'HOME Shiny Genesect ZA.pa9',
  'home-pokecen-shiny-diancie-jpn':    'HOME Shiny Diancie ZA.pa9',
  'home-xyz-shiny-xerneas':            'HOME Shiny Xerneas ZA.pa9',
  'home-xyz-shiny-yveltal':            'HOME Shiny Yveltal ZA.pa9',
  'home-2018-legends-shiny-zygarde':   'HOME Shiny Zygarde ZA.pa9',
  'home-ultra-shiny-kyogre-jpn':       'HOME Shiny Kyogre ZA.pa9',
  'home-ultra-shiny-kyogre-kor':       'HOME Shiny Kyogre ZA.pa9',
  'home-galileo-shiny-rayquaza':       'HOME Shiny Rayquaza ZA.pa9',
  'home-movie-shiny-mewtwo-jpn':       'HOME Shiny Mewtwo ZA.pa9',
  'home-summit-shiny-heatran-jpn':     'HOME Shiny Heatran ZA.pa9',
  'home-movie-shiny-keldeo-jpn':       'HOME Shiny Keldeo ZA.pa9',
  'home-alerts-shiny-darkrai-jpn':     'HOME Shiny Darkrai ZA.pa9',
  'home-sinnoh-shiny-meloetta-jpn':    'HOME Shiny Meloetta ZA.pa9',
  'home-original-color-magearna':      'HOME Magearna Original Color ZA.pa9',
  'home-shiny-meltan':                 'HOME Shiny Meltan ZA.pa9',
  'home-shiny-melmetal':               'HOME Shiny Melmetal ZA.pa9',
  'home-dex-completion-shiny-volcanion-za': 'HOME Shiny Volcanion ZA.pa9',
};

const SV_HOME_SHINY_FILES: Record<number, string> = {
  144: '0144-01 ★ - Articuno - F2270DF1E9CC.pk8',
  145: '0145-01 ★ - Zapdos - B5F817E8AFE3.pk8',
  146: '0146-01 ★ - Moltres - B6184A160BBA.pk8',
  150: '0150 ★ - Mewtwo - 97B4B79FA948.pk6',
  243: '0243 ★ - RAIKOU - 346836D46750.pk4',
  244: '0244 ★ - ENTEI - 32627D5BB510.pk4',
  245: '0245 ★ - SUICUNE - 891442FCBC7E.pk4',
  250: '0250 ★ - Ho-Oh - FB3B64A582E9.pk6',
  382: '0382 ★ - Kyogre - 41F13FAB7818.pk7',
  383: '0383 ★ - Groudon - 470D05B9D0DB.pk7',
  384: '0384 ★ - Rayquaza - 4426B679369F.pk6',
  483: '0483 ★ - Dialga - BEE9204C004C.pk5',
  484: '0484 ★ - Palkia - 5BD5236C00E9.pk5',
  791: '0791 ★ - Solgaleo - AF9DB8E828BA.pk7',
  792: '0792 ★ - Lunala - 8B8332462948.pk7',
  800: '0800 ★ - Necrozma - 091B3E0E66BA.pk7',
};

const ZA_SHINY_FILES: Record<number, string> = {
  716: '0716 ★ - Xerneas - 29C81DB4E6C6.pk6',
  717: '0717 ★ - Yveltal - C579E69295CF.pk6',
  150: '0150 ★ - Mewtwo - 92491FB79B28.pk6',
  719: '0719 ★ - Diancie - 4ED45A89912E.pk6',
  648: '0648 ★ - Meloetta - 5053058CC31B.pk9',
  485: '0485 ★ - Heatran - 86B6712FBFFF.pa9',
  491: '0491 ★ - Darkrai - 7857307B1AE5.pa9',
  647: '0647 ★ - Keldeo - 61A025DC38FF.pk8',
};

function resolveFilePath(folderParts: string[], filename: string): string | null {
  const subPath = join(...folderParts, filename);
  const possiblePaths = [
    join(process.cwd(), subPath),
    join(process.cwd(), 'backend', subPath),
    join(__dirname, '..', '..', subPath),
    join(__dirname, '..', 'lib', 'data', subPath),
    join(__dirname, '..', '..', 'src', 'lib', 'data', subPath),
  ];

  for (const p of possiblePaths) {
    if (existsSync(p)) {
      return p;
    }
  }
  return null;
}

// --- SV HOME EXPANSION PATCH START ---
const dataDir = join(process.cwd(), 'src', 'lib', 'data');
let SV_HOME_EXPANSION_FILE_MAP_PATH = join(dataDir, 'sv_home_expansion_file_map.json');
if (!existsSync(SV_HOME_EXPANSION_FILE_MAP_PATH)) {
  SV_HOME_EXPANSION_FILE_MAP_PATH = join(__dirname, '..', 'lib', 'data', 'sv_home_expansion_file_map.json');
}
if (!existsSync(SV_HOME_EXPANSION_FILE_MAP_PATH)) {
  SV_HOME_EXPANSION_FILE_MAP_PATH = join(__dirname, '..', '..', 'src', 'lib', 'data', 'sv_home_expansion_file_map.json');
}
let SV_HOME_EXPANSION_FILE_MAP: Record<string, any> = {};
if (existsSync(SV_HOME_EXPANSION_FILE_MAP_PATH)) {
  try {
    SV_HOME_EXPANSION_FILE_MAP = JSON.parse(readFileSync(SV_HOME_EXPANSION_FILE_MAP_PATH, 'utf8'));
  } catch (err: any) {
    console.error('[OrderWorker] Error loading sv_home_expansion_file_map.json:', err.message);
  }
}
// --- SV HOME EXPANSION PATCH END ---

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

      let targetChannelId: string | undefined;
      let commandPrefix = '!';

      // Allow per-game & per-tier prefix overrides via env vars
      const svFreePrefix = process.env.DISCORD_PREFIX_SV_FREE?.trim() || process.env.DISCORD_PREFIX_SV?.trim() || '%';
      const svPremiumPrefix = process.env.DISCORD_PREFIX_SV_PREMIUM?.trim() || process.env.DISCORD_PREFIX_SV?.trim() || '%';
      const zaFreePrefix = process.env.DISCORD_PREFIX_ZA_FREE?.trim() || process.env.DISCORD_PREFIX_ZA?.trim() || '!';
      const zaPremiumPrefix = process.env.DISCORD_PREFIX_ZA_PREMIUM?.trim() || process.env.DISCORD_PREFIX_ZA?.trim() || '%';

      if (gameVersion === 'scarlet' || gameVersion === 'violet') {
        if (userPlan === 'free') {
          targetChannelId = (process.env.DISCORD_CHANNEL_ID_SV_FREE || process.env.DISCORD_CHANNEL_ID_SV || process.env.DISCORD_CHANNEL_ID)?.replace(/[^0-9]/g, '');
          commandPrefix = svFreePrefix;
        } else {
          targetChannelId = (process.env.DISCORD_CHANNEL_ID_SV_PREMIUM || process.env.DISCORD_CHANNEL_ID_SV || process.env.DISCORD_CHANNEL_ID)?.replace(/[^0-9]/g, '');
          commandPrefix = svPremiumPrefix;
        }
      } else if (gameVersion === 'legends-za') {
        if (userPlan === 'free') {
          targetChannelId = (process.env.DISCORD_CHANNEL_ID_ZA_FREE || process.env.DISCORD_CHANNEL_ID_ZA || process.env.DISCORD_CHANNEL_ID)?.replace(/[^0-9]/g, '');
          commandPrefix = zaFreePrefix;
        } else {
          targetChannelId = (process.env.DISCORD_CHANNEL_ID_ZA_PREMIUM || process.env.DISCORD_CHANNEL_ID_ZA || process.env.DISCORD_CHANNEL_ID)?.replace(/[^0-9]/g, '');
          commandPrefix = zaPremiumPrefix;
        }
      }

      // 3. Generate and upload .pk9 files for the entire team
      const team = payload as PokemonBuildPayload[]
      const uploadedFiles: string[] = []

      for (let i = 0; i < team.length; i++) {
        const pokemon = team[i]
        try {
          // Resolve Pokémon metadata from visual name to get dexId and form
          const gKey = gameVersion === 'legends-za' ? 'za' : 'sv';
          const pokemonList = games[gKey].pokemon;
          const pokemonMeta = pokemonList.find((p: any) =>
            p.name.toLowerCase() === pokemon.species.toLowerCase() ||
            p.displayNameEn?.toLowerCase() === pokemon.species.toLowerCase() ||
            p.displayName?.toLowerCase() === pokemon.species.toLowerCase()
          );
          const dexId = pokemonMeta ? Number(pokemonMeta.species) : undefined;
          const form = pokemonMeta ? Number(pokemonMeta.form || 0) : 0;

          // Load full encounter info from database
          let matchedEncounter: any = null;
          if (dexId !== undefined && (pokemon as any).encounterId) {
            const encounters = loadEncounters(gKey, dexId, form);
            matchedEncounter = encounters.find((e: any) => e.id === (pokemon as any).encounterId);
          }

          // Build enriched Pokémon for profile matching
          const enrichedPokemon = {
            ...pokemon,
            dexId,
            form,
            method: matchedEncounter?.method,
            originType: matchedEncounter?.originType,
            locationName: matchedEncounter?.locationName,
            locationNameEn: matchedEncounter?.locationNameEn,
            homeProfileId: matchedEncounter?.homeProfileId || (matchedEncounter?.id?.startsWith('home-') ? matchedEncounter.id : null),
            game: gKey,
          };

          let showdownText = '';
          let attachment: { buffer: Buffer; filename: string } | undefined = undefined;

          // ── Attachments and Custom Command Formatting ────────────────────────
          const isHome = enrichedPokemon.homeProfileId || enrichedPokemon.encounterId?.startsWith('home-') || enrichedPokemon.origin?.toLowerCase().includes('home');
          const expansionKey = `${dexId}-${form}`;
          const expansion = (gameVersion === 'scarlet' || gameVersion === 'violet') ? SV_HOME_EXPANSION_FILE_MAP[expansionKey] : null;

          if ((gameVersion === 'scarlet' || gameVersion === 'violet') && dexId === 1024) {
            // Custom Terapagos template for Scarlet/Violet
            const filename = '1024 - Terapagos - 288628EF1F65.pk9';
            const pkPath = resolveFilePath(['pk9'], filename);
            if (pkPath) {
              attachment = { buffer: readFileSync(pkPath), filename };
              console.log(`[OrderWorker] ✅ Loaded fixed Terapagos file: ${filename}`);
              showdownText = ''; // Clear showdownText so only trade code is sent
            } else {
              console.warn(`[OrderWorker] ⚠️ Fixed Terapagos file not found: ${filename}`);
            }
          } else if (expansion) {
            const filename = expansion.fileName;
            const pkPath = resolveFilePath(['sv_home_expansion_files'], filename);
            if (pkPath) {
              attachment = { buffer: readFileSync(pkPath), filename };
              console.log(`[OrderWorker] ✅ Loaded expansion fixed .pk/.pb8 file: ${filename} for species ${expansionKey}`);
              showdownText = ''; // Clear showdownText so only trade code is sent
            } else {
              console.warn(`[OrderWorker] ⚠️ Expansion fixed file not found for species ${expansionKey} (${filename})`);
            }
          } else if ((gameVersion === 'scarlet' || gameVersion === 'violet') && pokemon.shiny && isHome && dexId && SV_HOME_SHINY_FILES[dexId]) {
            // SV HOME Shiny Attachments
            const filename = SV_HOME_SHINY_FILES[dexId];
            const pkPath = resolveFilePath(['pk9'], filename);
            if (pkPath) {
              attachment = { buffer: readFileSync(pkPath), filename };
              console.log(`[OrderWorker] ✅ Loaded fixed .pk file: ${filename} for species ${dexId}`);
            } else {
              console.warn(`[OrderWorker] ⚠️ Fixed pk file not found for species ${dexId} (${filename})`);
            }
          } else if (gameVersion === 'legends-za' && pokemon.shiny && dexId && ZA_SHINY_FILES[dexId]) {
            // ZA HOME Shiny Attachments
            const filename = ZA_SHINY_FILES[dexId];
            const pkPath = resolveFilePath(['pk9'], filename);
            if (pkPath) {
              attachment = { buffer: readFileSync(pkPath), filename };
              console.log(`[OrderWorker] ✅ Loaded fixed ZA shiny file: ${filename} for species ${dexId}`);
              showdownText = ''; // Clear showdownText so only trade code is sent
            } else {
              console.warn(`[OrderWorker] ⚠️ Fixed ZA shiny file not found for species ${dexId} (${filename})`);
            }
          } else if (gameVersion === 'legends-za') {
            // Legends Z-A HOME Event Formatting (available to all)
            const eventProfile = findHomeEventProfile(enrichedPokemon);
            if (eventProfile?.id) {
              // Attach .pa9 file if user is premium
              if (userPlan === 'premium') {
                const filename = PROFILE_PA9_MAP[eventProfile.id];
                if (filename) {
                  const pa9Path = resolveFilePath(['mgdb'], filename);
                  if (pa9Path) {
                    attachment = { buffer: readFileSync(pa9Path), filename };
                    console.log(`[OrderWorker] ✅ Loaded fixed .pa9 file: ${filename} for profile ${eventProfile.id}`);
                  } else {
                    console.warn(`[OrderWorker] ⚠️ Event .pa9 file not found for profile ${eventProfile.id} (${filename})`);
                  }
                }
              }

              const eventBody = formatHomeEventSysbotCommand(enrichedPokemon);
              if (eventBody) {
                showdownText = eventBody;
              }
            }
          }

          if (!showdownText && !attachment) {
            showdownText = buildShowdownText(pokemon, gameVersion);
          }

          console.log(`[OrderWorker] === COMMAND PAYLOAD for ${pokemon.species} (${i+1}/${team.length}) ===`)
          console.log(showdownText)
          if (attachment) {
            console.log(`[OrderWorker] Attachment: ${attachment.filename} (${attachment.buffer.length} bytes)`)
          }
          console.log(`[OrderWorker] ================================================================`)

          // Send to Discord via the selfbot bridge, passing the trade code, target channel, prefix and attachment
          const success = await discordBridge.sendTradeCommand(showdownText, botTradeCode, targetChannelId, commandPrefix, attachment)
          
          if (!success) {
            throw new Error(`DiscordBridge failed to send command for ${pokemon.species}. Please ensure the bridge is connected and the channel ID is valid.`)
          }
          
          uploadedFiles.push(`Sent via Discord: ${pokemon.species}`)

          // Wait until this specific item is completed or failed
          console.log(`[OrderWorker] Command sent for item ${i+1}/${team.length} (${pokemon.species}). Waiting for it to finish...`)
          
          const maxWaitTimeMs = 4 * 60 * 1000 // 4 minutes safety timeout
          const pollIntervalMs = 2000
          const startWait = Date.now()
          let itemFinished = false

          while (Date.now() - startWait < maxWaitTimeMs) {
            const record = ordersStore.get(orderId)
            if (record && record.items && record.items[i]) {
              const currentStatus = String(record.items[i].status).toLowerCase()
              if (currentStatus === 'completed' || currentStatus === 'failed') {
                console.log(`[OrderWorker] Item ${i+1}/${team.length} reached status: ${currentStatus}`)
                itemFinished = true
                break
              }
            }
            if (record) {
              const orderStatus = String(record.status).toLowerCase()
              if (orderStatus === 'failed' || orderStatus === 'expired' || orderStatus === 'cancelled' || orderStatus === 'partial_failed') {
                console.log(`[OrderWorker] Order ${orderId} aborted with status: ${orderStatus}`)
                break
              }
            }
            await new Promise(resolve => setTimeout(resolve, pollIntervalMs))
          }

          if (!itemFinished) {
            console.warn(`[OrderWorker] Timeout or order abort waiting for item ${i+1}/${team.length} to complete.`)
          }

          // If the order itself has failed or aborted, we stop the loop and don't send the next items
          const record = ordersStore.get(orderId)
          if (record) {
            const orderStatus = String(record.status).toLowerCase()
            if (orderStatus === 'failed' || orderStatus === 'expired' || orderStatus === 'cancelled' || orderStatus === 'partial_failed') {
              console.log(`[OrderWorker] Stopping sequential delivery loop because order ${orderId} is in status ${orderStatus}`)
              break
            }
          }

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

orderWorker.on('failed', async (job, err) => {
  console.log(`[OrderWorker] ❌ Order ${job?.id} failed (will retry): ${err.message}`)
  if (job) {
    const { orderId } = job.data
    const attemptsMade = job.attemptsMade || 0
    const maxAttempts = job.opts?.attempts || 5
    if (attemptsMade >= maxAttempts) {
      console.log(`[OrderWorker] ❌ Order ${orderId} failed permanently after ${attemptsMade} attempts. Marking as failed...`)
      try {
        await updateOrderState(orderId, {
          status: 'failed',
          message: `El pedido no pudo ser enviado a Discord tras varios intentos.`
        })
      } catch (updateErr: any) {
        console.error(`[OrderWorker] Error updating failed order ${orderId}:`, updateErr.message || updateErr)
      }
    }
  }
})

