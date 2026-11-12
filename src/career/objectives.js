// Objectifs de saison fixés par le club (ou les éducateurs) : deux ou trois, selon l'étape, le poste et la place
// prévue dans l'effectif. Suivis toute la saison, réglés au bilan : prime et confiance, ou déception.
import { clubById, teamStrength } from './clubs.js';

// buts attendus d'un titulaire sur une saison complète, par poste (championnat de 34 journées)
const GOALS = { ST: 12, W: 8, AM: 7, CM: 4, DM: 2, FB: 1, CB: 1, GK: 0 };
const ASSISTS = { ST: 4, W: 7, AM: 8, CM: 5, DM: 3, FB: 4, CB: 1, GK: 0 };

const expectedRank = (st) => {
  const ids = st.league.teams.map((t) => t.id);
  const me = teamStrength(clubById(st.clubId), st.stage, st.league);
  return 1 + ids.filter((id) => id !== st.clubId && teamStrength(clubById(id), st.stage, st.league) > me).length;
};

// `status` : place prévue en début de saison (titulaire, remplaçant, non retenu)
export function setObjectives(st, status) {
  const p = st.player, len = st.league.rounds.length, k = len / 34;
  const youth = st.stage === 'U17' || st.stage === 'U19';
  const out = [];
  const add = (id, label, kind, target, reward) => out.push({ id, label, kind, target: Math.max(1, Math.round(target)), reward });
  if (status === 'titulaire') {
    add('starts', `Être titulaire au moins ${Math.round(len * 0.6)} fois`, 'starts', len * 0.6, 'prime');
    const g = GOALS[p.role] * k, a = ASSISTS[p.role] * k;
    if (g >= 3) add('goals', `Marquer ${Math.round(g)} buts`, 'goals', g, 'prime');
    else if (p.role === 'GK' || p.role === 'CB') add('rating', 'Note moyenne d\'au moins 6,8', 'rating', 6.8, 'confiance');
    else add('assists', `Délivrer ${Math.round(a)} passes décisives`, 'assists', a, 'prime');
  } else if (status === 'remplaçant') {
    add('apps', `Jouer au moins ${Math.round(len * 0.5)} matchs`, 'apps', len * 0.5, 'confiance');
    add('starts', `Gagner ta place : ${Math.round(len * 0.25)} titularisations`, 'starts', len * 0.25, 'prime');
  } else {
    add('apps', `Disputer au moins ${Math.round(len * 0.3)} matchs`, 'apps', len * 0.3, 'confiance');
  }
  if (youth) add('school', 'Garder une scolarité correcte (au moins 50)', 'school', 0.5, 'confiance');
  // objectif collectif : le rang attendu du club, avec un peu de marge
  if (!st.league.simulated && st.stage !== 'U17') {
    const n = st.league.teams.length, exp = expectedRank(st);
    const target = Math.min(n - 2, exp + 2);
    add('rank', target <= 1 ? 'Être champion' : target >= n - 3 ? 'Se maintenir' : `Finir dans les ${target} premiers`, 'rank', target, 'club');
  }
  return out.slice(0, 3);
}

// Valeur actuelle d'un objectif et réussite (en cours de saison : réussite « à ce jour »)
export function objectiveProgress(st, o) {
  const s = st.seasonStats ?? {};
  const avg = s.ratings?.length ? s.ratings.reduce((a, b) => a + b, 0) / s.ratings.length : 0;
  const table = [...(st.league?.teams ?? [])].sort((x, y) => y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf);
  const pos = table.findIndex((t) => t.id === st.clubId) + 1;
  const value = { starts: s.starts ?? 0, apps: s.apps ?? 0, goals: s.goals ?? 0, assists: s.assists ?? 0, rating: avg, school: st.player.school, rank: pos || null }[o.kind];
  const lower = o.kind === 'rank'; // un rang : plus petit, c'est mieux
  const done = lower ? value != null && value <= o.target : value >= o.target;
  const ratio = lower ? (value ? Math.min(1, o.target / value) : 0) : o.kind === 'rating' || o.kind === 'school' ? Math.min(1, value / o.target) : Math.min(1, value / o.target);
  return { value, done, ratio };
}

// Fin de saison : bilan des objectifs et conséquences (prime versée avec le salaire d'un mois)
export function settleObjectives(st) {
  const p = st.player;
  const res = [];
  for (const o of st.objectives ?? []) {
    const { value, done } = objectiveProgress(st, o);
    const monthly = p.contract?.salary ?? 0;
    if (done) {
      if (o.reward === 'prime') { const bonus = Math.round(Math.max(0.5, monthly * 1.5) * 10) / 10; p.money += bonus; res.push({ ...o, value, done, effect: `prime de ${bonus} k€` }); }
      else { res.push({ ...o, value, done, effect: o.reward === 'club' ? 'le club est satisfait' : 'confiance du staff' }); }
      p.trust += o.reward === 'club' ? 0.02 : 0.04; p.morale += 0.03;
    } else {
      p.trust -= o.reward === 'club' ? 0.01 : 0.03; p.morale -= 0.02;
      res.push({ ...o, value, done, effect: 'objectif manqué' });
    }
  }
  return res;
}
