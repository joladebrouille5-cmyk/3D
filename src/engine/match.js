// Moteur de match spatial à agents et événements (V1).
// Le score n'est jamais fixé à l'avance : il émerge des déplacements, des passes,
// des duels et des tirs résolus pas à pas. Le rendu ne touche jamais cet état.

import { Rng } from './rng.js';
import { PITCH, SIM, DEFAULT_COMPETITION, INSTRUCTION_OPTIONS } from './config.js';
import { buildSquad, FORMATIONS } from './teams.js';
import { clamp, dist, segDist, inBox, sigmoid } from './geom.js';
import { decideHolder, xgEstimate, pressureOn } from './decisions.js';
import { updateTeamShape, assignChasers, predictBall } from './movement.js';
import { runAIManager } from './manager.js';
import { pickTarget, canCross } from './control.js';

const LEVEL = { bas: 0.22, moyen: 0.5, haut: 0.78, patient: 0.22, 'équilibré': 0.5, direct: 0.78 };
export function tacticValues(t) {
  return { press: LEVEL[t.pressing], line: LEVEL[t.bloc], direct: LEVEL[t.style] };
}

let EVENT_ID = 0;

export class Match {
  constructor({ home, away, seed = 'graine', userTeam = 0, competition = DEFAULT_COMPETITION, aiTeams = null, delegateUser = false } = {}) {
    this.seed = String(seed);
    const hid = typeof home === 'string' ? home : home.def.id, aid = typeof away === 'string' ? away : away.def.id;
    this.rng = new Rng(`match:${hid}:${aid}:${this.seed}`);
    this.competition = competition;
    this.userTeam = userTeam; // 0, 1 ou null (observateur)
    this.aiTeams = aiTeams ?? [0, 1].filter((i) => i !== userTeam || delegateUser);
    this.tick = 0;
    this.t = 0;
    this.period = 1;
    this.periodTime = 0;
    this.added = [null, null];
    this.stoppage = [0, 0];
    this.phase = 'dead';
    this.score = [0, 0];
    this.events = [];
    this.frames = [];
    this.commands = [];      // commandes en attente d'application
    this.commandLog = [];    // commandes appliquées (reproductibilité)
    this.players = [];
    this.teams = [home, away].map((id, idx) => this.#buildTeam(id, idx));
    this.ball = { x: 52.5, y: 34, z: 0, vx: 0, vy: 0, vz: 0, owner: null, lastTouch: null, lastTeam: null, pass: null, shot: null, cross: false, prevX: 52.5, prevY: 34 };
    this.restart = null;
    this.control = null; // pilotage direct : { id, dx, dy, sprint, buffer }
    this.nextChaseUpdate = 0;
    this.kickoffTeamFirstHalf = this.rng.chance(0.5) ? 0 : 1;
    this.#log('coup_envoi', null, `Coup d'envoi. ${this.teams[0].name} – ${this.teams[1].name}.`, { major: true });
    this.#setRestart('kickoff', this.kickoffTeamFirstHalf, 52.5, 34);
  }

  // ---------------------------------------------------------------- construction
  // `id` : identifiant d'une équipe de test, ou effectif déjà construit (carrière)
  #buildTeam(id, idx) {
    const squad = typeof id === 'string' ? buildSquad(id) : id;
    const slots = FORMATIONS[squad.def.formation];
    const tactics = { ...squad.def.tactics };
    const team = {
      idx, id: squad.def.id, def: squad.def, name: squad.def.name, short: squad.def.short, colors: squad.def.colors,
      formation: squad.def.formation, slots, dir: idx === 0 ? 1 : -1,
      tactics, tv: tacticValues(tactics), tvTarget: tacticValues(tactics),
      slotPlayer: [], bench: [], subsUsed: 0, windowsUsed: 0, windowOpenAt: -1,
      instructions: [], subRequests: [],
      stats: { possession: 0, passes: 0, passesOk: 0, shots: 0, onTarget: 0, xg: 0, goals: 0, corners: 0, fouls: 0, yellows: 0, reds: 0, offsides: 0, tackles: 0, saves: 0, crossesLeft: 0, crossesRight: 0 },
      shape: [],
    };
    const mk = (pl, onPitch, slot) => {
      const p = {
        id: this.players.length, team: idx, num: pl.num, name: pl.name, role: pl.role, attrs: pl.attrs,
        synthetic: !pl.real, real: !!pl.real, isUser: !!pl.isUser, slot, onPitch, used: onPitch, sentOff: false, injured: false, yellow: 0,
        x: -10, y: -10, vx: 0, vy: 0, fx: idx === 0 ? 1 : -1, fy: 0, energy: 1,
        tx: 0, ty: 0, urgency: 0.5, stunUntil: 0, nextDecision: 0, touchCooldown: 0, tackleCooldown: 0,
        runUntil: 0, carry: null, stats: { passes: 0, passesOk: 0, shots: 0, goals: 0, tackles: 0, distance: 0 },
      };
      this.players.push(p);
      return p;
    };
    squad.starters.forEach((pl, i) => { const p = mk(pl, true, i); team.slotPlayer[i] = p.id; });
    squad.bench.forEach((pl) => { const p = mk(pl, false, null); team.bench.push(p.id); });
    // positions initiales : dans sa moitié
    for (const pid of team.slotPlayer) {
      const p = this.players[pid];
      const s = slots[p.slot];
      const rel = s.role === 'GK' ? 0.03 : 0.12 + s.bx * 0.3;
      p.x = this.absX(team, rel); p.y = this.absY(team, s.by);
    }
    return team;
  }

  // ---------------------------------------------------------------- repères
  absX(team, rel) { return team.dir > 0 ? rel * PITCH.length : (1 - rel) * PITCH.length; }
  relX(team, x) { return team.dir > 0 ? x / PITCH.length : (PITCH.length - x) / PITCH.length; }
  absY(team, by) { return team.dir > 0 ? by * PITCH.width : (1 - by) * PITCH.width; }
  oppGoalX(team) { return team.dir > 0 ? PITCH.length : 0; }
  ownGoalX(team) { return team.dir > 0 ? 0 : PITCH.length; }
  onPitch(teamIdx) { return this.teams[teamIdx].slotPlayer.map((id) => (id == null ? null : this.players[id])).filter((p) => p && p.onPitch); }
  allOnPitch() { return this.players.filter((p) => p.onPitch); }
  gk(teamIdx) { return this.onPitch(teamIdx).find((p) => p.role === 'GK') || null; }
  minute() {
    const base = this.period === 1 ? 0 : 45;
    const m = this.periodTime / 60;
    if (m >= 45) return `${base + 45}+${Math.floor(m - 45) + 1}`;
    return `${Math.floor(base + m) + 1}`;
  }
  clock() {
    const base = (this.period === 1 ? 0 : 45) * 60 + this.periodTime;
    const mm = Math.floor(base / 60), ss = Math.floor(base % 60);
    return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  }
  maxSpeed(p) { return (6.0 + 3.0 * p.attrs.pace) * (0.78 + 0.22 * p.energy) * (p.injured ? 0.45 : 1); }

  // ---------------------------------------------------------------- journal
  #log(type, team, text, data = {}) {
    const ev = { id: ++EVENT_ID, seq: this.events.length, t: +this.t.toFixed(2), tick: this.tick, period: this.period, minute: this.minute(), type, team, text, frame: this.frames.length, ...data };
    this.events.push(ev);
    return ev;
  }
  log(type, team, text, data) { return this.#log(type, team, text, data); }

  // ---------------------------------------------------------------- commandes
  // Les commandes sont horodatées par pas de simulation et appliquées au début du pas.
  queueCommand(cmd) {
    const c = { ...cmd, tick: cmd.tick ?? this.tick };
    this.commands.push(c);
    this.commands.sort((a, b) => a.tick - b.tick);
    return c;
  }

  #applyCommands() {
    while (this.commands.length && this.commands[0].tick <= this.tick) {
      const c = this.commands.shift();
      this.commandLog.push({ ...c, appliedTick: this.tick });
      if (c.type === 'instruction') this.#transmitInstruction(c.team, c.changes, c.source);
      else if (c.type === 'cancelInstruction') this.#cancelInstruction(c.team, c.id);
      else if (c.type === 'sub') this.#requestSub(c.team, c.outId, c.inId, c.source);
      else if (c.type === 'cancelSub') this.#cancelSub(c.team, c.id);
      else if (c.type === 'control') this.#setControl(c.playerId, c.on);
      else if (c.type === 'ctrl') { if (this.control) { this.control.dx = clamp(c.dx || 0, -1, 1); this.control.dy = clamp(c.dy || 0, -1, 1); this.control.sprint = !!c.sprint; } }
      else if (c.type === 'act') this.#userAction(c.action, c.dx || 0, c.dy || 0);
    }
  }

  // ---------------------------------------------------------------- pilotage direct
  #setControl(playerId, on) {
    const p = this.players[playerId];
    if (!on || !p || p.role === 'GK') { this.control = null; return; } // gardien : piloté par l'IA dans ce lot
    this.control = { id: p.id, dx: 0, dy: 0, sprint: false, buffer: null, feedback: null };
    p.carry = null;
  }

  // Le joueur est-il réellement piloté à cet instant ? (pas pendant un arrêt de jeu)
  isControlled(p) {
    return !!this.control && this.control.id === p.id && p.onPitch && this.phase === 'play';
  }

  #feedback(text) { if (this.control) this.control.feedback = { text, t: this.t }; }

  #userAction(action, dx, dy) {
    const c = this.control;
    if (!c) return;
    const p = this.players[c.id];
    if (!p.onPitch || this.phase !== 'play') return;
    if (this.t < p.stunUntil) { this.#feedback('Déséquilibré'); return; }
    const b = this.ball;
    const hasBall = b.owner === p.id;
    if (!hasBall) {
      if (action === 'tackle') { this.#userTackle(p); return; }
      if (action === 'call') { p.callUntil = this.t + 2.5; this.#feedback('Tu demandes le ballon'); return; }
      // geste avec ballon demandé juste avant de le recevoir : court tampon, jamais transformé en tacle
      if (['pass', 'through', 'long', 'shoot'].includes(action)) c.buffer = { action, dx, dy, until: this.t + 0.45 };
      return;
    }
    c.buffer = null;
    if (action === 'shoot') {
      const team = this.teams[p.team];
      if (this.relX(team, p.x) < 0.45) { this.#feedback('Trop loin pour frapper'); return; }
      this.shoot(p, { aimDy: Math.abs(dy) > 0.3 ? dy : null });
      return;
    }
    if (action === 'long' && canCross(this, p)) {
      const team = this.teams[p.team];
      const gx = this.oppGoalX(team);
      this.pass(p, gx - team.dir * this.rng.range(7, 11), 34 + this.rng.range(-5, 5), { lofted: true, cross: true });
      return;
    }
    const kind = action === 'through' ? 'through' : action === 'long' ? 'long' : 'short';
    const tg = pickTarget(this, p, dx, dy, kind);
    if (!tg) { this.#feedback('Aucun partenaire'); return; }
    this.pass(p, tg.tx, tg.ty, { to: tg.player.id, lofted: tg.lofted, through: kind === 'through' });
  }

  #userTackle(p) {
    const b = this.ball;
    if (this.t < p.tackleCooldown) return;
    const h = b.owner != null ? this.players[b.owner] : null;
    if (!h || h.team === p.team || h.gkHolding) { this.#feedback('Personne à tacler'); return; }
    const d = dist(p.x, p.y, h.x, h.y);
    if (d > 2.2) { p.tackleCooldown = this.t + 0.5; this.#feedback('Trop loin'); return; }
    this.#duel(p, h);
  }

  // Validation pure (aucun effet) : utilisée par l'interface pour l'état « validée ».
  validateInstruction(teamIdx, changes) {
    const team = this.teams[teamIdx];
    if (this.phase === 'fulltime') return { ok: false, reason: 'Le match est terminé.' };
    const keys = Object.keys(changes || {});
    if (!keys.length) return { ok: false, reason: 'Aucune modification dans le projet.' };
    for (const k of keys) {
      if (!INSTRUCTION_OPTIONS[k] || !INSTRUCTION_OPTIONS[k].includes(changes[k])) return { ok: false, reason: `Valeur invalide pour ${k}.` };
    }
    const pending = team.instructions.filter((i) => i.status === 'transmise');
    if (pending.length >= 3) return { ok: false, reason: 'File pleine : trois changements prioritaires déjà en attente.' };
    const effective = { ...team.tactics };
    for (const i of pending) Object.assign(effective, i.changes);
    if (keys.every((k) => effective[k] === changes[k])) return { ok: false, reason: 'Ce projet ne change rien à la tactique active ou déjà transmise.' };
    return { ok: true };
  }

  #transmitInstruction(teamIdx, changes, source = 'manager') {
    const team = this.teams[teamIdx];
    const v = this.validateInstruction(teamIdx, changes);
    const ins = { id: `${teamIdx}-${team.instructions.length + 1}`, changes: { ...changes }, status: v.ok ? 'transmise' : 'rejetée', reason: v.reason || null, history: [{ status: v.ok ? 'transmise' : 'rejetée', t: this.t }], source, transmittedAt: this.t };
    team.instructions.push(ins);
    const desc = Object.entries(changes).map(([k, val]) => `${k} ${val}`).join(', ');
    this.#log('consigne', teamIdx, v.ok ? `${team.short} : consigne transmise (${desc}).` : `${team.short} : consigne rejetée — ${v.reason}`, { instruction: ins.id, status: ins.status, hidden: teamIdx !== this.userTeam });
    return ins;
  }

  #cancelInstruction(teamIdx, id) {
    const ins = this.teams[teamIdx].instructions.find((i) => i.id === id);
    if (!ins) return;
    if (ins.status !== 'transmise') {
      this.#log('consigne', teamIdx, `Annulation impossible : la consigne est déjà ${ins.status}. Envoyez une nouvelle instruction.`, { hidden: teamIdx !== this.userTeam });
      return;
    }
    ins.status = 'annulée'; ins.history.push({ status: 'annulée', t: this.t });
    this.#log('consigne', teamIdx, `Consigne annulée avant sa prise en charge.`, { instruction: id, status: 'annulée', hidden: teamIdx !== this.userTeam });
  }

  #activatePendingInstructions(teamIdx, reason) {
    const team = this.teams[teamIdx];
    for (const ins of team.instructions) {
      if (ins.status !== 'transmise') continue;
      ins.status = 'active'; ins.history.push({ status: 'active', t: this.t, reason });
      for (const ins2 of team.instructions) if (ins2 !== ins && ins2.status === 'active' && Object.keys(ins2.changes).every((k) => k in ins.changes)) { ins2.status = 'remplacée'; }
      Object.assign(team.tactics, ins.changes);
      team.tvTarget = tacticValues(team.tactics);
      this.#log('consigne', teamIdx, `${team.short} : consigne active (${reason}).`, { instruction: ins.id, status: 'active', hidden: teamIdx !== this.userTeam });
    }
  }

  validateSub(teamIdx, outId, inId) {
    const team = this.teams[teamIdx];
    const comp = this.competition;
    const out = this.players[outId], inn = this.players[inId];
    if (this.phase === 'fulltime') return { ok: false, reason: 'Le match est terminé.' };
    if (!out || out.team !== teamIdx || !out.onPitch) return { ok: false, reason: 'Le joueur sortant n\'est pas sur le terrain.' };
    if (!inn || inn.team !== teamIdx || !team.bench.includes(inId)) return { ok: false, reason: 'Le joueur entrant n\'est pas sur le banc.' };
    if (inn.used) return { ok: false, reason: `${inn.name} a déjà participé à la rencontre et n'est plus éligible.` };
    const pending = team.subRequests.filter((r) => r.status === 'demandé');
    if (pending.some((r) => r.inId === inId)) return { ok: false, reason: `${inn.name} est déjà prévu dans une demande.` };
    if (pending.some((r) => r.outId === outId)) return { ok: false, reason: `${out.name} est déjà prévu dans une demande.` };
    if (team.subsUsed + pending.length >= comp.maxSubs) return { ok: false, reason: `Limite de ${comp.maxSubs} remplacements atteinte (configuration de compétition).` };
    if (team.windowsUsed >= comp.maxSubWindows && this.phase !== 'halftime' && !pending.length) return { ok: false, reason: `Plus aucune fenêtre de remplacement disponible (${comp.maxSubWindows} utilisées).` };
    return { ok: true };
  }

  #requestSub(teamIdx, outId, inId, source = 'manager') {
    const team = this.teams[teamIdx];
    const v = this.validateSub(teamIdx, outId, inId);
    const req = { id: `${teamIdx}-s${team.subRequests.length + 1}`, outId, inId, status: v.ok ? 'demandé' : 'rejeté', reason: v.reason || null, t: this.t, source };
    team.subRequests.push(req);
    const out = this.players[outId], inn = this.players[inId];
    this.#log('remplacement', teamIdx, v.ok ? `${team.short} : remplacement demandé, ${inn?.name} pour ${out?.name}.` : `${team.short} : remplacement refusé — ${v.reason}`, { request: req.id, status: req.status, hidden: teamIdx !== this.userTeam && !v.ok });
    return req;
  }

  #cancelSub(teamIdx, id) {
    const req = this.teams[teamIdx].subRequests.find((r) => r.id === id);
    if (!req) return;
    if (req.status !== 'demandé') {
      this.#log('remplacement', teamIdx, `Annulation impossible : le remplacement est déjà ${req.status}. Le retour dans le passé n'existe pas ; un nouveau changement reste possible s'il en reste.`, { hidden: teamIdx !== this.userTeam });
      return;
    }
    req.status = 'annulé';
    this.#log('remplacement', teamIdx, `Demande de remplacement annulée.`, { request: id, status: 'annulé', hidden: teamIdx !== this.userTeam });
  }

  #executeSubs(teamIdx, atHalftime) {
    const team = this.teams[teamIdx];
    const pending = team.subRequests.filter((r) => r.status === 'demandé');
    if (!pending.length) return;
    let done = 0;
    for (const req of pending) {
      const out = this.players[req.outId], inn = this.players[req.inId];
      if (!out.onPitch || inn.used || team.subsUsed >= this.competition.maxSubs) {
        req.status = 'rejeté'; req.reason = 'Conditions changées depuis la demande (joueur indisponible ou limite atteinte).';
        this.#log('remplacement', teamIdx, `${team.short} : remplacement annulé par l'arbitre — ${req.reason}`, { request: req.id, status: 'rejeté' });
        continue;
      }
      if (!atHalftime && team.windowsUsed >= this.competition.maxSubWindows && team.windowOpenAt !== this.tick) {
        req.status = 'rejeté'; req.reason = 'Plus aucune fenêtre de remplacement.';
        this.#log('remplacement', teamIdx, `${team.short} : remplacement refusé — ${req.reason}`, { request: req.id, status: 'rejeté' });
        continue;
      }
      const slot = out.slot;
      out.onPitch = false; out.slot = null;
      inn.onPitch = true; inn.used = true; inn.slot = slot; inn.enteredAt = this.t;
      // L'entrant arrive par la ligne de touche, il n'est pas téléporté à son poste.
      inn.x = 52.5 + (teamIdx === 0 ? -3 : 3); inn.y = out.y < 34 ? 0.5 : 67.5; inn.vx = inn.vy = 0;
      out.x = -20; out.y = -20;
      team.slotPlayer[slot] = inn.id;
      team.bench = team.bench.filter((id) => id !== inn.id);
      team.subsUsed++;
      req.status = 'effectué'; req.doneAt = this.t;
      done++;
      this.stoppage[this.period - 1] += 20;
      this.#log('remplacement', teamIdx, `${team.short} : remplacement effectué, entrée de ${inn.name} (n° ${inn.num}) à la place de ${out.name} (n° ${out.num}).`, { request: req.id, status: 'effectué', major: true, inId: inn.id, outId: out.id });
    }
    if (done && !atHalftime && team.windowOpenAt !== this.tick) { team.windowsUsed++; team.windowOpenAt = this.tick; }
  }

  // ---------------------------------------------------------------- arrêts de jeu
  #setRestart(type, team, x, y, extra = {}) {
    const b = this.ball;
    if (this.phase === 'play') this.stopAt = this.t;
    this.phase = 'dead';
    b.owner = null; b.pass = null; b.shot = null; b.cross = false;
    b.x = clamp(x, 0, PITCH.length); b.y = clamp(y, 0, PITCH.width); b.z = 0; b.vx = b.vy = b.vz = 0;
    b.prevX = b.x; b.prevY = b.y;
    const minDelay = { kickoff: 4, throw: 3, goalkick: 5, corner: 6, freekick: 5, penalty: 8, dropball: 3 }[type] ?? 4;
    this.restart = { type, team, x: b.x, y: b.y, readyAt: this.t + minDelay + this.rng.range(0, 2.5), taker: this.#chooseTaker(type, team, b.x, b.y), started: this.t, ...extra };
    for (const p of this.allOnPitch()) { p.carry = null; p.runUntil = 0; }
    // Les remplacements demandés sont exécutés au premier arrêt de jeu.
    if (type !== 'kickoff' || this.t > 0) for (const i of [0, 1]) this.#executeSubs(i, false);
    for (const i of [0, 1]) this.#activatePendingInstructions(i, 'arrêt de jeu');
  }

  #chooseTaker(type, teamIdx, x, y) {
    const pl = this.onPitch(teamIdx);
    if (!pl.length) return null;
    const out = pl.filter((p) => p.role !== 'GK' && !p.injured);
    if (!out.length) return pl[0].id;
    if (type === 'goalkick') return (this.gk(teamIdx) || pl[0]).id;
    if (type === 'penalty' || (type === 'freekick' && this.restart?.direct)) return [...out].sort((a, b) => b.attrs.shooting - a.attrs.shooting)[0].id;
    if (type === 'corner') return [...out].sort((a, b) => (b.attrs.passing + (b.role === 'W' || b.role === 'AM' ? 0.1 : 0)) - (a.attrs.passing + (a.role === 'W' || a.role === 'AM' ? 0.1 : 0)))[0].id;
    if (type === 'kickoff') return (out.find((p) => p.role === 'ST') || out[out.length - 1]).id;
    if (type === 'freekick' && this.relX(this.teams[teamIdx], x) < 0.2) return (this.gk(teamIdx) || out[0]).id;
    let best = null, bd = Infinity;
    for (const p of out) { const d = dist(p.x, p.y, x, y); if (d < bd) { bd = d; best = p; } }
    return (best || pl[0]).id;
  }

  #doRestart() {
    const r = this.restart;
    const taker = this.players[r.taker];
    const b = this.ball;
    this.phase = 'play';
    const deadDur = this.t - (this.stopAt ?? this.t);
    if (r.type === 'goal' || r.type === 'kickoff') { /* comptabilisé à l'événement */ }
    else if (deadDur > 12) this.stoppage[this.period - 1] += (deadDur - 12) * 0.5;
    this.restart = null;
    b.x = r.x; b.y = r.y; b.owner = taker.id; b.lastTouch = taker.id; b.lastTeam = taker.team;
    taker.x = r.x - this.teams[taker.team].dir * 0.4; taker.y = r.y;
    taker.nextDecision = this.t;
    taker.gotBallAt = this.t;
    this.restartDirect = !!r.direct;
    decideHolder(this, taker, r.type);
    this.restartDirect = false;
  }

  // ---------------------------------------------------------------- boucle
  step() {
    if (this.phase === 'fulltime') return false;
    this.#applyCommands();
    const dt = SIM.dt;

    if (this.phase === 'dead' && this.restart) {
      const r = this.restart;
      const taker = this.players[r.taker];
      if (!taker || !taker.onPitch) r.taker = this.#chooseTaker(r.type, r.team, r.x, r.y);
      const tk = this.players[r.taker];
      const ready = this.t >= r.readyAt && tk && dist(tk.x, tk.y, r.x, r.y) < 1.6 && (r.type !== 'kickoff' || this.#kickoffReady(r.team));
      if (ready || this.t > r.readyAt + 25) this.#doRestart();
    }

    if (this.tick % Math.round(SIM.tacticalStep / dt) === 0) this.#tacticalUpdate();
    if (this.phase === 'play' && this.ball.owner == null && this.t >= this.nextChaseUpdate) { assignChasers(this); this.nextChaseUpdate = this.t + 0.2; }
    if (this.ball.shot) this.#trackShotGK();

    // décision du porteur
    if (this.phase === 'play' && this.ball.owner != null) {
      const h = this.players[this.ball.owner];
      if (this.isControlled(h)) {
        // geste demandé juste avant la réception
        const buf = this.control.buffer;
        if (buf) { this.control.buffer = null; if (this.t <= buf.until && this.t >= h.touchCooldown) this.#userAction(buf.action, buf.dx, buf.dy); }
      } else if (this.t >= h.nextDecision) decideHolder(this, h, null);
    }

    if (this.phase === 'play') { this.#updatePressers(); this.#defensiveDuels(dt); }
    this.#movePlayers(dt);
    this.#moveBall(dt);
    if (this.phase === 'play') {
      this.#contacts();
      this.#checkBounds();
    }

    // possession
    if (this.ball.owner != null) this.teams[this.players[this.ball.owner].team].stats.possession++;
    else if (this.ball.lastTeam != null && this.phase === 'play') this.teams[this.ball.lastTeam].stats.possession += 0.5;

    // horloge
    this.t += dt; this.periodTime += dt; this.tick++;
    this.#clockChecks();

    if (this.tick % SIM.frameEvery === 0) this.#recordFrame();
    return this.phase !== 'fulltime';
  }

  // Le gardien suit la trajectoire d'un tir à chaque pas, après un temps de réaction.
  #trackShotGK() {
    const b = this.ball;
    const g = this.gk(1 - b.shot.team);
    if (!g || this.t - b.shot.t0 < 0.15) return;
    const pred = predictBall(b, 20);
    let best = pred[pred.length - 1];
    for (const q of pred) if (Math.abs(q.x - g.x) < Math.abs(best.x - g.x)) best = q;
    g.tx = best.x; g.ty = best.y; g.urgency = 1; g.chaseUntil = this.t + 0.2;
  }

  #kickoffReady(teamIdx) {
    for (const p of this.allOnPitch()) {
      const rel = this.relX(this.teams[p.team], p.x);
      if (rel > 0.5 && p.id !== this.restart.taker) return false;
    }
    return true;
  }

  #clockChecks() {
    const pi = this.period - 1;
    if (this.added[pi] == null && this.periodTime >= SIM.halfLength - 1) {
      const add = clamp(Math.ceil(this.stoppage[pi] / 60), this.period === 1 ? 1 : 2, 9);
      this.added[pi] = add;
      this.#log('temps_additionnel', null, `Temps additionnel indiqué : ${add} min (interruptions retenues par le modèle).`, { major: true });
    }
    if (this.added[pi] != null && this.periodTime >= SIM.halfLength + this.added[pi] * 60) {
      if (this.ball.shot) return; // on ne siffle pas pendant un tir en vol
      if (this.period === 1) this.#halftime();
      else this.#fulltime();
    }
  }

  #halftime() {
    this.#log('mi_temps', null, `Mi-temps : ${this.teams[0].short} ${this.score[0]} – ${this.score[1]} ${this.teams[1].short}.`, { major: true, pause: true });
    this.phase = 'halftime';
    this.period = 2; this.periodTime = 0;
    for (const t of this.teams) t.dir *= -1;
    for (const i of [0, 1]) { this.#executeSubs(i, true); this.#activatePendingInstructions(i, 'mi-temps'); }
    for (const p of this.allOnPitch()) { p.energy = Math.min(1, p.energy + 0.08); p.x = PITCH.length - p.x; p.y = PITCH.width - p.y; p.vx = p.vy = 0; }
    for (const i of [0, 1]) runAIManager(this, i, true);
    this.phase = 'dead';
    this.#setRestart('kickoff', 1 - this.kickoffTeamFirstHalf, 52.5, 34);
  }

  #fulltime() {
    this.phase = 'fulltime';
    for (const team of this.teams) for (const ins of team.instructions) if (ins.status === 'transmise') { ins.status = 'expirée'; ins.history.push({ status: 'expirée', t: this.t }); }
    for (const team of this.teams) for (const r of team.subRequests) if (r.status === 'demandé') r.status = 'expiré';
    this.#log('fin', null, `Fin du match : ${this.teams[0].name} ${this.score[0]} – ${this.score[1]} ${this.teams[1].name}.`, { major: true, pause: true });
    this.#recordFrame();
  }

  #tacticalUpdate() {
    for (const team of this.teams) {
      // adaptation progressive, jamais instantanée
      for (const k of ['press', 'line', 'direct']) {
        const d = team.tvTarget[k] - team.tv[k];
        team.tv[k] += clamp(d, -SIM.tacticalStep / 20, SIM.tacticalStep / 20);
      }
      // activation d'une consigne transmise : prise en charge après ~25 s si aucun arrêt
      for (const ins of team.instructions) if (ins.status === 'transmise' && this.t - ins.transmittedAt >= 25) this.#activatePendingInstructions(team.idx, 'consigne relayée sur le terrain');
      updateTeamShape(this, team);
    }
    if (this.tick % 600 === 0 && this.phase === 'play') for (const i of [0, 1]) runAIManager(this, i, false);
  }

  // ---------------------------------------------------------------- déplacements
  #movePlayers(dt) {
    const b = this.ball;
    for (const p of this.players) {
      if (!p.onPitch) continue;
      let tx = p.tx, ty = p.ty, urg = p.urgency;
      if (b.owner === p.id) {
        if (p.carry) { tx = p.x + p.carry.dx * 6; ty = p.y + p.carry.dy * 6; urg = p.carry.speed; }
        else { tx = p.x; ty = p.y; urg = 0.2; }
      }
      if (this.control && this.control.id === p.id && this.isControlled(p)) {
        // pilotage direct : l'entrée fixe l'intention de course (inertie et capacités inchangées)
        const c = this.control;
        const mag = Math.hypot(c.dx, c.dy);
        if (mag > 0.15) { tx = p.x + (c.dx / mag) * 6; ty = p.y + (c.dy / mag) * 6; urg = c.sprint ? 1 : 0.5 + 0.25 * Math.min(1, mag); p.carry = null; }
        else if (b.owner === p.id) { tx = p.x; ty = p.y; urg = 0.2; p.carry = null; }
        // sans entrée et sans ballon : placement assisté (cible de l'organisation collective)
      }
      const stunned = this.t < p.stunUntil;
      let vmax = this.maxSpeed(p) * (stunned ? 0.3 : 1);
      if (b.owner === p.id) {
        vmax *= 0.82 + 0.1 * p.attrs.dribbling;
        // un adversaire placé devant ferme le passage : on ne traverse pas les corps
        for (const o of this.players) {
          if (!o.onPitch || o.team === p.team || this.t < o.stunUntil) continue;
          const ox = o.x - p.x, oy = o.y - p.y;
          const od = Math.hypot(ox, oy);
          if (od < 1.3 && (ox * (tx - p.x) + oy * (ty - p.y)) > 0) vmax *= 0.45;
        }
      }
      const dx = tx - p.x, dy = ty - p.y;
      const d = Math.hypot(dx, dy);
      let desired = 0;
      if (d > 0.3) desired = Math.min(vmax * clamp(urg, 0.15, 1), d * 1.4);
      const dvx = (d > 1e-6 ? dx / d : 0) * desired - p.vx;
      const dvy = (d > 1e-6 ? dy / d : 0) * desired - p.vy;
      const acc = (2.6 + 3.6 * p.attrs.accel) * (0.75 + 0.25 * p.energy) * dt;
      const dv = Math.hypot(dvx, dvy);
      const k = dv > acc ? acc / dv : 1;
      p.vx += dvx * k; p.vy += dvy * k;
      p.x = clamp(p.x + p.vx * dt, -3, PITCH.length + 3);
      p.y = clamp(p.y + p.vy * dt, -3, PITCH.width + 3);
      const sp = Math.hypot(p.vx, p.vy);
      if (sp > 0.4) { p.fx = p.vx / sp; p.fy = p.vy / sp; }
      p.stats.distance += sp * dt;
      // énergie : effort et récupération partielle, plafond de fatigue de fond
      const drain = (0.000028 + 0.00011 * (sp / 4) * (sp / 4)) * (1.45 - p.attrs.stamina) * dt;
      const cap = 1 - 0.18 * (this.t / 5400) * (1.3 - p.attrs.stamina);
      if (sp < 2.2) p.energy = Math.min(cap, p.energy + 0.0011 * dt);
      p.energy = Math.max(0.15, p.energy - drain);
    }
  }

  #moveBall(dt) {
    const b = this.ball;
    b.prevX = b.x; b.prevY = b.y;
    if (b.owner != null) {
      const o = this.players[b.owner];
      b.x = o.x + o.fx * 0.45; b.y = o.y + o.fy * 0.45; b.z = 0; b.vx = o.vx; b.vy = o.vy; b.vz = 0;
      return;
    }
    if (this.phase !== 'play') return;
    if (b.z > 0 || b.vz > 0) {
      b.vz -= SIM.gravity * dt;
      const drag = 1 - SIM.airDrag * dt;
      b.vx *= drag; b.vy *= drag;
      b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
      if (b.z <= 0) {
        b.z = 0;
        if (b.vz < -2.2) { b.vz = -b.vz * 0.45; b.vx *= 0.78; b.vy *= 0.78; } else b.vz = 0;
      }
    } else {
      const s = Math.hypot(b.vx, b.vy);
      if (s > 0) {
        const ns = Math.max(0, s - SIM.rollDecel * dt);
        b.vx *= ns / s; b.vy *= ns / s;
      }
      b.x += b.vx * dt; b.y += b.vy * dt;
    }
  }

  // ---------------------------------------------------------------- contacts
  #contacts() {
    const b = this.ball;
    if (b.owner != null) return;
    const cands = [];
    // départ du ballon protégé : un contre au départ est résolu dans pass()/shoot()
    const fresh = (b.pass && this.t - b.pass.t0 < 0.15) || (b.shot && this.t - b.shot.t0 < 0.12);
    for (const p of this.players) {
      if (!p.onPitch || this.t < p.touchCooldown || this.t < p.stunUntil) continue;
      if (fresh) continue;
      const isGK = p.role === 'GK';
      const hands = isGK && inBox(p.x, p.y, this.ownGoalX(this.teams[p.team])) && !(b.pass && b.pass.team === p.team && b.pass.type !== 'header');
      let reach;
      if (b.z < 0.7) reach = hands ? 1.3 : b.pass && b.pass.to === p.id ? 1.0 : b.pass && b.pass.team !== p.team ? 0.75 : 0.9;
      else if (b.z < 2.5) reach = hands ? 1.6 : 1.0;
      else if (hands && b.z < 2.9) reach = 1.4;
      else continue;
      if (hands && b.shot) {
        const since = this.t - b.shot.t0;
        reach = 1.2 + 3.1 * p.attrs.gk * clamp((since - 0.1) / 0.45, 0.35, 1) + 1.4 * clamp((since - 0.55) / 0.5, 0, 1);
      }
      const { d, s } = segDist(p.x, p.y, b.prevX, b.prevY, b.x, b.y);
      // sur un tir, le gardien intervient au point de passage le plus proche
      if (hands && b.shot && s >= 0.999 && b.x > 0 && b.x < PITCH.length) continue;
      // le gardien laisse filer une frappe qu'il lit hors cadre
      if (hands && b.shot && !b.shot.onTarget && !b.shot.gkMisread) continue;
      if (d <= reach) cands.push({ p, d, reach, hands });
    }
    if (!cands.length) return;
    let win;
    if (cands.length === 1) win = cands[0];
    else {
      const aerial = b.z >= 0.7;
      const w = cands.map((c) => {
        const a = c.p.attrs;
        const skill = c.hands ? 0.9 + a.gk : aerial ? 0.4 + a.aerial + 0.3 * a.positioning : 0.5 + 0.5 * a.positioning + 0.5 * a.accel;
        const intended = b.pass && b.pass.to === c.p.id ? 1.3 : 1;
        return skill * intended * (1.25 - c.d / c.reach);
      });
      win = cands[this.rng.weighted(w)];
      for (const c of cands) if (c !== win) c.p.touchCooldown = this.t + 0.5;
    }
    this.#resolveTouch(win.p, win.d, win.reach, win.hands);
  }

  #resolveTouch(p, d, reach, hands) {
    const b = this.ball;
    const team = this.teams[p.team];
    const speed = Math.hypot(b.vx, b.vy, b.vz);
    const pass = b.pass, shot = b.shot;

    // hors-jeu : premier contact d'un partenaire signalé au départ de la passe
    if (pass && pass.team === p.team && pass.offside && pass.offside[p.id] != null) {
      const margin = pass.offside[p.id];
      const flagged = this.rng.chance(margin > 1 ? 0.98 : margin > 0.4 ? 0.85 : 0.6);
      if (flagged) {
        team.stats.offsides++;
        this.#log('hors_jeu', p.team, `Hors-jeu de ${p.name} (${team.short}).`, { player: p.id });
        this.#setRestart('freekick', 1 - p.team, pass.offsidePos[p.id].x, pass.offsidePos[p.id].y);
        return;
      }
    }

    // gardien sur un tir : arrêt possible, pas garanti
    if (hands && shot && shot.team !== p.team) {
      const pSave = clamp(1.11 - (d / reach) * 0.32 - Math.max(0, speed - 20) * 0.01 + 0.15 * (p.attrs.gk - 0.6), 0.05, 0.97);
      if (this.rng.chance(pSave)) {
        this.teams[p.team].stats.saves++;
        const shooter = this.players[shot.by];
        const catchIt = speed < 21 && d < reach * 0.6 && this.rng.chance(0.35 + 0.5 * p.attrs.gk);
        shot.resolved = true;
        this.#log('arret', p.team, `Arrêt de ${p.name} sur la frappe de ${shooter.name}${catchIt ? ' (captée)' : ''}.`, { player: p.id, major: true });
        b.lastShot = { by: shot.by, team: shot.team, t: this.t };
        b.shot = null; b.pass = null; b.cross = false;
        if (catchIt) { this.#gainBall(p, true); return; }
        // parade : repoussée vers l'extérieur (côté ou par-dessus), nouvelle situation ouverte
        const out = this.teams[p.team].dir > 0 ? 0 : Math.PI;
        const side = b.y === 34 ? (this.rng.chance(0.5) ? 1 : -1) : Math.sign(b.y - 34);
        const ang = out + side * (this.teams[p.team].dir > 0 ? 1 : -1) * this.rng.range(0.35, 1.45);
        const s = this.rng.range(5, 11);
        b.vx = Math.cos(ang) * s; b.vy = Math.sin(ang) * s; b.vz = this.rng.range(0.5, 4);
        if (b.z > 1.7 && this.rng.chance(0.6)) { b.vx = -Math.cos(out) * 3; b.vy = side * 2; b.z = 2.7; b.vz = 5; } // claquée au-dessus (nettement)
        else if (this.rng.chance(0.45)) {
          // détournée en corner : le ballon file vers la ligne de but, à l'extérieur des poteaux
          const gx = this.ownGoalX(this.teams[p.team]);
          const vy = side * this.rng.range(6, 9), vx = Math.sign(gx - p.x || -Math.cos(out)) * this.rng.range(1.5, 3);
          b.vx = vx; b.vy = vy; b.z = 0.3; b.vz = 1.5;
          const tCross = Math.abs((gx - b.x) / vx);
          const yCross = b.y + vy * tCross;
          if (Math.abs(yCross - 34) < PITCH.goalWidth / 2 + 0.6) { b.z = 2.7; b.vz = 5; } // sinon par-dessus
        }
        b.lastTouch = p.id; b.lastTeam = p.team;
        p.touchCooldown = this.t + 0.6;
        return;
      }
      p.touchCooldown = this.t + 1.0; // battu
      return;
    }

    if (hands) {
      // gardien sur un centre ou ballon libre dans sa surface
      const pCatch = clamp(0.55 + 0.45 * p.attrs.gk - (b.z > 2 ? 0.15 : 0) - Math.max(0, speed - 14) * 0.02, 0.2, 0.97);
      if (this.rng.chance(pCatch)) { this.#gainBall(p, true); return; }
      this.#deflect(p, 0.4, 1.4);
      return;
    }

    if (shot && shot.team !== p.team) {
      // contre d'un défenseur
      shot.blocked = true;
      b.lastShot = { by: shot.by, team: shot.team, t: this.t };
      this.#log('contre', p.team, `Frappe contrée par ${p.name}.`, { player: p.id });
      b.shot = null;
      this.#deflect(p, 0.35, 1.2);
      // une frappe contrée file souvent derrière la ligne de but
      if (this.rng.chance(0.4)) { const gx = this.ownGoalX(team); const sp = Math.hypot(b.vx, b.vy) || 6; b.vx = Math.sign(gx - p.x || 1) * sp * 0.8; b.vy = (b.y < 34 ? -1 : 1) * sp * 0.4; }
      return;
    }

    if (b.z >= 0.7) {
      // jeu de tête
      const goalX = this.oppGoalX(team);
      const dGoal = dist(p.x, p.y, goalX, 34);
      if (b.cross && dGoal < 15 && this.rng.chance(0.75)) { this.#header(p, true); return; }
      const ownGoalX = this.ownGoalX(team);
      if (dist(p.x, p.y, ownGoalX, 34) < 30) { this.#header(p, false); return; }
      if (this.rng.chance(0.45 + 0.4 * p.attrs.firstTouch * (b.z < 1.5 ? 1 : 0.6))) { this.#gainBall(p, false, pass); return; }
      this.#header(p, false);
      return;
    }

    // près de son but, sur un ballon adverse ou libre : on dégage plutôt que de contrôler
    const ownGx = this.ownGoalX(team);
    if (dist(p.x, p.y, ownGx, 34) < 22 && !(pass && pass.team === p.team) && p.role !== 'GK') {
      const pr0 = pressureOn(this, p);
      if (pr0 > 0.25 || this.rng.chance(0.5)) {
        if (this.rng.chance(0.82 + 0.1 * p.attrs.positioning)) { this.#clearance(p); return; }
        this.#deflect(p, 0.2, 0.8);
        return;
      }
    }

    // contrôle au sol
    const pr = pressureOn(this, p);
    const intended = pass && pass.to === p.id;
    let pCtrl = 0.66 + 0.33 * p.attrs.firstTouch - Math.max(0, speed - 9) * 0.03 - pr * 0.1 + (intended ? 0.08 : -0.06) + (d < 0.5 ? 0.03 : 0);
    if (pass && pass.lofted) pCtrl -= 0.06;
    if (pass && pass.type === 'through') pCtrl -= 0.1;
    if (p.role === 'GK' && pass && pass.team === p.team) pCtrl = Math.max(pCtrl, 0.97); // gardien sur passe d'un partenaire
    pCtrl = clamp(pCtrl * (0.88 + 0.12 * p.energy), 0.12, 0.97);
    if (this.rng.chance(pCtrl)) this.#gainBall(p, false, pass);
    else this.#deflect(p, 0.25, 0.9);
  }

  #gainBall(p, gkHands, pass) {
    const b = this.ball;
    const prevTeam = b.lastTeam;
    if (pass) {
      const passer = this.players[pass.from];
      if (pass.team === p.team && pass.from !== p.id) { this.teams[p.team].stats.passesOk++; passer.stats.passesOk++; }
    }
    b.owner = p.id; b.lastTouch = p.id; b.lastTeam = p.team; b.pass = null; b.shot = null; b.cross = false;
    b.vx = b.vy = b.vz = 0; b.z = 0;
    for (const q of this.players) q.carry = null;
    const pr = pressureOn(this, p);
    p.nextDecision = this.t + (gkHands ? this.rng.range(1.5, 4) : clamp(1.15 - 0.35 * p.attrs.decisions - 0.45 * pr + this.rng.range(0, 0.6), 0.3, 1.7));
    p.gkHolding = !!gkHands;
    p.gotBallAt = this.t;
    if (prevTeam != null && prevTeam !== p.team) p.wonAt = this.t;
  }

  // Dégagement : loin du but, vers l'extérieur et vers l'avant.
  #clearance(p) {
    const b = this.ball;
    const team = this.teams[p.team];
    const fwd = team.dir > 0 ? 0 : Math.PI;
    const side = p.y < 34 ? -1 : 1;
    let ang = fwd + side * (team.dir > 0 ? 1 : -1) * this.rng.range(0.1, 0.9);
    // sous pression près du but : on dégage où l'on peut, souvent en touche ou en corner
    const ownGX = this.ownGoalX(team);
    const nearGoal = Math.abs(p.x - ownGX) < 14;
    if (nearGoal && this.rng.chance(0.5)) ang = (team.dir > 0 ? Math.PI : 0) + side * (team.dir > 0 ? -1 : 1) * this.rng.range(0.5, 1.1);
    else if (this.rng.chance(0.15)) ang = side * Math.PI / 2 + this.rng.gauss(0, 0.3);
    const s = this.rng.range(14, 22);
    b.vx = Math.cos(ang) * s; b.vy = Math.sin(ang) * s; b.vz = this.rng.range(4, 8); b.z = Math.max(b.z, 0.2);
    b.lastTouch = p.id; b.lastTeam = p.team; b.pass = { from: p.id, to: null, team: p.team, type: 'clearance', lofted: true, t0: this.t }; b.cross = false; b.shot = null;
    p.touchCooldown = this.t + 0.5;
    this.nextChaseUpdate = 0;
  }

  #deflect(p, sMin, sMax) {
    const b = this.ball;
    const s = Math.hypot(b.vx, b.vy) * this.rng.range(sMin, sMax * 0.6) + this.rng.range(1, 3);
    const ang = Math.atan2(b.vy, b.vx) + this.rng.gauss(0, 0.7);
    b.vx = Math.cos(ang) * s; b.vy = Math.sin(ang) * s;
    b.vz = b.z > 0.7 ? this.rng.range(0, 3) : this.rng.chance(0.2) ? this.rng.range(1, 4) : 0;
    b.lastTouch = p.id; b.lastTeam = p.team; b.pass = null; b.cross = false;
    p.touchCooldown = this.t + 0.5;
  }

  #header(p, atGoal) {
    const b = this.ball;
    const team = this.teams[p.team];
    b.lastTouch = p.id; b.lastTeam = p.team; b.cross = false;
    p.touchCooldown = this.t + 0.5;
    if (atGoal) {
      this.shoot(p, { header: true });
      return;
    }
    // dégagement ou déviation de la tête
    const ang = (team.dir > 0 ? 0 : Math.PI) + this.rng.gauss(0, 0.6);
    const s = this.rng.range(8, 15) * (0.6 + 0.5 * p.attrs.aerial);
    b.vx = Math.cos(ang) * s; b.vy = Math.sin(ang) * s; b.vz = this.rng.range(2, 6);
    b.pass = { from: p.id, to: null, team: p.team, type: 'header', t0: this.t };
  }

  // ---------------------------------------------------------------- gestes du porteur (appelés par decisions.js)
  pass(p, tx, ty, opts = {}) {
    const b = this.ball;
    const team = this.teams[p.team];
    const pr = pressureOn(this, p);
    const fatigue = 1 + 0.5 * (1 - p.energy);
    const d0 = dist(p.x, p.y, tx, ty);
    const angErr = this.rng.gauss(0, (0.018 + 0.07 * (1 - p.attrs.passing) + 0.05 * pr + (opts.lofted ? 0.02 : 0) + (opts.through ? 0.04 : 0)) * fatigue);
    const powErr = 1 + this.rng.gauss(0, (0.05 + 0.08 * (1 - p.attrs.passing)) * fatigue);
    const base = Math.atan2(ty - p.y, tx - p.x) + angErr;
    const d = Math.max(2, d0 * powErr);
    // hors-jeu : position des partenaires au départ du ballon
    const offside = {}, offsidePos = {};
    const oppPlayers = this.onPitch(1 - p.team);
    const rels = oppPlayers.map((o) => this.relX(team, o.x)).sort((a, c) => c - a);
    const line = Math.max(rels[1] ?? 0, this.relX(team, b.x), 0.5);
    let any = false;
    for (const q of this.onPitch(p.team)) {
      if (q.id === p.id) continue;
      const r = this.relX(team, q.x);
      if (r > line + 0.002) { offside[q.id] = (r - line) * PITCH.length; offsidePos[q.id] = { x: q.x, y: q.y }; any = true; }
    }
    if (opts.lofted) {
      const T = 0.55 + d / 24;
      const vh = d / T;
      b.vx = Math.cos(base) * vh; b.vy = Math.sin(base) * vh; b.vz = SIM.gravity * T / 2 * (opts.low ? 0.6 : 1);
      b.z = 0.1;
    } else {
      const vEnd = opts.through ? 4.5 : 5.5;
      const v0 = Math.min(26, Math.sqrt(vEnd * vEnd + 2 * SIM.rollDecel * d));
      b.vx = Math.cos(base) * v0; b.vy = Math.sin(base) * v0; b.vz = 0; b.z = 0;
    }
    b.owner = null; b.lastTouch = p.id; b.lastTeam = p.team; b.cross = !!opts.cross;
    b.pass = { from: p.id, to: opts.to ?? null, team: p.team, type: opts.cross ? 'cross' : opts.lofted ? 'long' : opts.through ? 'through' : 'short', lofted: !!opts.lofted, t0: this.t, offside: any ? offside : null, offsidePos };
    b.shot = null;
    p.touchCooldown = this.t + 0.35; p.carry = null; p.gkHolding = false;
    team.stats.passes++; p.stats.passes++;
    this.#releaseBlock(p, base, opts.lofted ? 0.2 : 0.4);
    if (opts.cross) { if ((p.y < 34) === (team.dir > 0)) team.stats.crossesLeft++; else team.stats.crossesRight++; }
    this.nextChaseUpdate = 0;
  }

  shoot(p, opts = {}) {
    const b = this.ball;
    const team = this.teams[p.team];
    const goalX = this.oppGoalX(team);
    const pr = opts.penalty ? 0 : pressureOn(this, p);
    const d = dist(p.x, p.y, goalX, 34);
    const xg = opts.penalty ? 0.76 : xgEstimate(this, p, { header: opts.header, pressure: pr, freekick: opts.freekick });
    const gk = this.gk(1 - p.team);
    const gkY = gk ? gk.y : 34;
    // visée : côté opposé au gardien, marge selon le sang-froid
    const sideHigh = opts.aimDy != null ? opts.aimDy > 0 : gkY < 34 ? true : gkY > 34 ? false : this.rng.chance(0.5);
    const margin = this.rng.range(0.6, 1.5) + (1 - p.attrs.composure) * 0.6;
    let aimY = sideHigh ? PITCH.goalY2 - margin : PITCH.goalY1 + margin;
    let aimZ = opts.header ? this.rng.range(0.2, 1.6) : this.rng.range(0.15, 2.0);
    const fatigue = 1 + 0.4 * (1 - p.energy);
    const skill = opts.header ? p.attrs.aerial : p.attrs.shooting;
    const sigma = (0.85 + 0.15 * d * (1.4 - skill) + 1.2 * pr + (opts.header ? 0.5 : 0) + (opts.freekick ? 0.35 : 0)) * fatigue;
    aimY += this.rng.gauss(0, sigma);
    aimZ = Math.max(0.05, aimZ + this.rng.gauss(0, sigma * 0.75));
    const speed = opts.header ? this.rng.range(10, 15) : opts.penalty ? this.rng.range(22, 28) : this.rng.range(17, 22) + 8 * p.attrs.shooting * this.rng.range(0.6, 1);
    const D = dist(p.x, p.y, goalX, aimY);
    const T = D / speed;
    const ang = Math.atan2(aimY - p.y, goalX - p.x);
    b.vx = Math.cos(ang) * speed; b.vy = Math.sin(ang) * speed;
    b.z = opts.header ? Math.max(b.z, 1.6) : 0.1;
    b.vz = (aimZ - b.z + 0.5 * SIM.gravity * T * T) / T;
    b.owner = null; b.lastTouch = p.id; b.lastTeam = p.team; b.pass = null; b.cross = false;
    // cadrage lu sur la trajectoire réelle (gravité et frottement inclus)
    const traj = predictBall(b, 40);
    let crossing = null, px = b.x, py = b.y, pz = b.z;
    for (const q of traj) {
      if ((q.x - goalX) * (px - goalX) <= 0) { const f = (goalX - px) / (q.x - px || 1e-6); crossing = { y: py + (q.y - py) * f, z: pz + (q.z - pz) * f }; break; }
      px = q.x; py = q.y; pz = q.z;
    }
    const onTarget = !!crossing && crossing.y > PITCH.goalY1 && crossing.y < PITCH.goalY2 && crossing.z < PITCH.goalHeight;
    b.shot = { by: p.id, team: p.team, t0: this.t, xg, onTarget, gkMisread: this.rng.chance(0.12), header: !!opts.header, penalty: !!opts.penalty, x: p.x, y: p.y };
    p.touchCooldown = this.t + 0.6; p.carry = null;
    team.stats.shots++; team.stats.xg += xg; p.stats.shots++;
    if (onTarget) team.stats.onTarget++;
    const kind = opts.penalty ? 'Penalty tiré' : opts.header ? 'Tête' : opts.freekick ? 'Coup franc direct' : 'Frappe';
    this.#log('tir', p.team, `${kind} de ${p.name} (${team.short}) à ${Math.round(d)} m — xG pré-tir ${xg.toFixed(2)}.`, { player: p.id, xg, x: p.x, y: p.y, onTarget, major: true, shot: true });
    if (!opts.penalty && !opts.header) this.#shotBlock(p, ang);
    this.nextChaseUpdate = 0;
  }

  // Un adversaire collé dans l'axe du geste peut contrer le ballon au départ.
  #releaseBlock(p, ang, pMax) {
    const b = this.ball;
    for (const o of this.onPitch(1 - p.team)) {
      const dx = o.x - p.x, dy = o.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d > 1.3) continue;
      let da = Math.abs(Math.atan2(dy, dx) - ang);
      if (da > Math.PI) da = 2 * Math.PI - da;
      if (da > 0.6) continue;
      if (this.rng.chance(pMax * (1 - da / 0.6) * (0.6 + 0.5 * o.attrs.positioning))) {
        if (b.shot) { b.shot.blocked = true; this.#log('contre', o.team, `Frappe contrée par ${o.name}.`, { player: o.id }); b.shot = null; }
        this.#deflect(o, 0.2, 0.7);
        return true;
      }
    }
    return false;
  }

  // Contre d'une frappe : un défenseur placé dans la trajectoire, entre 0,5 et 7 m du tireur,
  // peut s'interposer (jambe, corps). Plus il est proche de l'axe, plus le contre est probable.
  #shotBlock(p, ang) {
    const b = this.ball;
    const ux = Math.cos(ang), uy = Math.sin(ang);
    for (const o of this.onPitch(1 - p.team)) {
      if (o.role === 'GK' || this.t < o.stunUntil) continue;
      const dx = o.x - p.x, dy = o.y - p.y;
      const along = dx * ux + dy * uy;
      if (along < 0.4 || along > 7) continue;
      const perp = Math.abs(-dx * uy + dy * ux);
      const reach = 0.75 + 0.25 * o.attrs.positioning;
      if (perp > reach) continue;
      const pBlock = 0.62 * (1 - perp / reach) * (0.75 + 0.35 * o.attrs.positioning) * (along < 2 ? 1 : 1 - (along - 2) / 8);
      if (this.rng.chance(pBlock)) {
        if (b.shot) { b.shot.blocked = true; this.#log('contre', o.team, `Frappe contrée par ${o.name}.`, { player: o.id }); b.shot = null; }
        b.lastShot = { by: p.id, team: p.team, t: this.t };
        this.#deflect(o, 0.25, 0.8);
        if (this.rng.chance(0.4)) { const gx = this.ownGoalX(this.teams[o.team]); const sp = Math.hypot(b.vx, b.vy) || 6; b.vx = Math.sign(gx - o.x || 1) * sp * 0.8; b.vy = (b.y < 34 ? -1 : 1) * sp * 0.4; }
        return true;
      }
    }
    return false;
  }

  carry(p, dx, dy, speed) {
    p.carry = { dx, dy, speed };
    p.nextDecision = this.t + 0.7 + this.rng.range(0, 0.5);
  }

  // ---------------------------------------------------------------- duels défensifs
  // Les joueurs chargés de presser suivent le porteur à chaque pas (anticipation courte, côté but).
  #updatePressers() {
    const b = this.ball;
    if (b.owner == null) return;
    const h = this.players[b.owner];
    const team = this.teams[1 - h.team];
    const gx = this.ownGoalX(team);
    const ax = h.x + h.vx * 0.35, ay = h.y + h.vy * 0.35;
    const gdx = gx - ax, gdy = 34 - ay, gl = Math.hypot(gdx, gdy) || 1;
    for (const p of this.onPitch(team.idx)) {
      if (!p.pressRole) continue;
      const side = p.pressRole.rank === 1 ? 1.8 : p.pressRole.rank === 2 ? -1.8 : 0;
      p.tx = ax + (gdx / gl) * p.pressRole.off + (-gdy / gl) * side;
      p.ty = ay + (gdy / gl) * p.pressRole.off + (gdx / gl) * side;
      p.urgency = p.pressRole.urg;
    }
  }

  // Duels testés à chaque pas : un taux d'engagement par seconde, pas par pas tactique.
  #defensiveDuels(dt) {
    const b = this.ball;
    if (b.owner == null) return;
    const h = this.players[b.owner];
    if (h.gkHolding) return;
    for (const def of this.onPitch(1 - h.team)) {
      if (def.role === 'GK' || def.injured || this.t < def.tackleCooldown || this.t < def.stunUntil) continue;
      if (this.isControlled(def)) continue; // le tacle du joueur piloté est sa décision
      const d = dist(def.x, def.y, h.x, h.y);
      if (d > 1.5) continue;
      const tv = this.teams[def.team].tv;
      if (this.t - (h.wonAt ?? -9) < 0.4) continue;
      // près de son but, on ne laisse pas conduire : engagement nettement plus fréquent
      const dGoal = Math.abs(h.x - this.ownGoalX(this.teams[def.team]));
      const danger = dGoal < 30 ? (30 - dGoal) / 30 : 0;
      const rate = 0.35 + 0.6 * def.attrs.aggression + 0.3 * tv.press + (d < 0.9 ? 0.4 : 0) + 1.6 * danger + (h.carry ? 0.3 : 0);
      if (!this.rng.chance(rate * dt)) continue;
      this.#duel(def, h);
      return;
    }
  }

  #duel(def, att) {
    const b = this.ball;
    const dteam = this.teams[def.team];
    def.tackleCooldown = this.t + 1.6;
    const ownGoalX = this.ownGoalX(dteam);
    // le défenseur est-il entre l'attaquant et son but ?
    const goalSide = Math.abs(def.x - ownGoalX) < Math.abs(att.x - ownGoalX) - 0.2;
    const attSpeed = Math.hypot(att.vx, att.vy);
    const slide = !goalSide && attSpeed > 4.5 && this.rng.chance(0.25 + 0.3 * def.attrs.aggression);
    const diff = def.attrs.tackling * (0.8 + 0.2 * def.energy) - att.attrs.dribbling * (0.8 + 0.2 * att.energy);
    // couverture : chaque défenseur supplémentaire à portée réduit l'espace de sortie du dribbleur
    let cover = 0;
    for (const o of this.onPitch(def.team)) if (o !== def && o.role !== 'GK' && dist(o.x, o.y, att.x, att.y) < 3.2) cover++;
    const pWin = sigmoid(-0.2 + 2.2 * diff + (goalSide ? 0.35 : -0.5) + (slide ? 0.25 : 0) - (att.carry ? 0.2 : 0) + 0.55 * Math.min(cover, 2));
    const pFoul = 0.018 + 0.03 * def.attrs.aggression + 0.03 * (1 - def.attrs.tackling) + (slide ? 0.08 : 0) + (goalSide ? 0 : 0.025);
    const r = this.rng.next();
    // incident physique : évalué au contact, pas de quota
    const injuryRisk = 0.0025 * (slide ? 3 : 1) * (1.6 - att.energy);
    if (r < pFoul) {
      this.#foul(def, att, slide, goalSide);
    } else if (r < pFoul + (1 - pFoul) * pWin) {
      dteam.stats.tackles++; def.stats.tackles++;
      // le joueur dépossédé met un temps à se réorganiser
      att.stunUntil = this.t + 0.7; att.tackleCooldown = this.t + 1.8;
      if (this.rng.chance(0.5 + 0.2 * def.attrs.tackling)) this.#gainBall(def, false, null);
      else {
        b.owner = null;
        const ang = this.rng.range(0, Math.PI * 2);
        const s = this.rng.range(2.5, 6);
        b.vx = Math.cos(ang) * s; b.vy = Math.sin(ang) * s; b.vz = 0;
        b.lastTouch = def.id; b.lastTeam = def.team; b.pass = null;
        att.touchCooldown = this.t + 0.4; def.touchCooldown = this.t + 0.3;
        att.carry = null;
        this.nextChaseUpdate = 0;
      }
      if (slide) def.stunUntil = this.t + 1.2;
    } else {
      // dribblé : celui qui était bien placé se retourne vite, l'autre est éliminé
      def.stunUntil = this.t + (slide ? 1.6 : goalSide ? 0.45 : 0.8);
    }
    if (this.rng.chance(injuryRisk)) this.#injury(att);
  }

  #foul(def, att, slide, goalSide) {
    const dteam = this.teams[def.team];
    dteam.stats.fouls++;
    const sev = this.rng.next() * (0.55 + 0.45 * def.attrs.aggression) + (slide ? 0.35 : 0) + (goalSide ? 0 : 0.12);
    const inOwnBox = inBox(att.x, att.y, this.ownGoalX(dteam));
    this.#log('faute', def.team, `Faute de ${def.name} (${dteam.short}) sur ${att.name}${inOwnBox ? ' dans la surface' : ''}.`, { player: def.id, major: inOwnBox });
    let red = false;
    if (sev > 1.6) red = true;
    else if (sev > 0.7) {
      def.yellow++; dteam.stats.yellows++;
      this.stoppage[this.period - 1] += 10;
      if (def.yellow >= 2) { red = true; this.#log('carton', def.team, `Second avertissement pour ${def.name} : expulsion.`, { player: def.id, card: 'red', major: true }); }
      else this.#log('carton', def.team, `Carton jaune pour ${def.name} (${dteam.short}).`, { player: def.id, card: 'yellow', major: true });
    }
    if (red) {
      if (def.yellow < 2) this.#log('carton', def.team, `Carton rouge direct pour ${def.name} (${dteam.short}).`, { player: def.id, card: 'red', major: true });
      dteam.stats.reds++;
      def.sentOff = true; def.onPitch = false; def.x = -20; def.y = -20;
      // le poste reste vacant jusqu'à une décision ; pas de réorganisation silencieuse
      dteam.slotPlayer[def.slot] = null; def.slot = null;
      this.stoppage[this.period - 1] += 20;
    }
    if (this.rng.chance(0.004 * (slide ? 3 : 1))) this.#injury(att);
    if (inOwnBox) {
      this.#log('penalty', att.team, `Penalty pour ${this.teams[att.team].short}.`, { major: true });
      const gx = this.ownGoalX(dteam);
      this.#setRestart('penalty', att.team, gx + (gx === 0 ? PITCH.penaltySpot : -PITCH.penaltySpot), 34);
    } else {
      const attTeam = this.teams[att.team];
      const dGoal = dist(att.x, att.y, this.oppGoalX(attTeam), 34);
      const direct = dGoal < 30 && Math.abs(att.y - 34) < 16;
      this.restart = { direct };
      this.#setRestart('freekick', att.team, att.x, att.y, { direct });
    }
  }

  #injury(p) {
    if (p.injured || !p.onPitch) return;
    p.injured = true;
    this.stoppage[this.period - 1] += 40;
    const isUser = p.team === this.userTeam && !this.aiTeams.includes(p.team);
    this.#log('blessure', p.team, `${p.name} (${this.teams[p.team].short}) se tient la jambe après un contact. Le staff estime qu'il ne peut pas tenir son poste à pleine capacité.`, { player: p.id, major: true, pause: isUser, decision: isUser });
    if (!isUser) runAIManager(this, p.team, false, p);
  }

  // ---------------------------------------------------------------- sorties et buts
  #checkBounds() {
    const b = this.ball;
    if (b.owner != null) {
      // un porteur ne sort pas volontairement : on le garde dans le terrain
      const o = this.players[b.owner];
      if (o.x < 0.3 || o.x > PITCH.length - 0.3 || o.y < 0.3 || o.y > PITCH.width - 0.3) {
        o.x = clamp(o.x, 0.3, PITCH.length - 0.3); o.y = clamp(o.y, 0.3, PITCH.width - 0.3);
      }
      return;
    }
    if (b.x < 0 || b.x > PITCH.length) {
      const goalX = b.x < 0 ? 0 : PITCH.length;
      const crossY = b.prevX !== b.x ? b.prevY + (b.y - b.prevY) * ((goalX - b.prevX) / (b.x - b.prevX)) : b.y;
      const attacking = this.teams.find((t) => this.oppGoalX(t) === goalX);
      const defending = this.teams[1 - attacking.idx];
      if (crossY > PITCH.goalY1 && crossY < PITCH.goalY2 && b.z < PITCH.goalHeight) { this.#goal(attacking, defending); return; }
      if (b.shot) this.#log('tir_rate', b.shot.team, `${b.shot.blocked ? 'Frappe déviée' : 'Frappe non cadrée'} de ${this.players[b.shot.by].name}.`, { player: b.shot.by });
      if (b.lastTeam === attacking.idx) this.#setRestart('goalkick', defending.idx, goalX === 0 ? 5.5 : PITCH.length - 5.5, crossY < 34 ? 29 : 39);
      else {
        attacking.stats.corners++;
        this.#log('corner', attacking.idx, `Corner pour ${attacking.short}.`, {});
        this.#setRestart('corner', attacking.idx, goalX === 0 ? 0.3 : PITCH.length - 0.3, crossY < 34 ? 0.3 : PITCH.width - 0.3);
      }
      return;
    }
    if (b.y < 0 || b.y > PITCH.width) {
      const team = b.lastTeam == null ? 0 : 1 - b.lastTeam;
      this.#setRestart('throw', team, clamp(b.x, 1, PITCH.length - 1), b.y < 0 ? 0 : PITCH.width);
    }
  }

  #goal(att, def) {
    const b = this.ball;
    let scorerP = this.players[b.lastTouch];
    // frappe déviée : le but revient au tireur
    if (scorerP && scorerP.team !== att.idx && b.lastShot && b.lastShot.team === att.idx && this.t - b.lastShot.t < 2) scorerP = this.players[b.lastShot.by];
    const own = scorerP && scorerP.team !== att.idx;
    this.score[att.idx]++;
    att.stats.goals++;
    if (scorerP && !own) scorerP.stats.goals++;
    const shot = b.shot;
    const assist = shot ? null : null;
    const txt = own ? `BUT contre son camp de ${scorerP.name} ! ${att.short} ${this.score[att.idx]}` : `BUT de ${scorerP ? scorerP.name : '?'} pour ${att.short} !`;
    this.#log('but', att.idx, `${txt} (${this.teams[0].short} ${this.score[0]} – ${this.score[1]} ${this.teams[1].short})`, { player: scorerP?.id, own, xg: shot?.xg, major: true, assist });
    this.stoppage[this.period - 1] += 45;
    this.#setRestart('kickoff', def.idx, 52.5, 34);
  }

  // ---------------------------------------------------------------- replay
  #recordFrame() {
    const n = this.players.length;
    const f = new Float32Array(5 + n * 2);
    f[0] = this.t; f[1] = this.ball.x; f[2] = this.ball.y; f[3] = this.ball.z; f[4] = this.ball.owner ?? -1;
    for (let i = 0; i < n; i++) {
      const p = this.players[i];
      f[5 + i * 2] = p.onPitch ? p.x : NaN; f[6 + i * 2] = p.onPitch ? p.y : NaN;
    }
    this.frames.push(f);
  }

  // Empreinte des événements canoniques (pour les tests de reproductibilité).
  fingerprint() {
    const evs = this.events.map((e) => `${e.tick}|${e.type}|${e.team}|${e.player ?? ''}|${e.status ?? ''}`).join(';');
    let h = 2166136261;
    for (let i = 0; i < evs.length; i++) { h ^= evs.charCodeAt(i); h = Math.imul(h, 16777619); }
    return `${this.score.join('-')}:${this.events.length}:${(h >>> 0).toString(16)}`;
  }

  // État compact (tests : le replay ne doit rien changer).
  canonicalState() {
    return JSON.stringify({ t: this.t, tick: this.tick, score: this.score, ball: this.ball, players: this.players.map((p) => [p.x, p.y, p.energy, p.onPitch, p.yellow]), rng: this.rng.snapshot(), events: this.events.length });
  }

  runToEnd(maxTicks = 80000) {
    let n = 0;
    while (this.phase !== 'fulltime' && n++ < maxTicks) this.step();
    return this;
  }
}

export { predictBall };
