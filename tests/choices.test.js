// Choix en match : variété et validité sur un match complet joué par le moteur.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../src/career/career.js';
import { createCareerMatch } from '../src/career/play.js';
import { ballChoices, defendChoices, supportChoices, restartChoices } from '../src/ui/choices.js';

test('les choix proposés sont variés et exécutables', () => {
  const st = C.createCareer({ firstName: 'Test', lastName: 'Choix', role: 'W', clubId: 'fc-nantes', seed: 'choix' });
  while (st.phase !== 'matchday') {
    if (st.phase === 'week') C.submitWeek(st, { focus: 'technique', intensity: 'normale', offpitch: 'video' });
    else if (st.phase === 'event') C.resolveEvent(st, 0);
    else if (st.phase === 'month_review') C.closeMonthReview(st);
    else C.applyMatchResult(st, C.resultWithoutUser(st));
  }
  st.matchday.selection = 'titulaire';
  const setup = C.matchSetup(st);
  const combos = new Set(), recent = [];
  let n = 0, i = 0;
  // un match suffit d'ordinaire ; si ton joueur sort tôt (blessure, expulsion), on en joue un autre
  for (let k = 0; k < 3 && n <= 50; k++) {
  const m = createCareerMatch({ ...setup, seed: k ? `${setup.seed}-${k}` : setup.seed });
  const u = m.players.find((p) => p.isUser);
  let lastOwner = null, lastBall = -99, lastOff = -99;
  const asked = new Set();
  while (m.phase !== 'fulltime') {
    m.step();
    let ch = null;
    const r = m.restart;
    if (m.phase === 'dead' && r && r.taker === u.id && !asked.has(r.started)) { asked.add(r.started); ch = restartChoices(m, u, r); }
    else if (m.phase === 'play' && u.onPitch) {
      const b = m.ball, owner = b.owner != null ? m.players[b.owner] : null;
      const just = owner && owner.id === u.id && lastOwner !== u.id; lastOwner = owner?.id ?? null;
      if (just && m.t - lastBall > 7) { ch = ballChoices(m, u, recent); lastBall = m.t; }
      else if (owner && owner.id !== u.id && m.t - lastOff > 22) {
        const d = Math.hypot(owner.x - u.x, owner.y - u.y);
        if (owner.team !== u.team && d < 9) { ch = defendChoices(m, u, owner, recent); lastOff = m.t; }
        else if (owner.team === u.team && d < 28 && d > 6) { ch = supportChoices(m, u, owner, recent); lastOff = m.t; }
      }
    }
    if (!ch) continue;
    n++;
    assert.ok(ch.list.length >= 1 && ch.list.length <= 4, 'entre 1 et 4 options');
    assert.equal(new Set(ch.list.map((c) => c.key)).size, ch.list.length, 'options distinctes');
    for (const c of ch.list) assert.ok(c.label && (c.opt || c.intent || c.plan), `option exécutable : ${c.key}`);
    combos.add(ch.type + ':' + ch.list.map((c) => c.key).join(','));
    const c = ch.list[i++ % ch.list.length];
    if (c.plan) m.queueCommand({ type: 'restartPlan', playerId: u.id, plan: c.plan });
    else if (c.opt) m.queueCommand({ type: 'choice', playerId: u.id, opt: c.opt });
    else m.queueCommand({ type: 'intent', playerId: u.id, kind: c.intent, ...(c.spot ?? {}) });
    recent.push(c.key); if (recent.length > 4) recent.shift();
  }
  }
  assert.ok(n > 50, `situations de choix rencontrées : ${n}`);
  assert.ok(combos.size >= 25, `combinaisons distinctes : ${combos.size}`);
});
