import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { games, loadEncounters } from '../lib/gameDb';
import { buildShowdownText } from '../lib/showdownBuilder';
import { findHomeEventProfile, formatHomeEventSysbotCommand } from '../lib/homeEventPatch';

// Load the map
const dataDir = join(process.cwd(), 'src', 'lib', 'data');
const SV_HOME_EXPANSION_FILE_MAP = JSON.parse(
  readFileSync(join(dataDir, 'sv_home_expansion_file_map.json'), 'utf8')
);

// SV HOME Shiny Attachments map from OrderWorker
const SV_HOME_SHINY_FILES: Record<number, string> = {
  144: '0144-01 ★ - Articuno - F2270DF1E9CC.pk8',
  150: '0150 ★ - Mewtwo - 97B4B79FA948.pk6',
};

async function testDispatchSim(pokemonPayload: any, gameVersion: string) {
  console.log(`\n--- Simulating Dispatch for: ${pokemonPayload.species} ---`);
  
  // Resolve Pokémon metadata
  const gKey = gameVersion === 'legends-za' ? 'za' : 'sv';
  const pokemonList = games[gKey].pokemon;
  const pokemonMeta = pokemonList.find((p: any) =>
    p.name.toLowerCase() === pokemonPayload.species.toLowerCase() ||
    p.displayNameEn?.toLowerCase() === pokemonPayload.species.toLowerCase() ||
    p.displayName?.toLowerCase() === pokemonPayload.species.toLowerCase()
  );
  
  const dexId = pokemonMeta ? Number(pokemonMeta.species) : undefined;
  const form = pokemonMeta ? Number(pokemonMeta.form || 0) : 0;

  // Load encounter
  let matchedEncounter: any = null;
  if (dexId !== undefined && pokemonPayload.encounterId) {
    const encounters = loadEncounters(gKey, dexId, form);
    matchedEncounter = encounters.find((e: any) => e.id === pokemonPayload.encounterId);
  }

  // Build enriched Pokémon
  const enrichedPokemon = {
    ...pokemonPayload,
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

  // ── Attachments and Custom Formatting ──
  const isHome = enrichedPokemon.homeProfileId || enrichedPokemon.encounterId?.startsWith('home-') || enrichedPokemon.origin?.toLowerCase().includes('home');
  const expansionKey = `${dexId}-${form}`;
  const expansion = (gameVersion === 'scarlet' || gameVersion === 'violet') ? SV_HOME_EXPANSION_FILE_MAP[expansionKey] : null;

  if (expansion) {
    const filename = expansion.fileName;
    let pkPath = join(process.cwd(), 'sv_home_expansion_files', filename);
    if (!existsSync(pkPath)) {
      pkPath = join(process.cwd(), 'src', 'lib', 'data', 'sv_home_expansion_files', filename);
    }
    if (existsSync(pkPath)) {
      attachment = { buffer: readFileSync(pkPath), filename };
      console.log(`[OrderWorker Sim] ✅ Loaded expansion fixed file: ${filename} (${attachment.buffer.length} bytes)`);
      showdownText = ''; // Clear showdownText
    } else {
      console.warn(`[OrderWorker Sim] ⚠️ Expansion file not found for species ${expansionKey} (${filename})`);
    }
  } else if ((gameVersion === 'scarlet' || gameVersion === 'violet') && pokemonPayload.shiny && isHome && dexId && SV_HOME_SHINY_FILES[dexId]) {
    const filename = SV_HOME_SHINY_FILES[dexId];
    let pkPath = join(process.cwd(), 'pk9', filename);
    if (existsSync(pkPath)) {
      attachment = { buffer: readFileSync(pkPath), filename };
      console.log(`[OrderWorker Sim] ✅ Loaded fixed .pk file: ${filename} (${attachment.buffer.length} bytes)`);
    }
  }

  if (!showdownText && !attachment) {
    showdownText = buildShowdownText(pokemonPayload, gameVersion);
  }

  // Format trade command
  const prefix = gameVersion === 'legends-za' ? '!' : '%';
  const tradeCode = '12345678';
  const commandText = attachment
    ? `${prefix}trade ${tradeCode}`
    : `${prefix}trade ${tradeCode}\n${showdownText}`;

  console.log('Resulting Command text sent to Discord:');
  console.log('--------------------');
  console.log(commandText);
  console.log('--------------------');
  console.log('Attachment attached:', attachment ? `Yes (${attachment.filename}) ✅` : 'No');
}

async function runTests() {
  // Test 1: Arceus (SV HOME Expansion)
  await testDispatchSim({
    species: 'Arceus',
    encounterId: 'sv-home-expansion-file-493-0',
    shiny: true
  }, 'scarlet');

  // Test 2: Hoopa (SV HOME Expansion, Shiny Locked)
  await testDispatchSim({
    species: 'Hoopa',
    encounterId: 'sv-home-expansion-file-720-0',
    shiny: false
  }, 'violet');

  // Test 3: Normal native pokemon (no attachment, showdown text)
  await testDispatchSim({
    species: 'Pikachu',
    level: 50,
    shiny: false,
    nature: 'Bold',
    ability: 'Static',
    moves: ['Thunderbolt']
  }, 'scarlet');
}

runTests().catch(console.error);
