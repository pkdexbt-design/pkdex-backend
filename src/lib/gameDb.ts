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

export const HOME_TRANSFER_LOCATION = 9999999;
export const HOME_TRANSFER_METHOD = 'Pokémon HOME';
export const HOME_TRANSFER_LOCATION_NAME = 'Transferencia Pokémon HOME';

export const HOME_SHINY_NEVER_SPECIES = new Set([
  494, // Victini
  647, // Keldeo
  648, // Meloetta
  720, // Hoopa
  721, // Volcanion
  801, // Magearna
  802, // Marshadow
  893, // Zarude
  905  // Enamorus
]);

export const HOME_SHINY_FORCE_ALLOW = new Set([
  6,   // Charizard
  150, // Mewtwo
  249, // Lugia
  250, // Ho-Oh
  380, // Latias
  381, // Latios
  382, // Kyogre
  383, // Groudon
  384, // Rayquaza
  638, // Cobalion
  639, // Terrakion
  640  // Virizion
]);

export const HOME_LEGENDARY_MIN_LEVEL = 50;
export const HOME_LEGENDARY_SPECIES = new Set([
  144,145,146,150,151,243,244,245,249,250,251,377,378,379,380,381,382,383,384,385,386,
  480,481,482,483,484,485,486,487,488,491,492,493,494,638,639,640,641,642,643,644,645,646,647,648,649,
  716,717,718,719,720,721,772,773,785,786,787,788,789,790,791,792,800,801,802,807,808,809,
  888,889,890,891,892,893,894,895,896,897,898,905,1001,1002,1003,1004,1007,1008,1009,1010,1020,1021,1022,1023,1024,1025
]);

export const HOME_MIN_LEVEL_BY_SPECIES = new Map<number, number>([
  [2,16],[3,32],[5,16],[6,36],[8,16],[9,36],[14,7],[15,10],[17,18],[18,36],[20,20],[22,20],[24,22],[26,1],[28,22],[30,16],[31,16],[33,16],[34,16],[36,1],[38,1],[40,1],[42,22],[45,21],[47,24],[49,31],[51,26],[53,28],[55,33],[57,28],[59,1],[61,25],[62,1],[64,16],[65,36],[67,28],[68,1],[70,21],[71,1],[73,30],[75,25],[76,1],[78,40],[80,37],[82,30],[85,31],[87,34],[89,38],[91,1],[93,25],[94,36],[97,26],[99,28],[101,30],[103,1],[105,28],[110,35],[112,42],[121,1],[130,20],[134,1],[135,1],[136,1],[143,1],
  [153,16],[154,32],[156,14],[157,36],[159,18],[160,30],[162,15],[164,20],[166,18],[168,22],[169,1],[171,27],[176,1],[178,25],[181,30],[182,1],[184,18],[186,1],[189,27],[192,1],[195,20],[196,1],[197,1],[199,37],[205,31],[208,1],[210,23],[212,1],[217,30],[219,38],[221,33],[224,25],[229,24],[230,1],[232,25],[233,1],[242,1],[248,55],
  [253,16],[254,36],[256,16],[257,36],[259,16],[260,36],[262,18],[264,20],[267,10],[269,10],[271,14],[272,1],[274,14],[275,1],[277,22],[279,25],[281,20],[282,30],[284,22],[286,23],[288,18],[289,36],[291,20],[292,20],[294,20],[295,40],[297,24],[301,1],[305,32],[306,42],[308,37],[310,26],[317,26],[319,30],[321,40],[323,33],[326,32],[329,35],[330,45],[332,32],[334,35],[340,30],[342,30],[344,36],[346,40],[348,40],[350,1],[354,37],[356,37],[362,42],[365,44],[367,30],[368,30],[373,50],[376,45],
  [388,18],[389,32],[391,14],[392,36],[394,16],[395,36],[397,14],[398,34],[400,15],[402,10],[404,15],[405,30],[407,1],[409,30],[411,30],[413,20],[414,20],[416,21],[419,26],[421,25],[423,30],[424,1],[426,28],[428,1],[429,1],[430,1],[432,38],[435,34],[437,33],[445,48],[448,1],[450,34],[452,40],[454,37],[457,31],[460,40],[461,1],[462,1],[463,1],[464,1],[465,1],[466,1],[467,1],[468,1],[469,1],[470,1],[471,1],[472,1],[473,1],[474,1],[475,1],[476,1],[477,1],[478,1],
  [496,17],[497,36],[499,17],[500,36],[502,17],[503,36],[505,20],[507,16],[508,32],[510,20],[512,1],[514,1],[516,1],[518,1],[520,21],[521,32],[523,27],[525,25],[526,1],[528,1],[530,31],[533,25],[534,1],[536,25],[537,36],[541,20],[542,1],[544,22],[545,30],[547,1],[549,1],[552,29],[553,40],[555,35],[558,34],[560,39],[563,34],[565,37],[567,37],[569,36],[571,30],[573,1],[576,41],[578,32],[579,41],[581,35],[583,35],[584,47],[586,34],[589,1],[591,39],[593,40],[596,36],[598,1],[601,49],[604,39],[606,42],[608,41],[609,1],[611,38],[612,48],[614,37],[617,1],[620,50],[623,43],[625,52],[628,54],[630,54],[635,64],[637,59],
  [651,16],[652,36],[654,16],[655,36],[657,16],[658,36],[660,20],[662,17],[663,35],[665,9],[666,12],[668,35],[670,19],[671,1],[673,32],[675,32],[678,25],[680,35],[681,1],[683,1],[685,1],[687,30],[689,39],[691,48],[693,37],[695,1],[697,39],[699,39],[700,1],[706,50],[708,30],[709,1],[711,1],[713,37],[715,48],[724,34],[727,34],[730,34],[733,14],[735,20],[738,20],[740,1],[743,25],[745,25],[748,38],[750,30],[752,22],[754,34],[756,24],[758,33],[760,27],[763,29],[768,30],[770,42],[773,1],[784,45],
  [811,16],[812,35],[814,16],[815,35],[817,16],[818,35],[820,24],[822,18],[823,38],[825,10],[826,30],[828,18],[830,20],[832,24],[834,22],[836,25],[839,34],[841,1],[842,1],[844,36],[847,26],[849,30],[851,28],[853,35],[855,1],[858,42],[860,32],[861,42],[863,28],[864,38],[865,1],[866,42],[867,34],[869,30],[873,1],[875,1],[876,1],[877,1],[879,34],[881,1],[882,1],[883,1],[884,60],[887,60],[892,30],[902,1],[904,1],
  [907,16],[908,36],[910,16],[911,36],[913,16],[914,36],[916,18],[920,24],[923,18],[925,25],[930,35],[934,38],[936,1],[937,1],[941,25],[943,30],[945,28],[947,30],[949,35],[952,30],[954,24],[956,35],[959,38],[961,26],[964,38],[966,26],[970,35],[973,35],[975,54],[979,28],[981,32],[982,1],[983,52],[1000,1],[1013,1]
]);

export const HOME_SPECIFIC_PROFILES = [
  {
    species: 383,
    games: ['za','sv'],
    idSuffix: 'event-ultra-shiny-groudon',
    locationName: 'HOME - Evento Ultra Shiny Groudon',
    locationNameEn: 'HOME - Ultra Shiny Groudon Event',
    method: 'HOME Event Transfer',
    originType: 'home-event-transfer',
    levelMin: 60,
    levelMax: 60,
    fixedBall: 'Cherish Ball',
    shiny: 'Always',
    forceShiny: true,
    shinyLocked: false,
    ability: 'Drought',
    nature: 'Random',
    heldItem: null,
    note: 'Perfil HOME específico: evento Ultra Shiny Groudon, Nv. 60, Cherish Ball, naturaleza aleatoria.'
  },
  {
    species: 6,
    games: ['sv','za'],
    idSuffix: 'legal-shiny-charizard-line',
    locationName: 'HOME - Charizard shiny legal de juego anterior',
    locationNameEn: 'HOME - Legal Shiny Charizard from previous game',
    method: 'HOME Legal Transfer',
    originType: 'home-legal-transfer',
    levelMin: 36,
    levelMax: 100,
    fixedBall: null,
    shiny: 'Random',
    shinyLocked: false,
    note: 'Charizard shiny legal por HOME si procede de Charmander/Charmeleon/Charizard legal de un juego anterior. No usa la plantilla shiny locked de 7-Star Raid.'
  }
];

export function homeMinLevelForSpecies(species: number): number {
  const sp = Number(species);
  if (HOME_MIN_LEVEL_BY_SPECIES.has(sp)) return HOME_MIN_LEVEL_BY_SPECIES.get(sp)!;
  if (HOME_LEGENDARY_SPECIES.has(sp)) return HOME_LEGENDARY_MIN_LEVEL;
  return 1;
}

export function homeGenericProfileLabel(species: number): string {
  const sp = Number(species);
  if (HOME_LEGENDARY_SPECIES.has(sp)) return 'HOME - Legendario/Especial legal de juego anterior';
  return 'HOME - Origen legal anterior';
}

export function canUseHomeTransfer(gameId: string, species: number): boolean {
  const g = games[gameId];
  const sp = Number(species);
  if (!g || !Number.isFinite(sp) || sp <= 0) return false;
  const existsInGame = g.pokemon.some(p => Number(p.species) === sp);
  if (!existsInGame) return false;
  return gameId === 'za' || gameId === 'sv';
}

export function canBeShinyViaHome(species: number): boolean {
  const sp = Number(species);
  if (HOME_SHINY_FORCE_ALLOW.has(sp)) return true;
  if (HOME_SHINY_NEVER_SPECIES.has(sp)) return false;
  return true;
}

export function makeHomeTransferEncounters(gameId: string, species: number, form: number = 0): any[] {
  const sp = Number(species);
  const shinyAllowed = canBeShinyViaHome(sp);
  const isSV = gameId === 'sv';
  const base: any[] = [];
  
  for (const profile of HOME_SPECIFIC_PROFILES) {
    if (Number(profile.species) !== sp) continue;
    if (profile.games && !profile.games.includes(gameId)) continue;
    base.push({
      id: `home-${profile.idSuffix}-${gameId}-${sp}-${Number(form||0)}`,
      game: gameId.toUpperCase(),
      version: isSV ? 'Scarlet/Violet' : 'Legends: Z-A',
      source: 'Curated HOME legal origin profile',
      method: profile.method,
      originType: profile.originType,
      requiresLegalOrigin: true,
      species: sp,
      form: Number(form || 0),
      levelMin: profile.levelMin,
      levelMax: profile.levelMax,
      location: `${HOME_TRANSFER_LOCATION}-${profile.idSuffix}`,
      locationName: profile.locationName,
      locationNameEn: profile.locationNameEn,
      gender: 'Random',
      shiny: profile.shiny,
      shinyLocked: Boolean(profile.shinyLocked),
      forceShiny: Boolean(profile.forceShiny),
      canBeShinyViaHome: profile.shiny !== 'Never',
      fixedBall: profile.fixedBall || null,
      allowedBalls: profile.fixedBall ? [profile.fixedBall] : 'AnyLegalTransferBall',
      availableScarlet: true,
      availableViolet: true,
      teraType: isSV ? 'Any' : undefined,
      ability: profile.ability,
      nature: profile.nature || 'Random',
      heldItem: profile.heldItem || null,
      note: profile.note
    });
  }

  base.push({
    id: `home-legal-origin-${gameId}-${sp}-${Number(form||0)}`,
    game: gameId.toUpperCase(),
    version: isSV ? 'Scarlet/Violet' : 'Legends: Z-A',
    source: 'Generic HOME legal origin profile layered over PKHeX species availability',
    method: 'HOME Legal Transfer',
    originType: 'home-legal-transfer',
    requiresLegalOrigin: true,
    species: sp,
    form: Number(form || 0),
    levelMin: homeMinLevelForSpecies(sp),
    levelMax: 100,
    location: `${HOME_TRANSFER_LOCATION}-legal-origin`,
    locationName: homeGenericProfileLabel(sp),
    locationNameEn: 'HOME - Legal previous-game origin',
    gender: 'Random',
    shiny: shinyAllowed ? 'Random' : 'Never',
    shinyLocked: !shinyAllowed,
    canBeShinyViaHome: shinyAllowed,
    fixedBall: null,
    allowedBalls: 'AnyLegalTransferBall',
    availableScarlet: true,
    availableViolet: true,
    teraType: isSV ? 'Any' : undefined,
    note: shinyAllowed
      ? `Origen externo: Este Pokémon se importará mediante transferencia segura. Requiere haber sido obtenido legalmente en juegos previos para evitar bloqueos online.`
      : 'Origen externo: Este Pokémon se importará mediante transferencia segura. La versión shiny está bloqueada porque no existe un método legal de obtención shiny.'
  });
  
  return base;
}

export function encounterDedupeKey(e: any): string {
  return [
    e.method, e.version, e.location, e.locationName, e.levelMin, e.levelMax,
    e.form, e.isAlpha ? 1 : 0, e.shiny || '', e.shinyLocked ? 1 : 0,
    e.fixedBall || '', e.gender || '', e.ability || '', e.teraType || '',
    Array.isArray(e.moves) ? e.moves.join(',') : ''
  ].map(v => String(v ?? '')).join('|');
}

export function dedupeEncounters(list: any[]): any[] {
  const seen = new Set();
  const out = [];
  for (const e of list) {
    const key = encounterDedupeKey(e);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

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
  let list = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
  list = dedupeEncounters(list);
  if (canUseHomeTransfer(gameId, species)) {
    const homes = makeHomeTransferEncounters(gameId, species, form);
    const existing = new Set(list.map((e: any) => e.id));
    for (const home of homes) {
      if (!existing.has(home.id)) list.push(home);
    }
    list = dedupeEncounters(list);
  }
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
      shiny: e.forceShiny ? true : (e.shiny === 'Never' || e.shinyLocked ? false : undefined),
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
  
  if (payload.origin) {
    let allowedMethods: string[] = [];
    switch (payload.origin) {
      case 'Wild Encounter':
      case 'Mass Outbreak':
        allowedMethods = ['Wild', 'Static', 'Fixed Spawn'];
        break;
      case 'Egg':
        allowedMethods = ['Egg'];
        break;
      case 'Tera Raid':
        allowedMethods = ['Raid', 'Tera Raid'];
        break;
      case 'Trade':
        allowedMethods = ['Trade'];
        break;
      case 'In-Game Gift':
        allowedMethods = ['Gift'];
        break;
      case 'Starter':
        allowedMethods = ['Starter'];
        break;
      case 'Event':
        allowedMethods = ['Event'];
        break;
      case 'Pokémon HOME':
        allowedMethods = ['HOME Legal Transfer', 'HOME Event Transfer'];
        break;
      default:
        allowedMethods = [];
    }
    if (allowedMethods.length > 0) {
      candidates = candidates.filter(e => allowedMethods.includes(e.method));
    }
  }

  if (payload.encounterId) {
    candidates = candidates.filter(e => e.id === payload.encounterId);
  }
  if (payload.location !== undefined && payload.location !== '') {
    candidates = candidates.filter(e => {
      const a = e.location;
      const b = payload.location;
      const an = Number(a), bn = Number(b);
      if (Number.isFinite(an) && Number.isFinite(bn)) return an === bn;
      return String(a) === String(b);
    });
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
      legal: false,
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
    if (e.forceShiny && !payload.shiny) {
      errors.push('Este perfil HOME/evento requiere Shiny: Sí.');
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
        legal: true,
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
    legal: false,
    errors: [
      'La combinación no coincide con ningún encuentro legal disponible.',
      ...failures.flatMap(f => f.errors).slice(0, 3)
    ],
    candidates: failures.slice(0, 12)
  };
}
