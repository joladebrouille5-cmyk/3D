// Effectifs professionnels étrangers depuis Wikipédia (anglais) et Wikidata : node tools/fetch-foreign.mjs
// Lancé par GitHub Actions (.github/workflows/foreign-squads.yml), l'environnement de développement étant
// limité par Wikipédia. Usage personnel. Écrit tools/foreign-raw.json, converti ensuite par build-foreign.mjs.
// Pour chaque championnat : liste des clubs de la saison (article de saison), puis pour chaque club l'effectif
// professionnel (modèles « Fs player » du premier bloc d'effectif) et les couleurs du maillot ; Wikidata
// donne la date de naissance (pour écarter les mineurs) et les postes précis.
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'tools/foreign-raw.json');
const UA = 'GenerationFootball/0.1 (jeu de football personnel; https://github.com/joladebrouille5-cmyk/3d)';
const SEASON = process.env.SEASON || '2026–27';
const ONLY = (process.env.LEAGUES || '').split(',').filter(Boolean);
export const LEAGUES = [
  { id: 'eng1', country: 'Angleterre', name: 'Premier League', level: 1, article: `${SEASON} Premier League`, expect: 20 },
  { id: 'eng2', country: 'Angleterre', name: 'Championship', level: 2, article: `${SEASON} EFL Championship`, expect: 24 },
  { id: 'esp1', country: 'Espagne', name: 'LaLiga', level: 1, article: `${SEASON} La Liga`, expect: 20 },
  { id: 'esp2', country: 'Espagne', name: 'LaLiga 2', level: 2, article: `${SEASON} Segunda División`, expect: 22 },
  { id: 'ita1', country: 'Italie', name: 'Serie A', level: 1, article: `${SEASON} Serie A`, expect: 20 },
  { id: 'ita2', country: 'Italie', name: 'Serie B', level: 2, article: `${SEASON} Serie B`, expect: 20 },
  { id: 'ger1', country: 'Allemagne', name: 'Bundesliga', level: 1, article: `${SEASON} Bundesliga`, expect: 18 },
  { id: 'ger2', country: 'Allemagne', name: '2. Bundesliga', level: 2, article: `${SEASON} 2. Bundesliga`, expect: 18 },
  { id: 'por1', country: 'Portugal', name: 'Liga Portugal', level: 1, article: `${SEASON} Primeira Liga`, expect: 18 },
  { id: 'ned1', country: 'Pays-Bas', name: 'Eredivisie', level: 1, article: `${SEASON} Eredivisie`, expect: 18 },
  { id: 'bel1', country: 'Belgique', name: 'Pro League', level: 1, article: `${SEASON} Belgian Pro League`, expect: 16 },
  { id: 'por2', country: 'Portugal', name: 'Liga Portugal 2', level: 2, article: `${SEASON} Liga Portugal 2`, expect: 18 },
  { id: 'ned2', country: 'Pays-Bas', name: 'Eerste Divisie', level: 2, article: `${SEASON} Eerste Divisie`, expect: 20 },
  { id: 'bel2', country: 'Belgique', name: 'Challenger Pro League', level: 2, article: `${SEASON} Challenger Pro League`, expect: 16, min: 12 },
  { id: 'sco1', country: 'Écosse', name: 'Premiership', level: 1, article: `${SEASON} Scottish Premiership`, expect: 12, min: 10 },
  { id: 'tur1', country: 'Turquie', name: 'Süper Lig', level: 1, article: `${SEASON} Süper Lig`, expect: 18 },
  { id: 'ksa1', country: 'Arabie saoudite', name: 'Saudi Pro League', level: 1, article: `${SEASON} Saudi Pro League`, expect: 18 },
  { id: 'usa1', country: 'États-Unis', name: 'MLS', level: 1, article: `${SEASON.slice(0, 4)} Major League Soccer season`, expect: 30, min: 24 },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function api(base, params) {
  const url = `${base}?${new URLSearchParams({ format: 'json', formatversion: '2', maxlag: '5', ...params })}`;
  for (let i = 0; i < 6; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, 'Api-User-Agent': UA } });
      if (res.status === 429 || res.status >= 500) { await sleep(4000 * (i + 1)); continue; }
      const j = await res.json();
      if (j.error?.code === 'maxlag') { await sleep(5000); continue; }
      await sleep(1100); // politesse : une requête par seconde environ
      return j;
    } catch (e) { await sleep(3000 * (i + 1)); }
  }
  throw new Error(`échec : ${url}`);
}
const wiki = (params) => api('https://en.wikipedia.org/w/api.php', params);
const wikidata = (params) => api('https://www.wikidata.org/w/api.php', params);
async function wikitext(title) {
  const j = await wiki({ action: 'parse', page: title, prop: 'wikitext', redirects: '1' });
  if (j.error) return null;
  return { title: j.parse.title, text: j.parse.wikitext };
}

// ------------------------------------------------------------------ analyse du wikitexte
// Découpe les paramètres d'un modèle {{a|b=c|…}} sans casser les liens [[x|y]] ni les modèles imbriqués
export function templateParams(body) {
  const parts = [];
  let depth = 0, cur = '';
  for (let i = 0; i < body.length; i++) {
    const two = body.slice(i, i + 2);
    if (two === '{{' || two === '[[') { depth++; cur += two; i++; continue; }
    if ((two === '}}' || two === ']]') && depth > 0) { depth--; cur += two; i++; continue; }
    if (body[i] === '|' && depth === 0) { parts.push(cur); cur = ''; continue; }
    cur += body[i];
  }
  parts.push(cur);
  const named = {}, pos = [];
  for (const p of parts.slice(1)) {
    const m = p.match(/^\s*([a-zA-Z0-9_ ]+?)\s*=([\s\S]*)$/);
    if (m) named[m[1].trim().toLowerCase()] = m[2].trim(); else pos.push(p.trim());
  }
  return { name: parts[0].trim(), named, pos };
}
// Tous les modèles de premier niveau dont le nom correspond, avec leur texte
export function findTemplates(text, re) {
  const out = [];
  for (let i = 0; i < text.length - 1; i++) {
    if (text[i] !== '{' || text[i + 1] !== '{') continue;
    let depth = 0, j = i;
    for (; j < text.length - 1; j++) {
      if (text[j] === '{' && text[j + 1] === '{') { depth++; j++; continue; }
      if (text[j] === '}' && text[j + 1] === '}') { depth--; j++; if (depth === 0) break; }
    }
    const body = text.slice(i + 2, j - 1);
    const name = body.split('|')[0].trim();
    if (re.test(name)) { out.push({ at: i, end: j + 1, ...templateParams(body) }); i = j; }
  }
  return out;
}
const unlink = (s) => (s ?? '').replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, '$2').replace(/\[\[([^\]]+)\]\]/g, '$1').replace(/'''?/g, '').replace(/<[^>]+>/g, '').trim();
// nom affiché et titre de l'article d'un joueur
export function playerName(raw) {
  const s = raw ?? '';
  const sort = s.match(/\{\{\s*sort\s*name\s*\|([^|}]*)\|([^|}]*)(?:\|([^|}]*))?/i);
  if (sort) return { name: `${sort[1].trim()} ${sort[2].trim()}`.trim(), title: (sort[3] || `${sort[1].trim()} ${sort[2].trim()}`).trim() };
  const link = s.match(/\[\[([^|\]]+)(?:\|([^\]]+))?\]\]/);
  if (link) return { name: unlink(link[2] ?? link[1]).replace(/\s*\(.*?\)\s*$/, ''), title: link[1].trim() };
  return { name: unlink(s), title: null };
}

// Clubs d'un championnat : première colonne du premier tableau de la section des équipes
// `need` : nombre minimal de clubs ; une ligue en conférences (MLS) les répartit sur plusieurs tableaux
export function clubsFromSeason(text, need = 16) {
  const start = text.search(/^==+\s*(Teams|Clubs|Stadiums and locations|Participants)[^=]*==+\s*$/im);
  const from = start >= 0 ? start : 0;
  const tables = text.slice(from).split(/\n\{\|/).slice(1);
  const merged = new Map();
  for (const t of tables.slice(0, 4)) {
    const body = t.split(/\n\|\}/)[0];
    const rows = body.split(/\n\|-/).slice(1);
    const clubs = [];
    for (const row of rows) {
      const cells = row.split(/\n[|!]|\|\|/).map((c) => c.trim()).filter(Boolean);
      for (const c of cells.slice(0, 2)) {
        const m = c.match(/\[\[([^|\]#]+)(?:\|([^\]]+))?\]\]/);
        if (m && !/^(File|Image):/i.test(m[1])) { clubs.push({ title: m[1].trim(), short: unlink(m[2] ?? m[1]) }); break; }
      }
    }
    const uniq = [...new Map(clubs.map((c) => [c.title, c])).values()];
    if (uniq.length >= need) return uniq;
    for (const c of uniq) merged.set(c.title, c);
    if (merged.size >= need) return [...merged.values()];
  }
  return [];
}

// Effectif du premier bloc « Fs start … Fs end » après la section des joueurs
export function squadFrom(text) {
  const sec = text.search(/^==+\s*(Players|Squad|Current squad|First[- ]team squad|First team|Plantilla)\s*==+\s*$/im);
  const from = sec >= 0 ? sec : 0;
  const rest = text.slice(from);
  const s = rest.search(/\{\{\s*(fs|football squad)\s*start/i);
  const e = s >= 0 ? rest.slice(s).search(/\{\{\s*(fs|football squad)\s*end/i) : -1;
  const block = s >= 0 ? rest.slice(s, e > 0 ? s + e : undefined) : rest.slice(0, 20000);
  const players = [];
  for (const t of findTemplates(block, /^(fs|football squad|fs2) ?player$/i)) {
    const n = t.named;
    const { name, title } = playerName(n.name ?? t.pos[0]);
    if (!name) continue;
    players.push({ name, title, no: (n.no ?? '').replace(/\D/g, '') || null, nat: (n.nat ?? '').toUpperCase() || null, pos: (n.pos ?? '').toUpperCase() || null, other: unlink(n.other ?? '') || null });
  }
  return players;
}

// Couleurs du maillot (infobox) : body1, shorts1, socks1, puis manches
export function kitColors(text) {
  const box = findTemplates(text, /^infobox (football|soccer) club/i)[0];
  if (!box) return null;
  const hex = (k) => { const v = (box.named[k] ?? '').replace(/[^0-9a-fA-F]/g, ''); return v.length === 6 ? `#${v.toLowerCase()}` : null; };
  return { body: hex('body1'), shorts: hex('shorts1'), socks: hex('socks1'), arm: hex('leftarm1'), fullname: unlink(box.named.fullname ?? ''), short: unlink(box.named['short name'] ?? box.named.shortname ?? ''), founded: unlink(box.named.founded ?? '') };
}

// ------------------------------------------------------------------ Wikidata : naissance et postes
async function enrich(players) {
  const titles = [...new Set(players.map((p) => p.title).filter(Boolean))];
  const byTitle = new Map();
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50);
    const j = await wikidata({ action: 'wbgetentities', sites: 'enwiki', titles: batch.join('|'), props: 'claims|sitelinks', sitefilter: 'enwiki' });
    for (const ent of Object.values(j.entities ?? {})) {
      const t = ent.sitelinks?.enwiki?.title;
      if (!t || ent.missing !== undefined) continue;
      const born = ent.claims?.P569?.[0]?.mainsnak?.datavalue?.value?.time?.slice(1, 11) ?? null;
      const positions = (ent.claims?.P413 ?? []).map((c) => c.mainsnak?.datavalue?.value?.id).filter(Boolean);
      byTitle.set(t, { qid: ent.id, born, positions });
    }
    process.stdout.write(`wikidata ${Math.min(i + 50, titles.length)}/${titles.length}\r`);
  }
  // libellés des postes
  const qids = [...new Set([...byTitle.values()].flatMap((v) => v.positions))];
  const labels = {};
  for (let i = 0; i < qids.length; i += 50) {
    const j = await wikidata({ action: 'wbgetentities', ids: qids.slice(i, i + 50).join('|'), props: 'labels', languages: 'en' });
    for (const ent of Object.values(j.entities ?? {})) labels[ent.id] = ent.labels?.en?.value ?? ent.id;
  }
  const norm = (t) => t.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
  for (const p of players) {
    const d = p.title ? (byTitle.get(norm(p.title)) ?? null) : null;
    p.born = d?.born ?? null;
    p.positions = d ? d.positions.map((q) => labels[q] ?? q) : [];
    p.qid = d?.qid ?? null;
  }
  return { found: byTitle.size, asked: titles.length };
}

// ------------------------------------------------------------------ programme
if (process.argv[1]?.endsWith('fetch-foreign.mjs')) {
  const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : { leagues: [] };
  const leagues = [];
  for (const lg of LEAGUES) {
    if (ONLY.length && !ONLY.includes(lg.id)) { const old = prev.leagues.find((x) => x.id === lg.id); if (old) leagues.push(old); continue; }
    const page = await wikitext(lg.article);
    if (!page) { console.log(`✗ article introuvable : ${lg.article}`); continue; }
    const clubs = clubsFromSeason(page.text, lg.min ?? 16);
    console.log(`${lg.name} (${page.title}) : ${clubs.length} clubs (attendu ${lg.expect})`);
    const out = { ...lg, articleTitle: page.title, clubs: [] };
    for (const c of clubs) {
      const cp = await wikitext(c.title);
      if (!cp) { console.log(`  ✗ ${c.title}`); continue; }
      const players = squadFrom(cp.text);
      const kit = kitColors(cp.text);
      out.clubs.push({ title: cp.title, short: c.short, kit, players });
      console.log(`  ${cp.title} : ${players.length} joueurs${kit?.body ? `, maillot ${kit.body}` : ''}`);
    }
    const all = out.clubs.flatMap((c) => c.players);
    const st = await enrich(all);
    console.log(`\n  Wikidata : ${st.found}/${st.asked} joueurs retrouvés`);
    leagues.push(out);
    writeFileSync(OUT, JSON.stringify({ fetchedAt: new Date().toISOString(), season: SEASON, source: 'en.wikipedia.org + wikidata.org', leagues }, null, 1));
  }
  writeFileSync(OUT, JSON.stringify({ fetchedAt: new Date().toISOString(), season: SEASON, source: 'en.wikipedia.org + wikidata.org', leagues }, null, 1));
  const n = leagues.reduce((a, l) => a + l.clubs.reduce((b, c) => b + c.players.length, 0), 0);
  console.log(`Terminé : ${leagues.length} championnats, ${leagues.reduce((a, l) => a + l.clubs.length, 0)} clubs, ${n} joueurs.`);
}
