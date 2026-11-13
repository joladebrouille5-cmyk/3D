// Récompenses de fin de saison et palmarès.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../src/career/career.js';

function run(st, onLastWeek) {
  let g = 0;
  while (st.phase !== 'season_end' && g++ < 6000) {
    if (st.phase === 'week') { if (st.week === st.league.rounds.length - 1) onLastWeek?.(st); C.submitWeek(st, { focus: 'technique', intensity: 'normale', offpitch: 'video' }); }
    else if (st.phase === 'event') C.resolveEvent(st, 0);
    else if (st.phase === 'month_review') C.closeMonthReview(st);
    else C.applyMatchResult(st, st.matchday.bye ? {} : C.resultWithoutUser(st));
  }
}

test('une saison dominante est récompensée et archivée au palmarès', () => {
  const st = C.createCareer({ firstName: 'A', lastName: 'B', role: 'ST', clubId: 'fc-nantes', seed: 'aw1' });
  run(st, (s) => {
    const n = s.league.rounds.length;
    Object.assign(s.seasonStats, { apps: n - 1, starts: n - 1, minutes: 90 * (n - 1), goals: n, cupGoals: 0, assists: 9, ratings: Array(n - 1).fill(7.8) });
  });
  const names = st.seasonHonours.awards.map((a) => a.name).join(' | ');
  assert.match(names, /Meilleur buteur/);
  assert.match(names, /Équipe type/);
  assert.match(names, /Joueur de la saison/);
  const rec = C.careerRecord(st);
  assert.equal(rec.totals.goals, st.history.at(-1).goals);
  assert.ok(rec.awards.length >= 3);
});

test('une saison ordinaire ne rapporte pas de distinction', () => {
  const st = C.createCareer({ firstName: 'A', lastName: 'B', role: 'CM', clubId: 'fc-nantes', seed: 'aw2' });
  run(st, (s) => Object.assign(s.seasonStats, { apps: 10, goals: 1, assists: 1, ratings: Array(10).fill(6.6) }));
  assert.equal(st.seasonHonours.awards.length, 0);
});
