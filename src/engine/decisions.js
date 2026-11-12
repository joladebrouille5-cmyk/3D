// Choix d'action du porteur : utilité contextuelle et sélection probabiliste pondérée.
// Voir l'action ≠ la réussir : l'exécution est résolue ensuite dans match.js.

import { PITCH } from './config.js';
import { clamp, dist, segDist, goalAngle, sigmoid, inPitch } from './geom.js';

// Menace d'une position pour une équipe (0 loin du but adverse, ~0,2 devant le but).
export function threat(m, team, x, y) {
  const gx = m.oppGoalX(team);
  const d = dist(x, y, gx, 34);
  const a = goalAngle(x, y, gx);
  return 0.32 * Math.exp(-d / 15) * (0.35 + 0.65 * Math.min(1, a / 0.6));
}

// Pression ressentie : proximité des deux adversaires les plus proches.
export function pressureOn(m, p) {
  let d1 = Infinity, d2 = Infinity;
  for (const o of m.onPitch(1 - p.team)) {
    const d = dist(o.x, o.y, p.x, p.y);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
  }
  return clamp((5 - d1) / 4, 0, 1) * 0.75 + clamp((5 - d2) / 4, 0, 1) * 0.35;
}

// Estimateur de danger pré-tir (indicateur de bilan, distinct de la résolution).
// `bias` : décalage logit. Le porteur décide sur sa perception de l'occasion (bias > 0),
// le bilan affiche l'indicateur calibré sur la résolution des tirs (bias = 0).
export function xgEstimate(m, p, { header = false, pressure = 0, freekick = false, bias = 0 } = {}) {
  const team = m.teams[p.team];
  const gx = m.oppGoalX(team);
  const d = dist(p.x, p.y, gx, 34);
  const a = goalAngle(p.x, p.y, gx);
  let blockers = 0;
  for (const o of m.onPitch(1 - p.team)) {
    if (o.role === 'GK') continue;
    const { d: dd, s } = segDist(o.x, o.y, p.x, p.y, gx, 34);
    if (dd < 1.2 && s > 0.02 && s < 0.9) blockers++;
  }
  const z = bias + 0.12 - 0.14 * d + 1.25 * a - 0.8 * pressure - (header ? 0.9 : 0) - 0.35 * blockers - (freekick ? 0.4 : 0);
  return clamp(sigmoid(z), 0.005, 0.85);
}

const RETAIN = 0.012;

function interceptRisk(m, p, tx, ty, opts) {
  const L = dist(p.x, p.y, tx, ty);
  const vAvg = opts.lofted ? 18 : Math.max(8, Math.sqrt(30 + 6.4 * L) * 0.8);
  let keep = 1;
  for (const o of m.onPitch(1 - p.team)) {
    const { d, s } = segDist(o.x, o.y, p.x, p.y, tx, ty);
    if (opts.lofted && s > 0.12 && s < 0.82) continue; // ballon en l'air au milieu de la trajectoire
    const tBall = (s * L) / vAvg + 0.1;
    const tOpp = Math.max(0, d - 0.8) / 6.5 + 0.2;
    let c = sigmoid((tBall - tOpp) * 4);
    if (d < 0.9 && s * L < 4) c = Math.max(c, 0.9); // adversaire déjà dans la ligne de passe
    if (o.role === 'GK' && opts.lofted) c *= 1.2;
    keep *= 1 - c * 0.85;
  }
  return 1 - keep;
}

function nearestOppDist(m, p, x, y) {
  let best = Infinity;
  for (const o of m.onPitch(1 - p.team)) best = Math.min(best, dist(o.x, o.y, x, y));
  return best;
}

// Options du porteur (sans aucun tirage aléatoire : utilisable pour proposer des choix au joueur).
// Chaque option porte son utilité perçue `u` et, selon le cas, son risque ou son xG.
export function holderOptions(m, p, restartType = null) {
  const team = m.teams[p.team];
  const opp = m.teams[1 - p.team];
  const tv = team.tv;
  const rng = m.rng;
  const pr = pressureOn(m, p);
  const rel = m.relX(team, p.x);
  const here = threat(m, team, p.x, p.y);
  const mates = m.onPitch(p.team).filter((q) => q.id !== p.id);
  const opts = [];
  const lossCostAt = (x, y) => 0.025 + 1.3 * threat(m, opp, x, y);
  const riskW = 1.15 - 0.3 * tv.direct; // patient = aversion au risque


  // --- tir
  const gx = m.oppGoalX(team);
  const dGoal = dist(p.x, p.y, gx, 34);
  const shotAllowed = !restartType || (restartType === 'freekick' && m.restartDirect);
  if ((shotAllowed || (restartType === 'freekick' && dGoal < 30)) && dGoal < 34 && rel > 0.62) {
    const xg = xgEstimate(m, p, { pressure: pr, freekick: !!restartType, bias: 0.09 });
    // un tir termine presque toujours la possession : on le compare à la valeur de la garder
    // (les frappes lointaines sans angle deviennent plus rares)
    const hesitation = -0.004 + 0.0011 * Math.max(0, dGoal - 12) + 0.016 * pr - 0.014 * (p.attrs.shooting - 0.5);
    const v = xg + 0.1 * here - here - hesitation;
    opts.push({ kind: 'shoot', u: v, xg: xgEstimate(m, p, { pressure: pr, freekick: !!restartType }) });
  }

  // --- passes
  const throwIn = restartType === 'throw';
  for (const q of mates) {
    if (q.injured) continue;
    const d = dist(p.x, p.y, q.x, q.y);
    if (d < 4 || (throwIn && d > 22)) continue;
    const isGK = q.role === 'GK';
    // pas de passe en retrait au gardien quand on est déjà près de son propre but
    if (isGK && dist(p.x, p.y, m.ownGoalX(team), 34) < 26) continue;
    const qRel = m.relX(team, q.x);
    if (restartType === 'kickoff' && qRel > 0.5) continue;
    const lofted = d > 32 || (restartType === 'goalkick' && d > 28);
    if (d > 60) continue;
    const qPress = clamp((4.5 - nearestOppDist(m, q, q.x, q.y)) / 4, 0, 1);
    let risk = interceptRisk(m, p, q.x, q.y, { lofted }) + qPress * 0.18 + (lofted ? 0.2 + d / 300 : 0);
    risk += (1 - p.attrs.passing) * (d / 60) * 0.25;
    risk = clamp(risk, 0.02, 0.97);
    let gain = threat(m, team, q.x, q.y) + RETAIN;
    if (isGK) gain -= 0.012;
    // un partenaire demande le ballon : signal, pas ordre (ton joueur, qui annonce clairement son appel, est mieux entendu)
    if (m.t < (q.callUntil ?? 0)) gain += q.isUser ? 0.045 : 0.03;
    if (p.returnTo === q.id && m.t < (p.returnUntil ?? 0)) gain += 0.06; // une-deux : rendre le ballon
    if (qRel > rel) gain += 0.006 * tv.direct * ((qRel - rel) * 4);
    else gain += 0.005 * (1 - tv.direct);
    if (lofted) gain -= 0.014 * (1 - tv.direct) + 0.004;
    const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
    const u = (1 - risk * riskW) * gain - risk * riskW * lossCostAt(mx, my) - here;
    opts.push({ kind: 'pass', to: q.id, tx: q.x + q.vx * 0.3, ty: q.y + q.vy * 0.3, lofted, u, risk, forward: qRel - rel });

    // passe dans la course (attaquants, ailiers, latéraux qui montent)
    if (!restartType || restartType === 'freekick') {
      const running = m.t < (q.runUntil ?? 0) || (m.t < (q.callUntil ?? 0));
      const userRun = q.isUser && m.t < (q.userRun ?? 0); // ton appel en profondeur, quel que soit ton poste
      const fwd = ['ST', 'W', 'AM'].includes(q.role) || (q.role === 'FB' && running) || userRun;
      if (fwd && running && qRel >= rel - 0.02 && qRel > 0.5) {
        const lead = 7 + 5 * tv.direct;
        const tx = clamp(q.x + team.dir * lead, 2, PITCH.length - 2);
        const ty = clamp(q.y + (34 - q.y) * 0.15, 3, PITCH.width - 3);
        const trel = m.relX(team, tx);
        if (trel < 0.96) {
          const d2 = dist(p.x, p.y, tx, ty);
          const loftedT = d2 > 34;
          // le receveur doit arriver avant les adversaires
          const tRecv = dist(q.x, q.y, tx, ty) / (m.maxSpeed(q) * 0.9) + 0.2;
          let tOppBest = Infinity;
          for (const o of m.onPitch(1 - p.team)) tOppBest = Math.min(tOppBest, dist(o.x, o.y, tx, ty) / (m.maxSpeed(o) * 0.9) + 0.35);
          let riskT = clamp(interceptRisk(m, p, tx, ty, { lofted: loftedT }) * 0.8 + sigmoid((tRecv - tOppBest) * 2.2) * 0.75 + (loftedT ? 0.1 : 0), 0.05, 0.97);
          riskT += (1 - p.attrs.vision) * 0.12;
          // perception du hors-jeu : un bon décideur l'évite plus souvent
          const oppRels = m.onPitch(1 - p.team).map((o) => m.relX(team, o.x)).sort((a, c) => c - a);
          const offLine = Math.max(oppRels[1] ?? 0, rel, 0.5);
          if (qRel > offLine) riskT += 0.25 * p.attrs.decisions;
          const gainT = threat(m, team, tx, ty) + RETAIN + 0.012 * tv.direct + (userRun ? 0.02 : 0);
          const uT = (1 - riskT * riskW) * gainT - riskT * riskW * lossCostAt(tx, ty) * 0.8 - here;
          opts.push({ kind: 'pass', to: q.id, tx, ty, lofted: loftedT, through: true, u: uT, risk: clamp(riskT, 0, 1), forward: trel - rel });
        }
      }
    }
  }

  // --- centre
  if ((!restartType || restartType === 'corner' || restartType === 'freekick') && rel > 0.74 && (Math.abs(p.y - 34) > 12 || restartType === 'corner')) {
    let att = 0, defn = 0;
    for (const q of mates) if (dist(q.x, q.y, gx, 34) < 16) att++;
    for (const o of m.onPitch(1 - p.team)) if (dist(o.x, o.y, gx, 34) < 16) defn++;
    // cible : zone des partenaires présents dans la surface (déterministe)
    const inBoxMates = mates.filter((q) => dist(q.x, q.y, gx, 34) < 18);
    const my = inBoxMates.length ? inBoxMates.reduce((a, q) => a + q.y, 0) / inBoxMates.length : 34;
    const ty = clamp(my, 27, 41);
    const tx = gx - team.dir * 9;
    const u = 0.025 + 0.008 * att - 0.005 * defn - here * 0.6 + (restartType === 'corner' ? 0.08 : 0);
    opts.push({ kind: 'cross', tx, ty, u, risk: clamp(0.45 + 0.06 * defn - 0.05 * att, 0.2, 0.9), attackers: att });
  }

  // --- conduite / dribble
  if (!restartType) {
    const baseAng = team.dir > 0 ? 0 : Math.PI;
    const toGoal = Math.atan2(34 - p.y, gx - p.x);
    for (const ang of [toGoal, baseAng, baseAng + 0.6, baseAng - 0.6, baseAng + 1.3, baseAng - 1.3]) {
      const dx = Math.cos(ang), dy = Math.sin(ang);
      const nx = p.x + dx * 6, ny = p.y + dy * 6;
      if (!inPitch(nx, ny, 1)) continue;
      let keep = 1;
      for (const o of m.onPitch(1 - p.team)) {
        const { d } = segDist(o.x, o.y, p.x, p.y, nx, ny);
        keep *= 1 - sigmoid((2.4 - d) * 2.2) * (0.35 + 0.5 * o.attrs.tackling);
      }
      const risk = clamp((1 - keep) * (1.35 - p.attrs.dribbling), 0.02, 0.95);
      const gain = threat(m, team, nx, ny) + RETAIN;
      const onBall = Math.min(4, m.t - (p.gotBallAt ?? m.t));
      const u = (1 - risk * riskW) * gain - risk * riskW * lossCostAt(p.x, p.y) - here + 0.002 * p.attrs.dribbling - 0.004 * onBall - 0.012 * pr;
      opts.push({ kind: 'carry', dx, dy, u, risk, forward: (nx - p.x) * team.dir });
    }
    // garder, protéger
    opts.push({ kind: 'hold', u: RETAIN * 0.6 - pr * 0.03 + (p.role === 'GK' ? -0.02 : 0) });
    // dégagement sous pression dans son camp
    if (rel < 0.3 && pr > 0.4) opts.push({ kind: 'clear', u: -0.004 + pr * 0.012 - 0.008 * (1 - tv.direct) });
  }

  return { opts, throwIn, rel, team, tv };
}

// Exécute une option choisie (par l'IA ou par le joueur)
export function executeOption(m, p, choice, restartType = null) {
  const team = m.teams[p.team];
  const rel = m.relX(team, p.x);
  switch (choice.kind) {
    case 'shoot': m.shoot(p, { freekick: restartType === 'freekick', style: choice.style }); break;
    case 'pass': m.pass(p, choice.tx, choice.ty, { to: choice.to, lofted: choice.lofted, through: choice.through, low: restartType === 'throw' }); break;
    case 'cross': m.pass(p, choice.tx, choice.ty, { lofted: true, cross: true }); break;
    case 'clear': m.pass(p, m.absX(team, Math.min(0.85, rel + 0.4)), clamp(p.y + m.rng.range(-20, 20), 4, 64), { lofted: true, clear: true }); break;
    case 'carry': m.carry(p, choice.dx, choice.dy, choice.speed ?? 0.75 + 0.25 * team.tv.direct); break;
    default: p.carry = null; p.nextDecision = m.t + 0.4;
  }
}

// Option correspondant au plan choisi pour un coup de pied arrêté
function plannedOption(m, p, opts, plan) {
  const team = m.teams[p.team];
  const gx = m.oppGoalX(team);
  const best = (list) => list.sort((a, b) => b.u - a.u)[0] ?? null;
  if (plan.kind === 'shoot') { const o = opts.find((x) => x.kind === 'shoot'); return o ? { ...o, style: plan.style } : null; }
  if (plan.kind === 'cross') {
    const o = opts.find((x) => x.kind === 'cross') ?? { kind: 'cross' };
    const near = plan.post === 'near';
    const side = p.y < 34 ? -1 : 1; // côté du tireur
    return { ...o, kind: 'cross', tx: gx - team.dir * (near ? 5.5 : 8), ty: near ? 34 + side * 3 : 34 - side * 5.5 };
  }
  if (plan.kind === 'short') return best(opts.filter((x) => x.kind === 'pass' && !x.lofted && dist(p.x, p.y, m.players[x.to].x, m.players[x.to].y) < 16));
  if (plan.kind === 'long') return best(opts.filter((x) => x.kind === 'pass' && x.lofted));
  return null;
}

// Décision du porteur. `restartType` restreint les options lors d'une remise en jeu.
export function decideHolder(m, p, restartType) {
  const plan = p.restartPlan;
  p.restartPlan = null;
  if (restartType === 'penalty') {
    m.shoot(p, { penalty: true, ...(plan?.kind === 'penalty' ? { aimSide: plan.side, style: plan.style, userPenalty: true } : {}) });
    return;
  }
  const { opts, throwIn, rel, team } = holderOptions(m, p, restartType);
  const rng = m.rng;
  // coup de pied arrêté décidé par le joueur (carrière)
  if (plan && restartType) {
    const pick = plannedOption(m, p, opts, plan);
    if (pick) { executeOption(m, p, pick, restartType); return; }
  }

  if (!opts.length) {
    // aucune option : jeu long devant
    m.pass(p, m.absX(team, Math.min(0.9, rel + 0.35)), 34 + rng.range(-15, 15), { lofted: true, clear: true });
    return;
  }

  // perception imparfaite + sélection pondérée (softmax)
  const noise = 0.006 * (1.25 - p.attrs.vision);
  const temp = 0.0055 + 0.012 * (1 - p.attrs.decisions);
  let maxU = -Infinity;
  for (const o of opts) { o.pu = o.u + rng.gauss(0, noise); if (o.pu > maxU) maxU = o.pu; }
  const w = opts.map((o) => Math.exp((o.pu - maxU) / temp));
  const choice = opts[rng.weighted(w)];

  void throwIn;
  executeOption(m, p, choice, restartType);
}
