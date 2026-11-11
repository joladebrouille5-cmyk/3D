// Clubs, centres de formation, championnats et effectifs de la carrière.
//
// - Clubs, compétitions et groupes : catalogue réel (src/data/catalog.js, issu du CSV).
// - Effectifs seniors : noms publiés par les clubs (statut « liste_publiee ») ; les NOTES sont
//   des estimations du jeu dérivées du niveau de la division, jamais des valeurs réelles.
// - Effectifs jeunes et réserves : coéquipiers FICTIFS (pas de données de mineurs réels).

import { CLUB_PRESTIGE, ACADEMY_BONUS } from '../data/club-prestige.js';
import { CATALOG } from '../data/catalog.js';
import { ATTRS, ROLE_TEMPLATES, FIRST, LAST_A, LAST_B, FORMATIONS } from '../engine/teams.js';
import { Rng } from '../engine/rng.js';
import { kitColors } from '../ui/crest.js';

export const CLUBS = CATALOG.clubs;
const BY_ID = new Map(CLUBS.map((c) => [c.id, c]));
export const clubById = (id) => BY_ID.get(id);

export const LEVEL_NAMES = { 1: 'Ligue 1', 2: 'Ligue 2', 3: 'Ligue 3', 4: 'National 1', 5: 'National 2', 6: 'Club formateur amateur' };

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// ------------------------------------------------------------------ notes (CA)
// Poids des attributs par poste : la « note » d'un joueur est la moyenne pondérée de ces attributs.
export const ROLE_WEIGHTS = {
  GK: { gk: 3, positioning: 1, aerial: 1, decisions: 1, composure: 0.5 },
  CB: { tackling: 2, positioning: 2, aerial: 1.5, pace: 0.7, decisions: 1, passing: 0.5, composure: 0.5 },
  FB: { pace: 1.5, tackling: 1.2, stamina: 1, passing: 1, positioning: 1, dribbling: 0.6, accel: 0.7 },
  DM: { tackling: 1.5, positioning: 1.5, passing: 1.3, decisions: 1.2, stamina: 1, vision: 0.8 },
  CM: { passing: 1.6, vision: 1.2, decisions: 1.2, firstTouch: 1.2, stamina: 1, dribbling: 0.6, tackling: 0.5 },
  AM: { passing: 1.3, vision: 1.5, firstTouch: 1.3, dribbling: 1.2, shooting: 1, decisions: 1, composure: 0.6 },
  W: { pace: 1.5, accel: 1.2, dribbling: 1.5, firstTouch: 1, passing: 0.8, shooting: 0.8, stamina: 0.6 },
  ST: { shooting: 2, composure: 1.3, positioning: 1.3, firstTouch: 1, pace: 1, aerial: 0.8, dribbling: 0.6 },
};

export function roleCA(role, attrs) {
  const w = ROLE_WEIGHTS[role];
  let s = 0, t = 0;
  for (const k in w) { s += w[k] * attrs[k]; t += w[k]; }
  return s / t;
}
const TEMPLATE_CA = Object.fromEntries(Object.keys(ROLE_TEMPLATES).map((r) => [r, roleCA(r, ROLE_TEMPLATES[r])]));

// Génère des attributs dont la note de poste vaut environ `target`.
export function genAttrs(role, target, rng, sd = 0.05) {
  const off = target - TEMPLATE_CA[role];
  const a = {};
  for (const k of ATTRS) {
    const base = k === 'gk' && role !== 'GK' ? 0.05 : ROLE_TEMPLATES[role][k] + off;
    a[k] = clamp(base + rng.gauss(0, k === 'gk' && role !== 'GK' ? 0.01 : sd), 0.05, 0.97);
  }
  return a;
}

// ------------------------------------------------------------------ niveaux
export function clubLevel(c) { return c.senior?.level ?? (c.reserve ? c.reserve.level + 1 : 6); }

// Qualité du centre de formation (0-1) : niveau de l'équipe première + équipes nationales de jeunes.
export function academyQuality(c) {
  const base = { 1: 0.9, 2: 0.79, 3: 0.68, 4: 0.6, 5: 0.54, 6: 0.47 }[clubLevel(c)];
  return clamp(base + (c.u19 ? 0.03 : 0) + (c.u17 ? 0.03 : 0) + (ACADEMY_BONUS[c.id] ?? 0), 0.4, 0.97);
}
export const academyStars = (c) => Math.round(((academyQuality(c) - 0.4) / 0.57) * 10) / 2;

// Note moyenne attendue d'une équipe selon l'étape
export const SENIOR_CA = { 1: 0.63, 2: 0.585, 3: 0.55, 4: 0.52, 5: 0.49, 6: 0.46 };
export function youthCA(q, stage) { return (stage === 'U19' ? 0.37 : 0.3) + 0.22 * q; }
export function teamCA(club, stage) {
  if (stage === 'U17' || stage === 'U19') return youthCA(academyQuality(club), stage);
  if (stage === 'Réserve') return SENIOR_CA[club.reserve?.level ?? 5] - 0.01;
  return SENIOR_CA[clubLevel(club)] + (club.senior ? CLUB_PRESTIGE[club.id] ?? 0 : 0);
}

export const STAGE_LABEL = { U17: 'U17', U19: 'U19', 'Réserve': 'Réserve', Pro: 'Équipe première' };

// ------------------------------------------------------------------ championnats
// Le championnat d'une étape pour un club : groupe réel du catalogue s'il existe,
// sinon groupe régional SIMULÉ composé de clubs de niveau proche (indiqué comme tel).
export function leagueFor(club, stage) {
  const pick = (key, label) => {
    const team = club[key];
    if (!team) return null;
    const members = CLUBS.filter((c) => {
      const t = c[key];
      if (!t) return false;
      if (key === 'senior' || key === 'reserve') return t.competition === team.competition && t.group === team.group;
      return t.group === team.group;
    });
    return { name: label(team), simulated: false, clubs: members.map((c) => c.id) };
  };
  let lg = null;
  if (stage === 'U17') lg = pick('u17', (t) => `Championnat National U17 · groupe ${t.group}`);
  if (stage === 'U19') lg = pick('u19', (t) => `Championnat National U19 · groupe ${t.group}`);
  if (stage === 'Pro') lg = pick('senior', (t) => `${t.competition.split(', ').pop()}${t.group !== 'Unique' ? ` · groupe ${t.group}` : ''}`);
  if (stage === 'Réserve') {
    // la réserve joue dans la poule seniors où elle est inscrite (adversaires = équipes premières réelles)
    const r = club.reserve;
    if (r) {
      const members = CLUBS.filter((c) => (c.senior && c.senior.competition === r.competition && c.senior.group === r.group) || (c.reserve && c.reserve.competition === r.competition && c.reserve.group === r.group && c.id !== club.id));
      lg = { name: `${r.competition.split(', ').pop()} · groupe ${r.group} (réserve)`, simulated: false, clubs: [club.id, ...members.map((c) => c.id).filter((id) => id !== club.id)], reserveOf: club.id };
    }
  }
  if (lg && lg.clubs.length >= 6) return lg;
  // groupe simulé : clubs sans équipe dans cette compétition, de qualité proche
  const key = stage === 'U17' ? 'u17' : stage === 'U19' ? 'u19' : 'senior';
  const q = academyQuality(club);
  const pool = CLUBS.filter((c) => c.id !== club.id && !c[key])
    .sort((a, b) => Math.abs(academyQuality(a) - q) - Math.abs(academyQuality(b) - q) || a.name.localeCompare(b.name, 'fr'))
    .slice(0, 13);
  const label = stage === 'Pro' ? 'Championnat régional seniors' : `Championnat régional ${stage}`;
  return { name: `${label} (groupe simulé)`, simulated: true, clubs: [club.id, ...pool.map((c) => c.id)] };
}

// Nom affiché d'une équipe dans une compétition
export function teamName(club, stage, league) {
  if (league?.reserveOf && club.id === league.reserveOf) return club.reserve?.name ?? `${club.name} 2`;
  if (stage === 'U17') return `${club.u17?.name ?? club.name} U17`;
  if (stage === 'U19') return `${club.u19?.name ?? club.name} U19`;
  return club.name;
}

// Force utilisée par le modèle agrégé des autres rencontres
export function teamStrength(club, stage, league) {
  if (stage === 'Réserve' && league?.reserveOf && club.id !== league.reserveOf) return teamCA(club, 'Pro');
  return teamCA(club, stage);
}

// ------------------------------------------------------------------ effectifs
const SLOTS_433 = FORMATIONS['4-3-3'].map((s) => s.role); // GK FB CB CB FB DM CM CM W ST W
const BENCH = ['GK', 'CB', 'FB', 'DM', 'CM', 'W', 'ST'];

function fakeName(rng, used) {
  let n;
  do n = `${rng.pick(FIRST)} ${rng.pick(LAST_A)}${rng.pick(LAST_B)}`; while (used.has(n));
  used.add(n);
  return n;
}

// Couleurs de maillot : couleurs réelles du club quand elles sont connues (src/data/club-colors.js)
function colorsFor(id) { return kitColors(id); }

// Abréviations d'usage (bandeau de score) ; sinon, premier mot distinctif du nom
const SHORT = {
  'paris-saint-germain': 'PSG', 'olympique-de-marseille': 'OM', 'olympique-lyonnais': 'OL', 'as-monaco': 'ASM', 'losc-lille': 'LIL',
  'rc-lens': 'RCL', 'ogc-nice': 'NIC', 'stade-rennais': 'REN', 'rc-strasbourg-alsace': 'RCS', 'stade-brestois': 'BRE', 'toulouse-fc': 'TFC',
  'fc-lorient': 'FCL', 'aj-auxerre': 'AJA', 'angers-sco': 'SCO', 'paris-fc': 'PFC', 'le-havre-ac': 'HAC', 'le-mans-fc': 'LMF', 'estac-troyes': 'ETG',
  'as-saint-etienne': 'ASSE', 'fc-nantes': 'FCN', 'montpellier-hsc': 'MHSC', 'stade-de-reims': 'SDR', 'fc-metz': 'FCM', 'en-avant-guingamp': 'EAG',
  'fc-sochaux-montbeliard': 'FCSM', 'as-nancy-lorraine': 'ASNL', 'clermont-foot': 'CF63', 'red-star-fc': 'RSFC', 'sm-caen': 'SMC', 'sc-bastia': 'SCB',
  'girondins-de-bordeaux': 'FCGB', 'fc-girondins-de-bordeaux': 'FCGB', 'ac-ajaccio': 'ACA', 'dijon-fco': 'DFCO', 'amiens-sc': 'ASC', 'valenciennes-fc': 'VAFC',
};
const SHORT_STOP = /^(fc|sc|as|us|ac|rc|cs|es|ea|ogc|losc|sco|aj|sm|hsc|af|stade|olympique|racing|sporting|union|association|jeunesse|entente|en|avant|de|du|la|le|les|u17|u19|\d+)$/i;
function shortName(name, id) {
  if (SHORT[id]) return SHORT[id];
  const w = name.normalize('NFKD').replace(/[̀-ͯ]/g, '').split(/[\s'-]+/).filter((x) => x && !SHORT_STOP.test(x));
  return (w[0] || name).slice(0, 3).toUpperCase();
}

// Effectif d'une équipe pour une saison et une étape. Déterministe (graine = club + saison + étape).
// `user` (optionnel) : le joueur de l'utilisateur, intégré à l'effectif de son club.
export function buildTeamSquad(club, stage, season, league, user = null, selection = null) {
  const rng = new Rng(`squad:${club.id}:${stage}:${season}`);
  const isReserveTeam = stage === 'Réserve' && league?.reserveOf === club.id;
  const effStage = stage === 'Réserve' && !isReserveTeam ? 'Pro' : stage;
  const target = isReserveTeam ? teamCA(club, 'Réserve') : teamCA(club, effStage);
  const used = new Set();
  const realList = effStage === 'Pro' && club.senior?.players?.length >= 11 ? club.senior.players : null;
  const pool = []; // [name, role, num, real]
  if (realList) {
    let dToggle = 0;
    for (const [name, r, num] of realList) {
      let role = r;
      if (role === 'D') role = dToggle++ % 3 === 2 ? 'FB' : 'CB';
      pool.push({ name, role, num, real: true });
      used.add(name);
    }
  }
  const take = (role) => {
    let i = pool.findIndex((p) => p.role === role);
    if (i < 0) i = pool.findIndex((p) => p.role === null);
    if (i < 0) {
      const alt = { CB: ['FB', 'DM'], FB: ['CB', 'W'], DM: ['CM', 'CB'], CM: ['DM', 'AM'], AM: ['CM', 'W'], W: ['AM', 'ST', 'FB'], ST: ['W', 'AM'], GK: [] }[role];
      for (const a of alt) { i = pool.findIndex((p) => p.role === a); if (i >= 0) break; }
    }
    if (i >= 0) { const p = pool.splice(i, 1)[0]; return { ...p, role }; }
    return { name: fakeName(rng, used), role, num: null, real: false };
  };
  const mk = (p, slotIdx) => {
    const v = rng.gauss(0, 0.025);
    return { name: p.name, role: p.role, num: p.num, real: p.real, attrs: genAttrs(p.role, target + v, rng), slot: slotIdx };
  };
  const starters = SLOTS_433.map((role, i) => mk(take(role), i));
  const bench = BENCH.map((role) => mk(take(role), null));
  // numéros : ceux publiés ; sinon numérotation classique par poste, puis numéros libres
  const CLASSIC = [1, 2, 4, 5, 3, 6, 8, 10, 7, 9, 11];
  const taken = new Set([...starters, ...bench].map((p) => p.num).filter((n) => n != null));
  starters.forEach((p, i) => { if (p.num == null && !taken.has(CLASSIC[i])) { p.num = CLASSIC[i]; taken.add(p.num); } });
  let bn = 12;
  for (const p of bench) if (p.num == null && !realList) { while (taken.has(bn)) bn++; p.num = bn; taken.add(bn); }
  let free = 2;
  for (const p of [...starters, ...bench]) if (p.num == null) { while (taken.has(free)) free++; p.num = free; taken.add(free); }

  if (user) {
    const u = { name: `${user.firstName} ${user.lastName}`, role: user.role, num: user.number ?? 27, real: false, isUser: true, attrs: { ...user.attrs } };
    if (taken.has(u.num)) { u.num = 30; while (taken.has(u.num)) u.num++; }
    if (selection === 'titulaire') {
      // remplace le concurrent direct à son poste ; ce dernier passe sur le banc
      const i = starters.findIndex((p) => p.role === user.role);
      const rival = starters[i];
      starters[i] = { ...u, slot: i };
      bench[bench.findIndex((p) => p.role === rival.role) >= 0 ? bench.findIndex((p) => p.role === rival.role) : bench.length - 1] = { ...rival, slot: null };
    } else if (selection === 'remplaçant') {
      const j = bench.findIndex((p) => p.role === user.role);
      bench[j >= 0 ? j : bench.length - 1] = { ...u, slot: null };
    }
  }
  const name = teamName(club, stage, league);
  return {
    def: {
      id: `${club.id}-${stage}`, clubId: club.id, name, short: shortName(club.name, club.id), formation: '4-3-3', colors: colorsFor(club.id),
      tactics: { pressing: 'moyen', bloc: 'moyen', style: 'équilibré' }, mods: {}, level: 0,
      identity: realList ? 'Noms publiés par le club ; notes estimées par le jeu.' : 'Effectif fictif généré par le jeu.',
    },
    starters, bench, realNames: !!realList,
  };
}

// Concurrent direct du joueur à son poste (titulaire de l'effectif sans lui)
export function rivalFor(club, stage, season, league, role) {
  const sq = buildTeamSquad(club, stage, season, league);
  const r = sq.starters.find((p) => p.role === role);
  return { name: r.name, ca: roleCA(role, r.attrs), real: r.real };
}
