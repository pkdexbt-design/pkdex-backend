import { loadEncounters, games } from '../lib/gameDb';
import { findHomeEventProfile, formatHomeEventSysbotCommand } from '../lib/homeEventPatch';

function enrich(pokemon: any, gameVersion: string) {
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
  if (dexId !== undefined && pokemon.encounterId) {
    const encounters = loadEncounters(gKey, dexId, form);
    matchedEncounter = encounters.find((e: any) => e.id === pokemon.encounterId);
  }

  return {
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
}

async function runTests() {
  console.log('--- RUNNING ENRICHED VALIDATION TESTS ---');

  // Test 1: Kubfu (891) in SV should NOT have a HOME encounter option
  const kubfuEncounters = loadEncounters('sv', 891);
  const kubfuHome = kubfuEncounters.find(e => e.id.includes('home') || e.method?.includes('HOME'));
  console.log('Kubfu SV HOME encounter found:', !!kubfuHome);

  // Test 2: Walking Wake (1009) in SV should NOT have a HOME encounter option
  const wwEncounters = loadEncounters('sv', 1009);
  const wwHome = wwEncounters.find(e => e.id.includes('home') || e.method?.includes('HOME'));
  console.log('Walking Wake SV HOME encounter found:', !!wwHome);

  // Test 3: Glastrier (896) in SV should have a HOME encounter but it must be SHINY LOCKED
  const glastrierEncounters = loadEncounters('sv', 896);
  const glastrierHome = glastrierEncounters.find(e => e.id.includes('home') || e.method?.includes('HOME'));
  console.log('Glastrier SV HOME encounter found:', !!glastrierHome);
  if (glastrierHome) {
    console.log('Glastrier HOME Shiny allowed (selectable):', glastrierHome.shiny !== 'Never' && !glastrierHome.shinyLocked);
  }

  // Test 4: Koraidon (1007) in SV should NOT have Poco Path level 68 encounter (static-staticsl-73)
  const koraidonEncounters = loadEncounters('sv', 1007);
  const pocoKoraidon = koraidonEncounters.find(e => e.id === 'static-staticsl-73');
  console.log('Koraidon SV Poco Path level 68 found:', !!pocoKoraidon);

  // Test 5: Zygarde (718) in ZA should match 'home-2018-legends-shiny-zygarde' and format correctly
  const zygardePayload = {
    species: 'Zygarde',
    encounterId: 'home-2018-legends-shiny-zygarde-za-za-718-2',
    shiny: true
  };
  const enrichedZygarde = enrich(zygardePayload, 'legends-za');
  const zygardeProfile = findHomeEventProfile(enrichedZygarde);
  console.log('Zygarde ZA HOME profile matched:', zygardeProfile?.id);
  if (zygardeProfile) {
    const commandText = formatHomeEventSysbotCommand(enrichedZygarde);
    console.log('\n--- Zygarde Command ---');
    console.log(commandText);
  }

  // Test 6: Rayquaza (384) in ZA should match 'home-shiny-rayquaza-za' (Jolly Nv. 70, no Galileo OT)
  const rayquazaPayload = {
    species: 'Rayquaza',
    encounterId: 'home-shiny-rayquaza-za-za-384-0',
    shiny: true
  };
  const enrichedRay = enrich(rayquazaPayload, 'legends-za');
  const rayProfile = findHomeEventProfile(enrichedRay);
  console.log('Rayquaza ZA HOME profile matched:', rayProfile?.id);
  if (rayProfile) {
    const commandText = formatHomeEventSysbotCommand(enrichedRay);
    console.log('\n--- Rayquaza Command ---');
    console.log(commandText);
  }

  // Test 7: Kyogre (382) in ZA should match 'home-ultra-shiny-kyogre-jpn' (Japanese, Modest, Cherish Ball)
  const kyogrePayload = {
    species: 'Kyogre',
    encounterId: 'home-ultra-shiny-kyogre-jpn-za-382-0',
    shiny: true
  };
  const enrichedKyogre = enrich(kyogrePayload, 'legends-za');
  const kyogreProfile = findHomeEventProfile(enrichedKyogre);
  console.log('Kyogre ZA HOME profile matched:', kyogreProfile?.id);
  if (kyogreProfile) {
    const commandText = formatHomeEventSysbotCommand(enrichedKyogre);
    console.log('\n--- Kyogre Command ---');
    console.log(commandText);
  }
}

runTests().catch(console.error);
