// Clubs, centres de formation, championnats et effectifs de la carrière.
//
// - Clubs, compétitions et groupes : catalogue réel (src/data/catalog.js, issu du CSV).
// - Effectifs seniors : noms publiés par les clubs (statut « liste_publiee ») ; les NOTES sont
//   des estimations du jeu dérivées du niveau de la division, jamais des valeurs réelles.
// - Effectifs jeunes et réserves : coéquipiers FICTIFS (pas de données de mineurs réels).

import { CLUB_PRESTIGE, ACADEMY_BONUS } from '../data/club-prestige.js';
import { CATALOG } from '../data/catalog.js';
import { FOREIGN } from '../data/foreign.js';
import { NAMES } from '../data/names.js';
import { countryInfo } from './countries.js';
import { ATTRS, ROLE_TEMPLATES, FIRST, LAST_A, LAST_B, FORMATIONS } from '../engine/teams.js';
import { Rng } from '../engine/rng.js';
import { kitColors } from '../ui/crest.js';

export const CLUBS = CATALOG.clubs;
const BY_ID = new Map(CLUBS.map((c) => [c.id, c]));
// équipes hors catalogue (clubs européens, sélections nationales) : effectifs fictifs, force fixée
const EXTRA = new Map();
export function registerClub(c) { if (!BY_ID.has(c.id)) EXTRA.set(c.id, { synthetic: true, ...c }); return EXTRA.get(c.id) ?? BY_ID.get(c.id); }
export const clubById = (id) => BY_ID.get(id) ?? EXTRA.get(id);

// ------------------------------------------------------------------ clubs étrangers
// Effectifs professionnels réels (adultes uniquement, src/data/foreign.js) ; pas de centre de formation :
// la carrière commence toujours en France. Force fixée par le jeu (club.strength).
export const FOREIGN_LEAGUES = FOREIGN.leagues;
export const FOREIGN_CLUBS = FOREIGN.clubs.map((c) => {
  const lg = FOREIGN.leagues.find((l) => l.id === c.league);
  return {
    id: c.id, name: c.name, short: c.short, foreign: true, country: c.country, leagueId: c.league, tier: c.tier, strength: c.strength, reserveTeam: !!c.b,
    senior: { level: c.tier, competition: lg?.name ?? c.league, group: 'Unique', players: c.players, status: 'wikipedia' },
    reserve: null, u17: null, u19: null,
    // centre de formation : coéquipiers et adversaires de jeunes toujours fictifs (noms de la langue du pays)
    names: NAMES[countryInfo(c.country).names] ?? null,
  };
});
for (const c of FOREIGN_CLUBS) BY_ID.set(c.id, c);
// force moyenne de chaque championnat étranger (recalculée après les montées et descentes : world.js)
const FOREIGN_AVG = {};
export function refreshForeignAverages() {
  for (const l of FOREIGN.leagues) {
    const xs = FOREIGN_CLUBS.filter((c) => c.leagueId === l.id).map((c) => c.strength);
    FOREIGN_AVG[l.id] = xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0.6;
  }
}
refreshForeignAverages();
// moyenne d'origine (catalogue), référence pour l'évolution des clubs promus ou relégués
export const FOREIGN_AVG0 = { ...FOREIGN_AVG };
// Centres de formation d'un pays : clubs français du catalogue, ou clubs étrangers du pays
export const ACADEMY_COUNTRIES = ['France', ...[...new Set(FOREIGN.leagues.map((l) => l.country))]];
export const academiesOf = (country) => (country === 'France' || !country ? CLUBS : FOREIGN_CLUBS.filter((c) => c.country === country && !c.reserveTeam));
// Tous les clubs professionnels (France + étranger), pour les offres et les prêts (pas les équipes réserves)
export const PRO_CLUBS = () => [...CLUBS.filter((c) => c.senior), ...FOREIGN_CLUBS.filter((c) => !c.reserveTeam)];

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
// centres de formation étrangers réputés (écart ajouté à la qualité tirée de la force du club)
const FOREIGN_ACADEMY = {
  'ned-ajax': 0.08, 'por-benfica': 0.08, 'por-sporting-cp': 0.07, 'esp-barcelona': 0.06, 'ned-psv': 0.05, 'ned-feyenoord': 0.04, 'bel-anderlecht': 0.06,
  'bel-genk': 0.06, 'bel-club-brugge': 0.03, 'por-porto': 0.04, 'esp-real-madrid': 0.03, 'esp-athletic-club': 0.05, 'esp-real-sociedad': 0.05, 'esp-villarreal': 0.03,
  'eng-chelsea': 0.05, 'eng-manchester-city': 0.04, 'eng-southampton': 0.04, 'ger-bayern-munich': 0.03, 'ger-borussia-dortmund': 0.04, 'ger-vfb-stuttgart': 0.03,
  'ita-atalanta': 0.06, 'ita-inter-milan': 0.03, 'ita-juventus': 0.03, 'ned-az': 0.04, 'ger-schalke-04': 0.04,
};
export function academyQuality(c) {
  if (c.foreign) return clamp(0.5 + (c.strength - 0.56) * 2.4 + (FOREIGN_ACADEMY[c.id] ?? 0), 0.45, 0.97);
  const base = { 1: 0.9, 2: 0.79, 3: 0.68, 4: 0.6, 5: 0.54, 6: 0.47 }[clubLevel(c)];
  return clamp(base + (c.u19 ? 0.03 : 0) + (c.u17 ? 0.03 : 0) + (ACADEMY_BONUS[c.id] ?? 0), 0.4, 0.97);
}
export const academyStars = (c) => Math.round(((academyQuality(c) - 0.4) / 0.57) * 10) / 2;

// Note moyenne attendue d'une équipe selon l'étape
export const SENIOR_CA = { 1: 0.63, 2: 0.585, 3: 0.55, 4: 0.52, 5: 0.49, 6: 0.46 };
// Niveau moyen de la division d'un club (France : par niveau ; étranger : moyenne réelle du championnat)
export function divisionCA(c) { return c?.foreign ? FOREIGN_AVG[c.leagueId] : SENIOR_CA[clubLevel(c)] ?? 0.5; }
// Nom de la division d'un club, pour l'affichage
export function divisionName(c) {
  if (c?.foreign) return `${c.senior.competition} · ${c.country}`;
  return LEVEL_NAMES[clubLevel(c)];
}
export function youthCA(q, stage) { return (stage === 'U19' ? 0.37 : 0.3) + 0.22 * q; }
export function teamCA(club, stage) {
  // équipes de jeunes d'un club étranger : niveau de son centre de formation
  if (club.foreign && (stage === 'U17' || stage === 'U19')) return youthCA(academyQuality(club), stage);
  if (club.strength != null) return club.strength;
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
  // jeunes d'un club étranger : groupe national de clubs du pays au centre de formation comparable
  if (club.foreign && (stage === 'U17' || stage === 'U19')) {
    const q = academyQuality(club);
    const pool = FOREIGN_CLUBS.filter((c) => c.country === club.country && c.id !== club.id)
      .sort((a, b) => Math.abs(academyQuality(a) - q) - Math.abs(academyQuality(b) - q) || a.name.localeCompare(b.name)).slice(0, 13);
    return { name: `${countryInfo(club.country).youth} ${stage}`, simulated: false, clubs: [club.id, ...pool.map((c) => c.id)], country: club.country, youthGroup: true };
  }
  let lg = null;
  if (stage === 'U17') lg = pick('u17', (t) => `Championnat National U17 · groupe ${t.group}`);
  if (stage === 'U19') lg = pick('u19', (t) => `Championnat National U19 · groupe ${t.group}`);
  if (stage === 'Pro' && club.foreign) {
    const fl = FOREIGN.leagues.find((l) => l.id === club.leagueId);
    return { name: fl.name, simulated: false, clubs: [...fl.clubs], country: fl.country };
  }
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
  if (club.synthetic) return club.name;
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

// noms des joueurs réels du catalogue : un nom fictif ne doit jamais coïncider avec l'un d'eux
let REAL_NAMES = null;
const realNames = () => (REAL_NAMES ??= new Set([...CLUBS, ...FOREIGN_CLUBS].flatMap((c) => (c.senior?.players ?? []).map((p) => p[0]))));
function fakeName(rng, used, pool = null) {
  let n, guard = 0;
  do n = pool ? `${rng.pick(pool.first)} ${rng.pick(pool.last)}` : `${rng.pick(FIRST)} ${rng.pick(LAST_A)}${rng.pick(LAST_B)}`; while ((used.has(n) || realNames().has(n)) && guard++ < 80);
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
    return { name: fakeName(rng, used, club.names ?? null), role, num: null, real: false };
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
      const i = slotIndexFor(starters, user.role);
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
      id: `${club.id}-${stage}`, clubId: club.id, name, short: club.short ?? shortName(club.name, club.id), formation: '4-3-3', colors: colorsFor(club.id),
      tactics: { pressing: 'moyen', bloc: 'moyen', style: 'équilibré' }, mods: {}, level: 0,
      identity: realList ? 'Noms publiés par le club ; notes estimées par le jeu.' : 'Effectif fictif généré par le jeu.',
    },
    starters, bench, realNames: !!realList,
  };
}

// Concurrent direct du joueur à son poste (titulaire de l'effectif sans lui)
// Postes absents du 4-3-3 : le joueur dispute la place du poste le plus proche
const NEAREST_SLOT = { AM: ['CM', 'W'], DM: ['CM'], W: ['ST'], FB: ['CB'], CB: ['FB'], CM: ['DM'], ST: ['W'], GK: [] };
function slotIndexFor(starters, role) {
  let i = starters.findIndex((p) => p.role === role);
  for (const alt of NEAREST_SLOT[role] ?? []) { if (i >= 0) break; i = starters.findIndex((p) => p.role === alt); }
  return i >= 0 ? i : starters.findIndex((p) => p.role !== 'GK');
}

export function rivalFor(club, stage, season, league, role) {
  const sq = buildTeamSquad(club, stage, season, league);
  const r = sq.starters[slotIndexFor(sq.starters, role)];
  return { name: r.name, ca: roleCA(role, r.attrs), real: r.real };
}
