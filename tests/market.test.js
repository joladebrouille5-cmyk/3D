// Contrats, salaires, mercato d'hiver et prêts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../src/career/career.js';
import { salaryFor } from '../src/career/market.js';
import { clubById } from '../src/career/clubs.js';

function step(st) {
  if (st.phase === 'week') C.submitWeek(st, { focus: 'technique', intensity: 'normale', offpitch: 'video' });
  else if (st.phase === 'event') C.resolveEvent(st, 0);
  else if (st.phase === 'month_review') C.closeMonthReview(st);
  else C.applyMatchResult(st, st.matchday.bye ? {} : C.resultWithoutUser(st));
}

test('salaire versé chaque semaine, contrat signé à l\'acceptation d\'une offre', () => {
  const st = C.createCareer({ firstName: 'A', lastName: 'B', role: 'CM', clubId: 'fc-nantes', seed: 'm1' });
  assert.equal(st.player.contract.type, 'aspirant');
  while (st.phase !== 'season_end') step(st);
  assert.ok(st.player.money > 3, `économies après une saison : ${st.player.money}`);
  for (const o of st.offers) if (!o.retire && !o.keep) assert.ok(o.contract && o.contract.salary > 0 && o.contract.years >= 1, `offre avec contrat : ${o.kind}`);
  const i = st.offers.findIndex((o) => o.contract);
  const o = st.offers[i];
  C.acceptOffer(st, i);
  assert.equal(st.player.contract.clubId, o.clubId);
  assert.equal(st.player.contract.until, st.season - 1 + o.contract.years);
});

test('salaires cohérents selon le niveau', () => {
  const psg = clubById('paris-saint-germain'), n2 = clubById('us-concarneau');
  assert.ok(salaryFor(psg, 'Pro', 0.72, 24) > 50 * salaryFor(n2, 'U17', 0.45, 15));
  assert.ok(salaryFor(psg, 'Pro', 0.78, 24) > salaryFor(psg, 'Pro', 0.66, 24));
});

test('mercato d\'hiver : prêt d\'un joueur qui ne joue pas, classement repris, retour de prêt', () => {
  const st = C.createCareer({ firstName: 'A', lastName: 'B', role: 'ST', clubId: 'paris-saint-germain', seed: 'm2' });
  st.stage = 'Pro'; st.player.age = 19;
  for (const k in st.player.attrs) st.player.attrs[k] = Math.min(0.95, st.player.attrs[k] + 0.12); // trop juste pour le PSG
  C.startSeason(st);
  let guard = 0;
  while (!st.window && st.phase !== 'season_end' && guard++ < 3000) step(st);
  assert.ok(st.window, 'des clubs se manifestent à mi-saison');
  const li = st.window.offers.findIndex((o) => o.loan);
  assert.ok(li >= 0, 'offre de prêt pour un joueur qui ne joue pas');
  const target = st.window.offers[li].clubId;
  C.acceptWinterOffer(st, li);
  assert.equal(st.clubId, target);
  assert.equal(st.player.loan.parentId, 'paris-saint-germain');
  const played = st.league.teams.reduce((a, t) => a + t.p, 0) / st.league.teams.length;
  assert.ok(Math.abs(played - st.week) <= 1, 'le nouveau championnat est déjà entamé');
  assert.ok(st.history.at(-1).partial, 'première partie de saison archivée');
  while (st.phase !== 'season_end') step(st);
  const back = st.offers.findIndex((o) => o.keep && o.clubId === 'paris-saint-germain');
  assert.ok(back >= 0, 'retour de prêt proposé');
  C.acceptOffer(st, back);
  assert.equal(st.clubId, 'paris-saint-germain');
  assert.equal(st.player.loan, null);
  assert.equal(st.player.contract.clubId, 'paris-saint-germain');
});
