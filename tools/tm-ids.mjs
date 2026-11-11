// Identifiants Transfermarkt des clubs du catalogue (pour leurs logos) : node tools/tm-ids.mjs
// Recherche « schnellsuche » sur transfermarkt.fr, résultat retenu : club français dont le nom
// contient les mots distinctifs du club (équipes B, U19, U17, féminines écartées).
// Écrit tools/tm-ids.json : { idCatalogue: { tm, name, league } }. Usage personnel.
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { CATALOG } from '../src/data/catalog.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'tools/tm-ids.json');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {};

const norm = (s) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&amp;/g, '&').replace(/&#039;|’/g, "'");
const STOP = new Set(['fc', 'sc', 'as', 'us', 'ac', 'rc', 'cs', 'es', 'sa', 'so', 'de', 'du', 'la', 'le', 'les', 'l', 'd', 'football', 'foot', 'club', 'et', 'en', 'sur', 'vf', 'of']);
const toks = (s) => norm(s).split(/[^a-z0-9]+/).filter((t) => t.length > 1 && !STOP.has(t));
const YOUTH = /\b(b|ii|2|u\d\d|jugend|formation|feminin|feminines|women|femmes|reserve|futsal)\b/;

async function search(q) {
  for (let i = 0; i < 4; i++) {
    try {
      // curl : passe par le proxy de l'environnement comme un navigateur ordinaire
      let html = '';
      try { html = execFileSync('curl', ['-s', '--max-time', '20', '-A', 'Mozilla/5.0', '-H', 'Accept-Language: fr', `https://www.transfermarkt.fr/schnellsuche/ergebnis/schnellsuche?query=${encodeURIComponent(q)}`], { encoding: 'utf8', maxBuffer: 1 << 24 }); } catch { html = ''; }
      if (!html || html.length < 1000 || html.includes('<title>Human Verification')) {
        // limitation (page de vérification) : longue pause avant de réessayer
        console.log('  … limitation Transfermarkt, pause');
        await sleep(90000 * (i + 1)); continue;
      }
      const start = html.indexOf('Résultats de recherche: clubs');
      if (start < 0) return [];
      const end = html.indexOf('Résultats de recherche', start + 10);
      const block = html.slice(start, end > 0 ? end : undefined);
      const rows = [];
      for (const part of block.split(/<tr class="(?:odd|even)">/).slice(1)) {
        const a = part.match(/<td class="hauptlink"><a title="([^"]+)" href="\/[^"]+\/startseite\/verein\/(\d+)"/);
        if (!a) continue;
        const lg = part.match(/<a title="([^"]*)" href="\/[^"]*\/startseite\/wettbewerb\//);
        const fl = part.match(/flagge[^"]*" title="([^"]+)"/);
        rows.push({ name: a[1], tm: Number(a[2]), league: lg?.[1] ?? '', country: fl?.[1] ?? '' });
      }
      return rows;
    } catch { await sleep(3000); }
  }
  return [];
}

function pick(club, rows) {
  const want = toks(club.name);
  for (const r of rows) {
    if (r.country !== 'France' && r.country !== 'Monaco') continue;
    const n = norm(r.name);
    if (YOUTH.test(n) && !YOUTH.test(norm(club.name))) continue;
    const have = toks(r.name).filter((t) => t.length > 2);
    const eq = (a, b) => a === b || (a.length > 4 && b.length > 4 && (a.startsWith(b) || b.startsWith(a)));
    const wantIn = want.filter((k) => have.some((h) => eq(h, k))).length;
    const haveIn = have.filter((h) => want.some((k) => eq(h, k))).length;
    // tous les mots du club dans le nom Transfermarkt, ou tous les mots Transfermarkt dans le nom du club
    if (want.length && have.length && (wantIn === want.length || haveIn === have.length)) return { ...r, exact: wantIn === want.length && haveIn === have.length };
  }
  return null;
}

const out = { ...prev };
const miss = [];
for (const club of CATALOG.clubs) {
  if (out[club.id]) continue;
  let hit = null;
  for (const q of [club.name, toks(club.name).join(' ')]) {
    const rows = await search(q);
    await sleep(4000);
    hit = pick(club, rows);
    if (hit) break;
  }
  if (hit) { out[club.id] = { tm: hit.tm, name: hit.name, league: hit.league, exact: hit.exact }; console.log(`✓ ${club.name} → ${hit.name} (${hit.tm}, ${hit.league})`); }
  else { miss.push(club.name); console.log(`✗ ${club.name}`); }
  writeFileSync(OUT, JSON.stringify(out, null, 1));
}
// un même club Transfermarkt pour deux clubs du catalogue : on garde la correspondance exacte
const byTm = {};
for (const [id, v] of Object.entries(out)) (byTm[v.tm] ??= []).push(id);
for (const ids of Object.values(byTm)) if (ids.length > 1) {
  const keep = ids.find((id) => out[id].exact) ?? null;
  for (const id of ids) if (id !== keep) { console.log(`doublon écarté : ${id} (${out[id].name})`); delete out[id]; }
}
writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log(`${Object.keys(out).length} identifiants, ${miss.length} manquants${miss.length ? ` : ${miss.join(', ')}` : ''}`);
