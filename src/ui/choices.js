// Choix proposés au joueur pendant le match (carrière).
// Les options viennent du moteur (holderOptions) : ce sont celles qu'envisage l'IA, déclinées en
// gestes concrets selon la situation (une-deux, renversement, centre en retrait, frappe piquée…).
// Les indications de risque sont des estimations, jamais des garanties.

import { holderOptions, pressureOn } from '../engine/decisions.js';

const dist = (a, b, c, d) => Math.hypot(a - c, b - d);
const riskLabel = (r) => (r == null ? '' : r < 0.18 ? 'risque faible' : r < 0.38 ? 'risque moyen' : 'risque élevé');
const riskClass = (r) => (r == null ? '' : r < 0.18 ? 'low' : r < 0.38 ? 'mid' : 'high');
const xgClass = (x) => (x > 0.15 ? 'low' : x > 0.07 ? 'mid' : 'high');
const pct = (x) => Math.max(1, Math.round(x * 100));
const first = (q) => q.name.split(' ')[0];
const short = (q) => `${first(q)} (n° ${q.num})`;
// ordre d'affichage : du plus décisif au plus prudent
const CAT_ORDER = ['shot', 'special', 'forward', 'cross', 'carry', 'safe', 'hold'];
const DEF_ORDER = ['duel', 'foul', 'press', 'block', 'track', 'cover', 'hold'];

// Garde jusqu'à 4 options variées : la meilleure de chaque famille d'abord, puis le reste ;
// les gestes proposés juste avant passent après les nouveautés (`recent` : clés récentes).
function pick(cands, recent = [], order = CAT_ORDER, max = 4) {
  const seen = new Set(recent);
  const scored = cands.map((c) => ({ ...c, s: c.score - (seen.has(c.key) ? 0.012 : 0) })).sort((a, b) => b.s - a.s);
  const out = [];
  const cats = new Set();
  for (const c of scored) if (!cats.has(c.cat) && out.length < max) { out.push(c); cats.add(c.cat); }
  for (const c of scored) if (!out.includes(c) && out.length < max) out.push(c);
  return out.sort((a, b) => order.indexOf(a.cat) - order.indexOf(b.cat));
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
const minuteNum = (m) => { const [a, b] = String(m.minute()).split('+').map(Number); return a + (b || 0); };

// ------------------------------------------------------------------ avec le ballon
export function ballChoices(m, u, recent = []) {
  const { opts } = holderOptions(m, u, null);
  const team = m.teams[u.team];
  const dir = team.dir;
  const gx = m.oppGoalX(team);
  const dGoal = dist(u.x, u.y, gx, 34);
  const rel = m.relX(team, u.x);
  const pr = pressureOn(m, u);
  const wide = Math.abs(u.y - 34) > 20;
  const lead = m.score[u.team] - m.score[1 - u.team];
  const late = minuteNum(m) >= 80;
  const P = (o) => m.players[o.to];
  const cands = [];
  const add = (c) => cands.push(c);

  // tirs
  const shot = opts.find((o) => o.kind === 'shoot');
  if (shot && shot.xg >= 0.025) {
    const gk = m.gk(1 - u.team);
    const gkOut = gk && Math.abs(gk.x - gx) > 5.5;
    add({ key: 'shot-placed', cat: 'shot', opt: { ...shot, style: 'placed' }, icon: 'shoot', label: dGoal < 14 ? 'Ajuster le gardien' : 'Frappe placée', hint: `≈ ${pct(shot.xg)} % · viser le petit filet`, cls: xgClass(shot.xg), score: shot.u + 0.02 });
    if (dGoal > 13) add({ key: 'shot-power', cat: 'shot', opt: { ...shot, style: 'power' }, icon: 'physique', label: dGoal > 23 ? 'Tenter sa chance de loin' : 'Frappe en force', hint: 'puissante, moins précise', cls: xgClass(shot.xg * 0.9), score: shot.u + 0.005 + (lead < 0 && late ? 0.02 : 0) });
    if (gkOut && dGoal < 28) add({ key: 'shot-chip', cat: 'shot', opt: { ...shot, style: 'chip' }, icon: 'cross', label: 'Piquer au-dessus du gardien', hint: 'le gardien est sorti de sa ligne', cls: 'mid', score: shot.u + 0.035 });
  }

  const passes = opts.filter((o) => o.kind === 'pass');
  // profondeur
  const through = passes.filter((o) => o.through).sort((a, b) => b.u - a.u)[0];
  if (through) add({ key: 'through', cat: 'forward', opt: through, icon: 'through', label: `Passe en profondeur pour ${short(P(through))}`, hint: riskLabel(through.risk), cls: riskClass(through.risk), score: through.u + 0.004 });
  // vers l'avant
  const forward = passes.filter((o) => !o.through && o.forward > 0.07 && !o.lofted).sort((a, b) => b.u - a.u)[0];
  if (forward) add({ key: 'forward', cat: 'forward', opt: forward, icon: 'forward', label: `Passe vers l'avant à ${short(P(forward))}`, hint: riskLabel(forward.risk), cls: riskClass(forward.risk), score: forward.u });
  // jeu long vers l'attaquant (depuis sa moitié)
  if (rel < 0.48) {
    const long = passes.filter((o) => o.lofted && ['ST', 'W'].includes(P(o).role) && o.forward > 0.2).sort((a, b) => b.u - a.u)[0];
    if (long) add({ key: 'long', cat: 'forward', opt: long, icon: 'cross', label: `Jouer long vers ${short(P(long))}`, hint: `sauter le milieu · ${riskLabel(long.risk)}`, cls: riskClass(long.risk), score: long.u - 0.002 });
  }
  // renversement de jeu
  const sw = passes.filter((o) => o.lofted && Math.abs(P(o).y - u.y) > 24 && o.forward > -0.12).sort((a, b) => b.u - a.u)[0];
  if (sw) add({ key: 'switch', cat: 'special', opt: sw, icon: 'swap', label: `Renverser le jeu vers ${short(P(sw))}`, hint: `changer d'aile · ${riskLabel(sw.risk)}`, cls: riskClass(sw.risk), score: sw.u + 0.006 });
  // centre en retrait
  if (rel > 0.85 && Math.abs(u.y - 34) > 7) {
    const cb = passes.filter((o) => !o.lofted && dist(P(o).x, P(o).y, gx, 34) < 18 && dist(P(o).x, P(o).y, gx, 34) > 7 && Math.abs(P(o).y - 34) < 10).sort((a, b) => b.u - a.u)[0];
    if (cb) add({ key: 'cutback', cat: 'special', opt: cb, icon: 'turn', label: `Centre en retrait pour ${short(P(cb))}`, hint: `ballon à ras de terre · ${riskLabel(cb.risk)}`, cls: riskClass(cb.risk), score: cb.u + 0.012 });
  }
  // une-deux : passe courte vers un partenaire proche, espace devant soi
  let spaceAhead = true;
  for (const o of m.onPitch(1 - u.team)) if (dist(o.x, o.y, u.x + dir * 5, u.y) < 4) spaceAhead = false;
  if (rel > 0.4 && rel < 0.9 && spaceAhead) {
    const wall = passes.filter((o) => !o.lofted && !o.through && dist(P(o).x, P(o).y, u.x, u.y) < 15 && o.risk < 0.4).sort((a, b) => b.u - a.u)[0];
    if (wall) add({ key: 'onetwo', cat: 'special', opt: { ...wall, oneTwo: true }, icon: 'support', label: `Une-deux avec ${short(P(wall))}`, hint: 'donner et filer dans l\'espace', cls: riskClass(wall.risk + 0.08), score: wall.u + 0.008 });
  }
  // centre : tendu au premier poteau ou au second
  const cross = opts.find((o) => o.kind === 'cross');
  if (cross) {
    const side = u.y < 34 ? -1 : 1;
    add({ key: 'cross-far', cat: 'cross', opt: { ...cross, tx: gx - dir * 8, ty: 34 - side * 5.5 }, icon: 'cross', label: 'Centrer au second poteau', hint: `${cross.attackers} partenaire(s) dans la surface · ${riskLabel(cross.risk)}`, cls: riskClass(cross.risk), score: cross.u });
    add({ key: 'cross-near', cat: 'cross', opt: { ...cross, tx: gx - dir * 5.5, ty: 34 + side * 3 }, icon: 'through', label: 'Centre tendu au premier poteau', hint: 'rapide, à couper devant le défenseur', cls: riskClass(cross.risk + 0.05), score: cross.u - 0.004 });
  }
  // conduites : repiquer, déborder, accélérer, se retourner
  const carries = opts.filter((o) => o.kind === 'carry');
  const toCenter = carries.filter((o) => Math.sign(o.dy) === Math.sign(34 - u.y) && Math.abs(o.dy) > 0.4 && o.forward > 1).sort((a, b) => b.u - a.u)[0];
  const alongLine = wide ? carries.filter((o) => Math.abs(o.dy) < 0.35 && o.forward > 3).sort((a, b) => b.u - a.u)[0] : null;
  const straight = carries.filter((o) => o.forward > 3).sort((a, b) => b.u - a.u)[0];
  const away = carries.filter((o) => o.forward <= 3).sort((a, b) => b.u - a.u)[0];
  if (toCenter && rel > 0.55) add({ key: 'cutin', cat: 'carry', opt: toCenter, icon: 'dribble', label: 'Repiquer dans l\'axe', hint: `crochet vers l'intérieur · ${riskLabel(toCenter.risk)}`, cls: riskClass(toCenter.risk), score: toCenter.u + 0.004 });
  if (alongLine && rel > 0.55) add({ key: 'byline', cat: 'carry', opt: alongLine, icon: 'forward', label: 'Déborder le long de la ligne', hint: `provoquer son défenseur · ${riskLabel(alongLine.risk)}`, cls: riskClass(alongLine.risk), score: alongLine.u + 0.003 });
  if (straight && !cands.some((c) => c.opt === straight)) add({ key: 'drive', cat: 'carry', opt: straight, icon: 'physique', label: rel < 0.5 ? 'Accélérer balle au pied' : 'Percer balle au pied', hint: riskLabel(straight.risk), cls: riskClass(straight.risk), score: straight.u });
  if (away && pr > 0.35) add({ key: 'turn', cat: 'carry', opt: away, icon: 'turn', label: 'Se retourner pour se dégager', hint: `sortir de la pression · ${riskLabel(away.risk)}`, cls: riskClass(away.risk), score: away.u });
  // sécurité
  const safe = passes.filter((o) => !o.through).sort((a, b) => a.risk - b.risk || b.u - a.u)[0];
  if (safe) add({ key: 'safe', cat: 'safe', opt: safe, icon: 'safe', label: safe.forward < -0.05 ? `Remiser en retrait à ${short(P(safe))}` : `Passe sûre à ${short(P(safe))}`, hint: riskLabel(safe.risk), cls: riskClass(safe.risk), score: safe.u - 0.001 });
  if (lead > 0 && late && rel > 0.8 && wide) add({ key: 'time', cat: 'hold', opt: { kind: 'hold', wait: 2.5 }, icon: 'shield', label: 'Garder le ballon au poteau de corner', hint: 'faire passer les minutes', cls: 'low', score: 0.02 });
  else if (pr > 0.5) add({ key: 'hold', cat: 'hold', opt: { kind: 'hold' }, icon: 'shield', label: 'Protéger le ballon', hint: 'attendre le soutien d\'un partenaire', cls: 'mid', score: -0.004 });

  const list = pick(cands, recent);
  if (list.length < 2) list.push({ key: 'hold', cat: 'hold', opt: { kind: 'hold' }, icon: 'shield', label: 'Temporiser, protéger le ballon', hint: 'garder la possession', cls: 'low' });

  // titre de la situation
  let behind = 0;
  for (const o of m.onPitch(1 - u.team)) if (o.role !== 'GK' && m.relX(team, o.x) > rel) behind++;
  const title = dGoal < 17 && shot ? 'Face au but !'
    : behind <= 3 && rel > 0.38 ? 'Contre-attaque !'
    : pr > 0.65 ? 'Pressé de près'
    : wide && rel > 0.66 ? 'Sur l\'aile, ballon au pied'
    : rel < 0.35 ? 'Relance dans ton camp'
    : 'Tu as le ballon';
  return { title, sub: situation(m, u), list, type: 'ball' };
}

// ------------------------------------------------------------------ sans ballon, en défense
export function defendChoices(m, u, h, recent = []) {
  const team = m.teams[u.team];
  const d = dist(u.x, u.y, h.x, h.y);
  const ownGx = m.ownGoalX(team);
  const hGoal = dist(h.x, h.y, ownGx, 34);
  // contre-attaque adverse : peu de défenseurs entre le porteur et ton but
  let cover = 0;
  for (const o of m.onPitch(u.team)) if (o.role !== 'GK' && Math.abs(o.x - ownGx) < Math.abs(h.x - ownGx)) cover++;
  const counter = cover <= 3 && hGoal > 22;
  const cands = [];
  const add = (c) => cands.push(c);
  if (d < 4.5) {
    add({ key: 'tackle', cat: 'duel', intent: 'tackle', icon: 'tackle', label: 'Tacle debout', hint: 'rester sur ses appuis · faute rare', cls: 'mid', score: 0.03 });
    add({ key: 'slide', cat: 'duel', intent: 'slide', icon: 'physique', label: 'Tacle glissé', hint: 'récupère plus souvent · faute et carton possibles', cls: 'high', score: 0.028 + (counter ? 0.01 : 0) });
  }
  if (counter && d < 6) add({ key: 'foul', cat: 'foul', intent: 'foul', icon: 'whistle', label: 'Faute tactique', hint: 'casser la contre-attaque · carton jaune probable', cls: 'high', score: 0.026 });
  add({ key: 'press', cat: 'press', intent: 'press', icon: 'press', label: `Presser ${short(h)}`, hint: 'fermer son espace, le pousser à l\'erreur', cls: 'mid', score: 0.024 });
  if (Math.abs(h.y - 34) < 22 && hGoal > 18) add({ key: 'shepherd', cat: 'press', intent: 'shepherd', icon: 'turn', label: 'L\'orienter vers l\'extérieur', hint: 'fermer l\'axe, le pousser sur son mauvais pied', cls: 'low', score: 0.025 });
  if (hGoal < 30) add({ key: 'block', cat: 'block', intent: 'block', icon: 'shield', label: 'Fermer l\'angle de frappe', hint: 'se placer entre lui et le but', cls: 'low', score: 0.027 });
  // un attaquant adverse prend la profondeur près de toi
  const near = m.onPitch(h.team).filter((o) => o.id !== h.id && o.role !== 'GK' && dist(o.x, o.y, u.x, u.y) < 16).sort((a, b) => dist(a.x, a.y, u.x, u.y) - dist(b.x, b.y, u.x, u.y));
  const runner = near.find((o) => m.t < (o.runUntil ?? 0)) ?? near[0];
  if (runner) {
    const running = m.t < (runner.runUntil ?? 0);
    add({ key: 'track', cat: 'track', intent: 'track', icon: 'run', label: running ? `Suivre l'appel de ${first(runner)}` : `Marquer ${short(runner)}`, hint: running ? 'ne pas le lâcher dans ton dos' : 'le priver de ballon', cls: 'low', score: 0.025 + (running ? 0.004 : 0) });
  }
  add({ key: 'cover', cat: 'cover', intent: 'cover', icon: 'cut', label: 'Couper la ligne de passe', hint: 'anticiper la passe suivante', cls: 'low', score: 0.022 });
  add({ key: 'hold', cat: 'cover', intent: 'hold', icon: 'pin', label: 'Garder ta position', hint: 'protéger la structure de l\'équipe', cls: 'low', score: 0.018 });
  const title = counter ? 'Contre-attaque adverse !' : hGoal < 25 ? 'Danger devant ton but' : `${short(h)} arrive sur toi`;
  return { title, sub: situation(m, u), list: pick(cands, recent, DEF_ORDER), type: 'defend', vs: h.id };
}

// ------------------------------------------------------------------ sans ballon, en attaque
export function supportChoices(m, u, h, recent = []) {
  const team = m.teams[u.team];
  const dir = team.dir;
  const gx = m.oppGoalX(team);
  const hRel = m.relX(team, h.x), uRel = m.relX(team, u.x);
  const cands = [];
  const add = (c) => cands.push(c);
  const crossing = hRel > 0.72 && Math.abs(h.y - 34) > 14 && dist(u.x, u.y, gx, 34) < 26;
  if (crossing) {
    // centre en préparation : choisir sa zone dans la surface
    const side = h.y < 34 ? -1 : 1;
    add({ key: 'near-post', cat: 'forward', intent: 'spot', spot: { x: gx - dir * 5, y: 34 + side * 3 }, icon: 'through', label: 'Attaquer le premier poteau', hint: 'couper la trajectoire devant le défenseur', cls: 'mid', score: 0.03 });
    add({ key: 'far-post', cat: 'special', intent: 'spot', spot: { x: gx - dir * 6.5, y: 34 - side * 5.5 }, icon: 'cross', label: 'Filer au second poteau', hint: 'profiter d\'un centre long', cls: 'mid', score: 0.029 });
    add({ key: 'spot', cat: 'safe', intent: 'spot', spot: { x: gx - dir * 11, y: 34 }, icon: 'target', label: 'Se placer au point de penalty', hint: 'pour un centre en retrait', cls: 'low', score: 0.027 });
    add({ key: 'rebound', cat: 'safe', intent: 'spot', spot: { x: gx - dir * 19, y: 34 }, icon: 'pin', label: 'Rester à l\'entrée de la surface', hint: 'pour le second ballon', cls: 'low', score: 0.02 });
  } else if (hRel < 0.4) {
    // relance depuis l'arrière : se montrer, ou étirer le bloc adverse
    add({ key: 'drop', cat: 'safe', intent: 'drop', icon: 'call', label: 'Décrocher pour proposer une solution', hint: 'venir entre les lignes, dos au jeu', cls: 'low', score: 0.028 });
    add({ key: 'run', cat: 'forward', intent: 'run', icon: 'run', label: 'Prendre la profondeur', hint: 'pour un ballon long dans ton dos', cls: 'mid', score: 0.026 });
    if (Math.abs(u.y - 34) < 18) add({ key: 'decoy', cat: 'special', intent: 'spot', spot: { x: u.x + dir * 4, y: u.y < 34 ? 6 : 62 }, icon: 'swap', label: 'Écarter pour étirer le bloc', hint: 'ouvrir l\'axe pour la relance', cls: 'low', score: 0.025 });
    add({ key: 'hold', cat: 'safe', intent: 'hold', icon: 'pin', label: 'Garder ta position', hint: 'équilibre en cas de perte', cls: 'low', score: 0.02 });
  } else if (hRel > 0.66 && Math.abs(h.y - 34) < 18) {
    // porteur dans les trente derniers mètres, dans l'axe
    add({ key: 'box', cat: 'forward', intent: 'spot', spot: { x: gx - dir * 9, y: u.y < 34 ? 29 : 39 }, icon: 'target', label: 'Se démarquer dans la surface', hint: 'pour une passe en retrait ou un ballon dévié', cls: 'mid', score: 0.03 });
    add({ key: 'run', cat: 'special', intent: 'run', icon: 'run', label: 'Plonger dans le dos de la défense', hint: 'attention au hors-jeu', cls: 'mid', score: 0.029 });
    add({ key: 'call', cat: 'safe', intent: 'call', icon: 'call', label: `Proposer un une-deux à ${first(h)}`, hint: 'appui court pour relancer l\'action', cls: 'low', score: 0.027 });
    add({ key: 'rebound', cat: 'hold', intent: 'spot', spot: { x: gx - dir * 20, y: 34 }, icon: 'pin', label: 'Rester à l\'entrée de la surface', hint: 'pour la frappe ou le second ballon', cls: 'low', score: 0.022 });
  } else {
    if (uRel >= hRel - 0.05) {
      add({ key: 'run', cat: 'forward', intent: 'run', icon: 'run', label: 'Appel en profondeur', hint: 'attaquer l\'espace · attention au hors-jeu', cls: 'mid', score: 0.03 });
      add({ key: 'diag', cat: 'special', intent: 'diag', icon: 'cross', label: 'Appel croisé', hint: 'en diagonale, dans le dos du latéral', cls: 'mid', score: 0.028 });
    }
    if (Math.abs(h.y - 34) > 14 && Math.sign(u.y - 34) === Math.sign(h.y - 34) && uRel <= hRel + 0.02) add({ key: 'overlap', cat: 'special', intent: 'overlap', icon: 'run', label: `Dédoubler ${first(h)}`, hint: 'passer par l\'extérieur', cls: 'mid', score: 0.031 });
    if (uRel > hRel + 0.08) add({ key: 'drop', cat: 'safe', intent: 'drop', icon: 'call', label: 'Décrocher entre les lignes', hint: 'venir chercher le ballon dos au but', cls: 'low', score: 0.026 });
    add({ key: 'call', cat: 'safe', intent: 'call', icon: 'call', label: `Demander le ballon à ${short(h)}`, hint: 'proposer une solution courte', cls: 'low', score: 0.025 });
    // se démarquer : le point libre le plus éloigné des défenseurs, devant le porteur
    let free = null, fd = 0;
    for (const [fx, fy] of [[0.72, 20], [0.72, 48], [0.8, 34], [0.62, 26], [0.62, 42], [0.86, 26], [0.86, 42]]) {
      const x = m.absX(team, fx), y = fy;
      let dmin = Infinity;
      for (const o of m.onPitch(1 - u.team)) dmin = Math.min(dmin, dist(o.x, o.y, x, y));
      if (dmin > fd && m.relX(team, x) > hRel - 0.05) { fd = dmin; free = { x, y }; }
    }
    if (free && fd > 5) add({ key: 'space', cat: 'special', intent: 'spot', spot: free, icon: 'target', label: 'Se démarquer dans l\'espace libre', hint: `aucun adversaire à moins de ${Math.round(fd)} m`, cls: 'low', score: 0.027 + Math.min(0.006, fd / 2000) });
    add({ key: 'hold', cat: 'safe', intent: 'hold', icon: 'pin', label: 'Rester en soutien', hint: 'équilibre et couverture', cls: 'low', score: 0.018 });
  }
  const zone = crossing ? `${first(h)} va centrer` : hRel < 0.4 ? `${first(h)} relance de l'arrière` : hRel > 0.66 ? `${first(h)} entre dans les 30 derniers mètres` : `${first(h)} conduit au milieu`;
  return { title: zone, sub: situation(m, u), list: pick(cands, recent, ['forward', 'special', 'safe', 'hold']), type: 'support', vs: null };
}

// ------------------------------------------------------------------ coups de pied arrêtés
// `screenLeft` : signe du côté « gauche » vu par le joueur (terrain affiché, attaque vers la droite)
export function restartChoices(m, u, r) {
  const team = m.teams[u.team];
  const left = team.dir > 0 ? -1 : 1; // en regardant le but adverse, à gauche
  if (r.type === 'penalty') {
    return {
      title: 'Penalty : à toi de tirer', sub: situation(m, u), type: 'restart',
      list: [
        { key: 'pen-left', plan: { kind: 'penalty', side: left, style: 'placed' }, icon: 'shoot', label: 'Placé à gauche', hint: 'le gardien plonge souvent d\'un côté', cls: 'mid' },
        { key: 'pen-right', plan: { kind: 'penalty', side: -left, style: 'placed' }, icon: 'shoot', label: 'Placé à droite', hint: 'précis, mais lisible', cls: 'mid' },
        { key: 'pen-power', plan: { kind: 'penalty', side: 0, style: 'power' }, icon: 'physique', label: 'En force au milieu', hint: 'si le gardien plonge, c\'est but', cls: 'mid' },
        { key: 'pen-panenka', plan: { kind: 'penalty', side: 0, style: 'chip' }, icon: 'cross', label: 'Panenka', hint: 'génial ou ridicule', cls: 'high' },
      ],
    };
  }
  if (r.type === 'corner') {
    return {
      title: 'Corner : tu le tires', sub: situation(m, u), type: 'restart',
      list: [
        { key: 'c-near', plan: { kind: 'cross', post: 'near' }, icon: 'through', label: 'Centre au premier poteau', hint: 'pour une déviation', cls: 'mid' },
        { key: 'c-far', plan: { kind: 'cross', post: 'far' }, icon: 'cross', label: 'Centre au second poteau', hint: 'pour les grands gabarits', cls: 'mid' },
        { key: 'c-short', plan: { kind: 'short' }, icon: 'safe', label: 'Jouer à deux', hint: 'corner joué court', cls: 'low' },
      ],
    };
  }
  if (r.type === 'freekick') {
    const d = Math.round(dist(r.x, r.y, m.oppGoalX(team), 34));
    if (!r.direct || d > 32) {
      if (m.relX(team, r.x) < 0.6) return null; // simple remise en jeu dans son camp : pas de choix
      return {
        title: `Coup franc à ${d} m`, sub: situation(m, u), type: 'restart',
        list: [
          { key: 'fk-cross2', plan: { kind: 'cross', post: 'far' }, icon: 'cross', label: 'Mettre le ballon dans la boîte', hint: 'centre au second poteau', cls: 'mid' },
          { key: 'fk-near', plan: { kind: 'cross', post: 'near' }, icon: 'through', label: 'Centre tendu au premier poteau', hint: 'pour une déviation', cls: 'mid' },
          { key: 'fk-short2', plan: { kind: 'short' }, icon: 'safe', label: 'Jouer court', hint: 'garder le ballon', cls: 'low' },
        ],
      };
    }
    return {
      title: `Coup franc à ${d} m`, sub: situation(m, u), type: 'restart',
      list: [
        { key: 'fk-placed', plan: { kind: 'shoot', style: 'placed' }, icon: 'shoot', label: 'Enrouler au-dessus du mur', hint: 'viser la lucarne', cls: 'mid' },
        { key: 'fk-power', plan: { kind: 'shoot', style: 'power' }, icon: 'physique', label: 'Frappe en force', hint: 'le mur peut contrer', cls: 'high' },
        { key: 'fk-cross', plan: { kind: 'cross', post: 'far' }, icon: 'cross', label: 'Centrer dans la surface', hint: 'pour la tête d\'un partenaire', cls: 'mid' },
        { key: 'fk-short', plan: { kind: 'short' }, icon: 'safe', label: 'Jouer court', hint: 'garder le ballon', cls: 'low' },
      ],
    };
  }
  return null;
}

// Cibles à dessiner sur le terrain pour chaque choix
export function choiceTargets(m, u, choices) {
  return choices.list.map((c, i) => {
    const o = c.opt;
    if (c.spot) return { n: i + 1, x0: u.x, y0: u.y, x1: c.spot.x, y1: c.spot.y };
    if (!o) return null;
    if (o.kind === 'pass' || o.kind === 'cross') return { n: i + 1, x0: u.x, y0: u.y, x1: o.tx, y1: o.ty };
    if (o.kind === 'carry') return { n: i + 1, x0: u.x, y0: u.y, x1: u.x + o.dx * 8, y1: u.y + o.dy * 8 };
    if (o.kind === 'shoot') return { n: i + 1, x0: u.x, y0: u.y, x1: m.oppGoalX(m.teams[u.team]), y1: 34 };
    return null;
  }).filter(Boolean);
}
