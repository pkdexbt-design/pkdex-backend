import { games, loadEncounters, validate } from '../lib/gameDb';

async function runTests() {
  console.log('=== RUNNING SV HOME EXPANSION VALIDATION TESTS ===');

  // Test 1: Check if expansion Pokémon are loaded in games.sv.pokemon
  console.log('\n--- Test 1: Check expansion Pokémon presence in games.sv.pokemon ---');
  const arceusInDb = games.sv.pokemon.find((p: any) => Number(p.species) === 493);
  const hoopaInDb = games.sv.pokemon.find((p: any) => Number(p.species) === 720);
  const cresseliaInDb = games.sv.pokemon.find((p: any) => Number(p.species) === 488);

  console.log('Arceus in SV pokemon list:', arceusInDb ? 'Yes ✅' : 'No ❌');
  console.log('Hoopa in SV pokemon list:', hoopaInDb ? 'Yes ✅' : 'No ❌');
  console.log('Cresselia in SV pokemon list:', cresseliaInDb ? 'Yes ✅' : 'No ❌');

  if (!arceusInDb || !hoopaInDb || !cresseliaInDb) {
    throw new Error('Test 1 failed: Expansion Pokémon missing from games.sv.pokemon');
  }

  // Test 2: Load encounters for Arceus (493) and check fixed file properties
  console.log('\n--- Test 2: Load encounters for Arceus (493) ---');
  const arceusEncounters = loadEncounters('sv', 493, 0);
  console.log(`Total Arceus encounters: ${arceusEncounters.length}`);
  const expansionEncounter = arceusEncounters.find(e => e.id.includes('expansion'));
  
  if (expansionEncounter) {
    console.log('Expansion Encounter found! ✅');
    console.log('Encounter ID:', expansionEncounter.id);
    console.log('Method:', expansionEncounter.method);
    console.log('Uses Fixed File:', expansionEncounter.usesFixedFile);
    console.log('Fixed File Name:', expansionEncounter.fixedFileName);
    console.log('Shiny option:', expansionEncounter.shiny);
  } else {
    console.log('Expansion Encounter not found! ❌');
    throw new Error('Test 2 failed: Arceus expansion encounter missing');
  }

  // Test 3: Validate Arceus (493) Shiny
  console.log('\n--- Test 3: Validate Shiny Arceus ---');
  const payloadArceus = {
    species: 'Arceus',
    speciesId: 493,
    form: 0,
    level: 100,
    shiny: true,
    ball: 'Cherish Ball'
  };
  const resultArceus = validate('sv', payloadArceus);
  console.log('Validation success:', resultArceus.legal ? 'Yes ✅' : 'No ❌');
  if (resultArceus.legal) {
    console.log('Matched Encounter ID:', resultArceus.matchedEncounter?.id);
    console.log('Uses Fixed File:', resultArceus.matchedEncounter?.usesFixedFile);
    console.log('Fixed File Name:', resultArceus.matchedEncounter?.fixedFileName);
  } else {
    console.log('Errors:', resultArceus.errors);
    throw new Error('Test 3 failed: Shiny Arceus should be legal');
  }

  // Test 4: Validate Hoopa (720) Normal (should succeed)
  console.log('\n--- Test 4: Validate Hoopa Normal ---');
  const payloadHoopaNormal = {
    species: 'Hoopa',
    speciesId: 720,
    form: 0,
    level: 50,
    shiny: false
  };
  const resultHoopaNormal = validate('sv', payloadHoopaNormal);
  console.log('Validation success:', resultHoopaNormal.legal ? 'Yes ✅' : 'No ❌');
  if (resultHoopaNormal.legal) {
    console.log('Matched Encounter ID:', resultHoopaNormal.matchedEncounter?.id);
    console.log('Uses Fixed File:', resultHoopaNormal.matchedEncounter?.usesFixedFile);
    console.log('Fixed File Name:', resultHoopaNormal.matchedEncounter?.fixedFileName);
  } else {
    console.log('Errors:', resultHoopaNormal.errors);
    throw new Error('Test 4 failed: Normal Hoopa should be legal');
  }

  // Test 5: Validate Hoopa (720) Shiny (should fail, shiny locked)
  console.log('\n--- Test 5: Validate Hoopa Shiny (Should Fail) ---');
  const payloadHoopaShiny = {
    species: 'Hoopa',
    speciesId: 720,
    form: 0,
    level: 50,
    shiny: true
  };
  const resultHoopaShiny = validate('sv', payloadHoopaShiny);
  console.log('Validation success (expected failure):', resultHoopaShiny.legal ? 'Yes ❌' : 'No (Failed as expected) ✅');
  console.log('Errors:', resultHoopaShiny.errors);
  if (resultHoopaShiny.legal) {
    throw new Error('Test 5 failed: Shiny Hoopa should be blocked / shiny locked');
  }
}

runTests().catch(err => {
  console.error('Tests failed with error:', err);
  process.exit(1);
});
