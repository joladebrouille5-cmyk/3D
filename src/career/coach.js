// Après-carrière : entraîneur. Une saison se joue d'un bloc : tu fixes le style de jeu et les priorités,
// le championnat est simulé (force du club, ton talent d'entraîneur, ton style), puis viennent le bilan,
// les montées et descentes, et les offres d'autres clubs selon ta réputation.
import { Rng } from '../engine/rng.js';
import { clubById, teamCA, leagueFor, PRO_CLUBS, divisionName, clubLevel } from './clubs.js';
import { advanceWorld } from './world.js';

export const COACH_STYLES = {
  offensif: { label: 'Offensif', desc: 'Plus de buts, des deux côtés.', goals: 1.18, edge: 0.004 },
  equilibre: { label: 'Équilibré', desc: 'Le plus sûr.', goals: 1, edge: 0.006 },
  defensif: { label: 'Défensif', desc: 'Moins de buts encaissés… et marqués.', goals: 0.82, edge: 0.004 },
};
export const COACH_PRIORITIES = {
  jeunes: { label: 'Lancer les jeunes du centre', desc: 'Moins fort cette saison, mais ton talent d\'entraîneur grandit plus vite.', now: -0.008, grow: 0.018 },
  recrues: { label: 'Recruter des joueurs confirmés', desc: 'Plus fort tout de suite.', now: 0.012, grow: 0.006 },
  mixte: { label: 'Un peu des deux', desc: 'Équilibre entre résultat et progression.', now: 0.003, grow: 0.01 },
};

// Premier poste : selon la carrière de joueur (niveau atteint, titres), un club de niveau proche
export function startCoaching(st) {
  const best = Math.max(...st.history.map((h) => h.caEnd ?? 0), 0.5);
  const titles = (st.trophies ?? []).length;
  const rep = Math.min(0.9, 0.35 + (best - 0.55) * 1.6 + titles * 0.01);
  st.coach = { skill: 0.45 + rep * 0.2, rep, clubId: null, seasons: [], trophies: [], offers: [] };
  st.coach.offers = coachOffers(st, new Rng(`coach:${st.seed}:${st.season}`));
  st.phase = 'coach';
  return st.coach;
}

// Clubs qui veulent de toi : force proche de ta réputation (un ancien grand joueur commence plus haut)
export function coachOffers(st, r) {
  const c = st.coach;
  const target = 0.5 + c.rep * 0.2;
  const pool = PRO_CLUBS().filter((x) => x.id !== c.clubId && Math.abs(teamCA(x, 'Pro') - target) < 0.04);
  const out = [];
  const copy = [...pool];
  while (out.length < 3 && copy.length) out.push(copy.splice(Math.floor(r.next() * copy.length), 1)[0].id);
  return out;
}

export function takeCoachJob(st, clubId) {
  st.coach.clubId = clubId;
  st.coach.offers = [];
}

const poisson = (r, l) => { const L = Math.exp(-l); let k = 0, p = 1; do { k++; p *= r.next(); } while (p > L && k < 15); return k - 1; };

// Une saison d'entraîneur
export function playCoachSeason(st, styleId, prioId) {
  const c = st.coach;
  const club = clubById(c.clubId);
  const style = COACH_STYLES[styleId] ?? COACH_STYLES.equilibre, prio = COACH_PRIORITIES[prioId] ?? COACH_PRIORITIES.mixte;
  const r = new Rng(`coach:${st.seed}:${st.season}:${c.clubId}`);
  const lg = leagueFor(club, 'Pro');
  const bonus = (c.skill - 0.5) * 0.05 + style.edge + prio.now;
  const str = (id) => teamCA(clubById(id), 'Pro') + (id === c.clubId ? bonus : 0);
  const table = new Map(lg.clubs.map((id) => [id, { id, pts: 0, gf: 0, ga: 0 }]));
  for (const h of lg.clubs) for (const a of lg.clubs) {
    if (h === a) continue;
    const k = h === c.clubId || a === c.clubId ? style.goals : 1;
    const gh = poisson(r, 1.45 * k * Math.exp(7 * (str(h) - str(a)))), ga = poisson(r, 1.15 * k * Math.exp(7 * (str(a) - str(h))));
    const th = table.get(h), ta = table.get(a);
    th.gf += gh; th.ga += ga; ta.gf += ga; ta.ga += gh;
    if (gh > ga) th.pts += 3; else if (gh < ga) ta.pts += 3; else { th.pts++; ta.pts++; }
  }
  const ranked = [...table.values()].sort((x, y) => y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga));
  const pos = ranked.findIndex((t) => t.id === c.clubId) + 1;
  const expected = 1 + lg.clubs.filter((id) => id !== c.clubId && teamCA(clubById(id), 'Pro') > teamCA(club, 'Pro')).length;
  // bilan : le talent et la réputation suivent les résultats par rapport aux attentes
  const over = expected - pos;
  c.skill = Math.min(0.95, Math.max(0.3, c.skill + prio.grow + over * 0.006));
  c.rep = Math.min(0.95, Math.max(0.1, c.rep + over * 0.012 + (pos === 1 ? 0.04 : 0)));
  const entry = { season: st.season, club: club.name, league: lg.name, pos, teams: lg.clubs.length, expected, pts: ranked[pos - 1].pts, style: style.label, prio: prio.label };
  if (pos === 1) c.trophies.push({ season: st.season, name: `Champion · ${lg.name}`, club: club.name });
  // montées et descentes du monde (ton championnat selon ce classement)
  const fake = { ...st, stage: 'Pro', league: { simulated: false } };
  const moved = advanceWorld(fake, ranked.map((t) => t.id));
  st.world = fake.world;
  entry.move = moved.up.includes(c.clubId) ? 'promu' : moved.down.includes(c.clubId) ? 'relégué' : null;
  if (entry.move) entry.division = divisionName(clubById(c.clubId));
  c.seasons.push(entry);
  // limogé si très en dessous des attentes ; sinon d'autres clubs se manifestent
  entry.fired = pos - expected >= 6 && clubLevel(club) <= 3;
  if (entry.fired) c.clubId = null;
  c.offers = coachOffers(st, r);
  c.table = ranked.map((t) => ({ id: t.id, name: clubById(t.id).name, pts: t.pts, diff: t.gf - t.ga }));
  st.season++;
  st.player.age++;
  return entry;
}
