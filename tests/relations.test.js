// Relations : vestiaire et supporters réagissent aux matchs, aux choix et aux changements de club.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../src/career/career.js';

function toMatch(st) {
  while (st.phase !== 'matchday' || st.matchday.bye || st.matchday.extra) {
    if (st.phase === 'week') C.submitWeek(st, { focus: 'technique', intensity: 'normale', offpitch: 'repos' });
    else if (st.phase === 'event') C.resolveEvent(st, 0);
    else if (st.phase === 'month_review') C.closeMonthReview(st);
    else C.applyMatchResult(st, st.matchday.bye ? {} : C.resultWithoutUser(st));
  }
  st.matchday.selection = 'titulaire';
}
const res = (st, style, goals, assists) => {
  const win = st.matchday.home ? [2, 0] : [0, 2];
  return { score: win, minutes: 90, started: true, goals, assists, rating: 7.2, style };
};

test('jeu collectif et passes décisives : le vestiaire apprécie ; jeu personnel : il grince', () => {
  const a = C.createCareer({ firstName: 'A', lastName: 'B', role: 'CM', clubId: 'fc-nantes', seed: 'r1' });
  const b = structuredClone(a);
  toMatch(a); toMatch(b);
  const t0 = a.player.team, f0 = a.player.fans;
  C.applyMatchResult(a, res(a, { team: 4, selfish: 0 }, 1, 1));
  C.applyMatchResult(b, res(b, { team: 0, selfish: 4 }, 0, 0));
  assert.ok(a.player.team > t0, 'vestiaire en hausse');
  assert.ok(b.player.team < a.player.team - 0.05, 'jeu personnel moins bien vu');
  assert.ok(a.player.fans > f0, 'un but et une victoire : les supporters suivent');
});

test('changer de club repart de zéro avec le vestiaire et le public', () => {
  const st = C.createCareer({ firstName: 'A', lastName: 'B', role: 'CM', clubId: 'fc-nantes', seed: 'r2' });
  st.player.team = 0.9; st.player.fans = 0.8;
  while (st.phase !== 'season_end') {
    if (st.phase === 'week') C.submitWeek(st, { focus: 'technique', intensity: 'normale', offpitch: 'repos' });
    else if (st.phase === 'event') C.resolveEvent(st, 0);
    else if (st.phase === 'month_review') C.closeMonthReview(st);
    else C.applyMatchResult(st, st.matchday.bye ? {} : C.resultWithoutUser(st));
  }
  const other = st.offers.findIndex((o) => o.clubId && o.clubId !== st.clubId);
  if (other < 0) return; // pas d'autre offre cette fois : rien à vérifier
  const fans = st.player.fans;
  C.acceptOffer(st, other);
  assert.equal(st.player.team, 0.45);
  assert.ok(st.player.fans < fans, 'popularité à reconstruire');
});
