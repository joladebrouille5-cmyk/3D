// Choix proposés au joueur pendant le match (carrière).
// Les options viennent du moteur (holderOptions) : ce sont les mêmes que celles qu'envisage l'IA.
// Les indications de risque sont des estimations, jamais des garanties.

import { holderOptions } from '../engine/decisions.js';

const dist = (a, b, c, d) => Math.hypot(a - c, b - d);
const riskLabel = (r) => (r == null ? '' : r < 0.18 ? 'risque faible' : r < 0.38 ? 'risque moyen' : 'risque élevé');
const riskClass = (r) => (r == null ? '' : r < 0.18 ? 'low' : r < 0.38 ? 'mid' : 'high');
const short = (q) => `${q.name.split(' ')[0]} (n° ${q.num})`;

// Situation avec ballon : jusqu'à 4 options distinctes et parlantes
export function ballChoices(m, u) {
  const { opts } = holderOptions(m, u, null);
  const by = (k) => opts.filter((o) => o.kind === k);
  const team = m.teams[u.team];
  const out = [];
  const add = (o, icon, label, hint, cls) => { if (o && !out.some((x) => x.opt === o)) out.push({ opt: o, icon, label, hint, cls }); };

  const shot = by('shoot')[0];
  if (shot && shot.xg >= 0.03) add(shot, 'shoot', 'Frapper au but', `≈ ${Math.round(shot.xg * 100)} % de chances de marquer`, shot.xg > 0.15 ? 'low' : shot.xg > 0.07 ? 'mid' : 'high');

  const passes = by('pass');
  const through = passes.filter((o) => o.through).sort((a, b) => b.u - a.u)[0];
  const forward = passes.filter((o) => !o.through && o.forward > 0.07).sort((a, b) => b.u - a.u)[0];
  const safe = passes.filter((o) => !o.through).sort((a, b) => a.risk - b.risk || b.u - a.u)[0];
  const cross = by('cross')[0];
  const carry = by('carry').sort((a, b) => b.u - a.u)[0];
  const P = (o) => m.players[o.to];

  if (through) add(through, 'through', `Passe en profondeur pour ${short(P(through))}`, riskLabel(through.risk), riskClass(through.risk));
  if (cross && out.length < 3) add(cross, 'cross', 'Centrer dans la surface', `${cross.attackers} partenaire(s) dans la surface · ${riskLabel(cross.risk)}`, riskClass(cross.risk));
  if (forward && forward !== through) add(forward, 'forward', `Passe vers l'avant à ${short(P(forward))}`, riskLabel(forward.risk), riskClass(forward.risk));
  if (safe && out.length < 4) add(safe, 'safe', `Passe sûre à ${short(P(safe))}`, riskLabel(safe.risk), riskClass(safe.risk));
  if (carry && out.length < 4) {
    const fwd = carry.forward > 3;
    add(carry, fwd ? 'dribble' : 'turn', fwd ? 'Percer balle au pied' : 'Conduire pour se dégager', riskLabel(carry.risk), riskClass(carry.risk));
  }
  if (out.length < 2) add({ kind: 'hold' }, 'shield', 'Temporiser, protéger le ballon', 'garder la possession', 'low');
  // ordre d'affichage stable : le plus offensif d'abord
  void team;
  return { title: 'Tu as le ballon', sub: situation(m, u), list: out.slice(0, 4), type: 'ball' };
}

// Sans ballon, en défense : adversaire porteur proche
export function defendChoices(m, u, h) {
  const d = dist(u.x, u.y, h.x, h.y);
  const list = [];
  if (d < 3) list.push({ intent: 'tackle', icon: 'tackle', label: 'Tacler maintenant', hint: 'récupération possible · risque de faute', cls: 'high' });
  list.push({ intent: 'press', icon: 'press', label: `Presser ${short(h)}`, hint: 'fermer son espace, le pousser à l\'erreur', cls: 'mid' });
  list.push({ intent: 'cover', icon: 'cut', label: 'Couper la ligne de passe', hint: 'anticiper la passe suivante', cls: 'low' });
  list.push({ intent: 'hold', icon: 'pin', label: 'Garder ta position', hint: 'protéger la structure de l\'équipe', cls: 'low' });
  return { title: `${short(h)} arrive sur toi`, sub: situation(m, u), list, type: 'defend' };
}

// Sans ballon, en attaque : un partenaire a le ballon
export function supportChoices(m, u, h) {
  const list = [
    { intent: 'run', icon: 'run', label: 'Appel en profondeur', hint: 'attaquer l\'espace · attention au hors-jeu', cls: 'mid' },
    { intent: 'call', icon: 'call', label: `Demander le ballon à ${short(h)}`, hint: 'proposer une solution courte', cls: 'low' },
    { intent: 'hold', icon: 'pin', label: 'Rester en soutien', hint: 'équilibre et couverture', cls: 'low' },
  ];
  return { title: `${short(h)} a le ballon`, sub: situation(m, u), list, type: 'support' };
}

function situation(m, u) {
  const team = m.teams[u.team];
  const mine = m.score[u.team], theirs = m.score[1 - u.team];
  const gx = m.oppGoalX(team);
  const dGoal = Math.round(dist(u.x, u.y, gx, 34));
  const score = mine > theirs ? 'vous menez' : mine < theirs ? 'vous êtes menés' : 'score nul';
  const mn = m.minute();
  return `${mn}${mn === '1' ? 're' : 'e'} minute · ${score} ${mine}-${theirs} · à ${dGoal} m du but adverse`;
}

// Cibles à dessiner sur le terrain pour chaque choix
export function choiceTargets(m, u, choices) {
  return choices.list.map((c, i) => {
    const o = c.opt;
    if (!o) return null;
    if (o.kind === 'pass' || o.kind === 'cross') return { n: i + 1, x0: u.x, y0: u.y, x1: o.tx, y1: o.ty };
    if (o.kind === 'carry') return { n: i + 1, x0: u.x, y0: u.y, x1: u.x + o.dx * 8, y1: u.y + o.dy * 8 };
    if (o.kind === 'shoot') return { n: i + 1, x0: u.x, y0: u.y, x1: m.oppGoalX(m.teams[u.team]), y1: 34 };
    return null;
  }).filter(Boolean);
}
