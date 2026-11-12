// Argent : abonnements prélevés chaque semaine, effets sur les jauges, achats.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../src/career/career.js';

const week = (st) => {
  C.submitWeek(st, { focus: 'technique', intensity: 'normale', offpitch: 'repos' });
  while (st.phase !== 'week' && st.phase !== 'season_end') {
    if (st.phase === 'event') C.resolveEvent(st, 0);
    else if (st.phase === 'month_review') C.closeMonthReview(st);
    else C.applyMatchResult(st, st.matchday.bye ? {} : C.resultWithoutUser(st));
  }
};

test('un abonnement est prélevé chaque semaine et s\'arrête sans argent', () => {
  const st = C.createCareer({ firstName: 'A', lastName: 'B', role: 'CM', clubId: 'fc-nantes', seed: 'money' });
  st.player.money = 1;
  assert.equal(C.toggleService(st, 'prepa'), null);
  const m0 = st.player.money;
  week(st);
  const salary = (st.player.contract.salary * 12) / st.league.rounds.length;
  const cost = (C.SERVICES.prepa.monthly * 12) / st.league.rounds.length;
  assert.ok(Math.abs(st.player.money - (m0 + salary - cost)) < 1e-9, 'salaire versé, abonnement prélevé');
  st.player.money = 0;
  week(st);
  // sans économies, le salaire de la semaine ne couvre pas un abonnement plus cher : il s'arrête
  C.toggleService(st, 'video');
  st.player.money = 0;
  st.player.services = { video: true, prepa: true };
  week(st);
  assert.deepEqual(st.player.services, {});
});

test('le préparateur physique réduit le risque de blessure et donne de la fraîcheur', () => {
  const st = C.createCareer({ firstName: 'A', lastName: 'B', role: 'CM', clubId: 'fc-nantes', seed: 'prepa' });
  st.player.fresh = 0.5;
  const a = C.previewWeek(st, { focus: 'physique', intensity: 'intense', offpitch: 'extra' });
  st.player.services = { prepa: true };
  const b = C.previewWeek(st, { focus: 'physique', intensity: 'intense', offpitch: 'extra' });
  assert.ok(b.injuryRisk < a.injuryRisk * 0.8, `${b.injuryRisk} < ${a.injuryRisk}`);
  assert.ok(b.gauges.fresh > a.gauges.fresh);
});

test('achats : une fois, par saison, ou refusés faute d\'argent', () => {
  const st = C.createCareer({ firstName: 'A', lastName: 'B', role: 'CM', clubId: 'fc-nantes', seed: 'buy' });
  assert.equal(C.canBuy(st, 'appart').ok, false, 'pas assez d\'argent');
  st.player.money = 100;
  const m0 = st.player.morale;
  C.buy(st, 'famille');
  assert.ok(st.player.morale > m0);
  assert.equal(C.canBuy(st, 'famille').ok, false, 'une fois par saison');
  C.buy(st, 'appart');
  assert.equal(st.player.perks.appart, true);
  assert.equal(C.canBuy(st, 'appart').ok, false, 'une seule fois');
  assert.ok(Math.abs(st.player.money - (100 - 2 - 20)) < 1e-9);
  assert.throws(() => C.buy(st, 'terrain'));
});
