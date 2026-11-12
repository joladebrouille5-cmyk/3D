// Roue du potentiel : probabilités, parts de la roue, tirage et effet sur la carrière.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../src/career/career.js';
import { TIERS, wheelSlices, drawTier, tierById } from '../src/career/potential.js';

test('roue : probabilités cohérentes, paliers ordonnés et sans trou', () => {
  const sum = TIERS.reduce((a, t) => a + t.p, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9, `somme des probabilités ${sum}`);
  for (let i = 1; i < TIERS.length; i++) assert.equal(TIERS[i].lo, TIERS[i - 1].hi, `${TIERS[i].id} prolonge ${TIERS[i - 1].id}`);
  assert.ok(tierById('phenomene').p < tierById('pepite').p, 'le Phénomène est le plus rare');
});

test('roue : chaque part a la taille de sa probabilité, la roue fait un tour complet', () => {
  const sl = wheelSlices();
  assert.equal(sl[0].start, 0);
  assert.ok(Math.abs(sl[sl.length - 1].end - 360) < 1e-9);
  for (const t of TIERS) {
    const deg = sl.filter((s) => s.id === t.id).reduce((a, s) => a + (s.end - s.start), 0);
    assert.ok(Math.abs(deg - t.p * 360) < 1e-9, `${t.id} : ${deg}°`);
  }
});

test('roue : le tirage suit les probabilités', () => {
  const n = 20000, count = {};
  for (let i = 0; i < n; i++) { const t = drawTier((i + 0.5) / n); count[t.id] = (count[t.id] ?? 0) + 1; }
  for (const t of TIERS) assert.ok(Math.abs(count[t.id] / n - t.p) < 0.002, `${t.id} ${count[t.id] / n}`);
  assert.equal(drawTier(0.999999).id, 'phenomene');
});

test('roue : le palier tiré fixe le potentiel de départ, qui évolue ensuite', () => {
  for (const t of TIERS) {
    for (const seed of ['a', 'b', 'c']) {
      const st = C.createCareer({ firstName: 'A', lastName: 'B', role: 'CM', clubId: 'fc-nantes', seed, potential: t.id });
      const p = st.player;
      assert.equal(p.potentialTier.id, t.id);
      assert.ok(p.pa >= Math.min(t.lo, 0.9) - 1e-9 || p.pa >= C.currentCA(st) + 0.05 - 1e-9, `${t.id} : ${p.pa}`);
      assert.ok(p.pa <= Math.max(t.hi, C.currentCA(st) + 0.05) + 1e-9, `${t.id} : ${p.pa}`);
      assert.ok(p.pa > C.currentCA(st), 'le potentiel dépasse le niveau de départ');
    }
  }
  // sans roue (anciennes sauvegardes, tests) : tirage direct, pas de palier
  const st = C.createCareer({ firstName: 'A', lastName: 'B', role: 'CM', clubId: 'fc-nantes', seed: 'a' });
  assert.equal(st.player.potentialTier, null);
});
