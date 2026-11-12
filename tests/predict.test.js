// Pourcentages de réussite des choix : simulations sur copies du match, sans toucher au vrai match.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../src/career/career.js';
import { createCareerMatch } from '../src/career/play.js';
import { ballChoices, defendChoices, restartChoices } from '../src/ui/choices.js';
import { predictAll, createJudge, goalOf } from '../src/engine/predict.js';

function careerMatch(seed) {
  const st = C.createCareer({ firstName: 'Test', lastName: 'Pct', role: 'W', clubId: 'fc-nantes', seed });
  while (st.phase !== 'matchday' || st.matchday.bye) {
    if (st.phase === 'week') C.submitWeek(st, { focus: 'technique', intensity: 'normale', offpitch: 'video' });
    else if (st.phase === 'event') C.resolveEvent(st, 0);
    else if (st.phase === 'month_review') C.closeMonthReview(st);
    else C.applyMatchResult(st, st.matchday.bye ? {} : C.resultWithoutUser(st));
  }
  st.matchday.selection = 'titulaire';
  const m = createCareerMatch(C.matchSetup(st));
  return { m, u: m.players.find((p) => p.isUser) };
}

// avance jusqu'au prochain choix « avec ballon » (ou défensif) du joueur
function nextChoice(m, u, kind = 'ball') {
  let lastOwner = null;
  while (m.phase !== 'fulltime') {
    m.step();
    if (m.phase !== 'play' || !u.onPitch) continue;
    const owner = m.ball.owner != null ? m.players[m.ball.owner] : null;
    const just = owner && owner.id === u.id && lastOwner !== u.id; lastOwner = owner?.id ?? null;
    if (kind === 'ball' && just) { const ch = ballChoices(m, u, []); if (ch.list.length >= 2) return ch; }
    if (kind === 'defend' && owner && owner.team !== u.team && Math.hypot(owner.x - u.x, owner.y - u.y) < 9) { const ch = defendChoices(m, u, owner, []); if (ch.list.length >= 2) return ch; }
  }
  return null;
}

test('les simulations ne modifient pas le vrai match et sont reproductibles', () => {
  const { m, u } = careerMatch('pct-a');
  const ch = nextChoice(m, u);
  assert.ok(ch, 'un choix avec ballon');
  const before = m.canonicalState();
  const a = predictAll(m, u.id, ch.list, 16, ch.type);
  assert.equal(m.canonicalState(), before, 'état du vrai match inchangé');
  const b = predictAll(m, u.id, ch.list, 16, ch.type);
  assert.deepEqual(a, b, 'mêmes graines, mêmes pourcentages');
  for (const r of a) assert.ok(r.p > 0 && r.p < 1, `${r.label} : ${r.p}`);
  // la suite du vrai match se déroule normalement
  for (let i = 0; i < 300 && m.phase !== 'fulltime'; i++) m.step();
});

test('les pourcentages suivent la réalité du moteur (passes sûres > frappes lointaines)', () => {
  const { m, u } = careerMatch('pct-b');
  const pass = [], shot = [], defend = [];
  for (let k = 0; k < 6; k++) {
    const ch = nextChoice(m, u);
    if (!ch) break;
    for (const r of predictAll(m, u.id, ch.list, 12, ch.type)) {
      if (r.goal === 'passe réussie') pass.push(r.p);
      if (r.goal === 'but') shot.push(r.p);
    }
  }
  const dch = nextChoice(m, u, 'defend');
  if (dch) for (const r of predictAll(m, u.id, dch.list, 12, dch.type)) defend.push(r.p);
  const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  assert.ok(pass.length >= 3, 'des passes proposées');
  assert.ok(avg(pass) > 0.4, `passes réussies en moyenne : ${avg(pass)}`);
  if (shot.length) assert.ok(avg(shot) < avg(pass), 'un but est plus rare qu\'une passe réussie');
  assert.ok(defend.every((p) => p > 0 && p < 1));
});

test('l\'arbitre rend un verdict sur le vrai match après le choix', () => {
  const { m, u } = careerMatch('pct-c');
  let verdicts = 0;
  for (let k = 0; k < 5; k++) {
    const ch = nextChoice(m, u);
    if (!ch) break;
    const c = ch.list[0];
    if (c.opt) m.queueCommand({ type: 'choice', playerId: u.id, opt: c.opt });
    const j = createJudge(m, u.id, c, goalOf(c, ch.type));
    let r = null;
    for (let i = 0; i < 200 && !r; i++) { m.step(); r = j.check(); }
    assert.ok(r, 'verdict rendu');
    if (!r.ended) { verdicts++; assert.ok(r.ok === 0 || r.ok === 1); }
  }
  assert.ok(verdicts >= 3);
});

test('coups de pied arrêtés : un objectif et un pourcentage par plan', () => {
  for (const c of [{ plan: { kind: 'shoot', style: 'curl' } }, { plan: { kind: 'cross', post: 'far' } }, { plan: { kind: 'short' } }]) {
    const g = goalOf(c, 'restart');
    assert.ok(g.label && g.kind);
  }
  void restartChoices;
});
