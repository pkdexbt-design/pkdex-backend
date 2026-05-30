import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const dataDir = join(process.cwd(), 'src', 'lib', 'data');
const svPokemon = JSON.parse(readFileSync(join(dataDir, 'sv_pokemon.json'), 'utf8'));

console.log('=== POKEMON WITH ALTERNATIVE FORMS IN SV ===');
const formsList = svPokemon.filter((p: any) => p.form > 0);
console.log(`Total forms: ${formsList.length}`);

for (const p of formsList) {
  console.log(`Species: ${p.species}, Form: ${p.form}, Name: ${p.name}, DisplayName: ${p.displayName}`);
}
