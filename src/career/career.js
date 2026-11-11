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
  clubById, academyQuality, leagueFor, teamName, teamStrength, buildTeamSquad, rivalFor,
  roleCA, genAttrs, youthCA, SENIOR_CA, clubLevel, teamCA, CLUBS, ROLE_WEIGHTS, STAGE_LABEL,
} from './clubs.js';

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
  ecole: { label: 'Études (double projet)', desc: 'Scolarité, discipline ; léger effet positif sur le potentiel.' },
  video: { label: 'Analyse vidéo', desc: 'Lecture du jeu ; petit gain de potentiel.' },
  extra: { label: 'Séance supplémentaire', desc: 'Progression plus rapide, mais fatigue et risque de blessure.' },
  repos: { label: 'Repos et famille', desc: 'Récupération et moral.' },
  sortie: { label: 'Sortie entre amis', desc: 'Moral en hausse, discipline et potentiel en baisse.' },
};
export const ROLES = { GK: 'Gardien', CB: 'Défenseur central', FB: 'Latéral', DM: 'Milieu défensif', CM: 'Milieu central', AM: 'Milieu offensif', W: 'Ailier', ST: 'Avant-centre' };

// ------------------------------------------------------------------ création
export function createCareer({ firstName, lastName, role, foot = 'droit', clubId, seed }) {
  const club = clubById(clubId);
  if (!club) throw new Error(`Club inconnu : ${clubId}`);
  const s = String(seed ?? Math.floor(Math.random() * 1e9));
  const rng = new Rng(`career:${s}`);
  const q = academyQuality(club);
  // niveau actuel : dépend du centre de formation (benjamin de l'effectif U17)
  const ca0 = youthCA(q, 'U17') - 0.03 + rng.gauss(0, 0.015);
  const attrs = genAttrs(role, ca0, rng, 0.045);
  // potentiel : aléatoire, indépendant du club
  const pa = clamp(Math.max(ca0 + 0.07, rng.gauss(0.63, 0.075)), 0.5, 0.9);
  const st = {
    version: SAVE_VERSION, seed: s, createdAt: Date.now(),
    player: {
      firstName: firstName.trim() || 'Jeune', lastName: lastName.trim() || 'Joueur', role, foot, age: 15, number: 27,
      attrs, pa, paStart: pa, morale: 0.62, fresh: 0.9, trust: 0.45, discipline: 0.6, school: 0.6,
      injuryWeeks: 0, staffBias: rng.gauss(0, 0.02), staffPrecision: 0.08, caHistory: [],
    },
    clubId, stage: 'U17', season: 2026, week: 0,
    league: null, phase: 'week', pendingEvent: null, matchday: null, lastReport: null,
    seasonStats: null, history: [], journal: [], offers: null, retired: false,
    rng: rng.snapshot(), eventCooldown: 2,
  };
  log(st, `Arrivée au centre de formation de ${club.name}. Le staff estime ton niveau actuel à ${pct(currentCA(st))}.`);
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

export function startSeason(st) {
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
  st.week = 0;
  st.seasonStats = { caStart: currentCA(st), apps: 0, starts: 0, minutes: 0, goals: 0, ratings: [], notSelected: 0, injuredWeeks: 0 };
  st.phase = 'week';
  log(st, `Saison ${st.season}-${st.season + 1} : ${STAGE_LABEL[st.stage]} de ${club.name}, ${lg.name}.`);
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

// Sélection : comparaison avec le concurrent direct, pondérée par la confiance du coach
export function selectionForecast(st) {
  const p = st.player;
  if (p.injuryWeeks > 0) return { status: 'blessé', rival: null };
  const club = clubById(st.clubId);
  const rival = rivalFor(club, st.stage, st.season, st.league, p.role);
  const me = currentCA(st) + 0.06 * (p.trust - 0.5) + 0.02 * (p.morale - 0.5) - (p.fresh < 0.35 ? 0.02 : 0);
  let status = me >= rival.ca ? 'titulaire' : me >= rival.ca - 0.065 ? 'remplaçant' : 'non retenu';
  // en formation, les éducateurs font tourner : après trois semaines sans convocation, place sur le banc
  const youth = st.stage === 'U17' || st.stage === 'U19';
  if (status === 'non retenu' && youth && (st.seasonStats?.streakOut ?? 0) >= 3 && me >= rival.ca - 0.11) status = 'remplaçant';
  return { status, rival };
}

// ------------------------------------------------------------------ semaine
export function submitWeek(st, { focus, intensity, offpitch }) {
  if (st.phase !== 'week') throw new Error('Pas de semaine à valider.');
  const p = st.player;
  const r = rngOf(st);
  const rep = { lines: [], caBefore: currentCA(st), paBefore: p.pa, moraleBefore: p.morale };
  if (p.injuryWeeks > 0) {
    p.injuryWeeks--; st.seasonStats.injuredWeeks++;
    p.fresh = clamp(p.fresh + 0.25, 0, 1);
    rep.lines.push(p.injuryWeeks ? `Soins et réathlétisation : encore ${p.injuryWeeks} semaine(s) d'indisponibilité.` : 'Le staff médical te déclare apte.');
    focus = 'recuperation'; intensity = 'légère'; offpitch = 'repos';
  } else {
    const it = INTENSITY[intensity] ?? INTENSITY.normale;
    let growth = it.growth;
    let paDelta = 0;
    p.fresh += it.fresh;
    p.trust += it.trust;
    let injuryRisk = 0.006 + it.injury + (p.fresh < 0.35 ? 0.03 : 0);
    // hors terrain
    if (offpitch === 'ecole') { p.school += 0.04; p.discipline += 0.01; p.morale -= 0.01; paDelta += 0.0003; }
    if (offpitch === 'video') { paDelta += 0.0004; growth += 0.05; p.discipline += 0.01; p.attrs.decisions = clamp(p.attrs.decisions + 0.0015, 0.05, 0.97); }
    if (offpitch === 'extra') { growth += 0.25; p.fresh -= 0.1; injuryRisk += 0.01; paDelta += p.fresh > 0.5 ? 0.0004 : -0.0012; p.trust += 0.01; }
    if (offpitch === 'repos') { p.fresh += 0.15; p.morale += 0.04; }
    if (offpitch === 'sortie') { p.morale += 0.07; p.discipline -= 0.03; paDelta -= 0.0008; p.fresh -= 0.03; }
    if (st.stage === 'U17' || st.stage === 'U19') p.school -= offpitch === 'ecole' ? 0 : 0.012;
    if (focus === 'recuperation') { growth *= 0.35; p.fresh += 0.12; }
    // surmenage : s'entraîner épuisé abîme le potentiel
    if (intensity === 'intense' && p.fresh < 0.3) { paDelta -= 0.0015; rep.lines.push('Le préparateur physique s\'inquiète : tu t\'entraînes trop fatigué.'); }
    // progression vers le potentiel
    const gained = progress(st, focus, growth, r);
    // le potentiel n'est pas figé : petite part d'incertitude propre à la croissance
    p.pa = clamp(p.pa + paDelta + r.gauss(0, 0.0012), 0.35, 0.95);
    if (r.chance(injuryRisk)) injure(st, r, rep);
    rep.lines.push(`Entraînement ${FOCUS[focus]?.label.toLowerCase() ?? ''} (${intensity}) : niveau ${gained >= 0 ? '+' : ''}${(gained * 100).toFixed(1)}.`);
  }
  p.fresh = clamp(p.fresh + 0.17, 0, 1);
  p.morale = clamp(p.morale + (0.6 - p.morale) * 0.08, 0, 1);
  p.trust = clamp(p.trust, 0, 1); p.discipline = clamp(p.discipline, 0, 1); p.school = clamp(p.school, 0, 1);
  p.staffPrecision = Math.max(0.02, p.staffPrecision - 0.0015);
  st.lastReport = rep;
  // événement de vie
  st.eventCooldown = Math.max(0, st.eventCooldown - 1);
  const ev = st.eventCooldown === 0 && p.injuryWeeks === 0 && r.chance(0.24) ? pickEvent(st, r) : null;
  saveRng(st, r);
  if (ev) { st.pendingEvent = ev; st.phase = 'event'; st.eventCooldown = 3; return st; }
  toMatchday(st);
  return st;
}

function ageFactor(age) {
  if (age < 18) return 1;
  if (age < 21) return 0.8;
  if (age < 24) return 0.5;
  if (age < 28) return 0.22;
  return 0;
}

// Progression hebdomadaire : vers le potentiel, jamais au-delà ; déclin après 29 ans
function progress(st, focus, growthMul, r) {
  const p = st.player;
  const club = clubById(st.clubId);
  const ca = currentCA(st);
  const coach = 0.7 + 0.6 * academyQuality(club) * (st.stage === 'U17' || st.stage === 'U19' ? 1 : 0.85);
  const gap = clamp((p.pa - ca) / 0.2, -0.6, 1.2);
  const play = st.seasonStats.minutes > 0 && st.seasonStats.apps > st.week * 0.5 ? 1.12 : st.seasonStats.notSelected > st.week * 0.6 ? 0.9 : 1;
  let d = 0.0028 * ageFactor(p.age) * coach * growthMul * (0.6 + 0.8 * p.morale) * (p.fresh < 0.4 ? 0.6 : 1) * play * gap;
  if (p.age >= 30) d -= 0.0008 * (p.age - 29);
  if (gap < 0) d = Math.min(d, 0.0015 * gap);
  d *= 1 + r.gauss(0, 0.15);
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

// ------------------------------------------------------------------ événements
const EVENTS = [
  {
    id: 'poste', when: (st) => st.player.role !== 'GK',
    text: (st) => `Le coach te demande de dépanner à un autre poste pour le prochain match. Il compte sur toi.`,
    options: [
      { label: 'Accepter sans discuter', apply: (st) => { st.player.trust += 0.06; st.player.morale -= 0.02; return 'Le coach apprécie ton état d\'esprit.'; } },
      { label: 'Expliquer que tu préfères ton poste', apply: (st) => { st.player.trust -= 0.03; st.player.morale += 0.01; return 'Le coach prend note, un peu déçu.'; } },
    ],
  },
  {
    id: 'agent', when: (st) => st.player.age >= 16 && !st.player.agent,
    text: () => 'Un agent te contacte après un match : il promet de t\'ouvrir des portes.',
    options: [
      { label: 'Signer avec lui', apply: (st) => { st.player.agent = true; st.player.morale += 0.03; st.player.discipline -= 0.01; return 'Tu as désormais un agent : il te présentera plus d\'offres en fin de saison.'; } },
      { label: 'Demander conseil à ton formateur', apply: (st) => { st.player.trust += 0.03; st.player.pa += 0.002; return 'Ton formateur t\'aide à prendre du recul. Tu restes concentré sur ta progression.'; } },
      { label: 'Refuser poliment', apply: () => 'Tu restes sans agent pour l\'instant.' },
    ],
  },
  {
    id: 'examens', when: (st) => st.stage === 'U17' || st.stage === 'U19',
    text: () => 'Tes examens tombent la semaine d\'un tournoi important avec ton équipe.',
    options: [
      { label: 'Réviser et manquer le tournoi', apply: (st) => { st.player.school += 0.12; st.player.discipline += 0.03; st.player.pa += 0.003; st.player.trust -= 0.02; return 'Examens réussis. Le coach comprend, mais n\'oublie pas.'; } },
      { label: 'Jouer le tournoi', apply: (st) => { st.player.trust += 0.04; st.player.school -= 0.08; st.player.morale += 0.03; return 'Bon tournoi ; tes résultats scolaires en pâtissent.'; } },
    ],
  },
  {
    id: 'douleur', when: () => true,
    text: () => 'Une douleur au genou apparaît après la séance.',
    options: [
      { label: 'Le signaler au staff médical', apply: (st) => { st.player.injuryWeeks = Math.max(st.player.injuryWeeks, 1); st.player.fresh = 1; return 'Repos préventif d\'une semaine. Le staff valorise ta franchise.'; } },
      { label: 'Serrer les dents', apply: (st, r) => {
        if (r.chance(0.35)) { st.player.injuryWeeks = r.int(4, 8); st.player.pa -= 0.01; st.player.morale -= 0.08; return `La douleur s'aggrave : ${st.player.injuryWeeks} semaines d'arrêt.`; }
        st.player.trust += 0.02; return 'La douleur passe. Le coach ne s\'est rendu compte de rien.';
      } },
    ],
  },
  {
    id: 'ancien', when: () => true,
    text: () => 'Un ancien joueur du club te propose des séances individuelles le mercredi.',
    options: [
      { label: 'Accepter', apply: (st) => { st.player.pa += 0.006; st.player.fresh -= 0.08; st.player.morale += 0.02; return 'Ses conseils t\'ouvrent de nouvelles marges de progression.'; } },
      { label: 'Garder ton mercredi pour récupérer', apply: (st) => { st.player.fresh += 0.05; return 'Tu préfères préserver ta fraîcheur.'; } },
    ],
  },
  {
    id: 'soiree', when: () => true,
    text: () => 'Des amis organisent une soirée la veille du match.',
    options: [
      { label: 'Rester chez toi', apply: (st) => { st.player.discipline += 0.02; return 'Nuit complète avant le match.'; } },
      { label: 'Y aller', apply: (st, r) => {
        st.player.morale += 0.05;
        if (r.chance(0.4)) { st.player.trust -= 0.08; st.player.discipline -= 0.05; st.player.fresh -= 0.1; return 'Le coach l\'apprend le lendemain. Sa confiance en prend un coup.'; }
        st.player.fresh -= 0.05; return 'Bonne soirée, personne ne l\'a su.';
      } },
    ],
  },
  {
    id: 'mentor', when: (st) => st.player.age <= 19,
    text: () => 'Un cadre de l\'équipe te prend sous son aile et te conseille sur ton hygiène de vie.',
    options: [
      { label: 'Écouter et appliquer', apply: (st) => { st.player.pa += 0.004; st.player.discipline += 0.03; st.player.trust += 0.02; return 'Sommeil, alimentation, récupération : tes habitudes changent.'; } },
      { label: 'Faire à ta façon', apply: (st) => { st.player.morale += 0.01; return 'Tu gardes tes habitudes.'; } },
    ],
  },
];

function pickEvent(st, r) {
  const pool = EVENTS.filter((e) => e.when(st));
  const e = r.pick(pool);
  return { id: e.id, text: e.text(st), options: e.options.map((o) => o.label) };
}

export function resolveEvent(st, optionIdx) {
  if (st.phase !== 'event' || !st.pendingEvent) throw new Error('Aucun événement en attente.');
  const e = EVENTS.find((x) => x.id === st.pendingEvent.id);
  const r = rngOf(st);
  const out = e.options[optionIdx].apply(st, r);
  const p = st.player;
  p.pa = clamp(p.pa, 0.35, 0.95);
  for (const k of ['trust', 'morale', 'discipline', 'school', 'fresh']) p[k] = clamp(p[k], 0, 1);
  saveRng(st, r);
  log(st, `${st.pendingEvent.text} → ${e.options[optionIdx].label}. ${out}`);
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
  st.matchday = { ...fx, selection: sel.status, rival: sel.rival };
  st.phase = 'matchday';
}

// Prépare les deux effectifs du moteur pour le match de la semaine
export function matchSetup(st) {
  const md = st.matchday;
  const club = clubById(st.clubId), opp = clubById(md.opponentId);
  const inSquad = md.selection === 'titulaire' || md.selection === 'remplaçant';
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
  return { home, away, userTeam, seed: `${st.seed}-${st.season}-${st.week}`, subPlan, inSquad, homeName: home.def.name, awayName: away.def.name };
}

// Résultat d'un match joué par le moteur (ou résumé simulé) -> carrière
export function applyMatchResult(st, res) {
  const p = st.player;
  const md = st.matchday;
  if (md?.bye) { finishWeek(st); return; }
  const rep = st.lastReport ?? { lines: [] };
  const [gMine, gOpp] = md.home ? [res.score[0], res.score[1]] : [res.score[1], res.score[0]];
  recordResult(st, md.home ? st.clubId : md.opponentId, md.home ? md.opponentId : st.clubId, res.score[0], res.score[1]);
  const outcome = gMine > gOpp ? 'victoire' : gMine === gOpp ? 'nul' : 'défaite';
  const s = st.seasonStats;
  if (md.selection === 'titulaire' || md.selection === 'remplaçant') s.streakOut = 0;
  if (res.minutes > 0) {
    s.apps++; if (res.started) s.starts++;
    s.minutes += res.minutes; s.goals += res.goals;
    const rating = res.rating;
    s.ratings.push(rating);
    p.trust = clamp(p.trust + (rating - 6.3) * 0.03, 0, 1);
    p.morale = clamp(p.morale + (rating - 6.3) * 0.03 + (outcome === 'victoire' ? 0.03 : outcome === 'défaite' ? -0.03 : 0), 0, 1);
    p.fresh = clamp(p.fresh - 0.16 * (res.minutes / 90), 0, 1);
    if (res.minutes >= 45) p.pa = clamp(p.pa + 0.0003, 0.35, 0.95);
    // le match fait progresser : l'expérience compte
    const r = rngOf(st);
    progress(st, 'tactique', 0.2 * (res.minutes / 90), r);
    saveRng(st, r);
    rep.lines.push(`${outcome[0].toUpperCase()}${outcome.slice(1)} ${gMine}-${gOpp} contre ${nameOf(st, md.opponentId)}. ${res.minutes} min, note ${rating.toFixed(1)}${res.goals ? `, ${res.goals} but(s)` : ''}.`);
    log(st, `J${st.week + 1} : ${outcome} ${gMine}-${gOpp} contre ${nameOf(st, md.opponentId)} — ${res.minutes} min, note ${rating.toFixed(1)}${res.goals ? `, ${res.goals} but(s)` : ''}.`);
  } else {
    if (md.selection === 'non retenu') { s.notSelected++; s.streakOut = (s.streakOut ?? 0) + 1; p.morale = clamp(p.morale - 0.03, 0, 1); }
    rep.lines.push(`${outcome[0].toUpperCase()}${outcome.slice(1)} ${gMine}-${gOpp} contre ${nameOf(st, md.opponentId)} (${md.selection === 'blessé' ? 'blessé' : md.selection === 'remplaçant' ? 'resté sur le banc' : 'non retenu'}).`);
    if (s.notSelected >= 4 && s.notSelected % 4 === 0) p.pa = clamp(p.pa - 0.002, 0.35, 0.95); // manque de temps de jeu prolongé
  }
  st.lastReport = rep;
  finishWeek(st);
}

// Score d'un match où le joueur n'entre pas : modèle agrégé (même que les autres rencontres)
export function quickScore(st, homeId, awayId) {
  const r = rngOf(st);
  const sc = aggregateScore(st, homeId, awayId, r);
  saveRng(st, r);
  return sc;
}

function nameOf(st, id) { return st.league.teams.find((t) => t.id === id)?.name ?? clubById(id)?.name ?? id; }

function poisson(r, lambda) {
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= r.next(); } while (p > L && k < 15);
  return k - 1;
}

// Modèle agrégé des rencontres de contexte. Le volume de buts est aligné sur la production
// actuelle du moteur de match (≈ 6 buts/match, calibration en cours, cf. README) pour que le
// classement reste cohérent entre matchs joués et matchs résumés. À ajuster avec le moteur.
export const CONTEXT_GOALS = { home: 3.1, away: 2.7 };
function aggregateScore(st, h, a, r) {
  const sH = teamStrength(clubById(h), st.stage, st.league), sA = teamStrength(clubById(a), st.stage, st.league);
  return [poisson(r, CONTEXT_GOALS.home * Math.exp(5 * (sH - sA))), poisson(r, CONTEXT_GOALS.away * Math.exp(5 * (sA - sH)))];
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
  st.matchday = null;
  st.week++;
  if (st.week >= seasonLength(st)) { endSeason(st); return; }
  st.phase = 'week';
}

// ------------------------------------------------------------------ fin de saison
function endSeason(st) {
  const p = st.player;
  const s = st.seasonStats;
  const table = standings(st);
  const pos = table.findIndex((t) => t.id === st.clubId) + 1;
  const avg = s.ratings.length ? s.ratings.reduce((a, b) => a + b, 0) / s.ratings.length : null;
  const caEnd = currentCA(st);
  st.history.push({ season: st.season, age: p.age, club: clubById(st.clubId).name, stage: st.stage, league: st.league.name, pos, teams: table.length, apps: s.apps, starts: s.starts, goals: s.goals, minutes: s.minutes, rating: avg, caStart: s.caStart, caEnd });
  p.age++;
  const r = rngOf(st);
  p.staffBias = r.gauss(0, 0.02); // nouvelle évaluation du staff
  saveRng(st, r);
  st.offers = buildOffers(st, pos, table.length);
  st.phase = 'season_end';
  log(st, `Fin de saison : ${pos}e sur ${table.length}. ${s.apps} matchs, ${s.goals} but(s). Niveau ${pct(s.caStart)} → ${pct(caEnd)}.`);
}

// Décision du club et offres pour la saison suivante
function buildOffers(st, pos, n) {
  const p = st.player;
  const club = clubById(st.clubId);
  const ca = currentCA(st);
  const offers = [];
  const r = rngOf(st);
  const youth = st.stage === 'U17' || st.stage === 'U19';
  const proThreshold = (c) => SENIOR_CA[clubLevel(c)] - 0.07;
  if (youth && p.age <= 17) {
    // reste en formation : U17 jusqu'à 16 ans, puis U19
    const next = p.age >= 17 ? 'U19' : 'U17';
    const expected = youthCA(academyQuality(club), next) - 0.06 - (next === 'U19' && st.stage === 'U17' ? 0.03 : 0);
    if (ca >= expected || p.trust > 0.7) offers.push({ clubId: club.id, stage: next, kind: 'Prolongation en formation', own: true });
    else {
      // libéré : d'autres centres de formation, moins exigeants
      const q = academyQuality(club);
      const cands = CLUBS.filter((c) => c.id !== club.id && academyQuality(c) < q - 0.02 && ca >= youthCA(academyQuality(c), next) - 0.07);
      for (const c of shuffle(cands, r).slice(0, 3)) offers.push({ clubId: c.id, stage: next, kind: 'Essai concluant dans un autre centre' });
    }
  } else {
    // contrats seniors
    if (ca >= proThreshold(club) && club.senior) offers.push({ clubId: club.id, stage: 'Pro', kind: st.stage === 'Pro' ? 'Prolongation' : 'Premier contrat professionnel', own: true });
    else if (club.reserve && ca >= SENIOR_CA[club.reserve.level] - 0.08) offers.push({ clubId: club.id, stage: 'Réserve', kind: st.stage === 'Réserve' ? 'Saison de plus en réserve' : 'Contrat stagiaire (réserve)', own: true });
    const extra = (p.agent ? 3 : 2) + (pos <= 3 ? 1 : 0);
    const cands = CLUBS.filter((c) => c.id !== club.id && c.senior && ca >= proThreshold(c) && ca <= SENIOR_CA[clubLevel(c)] + 0.08);
    for (const c of shuffle(cands, r).slice(0, extra)) offers.push({ clubId: c.id, stage: 'Pro', kind: 'Offre de contrat' });
    if (!offers.length) {
      const amateur = CLUBS.filter((c) => c.senior && clubLevel(c) === 5);
      offers.push({ clubId: r.pick(amateur).id, stage: 'Pro', kind: 'Contrat fédéral (National 2)' });
    }
  }
  saveRng(st, r);
  if (p.age >= 35) offers.push({ retire: true, kind: 'Mettre un terme à ta carrière' });
  return offers;
}

function shuffle(a, r) { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r.next() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }

export function acceptOffer(st, idx) {
  if (st.phase !== 'season_end') throw new Error('Aucune offre à accepter.');
  const o = st.offers[idx];
  if (o.retire) { st.retired = true; st.phase = 'retired'; log(st, 'Fin de carrière de joueur.'); return; }
  const changed = o.clubId !== st.clubId;
  st.clubId = o.clubId; st.stage = o.stage; st.season++;
  st.offers = null;
  if (changed) { st.player.trust = 0.45; log(st, `Signature à ${clubById(o.clubId).name} (${o.kind}).`); }
  startSeason(st);
}

// Résumé lisible pour la liste des sauvegardes
export function summary(st) {
  const club = clubById(st.clubId);
  return { name: `${st.player.firstName} ${st.player.lastName}`, club: club.name, stage: STAGE_LABEL[st.stage], age: st.player.age, season: `${st.season}-${st.season + 1}`, week: st.week + 1, ca: pct(currentCA(st)) };
}

// Note de match à partir des statistiques du moteur (bornée)
export function matchRating(stats, outcome, minutes, role) {
  if (!minutes) return null;
  const passPct = stats.passes ? stats.passesOk / stats.passes : 0.75;
  let r = 6.0 + stats.goals * 1.0 + (passPct - 0.72) * 3 + stats.tackles * 0.18 + stats.shots * 0.08 + (outcome > 0 ? 0.3 : outcome < 0 ? -0.3 : 0);
  if (role === 'GK') r += 0.1 * (stats.saves ?? 0);
  r *= minutes < 30 ? 0.97 : 1;
  return clamp(r, 3, 10);
}

// Match de l'équipe sans le joueur (non retenu, blessé) : résultat par le modèle agrégé
export function resultWithoutUser(st) {
  const md = st.matchday;
  const h = md.home ? st.clubId : md.opponentId, a = md.home ? md.opponentId : st.clubId;
  return { score: quickScore(st, h, a), minutes: 0, goals: 0, started: false, rating: null };
}
