// Pourcentages de réussite des choix proposés au joueur.
// Méthode : pour chaque option, on rejoue plusieurs fois la suite de l'action dans une copie
// du match (même moteur, autre aléa) et on compte les réussites. Le pourcentage tient donc compte
// de tout ce que le moteur simule : tes attributs et ta fraîcheur, ceux du partenaire visé
// (vitesse, contrôle), le placement et la qualité des adversaires (tacle, interception, gardien),
// la pression et la distance. Rien n'est inventé à côté du moteur.

// Ce que « réussir » veut dire pour chaque sorte de choix, et le libellé affiché
export function goalOf(c, type = null) {
  if (c.plan) {
    const k = c.plan.kind;
    if (k === 'shoot' || k === 'penalty') return { kind: 'goal', label: 'but', max: 9 };
    if (k === 'cross') return { kind: 'cross', label: 'ballon pour un partenaire', max: 10 };
    return { kind: 'keep', label: 'ballon gardé', max: 10, window: 4 };
  }
  if (c.opt) {
    const k = c.opt.kind;
    if (k === 'shoot') return { kind: 'goal', label: 'but', max: 4 };
    if (k === 'cross') return { kind: 'cross', label: 'ballon pour un partenaire', max: 5 };
    if (k === 'pass') return { kind: 'pass', label: 'passe réussie', max: 6 };
    return { kind: 'keep', label: 'ballon gardé', max: 3, window: 2.4 };
  }
  const i = c.intent;
  if (i === 'press' || i === 'tackle' || i === 'slide') return { kind: 'win', label: 'ballon récupéré', max: 5 };
  if (i === 'foul') return { kind: 'foul', label: 'action stoppée', max: 4 };
  if (i === 'cover' || i === 'track' || i === 'block' || i === 'shepherd' || (i === 'hold' && type === 'defend')) return { kind: 'stop', label: 'action stoppée', max: 5 };
  if (i === 'hold') return { kind: 'teamkeep', label: 'possession gardée', max: 5 };
  if (i === 'call' || i === 'drop') return { kind: 'receive', label: 'ballon reçu', max: 5 };
  // appels et placements : leur but est de recevoir, ou de créer l'occasion en attirant un défenseur
  return { kind: 'chance', label: 'ballon reçu ou tir', max: 6 };
}

// Applique le choix dans la copie, comme pickChoice le fait dans le vrai match
function applyChoice(f, uid, c) {
  if (c.plan) f.queueCommand({ type: 'restartPlan', playerId: uid, plan: c.plan });
  else if (c.opt) f.queueCommand({ type: 'choice', playerId: uid, opt: c.opt });
  else f.queueCommand({ type: 'intent', playerId: uid, kind: c.intent, ...(c.spot ?? {}) });
}

// Arbitre d'un choix : observe le match pas à pas et dit si le choix a réussi.
// Sert aux simulations (copies du match) et au vrai match (retour ✓ / ✗ après ton choix).
export function createJudge(f, uid, c, goal) {
  const u = f.players[uid];
  const team = u.team, opp = 1 - team;
  const t0 = f.t, ev0 = f.events.length;
  const score0 = f.score[team], conc0 = f.score[opp];
  const restart0 = f.restart;
  let released = false, kicked = !c.plan, kickT = c.plan ? Infinity : t0;
  const ownGoal = f.ownGoalX(f.teams[team]);
  const ballDist0 = Math.abs(f.ball.x - ownGoal);
  const evs = (fn) => { for (let i = ev0; i < f.events.length; i++) if (fn(f.events[i])) return true; return false; };
  const res = (ok) => ({ ok: ok ? 1 : 0, card: evs((e) => e.type === 'carton' && e.player === uid) ? 1 : 0, goal: f.score[team] > score0 });
  return {
    // à appeler après chaque pas du moteur : null tant que l'issue n'est pas connue
    check() {
      // fin du match, ou joueur sorti avant l'issue : pas de verdict
      if (f.phase === 'fulltime' || !u.onPitch) return { ok: 0, card: 0, ended: true };
      const b = f.ball;
      // coup de pied arrêté : le chrono démarre quand le ballon est frappé
      if (!kicked && f.phase === 'play' && f.restart !== restart0 && (b.owner == null || b.owner !== f.restart?.taker)) { kicked = true; kickT = f.t; }
      if (f.score[team] > score0) return res(true);
      if (f.score[opp] > conc0) return res(false);
      const ownerTeam = b.owner != null ? f.players[b.owner].team : null;
      const dead = f.phase === 'dead' && f.restart && f.restart !== restart0;
      const restartFor = dead ? f.restart.team : null;
      const el = f.t - (kicked ? kickT : t0);
      if (f.t - t0 > 16) return res(false);
      switch (goal.kind) {
        case 'goal':
          if (kicked && el > goal.max) return res(false);
          if (dead) return res(false); // arrêt, tir à côté, ballon dégagé
          if (ownerTeam === opp) return res(false);
          break;
        case 'pass': case 'cross': {
          if (!released) { if (b.owner !== uid) released = true; else if (el > 1.5) return res(true); }
          if (!released) break;
          if (goal.kind === 'cross' && b.lastTeam === team && b.lastTouch !== uid && b.lastTouch != null) return res(true);
          if (ownerTeam === team) return res(goal.kind === 'pass');
          if (ownerTeam === opp || (b.lastTeam === opp && b.owner == null && goal.kind === 'cross')) return res(false);
          if (dead) return res(restartFor === team && f.restart.type !== 'goalkick' && goal.kind === 'pass');
          if (el > goal.max) return res(false);
          break;
        }
        case 'keep':
          if (ownerTeam === opp || (b.owner == null && b.lastTeam === opp)) return res(false);
          if (dead) return res(restartFor === team);
          if (el >= goal.window) return res(ownerTeam === team || (b.owner == null && b.lastTeam === team));
          break;
        case 'win':
          if (ownerTeam === team) return res(true);
          if (dead) return res(restartFor === team);
          if (el > goal.max) return res(false);
          break;
        case 'foul':
          if (evs((e) => e.type === 'faute' && e.player === uid)) return res(true);
          if (ownerTeam === team) return res(true);
          if (el > goal.max) return res(false);
          break;
        case 'stop':
          if (ownerTeam === team) return res(true);
          if (evs((e) => e.type === 'tir' && e.team === opp)) return res(false);
          if (dead) return res(restartFor === team || f.restart.type === 'throw');
          // l'adversaire n'a pas avancé vers ton but
          if (el > goal.max) return res(Math.abs(b.x - ownGoal) > ballDist0 - 8);
          break;
        case 'teamkeep':
          if (evs((e) => e.type === 'tir' && e.team === team)) return res(true);
          if (ownerTeam === opp) return res(false);
          if (dead) return res(restartFor === team);
          if (el > goal.max) return res(ownerTeam === team || b.lastTeam === team);
          break;
        case 'chance':
          if (b.owner === uid || evs((e) => e.type === 'tir' && e.team === team)) return res(true);
          if (ownerTeam === opp) return res(false);
          if (dead) return res(restartFor === team && (f.restart.type === 'corner' || f.restart.type === 'freekick' || f.restart.type === 'penalty'));
          if (el > goal.max) return res(false);
          break;
        case 'receive':
          if (b.owner === uid) return res(true);
          if (ownerTeam === opp || dead) return res(false);
          if (el > goal.max) return res(false);
          break;
      }
      return null;
    },
  };
}

// Une simulation de la suite dans une copie du match : { ok, card }
function rollout(m, uid, c, goal, seed) {
  const f = m.fork(seed);
  applyChoice(f, uid, c);
  const j = createJudge(f, uid, c, goal);
  for (let i = 0; i < 170; i++) {
    f.step();
    const r = j.check();
    if (r) return r;
  }
  return { ok: 0, card: 0 };
}

// Estimation progressive (découpée pour ne pas figer l'écran) : n simulations par option.
// Les mêmes graines servent pour toutes les options : la comparaison entre choix est juste.
export function createPredictor(m, uid, list, n = 24, type = null) {
  const items = list.map((c) => ({ c, goal: goalOf(c, type), ok: 0, card: 0, runs: 0 }));
  let k = 0;
  const total = items.length * n;
  return {
    items,
    done: () => k >= total,
    // avance pendant `budgetMs` millisecondes au plus
    work(budgetMs = 12) {
      const t0 = performance.now();
      while (k < total && performance.now() - t0 < budgetMs) {
        const it = items[k % items.length];
        const seed = `p${Math.floor(k / items.length)}`;
        let r;
        try { r = rollout(m, uid, it.c, it.goal, seed); } catch { r = { ok: 0, card: 0 }; }
        it.ok += r.ok; it.card += r.card; it.runs++;
        k++;
      }
      return k >= total;
    },
    // probabilité lissée (a priori faible) pour ne jamais afficher 0 % ou 100 % trop vite
    pct(it) { return it.runs ? (it.ok + 0.5) / (it.runs + 1) : null; },
  };
}

// Calcul complet d'un coup (tests, outils)
export function predictAll(m, uid, list, n = 24, type = null) {
  const p = createPredictor(m, uid, list, n, type);
  while (!p.work(1e9));
  return p.items.map((it) => ({ label: it.c.label, goal: it.goal.label, p: p.pct(it), card: it.runs ? it.card / it.runs : 0 }));
}

