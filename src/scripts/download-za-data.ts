import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

const SIDECAR_URL = 'http://100.90.194.72:5001/export-za';
const OUTPUT_DIR = path.join(__dirname, '../lib/data');

const FORM_VARIETY_MAP: Record<string, string> = {
  "26-1": "raichu-alola",
  "52-1": "meowth-alola",
  "52-2": "meowth-galar",
  "53-1": "persian-alola",
  "79-1": "slowpoke-galar",
  "80-2": "slowbro-galar",
  "83-1": "farfetchd-galar",
  "105-1": "marowak-alola",
  "122-1": "mr-mime-galar",
  "199-1": "slowking-galar",
  "211-1": "qwilfish-hisui",
  "479-1": "rotom-heat",
  "479-2": "rotom-wash",
  "479-3": "rotom-frost",
  "479-4": "rotom-fan",
  "479-5": "rotom-mow",
  "562-1": "yamask-galar",
  "618-1": "stunfisk-galar",
  "664-4": "scatterbug",
  "664-6": "scatterbug",
  "665-4": "spewpa",
  "665-6": "spewpa",
  "665-8": "spewpa",
  "666-4": "vivillon",
  "666-6": "vivillon",
  "669-1": "flabebe",
  "669-2": "flabebe",
  "669-3": "flabebe",
  "669-4": "flabebe",
  "670-1": "floette",
  "670-2": "floette",
  "670-3": "floette",
  "670-4": "floette",
  "670-5": "floette-eternal",
  "671-1": "florges",
  "671-2": "florges",
  "671-3": "florges",
  "671-4": "florges",
  "678-1": "meowstic-female",
  "705-1": "sliggoo-hisui",
  "706-1": "goodra-hisui",
  "710-1": "pumpkaboo-small",
  "710-2": "pumpkaboo-large",
  "710-3": "pumpkaboo-super",
  "713-1": "avalugg-hisui",
  "718-2": "zygarde-complete",
  "849-1": "toxtricity-low-key",
  "876-1": "indeedee-female",
  "931-1": "squawkabilly-blue-plumage",
  "931-2": "squawkabilly-yellow-plumage",
  "931-3": "squawkabilly-white-plumage",
  "978-1": "tatsugiri-droopy",
  "978-2": "tatsugiri-stretchy"
};

const SPANISH_FORM_NAMES: Record<string, string> = {
  "26-1": "Raichu de Alola",
  "52-1": "Meowth de Alola",
  "52-2": "Meowth de Galar",
  "53-1": "Persian de Alola",
  "79-1": "Slowpoke de Galar",
  "80-2": "Slowbro de Galar",
  "83-1": "Farfetch'd de Galar",
  "105-1": "Marowak de Alola",
  "122-1": "Mr. Mime de Galar",
  "199-1": "Slowking de Galar",
  "211-1": "Qwilfish de Hisui",
  "479-1": "Rotom Calor",
  "479-2": "Rotom Lavado",
  "479-3": "Rotom Frío",
  "479-4": "Rotom Ventilador",
  "479-5": "Rotom Cortacésped",
  "562-1": "Yamask de Galar",
  "618-1": "Stunfisk de Galar",
  "664-4": "Scatterbug (Motivo Jardín)",
  "664-6": "Scatterbug (Motivo Ventisca)",
  "665-4": "Spewpa (Motivo Jardín)",
  "665-6": "Spewpa (Motivo Ventisca)",
  "665-8": "Spewpa (Motivo Pradera)",
  "666-4": "Vivillon Motivo Jardín",
  "666-6": "Vivillon Motivo Ventisca",
  "669-1": "Flabébé Flor Amarilla",
  "669-2": "Flabébé Flor Naranja",
  "669-3": "Flabébé Flor Azul",
  "669-4": "Flabébé Flor Blanca",
  "670-1": "Floette Flor Amarilla",
  "670-2": "Floette Flor Naranja",
  "670-3": "Floette Flor Azul",
  "670-4": "Floette Flor Blanca",
  "670-5": "Floette Flor Eterna",
  "671-1": "Florges Flor Amarilla",
  "671-2": "Florges Flor Naranja",
  "671-3": "Florges Flor Azul",
  "671-4": "Florges Flor Blanca",
  "678-1": "Meowstic Hembra",
  "705-1": "Sliggoo de Hisui",
  "706-1": "Goodra de Hisui",
  "710-1": "Pumpkaboo Pequeño",
  "710-2": "Pumpkaboo Grande",
  "710-3": "Pumpkaboo Extragrande",
  "713-1": "Avalugg de Hisui",
  "718-2": "Zygarde Completo",
  "849-1": "Toxtricity Forma Grave",
  "876-1": "Indeedee Hembra",
  "931-1": "Squawkabilly Plumaje Azul",
  "931-2": "Squawkabilly Plumaje Amarillo",
  "931-3": "Squawkabilly Plumaje Blanco",
  "978-1": "Tatsugiri Forma Caída",
  "978-2": "Tatsugiri Forma Recta"
};

// Helper for caching species details so we don't query same species multiple times
const speciesCache: Record<number, { name: string; displayName: string }> = {};
const pokemonCache: Record<string, { types: string[] }> = {};

async function fetchSpeciesName(speciesId: number): Promise<{ name: string; displayName: string }> {
  if (speciesCache[speciesId]) return speciesCache[speciesId];

  try {
    const res = await axios.get(`https://pokeapi.co/api/v2/pokemon-species/${speciesId}`);
    const defaultName = res.data.name;
    const esNameObj = res.data.names.find((n: any) => n.language.name === 'es');
    const esName = esNameObj ? esNameObj.name : defaultName;
    
    speciesCache[speciesId] = {
      name: defaultName,
      displayName: esName
    };
    return speciesCache[speciesId];
  } catch (err: any) {
    console.error(`Error fetching species ${speciesId}: ${err.message}`);
    // Fallback based on typical pokedex IDs if PokeAPI fails
    return { name: `pokemon-${speciesId}`, displayName: `Pokémon ${speciesId}` };
  }
}

async function fetchPokemonTypes(apiName: string, speciesId: number): Promise<string[]> {
  const cacheKey = apiName;
  if (pokemonCache[cacheKey]) return pokemonCache[cacheKey].types;

  try {
    const res = await axios.get(`https://pokeapi.co/api/v2/pokemon/${apiName}`);
    const types = res.data.types.map((t: any) => t.type.name);
    pokemonCache[cacheKey] = { types };
    return types;
  } catch (err: any) {
    console.warn(`Error fetching types for ${apiName}: ${err.message}, attempting species endpoint fallback...`);
    try {
      const res = await axios.get(`https://pokeapi.co/api/v2/pokemon/${speciesId}`);
      const types = res.data.types.map((t: any) => t.type.name);
      pokemonCache[cacheKey] = { types };
      return types;
    } catch {
      return ['normal'];
    }
  }
}

// Convert first character to uppercase
function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

async function run() {
  console.log(`Starting Legends: Z-A database compilation...`);
  console.log(`Fetching from sidecar: ${SIDECAR_URL}`);

  let sidecarData;
  try {
    const res = await axios.get(SIDECAR_URL);
    sidecarData = res.data;
  } catch (err: any) {
    console.error(`Failed to fetch from sidecar: ${err.message}`);
    process.exit(1);
  }

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // 1. Process Locations
  const locationMap: Record<number, string> = {};
  const processedLocations = sidecarData.locations.map((loc: any) => {
    locationMap[loc.value] = loc.text;
    return {
      value: loc.value,
      text: loc.text
    };
  });

  // 2. Identify all unique (species, form) combinations in the dataset
  const uniqueKeys = new Set<string>();
  const addKey = (species: number, form: number) => {
    uniqueKeys.add(`${species}-${form}`);
  };

  for (const area of sidecarData.slots) {
    for (const slot of area.slots) {
      addKey(slot.species, slot.form);
    }
  }

  for (const area of sidecarData.hyperspace) {
    for (const slot of area.slots) {
      addKey(slot.species, slot.form);
    }
  }

  for (const gift of sidecarData.gifts) {
    addKey(gift.species, gift.form);
  }

  for (const st of sidecarData.statics) {
    addKey(st.species, st.form);
  }

  for (const tr of sidecarData.trades) {
    addKey(tr.species, tr.form);
  }

  console.log(`Found ${uniqueKeys.size} unique species/form combinations.`);

  // 3. Resolve details for each unique species/form combo
  const pokemonList: any[] = [];
  const keysArray = Array.from(uniqueKeys);

  // Run in chunks to prevent spamming PokeAPI too fast
  const CHUNK_SIZE = 10;
  for (let i = 0; i < keysArray.length; i += CHUNK_SIZE) {
    const chunk = keysArray.slice(i, i + CHUNK_SIZE);
    console.log(`Processing chunk ${i / CHUNK_SIZE + 1} of ${Math.ceil(keysArray.length / CHUNK_SIZE)}...`);

    await Promise.all(chunk.map(async (key) => {
      const [speciesIdStr, formIdStr] = key.split('-');
      const speciesId = parseInt(speciesIdStr);
      const formId = parseInt(formIdStr);

      const speciesDetails = await fetchSpeciesName(speciesId);
      
      let displayName = speciesDetails.displayName;
      let apiName = speciesDetails.name;

      if (formId > 0) {
        if (SPANISH_FORM_NAMES[key]) {
          displayName = SPANISH_FORM_NAMES[key];
        } else {
          displayName = `${speciesDetails.displayName} (Forma ${formId})`;
        }

        if (FORM_VARIETY_MAP[key]) {
          apiName = FORM_VARIETY_MAP[key];
        }
      }

      const types = await fetchPokemonTypes(apiName, speciesId);
      const capitalizedTypes = types.map(t => capitalize(t));

      // SpriteKey pattern: "0000.png" or "0000-1.png"
      const paddedDex = String(speciesId).padStart(4, '0');
      const spriteKey = formId > 0 ? `${paddedDex}-${formId}` : paddedDex;

      pokemonList.push({
        species: speciesId,
        form: formId,
        name: apiName,
        displayName: displayName,
        dexNumber: speciesId,
        types: capitalizedTypes,
        spriteKey: spriteKey
      });
    }));

    // Small delay between chunks
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  // Sort pokemon list by dex number and form
  pokemonList.sort((a, b) => {
    if (a.dexNumber !== b.dexNumber) return a.dexNumber - b.dexNumber;
    return a.form - b.form;
  });

  // 4. Construct encounter entries
  const encountersList: any[] = [];

  const mapEncounterMethod = (slotName: string) => {
    if (slotName.toLowerCase().includes('gift')) return 'Gift';
    if (slotName.toLowerCase().includes('static')) return 'Static';
    if (slotName.toLowerCase().includes('trade')) return 'Trade';
    if (slotName.toLowerCase().includes('hyperspace')) return 'Hyperspace';
    return 'Wild';
  };

  // Process slots
  for (const area of sidecarData.slots) {
    const locName = locationMap[area.location] || `Ruta ${area.location}`;
    for (const slot of area.slots) {
      encountersList.push({
        species: slot.species,
        form: slot.form,
        game: "Legends: Z-A",
        method: mapEncounterMethod(area.type || slot.name),
        locationId: area.location,
        locationName: locName,
        minLevel: slot.levelMin,
        maxLevel: slot.levelMax,
        alpha: slot.isAlpha,
        shinyLocked: slot.shiny === 'Never',
        fixedBall: slot.fixedBall === 'None' ? null : slot.fixedBall,
        ballRule: slot.fixedBall === 'None' ? 'AnyLegalWildBall' : 'FixedBall'
      });
    }
  }

  // Process hyperspace
  for (const area of sidecarData.hyperspace) {
    const locName = locationMap[area.location] || `Ruta ${area.location}`;
    for (const slot of area.slots) {
      encountersList.push({
        species: slot.species,
        form: slot.form,
        game: "Legends: Z-A",
        method: 'Hyperspace',
        locationId: area.location,
        locationName: locName,
        minLevel: slot.levelMin,
        maxLevel: slot.levelMax,
        alpha: slot.isAlpha,
        shinyLocked: slot.shiny === 'Never',
        fixedBall: slot.fixedBall === 'None' ? null : slot.fixedBall,
        ballRule: slot.fixedBall === 'None' ? 'AnyLegalWildBall' : 'FixedBall'
      });
    }
  }

  // Process gifts
  for (const gift of sidecarData.gifts) {
    const locName = locationMap[gift.location] || `Ubicación ${gift.location}`;
    encountersList.push({
      species: gift.species,
      form: gift.form,
      game: "Legends: Z-A",
      method: 'Gift',
      locationId: gift.location,
      locationName: locName,
      minLevel: gift.levelMin,
      maxLevel: gift.levelMax,
      alpha: gift.isAlpha,
      shinyLocked: gift.shiny === 'Never',
      fixedBall: gift.fixedBall === 'None' ? null : gift.fixedBall,
      ballRule: gift.fixedBall === 'None' ? 'AnyLegalWildBall' : 'FixedBall'
    });
  }

  // Process statics
  for (const st of sidecarData.statics) {
    const locName = locationMap[st.location] || `Ubicación ${st.location}`;
    encountersList.push({
      species: st.species,
      form: st.form,
      game: "Legends: Z-A",
      method: 'Static',
      locationId: st.location,
      locationName: locName,
      minLevel: st.levelMin,
      maxLevel: st.levelMax,
      alpha: st.isAlpha,
      shinyLocked: st.shiny === 'Never',
      fixedBall: st.fixedBall === 'None' ? null : st.fixedBall,
      ballRule: st.fixedBall === 'None' ? 'AnyLegalWildBall' : 'FixedBall'
    });
  }

  // Process trades
  for (const tr of sidecarData.trades) {
    const locName = locationMap[tr.location] || `Ubicación ${tr.location}`;
    encountersList.push({
      species: tr.species,
      form: tr.form,
      game: "Legends: Z-A",
      method: 'Trade',
      locationId: tr.location,
      locationName: locName,
      minLevel: tr.levelMin,
      maxLevel: tr.levelMax,
      alpha: tr.isAlpha,
      shinyLocked: tr.shiny === 'Never',
      fixedBall: tr.fixedBall === 'None' ? null : tr.fixedBall,
      ballRule: tr.fixedBall === 'None' ? 'AnyLegalWildBall' : 'FixedBall'
    });
  }

  // Write files
  fs.writeFileSync(path.join(OUTPUT_DIR, 'za_locations.json'), JSON.stringify(processedLocations, null, 2));
  fs.writeFileSync(path.join(OUTPUT_DIR, 'za_pokemon.json'), JSON.stringify(pokemonList, null, 2));
  fs.writeFileSync(path.join(OUTPUT_DIR, 'za_encounters.json'), JSON.stringify(encountersList, null, 2));

  console.log(`Success! Written to ${OUTPUT_DIR}:`);
  console.log(` - za_locations.json (${processedLocations.length} locations)`);
  console.log(` - za_pokemon.json (${pokemonList.length} species/forms)`);
  console.log(` - za_encounters.json (${encountersList.length} encounters)`);
}

run().catch(err => {
  console.error(`Script error:`, err);
  process.exit(1);
});
