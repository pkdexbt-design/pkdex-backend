import * as path from 'path';
import * as fs from 'fs';

const dataDir = path.join(__dirname, 'data');

export interface GameData {
  id: string;
  label: string;
  pokemon: any[];
  meta: any;
  summary: any;
  defaultBalls: string[];
}

export const games: Record<string, GameData> = {
  za: {
    id: 'za',
    label: 'Legends: Z-A',
    pokemon: JSON.parse(fs.readFileSync(path.join(dataDir, 'za_pokemon.json'), 'utf8')),
    meta: JSON.parse(fs.readFileSync(path.join(dataDir, 'za_meta.json'), 'utf8')),
    summary: JSON.parse(fs.readFileSync(path.join(dataDir, 'za_summary.json'), 'utf8')),
    defaultBalls: ['Poke Ball','Great Ball','Ultra Ball','Premier Ball','Heal Ball','Net Ball','Nest Ball','Repeat Ball','Luxury Ball','Dusk Ball','Quick Ball','Timer Ball','Dive Ball','Master Ball'],
  },
  sv: {
    id: 'sv',
    label: 'Scarlet / Violet',
    pokemon: JSON.parse(fs.readFileSync(path.join(dataDir, 'sv_pokemon.json'), 'utf8')),
    meta: JSON.parse(fs.readFileSync(path.join(dataDir, 'sv_meta.json'), 'utf8')),
    summary: JSON.parse(fs.readFileSync(path.join(dataDir, 'sv_summary.json'), 'utf8')),
    defaultBalls: ['Poké Ball','Great Ball','Ultra Ball','Premier Ball','Heal Ball','Net Ball','Nest Ball','Repeat Ball','Luxury Ball','Dusk Ball','Quick Ball','Timer Ball','Dive Ball','Master Ball','Fast Ball','Level Ball','Lure Ball','Heavy Ball','Love Ball','Friend Ball','Moon Ball','Dream Ball','Beast Ball'],
  },
};

export const teraTypes = new Set([
  'Normal','Fire','Water','Electric','Grass','Ice','Fighting','Poison','Ground',
  'Flying','Psychic','Bug','Rock','Ghost','Dragon','Dark','Steel','Fairy'
]);

const encounterCache = new Map<string, any[]>();
const MAX_CACHE = 80;

export function getEncounterFile(gameId: string, species: number, form: number = 0): string {
  return path.join(dataDir, 'encounters', gameId, `${species}-${form}.json`);
}

export function loadEncounters(gameId: string, species: number, form: number = 0): any[] {
  const key = `${gameId}:${species}-${form}`;
  if (encounterCache.has(key)) {
    return encounterCache.get(key)!;
  }
  const file = getEncounterFile(gameId, species, form);
  const list = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
  encounterCache.set(key, list);
  if (encounterCache.size > MAX_CACHE) {
    const firstKey = encounterCache.keys().next().value;
    if (firstKey !== undefined) {
      encounterCache.delete(firstKey);
    }
  }
  return list;
}

export function versionAllowed(e: any, version?: string): boolean {
  const v = String(version || '').toLowerCase();
  if (!v || v === 'scarlet/violet' || v === 'both') return true;
  if (v === 'scarlet' && e.availableScarlet === false) return false;
  if (v === 'violet' && e.availableViolet === false) return false;
  if (e.version && String(e.version).toLowerCase().includes('scarlet') && v === 'violet' && !String(e.version).toLowerCase().includes('violet')) return false;
  if (e.version && String(e.version).toLowerCase().includes('violet') && v === 'scarlet' && !String(e.version).toLowerCase().includes('scarlet')) return false;
  return true;
}

export function getOptions(gameId: string, e: any) {
  const g = games[gameId];
  const fixedBall = e.fixedBall || null;
  const balls = Array.isArray(e.allowedBalls) ? e.allowedBalls : (fixedBall ? [fixedBall] : g.defaultBalls);
  const min = Number(e.levelMin || 1), max = Number(e.levelMax || 100);
  return {
    ...e,
    fixed: {
      ball: fixedBall,
      shiny: e.shiny === 'Never' || e.shinyLocked ? false : undefined,
      alpha: e.isAlpha ? true : undefined,
      level: min === max ? min : undefined,
      gender: ['Male','Female','Genderless'].includes(e.gender) ? e.gender : undefined,
      nature: e.nature && e.nature !== 'Random' ? e.nature : undefined,
      ivs: e.ivs || undefined,
      moves: e.moves || undefined
    },
    selectable: {
      balls,
      shiny: !(e.shiny === 'Never' || e.shinyLocked),
      levelMin: min,
      levelMax: max,
      alpha: Boolean(e.isAlpha)
    }
  };
}

export function validate(gameId: string, payload: any) {
  const species = Number(payload.species ?? payload.speciesId);
  const form = Number(payload.form || 0);
  let candidates = loadEncounters(gameId, species, form);
  
  if (payload.encounterId) {
    candidates = candidates.filter(e => e.id === payload.encounterId);
  }
  if (payload.location !== undefined && payload.location !== '') {
    candidates = candidates.filter(e => Number(e.location) === Number(payload.location));
  }
  if (payload.method) {
    candidates = candidates.filter(e => String(e.method).toLowerCase() === String(payload.method).toLowerCase());
  }
  if (payload.gameVersion) {
    candidates = candidates.filter(e => versionAllowed(e, payload.gameVersion));
  }
  
  if (!candidates.length) {
    return {
      valid: false,
      errors: [`No existe un encuentro legal para ${gameId.toUpperCase()} con esa especie/forma/localización.`]
    };
  }
  
  const failures: any[] = [];
  for (const e of candidates) {
    const errors: string[] = [];
    const min = Number(e.levelMin || 1);
    const max = Number(e.levelMax || 100);
    
    if (payload.level !== undefined) {
      const lvl = Number(payload.level);
      if (lvl < min || lvl > max) errors.push(`Nivel ilegal: debe estar entre ${min} y ${max}.`);
    }
    if (payload.shiny && (e.shiny === 'Never' || e.shinyLocked)) {
      errors.push('Este encuentro está shiny locked.');
    }
    if (payload.alpha !== undefined && Boolean(payload.alpha) !== Boolean(e.isAlpha)) {
      errors.push(`Alpha ilegal: este encuentro ${e.isAlpha ? 'sí' : 'no'} es Alpha.`);
    }
    if (payload.ball && e.fixedBall && payload.ball !== e.fixedBall) {
      errors.push(`Ball ilegal: este encuentro usa ${e.fixedBall}.`);
    }
    if (payload.gender && ['Male','Female','Genderless'].includes(e.gender) && payload.gender !== e.gender) {
      errors.push(`Género ilegal: debe ser ${e.gender}.`);
    }
    if (payload.gameVersion && !versionAllowed(e, payload.gameVersion)) {
      errors.push(`Encuentro no disponible en ${payload.gameVersion}.`);
    }
    if (payload.evMode && !['none','max'].includes(String(payload.evMode))) {
      errors.push('EVs ilegales: usa none o max.');
    }
    if (gameId === 'sv' && payload.teraType && !teraTypes.has(String(payload.teraType))) {
      errors.push('Teratipo ilegal: selecciona uno de los 18 tipos de Scarlet/Violet.');
    }
    
    if (!errors.length) {
      return {
        valid: true,
        errors: [],
        matchedEncounter: getOptions(gameId, e),
        order: { ...payload, game: gameId, validatedAt: new Date().toISOString() }
      };
    }
    
    failures.push({
      encounterId: e.id,
      method: e.method,
      locationName: e.locationName,
      errors,
      fixedOptions: getOptions(gameId, e).fixed
    });
  }
  
  return {
    valid: false,
    errors: [
      'La combinación no coincide con ningún encuentro legal disponible.',
      ...failures.flatMap(f => f.errors).slice(0, 3)
    ],
    candidates: failures.slice(0, 12)
  };
}
