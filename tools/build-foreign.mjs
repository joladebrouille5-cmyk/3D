// Catalogue des clubs étrangers : node tools/build-foreign.mjs [dossier-logos]
// Lit tools/foreign-raw.json (collecte Wikipédia/Wikidata) et écrit src/data/foreign.js.
// - Seuls les joueurs MAJEURS au 1er juillet de la saison sont gardés (date de naissance Wikidata) ;
//   un joueur sans date de naissance connue est écarté (aucun risque de nommer un mineur).
// - Les NOTES restent des estimations du jeu (force du club), jamais des valeurs réelles.
// - Logos : premières divisions depuis le dossier fourni (dépôt public football-logos), copiés en 128 px.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const raw = JSON.parse(readFileSync(join(root, 'tools/foreign-raw.json'), 'utf8'));
const LOGOS = process.argv[2] ?? null;
const SEASON_START = `${raw.season.slice(0, 4)}-07-01`;

const norm = (s) => String(s).replace(/ı/g, 'i').replace(/İ/g, 'I').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
const slug = (s) => norm(s).replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const STOP = new Set(['al', 'jong', 'jk', 'sfk', 'fk', 'sc', 'fc', 'cf', 'afc', 'f', 'c', 'a', 'cd', 'ud', 'sd', 'rcd', 'club', 'de', 'del', 'la', 'el', 'balompie', 'futbol', 'and', 'the', 'sad', 'ca',
  'ac', 'as', 'ss', 'ssc', 'us', 'acf', 'bc', 'calcio', 'sc', 'sv', 'vfl', 'vfb', 'tsg', 'fsv', 'bv', 'kv', 'krc', 'kaa', 'rsc', 'kvc', 'vv', 'sk', 'fk', 'gd', 'cs', 'sl', 'royal', 'futebol', 'clube', 'do', 'da', 'voetbal']);
const toks = (s) => norm(s).replace(/&/g, ' ').split(/[^a-z0-9]+/).filter((t) => t.length > 1 && !STOP.has(t));

// nom d'usage : libellé du tableau de la saison, sans suffixes juridiques
const cleanName = (s) => s.replace(/\s+(F\.?C\.?|A\.?F\.?C\.?|C\.?F\.?)$/i, '').trim();

// Codes à trois lettres usuels ; sinon dérivés du nom
const CODES = {
  arsenal: 'ARS', 'manchester-city': 'MCI', 'manchester-united': 'MUN', liverpool: 'LIV', chelsea: 'CHE', 'tottenham-hotspur': 'TOT',
  'newcastle-united': 'NEW', 'aston-villa': 'AVL', 'brighton-and-hove-albion': 'BHA', 'crystal-palace': 'CRY', brentford: 'BRE', fulham: 'FUL',
  'afc-bournemouth': 'BOU', bournemouth: 'BOU', everton: 'EVE', 'nottingham-forest': 'NFO', 'west-ham-united': 'WHU', 'wolverhampton-wanderers': 'WOL',
  'leeds-united': 'LEE', sunderland: 'SUN', 'ipswich-town': 'IPS', 'hull-city': 'HUL', 'coventry-city': 'COV', burnley: 'BUR', 'leicester-city': 'LEI', southampton: 'SOU',
  'real-madrid': 'RMA', barcelona: 'BAR', 'atletico-madrid': 'ATM', 'athletic-bilbao': 'ATH', 'athletic-club': 'ATH', 'real-sociedad': 'RSO', villarreal: 'VIL',
  'real-betis': 'BET', sevilla: 'SEV', valencia: 'VAL', 'celta-vigo': 'CEL', osasuna: 'OSA', getafe: 'GET', 'rayo-vallecano': 'RAY', espanyol: 'ESP',
  alaves: 'ALA', elche: 'ELC', levante: 'LEV', 'deportivo-la-coruna': 'DEP', malaga: 'MAL', 'racing-santander': 'RAC', girona: 'GIR', mallorca: 'MLL', 'las-palmas': 'LPA',
  'real-oviedo': 'OVI', 'real-zaragoza': 'ZAR', 'sporting-gijon': 'SPG', 'real-valladolid': 'VLL',
  'inter-milan': 'INT', 'ac-milan': 'MIL', juventus: 'JUV', napoli: 'NAP', roma: 'ROM', lazio: 'LAZ', atalanta: 'ATA', 'hellas-verona': 'VER', 'juve-stabia': 'JST', 'virtus-entella': 'ENT',
  'bayern-munich': 'BAY', 'borussia-dortmund': 'BVB', 'bayer-leverkusen': 'B04', 'rb-leipzig': 'RBL', 'borussia-monchengladbach': 'BMG', 'eintracht-frankfurt': 'SGE', 'vfb-stuttgart': 'VFB',
  'sc-freiburg': 'SCF', 'tsg-hoffenheim': 'TSG', 'union-berlin': 'FCU', 'werder-bremen': 'SVW', 'mainz-05': 'M05', 'fc-augsburg': 'FCA', 'hamburger-sv': 'HSV', 'schalke-04': 'S04',
  '1-fc-koln': 'KOE', 'sv-elversberg': 'SVE', 'sc-paderborn': 'SCP', 'hertha-bsc': 'BSC', 'vfl-wolfsburg': 'WOB', 'fc-st-pauli': 'STP', 'vfl-bochum': 'BOC', '1-fc-nurnberg': 'FCN',
  '1-fc-kaiserslautern': 'FCK', '1-fc-heidenheim': 'HDH', '1-fc-magdeburg': 'FCM', 'darmstadt-98': 'D98', 'greuther-furth': 'SGF', 'karlsruher-sc': 'KSC', 'dynamo-dresden': 'SGD',
  'energie-cottbus': 'FCE', 'arminia-bielefeld': 'DSC', 'eintracht-braunschweig': 'EBS', 'hannover-96': 'H96', 'vfl-osnabruck': 'OSN', 'holstein-kiel': 'KSV',
  benfica: 'SLB', porto: 'FCP', 'sporting-cp': 'SCP', braga: 'SCB', 'vitoria-de-guimaraes': 'VSC', 'academico-de-viseu': 'VIS', 'estoril-praia': 'EST', 'estrela-da-amadora': 'EAM',
  'gil-vicente': 'GIL', 'rio-ave': 'RIO', 'casa-pia': 'CPI', 'santa-clara': 'SCL',
  psv: 'PSV', ajax: 'AJA', feyenoord: 'FEY', az: 'AZ', 'n-e-c': 'NEC', 'ado-den-haag': 'ADO', 'go-ahead-eagles': 'GAE', 'fortuna-sittard': 'FOR', 'sparta-rotterdam': 'SPA', 'pec-zwolle': 'PEC', 'willem-ii': 'WIL',
  'dundee-united': 'DDU', 'new-york-red-bulls': 'NYR', 'new-york-city': 'NYC', 'columbus-crew': 'CLB', 'colorado-rapids': 'COL', 'los-angeles': 'LAF', 'la-galaxy': 'LAG',
  'inter-miami': 'MIA', 'al-hilal': 'HIL', 'al-nassr': 'NAS', 'al-ittihad': 'ITT', 'al-ahli': 'AHL',
  'club-brugge': 'BRU', 'cercle-brugge': 'CER', 'union-sg': 'USG', anderlecht: 'AND', 'standard-liege': 'STA', 'oh-leuven': 'OHL', 'lommel-sk': 'LOM', 'la-louviere': 'RAL', 'sint-truiden': 'STV', 'zulte-waregem': 'ZWA', genk: 'KRC', gent: 'KAA',
};
// noms d'usage en français quand le libellé du tableau est trop court
const NAME_FIX = { 'los-angeles': 'Los Angeles FC', psv: 'PSV Eindhoven', az: 'AZ Alkmaar', 'n-e-c': 'NEC Nimègue', 'union-sg': 'Union Saint-Gilloise', 'oh-leuven': 'OH Louvain', 'standard-liege': 'Standard de Liège' };
// Hiérarchie interne (écart à la force moyenne du championnat). Valeurs de jeu, indicatives.
const PRESTIGE = {
  'manchester-city': 0.06, arsenal: 0.06, liverpool: 0.06, chelsea: 0.045, 'manchester-united': 0.035, 'tottenham-hotspur': 0.03, 'newcastle-united': 0.03,
  'aston-villa': 0.025, 'brighton-and-hove-albion': 0.015, 'nottingham-forest': 0.01, 'crystal-palace': 0.008, brentford: 0.004, 'west-ham-united': 0.005,
  'real-madrid': 0.08, barcelona: 0.08, 'atletico-madrid': 0.05, 'athletic-bilbao': 0.03, 'athletic-club': 0.03, villarreal: 0.025, 'real-sociedad': 0.025,
  'real-betis': 0.02, sevilla: 0.015, valencia: 0.01, 'celta-vigo': 0.008, girona: 0.01,
  'inter-milan': 0.06, napoli: 0.045, juventus: 0.045, 'ac-milan': 0.045, atalanta: 0.035, roma: 0.035, como: 0.025, lazio: 0.02, bologna: 0.02, fiorentina: 0.015, torino: 0.005,
  palermo: 0.012, 'hellas-verona': 0.012, sampdoria: 0.01, empoli: 0.01, cremonese: 0.008, pisa: 0.006,
  'bayern-munich': 0.085, 'borussia-dortmund': 0.05, 'bayer-leverkusen': 0.045, 'rb-leipzig': 0.04, 'vfb-stuttgart': 0.03, 'eintracht-frankfurt': 0.03, 'sc-freiburg': 0.015,
  'tsg-hoffenheim': 0.015, 'borussia-monchengladbach': 0.008, 'mainz-05': 0.008, 'werder-bremen': 0.005, 'union-berlin': 0.004,
  'vfl-wolfsburg': 0.02, 'fc-st-pauli': 0.01, 'hertha-bsc': 0.01, 'hannover-96': 0.008, '1-fc-heidenheim': 0.008, '1-fc-kaiserslautern': 0.006, 'vfl-bochum': 0.006, 'holstein-kiel': 0.004,
  benfica: 0.055, porto: 0.055, 'sporting-cp': 0.055, braga: 0.03, 'vitoria-de-guimaraes': 0.012, famalicao: 0.006, 'santa-clara': 0.004,
  psv: 0.055, feyenoord: 0.05, ajax: 0.05, az: 0.03, twente: 0.02, utrecht: 0.015, 'go-ahead-eagles': 0.008, heerenveen: 0.004,
  'club-brugge': 0.055, 'union-sg': 0.045, anderlecht: 0.035, genk: 0.03, antwerp: 0.025, gent: 0.02, 'standard-liege': 0.012, mechelen: 0.004,
  celtic: 0.07, rangers: 0.06, 'heart-of-midlothian': 0.015, aberdeen: 0.01, hibernian: 0.01,
  'galatasaray-s-k': 0.065, galatasaray: 0.065, 'fenerbahce-s-k': 0.06, fenerbahce: 0.06, 'besiktas-j-k': 0.04, besiktas: 0.04, trabzonspor: 0.025, 'istanbul-basaksehir': 0.015, samsunspor: 0.008,
  'al-hilal': 0.075, 'al-nassr': 0.07, 'al-ittihad': 0.065, 'al-ahli': 0.06, 'al-qadsiah': 0.035, 'al-ettifaq': 0.015, 'al-shabab': 0.012, 'al-taawoun': 0.01,
  'inter-miami': 0.04, 'los-angeles': 0.035, lafc: 0.035, 'la-galaxy': 0.02, 'columbus-crew': 0.02, 'fc-cincinnati': 0.025, cincinnati: 0.025, 'seattle-sounders': 0.02, 'philadelphia-union': 0.02,
  'nashville-sc': 0.015, 'orlando-city': 0.015, 'new-york-city': 0.012,
  'benfica-b': -0.02, 'porto-b': -0.02, 'sporting-cp-b': -0.02, 'jong-ajax': -0.015, 'jong-psv': -0.015, 'jong-az': -0.015, 'jong-fc-utrecht': -0.02,
};
// Force de base de chaque championnat (Ligue 1 : 0,63 ; PSG ≈ 0,695). Valeurs de jeu, indicatives.
const LEAGUE_BASE = {
  eng1: 0.675, eng2: 0.6, esp1: 0.655, esp2: 0.575, ita1: 0.645, ita2: 0.57, ger1: 0.65, ger2: 0.585, por1: 0.6, ned1: 0.595, bel1: 0.59,
  por2: 0.54, ned2: 0.535, bel2: 0.53, sco1: 0.57, tur1: 0.6, ksa1: 0.595, usa1: 0.585,
};
const COUNTRY_CODE = { Angleterre: 'eng', Espagne: 'esp', Italie: 'ita', Allemagne: 'ger', Portugal: 'por', 'Pays-Bas': 'ned', Belgique: 'bel', 'Écosse': 'sco', Turquie: 'tur', 'Arabie saoudite': 'ksa', 'États-Unis': 'usa' };
// équipes réserves engagées en deuxième division (Benfica B, Jong Ajax…) : jamais promues
const isB = (name) => /\s(B|II)$/.test(name) || /^Jong\s/.test(name);

// Poste précis (Wikidata) → rôle du jeu ; sinon poste générique du tableau d'effectif
const ROLE_BY_LABEL = [
  [/goalkeeper/, 'GK'], [/centre-back|center-back|central defender|sweeper/, 'CB'], [/full-back|fullback|left-back|right-back|wing-back|wingback/, 'FB'],
  [/defensive midfielder|holding midfielder/, 'DM'], [/attacking midfielder|playmaker|number 10/, 'AM'], [/winger|wide midfielder|left midfielder|right midfielder/, 'W'],
  [/central midfielder|box-to-box|deep-lying|midfielder/, 'CM'], [/centre-forward|center-forward|striker|second striker|false nine|forward/, 'ST'], [/defender/, 'D'],
];
// le poste le plus précis l'emporte (« ailier gauche » plutôt qu'« attaquant »), à précision égale le premier cité
const SPECIFIC = { GK: 0, FB: 1, CB: 1, DM: 1, AM: 1, W: 1, CM: 2, ST: 2, D: 3 };
function roleOf(p) {
  let best = null;
  for (const lab of p.positions ?? []) {
    const l = lab.toLowerCase();
    const hit = ROLE_BY_LABEL.find(([re]) => re.test(l));
    if (hit && (best == null || SPECIFIC[hit[1]] < SPECIFIC[best])) best = hit[1];
  }
  return best ?? { GK: 'GK', DF: 'D', MF: 'CM', FW: 'ST' }[p.pos] ?? null;
}
function ageAt(born) {
  if (!born || !/^\d{4}-\d{2}-\d{2}$/.test(born) || born.endsWith('-00-00')) return null;
  const [y, m, d] = born.split('-').map(Number), [Y, M, D] = SEASON_START.split('-').map(Number);
  return Y - y - (M < m || (M === m && D < d) ? 1 : 0);
}
const hex = (h) => (h && /^#[0-9a-f]{6}$/.test(h) ? h : null);
const lum = (h) => { const n = parseInt(h.slice(1), 16); return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255); };
function colorsOf(kit) {
  const p = hex(kit?.body) ?? '#334155';
  const cands = [hex(kit?.shorts), hex(kit?.socks), hex(kit?.arm), lum(p) > 150 ? '#111111' : '#ffffff'].filter(Boolean);
  const s = cands.find((c) => Math.abs(lum(c) - lum(p)) > 40 || c !== p) ?? '#ffffff';
  return { p, s: s === p ? (lum(p) > 150 ? '#111111' : '#ffffff') : s };
}
function hashNum(s) { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; }

// logos disponibles (dossier du dépôt public), associés par mots du nom
function logoIndex(dir) {
  if (!dir || !existsSync(dir)) return [];
  const out = [];
  for (const sub of readdirSync(dir)) {
    const p = join(dir, sub);
    for (const f of readdirSync(p)) if (f.endsWith('.png')) out.push({ file: join(p, f), toks: toks(f.replace(/\.png$/, '')) });
  }
  return out;
}
function matchLogo(index, name, title) {
  const want = new Set([...toks(name), ...toks(cleanName(title))]);
  let best = null, bs = 0;
  for (const l of index) {
    const inter = l.toks.filter((t) => want.has(t)).length;
    const score = inter / new Set([...l.toks, ...want]).size;
    if (score > bs) { bs = score; best = l; }
  }
  return bs >= 0.5 ? best : null;
}

const index = logoIndex(LOGOS);
const outDir = join(root, 'assets/crests-foreign');
mkdirSync(outDir, { recursive: true });
const leagues = [], clubs = [];
let kept = 0, minors = 0, unknown = 0;
for (const lg of raw.leagues) {
  if (!lg.clubs?.length) { console.log(`  championnat ignoré (aucun club collecté) : ${lg.name}`); continue; }
  const cc = COUNTRY_CODE[lg.country];
  const ids = [];
  for (const c of lg.clubs) {
    const name = cleanName(c.short || c.title);
    const key = slug(name);
    const id = `${cc}-${key}`;
    const players = [];
    const usedNums = new Set();
    for (const p of c.players) {
      const age = ageAt(p.born);
      if (age == null) { unknown++; continue; }
      if (age < 18) { minors++; continue; }
      const num = p.no ? Number(p.no) : null;
      players.push([p.name, roleOf(p), num != null && !usedNums.has(num) ? num : null, age]);
      if (num != null) usedNums.add(num);
      kept++;
    }
    let crest = null;
    const logo = matchLogo(index, name, c.title);
    if (logo) {
      const dest = join(outDir, `${id}.png`);
      execFileSync('python3', ['-I', '-c', 'import sys; from PIL import Image; im = Image.open(sys.argv[1]).convert("RGBA"); im.thumbnail((96, 96)); im.quantize(colors=96, method=Image.Quantize.FASTOCTREE).save(sys.argv[2], optimize=True)', logo.file, dest]);
      crest = `assets/crests-foreign/${id}.png`;
    }
    const strength = Math.round((LEAGUE_BASE[lg.id] + (PRESTIGE[key] ?? (hashNum(id) - 0.5) * 0.016)) * 1000) / 1000;
    // code : premier mot significatif du nom (« 1. FC Köln » → KOL, « SS Lazio » → LAZ)
    const words = name.split(/[\s-]+/).filter((w) => /^\p{L}/u.test(w) && !/^(B|II)$/.test(w));
    const word = words.find((w) => w.length > 3 && !STOP.has(norm(w))) ?? words.find((w) => !STOP.has(norm(w))) ?? words[0] ?? name;
    const base = norm(word).replace(/[^a-z]/g, '').toUpperCase();
    const code = CODES[key] ?? (isB(name) ? `${base.slice(0, 2)}B` : base.slice(0, 3));
    clubs.push({ id, b: isB(name) || undefined, name: NAME_FIX[key] ?? name, short: code, country: lg.country, league: lg.id, tier: lg.level, wiki: c.title, colors: colorsOf(c.kit), crest, strength, players });
    ids.push(id);
  }
  leagues.push({ id: lg.id, name: lg.name, country: lg.country, tier: lg.level, clubs: ids });
}
const js = `// Généré par tools/build-foreign.mjs depuis tools/foreign-raw.json : ne pas éditer à la main.
// Effectifs professionnels (adultes uniquement) d'après ${raw.source}, saison ${raw.season}, collecte du ${raw.fetchedAt.slice(0, 10)}.
// Joueurs : [nom, rôle, numéro, âge]. Les notes restent des estimations du jeu. Usage personnel.
export const FOREIGN = ${JSON.stringify({ season: raw.season, fetchedAt: raw.fetchedAt, leagues, clubs })};
`;
writeFileSync(join(root, 'src/data/foreign.js'), js);
console.log(`${leagues.length} championnats, ${clubs.length} clubs, ${clubs.filter((c) => c.crest).length} logos, ${kept} joueurs majeurs gardés, ${minors} mineurs et ${unknown} sans date de naissance écartés.`);
for (const c of clubs) if (c.players.length < 16) console.log(`  effectif court : ${c.name} (${c.players.length})`);
for (const l of leagues) {
  const cl = clubs.filter((c) => c.league === l.id);
  const dup = cl.filter((c, i) => cl.findIndex((d) => d.short === c.short) !== i).map((c) => `${c.name} (${c.short})`);
  if (dup.length) console.log(`  codes en double (${l.name}) : ${dup.join(', ')}`);
  if (l.tier === 1) { const miss = cl.filter((c) => !c.crest).map((c) => c.name); if (miss.length) console.log(`  sans logo (${l.name}) : ${miss.join(', ')}`); }
}
