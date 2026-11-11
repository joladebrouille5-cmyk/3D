// Télécharge les logos officiels des clubs (usage personnel) : node tools/fetch-crests.mjs
// Source : Wikidata (propriété P154 « logo ») via l'article Wikipédia du club, image servie
// par Wikimedia Commons en PNG 128 px. Écrit assets/crests/<id>.png et src/data/crest-manifest.js.
// Respecte les règles de Wikimedia : User-Agent explicite, une requête à la fois, attente sur 429.
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATALOG } from '../src/data/catalog.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'assets/crests');
const UA = 'GenerationFootballPersonal/0.2 (personal single-player game; crest fetcher)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(OUT, { recursive: true });

async function get(url, kind = 'json', tries = 6) {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Api-User-Agent': UA } });
    if (res.status === 429 || res.status >= 500) {
      const wait = Number(res.headers.get('retry-after')) * 1000 || 2000 * 2 ** i;
      await sleep(Math.min(wait, 60000));
      continue;
    }
    if (!res.ok) return null;
    return kind === 'json' ? res.json() : Buffer.from(await res.arrayBuffer());
  }
  return null;
}

const norm = (s) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
const STOP = new Set(['fc', 'sc', 'as', 'us', 'ac', 'rc', 'cs', 'es', 'sa', 'so', 'de', 'du', 'la', 'le', 'les', 'l', 'd', 'football', 'foot', 'club', 'et', 'en']);
const keyTokens = (s) => norm(s).split(/[^a-z0-9]+/).filter((t) => t.length > 1 && !STOP.has(t) && !/^\d+$/.test(t));

// Article Wikipédia (fr) du club -> identifiant Wikidata
async function findQid(club) {
  const toks = keyTokens(club.name);
  for (const q of [`${club.name} football`, club.name]) {
    const url = `https://fr.wikipedia.org/w/api.php?action=query&format=json&generator=search&gsrlimit=5&gsrsearch=${encodeURIComponent(q)}&prop=pageprops&ppprop=wikibase_item`;
    const d = await get(url);
    await sleep(400);
    const pages = Object.values(d?.query?.pages ?? {}).sort((a, b) => a.index - b.index);
    for (const p of pages) {
      const t = norm(p.title);
      if (!p.pageprops?.wikibase_item) continue;
      if (/saison|stade |championnat|coupe|liste|joueur|entraineur/.test(t) && !/^stade /.test(norm(club.name))) continue;
      if (toks.length && !toks.some((k) => t.includes(k))) continue;
      return { qid: p.pageprops.wikibase_item, title: p.title };
    }
  }
  return null;
}

async function logoFile(qid) {
  const d = await get(`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims&ids=${qid}`);
  await sleep(400);
  const c = d?.entities?.[qid]?.claims ?? {};
  // P154 : logo ; P8972 : petit logo ou icône ; P94 : armoiries (dernier recours)
  for (const prop of ['P154', 'P8972', 'P94']) {
    const v = c[prop]?.find((x) => x.rank === 'preferred') ?? c[prop]?.[0];
    const file = v?.mainsnak?.datavalue?.value;
    if (file) return file;
  }
  return null;
}

const manifestPath = join(root, 'src/data/crest-manifest.js');
const previous = existsSync(manifestPath) ? JSON.parse((readFileSync(manifestPath, 'utf8').match(/CREST_SOURCES = (\{[\s\S]*?\});/) ?? [])[1] ?? '{}') : {};
const files = {}, sources = { ...previous };
let ok = 0, miss = [];
const only = process.argv.slice(2);
for (const club of CATALOG.clubs) {
  if (only.length && !only.includes(club.id)) continue;
  const dest = join(OUT, `${club.id}.png`);
  if (existsSync(dest) && previous[club.id]) { files[club.id] = `assets/crests/${club.id}.png`; ok++; continue; }
  try {
    const hit = await findQid(club);
    const file = hit && await logoFile(hit.qid);
    if (!file) { miss.push(club.name); continue; }
    const png = await get(`https://commons.wikimedia.org/w/index.php?title=Special:FilePath/${encodeURIComponent(file)}&width=128`, 'bin');
    await sleep(400);
    if (!png || png.length < 200) { miss.push(club.name); continue; }
    writeFileSync(dest, png);
    files[club.id] = `assets/crests/${club.id}.png`;
    sources[club.id] = { article: hit.title, wikidata: hit.qid, file };
    ok++;
    console.log(`✓ ${club.name} — ${hit.title} — ${file}`);
  } catch (e) { miss.push(`${club.name} (${e.message})`); }
}
// conserver les logos déjà présents pour les clubs non traités cette fois
for (const id of Object.keys(previous)) if (!files[id] && existsSync(join(OUT, `${id}.png`))) files[id] = `assets/crests/${id}.png`;
writeFileSync(manifestPath, `// Généré par tools/fetch-crests.mjs — logos officiels téléchargés pour un usage personnel.\nexport const CREST_FILES = ${JSON.stringify(files, null, 0)};\nexport const CREST_SOURCES = ${JSON.stringify(sources)};\n`);
console.log(`${ok} logos, ${miss.length} introuvables${miss.length ? ` : ${miss.join(', ')}` : ''}`);
