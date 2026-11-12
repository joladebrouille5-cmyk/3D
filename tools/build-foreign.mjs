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

const norm = (s) => String(s).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
const slug = (s) => norm(s).replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const STOP = new Set(['fc', 'cf', 'afc', 'f', 'c', 'a', 'cd', 'ud', 'sd', 'rcd', 'club', 'de', 'del', 'la', 'el', 'balompie', 'futbol', 'and', 'the', 'sad', 'ca']);
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
};
// Hiérarchie interne (écart à la force moyenne du championnat). Valeurs de jeu, indicatives.
const PRESTIGE = {
  'manchester-city': 0.06, arsenal: 0.06, liverpool: 0.06, chelsea: 0.045, 'manchester-united': 0.035, 'tottenham-hotspur': 0.03, 'newcastle-united': 0.03,
  'aston-villa': 0.025, 'brighton-and-hove-albion': 0.015, 'nottingham-forest': 0.01, 'crystal-palace': 0.008, brentford: 0.004, 'west-ham-united': 0.005,
  'real-madrid': 0.08, barcelona: 0.08, 'atletico-madrid': 0.05, 'athletic-bilbao': 0.03, 'athletic-club': 0.03, villarreal: 0.025, 'real-sociedad': 0.025,
  'real-betis': 0.02, sevilla: 0.015, valencia: 0.01, 'celta-vigo': 0.008, girona: 0.01,
};
const LEAGUE_BASE = { eng1: 0.675, eng2: 0.6, esp1: 0.655, esp2: 0.575 };
const COUNTRY_CODE = { Angleterre: 'eng', Espagne: 'esp' };

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
    const words = name.split(/\s+/);
    const code = CODES[key] ?? (words.length > 1 && words[0].length <= 3 ? words[1] : words[0]).normalize('NFKD').replace(/[̀-ͯ]/g, '').slice(0, 3).toUpperCase();
    clubs.push({ id, name, short: code, country: lg.country, league: lg.id, tier: lg.level, wiki: c.title, colors: colorsOf(c.kit), crest, strength, players });
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
