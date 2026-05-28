import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { getShowdownSpeciesName } from './showdownBuilder';
import { hasEnabledHomeEventProfile } from './homeEventPatch';

// En el backend, dataDir está en __dirname/data
const dataDir = join(__dirname, 'data');

export const games: Record<string, any> = {
  za: {
    id: 'za',
    label: 'Legends: Z-A',
    pokemon: JSON.parse(readFileSync(join(dataDir, 'za_pokemon.json'), 'utf8')),
    meta: JSON.parse(readFileSync(join(dataDir, 'za_meta.json'), 'utf8')),
    summary: JSON.parse(readFileSync(join(dataDir, 'za_summary.json'), 'utf8')),
    defaultBalls: ['Poke Ball','Great Ball','Ultra Ball','Premier Ball','Heal Ball','Net Ball','Nest Ball','Repeat Ball','Luxury Ball','Dusk Ball','Quick Ball','Timer Ball','Dive Ball','Master Ball'],
  },
  sv: {
    id: 'sv',
    label: 'Scarlet / Violet',
    pokemon: JSON.parse(readFileSync(join(dataDir, 'sv_pokemon.json'), 'utf8')),
    meta: JSON.parse(readFileSync(join(dataDir, 'sv_meta.json'), 'utf8')),
    summary: JSON.parse(readFileSync(join(dataDir, 'sv_summary.json'), 'utf8')),
    defaultBalls: ['Poké Ball','Great Ball','Ultra Ball','Premier Ball','Heal Ball','Net Ball','Nest Ball','Repeat Ball','Luxury Ball','Dusk Ball','Quick Ball','Timer Ball','Dive Ball','Master Ball','Fast Ball','Level Ball','Lure Ball','Heavy Ball','Love Ball','Friend Ball','Moon Ball','Dream Ball','Beast Ball'],
  },
};

// --- SV HOME EXPANSION PATCH START ---
const SV_HOME_EXPANSION_POKEMON = JSON.parse(readFileSync(join(dataDir, 'sv_home_expansion_pokemon.json'), 'utf8'));
const SV_HOME_EXPANSION_FILE_MAP = JSON.parse(readFileSync(join(dataDir, 'sv_home_expansion_file_map.json'), 'utf8'));
const SV_HOME_EXPANSION_SPECIES = new Set(Object.values(SV_HOME_EXPANSION_FILE_MAP).map((x: any) => Number(x.species)));

function mergePokemonWithoutDuplicates(baseList: any[], extraList: any[]) {
  const seen = new Set(baseList.map(p => `${Number(p.species)}-${Number(p.form || 0)}`));
  const out = [...baseList];
  for (const p of extraList) {
    const key = `${Number(p.species)}-${Number(p.form || 0)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out.sort((a: any, b: any) => Number(a.species) - Number(b.species) || Number(a.form || 0) - Number(b.form || 0));
}

games.sv.pokemon = mergePokemonWithoutDuplicates(games.sv.pokemon, SV_HOME_EXPANSION_POKEMON);
if (games.sv.summary) games.sv.summary.pokemonCount = games.sv.pokemon.length;
if (games.sv.meta?.summary) games.sv.meta.summary.pokemonCount = games.sv.pokemon.length;
// --- SV HOME EXPANSION PATCH END ---

export const combinedMeta = JSON.parse(readFileSync(join(dataDir, 'meta.json'), 'utf8'));

export const itemLists: Record<string, string[]> = {
  za: JSON.parse(readFileSync(join(dataDir, 'items', 'za_items.json'), 'utf8')),
  sv: JSON.parse(readFileSync(join(dataDir, 'items', 'sv_items.json'), 'utf8')),
};

export const ORDER_TTL_SECONDS = 180;
export const SYSBOT_DISCORD_WEBHOOKS: Record<string, string> = {
  za: process.env.DISCORD_WEBHOOK_ZA || process.env.DISCORD_WEBHOOK_URL || '',
  sv: process.env.DISCORD_WEBHOOK_SV || process.env.DISCORD_WEBHOOK_URL || '',
  za_bulk: process.env.DISCORD_WEBHOOK_ZA_BULK || process.env.DISCORD_WEBHOOK_ZA || process.env.DISCORD_WEBHOOK_URL || '',
  sv_bulk: process.env.DISCORD_WEBHOOK_SV_BULK || process.env.DISCORD_WEBHOOK_SV || process.env.DISCORD_WEBHOOK_URL || '',
};

const teraTypes = new Set(['Normal','Fire','Water','Electric','Grass','Ice','Fighting','Poison','Ground','Flying','Psychic','Bug','Rock','Ghost','Dragon','Dark','Steel','Fairy']);
const HOME_TRANSFER_LOCATION = 9999999;
const HOME_TRANSFER_METHOD = 'Pokémon HOME';
const HOME_TRANSFER_LOCATION_NAME = 'Transferencia Pokémon HOME';

const HOME_SHINY_NEVER_SPECIES = new Set([
  494, // Victini
  // 647 Keldeo: tiene evento shiny (Movie 2012 JPN) — removido de shiny-never
  // 648 Meloetta: tiene evento shiny (Mystery Tour JPN) — removido de shiny-never
  720, // Hoopa
  // 801 Magearna: la forma Original Color se obtiene via HOME (no shiny, pero la forma sí se obtiene) — removido
  802, // Marshadow
  893, // Zarude
  905  // Enamorus
]);

export const SV_HOME_SHINY_FILES: Record<number, string> = {
  144: '0144-01 ★ - Articuno - F2270DF1E9CC.pk8',
  145: '0145-01 ★ - Zapdos - B5F817E8AFE3.pk8',
  146: '0146-01 ★ - Moltres - B6184A160BBA.pk8',
  150: '0150 ★ - Mewtwo - 97B4B79FA948.pk6',
  243: '0243 ★ - RAIKOU - 346836D46750.pk4',
  244: '0244 ★ - ENTEI - 32627D5BB510.pk4',
  245: '0245 ★ - SUICUNE - 891442FCBC7E.pk4',
  250: '0250 ★ - Ho-Oh - FB3B64A582E9.pk6',
  382: '0382 ★ - Kyogre - 41F13FAB7818.pk7',
  383: '0383 ★ - Groudon - 470D05B9D0DB.pk7',
  384: '0384 ★ - Rayquaza - 4426B679369F.pk6',
  483: '0483 ★ - Dialga - BEE9204C004C.pk5',
  484: '0484 ★ - Palkia - 5BD5236C00E9.pk5',
  791: '0791 ★ - Solgaleo - AF9DB8E828BA.pk7',
  792: '0792 ★ - Lunala - 8B8332462948.pk7',
  800: '0800 ★ - Necrozma - 091B3E0E66BA.pk7',
};

const HOME_SHINY_FORCE_ALLOW = new Set([
  6,   // Charizard
  150, // Mewtwo
  249, // Lugia
  250, // Ho-Oh
  382, // Kyogre
  383, // Groudon
  384, // Rayquaza
  380, // Latias
  381, // Latios
  638, // Cobalion
  639, // Terrakion
  640  // Virizion
]);

const HOME_LEGENDARY_MIN_LEVEL = 50;
const HOME_LEGENDARY_SPECIES = new Set([
  144,145,146,150,151,243,244,245,249,250,251,377,378,379,380,381,382,383,384,385,386,
  480,481,482,483,484,485,486,487,488,491,492,493,494,638,639,640,641,642,643,644,645,646,647,648,649,
  716,717,718,719,720,721,772,773,785,786,787,788,789,790,791,792,800,801,802,807,808,809,
  888,889,890,891,892,893,894,895,896,897,898,905,1001,1002,1003,1004,1007,1008,1009,1010,1020,1021,1022,1023,1025
]);

const HOME_MIN_LEVEL_BY_SPECIES = new Map<number, number>(Object.entries({
  2:16,3:32,5:16,6:36,8:16,9:36,14:7,15:10,17:18,18:36,20:20,22:20,24:22,26:1,28:22,30:16,31:16,33:16,34:16,36:1,38:1,40:1,42:22,45:21,47:24,49:31,51:26,53:28,55:33,57:28,59:1,61:25,62:1,64:16,65:36,67:28,68:1,70:21,71:1,73:30,75:25,76:1,78:40,80:37,82:30,85:31,87:34,89:38,91:1,93:25,94:36,97:26,99:28,101:30,103:1,105:28,110:35,112:42,121:1,130:20,134:1,135:1,136:1,143:1,
  153:16,154:32,156:14,157:36,159:18,160:30,162:15,164:20,166:18,168:22,169:1,171:27,176:1,178:25,181:30,182:1,184:18,186:1,189:27,192:1,195:20,196:1,197:1,199:37,205:31,208:1,210:23,212:1,217:30,219:38,221:33,224:25,229:24,230:1,232:25,233:1,242:1,248:55,
  253:16,254:36,256:16,257:36,259:16,260:36,262:18,264:20,267:10,269:10,271:14,272:1,274:14,275:1,277:22,279:25,281:20,282:30,284:22,286:23,288:18,289:36,291:20,292:20,294:20,295:40,297:24,301:1,305:32,306:42,308:37,310:26,317:26,319:30,321:40,323:33,326:32,329:35,330:45,332:32,334:35,340:30,342:30,344:36,346:40,348:40,350:1,354:37,356:37,362:42,365:44,367:30,368:30,373:50,376:45,
  388:18,389:32,391:14,392:36,394:16,395:36,397:14,398:34,400:15,402:10,404:15,405:30,407:1,409:30,411:30,413:20,414:20,416:21,419:26,421:25,423:30,424:1,426:28,428:1,429:1,430:1,432:38,435:34,437:33,445:48,448:1,450:34,452:40,454:37,457:31,460:40,461:1,462:1,463:1,464:1,465:1,466:1,467:1,468:1,469:1,470:1,471:1,472:1,473:1,474:1,475:1,476:1,477:1,478:1,
  496:17,497:36,499:17,500:36,502:17,503:36,505:20,507:16,508:32,510:20,512:1,514:1,516:1,518:1,520:21,521:32,523:27,525:25,526:1,528:1,530:31,533:25,534:1,536:25,537:36,541:20,542:1,544:22,545:30,547:1,549:1,552:29,553:40,555:35,558:34,560:39,563:34,565:37,567:37,569:36,571:30,573:1,576:41,578:32,579:41,581:35,583:35,584:47,586:34,589:1,591:39,593:40,596:36,598:1,601:49,604:39,606:42,608:41,609:1,611:38,612:48,614:37,617:1,620:50,623:43,625:52,628:54,630:54,635:64,637:59,
  651:16,652:36,654:16,655:36,657:16,658:36,660:20,662:17,663:35,665:9,666:12,668:35,670:19,671:1,673:32,675:32,678:25,680:35,681:1,683:1,685:1,687:30,689:39,691:48,693:37,695:1,697:39,699:39,700:1,706:50,708:30,709:1,711:1,713:37,715:48,724:34,727:34,730:34,733:14,735:20,738:20,740:1,743:25,745:25,748:38,750:30,752:22,754:34,756:24,758:33,760:27,763:29,768:30,770:42,773:1,784:45,
  811:16,812:35,814:16,815:35,817:16,818:35,820:24,822:18,823:38,825:10,826:30,828:18,830:20,832:24,834:22,836:25,839:34,841:1,842:1,844:36,847:26,849:30,851:28,853:35,855:1,858:42,860:32,861:42,863:28,864:38,865:1,866:42,867:34,869:30,873:1,875:1,876:1,877:1,879:34,881:1,882:1,883:1,884:60,887:60,892:30,902:1,904:1,
  907:16,908:36,910:16,911:36,913:16,914:36,916:18,920:24,923:18,925:25,930:35,934:38,936:1,937:1,941:25,943:30,945:28,947:30,949:35,952:30,954:24,956:35,959:38,961:26,964:38,966:26,970:35,973:35,975:54,979:28,981:32,982:1,983:52,1000:1,1013:1
}).map(([k,v]) => [Number(k), v]) as any);

const HOME_SPECIFIC_PROFILES = [
  {
    species: 718,
    games: ['za'],
    idSuffix: '2018-legends-shiny-zygarde-za',
    homeProfileId: 'home-2018-legends-shiny-zygarde',
    locationName: 'HOME - 2018 Legends Shiny Zygarde',
    locationNameEn: 'HOME - 2018 Legends Shiny Zygarde',
    method: 'HOME Event Transfer',
    originType: 'home-event-transfer',
    levelMin: 60,
    levelMax: 60,
    fixedBall: 'Cherish Ball',
    shiny: 'Always',
    forceShiny: true,
    shinyLocked: false,
    ability: 'Aura Break',
    nature: 'Hardy',
    heldItem: null,
    note: 'Zygarde shiny de evento 2018 Legends Nv. 60, Cherish Ball.'
  },
  {
    species: 382,
    games: ['za', 'sv'],
    idSuffix: 'ultra-shiny-kyogre-jpn',
    homeProfileId: 'home-ultra-shiny-kyogre-jpn',
    locationName: 'HOME - Evento Ultra Shiny Kyogre JPN',
    locationNameEn: 'HOME - Ultra Shiny Kyogre Event JPN',
    method: 'HOME Event Transfer',
    originType: 'home-event-transfer',
    levelMin: 60,
    levelMax: 60,
    fixedBall: 'Cherish Ball',
    shiny: 'Always',
    forceShiny: true,
    shinyLocked: false,
    ability: 'Drizzle',
    nature: 'Modest',
    heldItem: null,
    note: 'Kyogre shiny de evento JPN, Nv. 60, Cherish Ball, naturaleza Modesta.'
  },
  {
    species: 384,
    games: ['za'],
    idSuffix: 'shiny-rayquaza-za',
    homeProfileId: 'home-shiny-rayquaza-za',
    locationName: 'HOME - Shiny Rayquaza',
    locationNameEn: 'HOME - Shiny Rayquaza',
    method: 'HOME Legal Transfer',
    originType: 'home-legal-transfer',
    levelMin: 70,
    levelMax: 70,
    fixedBall: null,
    shiny: 'Always',
    forceShiny: true,
    shinyLocked: false,
    ability: 'Air Lock',
    nature: 'Jolly',
    heldItem: null,
    note: 'Rayquaza shiny de transferencia HOME Nv. 70, naturaleza Jolly.'
  },
  {
    species: 383,
    games: ['za','sv'],
    idSuffix: 'event-ultra-shiny-groudon-jpn',
    homeProfileId: 'home-ultra-shiny-groudon-jpn',
    locationName: 'HOME - Evento Ultra Shiny Groudon JPN',
    locationNameEn: 'HOME - Ultra Shiny Groudon Event JPN',
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
    note: 'Perfil HOME específico: evento Ultra Shiny Groudon JPN, Nv. 60, Cherish Ball, naturaleza aleatoria.'
  },
  {
    species: 721,
    games: ['za'],
    idSuffix: 'home-dex-completion-shiny-volcanion-za',
    homeProfileId: 'home-dex-completion-shiny-volcanion-za',
    locationName: 'HOME - Recompensa Pokédex Z-A Shiny Volcanion',
    locationNameEn: 'HOME - Z-A Pokédex Completion Shiny Volcanion',
    method: 'HOME Event Transfer',
    originType: 'home-event-transfer',
    levelMin: 50,
    levelMax: 50,
    fixedBall: 'Cherish Ball',
    shiny: 'Always',
    forceShiny: true,
    shinyLocked: false,
    ability: 'Water Absorb',
    nature: 'Modest',
    heldItem: null,
    note: 'Perfil HOME específico: recompensa de Pokémon HOME por completar las Pokédex de Legends: Z-A.'
  },
  {
    species: 6,
    games: ['sv','za'],
    idSuffix: 'legal-shiny-charizard-line',
    homeProfileId: 'home-legal-shiny-charizard-line',
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
  },
  {
    species: 150,
    games: ['za', 'sv'],
    idSuffix: 'movie-shiny-mewtwo-jpn',
    homeProfileId: 'home-movie-shiny-mewtwo-jpn',
    locationName: 'HOME - Movie Shiny Mewtwo JPN',
    locationNameEn: 'HOME - Movie Shiny Mewtwo JPN',
    method: 'HOME Event Transfer',
    originType: 'home-event-transfer',
    levelMin: 70,
    levelMax: 70,
    fixedBall: 'Cherish Ball',
    shiny: 'Always',
    forceShiny: true,
    shinyLocked: false,
    ability: 'Pressure',
    nature: 'Random',
    heldItem: null,
    note: 'Mewtwo shiny de evento de película JPN. Nivel fijo 70, Cherish Ball.'
  },
  {
    species: 485,
    games: ['za', 'sv'],
    idSuffix: 'summit-shiny-heatran-jpn',
    homeProfileId: 'home-summit-shiny-heatran-jpn',
    locationName: 'HOME - Summit Shiny Heatran JPN',
    locationNameEn: 'HOME - Summit Shiny Heatran JPN',
    method: 'HOME Event Transfer',
    originType: 'home-event-transfer',
    levelMin: 70,
    levelMax: 70,
    fixedBall: 'Cherish Ball',
    shiny: 'Always',
    forceShiny: true,
    shinyLocked: false,
    ability: 'Flash Fire',
    nature: 'Random',
    heldItem: 'Shuca Berry',
    note: 'Heatran shiny de evento Pokémon Summit JPN.'
  },
  {
    species: 647,
    games: ['za'],
    idSuffix: 'movie-shiny-keldeo-jpn',
    homeProfileId: 'home-movie-shiny-keldeo-jpn',
    locationName: 'HOME - Movie Shiny Keldeo JPN',
    locationNameEn: 'HOME - Movie Shiny Keldeo JPN',
    method: 'HOME Event Transfer',
    originType: 'home-event-transfer',
    levelMin: 50,
    levelMax: 50,
    fixedBall: 'Cherish Ball',
    shiny: 'Always',
    forceShiny: true,
    shinyLocked: false,
    ability: 'Justified',
    nature: 'Naive',
    heldItem: null,
    note: 'Keldeo shiny de evento de película JPN. Forma Ordinaria.'
  },
  {
    species: 491,
    games: ['za'],
    idSuffix: 'alerts-shiny-darkrai-jpn',
    homeProfileId: 'home-alerts-shiny-darkrai-jpn',
    locationName: 'HOME - Alerts Shiny Darkrai JPN',
    locationNameEn: 'HOME - Alerts Shiny Darkrai JPN',
    method: 'HOME Event Transfer',
    originType: 'home-event-transfer',
    levelMin: 50,
    levelMax: 50,
    fixedBall: 'Cherish Ball',
    shiny: 'Always',
    forceShiny: true,
    shinyLocked: false,
    ability: 'Bad Dreams',
    nature: 'Random',
    heldItem: 'Enigma Berry',
    note: 'Darkrai shiny de evento Pokémon Alerts JPN.'
  },
  {
    species: 648,
    games: ['za'],
    idSuffix: 'sinnoh-shiny-meloetta-jpn',
    homeProfileId: 'home-sinnoh-shiny-meloetta-jpn',
    locationName: 'HOME - Sinnoh Shiny Meloetta JPN',
    locationNameEn: 'HOME - Sinnoh Shiny Meloetta JPN',
    method: 'HOME Event Transfer',
    originType: 'home-event-transfer',
    levelMin: 50,
    levelMax: 50,
    fixedBall: 'Cherish Ball',
    shiny: 'Always',
    forceShiny: true,
    shinyLocked: false,
    ability: 'Serene Grace',
    nature: 'Random',
    heldItem: null,
    note: 'Meloetta shiny de evento Mystery Tour JPN. Forma Aria.'
  },
  {
    species: 801,
    games: ['za'],
    idSuffix: 'original-color-magearna',
    homeProfileId: 'home-original-color-magearna',
    locationName: 'HOME - Magearna Original Color (Vetusta)',
    locationNameEn: 'HOME - Magearna Original Color',
    method: 'HOME Event Transfer',
    originType: 'home-event-transfer',
    levelMin: 50,
    levelMax: 50,
    fixedBall: 'Cherish Ball',
    shiny: 'Never',
    forceShiny: false,
    shinyLocked: true,
    ability: 'Soul-Heart',
    nature: 'Random',
    heldItem: null,
    note: 'Magearna forma Original Color (Vetusta). Obtenida via HOME al completar la Pokédex Nacional. NO es shiny.'
  },
  {
    species: 808,
    games: ['za'],
    idSuffix: 'shiny-meltan-go',
    homeProfileId: 'home-shiny-meltan',
    locationName: 'HOME - Shiny Meltan (GO Transfer)',
    locationNameEn: 'HOME - Shiny Meltan (GO Transfer)',
    method: 'HOME Event Transfer',
    originType: 'home-event-transfer',
    levelMin: 1,
    levelMax: 1,
    fixedBall: 'Poke Ball',
    shiny: 'Always',
    forceShiny: true,
    shinyLocked: false,
    ability: 'Magnet Pull',
    nature: 'Random',
    heldItem: null,
    note: 'Meltan shiny transferido de Pokémon GO via HOME.'
  },
  {
    species: 809,
    games: ['za'],
    idSuffix: 'shiny-melmetal-go',
    homeProfileId: 'home-shiny-melmetal',
    locationName: 'HOME - Shiny Melmetal (GO Transfer)',
    locationNameEn: 'HOME - Shiny Melmetal (GO Transfer)',
    method: 'HOME Event Transfer',
    originType: 'home-event-transfer',
    levelMin: 1,
    levelMax: 1,
    fixedBall: 'Poke Ball',
    shiny: 'Always',
    forceShiny: true,
    shinyLocked: false,
    ability: 'Iron Fist',
    nature: 'Random',
    heldItem: null,
    note: 'Melmetal shiny transferido de Pokémon GO via HOME.'
  },
  {
    species: 1007,
    games: ['sv'],
    idSuffix: 'event-shiny-koraidon-sv',
    homeProfileId: 'home-event-shiny-koraidon-sv',
    locationName: 'HOME - Evento Shiny Koraidon (Violet Serial Code)',
    locationNameEn: 'HOME - Shiny Koraidon Event (Violet Serial Code)',
    method: 'HOME Event Transfer',
    originType: 'home-event-transfer',
    levelMin: 100,
    levelMax: 100,
    fixedBall: 'Cherish Ball',
    shiny: 'Always',
    forceShiny: true,
    shinyLocked: false,
    ability: 'Orichalcum Pulse',
    nature: 'Adamant',
    heldItem: null,
    note: 'Koraidon shiny del evento Serial Code de Violet/Legends Z-A.'
  },
  {
    species: 1008,
    games: ['sv'],
    idSuffix: 'event-shiny-miraidon-sv',
    homeProfileId: 'home-event-shiny-miraidon-sv',
    locationName: 'HOME - Evento Shiny Miraidon (Scarlet Serial Code)',
    locationNameEn: 'HOME - Shiny Miraidon Event (Scarlet Serial Code)',
    method: 'HOME Event Transfer',
    originType: 'home-event-transfer',
    levelMin: 100,
    levelMax: 100,
    fixedBall: 'Cherish Ball',
    shiny: 'Always',
    forceShiny: true,
    shinyLocked: false,
    ability: 'Hadron Engine',
    nature: 'Modest',
    heldItem: null,
    note: 'Miraidon shiny del evento Serial Code de Scarlet/Legends Z-A.'
  },
  {
    species: 1001,
    games: ['sv'],
    idSuffix: 'event-shiny-wo-chien-sv',
    homeProfileId: 'home-event-shiny-wo-chien-sv',
    locationName: 'HOME - Evento Shiny Wo-Chien (Mystery Gift)',
    locationNameEn: 'HOME - Shiny Wo-Chien Event (Mystery Gift)',
    method: 'HOME Event Transfer',
    originType: 'home-event-transfer',
    levelMin: 75,
    levelMax: 75,
    fixedBall: 'Cherish Ball',
    shiny: 'Always',
    forceShiny: true,
    shinyLocked: false,
    ability: 'Tablets of Ruin',
    nature: 'Calm',
    heldItem: null,
    note: 'Wo-Chien shiny del evento de regalo misterioso de Paldea.'
  },
  {
    species: 1002,
    games: ['sv'],
    idSuffix: 'event-shiny-chien-pao-sv',
    homeProfileId: 'home-event-shiny-chien-pao-sv',
    locationName: 'HOME - Evento Shiny Chien-Pao (Mystery Gift)',
    locationNameEn: 'HOME - Shiny Chien-Pao Event (Mystery Gift)',
    method: 'HOME Event Transfer',
    originType: 'home-event-transfer',
    levelMin: 75,
    levelMax: 75,
    fixedBall: 'Cherish Ball',
    shiny: 'Always',
    forceShiny: true,
    shinyLocked: false,
    ability: 'Sword of Ruin',
    nature: 'Adamant',
    heldItem: null,
    note: 'Chien-Pao shiny del evento de regalo misterioso de Paldea.'
  },
  {
    species: 1003,
    games: ['sv'],
    idSuffix: 'event-shiny-ting-lu-sv',
    homeProfileId: 'home-event-shiny-ting-lu-sv',
    locationName: 'HOME - Evento Shiny Ting-Lu (Mystery Gift)',
    locationNameEn: 'HOME - Shiny Ting-Lu Event (Mystery Gift)',
    method: 'HOME Event Transfer',
    originType: 'home-event-transfer',
    levelMin: 75,
    levelMax: 75,
    fixedBall: 'Cherish Ball',
    shiny: 'Always',
    forceShiny: true,
    shinyLocked: false,
    ability: 'Vessel of Ruin',
    nature: 'Impish',
    heldItem: null,
    note: 'Ting-Lu shiny del evento de regalo misterioso de Paldea.'
  },
  {
    species: 1004,
    games: ['sv'],
    idSuffix: 'event-shiny-chi-yu-sv',
    homeProfileId: 'home-event-shiny-chi-yu-sv',
    locationName: 'HOME - Evento Shiny Chi-Yu (Mystery Gift)',
    locationNameEn: 'HOME - Shiny Chi-Yu Event (Mystery Gift)',
    method: 'HOME Event Transfer',
    originType: 'home-event-transfer',
    levelMin: 75,
    levelMax: 75,
    fixedBall: 'Cherish Ball',
    shiny: 'Always',
    forceShiny: true,
    shinyLocked: false,
    ability: 'Beads of Ruin',
    nature: 'Modest',
    heldItem: null,
    note: 'Chi-Yu shiny del evento de regalo misterioso de Paldea.'
  },
  {
    species: 648,
    games: ['sv'],
    idSuffix: 'event-shiny-meloetta-sv',
    homeProfileId: 'home-event-shiny-meloetta-sv',
    locationName: 'HOME - Shiny Meloetta (Recompensa Pokédex)',
    locationNameEn: 'HOME - Shiny Meloetta (Pokédex Reward)',
    method: 'HOME Event Transfer',
    originType: 'home-event-transfer',
    levelMin: 50,
    levelMax: 50,
    fixedBall: 'Cherish Ball',
    shiny: 'Always',
    forceShiny: true,
    shinyLocked: false,
    ability: 'Serene Grace',
    nature: 'Modest',
    heldItem: null,
    note: 'Meloetta shiny obtenida como recompensa de HOME al completar la Pokédex de SV.'
  },
  {
    species: 384,
    games: ['sv'],
    idSuffix: 'event-shiny-rayquaza-sv-raid',
    homeProfileId: 'home-event-shiny-rayquaza-sv-raid',
    locationName: 'HOME - Shiny Rayquaza (Tera Raid SV)',
    locationNameEn: 'HOME - Shiny Rayquaza (Tera Raid SV)',
    method: 'HOME Event Transfer',
    originType: 'home-event-transfer',
    levelMin: 75,
    levelMax: 75,
    fixedBall: 'Poke Ball',
    shiny: 'Always',
    forceShiny: true,
    shinyLocked: false,
    ability: 'Air Lock',
    nature: 'Hardy',
    heldItem: null,
    note: 'Rayquaza shiny de evento de Tera Incursión de SV (Poke Portal Event #82).'
  },
  {
    species: 999,
    games: ['sv'],
    idSuffix: 'event-shiny-gimmighoul-sv-raid',
    homeProfileId: 'home-event-shiny-gimmighoul-sv-raid',
    locationName: 'HOME - Shiny Gimmighoul (Tera Raid SV)',
    locationNameEn: 'HOME - Shiny Gimmighoul (Tera Raid SV)',
    method: 'HOME Event Transfer',
    originType: 'home-event-transfer',
    levelMin: 75,
    levelMax: 75,
    fixedBall: 'Poke Ball',
    shiny: 'Always',
    forceShiny: true,
    shinyLocked: false,
    ability: 'Rattled',
    nature: 'Hardy',
    heldItem: null,
    note: 'Gimmighoul shiny Chest Form de evento de Tera Incursión de SV (Spotlight Returns).'
  }
];

export interface StarterEvolutionProfile {
  finalName: string;
  baseSpecies: number;
  baseName: string;
  minLevel: number;
}

export const SV_STARTER_FINAL_EVOLUTION_PROFILES = new Map<number, StarterEvolutionProfile>([
  [3,   { finalName: 'Venusaur',    baseSpecies: 1,   baseName: 'Bulbasaur',  minLevel: 32 }],
  [6,   { finalName: 'Charizard',   baseSpecies: 4,   baseName: 'Charmander', minLevel: 36 }],
  [9,   { finalName: 'Blastoise',   baseSpecies: 7,   baseName: 'Squirtle',   minLevel: 36 }],
  [154, { finalName: 'Meganium',    baseSpecies: 152, baseName: 'Chikorita',  minLevel: 32 }],
  [157, { finalName: 'Typhlosion',  baseSpecies: 155, baseName: 'Cyndaquil',  minLevel: 36 }],
  [160, { finalName: 'Feraligatr',  baseSpecies: 158, baseName: 'Totodile',   minLevel: 30 }],
  [254, { finalName: 'Sceptile',    baseSpecies: 252, baseName: 'Treecko',    minLevel: 36 }],
  [257, { finalName: 'Blaziken',    baseSpecies: 255, baseName: 'Torchic',    minLevel: 36 }],
  [260, { finalName: 'Swampert',    baseSpecies: 258, baseName: 'Mudkip',     minLevel: 36 }],
  [389, { finalName: 'Torterra',    baseSpecies: 387, baseName: 'Turtwig',    minLevel: 32 }],
  [392, { finalName: 'Infernape',   baseSpecies: 390, baseName: 'Chimchar',   minLevel: 36 }],
  [395, { finalName: 'Empoleon',    baseSpecies: 393, baseName: 'Piplup',     minLevel: 36 }],
  [497, { finalName: 'Serperior',   baseSpecies: 495, baseName: 'Snivy',      minLevel: 36 }],
  [500, { finalName: 'Emboar',      baseSpecies: 498, baseName: 'Tepig',      minLevel: 36 }],
  [503, { finalName: 'Samurott',    baseSpecies: 501, baseName: 'Oshawott',   minLevel: 36 }],
  [652, { finalName: 'Chesnaught',  baseSpecies: 650, baseName: 'Chespin',    minLevel: 36 }],
  [655, { finalName: 'Delphox',     baseSpecies: 653, baseName: 'Fennekin',   minLevel: 36 }],
  [658, { finalName: 'Greninja',    baseSpecies: 656, baseName: 'Froakie',    minLevel: 36 }],
  [724, { finalName: 'Decidueye',   baseSpecies: 722, baseName: 'Rowlet',     minLevel: 34 }],
  [727, { finalName: 'Incineroar',  baseSpecies: 725, baseName: 'Litten',     minLevel: 34 }],
  [730, { finalName: 'Primarina',   baseSpecies: 728, baseName: 'Popplio',    minLevel: 34 }],
  [812, { finalName: 'Rillaboom',   baseSpecies: 810, baseName: 'Grookey',    minLevel: 35 }],
  [815, { finalName: 'Cinderace',   baseSpecies: 813, baseName: 'Scorbunny',  minLevel: 35 }],
  [818, { finalName: 'Inteleon',    baseSpecies: 816, baseName: 'Sobble',     minLevel: 35 }],
  [908, { finalName: 'Meowscarada', baseSpecies: 906, baseName: 'Sprigatito', minLevel: 36 }],
  [911, { finalName: 'Skeledirge',  baseSpecies: 909, baseName: 'Fuecoco',    minLevel: 36 }],
  [914, { finalName: 'Quaquaval',   baseSpecies: 912, baseName: 'Quaxly',     minLevel: 36 }],
]);

export function makeSvStarterFinalEvolvedEncounters(species: number, form = 0): any[] {
  const sp = Number(species);
  if (Number(form || 0) !== 0) return [];
  const profile = SV_STARTER_FINAL_EVOLUTION_PROFILES.get(sp);
  if (!profile) return [];

  const out: any[] = [];

  // 1) Origen huevo: siempre es una ruta segura para iniciales con crianza legal en SV.
  out.push({
    id: `sv-starter-final-hatched-${sp}-from-${profile.baseSpecies}`,
    game: 'SV',
    version: 'Scarlet/Violet',
    source: 'PKDEX patch - starter final evolved from legal egg origin',
    method: 'Evolved',
    originMethod: 'Hatched',
    species: sp,
    speciesName: profile.finalName,
    speciesNameEn: profile.finalName,
    form: 0,
    levelMin: profile.minLevel,
    levelMax: 100,
    location: 6,
    locationName: `South Province (Area One) - evolucionado desde ${profile.baseName}`,
    locationNameEn: `South Province (Area One) - evolved from ${profile.baseName}`,
    gender: 'Random',
    genderCode: 255,
    shiny: 'Random',
    shinyLocked: false,
    isAlpha: false,
    fixedBall: null,
    allowedBalls: 'AnyLegalTransferBall',
    flawlessIVCount: 0,
    nature: 'Random',
    evolved: true,
    evolvedFromSpecies: profile.baseSpecies,
    evolvedFromForm: 0,
    evolvedFromName: profile.baseName,
    note: `${profile.finalName} shiny legal como ${profile.baseName} shiny nacido de huevo y evolucionado. Nivel mínimo forzado: ${profile.minLevel}.`
  });

  // 2) Origen salvaje del DLC/Terarium: hereda los encuentros Wild shiny-validos de la forma base.
  const baseFile = encounterFile('sv', profile.baseSpecies, 0);
  const baseList = existsSync(baseFile) ? JSON.parse(readFileSync(baseFile, 'utf8')) : [];
  for (const e of baseList) {
    if (String(e.method || '') !== 'Wild') continue;
    if (e.shiny === 'Never' || e.shinyLocked) continue;
    const min = Math.max(profile.minLevel, Number(e.levelMin || profile.minLevel));
    const max = Math.max(min, Number(e.levelMax || 100));
    out.push({
      ...e,
      id: `sv-starter-final-evolved-${sp}-from-${e.id}`,
      source: `${e.source || 'SV encounter'} + PKDEX starter-final evolution patch`,
      method: 'Evolved',
      originMethod: e.method,
      species: sp,
      speciesName: profile.finalName,
      speciesNameEn: profile.finalName,
      form: 0,
      levelMin: min,
      levelMax: max,
      shiny: 'Random',
      shinyLocked: false,
      evolved: true,
      evolvedFromSpecies: profile.baseSpecies,
      evolvedFromForm: 0,
      evolvedFromName: profile.baseName,
      locationName: `${e.locationName || 'Origen salvaje'} - evolucionado desde ${profile.baseName}`,
      locationNameEn: `${e.locationNameEn || e.locationName || 'Wild origin'} - evolved from ${profile.baseName}`,
      note: `${profile.finalName} shiny legal como ${profile.baseName} shiny capturado en ${e.locationName || 'origen salvaje'} y evolucionado. Nivel mínimo forzado: ${profile.minLevel}.`
    });
  }
  return out;
}


export function homeMinLevelForSpecies(species: number): number {
  const sp = Number(species);
  if (HOME_MIN_LEVEL_BY_SPECIES.has(sp)) return HOME_MIN_LEVEL_BY_SPECIES.get(sp)!;
  if (HOME_LEGENDARY_SPECIES.has(sp)) return HOME_LEGENDARY_MIN_LEVEL;
  return 1;
}

export function homeGenericProfileLabel(species: number): string {
  const sp = Number(species);
  if (HOME_LEGENDARY_SPECIES.has(sp)) return 'HOME - Legendario/Especial legal de juego anterior';
  return 'HOME - Origen legal anterior validable por PKHeX';
}

const encounterCache = new Map<string, any[]>();
const MAX_CACHE = 80;

export function canUseHomeTransfer(gameId: string, species: number, hasNoNativeEncounters = false): boolean {
  const g = games[gameId];
  const sp = Number(species);
  if (!g || !Number.isFinite(sp) || sp <= 0) return false;

  // Patch SV HOME Expansion: estas especies se activan solo por HOME/archivo fijo.
  if (gameId === 'sv' && SV_HOME_EXPANSION_SPECIES.has(sp)) return true;

  const existsInGame = g.pokemon.some((p: any) => Number(p.species) === sp);
  if (!existsInGame) return false;
  
  if (gameId !== 'za' && gameId !== 'sv') return false;

  // Block HOME transfer for these specific species in Scarlet/Violet completely
  if (gameId === 'sv') {
    const blockedHomeSpecies = new Set([
      891,  // Kubfu
      892,  // Urshifu
      1009, // Walking Wake
      1010, // Iron Leaves
      1020, // Gouging Fire
      1021, // Raging Bolt
      1022, // Iron Boulder
      1023  // Iron Crown
    ]);
    if (blockedHomeSpecies.has(sp)) return false;
  }

  // 1. If it has an active/enabled HOME event profile
  if (hasEnabledHomeEventProfile(gameId, sp)) return true;

  // 2. If it is a legendary or mythical species
  if (HOME_LEGENDARY_SPECIES.has(sp)) return true;

  // 3. If there are no native encounters in the game
  if (hasNoNativeEncounters) return true;

  return false;
}

export function canBeShinyViaHome(species: number, gameId?: string): boolean {
  const sp = Number(species);
  const g = gameId ? String(gameId).toLowerCase() : null;
  
  if (g === 'sv') {
    const svBlockedHomeShiny = new Set([
      249,  // Lugia
      380,  // Latias
      381,  // Latios
      638,  // Cobalion
      639,  // Terrakion
      640,  // Virizion
      643,  // Reshiram
      644,  // Zekrom
      646,  // Kyurem
      891,  // Kubfu
      892,  // Urshifu
      896,  // Glastrier
      897,  // Spectrier
      898,  // Calyrex
      1009, // Walking Wake
      1010, // Iron Leaves
      1020, // Gouging Fire
      1021, // Raging Bolt
      1022, // Iron Boulder
      1023  // Iron Crown
    ]);
    if (svBlockedHomeShiny.has(sp)) return false;
  }

  if (HOME_SHINY_FORCE_ALLOW.has(sp)) return true;
  if (HOME_SHINY_NEVER_SPECIES.has(sp)) return false;
  return true;
}

export function makeHomeTransferEncounters(gameId: string, species: number, form = 0) {
  const sp = Number(species);
  const fm = Number(form || 0);
  const shinyAllowed = canBeShinyViaHome(sp, gameId);
  const isSV = gameId === 'sv';
  const base = [];

  // --- SV HOME EXPANSION PATCH START ---
  // Para estas especies nuevas, el encuentro HOME no genera un set Showdown.
  // Genera una opcion fija y despues createSingleOrder adjunta el archivo correspondiente.
  const expansionKey = `${sp}-${fm}`;
  const expansion = gameId === 'sv' ? SV_HOME_EXPANSION_FILE_MAP[expansionKey] : null;
  if (expansion) {
    const isShinyFile = expansion.mode === 'shiny';
    base.push({
      id: `sv-home-expansion-file-${expansionKey}`,
      game: 'SV',
      version: 'Scarlet/Violet',
      source: 'SV HOME expansion fixed file',
      method: expansion.method,
      originType: 'home-fixed-file-transfer',
      requiresLegalOrigin: true,
      usesFixedFile: true,
      fixedFileName: expansion.fileName,
      species: sp,
      form: fm,
      levelMin: isShinyFile ? 50 : 1,
      levelMax: 100,
      location: `sv-home-expansion-${expansionKey}`,
      locationName: expansion.method,
      locationNameEn: expansion.method,
      gender: 'Random',
      shiny: isShinyFile ? 'Always' : 'Never',
      shinyLocked: !isShinyFile,
      forceShiny: isShinyFile,
      canBeShinyViaHome: isShinyFile,
      fixedBall: null,
      allowedBalls: 'FixedByFile',
      availableScarlet: true,
      availableViolet: true,
      teraType: 'FixedByFile',
      nature: 'FixedByFile',
      heldItem: null,
      note: `Este Pokemon se entrega por archivo fijo HOME. La web debe enviar solo %trade CODIGO y adjuntar: ${expansion.fileName}. ${expansion.originNote || ''}`
    });
    return base;
  }
  // --- SV HOME EXPANSION PATCH END ---

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
      note: profile.note,
      homeProfileId: profile.homeProfileId || null
    });
  }
  if (base.length === 0) {
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
        ? `Origen HOME: shiny permitido solo si procede de una fuente legal previa. Nivel mínimo aplicado: ${homeMinLevelForSpecies(sp)}. La validación final del origen/met data debe hacerla PKHeX/SysBot.`
        : 'Origen HOME: shiny bloqueado porque no se conoce ruta shiny legal para esta especie.'
    });
  }
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
  const seen = new Set<string>();
  const out = [];
  for (const e of list){
    const key = encounterDedupeKey(e);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

export function encounterFile(gameId: string, species: number, form = 0): string {
  return join(dataDir, 'encounters', gameId, `${Number(species)}-${Number(form||0)}.json`);
}

export function loadEncounters(gameId: string, species: number, form = 0): any[] {
  const key = `${gameId}:${Number(species)}-${Number(form||0)}`;
  if (encounterCache.has(key)) return encounterCache.get(key)!;
  const file = encounterFile(gameId, species, form);
  let list = existsSync(file) ? JSON.parse(readFileSync(file,'utf8')) : [];
  list = dedupeEncounters(list);

  // Filter out Poco Path / Sendero de Cahíz for Koraidon/Miraidon (species 1007/1008) in SV
  if (gameId === 'sv' && (species === 1007 || species === 1008)) {
    list = list.filter((e: any) => e.id !== 'static-staticsl-73' && e.id !== 'static-staticvl-79');
  }

  // Load evolved starter encounters in SV
  if (gameId === 'sv') {
    list.push(...makeSvStarterFinalEvolvedEncounters(species, form));
    list = dedupeEncounters(list);
  }

  if (canUseHomeTransfer(gameId, species, list.length === 0)) {
    const homes = makeHomeTransferEncounters(gameId, species, form);
    const existing = new Set(list.map((e: any) => e.id));
    for (const home of homes) {
      if (!existing.has(home.id)) list.push(home);
    }
    list = dedupeEncounters(list);
  }
  encounterCache.set(key,list);
  if (encounterCache.size > MAX_CACHE) {
    encounterCache.delete(encounterCache.keys().next().value!);
  }
  return list;
}

export function versionAllowed(e: any, version: string): boolean {
  const v = String(version || '').toLowerCase();
  if (!v || v === 'scarlet/violet' || v === 'both') return true;
  if (v === 'scarlet' && e.availableScarlet === false) return false;
  if (v === 'violet' && e.availableViolet === false) return false;
  if (e.version && String(e.version).toLowerCase().includes('scarlet') && v === 'violet' && !String(e.version).toLowerCase().includes('violet')) return false;
  if (e.version && String(e.version).toLowerCase().includes('violet') && v === 'scarlet' && !String(e.version).toLowerCase().includes('scarlet')) return false;
  return true;
}

export function options(gameId: string, e: any) {
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

export function validate(gameId: string, payload: any): any {
  const g = games[gameId];
  if (!g) return { legal: false, errors: ['Juego no soportado.'] };

  // Pre-process level for SV starter final evolutions to ensure legal min level
  payload = { ...payload };
  if (gameId === 'sv') {
    const species = Number(payload.dexId ?? payload.speciesId ?? payload.species);
    const profile = SV_STARTER_FINAL_EVOLUTION_PROFILES.get(species);
    if (profile) {
      const currentLevel = Number(payload.level || 0);
      const minLevel = profile.minLevel;
      if (!currentLevel || currentLevel < minLevel) {
        payload.level = minLevel;
      }
    }
  }

  const species = Number(payload.dexId ?? payload.speciesId ?? payload.species);
  const form = Number(payload.form || 0);
  let candidates = loadEncounters(gameId, species, form);
  if (payload.encounterId) candidates = candidates.filter(e => e.id === payload.encounterId);
  if (payload.location !== undefined && payload.location !== '') candidates = candidates.filter(e => {
    const a = e.location;
    const b = payload.location;
    const an = Number(a), bn = Number(b);
    if (Number.isFinite(an) && Number.isFinite(bn)) return an === bn;
    return String(a) === String(b);
  });
  if (payload.method) candidates = candidates.filter(e => String(e.method).toLowerCase() === String(payload.method).toLowerCase());
  if (payload.gameVersion) candidates = candidates.filter(e => versionAllowed(e, payload.gameVersion));
  if (!candidates.length) return { legal:false, errors:[`No existe un encuentro legal para ${gameId.toUpperCase()} con esa especie/forma/localización.`] };
  const failures = [];
  for (const e of candidates){
    const errors=[];
    const min=Number(e.levelMin||1), max=Number(e.levelMax||100);
    if (payload.level !== undefined){ const lvl=Number(payload.level); if(lvl<min || lvl>max) errors.push(`Nivel ilegal: debe estar entre ${min} y ${max}.`); }
    if (payload.shiny && (e.shiny === 'Never' || e.shinyLocked)) errors.push('Este encuentro está shiny locked.');
    if (e.forceShiny && !payload.shiny) errors.push('Este perfil HOME/evento requiere Shiny: Sí.');
    if (payload.alpha !== undefined && Boolean(payload.alpha) !== Boolean(e.isAlpha)) errors.push(`Alpha ilegal: este encuentro ${e.isAlpha?'sí':'no'} es Alpha.`);
    if (payload.ball && e.fixedBall && payload.ball !== e.fixedBall) errors.push(`Ball ilegal: este encuentro usa ${e.fixedBall}.`);
    if (payload.gender && payload.gender !== 'Random' && ['Male','Female','Genderless'].includes(e.gender) && payload.gender !== e.gender) errors.push(`Género ilegal: debe ser ${e.gender}.`);
    if (payload.gameVersion && !versionAllowed(e, payload.gameVersion)) errors.push(`Encuentro no disponible en ${payload.gameVersion}.`);
    if (payload.evMode && !['none','max'].includes(String(payload.evMode))) errors.push('EVs ilegales: usa none o max.');
    if (gameId === 'sv' && payload.teraType && !teraTypes.has(String(payload.teraType))) errors.push('Teratipo ilegal: selecciona uno de los 18 tipos de Scarlet/Violet.');
    if (!errors.length) return { legal:true, matchedEncounter: options(gameId,e), order:{...payload, game:gameId, validatedAt:new Date().toISOString()} };
    failures.push({ encounterId:e.id, method:e.method, locationName:e.locationName, errors, fixedOptions:options(gameId,e).fixed });
  }
  return { legal:false, errors:['La combinación no coincide con ningún encuentro legal disponible.'], candidates: failures.slice(0,12) };
}

export function randomTradeCode(): string {
  return String(Math.floor(10000000 + Math.random() * 90000000));
}

export function orderId(): string {
  // crypto.randomUUID() produces a valid UUID v4, required by Supabase's uuid column
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function yesNo(v: any): string {
  return v ? 'Yes' : 'No';
}

export function formatSysbotCommand(order: any, tradeCode: string): string {
  const gameId = String(order.game || '').toLowerCase();
  const isSV = gameId === 'sv';
  const sp = Number(order.dexId ?? order.species);
  const isHome = order.method?.toLowerCase().includes('home') || order.originType?.toLowerCase().includes('home') || order.homeProfileId;
  const isShiny = order.shiny;
  
  if (isSV && isShiny && isHome && SV_HOME_SHINY_FILES[sp]) {
    return `%trade ${tradeCode} [Adjunto: ${SV_HOME_SHINY_FILES[sp]}]`;
  }

  const lines = [];
  lines.push(`%trade ${tradeCode}`);
  
  const showdownSpecies = getShowdownSpeciesName(order);
  const hasHeldItem = order.heldItem &&
    String(order.heldItem).trim() !== '' &&
    String(order.heldItem).toLowerCase() !== 'none' &&
    String(order.heldItem).toLowerCase() !== 'sin objeto';
  
  const speciesLine = hasHeldItem
    ? `${showdownSpecies} @ ${order.heldItem}`
    : showdownSpecies;
    
  lines.push(speciesLine);
  if (order.ability) lines.push(`Ability: ${order.ability}`);
  if (order.level) lines.push(`Level: ${order.level}`);
  lines.push(`Shiny: ${yesNo(order.shiny)}`);
  if (order.nature && order.nature !== 'Random') lines.push(`${order.nature} Nature`);
  if (order.evMode === 'max') lines.push('EVs: 252 HP / 252 Atk / 4 Spe');
  if (order.evMode === 'none') lines.push('EVs: 0 HP / 0 Atk / 0 Def / 0 SpA / 0 SpD / 0 Spe');
  if (order.game === 'sv' && order.teraType) lines.push(`Tera Type: ${order.teraType}`);
  if (order.ball) lines.push(`Ball: ${order.ball}`);
  lines.push(`// Game: ${order.game}${order.gameVersion ? ` ${order.gameVersion}` : ''}`);
  lines.push(`// Encounter: ${order.method || ''} ${order.location || ''}`.trim());
  return lines.join('\n');
}

export async function sendDiscordWebhook(gameId: string, payload: any, isBulk = false) {
  const webhookKey = isBulk ? `${gameId}_bulk` : gameId;
  const webhook = SYSBOT_DISCORD_WEBHOOKS[webhookKey];
  if (!webhook) return { sent:false, reason:`DISCORD_WEBHOOK_${webhookKey.toUpperCase()} no configurado. Se devuelve mock listo para integración.` };
  try {
    const r = await fetch(webhook, { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(payload) });
    if (!r.ok) return { sent:false, reason:`Webhook error ${r.status}` };
    return { sent:true };
  } catch (e: any) {
    return { sent:false, reason:String(e.message || e) };
  }
}

export const getOptions = options;
