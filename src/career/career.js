// Carrière joueur : du centre de formation à l'équipe première.
//
// - Niveau actuel (CA) : dépend du centre de formation choisi au départ.
// - Potentiel (PA) : tiré au hasard, caché ; le staff n'en donne qu'une fourchette.
//   Il évolue selon les choix (entraînement, hygiène de vie, études, temps de jeu, blessures).
// - Les rencontres du joueur sont jouées par le moteur de match ; les autres rencontres du
//   championnat par un modèle agrégé documenté (championnat de contexte).

import { Rng } from '../engine/rng.js';
import { ATTRS } from '../engine/teams.js';
import {
  clubById, academyQuality, leagueFor, teamName, teamStrength, buildTeamSquad, rivalFor, PRO_CLUBS, divisionCA, divisionName,
  roleCA, genAttrs, youthCA, SENIOR_CA, clubLevel, teamCA, CLUBS, ROLE_WEIGHTS, STAGE_LABEL,
  academiesOf,
} from './clubs.js';
import { buildCups, extrasForWeek, drawOpponent, resolveCupRound, maybeCallup, WINTER_WINDOW, isYouthCup, summerTournament, tournamentMatch, resolveTournamentMatch, nationality, NATIONALITIES } from './competitions.js';
import { salaryFor, contractType, contractTerms, winterOffers, seasonLoanOffers, negotiate, money, CONTRACT_LABEL, countryOf, mixByCountry } from './market.js';
import { tierById, levelTierById } from './potential.js';
import { coachRequest, pickSpecial, specialById, SPECIALS, DRILL_MUL, DRILL_LABEL, drillZone } from './weekly.js';
import { langLevel } from './countries.js';
import { pickEvent, eventById, abroad, clubCountry } from './events.js';
import { emptyWorld, applyWorld, resetWorld, advanceWorld } from './world.js';
import { setObjectives, objectiveProgress, settleObjectives } from './objectives.js';
import { TRAITS, traitById, unlockTraits } from './traits.js';
export { COACH_STYLES, COACH_PRIORITIES, startCoaching, takeCoachJob, playCoachSeason } from './coach.js';
import { derbyOf, weatherFor, WEATHER } from './ambiance.js';
export { WEATHER, derbyOf };
export { TRAITS, traitById };
export { objectiveProgress };
export { SPECIALS, specialById, drillZone, DRILL_LABEL };
import { SERVICES, PURCHASES, serviceEffects, monthlyCost, canBuy, ageingMul, passiveIncome, servicesFor, purchasesFor, boughtState, LEGACY } from './spending.js';
export { SERVICES, PURCHASES, monthlyCost, canBuy, passiveIncome, servicesFor, purchasesFor, boughtState };
export { money, CONTRACT_LABEL, divisionName, nationality, NATIONALITIES };

export const SAVE_VERSION = 1;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export const FOCUS = {
  technique: { label: 'Technique', attrs: ['passing', 'firstTouch', 'dribbling'] },
  physique: { label: 'Physique', attrs: ['pace', 'accel', 'stamina'] },
  tactique: { label: 'Lecture du jeu', attrs: ['decisions', 'vision', 'positioning'] },
  finition: { label: 'Finition', attrs: ['shooting', 'composure'] },
  defense: { label: 'Défense', attrs: ['tackling', 'aerial', 'positioning'] },
  gardien: { label: 'Poste de gardien', attrs: ['gk', 'positioning', 'aerial'] },
  recuperation: { label: 'Récupération', attrs: [] },
};
export const INTENSITY = {
  'légère': { growth: 0.65, fresh: -0.04, trust: -0.006, injury: 0 },
  normale: { growth: 1, fresh: -0.11, trust: 0, injury: 0.004 },
  intense: { growth: 1.3, fresh: -0.19, trust: 0.01, injury: 0.016 },
};
export const OFFPITCH = {
  ecole: { label: 'Études', desc: 'Scolarité et discipline, potentiel en légère hausse.' },
  video: { label: 'Analyse vidéo', desc: 'Lecture du jeu et potentiel en hausse.' },
  extra: { label: 'Séance en plus', desc: 'Progression accrue ; fatigue et risque de blessure.' },
  repos: { label: 'Repos et famille', desc: 'Récupération et moral.' },
  sortie: { label: 'Sortie entre amis', desc: 'Moral en hausse ; discipline et potentiel en baisse.' },
  special: { label: 'Proposition de la semaine', desc: 'Une occasion qui ne revient pas la semaine suivante.' },
};
export const ROLES = { GK: 'Gardien', CB: 'Défenseur central', FB: 'Latéral', DM: 'Milieu défensif', CM: 'Milieu central', AM: 'Milieu offensif', W: 'Ailier', ST: 'Avant-centre' };

// ------------------------------------------------------------------ création
export function createCareer({ firstName, lastName, role, foot = 'droit', clubId, seed, face = null, potential = null, level = null, nation = 'france' }) {
  resetWorld(); // nouvelle carrière : les divisions du catalogue
  const club = clubById(clubId);
  if (!club) throw new Error(`Club inconnu : ${clubId}`);
  const s = String(seed ?? Math.floor(Math.random() * 1e9));
  const rng = new Rng(`career:${s}`);
  const q = academyQuality(club);
  // niveau actuel : dépend du centre de formation (benjamin de l'effectif U17)
  // tiré par la roue du niveau (palier, valeur exacte cachée dedans) ; sans roue, tirage direct
  const lvTier = level ? levelTierById(level) : null;
  const ca0 = youthCA(q, 'U17') - 0.03 + (lvTier ? rng.range(lvTier.lo, lvTier.hi) : rng.gauss(0, 0.015));
  const attrs = genAttrs(role, ca0, rng, 0.045);
  // potentiel : indépendant du club. Tiré par la roue (palier choisi par le sort, valeur exacte
  // cachée dans le palier) ; sans roue, tirage direct.
  const tier = potential ? tierById(potential) : null;
  const pa = tier
    ? clamp(Math.max(ca0 + 0.05, rng.range(tier.lo, tier.hi)), 0.5, 0.9)
    : clamp(Math.max(ca0 + 0.07, rng.gauss(0.63, 0.075)), 0.5, 0.9);
  const st = {
    version: SAVE_VERSION, seed: s, createdAt: Date.now(),
    player: {
      firstName: firstName.trim() || 'Jeune', lastName: lastName.trim() || 'Joueur', role, foot, age: 15, number: 27, face, nation,
      attrs, pa, paStart: pa, morale: 0.62, fresh: 0.9, trust: 0.45, discipline: 0.6, school: 0.6, team: 0.5, fans: 0.12,
      injuryWeeks: 0, staffBias: rng.gauss(0, 0.02), staffPrecision: 0.08, caHistory: [], intl: { caps: {}, goals: 0, best: null },
      contract: { clubId, type: 'aspirant', until: 2027, salary: 0.3 }, money: 0, loan: null,
      potentialTier: tier ? { id: tier.id, label: tier.label } : null,
      levelTier: lvTier ? { id: lvTier.id, label: lvTier.label } : null,
    },
    clubId, formativeName: club.name, stage: 'U17', season: 2026, week: 0, world: emptyWorld(),
    league: null, phase: 'week', pendingEvent: null, matchday: null, lastReport: null, month: null, monthReview: null, lastMonthReview: null,
    seasonStats: null, history: [], journal: [], offers: null, retired: false, cups: [], trophies: [],
    rng: rng.snapshot(), eventCooldown: 2,
  };
  // formation à l'étranger : la famille suit, l'école se fait dans la langue du pays
  if (club.foreign) st.player.lang = { [club.country]: 0.6 };
  log(st, `Arrivée au centre de formation de ${club.name}${club.foreign ? ` (${club.country})` : ''}. Le staff estime ton niveau actuel à ${pct(currentCA(st))}.`);
  if (tier) log(st, `La roue a parlé : ${tier.label}. À toi d'en faire quelque chose.`);
  startSeason(st);
  return st;
}

function rngOf(st) { const r = new Rng('x'); r.restore(st.rng); return r; }
function saveRng(st, r) { st.rng = r.snapshot(); }
export const pct = (x) => Math.round(x * 100);
function log(st, text) { st.journal.unshift({ season: st.season, week: st.week, text }); if (st.journal.length > 300) st.journal.length = 300; }

export function currentCA(st) { return roleCA(st.player.role, st.player.attrs); }

// Estimation du potentiel par le staff : fourchette qui se resserre avec le temps d'observation
export function potentialEstimate(st) {
  const p = st.player;
  const c = clamp(p.pa + p.staffBias, 0.3, 0.97);
  return { lo: clamp(c - p.staffPrecision, 0.3, 0.97), hi: clamp(c + p.staffPrecision, 0.3, 0.97), center: c };
}
export const toStars = (x) => clamp(Math.round(((x - 0.42) / 0.09) * 2) / 2, 0.5, 5);

// ------------------------------------------------------------------ saison
function roundRobin(ids) {
  const list = [...ids];
  if (list.length % 2) list.push(null);
  const n = list.length, rounds = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs = [];
    for (let i = 0; i < n / 2; i++) {
      const a = list[i], b = list[n - 1 - i];
      if (a && b) pairs.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(pairs);
    list.splice(1, 0, list.pop());
  }
  return [...rounds, ...rounds.map((rd) => rd.map(([a, b]) => [b, a]))];
}

function buildLeague(st) {
  const club = clubById(st.clubId);
  const lg = leagueFor(club, st.stage);
  const r = rngOf(st);
  const ids = [...lg.clubs];
  for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(r.next() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  saveRng(st, r);
  st.league = {
    name: lg.name, simulated: lg.simulated, reserveOf: lg.reserveOf ?? null, stage: st.stage,
    teams: lg.clubs.map((id) => ({ id, name: teamName(clubById(id), st.stage, lg), p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 })),
    rounds: roundRobin(ids), results: [],
  };
  return lg;
}

export function startSeason(st) {
  const club = clubById(st.clubId);
  const lg = buildLeague(st);
  st.week = 0;
  st.seasonStats = { caStart: currentCA(st), apps: 0, starts: 0, minutes: 0, goals: 0, assists: 0, ratings: [], notSelected: 0, injuredWeeks: 0 };
  st.monthReview = null;
  st.cups = buildCups(st, st.league.rounds.length);
  st.weekExtras = null;
  st.callup = null;
  // objectifs du club pour la saison, selon la place prévue dans l'effectif
  st.objectives = setObjectives(st, selectionForecast(st).status);
  initMonth(st);
  st.phase = 'week';
  log(st, `Saison ${st.season}-${st.season + 1} : ${STAGE_LABEL[st.stage]} de ${club.name}, ${lg.name}.${st.cups.length ? ` Coupes : ${st.cups.map((c) => c.name).join(', ')}.` : ''}`);
  weekStart(st);
}

// Début de semaine : trêve internationale éventuelle (convocation annoncée à l'avance)
function weekStart(st) {
  const r = rngOf(st);
  // la semaine qui commence : demande du coach et proposition hors terrain
  const req = coachRequest(st, r);
  st.weekly = { week: st.week, coachFocus: req.focus, why: req.why, special: pickSpecial(st, r, abroad(st) ? clubCountry(st) : null) };
  st.callup = maybeCallup(st, r, currentCA(st));
  // mercato d'hiver : à mi-saison, des clubs se manifestent (prêt ou transfert)
  const len = st.league.rounds.length;
  if (st.week === Math.round(WINTER_WINDOW * len) && !st.window) {
    const offers = winterOffers(st, currentCA(st), r);
    if (offers.length) { st.window = { week: st.week, offers }; log(st, `Mercato d'hiver : ${offers.length} club(s) se manifestent.`); }
    maybeSigning(st, r);
  }
  if (st.week === 2) maybeSigning(st, r);
  if (st.window && st.week !== st.window.week) st.window = null; // la fenêtre se referme
  saveRng(st, r);
  if (st.callup) log(st, `Convocation : ${st.callup.label}.`);
}

// Demande de transfert : une fois par saison, en professionnel ; le club accepte de vendre au mercato
// et en fin de saison, au prix de la confiance du coach, du vestiaire et des supporters.
export function requestTransfer(st) {
  const p = st.player;
  if (st.stage !== 'Pro' || p.loan) throw new Error('Possible seulement en équipe première, hors prêt.');
  if (p.transferRequest === st.season) throw new Error('Demande déjà faite cette saison.');
  p.transferRequest = st.season;
  p.trust -= 0.08; p.team -= 0.04; p.fans -= 0.06; p.morale += 0.02;
  log(st, 'Demande de transfert déposée : le club accepte d\'écouter les offres.');
  return 'Ta demande est sur le bureau du président. Le vestiaire grince, les supporters aussi ; les offres arriveront au mercato.';
}

// Changement de poste durable : une fois par saison, avec une période d'adaptation (le coach hésite)
export const roleLevels = (st) => Object.keys(ROLES).map((r) => ({ role: r, label: ROLES[r], ca: roleCA(r, st.player.attrs) }));
export function changeRole(st, role) {
  const p = st.player;
  if (!ROLES[role] || role === p.role) throw new Error('Poste inchangé.');
  if (st.phase !== 'week') throw new Error('Change de poste en début de semaine.');
  if (p.roleChange?.season === st.season) throw new Error('Un seul changement de poste par saison.');
  if ((role === 'GK') !== (p.role === 'GK')) throw new Error('Passer de gardien à joueur de champ (ou l\'inverse) n\'est pas possible.');
  const from = p.role;
  p.role = role;
  p.roleChange = { season: st.season, from, until: st.week + 6 };
  p.trust -= 0.04;
  log(st, `Changement de poste : ${ROLES[from]} → ${ROLES[role]}. Six semaines d'adaptation.`);
  return `Te voilà ${ROLES[role].toLowerCase()}. Le coach te laisse six semaines pour t'adapter.`;
}

// Argent : abonnements (activer / arrêter) et achats
export function toggleService(st, id) {
  if (!SERVICES[id]) throw new Error('Service inconnu.');
  const p = st.player;
  p.services ??= {};
  p.services[id] = !p.services[id];
  if (p.services[id] && p.money < SERVICES[id].monthly) { p.services[id] = false; return 'Économies insuffisantes pour un premier mois.'; }
  log(st, p.services[id] ? `Tu engages : ${SERVICES[id].label.toLowerCase()} (${money(SERVICES[id].monthly)}/mois).` : `Tu arrêtes : ${SERVICES[id].label.toLowerCase()}.`);
  return null;
}
export function buy(st, id) {
  const c = canBuy(st, id);
  if (!c.ok) throw new Error(c.why);
  const it = PURCHASES[id], p = st.player;
  ensureState(st);
  p.money -= it.cost;
  (p.bought ??= {})[id] = it.once ? true : it.max ? (p.bought[id] ?? 0) + 1 : st.season;
  const out = track(st, 'services', () => it.apply(st));
  if (LEGACY[id]) (st.legacy ??= []).push({ id, name: LEGACY[id](p, st), season: st.season });
  log(st, `${it.label} (${money(it.cost)}) : ${out}`);
  return out;
}

// Mercato d'hiver : accepter une offre (prêt ou transfert) avant de valider la semaine
export function acceptWinterOffer(st, idx) {
  const o = st.window?.offers?.[idx];
  if (!o || st.phase !== 'week') throw new Error('Offre indisponible.');
  midSeasonMove(st, o);
  st.window = null;
}
export function declineWinter(st) { if (st.window) { log(st, 'Mercato d\'hiver : tu restes au club.'); st.window = null; } }

// Changement de club en cours de saison : nouveau championnat déjà entamé, statistiques par club
function midSeasonMove(st, o) {
  const p = st.player, old = clubById(st.clubId);
  const table = standings(st);
  const s = st.seasonStats;
  const avg = s.ratings.length ? s.ratings.reduce((a, b) => a + b, 0) / s.ratings.length : null;
  st.history.push({ season: st.season, age: p.age, club: old.name, stage: st.stage, league: st.league.name, pos: table.findIndex((t) => t.id === st.clubId) + 1, teams: table.length, apps: s.apps, starts: s.starts, goals: s.goals, assists: s.assists ?? 0, minutes: s.minutes, rating: avg, caStart: s.caStart, caEnd: currentCA(st), partial: true, cups: [] });
  if (o.loan) {
    p.loan = { parentId: st.clubId, parentStage: st.stage, parentContract: p.contract };
    p.contract = { clubId: o.clubId, type: 'prêt', until: st.season, salary: p.contract.salary };
  } else {
    p.loan = null;
    p.contract = { clubId: o.clubId, type: o.contract.type, until: st.season + o.contract.years - 1, salary: o.contract.salary, goalBonus: o.contract.goalBonus, winBonus: o.contract.winBonus, clause: o.contract.clause };
  }
  const frac = st.week / st.league.rounds.length;
  st.clubId = o.clubId; st.stage = o.stage; p.trust = 0.45; p.team = 0.45; p.fans = Math.max(0.12, p.fans * 0.4);
  buildLeague(st);
  const len = st.league.rounds.length;
  const newWeek = Math.min(len - 1, Math.max(1, Math.round(frac * len)));
  const r = rngOf(st);
  for (let w = 0; w < newWeek; w++) {
    st.week = w;
    for (const [h, a] of st.league.rounds[w]) { const [gh, ga] = aggregateScore(st, h, a, r); recordResult(st, h, a, gh, ga); }
  }
  saveRng(st, r);
  st.week = newWeek;
  st.seasonStats = { caStart: currentCA(st), apps: 0, starts: 0, minutes: 0, goals: 0, assists: 0, ratings: [], notSelected: 0, injuredWeeks: 0 };
  st.cups = []; st.weekExtras = null; st.callup = null;
  const t = `${o.loan ? 'Prêté' : 'Transféré'} à ${clubById(o.clubId).name} en cours de saison (${st.league.name}).`;
  log(st, t);
  (st.lastReport ??= { lines: [] }).lines.push(t);
}

// Après un match : rencontre supplémentaire de la semaine (coupe, sélection) ou fin de semaine
function nextOrFinish(st) {
  st.weekExtras ??= extrasForWeek(st);
  const ex = st.weekExtras.shift();
  if (ex) { toExtraMatchday(st, ex); return; }
  st.weekExtras = null;
  finishWeek(st);
}

function toExtraMatchday(st, ex) {
  const r = rngOf(st);
  if (ex.kind === 'cup') {
    const cup = st.cups.find((c) => c.id === ex.cupId);
    const opp = drawOpponent(st, cup, r);
    const sel = selectionForecast(st);
    let selection = sel.status;
    // en coupe, le coach fait tourner lors des premiers tours
    if (cup.idx <= 1 && !cup.rounds[cup.idx].league) {
      if (selection === 'non retenu') selection = 'remplaçant';
      else if (selection === 'remplaçant' && r.chance(0.5)) selection = 'titulaire';
    }
    st.matchday = { extra: { ...ex, stage: isYouthCup(cup.id) ? 'U19' : 'Pro' }, home: r.chance(0.5), opponentId: opp, selection, rival: sel.rival, reason: sel.reason };
  } else {
    const c = st.callup;
    st.matchday = { extra: { ...ex, stage: 'Pro', teamId: c.teamId, cat: c.cat }, home: c.home, opponentId: c.oppId, selection: c.starter ? 'titulaire' : 'remplaçant', rival: null };
  }
  saveRng(st, r);
  st.phase = 'matchday';
}

// Match suivant de la phase finale de l'été
function toTournamentMatch(st) {
  const r = rngOf(st);
  const ex = tournamentMatch(st, r);
  saveRng(st, r);
  const t = st.tournament;
  st.matchday = { extra: { ...ex, stage: 'Pro' }, home: ex.home, opponentId: ex.oppId, selection: t.starter || t.idx >= 1 && st.player.morale > 0.6 ? 'titulaire' : 'remplaçant', rival: null };
  st.phase = 'matchday';
}

// Nom affiché d'un adversaire de coupe ou de sélection
export function extraTeamName(st, id) {
  const md = st.matchday;
  const c = clubById(id);
  if (!c) return id;
  return md?.extra?.stage === 'U19' ? teamName(c, 'U19', null) : c.name;
}

// Résultat d'un match de coupe ou de sélection
function applyExtraResult(st, res) {
  const p = st.player, md = st.matchday, ex = md.extra;
  ensureState(st);
  const rep = st.lastReport ?? { lines: [] };
  const [gMine, gOpp] = md.home ? [res.score[0], res.score[1]] : [res.score[1], res.score[0]];
  const outcome = gMine > gOpp ? 'victoire' : gMine === gOpp ? 'nul' : 'défaite';
  const oppName = extraTeamName(st, md.opponentId);
  const s = st.seasonStats;
  const before = snap(p), caBefore = currentCA(st);
  if (res.minutes > 0) {
    const rating = res.rating;
    track(st, 'match', () => {
      p.morale += (rating - 6.3) * 0.03 + (outcome === 'victoire' ? 0.03 : outcome === 'défaite' ? -0.02 : 0);
      p.fresh -= 0.16 * (res.minutes / 90);
      if (ex.kind === 'nat') { p.pa += 0.002; p.morale += 0.03; p.fans += 0.04; } else p.trust += (rating - 6.3) * 0.02;
      relationsAfterMatch(p, res, rating, outcome);
      const r = rngOf(st);
      matchGrowth(st, res, md.opponentId, r);
      saveRng(st, r);
    });
    if (ex.kind === 'cup') {
      s.apps++; if (res.started) s.starts++;
      s.minutes += res.minutes; s.goals += res.goals; s.ratings.push(rating); s.assists = (s.assists ?? 0) + (res.assists ?? 0);
      s.cupGoals = (s.cupGoals ?? 0) + res.goals;
    } else {
      p.intl.caps[ex.cat] = (p.intl.caps[ex.cat] ?? 0) + 1;
      p.intl.goals += res.goals;
      p.intl.best = ex.cat;
    }
    const line = `${ex.label} : ${outcome} ${gMine}-${gOpp} contre ${oppName}. ${res.minutes} min, note ${rating.toFixed(1)}${res.goals ? `, ${res.goals} but(s)` : ''}.`;
    rep.lines.push(line);
    log(st, line);
  } else {
    rep.lines.push(`${ex.label} : ${outcome} ${gMine}-${gOpp} contre ${oppName} (${md.selection === 'blessé' ? 'blessé' : md.selection === 'remplaçant' ? 'resté sur le banc' : 'non retenu'}).`);
  }
  if (ex.kind === 'cup') {
    const r = rngOf(st);
    const t = resolveCupRound(st, ex.cupId, md.opponentId, md.home, gMine, gOpp, r);
    saveRng(st, r);
    rep.lines.push(t);
    log(st, t);
  }
  st.month.matches.push({ week: st.week, opp: oppName, home: md.home, gf: gMine, ga: gOpp, outcome, selection: md.selection, minutes: res.minutes || 0, started: !!res.started, goals: res.goals || 0, rating: res.minutes > 0 ? res.rating : null, comp: ex.label });
  rep.match = { ca: currentCA(st) - caBefore };
  for (const k of GAUGES) rep.match[k] = p[k] - before[k];
  st.lastReport = rep;
  if (ex.tourn) {
    const r = rngOf(st);
    const text = resolveTournamentMatch(st, gMine, gOpp, r);
    saveRng(st, r);
    rep.lines.push(text); log(st, text);
    if (st.tournament.alive) { toTournamentMatch(st); return; }
    const t = st.tournament;
    st.trophies ??= [];
    if (t.won) st.trophies.push({ season: st.season, name: t.name, kind: 'intl', club: nationality(st.player.nation).name });
    (st.player.intl.tournaments ??= []).push({ name: t.name, reached: t.reached, season: st.season });
    endSeason(st);
    return;
  }
  nextOrFinish(st);
}

export function seasonLength(st) { return st.league.rounds.length; }

export function fixtureOfWeek(st) {
  const rd = st.league.rounds[st.week];
  if (!rd) return null;
  const f = rd.find(([a, b]) => a === st.clubId || b === st.clubId);
  if (!f) return { bye: true };
  const home = f[0] === st.clubId;
  return { home, opponentId: home ? f[1] : f[0] };
}

// Forme récente : moyenne des trois dernières notes (0 si moins de deux matchs)
export function recentForm(st) {
  const r = st.seasonStats?.ratings ?? [];
  if (r.length < 2) return 0;
  const last = r.slice(-3);
  return last.reduce((a, b) => a + b, 0) / last.length - 6.6;
}
// petit aléa reproductible propre à une semaine (forme du concurrent, choix du coach)
function weekNoise(st, salt) {
  let h = 2166136261;
  const str = `${st.seed}:${st.season}:${st.week}:${st.clubId}:${salt}`;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967296 - 0.5;
}

// Sélection : comparaison avec le concurrent direct, pondérée par la confiance du coach,
// la forme du moment (la tienne et la sienne), la fraîcheur, et un éventuel renfort recruté au poste.
export function selectionForecast(st) {
  const p = st.player;
  if (p.injuryWeeks > 0) return { status: 'blessé', rival: null, reason: null };
  const club = clubById(st.clubId);
  const base = rivalFor(club, st.stage, st.season, st.league, p.role);
  const youth = st.stage === 'U17' || st.stage === 'U19';
  const len = st.league?.rounds?.length || 30;
  // le concurrent progresse aussi au fil de la saison, et a ses semaines avec et sans
  const drift = (st.week / len) * (youth ? 0.03 : 0.01);
  let rival = { ...base, ca: base.ca + drift, form: weekNoise(st, 'rival') * 0.03 };
  const sg = st.signing;
  if (sg && sg.season === st.season && sg.clubId === st.clubId && sg.week <= st.week) {
    const s2 = { name: sg.name, ca: sg.ca + drift * 0.5, real: false, form: weekNoise(st, 'signing') * 0.03, signing: true };
    if (s2.ca + s2.form > rival.ca + rival.form) rival = s2;
  }
  const form = recentForm(st);
  const adapting = p.roleChange?.season === st.season && st.week < p.roleChange.until ? 0.02 : 0;
  const me = currentCA(st) - adapting + 0.06 * (p.trust - 0.5) + 0.02 * (p.morale - 0.5) + 0.02 * ((p.team ?? 0.5) - 0.5)
    + clamp(form * 0.03, -0.025, 0.025) - (p.fresh < 0.35 ? 0.02 : 0);
  const them = rival.ca + rival.form;
  // en équipe première, un jeune doit nettement dépasser le titulaire en place pour lui prendre sa place
  const edge = st.stage === 'Pro' ? 0.015 : 0;
  let status = me >= them + edge ? 'titulaire' : me >= them - 0.065 ? 'remplaçant' : 'non retenu';
  let reason = status === 'titulaire' ? (form > 0.35 ? 'forme' : null) : form < -0.35 ? 'méforme' : rival.signing ? 'recrue' : rival.form > 0.008 ? 'concurrent' : null;
  // le coach ménage un joueur à bout de forces
  if (status === 'titulaire' && p.fresh < 0.32) { status = 'remplaçant'; reason = 'fatigue'; }
  // défi du coach relevé : il tient parole
  if (st.chance?.earned) { status = 'titulaire'; reason = 'chance'; }
  // en formation, les éducateurs font tourner : après trois semaines sans convocation, place sur le banc
  if (status === 'non retenu' && youth && (st.seasonStats?.streakOut ?? 0) >= 3 && me >= them - 0.11) { status = 'remplaçant'; reason = 'rotation'; }
  return { status, rival: { name: rival.name, ca: rival.ca, real: rival.real, signing: !!rival.signing }, reason };
}

export const SELECTION_REASON = {
  forme: 'Tu es en forme : le coach te fait confiance.',
  méforme: 'Tes derniers matchs ont été difficiles : le coach hésite.',
  recrue: 'Le renfort recruté à ton poste passe devant toi.',
  concurrent: 'Ton concurrent sort d\'une très bonne semaine.',
  fatigue: 'Le coach te ménage : ta fraîcheur est trop basse.',
  rotation: 'Les éducateurs font tourner l\'effectif.',
  chance: 'Défi relevé : le coach tient parole, tu débutes.',
};

// Renfort recruté au poste (début de saison ou mercato d'hiver), quand tu es installé
function maybeSigning(st, r) {
  if (st.signing?.season === st.season && st.signing?.clubId === st.clubId) return;
  const sel = selectionForecast(st);
  if (sel.status !== 'titulaire' || !r.chance(st.stage === 'U17' || st.stage === 'U19' ? 0.18 : 0.3)) return;
  const first = ['Mathis', 'Nolan', 'Yanis', 'Rayan', 'Enzo', 'Lenny', 'Kylian', 'Ilyes', 'Sacha', 'Timéo', 'Malik', 'Owen', 'Bastien', 'Evan'];
  const last = ['Lebrun', 'Fontaine', 'Marchal', 'Diallo', 'Perrin', 'Gauthier', 'Camara', 'Roussel', 'Mercier', 'Benali', 'Lemoine', 'Traoré', 'Royer', 'Colin'];
  const name = `${r.pick(first)} ${r.pick(last)}`;
  const ca = currentCA(st) + r.range(-0.015, 0.025); // un vrai concurrent : parfois meilleur, parfois non
  st.signing = { name, ca, season: st.season, clubId: st.clubId, week: st.week };
  const msg = `Le club recrute à ton poste : ${name} (niveau ${pct(ca)}). La concurrence est relancée.`;
  log(st, msg);
  (st.lastReport ??= { lines: [] }).lines.push(msg);
}

// ------------------------------------------------------------------ registre des effets
// Chaque effet d'un choix est mesuré (avant/après) et rangé par source : c'est ce qui alimente
// l'aperçu de la semaine et le bilan mensuel détaillé. Rien n'est estimé après coup.
export const GAUGES = ['morale', 'fresh', 'trust', 'discipline', 'school', 'team', 'fans'];
export const GAUGE_LABELS = { morale: 'Moral', fresh: 'Fraîcheur', trust: 'Confiance du coach', discipline: 'Discipline', school: 'Scolarité', team: 'Vestiaire', fans: 'Supporters' };
export const SOURCE_LABELS = { rest: 'Récupération de la semaine', match: 'Matchs', event: 'Événements de vie', injury: 'Blessures', staff: 'Regard du staff', nature: 'Aléa de croissance', relations: 'Vestiaire et supporters', services: 'Ton entourage et tes achats', age: 'L\'âge' };

function snap(p) { return { pa: p.pa, morale: p.morale, fresh: p.fresh, trust: p.trust, discipline: p.discipline, school: p.school, team: p.team, fans: p.fans, attrs: { ...p.attrs } }; }
function clampAll(p) {
  // le potentiel ne descend jamais sous le niveau déjà atteint
  p.pa = clamp(p.pa, Math.max(0.35, roleCA(p.role, p.attrs) + 0.005), 0.95);
  for (const k of GAUGES) p[k] = clamp(p[k], 0, 1);
}
function initMonth(st) {
  const p = st.player;
  const idx = Math.floor(st.week / 4) + 1;
  st.month = { index: idx, startWeek: st.week, ca0: currentCA(st), est0: potentialEstimate(st), base: snap(p), pos0: st.league ? standings(st).findIndex((t) => t.id === st.clubId) + 1 : null, src: {}, weeks: [], matches: [] };
}
// Exécute fn et enregistre ce qu'il a changé sous la source `src`
function track(st, src, fn, count = true) {
  const p = st.player;
  const a = snap(p);
  const out = fn();
  clampAll(p);
  const b = snap(p);
  if (!st.month) return out;
  const e = (st.month.src[src] ??= { n: 0, d: {} });
  if (count) e.n++;
  const add = (k, v) => { if (Math.abs(v) > 1e-9) e.d[k] = (e.d[k] ?? 0) + v; };
  add('pa', b.pa - a.pa);
  for (const k of GAUGES) add(k, b[k] - a[k]);
  for (const k in b.attrs) add(`a:${k}`, b.attrs[k] - a.attrs[k]);
  return out;
}
// Variation de niveau (note de poste) produite par des variations d'attributs
function caFromAttrDeltas(role, d) {
  const w = ROLE_WEIGHTS[role];
  let sum = 0, tw = 0;
  for (const k in w) { sum += w[k] * (d[`a:${k}`] ?? 0); tw += w[k]; }
  return sum / tw;
}
// Sauvegardes plus anciennes : complète les champs ajoutés depuis
export function ensureState(st) {
  if (!st.month) initMonth(st);
  st.cups ??= [];
  st.trophies ??= [];
  st.awards ??= [];
  st.player.intl ??= { caps: {}, goals: 0, best: null };
  st.formativeName ??= st.history[0]?.club ?? clubById(st.clubId)?.name;
  // montées et descentes des saisons passées
  st.world ??= emptyWorld();
  applyWorld(st.world);
  const p = st.player;
  p.nation ??= 'france';
  if (!st.objectives && st.league) st.objectives = setObjectives(st, 'remplaçant');
  p.money ??= 0;
  p.loan ??= null;
  p.team ??= 0.5;
  p.fans ??= 0.15;
  p.contract ??= { clubId: st.clubId, type: contractType(clubById(st.clubId), st.stage), until: st.season + 1, salary: salaryFor(clubById(st.clubId), st.stage, currentCA(st), p.age) };
  st.lastMonthReview ??= null;
  st.monthReview ??= null;
  return st;
}

// ------------------------------------------------------------------ semaine
// Effets d'une semaine. `r` nul = mode « attendu » (aperçu) : pas d'aléa, pas de blessure.
function weekEffects(st, { focus, intensity, offpitch, drill = null }, r, rep) {
  const p = st.player;
  const youth = st.stage === 'U17' || st.stage === 'U19';
  let injuryRisk = 0;
  if (p.age >= 30) track(st, 'age', () => ageing(p));
  if (p.injuryWeeks > 0) {
    track(st, 'injury', () => {
      if (r) { p.injuryWeeks--; st.seasonStats.injuredWeeks++; }
      p.fresh += 0.25;
    });
    rep.lines.push(p.injuryWeeks ? `Soins et réathlétisation : encore ${p.injuryWeeks} semaine(s) d'indisponibilité.` : 'Le staff médical te déclare apte.');
    return { injuryRisk: 0, injured: true };
  }
  const it = INTENSITY[intensity] ?? INTENSITY.normale;
  const freshBefore = p.fresh;
  const sp = offpitch === 'special' ? specialById(st.weekly?.special) : null;
  injuryRisk = (0.006 + it.injury + (freshBefore + it.fresh < 0.35 ? 0.03 : 0) + (offpitch === 'extra' ? 0.01 : 0)) * serviceEffects(p).injury * (sp?.injury ?? 1);
  // entraînement : thème + intensité, et l'atelier de la semaine (geste réussi ou non)
  const trainGrowth = it.growth * (focus === 'recuperation' ? 0.35 : 1) * (DRILL_MUL[drill] ?? 1);
  if (drill && DRILL_MUL[drill] && r) rep.lines.push(`Atelier : ${DRILL_LABEL[drill].toLowerCase()}${drill === 'parfait' ? ' — séance nettement plus profitable' : drill === 'rate' ? ' — séance moins profitable' : ''}.`);
  track(st, `train:${focus}`, () => {
    p.fresh += it.fresh + (focus === 'recuperation' ? 0.12 : 0);
    p.trust += it.trust;
    // surmenage : s'entraîner épuisé abîme le potentiel
    if (intensity === 'intense' && p.fresh < 0.3) { p.pa -= 0.0012; rep.lines.push('Le préparateur physique s\'inquiète : tu t\'entraînes trop fatigué.'); }
    progress(st, focus, trainGrowth, r);
  });
  // hors du terrain
  track(st, `off:${offpitch}`, () => {
    if (offpitch === 'ecole') { p.school += 0.04; p.discipline += 0.01; p.morale -= 0.01; p.pa += 0.0006; }
    if (offpitch === 'video') { p.pa += 0.0008; p.discipline += 0.01; p.attrs.decisions = clamp(p.attrs.decisions + 0.0015, 0.05, 0.97); progress(st, 'tactique', 0.05, r); }
    if (offpitch === 'extra') { p.pa += p.fresh > 0.5 ? 0.0007 : -0.001; p.fresh -= 0.1; p.trust += 0.01; progress(st, focus, 0.25, r); }
    if (offpitch === 'repos') { p.fresh += 0.15; p.morale += 0.04; }
    if (offpitch === 'sortie') { p.morale += 0.07; p.discipline -= 0.03; p.pa -= 0.0015; p.fresh -= 0.03; p.team += 0.015; }
    if (sp) { const txt = sp.apply(p, clubCountry(st)); if (sp.progress) progress(st, 'match', sp.progress, r); if (r && txt) rep.lines.push(txt); }
    if (youth && offpitch !== 'ecole' && !(sp?.id === 'soutien')) p.school -= 0.012; // la scolarité s'érode si on la néglige
  });
  // à l'étranger, tant que la langue n'est pas maîtrisée, l'intégration au vestiaire est plus lente
  if (abroad(st)) {
    const lang = langLevel(p, clubCountry(st));
    if (lang < 0.6) track(st, 'relations', () => { p.team -= 0.006 * (1 - lang); }, false);
  }
  // gestes signature : débloqués quand les qualités atteignent leur palier
  if (r) for (const id of unlockTraits(p)) { const t = TRAITS[id]; rep.lines.push(`Nouveau geste signature : ${t.label}. ${t.desc}`); log(st, `Geste signature débloqué : ${t.label}.`); }
  // défi du coach (voie de rattrapage) : trois semaines sérieuses de suite, puis une titularisation promise
  if (r && st.chance && !st.chance.earned) {
    const serious = focus === st.weekly?.coachFocus && intensity !== 'légère' && offpitch !== 'sortie';
    track(st, 'staff', () => {
      if (serious) {
        st.chance.done++; p.trust += 0.02; p.discipline += 0.01;
        if (st.chance.done >= st.chance.need) { st.chance.earned = true; rep.lines.push('Défi relevé ! Le coach t\'annonce titulaire pour le prochain match.'); }
        else rep.lines.push(`Défi du coach : ${st.chance.done}/${st.chance.need} semaines sérieuses.`);
      } else {
        st.chance = null; p.trust -= 0.02;
        rep.lines.push('Défi du coach manqué : il ne t\'en reparlera pas de sitôt.');
      }
    });
  }
  // suivre la demande du coach : il le remarque
  if (st.weekly?.coachFocus && focus === st.weekly.coachFocus) {
    track(st, 'staff', () => { p.trust += 0.015; p.morale += 0.005; });
    if (r) rep.lines.push('Tu as suivi la demande du coach : il l\'a remarqué.');
  }
  // ton entourage (abonnements payés avec tes économies)
  const sfx = serviceEffects(p);
  if (sfx.fresh || sfx.morale || sfx.composure || sfx.decisions || sfx.pa) {
    track(st, 'services', () => {
      p.fresh += sfx.fresh; p.morale += sfx.morale; p.pa += sfx.pa;
      p.attrs.composure = clamp(p.attrs.composure + sfx.composure, 0.05, 0.97);
      p.attrs.decisions = clamp(p.attrs.decisions + sfx.decisions, 0.05, 0.97);
    });
  }
  // regard du staff : sérieux et scolarité comptent
  if (p.discipline < 0.4 || (youth && p.school < 0.3)) {
    track(st, 'staff', () => {
      if (p.discipline < 0.4) p.trust -= 0.008;
      if (youth && p.school < 0.3) { p.trust -= 0.005; p.morale -= 0.01; }
    });
  }
  // le potentiel n'est pas figé : petite part d'incertitude propre à la croissance
  if (r) track(st, 'nature', () => { p.pa += r.gauss(0, 0.0005); }, false);
  return { injuryRisk, injured: false };
}

function weekRest(st) {
  const p = st.player;
  track(st, 'rest', () => {
    p.fresh += 0.17;
    p.morale += (0.6 - p.morale) * 0.08;
    p.team += (0.5 - p.team) * 0.02;
    if (p.fans > 0.3) p.fans -= 0.003; // la popularité s'entretient
  }, false);
  // relations : un vestiaire uni et des supporters derrière toi entretiennent le moral
  track(st, 'relations', () => { p.morale += 0.012 * (p.team - 0.5) + 0.008 * (p.fans - 0.3); }, false);
}

export function submitWeek(st, choices) {
  if (st.phase !== 'week') throw new Error('Pas de semaine à valider.');
  ensureState(st);
  const p = st.player;
  const r = rngOf(st);
  const before = snap(p), caBefore = currentCA(st);
  const rep = { lines: [], week: st.week, choices: p.injuryWeeks > 0 ? null : { ...choices } };
  const out = weekEffects(st, choices, r, rep);
  if (!out.injured) {
    st.month.weeks.push({ week: st.week, ...choices });
    if (r.chance(out.injuryRisk)) track(st, 'injury', () => injure(st, r, rep));
    const gained = currentCA(st) - caBefore;
    rep.lines.unshift(`Entraînement ${FOCUS[choices.focus]?.label.toLowerCase() ?? ''} (${choices.intensity}) · ${OFFPITCH[choices.offpitch]?.label.toLowerCase() ?? ''} : niveau ${gained >= 0 ? '+' : ''}${(gained * 100).toFixed(1)}.`);
  } else st.month.weeks.push({ week: st.week, injured: true });
  weekRest(st);
  p.staffPrecision = Math.max(0.02, p.staffPrecision - 0.0015);
  // variations de la semaine (pour l'affichage)
  rep.delta = { ca: currentCA(st) - caBefore };
  for (const k of GAUGES) rep.delta[k] = p[k] - before[k];
  st.lastReport = rep;
  // événement de vie
  st.eventCooldown = Math.max(0, st.eventCooldown - 1);
  // un événement lié à la situation peut arriver plus tôt ; sinon un événement de la vie courante
  let ev = null;
  if (p.injuryWeeks === 0) {
    if (st.eventCooldown <= 1 && r.chance(0.5)) ev = pickEvent(st, r, true);
    if (!ev && st.eventCooldown === 0 && r.chance(0.3)) ev = pickEvent(st, r);
  }
  saveRng(st, r);
  if (ev) { st.pendingEvent = ev; st.phase = 'event'; st.eventCooldown = 2; return st; }
  toMatchday(st);
  return st;
}

// Aperçu des effets ATTENDUS d'une semaine (sans aléa) : ce que le staff peut raisonnablement annoncer
export function previewWeek(st, choices) {
  const c = structuredClone(st);
  ensureState(c);
  c.month.src = {};
  const p0 = st.player, ca0 = currentCA(st);
  const rep = { lines: [] };
  const out = weekEffects(c, choices, null, rep);
  const afterChoices = snap(c.player);
  weekRest(c);
  const p1 = c.player;
  const attrs = Object.keys(p1.attrs).map((k) => ({ k, d: p1.attrs[k] - p0.attrs[k] })).filter((x) => Math.abs(x.d) > 1e-5).sort((a, b) => b.d - a.d);
  const res = { ca: currentCA(c) - ca0, pa: p1.pa - p0.pa, injuryRisk: out.injuryRisk, injured: out.injured, attrs, warnings: rep.lines, gauges: {}, choiceFresh: afterChoices.fresh - p0.fresh };
  for (const k of GAUGES) res.gauges[k] = p1[k] - p0[k];
  // part de chaque choix
  res.parts = Object.entries(c.month.src).filter(([k]) => k.startsWith('train:') || k.startsWith('off:')).map(([k, e]) => ({ key: k, label: sourceLabel(k), ca: caFromAttrDeltas(p0.role, e.d), pa: e.d.pa ?? 0, d: e.d }));
  return res;
}

export function sourceLabel(key) {
  if (key.startsWith('train:')) return `Entraînement — ${FOCUS[key.slice(6)]?.label ?? key.slice(6)}`;
  if (key === 'off:special') return 'Propositions de la semaine';
  if (key.startsWith('off:')) return OFFPITCH[key.slice(4)]?.label ?? key.slice(4);
  return SOURCE_LABELS[key] ?? key;
}

function ageFactor(age) {
  if (age < 18) return 1;
  if (age < 21) return 0.8;
  if (age < 24) return 0.5;
  if (age < 28) return 0.22;
  return 0;
}

// Vieillissement, une fois par semaine à partir de 30 ans : le physique décline (vitesse, accélération,
// endurance, jeu aérien), l'expérience entretient encore un peu la lecture du jeu jusqu'à 33 ans.
// Repères : environ −1 point de niveau par saison à 30 ans, −2 à −3 à 33 ans, −4 à −5 après 35 ans.
function ageing(p) {
  if (p.age < 30) return;
  const rate = [0.0005, 0.0008, 0.0011, 0.0015, 0.002, 0.0026][Math.min(5, p.age - 30)] * ageingMul(p);
  for (const k of ['pace', 'accel', 'stamina']) p.attrs[k] = clamp(p.attrs[k] - rate, 0.05, 0.97);
  p.attrs.aerial = clamp(p.attrs.aerial - rate * 0.4, 0.05, 0.97);
  if (p.role === 'GK') p.attrs.gk = clamp(p.attrs.gk - rate * 0.5, 0.05, 0.97);
  if (p.age <= 33) for (const k of ['decisions', 'positioning', 'composure']) p.attrs[k] = clamp(p.attrs[k] + 0.0002, 0.05, 0.97);
}

// Progression hebdomadaire : vers le potentiel, jamais au-delà (le déclin de l'âge est à part : ageing)
export function progress(st, focus, growthMul, r) {
  const p = st.player;
  const club = clubById(st.clubId);
  const ca = currentCA(st);
  const coach = 0.7 + 0.6 * academyQuality(club) * (st.stage === 'U17' || st.stage === 'U19' ? 1 : 0.85);
  const gap = clamp((p.pa - ca) / 0.2, -0.6, 1.2);
  // le temps de jeu compte surtout via les matchs eux-mêmes (matchGrowth) ; ici, l'élan d'un joueur qui joue
  const play = st.seasonStats.minutes > 0 && st.seasonStats.apps > st.week * 0.5 ? 1.04 : st.seasonStats.notSelected > st.week * 0.6 ? 0.9 : 1;
  let d = 0.0025 * ageFactor(p.age) * coach * growthMul * (0.6 + 0.8 * p.morale) * (p.fresh < 0.4 ? 0.6 : 1) * play * gap;
  if (gap < 0) d = Math.min(d, 0.0015 * gap);
  if (r) d *= 1 + r.gauss(0, 0.15);
  // répartition sur les attributs : le thème travaillé progresse davantage
  const w = ROLE_WEIGHTS[p.role];
  const focusAttrs = new Set(FOCUS[focus]?.attrs ?? []);
  const prop = {};
  for (const k of ATTRS) prop[k] = (focusAttrs.has(k) ? 1.5 : 0) + (w[k] ? 0.7 : 0);
  let sum = 0, tw = 0;
  for (const k in w) { sum += w[k] * prop[k]; tw += w[k]; }
  const scale = sum > 0 ? d / (sum / tw) : 0;
  for (const k of ATTRS) if (prop[k]) p.attrs[k] = clamp(p.attrs[k] + prop[k] * scale, 0.05, 0.97);
  return currentCA(st) - ca;
}

// Le match fait progresser : temps de jeu, niveau de l'adversaire, note du match, et la qualité
// de tes décisions quand tu joues le match toi-même (réussir au-delà des chances annoncées).
function matchGrowth(st, res, oppId, r) {
  const p = st.player;
  const ca = currentCA(st);
  const opp = clubById(oppId);
  const oppCA = opp ? teamStrength(opp, st.stage, st.league) : ca;
  const challenge = clamp(1 + (oppCA - ca) * 4, 0.7, 1.4);
  const perf = clamp(((res.rating ?? 6.3) - 6.3) / 1.2, -0.5, 1);
  progress(st, 'match', (res.minutes / 90) * (0.42 + 0.3 * perf) * challenge, r);
  const ch = res.choices;
  if (ch && ch.made) {
    const edge = clamp((ch.ok - ch.expected) * 0.0015 + ch.made * 0.0004, -0.003, 0.006);
    p.attrs.decisions = clamp(p.attrs.decisions + edge, 0.05, 0.97);
    p.attrs.composure = clamp(p.attrs.composure + edge * 0.6, 0.05, 0.97);
  }
}

function injure(st, r, rep) {
  const p = st.player;
  const serious = r.chance(0.12);
  p.injuryWeeks = serious ? r.int(8, 16) : r.int(1, 5);
  if (serious) p.pa = clamp(p.pa - r.range(0.006, 0.02), 0.35, 0.95);
  p.morale -= serious ? 0.12 : 0.04;
  const t = serious ? `Blessure sérieuse (${p.injuryWeeks} semaines). Le staff prévient que le retour sera long.` : `Blessure légère : ${p.injuryWeeks} semaine(s) d'arrêt.`;
  rep.lines.push(t);
  log(st, t);
}


export function resolveEvent(st, optionIdx) {
  if (st.phase !== 'event' || !st.pendingEvent) throw new Error('Aucun événement en attente.');
  const e = eventById(st.pendingEvent.id);
  const r = rngOf(st);
  ensureState(st);
  const out = track(st, 'event', () => e.options[optionIdx].apply(st, r));
  saveRng(st, r);
  log(st, `${st.pendingEvent.text} → ${st.pendingEvent.options[optionIdx]}. ${out}`);
  st.lastReport?.lines.push(out);
  st.pendingEvent = null;
  toMatchday(st);
  return out;
}

// ------------------------------------------------------------------ jour de match
function toMatchday(st) {
  const fx = fixtureOfWeek(st);
  if (!fx || fx.bye) { st.matchday = { bye: true }; st.phase = 'matchday'; return; }
  const sel = selectionForecast(st);
  st.matchday = { ...fx, selection: sel.status, rival: sel.rival, reason: sel.reason };
  st.phase = 'matchday';
}

// Prépare les deux effectifs du moteur pour le match de la semaine
export function matchSetup(st) {
  const md = st.matchday;
  const inSquad = md.selection === 'titulaire' || md.selection === 'remplaçant';
  if (md.extra) {
    // coupe ou sélection : effectifs de l'étape de la compétition (sélections : effectifs fictifs)
    const ex = md.extra;
    const mine = buildTeamSquad(clubById(ex.kind === 'nat' ? ex.teamId : st.clubId), ex.stage, st.season, null, inSquad ? st.player : null, md.selection);
    const theirs = buildTeamSquad(clubById(md.opponentId), ex.stage, st.season, null);
    const home = md.home ? mine : theirs, away = md.home ? theirs : mine;
    let subPlan = null;
    if (md.selection === 'remplaçant') { const r = new Rng(`sub:${st.seed}:${st.season}:${st.week}:${ex.kind}`); if (r.chance(0.75)) subPlan = { minute: r.int(55, 75) }; }
    return { home, away, userTeam: md.home ? 0 : 1, seed: `${st.seed}-${st.season}-${st.week}-${ex.kind}${ex.cupId ?? ''}`, subPlan, inSquad, homeName: home.def.name, awayName: away.def.name };
  }
  const club = clubById(st.clubId), opp = clubById(md.opponentId);
  const mine = buildTeamSquad(club, st.stage, st.season, st.league, inSquad ? st.player : null, md.selection);
  const theirs = buildTeamSquad(opp, st.stage, st.season, st.league);
  // l'adversaire d'une réserve est une équipe première réelle
  const home = md.home ? mine : theirs, away = md.home ? theirs : mine;
  const userTeam = md.home ? 0 : 1;
  // entrée en jeu prévue par le coach si le joueur commence sur le banc
  let subPlan = null;
  if (md.selection === 'remplaçant') {
    const r = new Rng(`sub:${st.seed}:${st.season}:${st.week}`);
    if (r.chance(0.7)) subPlan = { minute: r.int(58, 75) };
  }
  const seed = `${st.seed}-${st.season}-${st.week}`;
  const homeClub = md.home ? st.clubId : md.opponentId;
  return { home, away, userTeam, seed, subPlan, inSquad, homeName: home.def.name, awayName: away.def.name, derby: derbyOf(st.clubId, md.opponentId), weather: weatherFor(seed, st.week / Math.max(1, st.league.rounds.length), homeClub) };
}

// Résultat d'un match joué par le moteur (ou résumé simulé) -> carrière
export function applyMatchResult(st, res) {
  const p = st.player;
  const md = st.matchday;
  if (md?.bye) { nextOrFinish(st); return; }
  if (md?.extra) { applyExtraResult(st, res); return; }
  ensureState(st);
  const rep = st.lastReport ?? { lines: [] };
  const [gMine, gOpp] = md.home ? [res.score[0], res.score[1]] : [res.score[1], res.score[0]];
  recordResult(st, md.home ? st.clubId : md.opponentId, md.home ? md.opponentId : st.clubId, res.score[0], res.score[1]);
  const outcome = gMine > gOpp ? 'victoire' : gMine === gOpp ? 'nul' : 'défaite';
  const s = st.seasonStats;
  const oppName = nameOf(st, md.opponentId);
  if (md.selection === 'titulaire' || md.selection === 'remplaçant') s.streakOut = 0;
  const before = snap(p), caBefore = currentCA(st);
  // la titularisation promise est jouée : à toi de la saisir
  const promised = st.chance?.earned && md.reason === 'chance';
  if (promised) {
    st.chance = null;
    const ok = res.minutes > 0 && res.rating >= 6.8;
    track(st, 'staff', () => { p.trust += ok ? 0.08 : 0.01; p.morale += ok ? 0.04 : 0; });
    rep.lines.push(ok ? 'Tu as saisi ta chance : le coach compte de nouveau sur toi.' : 'Ta chance est passée sans éclat. À toi de la provoquer de nouveau.');
  }
  if (res.minutes > 0) {
    s.apps++; if (res.started) s.starts++;
    s.minutes += res.minutes; s.goals += res.goals; s.assists = (s.assists ?? 0) + (res.assists ?? 0);
    const rating = res.rating;
    s.ratings.push(rating);
    track(st, 'match', () => {
      p.trust += (rating - 6.3) * 0.03;
      p.morale += (rating - 6.3) * 0.03 + (outcome === 'victoire' ? 0.03 : outcome === 'défaite' ? -0.03 : 0);
      p.fresh -= 0.16 * (res.minutes / 90);
      if (res.minutes >= 45) p.pa += 0.0005; // le temps de jeu nourrit le potentiel
      relationsAfterMatch(p, res, rating, outcome);
      // le match fait progresser : l'expérience compte
      const r = rngOf(st);
      matchGrowth(st, res, md.opponentId, r);
      saveRng(st, r);
    });
    rep.lines.push(`${outcome[0].toUpperCase()}${outcome.slice(1)} ${gMine}-${gOpp} contre ${oppName}. ${res.minutes} min, note ${rating.toFixed(1)}${res.goals ? `, ${res.goals} but(s)` : ''}.`);
    // derby : l'émotion compte double
    const derby = derbyOf(st.clubId, md.opponentId);
    if (derby) {
      track(st, 'match', () => { p.fans += outcome === 'victoire' ? 0.06 : outcome === 'défaite' ? -0.04 : 0; p.morale += outcome === 'victoire' ? 0.04 : outcome === 'défaite' ? -0.02 : 0; });
      rep.lines.push(outcome === 'victoire' ? `${derby} gagné : la ville est à vous !` : outcome === 'défaite' ? `${derby} perdu : la semaine va être longue.` : `${derby} : match nul, personne ne se moquera de personne.`);
    }
    // primes du contrat : par but, et par victoire en ayant joué
    const c = p.contract;
    const prime = (c?.goalBonus ?? 0) * (res.goals ?? 0) + (outcome === 'victoire' ? c?.winBonus ?? 0 : 0);
    if (prime > 0) { p.money += prime; st.month.earned = (st.month.earned ?? 0) + prime; rep.lines.push(`Primes : ${money(prime)}.`); }
    log(st, `J${st.week + 1} : ${outcome} ${gMine}-${gOpp} contre ${oppName} — ${res.minutes} min, note ${rating.toFixed(1)}${res.goals ? `, ${res.goals} but(s)` : ''}.`);
  } else {
    track(st, 'match', () => {
      if (md.selection === 'non retenu') { s.notSelected++; s.streakOut = (s.streakOut ?? 0) + 1; p.morale -= 0.03; }
      if (md.selection === 'non retenu' && s.notSelected >= 4 && s.notSelected % 4 === 0) p.pa -= 0.002; // manque de temps de jeu prolongé
    });
    rep.lines.push(`${outcome[0].toUpperCase()}${outcome.slice(1)} ${gMine}-${gOpp} contre ${oppName} (${md.selection === 'blessé' ? 'blessé' : md.selection === 'remplaçant' ? 'resté sur le banc' : 'non retenu'}).`);
  }
  st.month.matches.push({ week: st.week, opp: oppName, home: md.home, gf: gMine, ga: gOpp, outcome, selection: md.selection, minutes: res.minutes || 0, started: !!res.started, goals: res.goals || 0, rating: res.minutes > 0 ? res.rating : null });
  rep.match = { ca: currentCA(st) - caBefore };
  for (const k of GAUGES) rep.match[k] = p[k] - before[k];
  st.lastReport = rep;
  nextOrFinish(st);
}

// Le vestiaire juge l'état d'esprit (passes décisives, jeu collectif ou personnel) ; les supporters, les buts et les résultats
function relationsAfterMatch(p, res, rating, outcome) {
  p.fans += 0.025 * (res.goals ?? 0) + 0.012 * (rating - 6.5) + (outcome === 'victoire' ? 0.008 : outcome === 'défaite' ? -0.008 : 0);
  p.team += 0.008 * (rating - 6.4) + 0.02 * (res.assists ?? 0);
  if (res.style) p.team += 0.005 * (res.style.team ?? 0) - 0.012 * (res.style.selfish ?? 0);
}

// Score d'un match où le joueur n'entre pas : modèle agrégé (même que les autres rencontres)
export function quickScore(st, homeId, awayId) {
  const r = rngOf(st);
  const sc = aggregateScore(st, homeId, awayId, r);
  saveRng(st, r);
  return sc;
}

export function nameOf(st, id) { return st.league.teams.find((t) => t.id === id)?.name ?? clubById(id)?.name ?? id; }

function poisson(r, lambda) {
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= r.next(); } while (p > L && k < 15);
  return k - 1;
}

// Modèle agrégé des rencontres de contexte : volume de buts aligné sur le moteur de match
// recalibré (≈ 2,9 buts par match, avantage du terrain compris).
export const CONTEXT_GOALS = { home: 1.6, away: 1.25 };
function aggregateScore(st, h, a, r) {
  const sH = teamStrength(clubById(h), st.stage, st.league), sA = teamStrength(clubById(a), st.stage, st.league);
  return [poisson(r, CONTEXT_GOALS.home * Math.exp(7 * (sH - sA))), poisson(r, CONTEXT_GOALS.away * Math.exp(7 * (sA - sH)))];
}

function recordResult(st, h, a, gh, ga) {
  const T = (id) => st.league.teams.find((t) => t.id === id);
  const th = T(h), ta = T(a);
  th.p++; ta.p++; th.gf += gh; th.ga += ga; ta.gf += ga; ta.ga += gh;
  if (gh > ga) { th.w++; ta.l++; th.pts += 3; } else if (gh < ga) { ta.w++; th.l++; ta.pts += 3; } else { th.d++; ta.d++; th.pts++; ta.pts++; }
  st.league.results.push({ week: st.week, h, a, gh, ga });
}

export function standings(st) {
  return [...st.league.teams].sort((x, y) => y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf || x.name.localeCompare(y.name, 'fr'));
}

export function finishWeek(st) {
  const r = rngOf(st);
  const rd = st.league.rounds[st.week] ?? [];
  for (const [h, a] of rd) {
    if (h === st.clubId || a === st.clubId) continue;
    const [gh, ga] = aggregateScore(st, h, a, r);
    recordResult(st, h, a, gh, ga);
  }
  saveRng(st, r);
  if (st.matchday?.bye) st.lastReport?.lines.push('Pas de match cette semaine (journée d\'exemption).');
  st.player.caHistory.push(Math.round(currentCA(st) * 1000) / 1000);
  // salaire de la semaine
  // salaire annuel réparti sur les semaines de la saison
  // (plus les loyers de tes placements)
  const income = (st.player.contract?.salary ?? 0) + passiveIncome(st.player);
  if (income > 0) { const pay = (income * 12) / st.league.rounds.length; st.player.money += pay; st.month.earned = (st.month.earned ?? 0) + pay; }
  // abonnements de ton entourage : prélevés chaque semaine ; sans argent, ils s'arrêtent
  const cost = (monthlyCost(st.player) * 12) / st.league.rounds.length;
  if (cost > 0) {
    if (st.player.money >= cost) { st.player.money -= cost; st.month.spent = (st.month.spent ?? 0) + cost; }
    else { st.player.services = {}; log(st, 'Économies épuisées : tes abonnements (préparateurs, analyste…) s\'arrêtent.'); }
  }
  st.matchday = null;
  st.week++;
  if (st.week >= seasonLength(st)) {
    // l'été : phase finale en sélection si tu es retenu, puis le bilan de la saison
    const r = rngOf(st);
    st.tournament = summerTournament(st, r, currentCA(st));
    saveRng(st, r);
    if (st.tournament) { log(st, `Sélectionné pour ${st.tournament.name} !`); toTournamentMatch(st); return; }
    endSeason(st); return;
  }
  // fin de mois (4 semaines) : point d'étape détaillé
  if (st.week % 4 === 0) {
    ensureState(st);
    st.monthReview = buildMonthReview(st);
    st.lastMonthReview = st.monthReview;
    initMonth(st);
    st.phase = 'month_review';
    return;
  }
  st.phase = 'week';
  weekStart(st);
}

export function closeMonthReview(st) {
  if (st.phase !== 'month_review') return;
  st.monthReview = null;
  st.phase = 'week';
  weekStart(st);
}

// ------------------------------------------------------------------ bilan mensuel
const ATTR_KEYS = ATTRS;
function buildMonthReview(st) {
  const p = st.player, mo = st.month;
  const ca1 = currentCA(st);
  const table = standings(st);
  const pos1 = table.findIndex((t) => t.id === st.clubId) + 1;
  const kindOf = (k) => (k.startsWith('train:') ? 'train' : k.startsWith('off:') ? 'off' : k);
  // sources : effets mesurés de chaque choix
  const sources = Object.entries(mo.src).map(([key, e]) => {
    const attrs = ATTR_KEYS.map((k) => ({ k, d: e.d[`a:${k}`] ?? 0 })).filter((x) => Math.abs(x.d) > 2e-5).sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
    const g = {};
    for (const k of GAUGES) if (Math.abs(e.d[k] ?? 0) > 5e-4) g[k] = e.d[k];
  return { key, kind: kindOf(key), label: sourceLabel(key), n: e.n, ca: caFromAttrDeltas(p.role, e.d), pa: e.d.pa ?? 0, gauges: g, attrs };
  }).filter((x) => x.n > 0 || Math.abs(x.ca) > 1e-5 || Math.abs(x.pa) > 1e-5 || Object.keys(x.gauges).length);
  const order = { train: 0, off: 1, match: 2, event: 3, injury: 4, staff: 5, rest: 6, nature: 7 };
  sources.sort((a, b) => order[a.kind] - order[b.kind] || b.n - a.n);
  // attributs : variation totale et part de chaque famille de sources
  const attrs = ATTR_KEYS.filter((k) => k !== 'gk' || p.role === 'GK').map((k) => {
    const by = { train: 0, off: 0, match: 0, other: 0 };
    for (const [key, e] of Object.entries(mo.src)) {
      const kd = kindOf(key);
      by[kd === 'train' || kd === 'off' || kd === 'match' ? kd : 'other'] += e.d[`a:${k}`] ?? 0;
    }
    return { k, a: mo.base.attrs[k], b: p.attrs[k], d: p.attrs[k] - mo.base.attrs[k], by };
  }).sort((x, y) => y.d - x.d);
  const gauges = {};
  for (const k of GAUGES) gauges[k] = [mo.base[k], p[k]];
  const played = mo.matches.filter((m) => m.minutes > 0);
  const ratings = played.map((m) => m.rating);
  const matches = {
    list: mo.matches, played: played.length, starts: played.filter((m) => m.started).length,
    minutes: played.reduce((a, m) => a + m.minutes, 0), goals: played.reduce((a, m) => a + m.goals, 0),
    avg: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
    notSelected: mo.matches.filter((m) => m.selection === 'non retenu').length,
    w: mo.matches.filter((m) => m.outcome === 'victoire').length, d: mo.matches.filter((m) => m.outcome === 'nul').length, l: mo.matches.filter((m) => m.outcome === 'défaite').length,
  };
  const sumKind = (kind, f) => sources.filter((x) => x.kind === kind).reduce((a, x) => a + f(x), 0);
  const totals = {
    train: { ca: sumKind('train', (x) => x.ca), pa: sumKind('train', (x) => x.pa) },
    off: { ca: sumKind('off', (x) => x.ca), pa: sumKind('off', (x) => x.pa) },
    match: { ca: sumKind('match', (x) => x.ca), pa: sumKind('match', (x) => x.pa) },
    other: { ca: sources.filter((x) => !['train', 'off', 'match'].includes(x.kind)).reduce((a, x) => a + x.ca, 0), pa: sources.filter((x) => !['train', 'off', 'match'].includes(x.kind)).reduce((a, x) => a + x.pa, 0) },
  };
  const review = {
    index: mo.index, season: st.season, fromWeek: mo.startWeek + 1, toWeek: st.week,
    ca: [mo.ca0, ca1], est: [mo.est0, potentialEstimate(st)], paDelta: p.pa - mo.base.pa,
    gauges, attrs, sources, totals, matches, pos: [mo.pos0, pos1], teams: table.length,
    weeks: mo.weeks, advice: [], earned: mo.earned ?? 0, spent: mo.spent ?? 0,
  };
  review.advice = monthAdvice(st, review);
  return review;
}

// Remarques du staff : uniquement à partir de faits mesurés ce mois-ci
function monthAdvice(st, rv) {
  const p = st.player;
  const youth = st.stage === 'U17' || st.stage === 'U19';
  const out = [];
  const bestTrain = rv.sources.filter((x) => x.kind === 'train' && x.ca > 0).sort((a, b) => b.ca / Math.max(1, b.n) - a.ca / Math.max(1, a.n))[0];
  if (bestTrain) out.push(`Ton travail le plus rentable : ${bestTrain.label.replace('Entraînement — ', '').toLowerCase()} (+${(bestTrain.ca * 100).toFixed(1)} de niveau en ${bestTrain.n} semaine(s)).`);
  const costly = rv.sources.filter((x) => x.pa < -0.0005).sort((a, b) => a.pa - b.pa)[0];
  if (costly) out.push(`« ${costly.label} » t'a coûté ${(Math.abs(costly.pa) * 100).toFixed(2)} point de potentiel ce mois-ci.`);
  const boost = rv.sources.filter((x) => x.pa > 0.0005 && x.kind !== 'nature').sort((a, b) => b.pa - a.pa)[0];
  if (boost) out.push(`« ${boost.label} » a élevé ton potentiel de ${(boost.pa * 100).toFixed(2)} point.`);
  if (p.fresh < 0.4) out.push(`Fraîcheur basse (${pct(p.fresh)}) : une semaine légère ou de récupération réduirait le risque de blessure et relancerait ta progression.`);
  if (youth && p.school < 0.35) out.push(`Scolarité en baisse (${pct(p.school)}) : le centre y est attentif, et le coach commence à le remarquer.`);
  if (p.discipline < 0.4) out.push(`Ta discipline (${pct(p.discipline)}) entame la confiance du coach chaque semaine.`);
  if (rv.matches.notSelected >= 2) out.push(`Non retenu ${rv.matches.notSelected} fois : la confiance du coach (${pct(p.trust)}) remonte avec l'intensité à l'entraînement et de bonnes notes.`);
  if (rv.matches.avg != null && rv.matches.avg >= 7) out.push(`Note moyenne de ${rv.matches.avg.toFixed(1)} en match : le coach s'appuie de plus en plus sur toi.`);
  const gap = rv.est[1].center - rv.ca[1];
  if (gap < 0.03) out.push('Tu approches du plafond que le staff t\'imagine : pour aller plus haut, il faut d\'abord faire grandir ton potentiel (vidéo, études, hygiène de vie, temps de jeu).');
  if (!out.length) out.push('Mois régulier : continue sur cette lancée.');
  return out.slice(0, 5);
}

// ------------------------------------------------------------------ fin de saison
function endSeason(st) {
  const p = st.player;
  const s = st.seasonStats;
  const table = standings(st);
  const pos = table.findIndex((t) => t.id === st.clubId) + 1;
  const avg = s.ratings.length ? s.ratings.reduce((a, b) => a + b, 0) / s.ratings.length : null;
  const caEnd = currentCA(st);
  st.trophies ??= [];
  if (pos === 1) st.trophies.push({ season: st.season, name: `Champion · ${st.league.name}`, kind: 'league', club: clubById(st.clubId).name });
  const cupRuns = (st.cups ?? []).map((c) => ({ name: c.name, reached: c.champion ? 'Vainqueur' : c.log.length ? c.log.at(-1).label : '—' }));
  const awards = seasonAwards(st, pos, avg, caEnd);
  st.awards ??= [];
  st.awards.push(...awards);
  st.seasonHonours = { trophies: st.trophies.filter((t) => t.season === st.season), awards };
  st.history.push({ cups: cupRuns, season: st.season, age: p.age, club: clubById(st.clubId).name, stage: st.stage, league: st.league.name, tier: clubLevel(clubById(st.clubId)), pos, teams: table.length, apps: s.apps, starts: s.starts, goals: s.goals, assists: s.assists ?? 0, minutes: s.minutes, rating: avg, caStart: s.caStart, caEnd });
  // objectifs de la saison : prime et confiance, ou déception
  const objs = settleObjectives(st);
  st.history.at(-1).objectives = objs.map((o) => ({ label: o.label, done: o.done, effect: o.effect }));
  for (const o of objs) log(st, `Objectif ${o.done ? 'atteint' : 'manqué'} : ${o.label}${o.done ? ` (${o.effect})` : ''}.`);
  // montées et descentes dans tous les championnats (le tien selon son vrai classement)
  const moved = advanceWorld(st, table.map((t) => t.id));
  const me = clubById(st.clubId);
  const myMove = moved.up.includes(me.id) ? 'promu' : moved.down.includes(me.id) ? 'relégué' : null;
  st.history.at(-1).move = myMove;
  st.seasonMoves = { up: moved.up.filter((id) => sameArea(id, me)), down: moved.down.filter((id) => sameArea(id, me)) };
  if (myMove) log(st, `${me.name} ${myMove === 'promu' ? 'monte' : 'descend'} : la saison prochaine en ${divisionName(me)}.`);
  p.age++;
  const r = rngOf(st);
  p.staffBias = r.gauss(0, 0.02); // nouvelle évaluation du staff
  // le pari de la saison sur la start-up d'un ami
  if (p.startup?.season === st.season) {
    const u = r.next(), back = u < 0.3 ? 3 : u < 0.6 ? 1.3 : 0;
    p.money += p.startup.stake * back;
    log(st, back === 3 ? `La start-up de ton ami cartonne : ta mise est triplée (${money(p.startup.stake * back)}).` : back ? `La start-up tient la route : petite plus-value (${money(p.startup.stake * back)}).` : 'La start-up de ton ami a mis la clé sous la porte : ta mise est perdue.');
    p.startup = null;
  }
  saveRng(st, r);
  st.offers = buildOffers(st, pos, table.length);
  st.phase = 'season_end';
  log(st, `Fin de saison : ${pos}e sur ${table.length}. ${s.apps} matchs, ${s.goals} but(s). Niveau ${pct(s.caStart)} → ${pct(caEnd)}.`);
  for (const a of awards) log(st, `Récompense : ${a.name}.`);
}

// clubs du même pays que le tien (compte rendu des montées et descentes)
function sameArea(id, me) { const c = clubById(id); return !!c && (c.foreign ? c.country : 'France') === (me.foreign ? me.country : 'France'); }

// Récompenses individuelles de fin de saison (seuils réalistes selon la longueur du championnat)
function seasonAwards(st, pos, avg, ca) {
  const s = st.seasonStats, p = st.player;
  const len = st.league.rounds.length;
  const r = rngOf(st);
  const out = [];
  const add = (name, kind = 'award') => out.push({ season: st.season, name, kind, club: clubById(st.clubId).name });
  const lgShort = st.league.name.split(' · ')[0];
  const leagueGoals = s.goals - (s.cupGoals ?? 0);
  // meilleur buteur et meilleur passeur : comparés au total d'un concurrent tiré au sort
  const topScorer = Math.round(len * (0.42 + 0.22 * r.next()));
  const topAssist = Math.round(len * (0.22 + 0.12 * r.next()));
  if (leagueGoals >= topScorer && leagueGoals >= 6) add(`Meilleur buteur · ${lgShort} (${leagueGoals} buts)`);
  if ((s.assists ?? 0) >= topAssist && (s.assists ?? 0) >= 5) add(`Meilleur passeur · ${lgShort} (${s.assists} passes décisives)`);
  if (avg != null && avg >= 7.25 && s.apps >= len * 0.6) add(`Équipe type · ${lgShort}`);
  if (avg != null && avg >= 7.6 && s.apps >= len * 0.7) add(`Joueur de la saison · ${lgShort}`);
  if (st.stage === 'Pro' && p.age <= 21 && avg != null && avg >= 7.0 && s.apps >= len * 0.5) add(`Meilleur espoir · ${lgShort}`);
  if (st.stage === 'Pro' && p.age <= 21 && clubLevel(clubById(st.clubId)) <= 2 && ca >= 0.72 && avg != null && avg >= 7.1) add('Golden Boy', 'golden');
  // Ballon d'or : réservé à l'élite (Ligue 1, coupes d'Europe, équipe de France)
  if (st.stage === 'Pro' && clubLevel(clubById(st.clubId)) === 1 && avg != null) {
    const majors = (st.trophies ?? []).filter((t) => t.season === st.season).length;
    const score = ca * 100 + (avg - 7) * 20 + s.goals * 0.45 + (s.assists ?? 0) * 0.25 + majors * 5 + (p.intl?.caps?.A ?? 0) * 0.3 + (pos === 1 ? 3 : 0);
    const rank = score >= 112 ? 1 : score >= 106 ? 2 + (score < 108 ? 1 : 0) : score >= 99 ? 4 + Math.floor((106 - score) / 1.2) : score >= 91 ? 11 + Math.floor((99 - score) * 2.2) : null;
    if (rank) { add(rank === 1 ? 'Ballon d\'or' : `Ballon d'or : ${rank}e`, rank === 1 ? 'ballon' : 'ballon-rank'); st.ballonDor = [...(st.ballonDor ?? []), { season: st.season, rank }]; }
  }
  saveRng(st, r);
  return out;
}

// Palmarès et statistiques de carrière (archives + saison en cours)
export function careerRecord(st) {
  const hist = st.history ?? [];
  const totals = hist.reduce((a, h) => ({ apps: a.apps + h.apps, goals: a.goals + h.goals, assists: a.assists + (h.assists ?? 0), minutes: a.minutes + h.minutes, rated: a.rated + (h.rating ? h.apps : 0), ratingSum: a.ratingSum + (h.rating ? h.rating * h.apps : 0) }), { apps: 0, goals: 0, assists: 0, minutes: 0, rated: 0, ratingSum: 0 });
  const s = st.seasonStats;
  if (s && st.phase !== 'season_end' && st.phase !== 'retired') {
    totals.apps += s.apps; totals.goals += s.goals; totals.assists += s.assists ?? 0; totals.minutes += s.minutes;
    const sum = s.ratings.reduce((a, b) => a + b, 0); totals.rated += s.ratings.length; totals.ratingSum += sum;
  }
  const best = (k) => hist.filter((h) => h[k] != null).sort((a, b) => b[k] - a[k])[0] ?? null;
  const peak = Math.max(currentCA(st), ...hist.map((h) => h.caEnd ?? 0));
  const clubs = [...new Set(hist.map((h) => h.club))];
  return {
    totals: { ...totals, rating: totals.rated ? totals.ratingSum / totals.rated : null, seasons: new Set(hist.map((h) => h.season)).size, clubs: clubs.length },
    records: { goals: best('goals'), assists: best('assists'), rating: hist.filter((h) => h.rating && h.apps >= 8).sort((a, b) => b.rating - a.rating)[0] ?? null, peak },
    trophies: st.trophies ?? [], awards: st.awards ?? [], intl: st.player.intl ?? { caps: {}, goals: 0 }, ballonDor: st.ballonDor ?? [],
  };
}

// Décision du club et offres pour la saison suivante
function buildOffers(st, pos, n) {
  const p = st.player;
  const club = clubById(st.clubId);
  const ca = currentCA(st);
  const offers = [];
  const r = rngOf(st);
  const youth = st.stage === 'U17' || st.stage === 'U19';
  const proThreshold = (c) => divisionCA(c) - 0.07;
  const ss = st.seasonStats;
  const avg = ss.ratings.length ? ss.ratings.reduce((x, y) => x + y, 0) / ss.ratings.length : 0;
  const terms = (c, stage, opts) => contractTerms(c, stage, ca, p.age + 0, opts);
  if (youth && p.age <= 17) {
    // reste en formation : U17 jusqu'à 16 ans, puis U19
    const next = p.age >= 17 ? 'U19' : 'U17';
    const expected = youthCA(academyQuality(club), next) - 0.06 - (next === 'U19' && st.stage === 'U17' ? 0.03 : 0);
    if (ca >= expected || p.trust > 0.7) {
      offers.push({ clubId: club.id, stage: next, kind: 'Prolongation en formation', own: true, contract: terms(club, next) });
      // une belle saison attire les recruteurs de centres plus réputés
      const shine = (avg >= 7.0 && ss.apps >= 12) || ss.goals >= 8 || ca >= expected + 0.05 || ((p.scouted ?? 0) > 0 && avg >= 6.7);
      if (shine) {
        const q = academyQuality(club);
        const better = academiesOf(countryOf(club)).filter((c) => c.id !== club.id && academyQuality(c) > q + 0.03 && ca >= youthCA(academyQuality(c), next) - 0.05);
        for (const c of shuffle(better, r).slice(0, avg >= 7.3 || ss.goals >= 12 ? 2 : 1)) offers.push({ clubId: c.id, stage: next, kind: 'Repéré par un centre plus réputé', contract: terms(c, next) });
      }
    } else {
      // libéré : d'autres centres de formation, moins exigeants
      const q = academyQuality(club);
      const cands = academiesOf(countryOf(club)).filter((c) => c.id !== club.id && academyQuality(c) < q - 0.02 && ca >= youthCA(academyQuality(c), next) - 0.07);
      for (const c of shuffle(cands, r).slice(0, 3)) offers.push({ clubId: c.id, stage: next, kind: 'Essai concluant dans un autre centre', contract: terms(c, next) });
    }
  } else {
    // contrats seniors
    const contractRuns = !p.loan && p.contract && p.contract.clubId === club.id && p.contract.until > st.season;
    if (p.loan) {
      const parent = clubById(p.loan.parentId);
      offers.push({ clubId: parent.id, stage: p.loan.parentStage, kind: `Retour de prêt à ${parent.name}`, own: true, keep: true });
      if (avg >= 6.9 && club.senior && ca >= proThreshold(club)) offers.push({ clubId: club.id, stage: 'Pro', kind: 'Transfert définitif', contract: terms(club, 'Pro') });
    } else if (contractRuns) {
      offers.push({ clubId: club.id, stage: st.stage, kind: `Poursuivre ton contrat (fin en juin ${p.contract.until + 1})`, own: true, keep: true });
      for (const o of seasonLoanOffers(st, ca, r)) offers.push(o);
    } else if (ca >= proThreshold(club) && club.senior) {
      offers.push({ clubId: club.id, stage: 'Pro', kind: st.stage === 'Pro' ? 'Prolongation' : 'Premier contrat professionnel', own: true, contract: terms(club, 'Pro', { first: st.stage !== 'Pro' }) });
    } else if (club.reserve && ca >= SENIOR_CA[club.reserve.level] - 0.08) {
      offers.push({ clubId: club.id, stage: 'Réserve', kind: st.stage === 'Réserve' ? 'Saison de plus en réserve' : 'Contrat stagiaire (réserve)', own: true, contract: terms(club, 'Réserve') });
    } else if (club.foreign && st.stage === 'U19' && ca >= proThreshold(club) - 0.08) {
      // pas d'équipe réserve à l'étranger : premier contrat au club, puis prêt dans un club du pays pour jouer
      const hosts = PRO_CLUBS().filter((c) => c.foreign && c.country === club.country && c.id !== club.id && ca >= proThreshold(c) && ca <= divisionCA(c) + 0.06);
      const host = hosts.length ? r.pick(hosts) : null;
      if (host) offers.push({ clubId: host.id, stage: 'Pro', loan: true, own: true, parentStage: 'Pro', parentContract: terms(club, 'Pro', { first: true }), kind: `Premier contrat à ${club.name}, prêté à ${host.name}` });
    }
    const extra = (p.agent ? 3 : 2) + (pos <= 3 ? 1 : 0) + ((p.scouted ?? 0) > 0 ? 1 : 0) + ((p.fans ?? 0) >= 0.7 ? 1 : 0) + (p.leverage === st.season ? 1 : 0) + (p.transferRequest === st.season ? 2 : 0);
    // clubs professionnels de France et de l'étranger dont le niveau correspond au tien
    const pool = PRO_CLUBS().filter((c) => c.id !== club.id && c.id !== p.loan?.parentId);
    const cands = pool.filter((c) => ca >= proThreshold(c) && ca <= divisionCA(c) + 0.08);
    // un joueur nettement au-dessus de son club : les plus grands clubs (France et étranger) se le disputent
    const power = teamCA(club, 'Pro');
    const top = ca > Math.max(power + 0.04, SENIOR_CA[1] + 0.03)
      ? pool.filter((c) => teamCA(c, 'Pro') >= power - 0.005 && ca >= divisionCA(c) - 0.02).sort((a, b) => teamCA(b, 'Pro') - teamCA(a, 'Pro')).slice(0, 4)
      : [];
    const here = countryOf(club);
    const picked = [...top, ...mixByCountry(cands.filter((c) => !top.includes(c)), here, r, extra)].slice(0, extra);
    for (const c of picked) offers.push({ clubId: c.id, stage: 'Pro', kind: contractRuns ? 'Transfert' : 'Offre de contrat', contract: terms(c, 'Pro') });
    if (!offers.length) {
      const amateur = CLUBS.filter((c) => c.senior && clubLevel(c) === 5);
      const c = r.pick(amateur);
      offers.push({ clubId: c.id, stage: 'Pro', kind: 'Contrat fédéral (National 2)', contract: terms(c, 'Pro') });
    }
  }
  saveRng(st, r);
  p.scouted = 0; // l'intérêt des recruteurs vaut pour la saison écoulée
  // fin de carrière : proposée à partir de 33 ans (ou plus tôt si le niveau ne suit plus), imposée à 39 ans
  if (p.age >= 39) return [{ retire: true, kind: 'Fin de carrière : ton corps a dit stop' }];
  if (p.age >= 33 || (p.age >= 30 && ca < SENIOR_CA[5])) offers.push({ retire: true, kind: 'Mettre un terme à ta carrière' });
  return offers;
}

// L'agent tente d'améliorer une offre (une fois par offre)
export function negotiateOffer(st, idx) {
  if (st.phase !== 'season_end' || !st.player.agent) throw new Error('Pas d\'agent pour négocier.');
  const r = rngOf(st);
  const out = negotiate(st.offers[idx], currentCA(st), r);
  saveRng(st, r);
  log(st, `Négociation avec ${clubById(st.offers[idx].clubId).name} : ${out.text}`);
  return out;
}

function shuffle(a, r) { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r.next() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }

export function acceptOffer(st, idx) {
  if (st.phase !== 'season_end') throw new Error('Aucune offre à accepter.');
  const o = st.offers[idx];
  if (o.withdrawn) throw new Error('Cette offre a été retirée.');
  if (o.retire) { st.retired = true; st.phase = 'retired'; log(st, 'Fin de carrière de joueur.'); return; }
  const p = st.player;
  if (o.keep) {
    if (p.loan && o.clubId === p.loan.parentId) { p.contract = p.loan.parentContract; p.loan = null; log(st, `Retour de prêt à ${clubById(o.clubId).name}.`); }
  } else if (o.loan) {
    const parentContract = o.parentContract ? { clubId: st.clubId, type: o.parentContract.type, until: st.season + o.parentContract.years, salary: o.parentContract.salary } : p.contract;
    p.loan = { parentId: st.clubId, parentStage: o.parentStage ?? st.stage, parentContract };
    p.contract = { clubId: o.clubId, type: 'prêt', until: st.season + 1, salary: parentContract.salary };
  } else if (o.contract) {
    p.loan = null;
    p.contract = { clubId: o.clubId, type: o.contract.type, until: st.season + o.contract.years, salary: o.contract.salary, goalBonus: o.contract.goalBonus, winBonus: o.contract.winBonus, clause: o.contract.clause };
    if (p.agent && !o.own) { p.money -= o.contract.salary; log(st, `Commission de l'agent : ${money(o.contract.salary)}.`); }
  }
  const changed = o.clubId !== st.clubId;
  if (!changed) p.fans = Math.min(1, p.fans + 0.04); // la fidélité au club plaît aux supporters
  st.clubId = o.clubId; st.stage = o.stage; st.season++;
  st.offers = null;
  if (changed) { p.trust = 0.45; p.team = 0.45; p.fans = Math.max(0.12, p.fans * 0.4); log(st, `Signature à ${clubById(o.clubId).name} (${o.kind}${o.contract ? `, ${CONTRACT_LABEL[o.contract.type].toLowerCase()} de ${o.contract.years} an${o.contract.years > 1 ? 's' : ''}, ${money(o.contract.salary)}/mois` : ''}).`); }
  else if (o.contract) log(st, `${o.kind} : ${CONTRACT_LABEL[o.contract.type].toLowerCase()} de ${o.contract.years} an(s), ${money(o.contract.salary)}/mois.`);
  startSeason(st);
}

// Résumé lisible pour la liste des sauvegardes
export function summary(st) {
  const club = clubById(st.clubId);
  return { name: `${st.player.firstName} ${st.player.lastName}`, face: st.player.face ?? null, clubId: club.id, club: club.name, stage: STAGE_LABEL[st.stage], age: st.player.age, season: `${st.season}-${st.season + 1}`, week: st.week + 1, ca: pct(currentCA(st)) };
}

// Note de match à partir des statistiques du moteur (bornée)
// Note sur 10 normalisée par poste (références mesurées sur le moteur) : un match moyen ≈ 6,6-6,8.
// kp : passes clés (dernière passe avant un tir) ; drb : duels gagnés balle au pied, sur 90 minutes
const RATING_NORM = {
  GK: { pass: 0.76, tack: 0, shots: 0, kp: 0, drb: 0 }, FB: { pass: 0.72, tack: 4.5, shots: 0.2, kp: 1.05, drb: 14 }, CB: { pass: 0.77, tack: 5, shots: 0.1, kp: 0.4, drb: 8 },
  DM: { pass: 0.75, tack: 10, shots: 0.1, kp: 1.45, drb: 11 }, CM: { pass: 0.78, tack: 6.5, shots: 0.7, kp: 1.3, drb: 16 }, AM: { pass: 0.73, tack: 9, shots: 0.8, kp: 1.45, drb: 14 },
  W: { pass: 0.67, tack: 6, shots: 1.2, kp: 2.1, drb: 21 }, ST: { pass: 0.65, tack: 12, shots: 4.4, kp: 1.2, drb: 21 },
};
export function matchRating(stats, outcome, minutes, role, conceded = null) {
  if (!minutes) return null;
  const n = RATING_NORM[role] ?? RATING_NORM.CM;
  const share = Math.min(1, minutes / 90);
  const passPct = stats.passes >= 5 ? stats.passesOk / stats.passes : n.pass;
  let r = 6.6 + stats.goals * 0.9 + (stats.assists ?? 0) * 0.5 + (passPct - n.pass) * 3
    + (stats.tackles - n.tack * share) * (n.tack ? 0.5 / n.tack : 0)
    + (stats.shots - n.shots * share) * 0.05
    // ce qui distingue un grand joueur : faire tirer les autres, éliminer son adversaire
    + (stats.keyPasses != null ? (stats.keyPasses - n.kp * share) * 0.22 + (stats.dribbles - n.drb * share) * 0.015 : 0)
    + (outcome > 0 ? 0.3 : outcome < 0 ? -0.3 : 0);
  if (role === 'GK') r += 0.15 * (stats.saves ?? 0) - 0.35 + (conceded != null ? -0.2 * conceded + 0.25 : 0);
  if (role === 'CB' || role === 'FB') r += conceded != null ? -0.12 * conceded + 0.15 : 0;
  if (minutes < 30) r = 6.3 + (r - 6.6) * 0.6;
  return clamp(r, 3, 10);
}

// Match de l'équipe sans le joueur (non retenu, blessé) : résultat par le modèle agrégé
export function resultWithoutUser(st) {
  const md = st.matchday;
  const mine = md.extra?.kind === 'nat' ? md.extra.teamId : st.clubId;
  const h = md.home ? mine : md.opponentId, a = md.home ? md.opponentId : mine;
  return { score: quickScore(st, h, a), minutes: 0, goals: 0, started: false, rating: null };
}
