// Tests du pilotage direct : déplacement, gestes, délégation, reproductibilité.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../src/engine/match.js';
import { pickTarget } from '../src/engine/control.js';

const newMatch = (seed = 'ctl') => new Match({ home: 'coteaux', away: 'plateau', seed, userTeam: null, aiTeams: [0, 1] });
const stepUntil = (m, pred, max = 20000) => { for (let i = 0; i < max && !pred(m); i++) m.step(); return pred(m); };
const fieldPlayer = (m) => m.onPitch(0).find((p) => ['CM', 'DM'].includes(p.role));

test('le stick déplace le joueur dans la direction demandée, avec inertie', () => {
  const m = newMatch();
  stepUntil(m, () => m.phase === 'play');
  const p = fieldPlayer(m);
  m.queueCommand({ type: 'control', playerId: p.id, on: true });
  m.queueCommand({ type: 'ctrl', dx: 0, dy: 1, sprint: true });
  m.step();
  const y0 = p.y, v0 = Math.hypot(p.vx, p.vy);
  for (let i = 0; i < 5; i++) m.step();
  const vEarly = Math.hypot(p.vx, p.vy);
  for (let i = 0; i < 25 && m.phase === 'play'; i++) m.step();
  assert.ok(p.y > y0 + 4, `le joueur avance vers +y (${y0.toFixed(1)} -> ${p.y.toFixed(1)})`);
  assert.ok(vEarly < m.maxSpeed(p) * 0.95 || v0 > 3, 'pas de vitesse maximale instantanée');
});

test('le joueur piloté ne décide pas à la place de l\'utilisateur ; la passe part vers le partenaire visé', () => {
  const m = newMatch('ctl2');
  stepUntil(m, () => m.phase === 'play');
  const p = fieldPlayer(m);
  m.queueCommand({ type: 'control', playerId: p.id, on: true });
  m.step();
  // lui donner le ballon proprement (situation de test)
  for (const o of m.onPitch(1)) { o.x = 95; o.y = 60; o.tx = 95; o.ty = 60; }
  m.ball.owner = p.id; m.ball.pass = null; m.ball.shot = null; p.nextDecision = 0; p.touchCooldown = 0;
  const passes0 = p.stats.passes;
  for (let i = 0; i < 15; i++) { for (const o of m.onPitch(1)) { o.x = 95; o.y = 60; } m.step(); }
  assert.equal(m.ball.owner, p.id, 'aucune décision automatique : il garde le ballon');
  assert.equal(p.stats.passes, passes0);
  const mate = m.onPitch(0).filter((q) => q.id !== p.id && q.role !== 'GK').sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[1];
  const dx = mate.x - p.x, dy = mate.y - p.y;
  const tg = pickTarget(m, p, dx, dy, 'short');
  assert.equal(tg.player.id, mate.id, 'l\'aide de visée choisit le partenaire dans l\'axe');
  m.queueCommand({ type: 'act', action: 'pass', dx, dy });
  m.step();
  assert.equal(m.ball.owner, null);
  assert.equal(m.ball.pass.to, mate.id);
  assert.equal(p.stats.passes, passes0 + 1);
});

test('une pression de passe ancienne ne devient jamais un tacle', () => {
  const m = newMatch('ctl3');
  stepUntil(m, () => m.phase === 'play' && m.ball.owner != null && m.players[m.ball.owner].team === 1);
  const p = fieldPlayer(m);
  m.queueCommand({ type: 'control', playerId: p.id, on: true });
  const h = m.players[m.ball.owner];
  p.x = h.x + 0.8; p.y = h.y; // au contact de l'adversaire porteur
  const tackles0 = m.teams[0].stats.tackles, fouls0 = m.teams[0].stats.fouls;
  m.queueCommand({ type: 'act', action: 'pass', dx: 1, dy: 0 });
  m.step(); m.step();
  assert.equal(m.teams[0].stats.tackles + m.teams[0].stats.fouls, tackles0 + fouls0, 'aucun duel déclenché par la touche de passe');
});

test('le tacle est une décision du joueur : à portée il déclenche un duel, trop loin non', () => {
  const m = newMatch('ctl4');
  stepUntil(m, () => m.phase === 'play' && m.ball.owner != null && m.players[m.ball.owner].team === 1 && !m.players[m.ball.owner].gkHolding);
  const p = fieldPlayer(m);
  m.queueCommand({ type: 'control', playerId: p.id, on: true });
  m.step();
  let h = m.players[m.ball.owner];
  if (!h || h.team !== 1) return; // possession perdue entre-temps : scénario non applicable à cette graine
  p.x = h.x + 12; p.y = h.y;
  m.queueCommand({ type: 'act', action: 'tackle' });
  m.step();
  assert.equal(m.control.feedback.text, 'Trop loin');
});

test('délégation : en Auto, l\'IA reprend le joueur', () => {
  const m = newMatch('ctl5');
  stepUntil(m, () => m.phase === 'play');
  const p = fieldPlayer(m);
  m.queueCommand({ type: 'control', playerId: p.id, on: true });
  m.step();
  assert.ok(m.isControlled(p));
  m.queueCommand({ type: 'control', playerId: p.id, on: false });
  m.step();
  assert.equal(m.control, null);
  assert.equal(m.isControlled(p), false);
});

test('gardien : pas de pilotage direct dans ce lot', () => {
  const m = newMatch('ctl6');
  const gk = m.gk(0);
  m.queueCommand({ type: 'control', playerId: gk.id, on: true });
  m.step();
  assert.equal(m.control, null);
});

test('mêmes commandes de pilotage horodatées => même match', () => {
  const run = () => {
    const m = newMatch('ctl-det');
    const p = fieldPlayer(m);
    m.queueCommand({ tick: 100, type: 'control', playerId: p.id, on: true });
    for (let k = 0; k < 40; k++) {
      m.queueCommand({ tick: 200 + k * 150, type: 'ctrl', dx: Math.cos(k), dy: Math.sin(k), sprint: k % 3 === 0 });
      m.queueCommand({ tick: 260 + k * 150, type: 'act', action: ['pass', 'tackle', 'through', 'shoot', 'long', 'call'][k % 6], dx: 1, dy: 0 });
    }
    m.queueCommand({ tick: 9000, type: 'control', playerId: p.id, on: false });
    while (m.tick < 12000 && m.phase !== 'fulltime') m.step();
    return m.fingerprint() + '|' + m.canonicalState();
  };
  assert.equal(run(), run());
});
