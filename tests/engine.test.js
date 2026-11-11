// Tests du moteur V1 : reproductibilité, intégrité des règles, cycle des consignes et remplacements.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../src/engine/match.js';
import { simulateMatch } from '../src/engine/sim.js';
import { PITCH } from '../src/engine/config.js';

const stepN = (m, n) => { for (let i = 0; i < n && m.phase !== 'fulltime'; i++) m.step(); };
const stepUntil = (m, pred, max = 60000) => { for (let i = 0; i < max && !pred(m); i++) m.step(); return pred(m); };

test('même graine, mêmes commandes horodatées => mêmes événements canoniques', () => {
  const cmds = [{ tick: 3000, type: 'instruction', team: 0, changes: { pressing: 'haut' } }];
  const a = simulateMatch({ home: 'coteaux', away: 'plateau', seed: 'repro', userTeam: 0, commands: cmds });
  const b = simulateMatch({ home: 'coteaux', away: 'plateau', seed: 'repro', userTeam: 0, commands: cmds });
  assert.equal(a.fingerprint(), b.fingerprint());
  assert.equal(a.canonicalState(), b.canonicalState());
});

test('le rendu et le replay ne modifient pas la simulation (rapide sans rendu = direct avec lectures)', () => {
  const headless = simulateMatch({ home: 'littoral', away: 'marais', seed: 'render', userTeam: null });
  const live = new Match({ home: 'littoral', away: 'marais', seed: 'render', userTeam: null, aiTeams: [0, 1] });
  while (live.phase !== 'fulltime') {
    live.step();
    // ce que fait l'interface : lecture des positions et des images de replay
    if (live.tick % 50 === 0 && live.frames.length > 10) {
      const f = live.frames[live.frames.length - 10];
      void f[1]; void live.players.map((p) => p.x + p.y);
    }
  }
  assert.equal(live.fingerprint(), headless.fingerprint());
});

test('graines différentes => matchs différents (pas de résultat écrit d\'avance)', () => {
  const prints = new Set();
  for (const s of ['g1', 'g2', 'g3']) prints.add(simulateMatch({ home: 'coteaux', away: 'marais', seed: s }).fingerprint());
  assert.equal(prints.size, 3);
});

test('intégrité d\'un match complet : positions finies, score = buts, temps additionnel, onze maximum', () => {
  const m = new Match({ home: 'plateau', away: 'coteaux', seed: 'integrity', userTeam: null, aiTeams: [0, 1] });
  while (m.phase !== 'fulltime') {
    m.step();
    if (m.tick % 25 === 0) {
      for (const t of [0, 1]) assert.ok(m.onPitch(t).length <= 11);
      for (const p of m.allOnPitch()) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.energy), `position invalide ${p.name}`);
      assert.ok(Number.isFinite(m.ball.x) && Number.isFinite(m.ball.y) && m.ball.z >= 0);
      assert.ok(m.ball.x > -30 && m.ball.x < PITCH.length + 30);
    }
  }
  const goals = m.events.filter((e) => e.type === 'but');
  assert.equal(goals.length, m.score[0] + m.score[1]);
  assert.ok(m.added[0] >= 1 && m.added[1] >= 1);
  assert.ok(m.events.some((e) => e.type === 'mi_temps'));
  assert.equal(m.events[m.events.length - 1].type, 'fin');
});

test('brouillon tactique : une validation sans transmission ne change rien', () => {
  const m = new Match({ home: 'coteaux', away: 'plateau', seed: 'draft', userTeam: 0, aiTeams: [1] });
  stepN(m, 600);
  const before = m.canonicalState();
  const v = m.validateInstruction(0, { pressing: 'haut', bloc: 'haut' });
  assert.equal(v.ok, true);
  assert.equal(m.canonicalState(), before);
  assert.deepEqual(m.teams[0].instructions, []);
});

test('consigne : transmise puis active, adaptation progressive sans changement instantané', () => {
  const m = new Match({ home: 'coteaux', away: 'plateau', seed: 'activate', userTeam: 0, aiTeams: [1] });
  stepN(m, 600);
  const press0 = m.teams[0].tv.press;
  m.queueCommand({ type: 'instruction', team: 0, changes: { pressing: 'haut' } });
  m.step();
  const ins = m.teams[0].instructions[0];
  assert.equal(ins.status, 'transmise');
  assert.equal(m.teams[0].tactics.pressing, 'moyen');
  assert.ok(stepUntil(m, () => ins.status === 'active', 400), 'la consigne doit devenir active');
  assert.equal(m.teams[0].tactics.pressing, 'haut');
  assert.ok(m.teams[0].tv.press < m.teams[0].tvTarget.press, 'pas de bascule instantanée');
  stepN(m, 300);
  assert.ok(m.teams[0].tv.press > press0);
});

test('consigne invalide ou file pleine : rejet motivé, tactique active conservée', () => {
  const m = new Match({ home: 'coteaux', away: 'plateau', seed: 'reject', userTeam: 0, aiTeams: [1] });
  stepN(m, 100);
  m.queueCommand({ type: 'instruction', team: 0, changes: { pressing: 'n\'importe quoi' } });
  m.queueCommand({ type: 'instruction', team: 0, changes: { pressing: 'moyen' } }); // ne change rien
  m.step();
  const [bad, noop] = m.teams[0].instructions;
  assert.equal(bad.status, 'rejetée'); assert.ok(bad.reason);
  assert.equal(noop.status, 'rejetée'); assert.ok(noop.reason);
  assert.equal(m.teams[0].tactics.pressing, 'moyen');
  // file limitée à trois changements en attente
  const m2 = new Match({ home: 'coteaux', away: 'plateau', seed: 'queue', userTeam: 0, aiTeams: [1] });
  stepUntil(m2, () => m2.phase === 'play');
  for (const ch of [{ pressing: 'haut' }, { bloc: 'bas' }, { style: 'direct' }, { pressing: 'bas' }]) m2.queueCommand({ type: 'instruction', team: 0, changes: ch });
  m2.step();
  const st = m2.teams[0].instructions.map((i) => i.status);
  assert.deepEqual(st.slice(0, 3).filter((s) => s === 'transmise').length >= 2, true);
  assert.equal(st[3], 'rejetée');
});

test('annulation : possible avant activation, refusée après', () => {
  const m = new Match({ home: 'coteaux', away: 'plateau', seed: 'cancel', userTeam: 0, aiTeams: [1] });
  stepUntil(m, () => m.phase === 'play');
  m.queueCommand({ type: 'instruction', team: 0, changes: { bloc: 'bas' } });
  m.step();
  const ins = m.teams[0].instructions[0];
  if (ins.status === 'transmise') {
    m.queueCommand({ type: 'cancelInstruction', team: 0, id: ins.id });
    m.step();
    assert.equal(ins.status, 'annulée');
    assert.equal(m.teams[0].tactics.bloc, 'moyen');
  }
  m.queueCommand({ type: 'instruction', team: 0, changes: { style: 'direct' } });
  m.step();
  const ins2 = m.teams[0].instructions[1];
  stepUntil(m, () => ins2.status === 'active', 400);
  m.queueCommand({ type: 'cancelInstruction', team: 0, id: ins2.id });
  m.step();
  assert.equal(ins2.status, 'active');
  assert.match(m.events[m.events.length - 1].text, /Annulation impossible/);
});

test('remplacement inéligible : refus motivé et onze inchangé', () => {
  const m = new Match({ home: 'coteaux', away: 'plateau', seed: 'subs', userTeam: 0, aiTeams: [1] });
  stepN(m, 200);
  const xi = [...m.teams[0].slotPlayer];
  const starter = m.players[xi[3]];
  const opponentBench = m.teams[1].bench[0];
  m.queueCommand({ type: 'sub', team: 0, outId: starter.id, inId: opponentBench });
  m.queueCommand({ type: 'sub', team: 0, outId: starter.id, inId: xi[4] }); // l'entrant n'est pas sur le banc
  m.step();
  assert.deepEqual(m.teams[0].subRequests.map((r) => r.status), ['rejeté', 'rejeté']);
  assert.ok(m.teams[0].subRequests.every((r) => r.reason));
  assert.deepEqual(m.teams[0].slotPlayer, xi);
});

test('remplacement : demandé, effectué au prochain arrêt, puis impossible à annuler ; l\'entrant n\'est pas téléporté', () => {
  const m = new Match({ home: 'coteaux', away: 'plateau', seed: 'subs2', userTeam: 0, aiTeams: [1] });
  stepUntil(m, () => m.phase === 'play');
  stepN(m, 50);
  const out = m.players[m.teams[0].slotPlayer[6]];
  const inn = m.players[m.teams[0].bench.find((id) => m.players[id].role !== 'GK')];
  m.queueCommand({ type: 'sub', team: 0, outId: out.id, inId: inn.id });
  m.step();
  const req = m.teams[0].subRequests[0];
  assert.equal(req.status, 'demandé');
  assert.ok(!inn.onPitch, 'l\'entrant n\'apparaît pas avant l\'événement d\'entrée');
  assert.ok(stepUntil(m, () => req.status === 'effectué', 30000));
  assert.ok(inn.onPitch && !out.onPitch);
  assert.ok(inn.y <= 1 || inn.y >= PITCH.width - 1, 'entrée par la ligne de touche');
  assert.equal(m.teams[0].subsUsed, 1);
  m.queueCommand({ type: 'cancelSub', team: 0, id: req.id });
  m.step();
  assert.equal(req.status, 'effectué');
  // un joueur sorti ne peut pas revenir
  const v = m.validateSub(0, inn.id, out.id);
  assert.equal(v.ok, false);
});

test('limite de changements issue de la configuration de compétition', () => {
  const comp = { id: 't', name: 'test', maxSubs: 1, maxSubWindows: 3, halftimeWindowFree: true, benchSize: 7, validated: false };
  const m = new Match({ home: 'coteaux', away: 'plateau', seed: 'limit', userTeam: 0, aiTeams: [], competition: comp });
  stepUntil(m, () => m.phase === 'play');
  const bench = m.teams[0].bench.filter((id) => m.players[id].role !== 'GK');
  m.queueCommand({ type: 'sub', team: 0, outId: m.teams[0].slotPlayer[5], inId: bench[0] });
  m.queueCommand({ type: 'sub', team: 0, outId: m.teams[0].slotPlayer[6], inId: bench[1] });
  m.step();
  assert.deepEqual(m.teams[0].subRequests.map((r) => r.status), ['demandé', 'rejeté']);
  assert.match(m.teams[0].subRequests[1].reason, /Limite de 1/);
});

test('une vraie décision change la suite du match (même graine)', () => {
  const base = simulateMatch({ home: 'coteaux', away: 'plateau', seed: 'decision', userTeam: 0 });
  const changed = simulateMatch({ home: 'coteaux', away: 'plateau', seed: 'decision', userTeam: 0, commands: [{ tick: 1200, type: 'instruction', team: 0, changes: { pressing: 'haut', bloc: 'haut' } }] });
  assert.notEqual(base.fingerprint(), changed.fingerprint());
  // le passé avant la décision est identique
  const before = (m) => m.events.filter((e) => e.tick < 1200).map((e) => `${e.tick}|${e.type}`).join(';');
  assert.equal(before(base), before(changed));
});

test('calibration (fumée) : ordres de grandeur plausibles sur quelques matchs', () => {
  let goals = 0, shots = 0, xg = 0;
  const N = 6;
  const pairs = [['coteaux', 'marais'], ['plateau', 'coteaux'], ['marais', 'plateau']];
  for (let i = 0; i < N; i++) {
    const [h, a] = pairs[i % pairs.length];
    const m = simulateMatch({ home: h, away: a, seed: `smoke-${i}` });
    goals += m.score[0] + m.score[1];
    for (const t of m.teams) { shots += t.stats.shots; xg += t.stats.xg; }
  }
  const g = goals / N, s = shots / N;
  assert.ok(g >= 0.5 && g <= 10, `buts/match hors bornes : ${g}`);
  assert.ok(s >= 8 && s <= 70, `tirs/match hors bornes : ${s}`);
  assert.ok(Math.abs(goals - xg) / N < 3, `buts (${goals}) et xG (${xg.toFixed(1)}) trop éloignés`);
});
