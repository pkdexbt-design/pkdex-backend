import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { getShowdownSpeciesName } from './showdownBuilder';

// ─── Types ────────────────────────────────────────────────────────────────────

interface HomeEventSysbotCfg {
  speciesLine?: string;
  requiredLines?: string[];
  recommendedLines?: string[];
  natureMode?: 'fixed' | 'selected-or-default';
  fixedNature?: string;
  defaultNature?: string;
  omitGenderIfRandom?: boolean;
  omitHeldItemIfNone?: boolean;
  forceLevel?: number;
  forceShiny?: boolean;
  forceBall?: string;
  notes?: string;
}

interface HomeEventProfile {
  id: string;
  enabled?: boolean;
  species: number;
  speciesName?: string;
  games?: string[];
  match?: {
    originType?: string[];
    locationIncludes?: string[];
    profileIncludes?: string[];
  };
  displayLabel?: string;
  sysbot?: HomeEventSysbotCfg;
  eventFacts?: Record<string, any>;
  source?: string;
}

// ─── Load profiles once ───────────────────────────────────────────────────────

let _homeEventProfiles: HomeEventProfile[] | null = null;

function loadHomeEventProfiles(): HomeEventProfile[] {
  if (_homeEventProfiles) return _homeEventProfiles;
  try {
    const p = join(__dirname, 'data', 'sysbot_home_event_profiles.json');
    if (existsSync(p)) {
      const parsed = JSON.parse(readFileSync(p, 'utf8'));
      _homeEventProfiles = parsed.profiles || [];
    } else {
      console.warn('[HomeEventPatch] sysbot_home_event_profiles.json not found.');
      _homeEventProfiles = [];
    }
  } catch (err: any) {
    console.warn('[HomeEventPatch] Could not load event profiles:', err.message);
    _homeEventProfiles = [];
  }
  return _homeEventProfiles!;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VALID_NATURES = new Set([
  'Hardy','Lonely','Brave','Adamant','Naughty','Bold','Docile','Relaxed','Impish','Lax',
  'Timid','Hasty','Serious','Jolly','Naive','Modest','Mild','Quiet','Bashful','Rash',
  'Calm','Gentle','Sassy','Careful','Quirky',
]);

function cleanStr(value: any): string {
  return String(value ?? '').trim();
}

function includesAny(haystack: string, needles?: string[]): boolean {
  if (!needles || needles.length === 0) return false;
  const h = cleanStr(haystack).toLowerCase();
  return needles.some(n => h.includes(cleanStr(n).toLowerCase()));
}

function normalizeGame(game: any): string {
  const g = cleanStr(game).toLowerCase();
  if (g.includes('scarlet') || g.includes('violet') || g === 'sv') return 'sv';
  if (g.includes('z-a') || g.includes('za') || g.includes('legends')) return 'za';
  return g;
}

function resolveNature(order: any, profile: HomeEventProfile): string {
  const cfg = profile.sysbot || {};
  if (cfg.natureMode === 'fixed' && cfg.fixedNature) return cfg.fixedNature;

  const selected = cleanStr(order.nature);
  if (selected && selected !== 'Random' && VALID_NATURES.has(selected)) return selected;

  const defaultNature = cfg.defaultNature || 'Hardy';
  return VALID_NATURES.has(defaultNature) ? defaultNature : 'Hardy';
}

function isNoneItem(item: any): boolean {
  const v = cleanStr(item).toLowerCase();
  return !v || v === 'none' || v === 'sin objeto' || v === 'no item';
}

// ─── Profile matching ─────────────────────────────────────────────────────────

export function findHomeEventProfile(order: any): HomeEventProfile | undefined {
  const profiles = loadHomeEventProfiles();
  const dexId = Number(order.dexId ?? order.speciesId ?? (typeof order.species === 'number' ? order.species : NaN));
  const game = normalizeGame(order.game ?? order.targetGame);

  // 1. Exact ID match takes priority across ALL profiles first
  if (order.homeProfileId) {
    const exactProfile = profiles.find(profile => 
      profile.enabled !== false &&
      profile.id === order.homeProfileId &&
      (!Number.isFinite(dexId) || Number(profile.species) === dexId) &&
      (!profile.games || profile.games.length === 0 || profile.games.includes(game))
    );
    if (exactProfile) return exactProfile;
  }

  // 2. Fuzzy match fallback
  const locationText = [
    order.homeProfileId,
    order.locationName,
    order.locationNameEn,
    order.location,
    order.encounterLabel,
    order.profile,
    order.method,
    order.originLabel,
    order.displayLabel,
    order.displayName,
  ].filter(Boolean).join(' | ');

  const originType = cleanStr(order.originType ?? order.method ?? '').toLowerCase();

  return profiles.find(profile => {
    if (profile.enabled === false) return false;
    if (Number.isFinite(dexId) && Number(profile.species) !== dexId) return false;

    if (profile.games && profile.games.length > 0 && !profile.games.includes(game)) return false;

    const match = profile.match || {};
    const originOk = !match.originType ||
      match.originType.map(x => cleanStr(x).toLowerCase()).includes(originType) ||
      originType.includes('home');
    const locationOk =
      includesAny(locationText, match.locationIncludes) ||
      includesAny(locationText, match.profileIncludes);

    return originOk && locationOk;
  });
}

/**
 * Checks if there is any active/enabled HOME event profile in sysbot_home_event_profiles.json
 * for the given species ID and game ID.
 */
export function hasEnabledHomeEventProfile(gameId: string, speciesId: number): boolean {
  const profiles = loadHomeEventProfiles();
  const game = normalizeGame(gameId);
  const sp = Number(speciesId);
  return profiles.some(profile => {
    if (profile.enabled === false) return false;
    if (Number(profile.species) !== sp) return false;
    if (profile.games && profile.games.length > 0 && !profile.games.includes(game)) return false;
    return true;
  });
}

// ─── Command builder ──────────────────────────────────────────────────────────

/**
 * Builds a SysBot/Showdown body for HOME/Mystery Gift events.
 * Returns null if the order does not match any known event profile
 * (caller should fall back to normal buildShowdownText).
 * Note: does NOT include the trade command prefix (%trade, !trade, etc.) —
 * the caller (discordDispatcher) is responsible for adding the correct prefix.
 */
export function formatHomeEventSysbotCommand(order: any): string | null {
  const profile = findHomeEventProfile(order);
  if (!profile) return null;

  const cfg = profile.sysbot || {};
  const rawLines: string[] = cfg.requiredLines ?? cfg.recommendedLines ?? [];

  // Split raw lines into: item line, move lines, and other lines
  let heldItem: string | null = null;
  const normalLines: string[] = [];
  const moves: string[] = [];

  for (const line of rawLines) {
    const text = cleanStr(line);
    if (!text) continue;
    if (/^item\s*:/i.test(text)) {
      heldItem = text.replace(/^item\s*:/i, '').trim();
      continue;
    }
    if (text.startsWith('- ')) {
      moves.push(text);
      continue;
    }
    normalLines.push(text);
  }

  // Species line (with optional held item)
  const speciesRaw = cfg.speciesLine ?? getShowdownSpeciesName(order);
  const speciesLine = (heldItem && !isNoneItem(heldItem))
    ? `${speciesRaw} @ ${heldItem}`
    : speciesRaw;

  const lines: string[] = [];
  // No %trade prefix here — discordDispatcher adds the correct prefix
  lines.push(speciesLine);

  // Required lines (Ability, Level, Shiny, Language, OT, TID, Ball)
  for (const line of normalLines) lines.push(line);

  // Nature — never "Random", always resolved
  const nature = resolveNature(order, profile);
  if (nature) lines.push(`${nature} Nature`);

  // Optional lines: Gender, TeraType, Alpha
  const game = normalizeGame(order.game ?? order.targetGame);

  if (!cfg.omitGenderIfRandom) {
    const g = cleanStr(order.gender);
    if (g && g !== 'Random') {
      const genderVal = (g === 'Male' || g === 'Macho' || g === 'M') ? 'Male'
        : (g === 'Female' || g === 'Hembra' || g === 'F') ? 'Female'
        : null;
      if (genderVal) lines.push(`Gender: ${genderVal}`);
    }
  }

  if (game === 'sv' && order.teraType) {
    lines.push(`Tera Type: ${order.teraType}`);
  }

  // Alpha only for ZA and only if encounter is Alpha — events generally aren't
  if (order.alpha === true && game === 'za') {
    lines.push('Alpha: Yes');
  }

  // EVs
  if (order.evMode === 'max') {
    lines.push('EVs: 252 HP / 252 Atk / 4 Spe');
  } else if (order.evMode === 'none') {
    lines.push('EVs: 0 HP / 0 Atk / 0 Def / 0 SpA / 0 SpD / 0 Spe');
  }

  // Moves
  for (const move of moves) lines.push(move);

  return lines.join('\n');
}
