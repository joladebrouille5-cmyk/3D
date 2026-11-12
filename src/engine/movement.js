// Organisation collective et déplacements sans ballon.
// Une couche collective attribue pression, couverture, marquage et course au ballon ;
// chaque agent se déplace ensuite sous ces contraintes (pas de téléportation).

import { PITCH, SIM } from './config.js';
import { clamp, dist } from './geom.js';

export function predictBall(ball, n = 40, dt = 0.1) {
  let { x, y, z, vx, vy, vz } = ball;
  const out = [];
  for (let i = 0; i < n; i++) {
    if (z > 0 || vz > 0) {
      vz -= SIM.gravity * dt;
      const drag = 1 - SIM.airDrag * dt;
      vx *= drag; vy *= drag;
      x += vx * dt; y += vy * dt; z += vz * dt;
      if (z <= 0) { z = 0; if (vz < -2.2) { vz = -vz * 0.45; vx *= 0.78; vy *= 0.78; } else vz = 0; }
    } else {
      const s = Math.hypot(vx, vy);
      if (s > 0) { const ns = Math.max(0, s - SIM.rollDecel * dt); vx *= ns / s; vy *= ns / s; }
      x += vx * dt; y += vy * dt;
    }
    out.push({ x, y, z, t: (i + 1) * dt });
  }
  return out;
}

function pressureOnHolder(m, h) {
  let d1 = Infinity;
  for (const o of m.onPitch(1 - h.team)) d1 = Math.min(d1, dist(o.x, o.y, h.x, h.y));
  return (6 - d1) / 4;
}

function offsideLineRel(m, team) {
  const rels = m.onPitch(1 - team.idx).map((o) => m.relX(team, o.x)).sort((a, b) => b - a);
  return Math.max(rels[1] ?? 0.5, m.relX(team, m.ball.x));
}

export function hasPossession(m, teamIdx) {
  const b = m.ball;
  if (m.phase === 'dead' && m.restart) return m.restart.team === teamIdx;
  if (b.owner != null) return m.players[b.owner].team === teamIdx;
  if (b.shot) return b.shot.team === teamIdx;
  if (b.pass) return b.pass.team === teamIdx;
  return b.lastTeam === teamIdx;
}

export function updateTeamShape(m, team) {
  const b = m.ball;
  const tv = team.tv;
  const poss = hasPossession(m, team.idx);
  const ballRel = m.relX(team, b.x);
  const players = m.onPitch(team.idx);
  const opps = m.onPitch(1 - team.idx);
  const restart = m.phase === 'dead' ? m.restart : null;
  const ownGX = m.ownGoalX(team), oppGX = m.oppGoalX(team);

  let lineRel, depth, width;
  if (poss) {
    lineRel = clamp(0.22 + 0.12 * tv.line + 0.45 * (ballRel - 0.35), 0.14, 0.58);
    depth = 0.4 + 0.07 * tv.direct;
    width = 60;
  } else {
    lineRel = clamp(0.1 + 0.24 * tv.line + 0.35 * (ballRel - 0.45), 0.095, 0.5);
    // porteur adverse libre de jouer : la ligne recule pour protéger la profondeur
    const h = b.owner != null ? m.players[b.owner] : null;
    if (h && h.team !== team.idx && !restart) {
      const free = 1 - clamp(pressureOnHolder(m, h), 0, 1);
      lineRel = Math.max(0.095, lineRel - 0.07 * free);
    }
    depth = 0.3 - 0.04 * (1 - tv.line);
    width = 42;
  }
  if (restart?.type === 'kickoff') { lineRel = 0.2; depth = 0.26; }
  const offLine = offsideLineRel(m, team);
  const shift = poss ? 0.22 : 0.42;

  const targets = new Map();
  for (const p of players) p.pressRole = null;
  for (const p of players) {
    const slot = team.slots[p.slot];
    if (!slot) continue;
    let rel, y;
    if (slot.role === 'GK') {
      const dBall = dist(b.x, b.y, ownGX, 34);
      const out = poss ? clamp(4 + 10 * tv.line * (ballRel > 0.5 ? 1 : 0.4), 3, 16) : clamp(1 + (dBall - 8) * 0.07, 0.8, 5 + 6 * tv.line);
      rel = out / PITCH.length;
      y = 34 + (b.y - 34) * 0.22;
      // attaquant lancé : le gardien sort pour fermer l'angle
      const h = b.owner != null ? m.players[b.owner] : null;
      if (h && h.team !== team.idx && dBall < 22) {
        const k = clamp(dBall * 0.28, 1.2, 6) / Math.max(dBall, 0.1);
        const gx2 = ownGX + (b.x - ownGX) * k, gy2 = 34 + (b.y - 34) * k;
        rel = m.relX(team, gx2); y = gy2;
      }
    } else {
      let bx = slot.bx;
      if (poss && slot.role === 'FB' && ballRel > 0.5) {
        const ballSide = (b.y - 34) * (team.dir > 0 ? 1 : -1) * (slot.side || 0) > 0;
        bx += (ballSide ? 0.45 : 0.2) * (0.4 + tv.direct * 0.6);
      }
      rel = lineRel + bx * depth;
      const by = slot.by;
      y = (PITCH.width - width) / 2 + (team.dir > 0 ? by : 1 - by) * width + (b.y - 34) * shift;
      if (poss) rel = Math.min(rel, offLine - 0.008, 0.95);
      // courses dans le dos de la défense
      const userRun = m.t < (p.userRun ?? 0);
      if (poss && (slot.role === 'ST' || slot.role === 'W' || slot.role === 'AM' || userRun) && !restart && b.owner != null && b.owner !== p.id) {
        // appel : sur l'épaule du dernier défenseur (hors-jeu évité), en diagonale vers l'intervalle ;
        // la passe est jouée dans l'espace derrière et le coureur la prend de vitesse
        if (m.t < p.runUntil) { rel = Math.min(0.94, offLine + (p.runEager ? 0.04 : -0.004)); y = y + (34 - y) * 0.3; }
        else {
          // espace dans le dos d'une ligne haute : les appels deviennent bien plus fréquents
          const space = 1 - offLine;
          const lure = 1 + 7 * Math.max(0, space - 0.32);
          if (ballRel > 0.25 && m.rng.chance(0.035 * (0.5 + tv.direct) * lure)) {
            p.runUntil = m.t + 3.5;
            // appel parti trop tôt : le coureur se retrouve hors-jeu (plus souvent s'il lit mal le jeu)
            p.runEager = m.rng.chance(0.46 + 0.42 * (1 - p.attrs.decisions));
          }
        }
      }
    }
    if (restart?.type === 'kickoff') rel = Math.min(rel, 0.47);
    // repli : un joueur dépassé par le ballon revient à pleine vitesse
    const behind = !poss && m.relX(team, p.x) > ballRel + 0.03 && slot.role !== 'GK';
    targets.set(p.id, { x: m.absX(team, clamp(rel, 0.01, 0.98)), y: clamp(y, 1.5, PITCH.width - 1.5), urg: poss ? 0.55 : behind ? 0.95 : 0.7 });
  }

  // recherche d'espace pour offrir une solution
  if (poss && !restart) {
    for (const p of players) {
      if (p.role === 'GK' || p.id === b.owner || m.t < p.runUntil) continue;
      const t0 = targets.get(p.id);
      let best = t0, bestScore = -Infinity;
      for (const [ox, oy] of [[0, 0], [4, 0], [-4, 0], [0, 4], [0, -4]]) {
        const cx = t0.x + ox, cy = clamp(t0.y + oy, 1.5, PITCH.width - 1.5);
        if (m.relX(team, cx) > offLine - 0.005) continue;
        let md = Infinity;
        for (const o of opps) md = Math.min(md, dist(o.x, o.y, cx, cy));
        const sc = Math.min(md, 9) - 0.12 * Math.hypot(ox, oy);
        if (sc > bestScore) { bestScore = sc; best = { x: cx, y: cy, urg: t0.urg }; }
      }
      targets.set(p.id, best);
    }
  }

  // défense : pression, marquage
  if (!poss && !restart) {
    const outfield = players.filter((p) => p.role !== 'GK' && !p.injured);
    const holder = b.owner != null ? m.players[b.owner] : null;
    const tx = holder ? holder.x : b.x, ty = holder ? holder.y : b.y;
    const relDef = m.relX(team, tx); // petit = proche de notre but
    let nP;
    if (tv.press > 0.66) nP = relDef > 0.45 ? 2 : 1;
    else if (tv.press < 0.33) nP = relDef > 0.55 ? 0 : 1;
    else nP = relDef > 0.7 ? 1 : relDef > 0.3 ? 1 : 2;
    // près du but, le défenseur le mieux placé sort toujours sur le porteur
    if (dist(tx, ty, ownGX, 34) < 26) nP = Math.max(nP, 2);
    const sorted = [...outfield].sort((a, c) => dist(a.x, a.y, tx, ty) - dist(c.x, c.y, tx, ty));
    const gdx = ownGX - tx, gdy = 34 - ty, gl = Math.hypot(gdx, gdy) || 1;
    sorted.slice(0, Math.max(1, nP)).forEach((p, i) => {
      const off = nP === 0 ? 7 : i === 0 ? 1.7 : i === 1 ? 4 : 2.8;
      const urg = nP === 0 ? 0.5 : 0.78 + 0.22 * tv.press;
      p.pressRole = { off, rank: i, urg };
      targets.set(p.id, { x: tx + (gdx / gl) * off, y: ty + (gdy / gl) * off, urg });
    });
    // suivre les appels en profondeur : le défenseur le plus proche accompagne le coureur
    const takenRun = new Set();
    for (const o of opps) {
      if (m.t >= o.runUntil || o.id === b.owner) continue;
      let best = null, bd = 20;
      for (const p of outfield) {
        if (takenRun.has(p.id) || p.pressRole || !['CB', 'FB', 'DM'].includes(p.role)) continue;
        const d = dist(p.x, p.y, o.x, o.y);
        if (d < bd) { bd = d; best = p; }
      }
      if (best) {
        takenRun.add(best.id);
        const ddx = ownGX - o.x, ddy = 34 - o.y, dl = Math.hypot(ddx, ddy) || 1;
        targets.set(best.id, { x: o.x + (ddx / dl) * 1.8 + o.vx * 0.4, y: o.y + (ddy / dl) * 1.0 + o.vy * 0.4, urg: 1 });
      }
    }
    if (relDef < 0.42) {
      const taken = new Set(takenRun);
      for (const p of outfield) {
        const markRoles = relDef < 0.3 ? ['CB', 'FB', 'DM', 'CM'] : ['CB', 'FB', 'DM'];
        if (!markRoles.includes(p.role) || sorted.indexOf(p) < nP || takenRun.has(p.id)) continue;
        const t0 = targets.get(p.id);
        let best = null, bd = relDef < 0.3 ? 18 : 14;
        for (const o of opps) {
          if (taken.has(o.id) || o.role === 'GK' || o.id === b.owner) continue;
          if (m.relX(team, o.x) > 0.42) continue;
          const d = dist(o.x, o.y, t0.x, t0.y);
          if (d < bd) { bd = d; best = o; }
        }
        if (best) {
          taken.add(best.id);
          const ddx = ownGX - best.x, ddy = 34 - best.y, dl = Math.hypot(ddx, ddy) || 1;
          const tight = relDef < 0.3 ? 1.0 : 1.6; // marquage plus serré près du but
          let mx = best.x + (ddx / dl) * tight;
          const my = best.y + (ddy / dl) * tight;
          // le marquage ne fait pas reculer la ligne : on tient la hauteur, sauf ballon dans la surface
          const floorRel = relDef < 0.16 ? 0.05 : Math.max(0.08, lineRel - 0.025);
          if (m.relX(team, mx) < floorRel) mx = m.absX(team, floorRel);
          const wM = relDef < 0.3 ? 0.88 : 0.7;
          targets.set(p.id, { x: t0.x * (1 - wM) + mx * wM, y: t0.y * (1 - wM) + my * wM, urg: relDef < 0.3 ? 0.95 : 0.8 });
        }
      }
    }
  }

  // phases arrêtées
  if (restart) {
    const r = restart;
    if (r.type === 'corner' || (r.type === 'freekick' && dist(r.x, r.y, r.team === team.idx ? oppGX : ownGX, 34) < 35 && !r.direct)) {
      const goalX = r.team === team.idx ? oppGX : ownGX;
      const into = -Math.sign(goalX - 52.5);
      const spots = [[6, -3], [7, 3], [11, 0], [9, -6], [10, 6], [14, 0], [5, 0], [13, -4], [13, 4]];
      const cand = players.filter((p) => p.role !== 'GK' && p.id !== r.taker).sort((a, c) => (c.attrs.aerial - a.attrs.aerial));
      const n = r.team === team.idx ? 5 : cand.length;
      cand.slice(0, n).forEach((p, i) => {
        const [dx, dy] = spots[i % spots.length];
        targets.set(p.id, { x: goalX + into * dx, y: 34 + dy, urg: 0.7 });
      });
    }
    if (r.type === 'penalty') {
      for (const p of players) {
        if (p.id === r.taker || p.role === 'GK') continue;
        const t0 = targets.get(p.id);
        const goalX = r.team === team.idx ? oppGX : ownGX;
        const edge = goalX + (goalX === 0 ? 1 : -1) * 18.5;
        targets.set(p.id, { x: goalX === 0 ? Math.max(t0.x, edge) : Math.min(t0.x, edge), y: t0.y, urg: 0.5 });
      }
    }
    if (r.team !== team.idx && (r.type === 'freekick' || r.type === 'corner' || r.type === 'throw' || r.type === 'kickoff')) {
      const keep = r.type === 'throw' ? 2 : 9.15;
      for (const p of players) {
        const t0 = targets.get(p.id);
        const d = dist(t0.x, t0.y, r.x, r.y);
        if (d < keep && d > 0.01) targets.set(p.id, { x: r.x + ((t0.x - r.x) / d) * keep, y: r.y + ((t0.y - r.y) / d) * keep, urg: t0.urg });
      }
    }
    if (r.team === team.idx) {
      const tk = m.players[r.taker];
      if (tk && tk.team === team.idx) targets.set(tk.id, { x: r.x - team.dir * 0.4, y: r.y, urg: 0.8 });
    }
    if (r.type === 'penalty') {
      const g = players.find((p) => p.role === 'GK');
      if (g && r.team !== team.idx) targets.set(g.id, { x: ownGX, y: 34, urg: 0.6 });
    }
  }

  for (const p of players) {
    if (p.id === b.owner || m.t < (p.chaseUntil ?? 0)) continue;
    const t = targets.get(p.id);
    if (!t) continue;
    p.tx = t.x; p.ty = t.y; p.urgency = t.urg;
  }

  // gardien face à un tir : se déplacer vers la trajectoire, après un temps de réaction
  const g = players.find((p) => p.role === 'GK');
  if (g && b.shot && b.shot.team !== team.idx && m.t - b.shot.t0 > 0.15) {
    const pred = predictBall(b, 25);
    let best = pred[pred.length - 1];
    for (const q of pred) if (Math.abs(q.x - g.x) < Math.abs(best.x - g.x)) best = q;
    g.tx = best.x; g.ty = best.y; g.urgency = 1;
  }
}

// Attribution des courses vers un ballon libre : le premier capable d'y arriver par équipe.
export function assignChasers(m) {
  const b = m.ball;
  if (b.owner != null || m.phase !== 'play') return;
  const pred = predictBall(b, 40);
  for (const team of m.teams) {
    let best = null;
    const players = m.onPitch(team.idx);
    for (const p of players) {
      if (m.t < p.stunUntil) continue;
      const vmax = m.maxSpeed(p) * 0.92;
      let k = -1;
      for (let i = 0; i < pred.length; i++) {
        const q = pred[i];
        if (q.z > 2.6) continue;
        const tReach = Math.max(0, dist(p.x, p.y, q.x, q.y) - 0.8) / vmax + 0.15;
        if (tReach <= q.t) { k = i; break; }
      }
      const tScore = k >= 0 ? pred[k].t : 5 + dist(p.x, p.y, pred[pred.length - 1].x, pred[pred.length - 1].y) / vmax;
      if (p.role === 'GK') {
        const pt = k >= 0 ? pred[k] : pred[pred.length - 1];
        const dOwn = Math.abs(pt.x - m.ownGoalX(team));
        if (dOwn > 17 || Math.abs(pt.y - 34) > 21) continue;
      }
      if (!best || tScore < best.tScore) best = { p, k, tScore };
    }
    const assign = (p, k) => {
      const pt = k >= 0 ? pred[k] : pred[pred.length - 1];
      p.tx = clamp(pt.x, -1, PITCH.length + 1); p.ty = clamp(pt.y, -1, PITCH.width + 1); p.urgency = 1; p.chaseUntil = m.t + 0.25;
    };
    if (best) assign(best.p, best.k);
    if (b.pass && b.pass.team === team.idx && b.pass.to != null) {
      const r = m.players[b.pass.to];
      if (r && r.onPitch && (!best || r.id !== best.p.id)) {
        let k = -1;
        for (let i = 0; i < pred.length; i++) {
          const tReach = Math.max(0, dist(r.x, r.y, pred[i].x, pred[i].y) - 0.8) / (m.maxSpeed(r) * 0.92) + 0.15;
          if (tReach <= pred[i].t && pred[i].z < 2.6) { k = i; break; }
        }
        assign(r, k);
      }
    }
  }
}
