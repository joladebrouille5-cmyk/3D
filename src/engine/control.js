// Pilotage direct d'un joueur de champ (carrière joueur).
// Les entrées passent par des commandes horodatées (reproductibilité) ; l'issue des gestes
// reste résolue par le moteur : viser un partenaire ne garantit pas une passe réussie.

import { PITCH } from './config.js';
import { clamp, dist } from './geom.js';

const angDiff = (a, b) => { let d = Math.abs(a - b); if (d > Math.PI) d = 2 * Math.PI - d; return d; };

// Direction de visée : entrée du joueur, sinon orientation du corps.
export function aimDir(p, dx, dy) {
  const m = Math.hypot(dx, dy);
  if (m > 0.2) return { x: dx / m, y: dy / m, explicit: true };
  return { x: p.fx, y: p.fy, explicit: false };
}

// Cible d'un geste : le partenaire le mieux aligné avec la visée (aide de visée, pas de garantie).
// kind : 'short' | 'through' | 'long'
export function pickTarget(m, p, dx, dy, kind = 'short') {
  const team = m.teams[p.team];
  const aim = aimDir(p, dx, dy);
  const aimAng = Math.atan2(aim.y, aim.x);
  let best = null, bestScore = Infinity;
  for (const q of m.onPitch(p.team)) {
    if (q.id === p.id || q.injured) continue;
    const d = dist(p.x, p.y, q.x, q.y);
    if (d < 3) continue;
    const da = angDiff(Math.atan2(q.y - p.y, q.x - p.x), aimAng);
    let score = da * (aim.explicit ? 1.6 : 0.8);
    if (kind === 'short') score += (d > 30 ? (d - 30) * 0.05 : 0) + d * 0.004 + (q.role === 'GK' ? 0.4 : 0);
    else if (kind === 'long') score += d < 24 ? (24 - d) * 0.06 : 0;
    else { // dans la course : partenaire devant, plutôt offensif
      const ahead = (q.x - p.x) * team.dir;
      score += ahead < -4 ? 1.2 : 0;
      score += ['ST', 'W', 'AM'].includes(q.role) ? -0.15 : q.role === 'GK' ? 1 : 0;
      score += d > 40 ? (d - 40) * 0.04 : 0;
    }
    if (!aim.explicit) score += 0.25 * (1 - clamp(((q.x - p.x) * team.dir + 10) / 30, 0, 1)); // sans visée : plutôt vers l'avant
    if (score < bestScore) { bestScore = score; best = q; }
  }
  if (!best) return null;
  let tx = best.x + best.vx * 0.3, ty = best.y + best.vy * 0.3;
  if (kind === 'through') {
    tx = clamp(best.x + team.dir * 9, 2, PITCH.length - 2);
    ty = clamp(best.y + (34 - best.y) * 0.15 + best.vy * 0.5, 3, PITCH.width - 3);
  }
  const d = dist(p.x, p.y, tx, ty);
  return { player: best, tx, ty, lofted: kind === 'long' || d > 34 };
}

// Le joueur est-il en position de centrer (couloir du dernier tiers) ?
export function canCross(m, p) {
  const team = m.teams[p.team];
  return m.relX(team, p.x) > 0.72 && Math.abs(p.y - 34) > 12;
}
