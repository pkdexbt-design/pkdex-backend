import { loadEncounters, validate } from '../lib/gameDb';

async function runTests() {
  console.log('=== RUNNING STARTER FINAL EVOLUTIONS VALIDATION TESTS ===');

  // Test 1: Load encounters for Delphox (655)
  console.log('\n--- Test 1: Load encounters for Delphox (655) ---');
  const delphoxEncounters = loadEncounters('sv', 655);
  const evolvedDelphox = delphoxEncounters.filter(e => e.method === 'Evolved');
  console.log(`Total Delphox encounters: ${delphoxEncounters.length}`);
  console.log(`Evolved Delphox encounters found: ${evolvedDelphox.length}`);
  if (evolvedDelphox.length > 0) {
    console.log('Sample Evolved Encounter ID:', evolvedDelphox[0].id);
    console.log('Sample Evolved Encounter Note:', evolvedDelphox[0].note);
  }

  // Test 2: Validate Delphox (655) at Level 5 (should correct to Level 36)
  console.log('\n--- Test 2: Validate Delphox (655) at Level 5 ---');
  const payloadDelphoxLvl5 = {
    species: 'Delphox',
    speciesId: 655,
    form: 0,
    level: 5,
    shiny: true,
    ball: 'Poké Ball'
  };
  const resultDelphoxLvl5 = validate('sv', payloadDelphoxLvl5);
  console.log('Validation success:', resultDelphoxLvl5.legal);
  if (resultDelphoxLvl5.legal) {
    console.log('Corrected Level:', resultDelphoxLvl5.order.level);
    console.log('Errors:', resultDelphoxLvl5.errors);
  } else {
    console.log('Errors:', resultDelphoxLvl5.errors);
    if (resultDelphoxLvl5.candidates) {
      console.log('Candidates count:', resultDelphoxLvl5.candidates.length);
      console.log('First candidate errors:', resultDelphoxLvl5.candidates[0].errors);
    }
  }

  // Test 3: Validate Charizard (6) at Level 10 (should correct to Level 36)
  console.log('\n--- Test 3: Validate Charizard (6) at Level 10 ---');
  const payloadCharizardLvl10 = {
    species: 'Charizard',
    speciesId: 6,
    form: 0,
    level: 10,
    shiny: true,
    ball: 'Poké Ball'
  };
  const resultCharizardLvl10 = validate('sv', payloadCharizardLvl10);
  console.log('Validation success:', resultCharizardLvl10.legal);
  if (resultCharizardLvl10.legal) {
    console.log('Corrected Level:', resultCharizardLvl10.order.level);
  } else {
    console.log('Errors:', resultCharizardLvl10.errors);
  }

  // Test 4: Validate Venusaur (3) at Level 100 (should remain 100)
  console.log('\n--- Test 4: Validate Venusaur (3) at Level 100 ---');
  const payloadVenusaurLvl100 = {
    species: 'Venusaur',
    speciesId: 3,
    form: 0,
    level: 100,
    shiny: true,
    ball: 'Poké Ball'
  };
  const resultVenusaurLvl100 = validate('sv', payloadVenusaurLvl100);
  console.log('Validation success:', resultVenusaurLvl100.legal);
  if (resultVenusaurLvl100.legal) {
    console.log('Level kept:', resultVenusaurLvl100.order.level);
  } else {
    console.log('Errors:', resultVenusaurLvl100.errors);
  }

  // Test 5: Validate Greninja (658) with no level specified (should assign legal min 36)
  console.log('\n--- Test 5: Validate Greninja (658) with no level ---');
  const payloadGreninjaNoLvl = {
    species: 'Greninja',
    speciesId: 658,
    form: 0,
    shiny: true,
    ball: 'Poké Ball'
  };
  const resultGreninjaNoLvl = validate('sv', payloadGreninjaNoLvl);
  console.log('Validation success:', resultGreninjaNoLvl.legal);
  if (resultGreninjaNoLvl.legal) {
    console.log('Corrected Level:', resultGreninjaNoLvl.order.level);
  } else {
    console.log('Errors:', resultGreninjaNoLvl.errors);
  }
}

runTests().catch(console.error);
