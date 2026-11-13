// Le monde du football d'une saison à l'autre : montées et descentes.
// Le catalogue fixe les divisions de 2026-27 ; chaque fin de saison, les championnats que tu ne joues pas sont
// classés par le modèle agrégé (force du club et part de hasard), le tien par son vrai classement. Les mouvements
// sont gardés dans la sauvegarde (st.world) et réappliqués aux clubs au chargement.
import { Rng } from '../engine/rng.js';
import { CLUBS, FOREIGN_CLUBS, FOREIGN_LEAGUES, refreshForeignAverages, FOREIGN_AVG0, teamCA, clubById } from './clubs.js';

// ---------------------------------------------------------------- état d'origine
const ORIG = new Map();
for (const c of CLUBS) if (c.senior) ORIG.set(c.id, { level: c.senior.level, competition: c.senior.competition, group: c.senior.group });
for (const c of FOREIGN_CLUBS) ORIG.set(c.id, { leagueId: c.leagueId, tier: c.tier, strength: c.strength, competition: c.senior.competition });
const LEAGUE_ORIG = new Map(FOREIGN_LEAGUES.map((l) => [l.id, [...l.clubs]]));
const leagueById = (id) => FOREIGN_LEAGUES.find((l) => l.id === id);
// libellé de compétition d'un niveau français (« D4, National 1 »…)
const FR_COMPETITION = {};
for (const c of CLUBS) if (c.senior) FR_COMPETITION[c.senior.level] ??= c.senior.competition;

// Montées / descentes par paire de divisions étrangères (champion et suivants ↔ derniers)
const FOREIGN_SWAP = { eng: 3, esp: 3, ita: 3, ger: 2, por: 2, ned: 2, bel: 2 };
// équipes réserves (Benfica B, Jong Ajax…) : jamais promues
const isB = (id) => !!clubById(id)?.reserveTeam;
// France : L1↔L2 et L2↔L3 : 2 ; L3↔N1 : un par groupe de N1 ; N1↔N2 : un par groupe de N2
const FR_SWAP_TOP = { 1: 2, 2: 2 };

export function emptyWorld() { return { moves: {}, log: [] }; }

// Réapplique un monde sauvegardé aux clubs (repart toujours du catalogue)
export function applyWorld(world) {
  for (const c of CLUBS) {
    const o = ORIG.get(c.id);
    if (o) Object.assign(c.senior, { level: o.level, competition: o.competition, group: o.group });
  }
  for (const c of FOREIGN_CLUBS) {
    const o = ORIG.get(c.id);
    c.leagueId = o.leagueId; c.tier = o.tier; c.strength = o.strength; c.senior.level = o.tier; c.senior.competition = o.competition;
  }
  for (const l of FOREIGN_LEAGUES) l.clubs = [...LEAGUE_ORIG.get(l.id)];
  for (const [id, mv] of Object.entries(world?.moves ?? {})) {
    const c = clubById(id);
    if (!c) continue;
    if (c.foreign) {
      const from = leagueById(c.leagueId), to = leagueById(mv.leagueId);
      if (from && to && from !== to) { from.clubs = from.clubs.filter((x) => x !== id); to.clubs.push(id); }
      if (to) { c.leagueId = to.id; c.tier = to.tier; c.senior.level = to.tier; c.senior.competition = to.name; }
      if (mv.strength != null) c.strength = mv.strength;
    } else if (c.senior) {
      Object.assign(c.senior, { level: mv.level, competition: mv.competition, group: mv.group });
    }
  }
  refreshForeignAverages();
}
export const resetWorld = () => applyWorld(null);

// Classement simulé d'un groupe de clubs (championnats que tu ne joues pas)
function simulatedRanking(ids, rng) {
  return ids.map((id) => ({ id, s: teamCA(clubById(id), 'Pro') + rng.gauss(0, 0.022) })).sort((a, b) => b.s - a.s).map((x) => x.id);
}

// Fin de saison : montées et descentes partout. `table` : classement réel de ta compétition (ids), s'il s'agit
// d'un championnat senior complet. Renvoie { up, down } (ids) pour le compte rendu.
export function advanceWorld(st, table) {
  st.world ??= emptyWorld();
  const rng = new Rng(`world:${st.seed}:${st.season}`);
  const mine = st.stage === 'Pro' && !st.league?.simulated ? table : null;
  // un seul classement par championnat (le même sert pour ses montants et ses descendants)
  const cache = new Map();
  const rank = (ids) => {
    const key = [...ids].sort().join(',');
    if (!cache.has(key)) cache.set(key, mine && ids.length === mine.length && ids.every((id) => mine.includes(id)) ? mine : simulatedRanking(ids, rng));
    return cache.get(key);
  };
  const up = [], down = [];
  const moves = st.world.moves;

  // --- étranger : division 1 ↔ division 2 du même pays
  const pairs = {};
  for (const l of FOREIGN_LEAGUES) (pairs[l.id.slice(0, 3)] ??= {})[l.tier] = l;
  for (const [cc, pr] of Object.entries(pairs)) {
    const d1 = pr[1], d2 = pr[2];
    if (!d1 || !d2) continue;
    const n = FOREIGN_SWAP[cc] ?? 2;
    const r1 = rank(d1.clubs), r2 = rank(d2.clubs);
    const relegated = r1.slice(-n), promoted = r2.filter((id) => !isB(id)).slice(0, n);
    for (const id of relegated) { moves[id] = { ...(moves[id] ?? {}), leagueId: d2.id }; down.push(id); }
    for (const id of promoted) { moves[id] = { ...(moves[id] ?? {}), leagueId: d1.id }; up.push(id); }
  }

  // --- France : niveaux 1 à 5 (groupes au niveau 4 et 5)
  const byLevel = (lv) => CLUBS.filter((c) => c.senior && c.senior.level === lv);
  const groupsOf = (lv) => { const g = {}; for (const c of byLevel(lv)) (g[c.senior.group] ??= []).push(c.id); return g; };
  const frMoves = [];
  for (const lv of [1, 2, 3, 4]) {
    const upperGroups = groupsOf(lv), lowerGroups = groupsOf(lv + 1);
    const lowerKeys = Object.keys(lowerGroups);
    if (!lowerKeys.length) continue;
    // montants : les premiers de chaque groupe inférieur (ou les n premiers d'un groupe unique)
    const promoted = lowerKeys.length === 1 ? rank(lowerGroups[lowerKeys[0]]).slice(0, FR_SWAP_TOP[lv] ?? 2) : lowerKeys.map((k) => rank(lowerGroups[k])[0]);
    // descendants : autant, répartis entre les groupes du niveau supérieur (les derniers)
    const upperKeys = Object.keys(upperGroups);
    const ranked = Object.fromEntries(upperKeys.map((k) => [k, rank(upperGroups[k])]));
    const relegated = [];
    for (let i = 0; relegated.length < promoted.length && i < 20; i++) {
      for (const k of upperKeys) {
        if (relegated.length >= promoted.length) break;
        const r = ranked[k]; const id = r[r.length - 1 - i];
        if (id && !relegated.includes(id)) relegated.push(id);
      }
    }
    frMoves.push({ lv, promoted, relegated });
  }
  // application : groupe le moins rempli pour un club qui change de niveau
  for (const { lv, promoted, relegated } of frMoves) {
    const size = (level) => { const g = groupsOf(level); return Object.fromEntries(Object.entries(g).map(([k, v]) => [k, v.length])); };
    const place = (id, level) => {
      const s = size(level);
      const group = Object.keys(s).length ? Object.entries(s).sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))[0][0] : 'Unique';
      const c = clubById(id);
      const mv = { level, competition: FR_COMPETITION[level], group: level <= 3 ? 'Unique' : group };
      Object.assign(c.senior, mv); moves[id] = mv;
    };
    for (const id of relegated) { place(id, lv + 1); down.push(id); }
    for (const id of promoted) { place(id, lv); up.push(id); }
  }

  // --- application étrangère, puis évolution de la force des clubs qui ont changé de division :
  // un promu investit, un relégué perd ses meilleurs joueurs (30 % de l'écart chaque saison)
  applyWorld(st.world);
  for (const c of FOREIGN_CLUBS) {
    const o = ORIG.get(c.id);
    if (c.leagueId === o.leagueId && moves[c.id]?.strength == null) continue;
    const target = FOREIGN_AVG0[c.leagueId] + (o.strength - FOREIGN_AVG0[o.leagueId]);
    const sNew = Math.round((c.strength + 0.3 * (target - c.strength)) * 1000) / 1000;
    moves[c.id] = { ...(moves[c.id] ?? {}), leagueId: c.leagueId, strength: sNew };
  }
  applyWorld(st.world);
  st.world.log.push({ season: st.season, up, down });
  if (st.world.log.length > 30) st.world.log.shift();
  return { up, down };
}
