// Construit src/data/catalog.js à partir de data/joueurs-v1.csv : node tools/build-catalog.mjs
//
// Règles reprises de docs/effectifs-v1.md et du concept :
// - les clubs, compétitions et groupes du catalogue sont repris tels quels ;
// - seuls les noms SENIORS en statut « liste_publiee » sont repris (graphie, poste, numéro publiés) ;
//   les listes en quarantaine sont exclues ;
// - les effectifs JEUNES (U17/U19, mineurs) ne sont PAS repris : le jeu génère des coéquipiers fictifs ;
// - aucun attribut n'est déduit de la réalité : les notes sont des estimations du jeu, liées au niveau.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const text = readFileSync(join(root, 'data/joueurs-v1.csv'), 'utf8').replace(/^﻿/, '');

function parseCsv(src) {
  const rows = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) {
      if (c === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ';') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [head, ...data] = rows;
  return data.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}

const rows = parseCsv(text);

const norm = (s) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
const STOP = new Set(['fc', 'sc', 'as', 'us', 'ac', 'rc', 'cs', 'es', 'sa', 'so', 'ea', 'en', 'avant', 'football', 'foot', 'club', 'de', 'du', 'la', 'le', 'les', 'l', 'd', 'sco', 'af', 'aas', 'hsc', 'osc', 'losc', 'fco', 'co', 'cf', 'sm', 'sr', 'om', 'ogc', 'estac', 'ol', 'sad']);
const tokens = (s) => norm(s).split(/[^a-z0-9]+/).filter((t) => t && !STOP.has(t) && !/^\d+$/.test(t));
const key = (s) => tokens(s).join(' ');

// Postes publiés -> rôles du moteur (le reste devient « inconnu », jamais deviné)
function role(p) {
  const s = norm(p).trim();
  if (/^(g|gardien|gardienne|goalkeeper|gardien de but)\b/.test(s) || s.startsWith('gard')) return 'GK';
  if (/central|^dc\b/.test(s) && /def/.test(s)) return 'CB';
  if (/arriere|lateral|piston/.test(s)) return 'FB';
  if (/milieu defensif|sentinelle|^md\b/.test(s)) return 'DM';
  if (/milieu offensif|meneur|^mo\b/.test(s)) return 'AM';
  if (/ailier|milieu droit|milieu gauche|winger/.test(s)) return 'W';
  if (/avant-centre|avant centre|attaqu|^a\b|^f\b|forward|buteur|striker|^att/.test(s)) return 'ST';
  if (/^d\b|defens|defender|^def/.test(s)) return 'D';
  if (/^m\b|milieu|midfielder|^mil/.test(s)) return 'CM';
  return null;
}

const LEVEL = { 'D1, Ligue 1': 1, 'D2, Ligue 2': 2, 'D3, Ligue 3': 3, 'D4, National 1': 4, 'D5, National 2': 5, 'D1, Première Ligue': 1, 'D2, Seconde Ligue': 2, 'D3 Féminine': 3 };

const teams = new Map();
for (const r of rows) {
  if (!teams.has(r.equipe_catalogue_id)) {
    teams.set(r.equipe_catalogue_id, {
      id: r.equipe_catalogue_id, club: r.club, category: r.categorie, competition: r.competition_catalogue,
      group: r.groupe_catalogue, status: r.statut_collecte, source: r.source_url, players: [],
    });
  }
  const t = teams.get(r.equipe_catalogue_id);
  if (r.type_ligne === 'nom_collecte' && r.categorie.startsWith('senior') && r.statut_collecte === 'liste_publiee') {
    const num = parseInt(r.numero_publie, 10);
    t.players.push([r.nom_publie, role(r.poste_publie), Number.isFinite(num) ? num : null, r.collision_nom_a_verifier === 'true' ? 1 : 0]);
  }
}

// Clubs : une entrée par club masculin (senior et/ou jeunes), rapprochement prudent des noms
const clubs = [];
const byKey = new Map();
const slug = (s) => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
// Alias vérifiés à la main (même club, appellations différentes selon les pages)
const ALIAS = { 'US Orléans Loiret': 'US Orléans', 'Quevilly RM': 'US Quevilly' };
function clubFor(rawName) {
  const name = ALIAS[rawName] ?? rawName;
  const k = key(name);
  if (byKey.has(k)) return byKey.get(k);
  // rapprochement : un ensemble de mots contenu dans l'autre (« Stade Rennais FC » / « Stade Rennais »)
  const tk = new Set(tokens(name));
  for (const [k2, c] of byKey) {
    const t2 = k2.split(' ');
    // inclusion seulement à partir de deux mots (sinon « Paris FC » absorberait « Paris Saint-Germain »)
    const small = Math.min(t2.length, tk.size);
    if (small >= 2 && (t2.every((t) => tk.has(t)) || [...tk].every((t) => t2.includes(t)))) return c;
  }
  const c = { id: slug(name), name, senior: null, reserve: null, u19: null, u17: null };
  clubs.push(c); byKey.set(k, c);
  return c;
}
const masc = [...teams.values()].filter((t) => t.category === 'senior masculin');
const isReserve = (n) => / 2$/.test(n.trim());
for (const t of masc.filter((x) => !isReserve(x.club))) {
  const c = clubFor(t.club);
  c.senior = { team: t.id, competition: t.competition, group: t.group, level: LEVEL[t.competition], status: t.status, source: t.source, players: t.players };
}
// équipes réserves (« Club 2 ») : rattachées au club, pas confondues avec l'équipe première
for (const t of masc.filter((x) => isReserve(x.club))) {
  const c = clubFor(t.club.replace(/ 2$/, ''));
  c.reserve = { team: t.id, name: t.club, competition: t.competition, group: t.group, level: LEVEL[t.competition] };
}
for (const cat of ['U19 masculin', 'U17 masculin']) {
  for (const t of [...teams.values()].filter((x) => x.category === cat)) {
    const c = clubFor(t.club);
    c[cat.startsWith('U19') ? 'u19' : 'u17'] = { team: t.id, name: t.club, group: t.group };
  }
}

const out = {
  generatedFrom: 'data/joueurs-v1.csv (collecte du 11 novembre 2026, saison 2026-2027)',
  note: 'Noms seniors publiés (statut liste_publiee) uniquement. Jeunes : coéquipiers fictifs. Attributs : estimations du jeu, pas des notes réelles.',
  clubs: clubs.sort((a, b) => (a.senior?.level ?? 9) - (b.senior?.level ?? 9) || a.name.localeCompare(b.name, 'fr')),
};
mkdirSync(join(root, 'src/data'), { recursive: true });
writeFileSync(join(root, 'src/data/catalog.js'), `// Généré par tools/build-catalog.mjs — ne pas modifier à la main.\nexport const CATALOG = ${JSON.stringify(out)};\n`);
const s = clubs.filter((c) => c.senior).length, y = clubs.filter((c) => !c.senior).length;
const named = clubs.filter((c) => c.senior?.players.length >= 11).length;
console.log(`${clubs.length} clubs (${s} avec équipe senior, ${y} jeunes seulement), ${named} effectifs seniors nommés`);
console.log('U17 rattachés à un club senior :', clubs.filter((c) => c.u17 && c.senior).length, '/', clubs.filter((c) => c.u17).length);
console.log('U19 rattachés à un club senior :', clubs.filter((c) => c.u19 && c.senior).length, '/', clubs.filter((c) => c.u19).length);
