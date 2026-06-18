const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
const { games } = require('../dist/lib/gameDb');

dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL || 'https://owzfcsfykvfzumfqqkjs.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

function mapItems(teamPayload, gameVersion) {
  return teamPayload.map((it) => {
    let resolvedDexId = it.dexId || it.speciesId
    
    // If species is already a number, that is the dexId
    if (typeof it.species === 'number') {
      resolvedDexId = it.species
    }
    
    if (!resolvedDexId && typeof it.species === 'string') {
      const nameLower = it.species.toLowerCase().trim()
      const gKey = (gameVersion === 'legends-za' || gameVersion === 'za') ? 'za' : 'sv'
      const pokemonList = games[gKey]?.pokemon || []
      const found = pokemonList.find((p) =>
        p.name.toLowerCase() === nameLower ||
        p.displayNameEn?.toLowerCase() === nameLower ||
        p.displayName?.toLowerCase() === nameLower
      )
      if (found) {
        resolvedDexId = Number(found.species)
      }
    }
    
    const numericSpecies = resolvedDexId ? Number(resolvedDexId) : 1
    
    let displayName = it.displayName
    if (!displayName) {
      if (typeof it.species === 'string') {
        displayName = it.species
      } else {
        const gKey = (gameVersion === 'legends-za' || gameVersion === 'za') ? 'za' : 'sv'
        const pokemonList = games[gKey]?.pokemon || []
        const found = pokemonList.find((p) => Number(p.species) === numericSpecies)
        displayName = found?.displayName || found?.name || 'Pokémon'
      }
    }

    return {
      ...it,
      status: it.status || 'pending',
      displayName,
      species: numericSpecies
    }
  })
}

async function check() {
  const orderId = '18681c11-454f-416b-bbc8-46561668669f';
  const { data } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single();

  const teamPayload = Array.isArray(data.team_payload) ? data.team_payload : [data.team_payload]
  const items = mapItems(teamPayload, data.game_version);
  console.log('Mapped items:', JSON.stringify(items, null, 2));
}

check();
