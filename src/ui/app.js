// Interface du match 2D : manager, observateur, replay en lecture seule.
// L'interface prépare des brouillons et transmet des commandes horodatées ; seul le moteur
// modifie l'état canonique.

import { Match } from '../engine/match.js';
import { SIM, INSTRUCTION_OPTIONS, INSTRUCTION_LABELS, ROLE_LABELS, DEFAULT_COMPETITION } from '../engine/config.js';
import { TEAM_DEFS } from '../engine/teams.js';
import { PitchRenderer } from './render.js';
import { crestSVG } from './crest.js';
import { icon } from './icons.js';
import { sound } from './sound.js';
import { avatar, matchFace } from './faces.js';
import { ballChoices, defendChoices, supportChoices, restartChoices, choiceTargets } from './choices.js';
import { createPredictor, createJudge, goalOf } from '../engine/predict.js';
import { matchRating } from '../career/career.js';
import { extractResult } from '../career/play.js';

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ROLE_ABBR = { GK: 'G', CB: 'DC', FB: 'DL', DM: 'MD', CM: 'MC', AM: 'MO', W: 'AIL', ST: 'BU' };
const FEED_TYPES = new Set(['but', 'tir', 'arret', 'carton', 'penalty', 'blessure', 'mi_temps', 'fin', 'coup_envoi', 'temps_additionnel', 'remplacement', 'consigne', 'hors_jeu', 'corner', 'tir_rate', 'contre', 'faute']);

let toastTimer = null;
const S = {
  m: null, renderer: null, paused: true, speed: 1, acc: 0, last: 0,
  replay: null, selectedId: null, tab: 'consignes',
  draft: null, draftHistory: [], draftError: null, validated: [],
  subMode: false, subDraft: { outId: null, inId: null }, subError: null,
  seenEvents: 0, prev: null, accelDead: true, modalOpen: false, quick: false, config: null, uiDirty: true, lastUi: 0,
  // pilotage direct (carrière) : manuel ou délégué à l'IA
  ctl: { enabled: false, manual: true, engaged: false, zoom: 1.7, sent: '', userId: null, wasOn: false, fbT: -1 },
  pace: { mode: 'court', real: 0, live: 0, cur: 1, isLive: false },
};

// ------------------------------------------------------------------ démarrage
// cfg.match : match déjà construit (carrière) ; cfg.career : { followTeam, label, onFinish(match) }
export function startMatch(cfg) {
  S.config = cfg;
  S.career = cfg.career ?? null;
  const userTeam = cfg.role === 'observer' || cfg.match ? null : Number(cfg.role);
  const aiTeams = [0, 1].filter((i) => i !== userTeam || cfg.delegate);
  S.m = cfg.match ?? new Match({ home: cfg.home, away: cfg.away, seed: cfg.seed, userTeam, aiTeams, competition: DEFAULT_COMPETITION });
  S.speed = 1;
  S.pace = { mode: matchLength(), real: 0, live: 0, cur: 1, isLive: false, ffReal: 0 };
  S.hl = { queue: [], shown: 0, follow: 0 };
  S.paused = false; S.acc = 0; S.replay = null; S.selectedId = null; S.seenEvents = 0;
  S.draft = null; S.draftHistory = []; S.draftError = null; S.validated = [];
  S.subMode = false; S.subDraft = { outId: null, inId: null }; S.subError = null; S.quick = false;
  const u = S.career ? S.m.players.find((p) => p.isUser) : null;
  const canControl = !!u && u.role !== 'GK';
  // choix en match : activés pour un joueur de champ, désactivables (l'IA joue alors pour toi)
  S.judge = null;
  S.ctl = { enabled: canControl, manual: canControl, zoom: 1.7, userId: u?.id ?? null, wasOn: !!u?.onPitch, lastOwner: null, lastBallChoice: -99, lastOffChoice: -99, made: 0 };
  S.choice = null; $('#choices').hidden = true;
  S.renderer.cam.zoom = 1;
  S.tab = 'consignes';
  $('#tab1-label').textContent = S.career ? 'Mon match' : 'Consignes';
  $('#goal-banner').hidden = true;
  $('#toast').hidden = true; clearTimeout(toastTimer);
  S.prev = snapshot();
  $('#feed').innerHTML = '';
  $('#comp-name').textContent = S.career ? S.career.competition : `${S.m.competition.name} · graine « ${S.m.seed} »`;
  const team = userTeam == null ? null : S.m.teams[userTeam];
  $('#role-label').textContent = S.career ? S.career.label : team ? `Rôle : manager — ${team.name}${cfg.delegate ? ' (remplacements délégués au staff)' : ''}` : 'Rôle : observateur';
  for (const i of [0, 1]) {
    const t = S.m.teams[i];
    const el = $(`#team${i}-name`);
    el.innerHTML = `${crestSVG({ id: t.def.clubId ?? t.def.id, name: t.def.name }, 20)}<span>${esc(t.short)}</span>`; el.title = t.name;
    el.style.background = t.colors.primary; el.style.color = t.colors.text; el.style.borderColor = t.colors.secondary;
  }
  closeModal();
  S.uiDirty = true;
  sound.start();
  refreshUI(true);
}

function userTeamIdx() { return S.m?.userTeam ?? null; }
// pastille visage (joueurs fictifs) ou initiales aux couleurs du club (joueurs réels)
function face(p, size = 28, cls = '') {
  if (!p) return '';
  const t = S.m.teams[p.team];
  return avatar({ face: matchFace(S.m, p, S.career?.face ?? null), name: p.name, color: t.colors.primary, text: t.colors.text }, size, cls);
}
function viewTeamIdx() { return userTeamIdx() ?? S.career?.followTeam ?? 0; }

// ------------------------------------------------------------------ boucle
function snapshot() {
  const m = S.m;
  const a = new Float32Array(m.players.length * 2 + 3);
  m.players.forEach((p, i) => { a[i * 2] = p.x; a[i * 2 + 1] = p.y; });
  const k = m.players.length * 2;
  a[k] = m.ball.x; a[k + 1] = m.ball.y; a[k + 2] = m.ball.z;
  return a;
}

function frame(now) {
  const dt = Math.min(0.1, (now - (S.last || now)) / 1000);
  S.last = now;
  const m = S.m;
  if (m) {
    if (S.replay) {
      if (S.replay.playing) {
        S.replay.cursor += dt * 5 * (S.replay.hl ? 1.3 : 1); // 5 images par seconde réelle = 1×
        // sons du temps fort calés sur l'image de l'action
        const R = S.replay;
        if (R.hl && R.fx === 0 && R.cursor >= R.evFrame - 4) { R.fx = 1; sound.kick(1); }
        if (R.hl && R.fx === 1 && R.cursor >= R.evFrame) { R.fx = 2; if (R.goal) sound.goal(); else sound.ooh(); }
        if (S.replay.cursor >= S.replay.end) { S.replay.cursor = S.replay.end; S.replay.playing = false; S.replay.doneAt = now; }
      } else if (S.replay.hl && now - (S.replay.doneAt ?? now) > 500) endHighlight();
    } else if (S.pace.mode === 'tf' && !S.paused && !S.modalOpen && !S.quick && !S.choice && startHighlight()) {
      /* un temps fort démarre */
    } else if (!S.paused && !S.modalOpen && !S.quick && !S.choice && m.phase !== 'fulltime') {
      updateControl();
      let mult;
      if (S.pace.mode === 'tf') mult = tfSpeed(dt);
      else if (S.pace.mode === 'court') mult = paceSpeed(dt);
      else mult = S.speed * (S.accelDead && m.phase === 'dead' ? 4 : 1);
      S.acc += dt * mult;
      let n = 0;
      while (S.acc >= SIM.dt && n < 2000) {
        S.prev = snapshot();
        m.step();
        checkJudge();
        S.acc -= SIM.dt; n++;
        if (handleNewEvents()) { S.acc = 0; break; }
        if (m.phase === 'fulltime') break;
        if (checkChoice()) { S.acc = 0; break; }
      }
      if (n) S.uiDirty = true;
    }
    draw();
    if (now - (S.lastCrowd ?? 0) > 500) {
      S.lastCrowd = now;
      const b = m.ball, near = Math.min(b.x, 105 - b.x);
      const ff = S.pace.mode === 'tf' && !S.replay && m.t >= S.hl.follow;
      sound.intensity(m.phase === 'fulltime' ? 0.5 : ff ? 0.35 : S.replay?.hl ? 1.7 : 0.9 + Math.max(0, (25 - near) / 25) * 0.9);
    }
    if (S.uiDirty && now - S.lastUi > 200) { refreshUI(); S.lastUi = now; S.uiDirty = false; }
  }
  requestAnimationFrame(frame);
}

function draw() {
  const m = S.m;
  const teams = m.teams.map((t) => ({ ...t, colors: t.colors, short: t.short, dir: t.dir }));
  if (S.replay) {
    const i0 = Math.floor(S.replay.cursor), i1 = Math.min(S.replay.end, i0 + 1), f = S.replay.cursor - i0;
    const A = m.frames[i0], B = m.frames[i1];
    const lerp = (k) => A[k] + (B[k] - A[k]) * f;
    const players = m.players.map((p, i) => ({ ...p, x: lerp(5 + i * 2), y: lerp(6 + i * 2), onPitch: Number.isFinite(A[5 + i * 2]) }));
    // le sens d'attaque affiché est celui de la période rejouée
    const t = A[0];
    const firstHalf = t < (m.events.find((e) => e.type === 'mi_temps')?.t ?? Infinity);
    teams.forEach((tt, i) => { tt.dir = (i === 0 ? 1 : -1) * (firstHalf ? 1 : -1); });
    document.getElementById('pitch').classList.remove('ff');
    if (S.replay.hl) {
      S.renderer.mirror = !!S.career && teams[S.career.followTeam].dir < 0;
      S.renderer.follow(lerp(1), lerp(2), 2.3, 0.1);
    } else S.renderer.follow(52.5, 34, 1);
    S.renderer.draw({ teams, players, ball: { x: lerp(1), y: lerp(2), z: lerp(3) }, ownerId: A[4] >= 0 ? A[4] : null, selectedId: S.selectedId });
    const sec = Math.max(0, t);
    const rt = $('#replay-time'); if (rt) rt.textContent = `· ${fmtTime(sec).split(' ')[0]}`;
    return;
  }
  const alpha = S.paused || m.phase === 'fulltime' ? 1 : Math.min(1, S.acc / SIM.dt);
  const P = S.prev, k = m.players.length * 2;
  // carrière : ton équipe attaque toujours vers la droite de l'écran (affichage seulement)
  S.renderer.mirror = !!S.career && m.teams[S.career.followTeam].dir < 0;
  S.renderer.setInset(S.choice?.inset?.r ?? 0, S.choice?.inset?.b ?? 0);
  const players = m.players.map((p, i) => ({ ...p, x: P && Number.isFinite(P[i * 2]) ? P[i * 2] + (p.x - P[i * 2]) * alpha : p.x, y: P && Number.isFinite(P[i * 2 + 1]) ? P[i * 2 + 1] + (p.y - P[i * 2 + 1]) * alpha : p.y }));
  const ball = P ? { x: P[k] + (m.ball.x - P[k]) * alpha, y: P[k + 1] + (m.ball.y - P[k + 1]) * alpha, z: P[k + 2] + (m.ball.z - P[k + 2]) * alpha } : m.ball;
  if (Math.hypot(ball.x - m.ball.x, ball.y - m.ball.y) > 15) { ball.x = m.ball.x; ball.y = m.ball.y; } // replacement arbitral
  // caméra : suit ton joueur quand il est sur le terrain
  const u = S.ctl.userId != null ? players[S.ctl.userId] : null;
  let aim = null;
  const ff = S.pace.mode === 'tf' && !S.choice && S.hl.follow <= m.t - 0.01 && !S.paused;
  document.getElementById('pitch').classList.toggle('ff', ff && m.phase !== 'fulltime');
  if (ff) S.renderer.follow(52.5, 34, 1);
  else if (u && u.onPitch && S.career) {
    // choix ouvert : la caméra cadre ton joueur et le ballon dans la partie non couverte par le panneau
    const z = S.choice ? Math.max(S.ctl.zoom, 1.7) : S.ctl.zoom;
    S.renderer.follow(u.x * 0.6 + ball.x * 0.4, u.y * 0.6 + ball.y * 0.4, z, S.choice ? 0.2 : 0.12);
    if (S.choice && S.choice.targets) aim = S.choice.targets;
  } else S.renderer.follow(52.5, 34, 1);
  S.renderer.draw({ teams, players, ball, ownerId: m.ball.owner, selectedId: S.selectedId, userTeam: userTeamIdx(), aim });
}

// ------------------------------------------------------------------ pilotage direct
function controlActive() { return S.ctl.enabled && S.ctl.manual; }

// ------------------------------------------------------------------ match court (≈ 4 min 30)
// Le moteur joue toujours les 90 minutes. On accélère loin de l'action et on revient à 1×
// pendant les temps forts, avec un budget qui fait tenir la rencontre dans la durée visée.
export const PACE = { target: 225, liveBudget: 105, totalSim: 5640 };
const LS_KEY = 'generation-football.matchLength';
export function matchLength() { try { return localStorage.getItem(LS_KEY) || 'tf'; } catch { return 'tf'; } }
export function setMatchLength(v) { try { localStorage.setItem(LS_KEY, v); } catch { /* stockage indisponible */ } if (S.pace) S.pace.mode = v; }

// ------------------------------------------------------------------ mode « temps forts »
// La rencontre défile très vite ; chaque action clé est rejouée (lecture seule, étiquetée),
// et les choix du joueur arrivent aux moments importants, suivis de la fin de l'action à 1×.
export const TF = { fastReal: 50 };
function tfSpeed(dt) {
  const m = S.m, P = S.pace;
  if (m.t < S.hl.follow) return 1.6; // suite de l'action après un choix
  const simDone = (m.period - 1) * 2700 + Math.min(m.periodTime, 2700 + (m.added[m.period - 1] ?? 0) * 60);
  const remaining = Math.max(30, PACE.totalSim - simDone);
  const left = Math.max(5, TF.fastReal - P.ffReal);
  P.ffReal += dt;
  P.cur = Math.min(260, Math.max(25, remaining / left));
  return P.cur;
}

// Actions clés retenues pour un temps fort
function isKeyEvent(ev) {
  const m = S.m;
  if (ev.hidden) return false;
  if (ev.type === 'but' || ev.type === 'penalty') return true;
  if (ev.type === 'carton' && ev.card === 'red') return true;
  if (ev.type === 'tir') return ev.xg >= 0.15 || (ev.onTarget && ev.xg >= 0.06) || (ev.player != null && m.players[ev.player]?.isUser);
  return false;
}
function queueHighlight(ev) {
  const q = S.hl.queue;
  const last = q[q.length - 1];
  const label = ev.type === 'but' ? ev.text.replace(/\s*\(.*\)\s*$/, '') : ev.type === 'tir' ? ev.text.split(' — ')[0] : ev.text;
  // un but qui suit un tir de près : même séquence, étiquette « but »
  if (last && !last.played && ev.frame - last.frame < 25) { if (ev.type === 'but') { last.label = label; last.goal = true; last.team = ev.team; } last.frame = Math.max(last.frame, ev.frame); return; }
  // au plus ~12 temps forts répartis sur la rencontre ; les buts passent toujours
  const m2 = S.m, done = (m2.period - 1) * 2700 + Math.min(m2.periodTime, 2700);
  const nonGoal = q.filter((x) => !x.goal).length;
  if (ev.type !== 'but' && nonGoal >= Math.min(10, 2 + Math.floor(9 * done / 5400))) return;
  q.push({ frame: ev.frame, label, goal: ev.type === 'but', team: ev.team, played: false });
}
function startHighlight() {
  const m = S.m;
  const h = S.hl.queue.find((x) => !x.played);
  if (!h || m.frames.length < h.frame + 10) return false;
  h.played = true;
  S.hl.shown++;
  const start = Math.max(0, h.frame - 30), end = Math.min(m.frames.length - 1, h.frame + 8);
  S.replay = { start, end, cursor: start, playing: true, hl: true, label: h.label, goal: h.goal, evFrame: h.frame, fx: 0 };
  const t = m.teams[h.team];
  $('#replay-banner').innerHTML = `${icon(h.goal ? 'ball' : 'replay', 16)}<em>${h.goal ? 'But' : 'Temps fort'}</em><span>${esc(h.label)}</span>`;
  $('#replay-banner').style.setProperty('--team', t?.colors.primary ?? '#f5c542');
  refreshUI(true);
  return true;
}
function endHighlight() {
  const r = S.replay;
  S.replay = null;
  if (r?.goal) { const ev = [...S.m.events].reverse().find((e) => e.type === 'but'); if (ev) goalBanner(ev); }
  $('#replay-banner').innerHTML = `${icon('replay', 16)}<em>Replay</em><span>lecture seule <span id="replay-time"></span></span>`;
  refreshUI(true);
}

function isLiveMoment() {
  const m = S.m, b = m.ball;
  if (m.phase !== 'play') return false;
  const u = S.ctl.userId != null ? m.players[S.ctl.userId] : null;
  if (u && u.onPitch && S.ctl.enabled && S.ctl.manual) {
    // carrière en manuel : le ballon s'approche de ton joueur
    return Math.hypot(u.x - b.x, u.y - b.y) < 18 || b.owner === u.id || (b.pass && b.pass.to === u.id);
  }
  // sinon : actions de but (tir en vol, ballon dans les 22 derniers mètres)
  if (b.shot) return true;
  return Math.min(Math.abs(b.x), Math.abs(105 - b.x)) < 22 && Math.abs(b.y - 34) < 26;
}

function paceSpeed(dt) {
  const m = S.m, P = S.pace;
  const simDone = (m.period - 1) * 2700 + Math.min(m.periodTime, 2700 + (m.added[m.period - 1] ?? 0) * 60);
  const remainingSim = Math.max(30, PACE.totalSim - simDone);
  const realLeft = Math.max(12, PACE.target - P.real);
  // budget de temps forts réparti sur la rencontre (pas tout consommé en début de match)
  const allowed = PACE.liveBudget * Math.min(1, simDone / PACE.totalSim) + 14;
  const liveLeft = Math.max(0, Math.min(PACE.liveBudget, allowed) - P.live);
  const wasLive = P.isLive;
  // hystérésis : un temps fort dure au moins quelques secondes
  const liveNow = isLiveMoment();
  if (liveNow && (P.isLive || liveLeft > 6)) { P.isLive = liveLeft > 0; P.liveHold = 3.5; }
  else if (P.isLive) { P.liveHold -= dt; if (P.liveHold <= 0 || liveLeft <= 0) P.isLive = false; }
  let target;
  if (P.isLive) target = controlActive() ? 1.2 : 2;
  else {
    const liveReserve = Math.min(liveLeft, realLeft * 0.5);
    target = Math.min(140, Math.max(5, remainingSim / Math.max(6, realLeft - liveReserve)));
    if (m.phase === 'dead') target = Math.max(target, 20);
  }
  P.target = target; P.remainingSim = remainingSim; P.realLeft = realLeft; P.liveLeft = liveLeft;
  // transitions douces vers l'accéléré, retour immédiat au temps forts
  P.cur = target < P.cur ? target : Math.min(target, P.cur * Math.exp(dt * 7) + dt * 4);
  P.real += dt;
  if (P.isLive) P.live += dt;
  if (wasLive !== P.isLive) S.uiDirty = true;
  return P.cur;
}

// Entrée en jeu, etc.
function updateControl() {
  const m = S.m, c = S.ctl;
  if (c.userId == null) return;
  const u = m.players[c.userId];
  if (u.onPitch && !c.wasOn && S.career) toast('Tu entres en jeu !');
  c.wasOn = u.onPitch;
}

// ------------------------------------------------------------------ choix en match
// Moments de décision : réception du ballon, adversaire porteur qui arrive sur toi,
// partenaire porteur qui peut te trouver. Le match est figé pendant le choix (aucun bonus,
// aucun malus de temps). Entre deux choix, l'IA joue pour toi « à l'instinct ».
const CHOICE_GAP = { ball: 7, off: 22 };
const TEAM_PLAY = new Set(['safe', 'onetwo', 'switch', 'cutback', 'through', 'forward', 'long', 'cross-far', 'cross-near', 'call', 'drop', 'overlap', 'space', 'box', 'track', 'cover', 'block', 'shepherd', 'decoy', 'foul', 'rebound']);
const CHOICE_GAP_TF = { ball: 160, off: 300 }; // temps forts : seulement les situations clés
function checkChoice() {
  const m = S.m, c = S.ctl;
  if (!c.enabled || !c.manual || S.replay) return false;
  if (performance.now() < (S.goalUntil ?? 0)) return false; // pas de choix pendant la célébration d'un but
  // coup de pied arrêté confié à ton joueur : penalty, corner, coup franc direct
  const r = m.restart;
  if (m.phase === 'dead' && r && r.taker === c.userId && ['penalty', 'corner', 'freekick'].includes(r.type)) {
    c.restartAsked ??= new Set();
    if (!c.restartAsked.has(r.started)) {
      c.restartAsked.add(r.started);
      const rc = restartChoices(m, m.players[c.userId], r);
      if (rc) { openChoice(rc, m.players[c.userId]); return true; }
    }
  }
  if (m.phase !== 'play') return false;
  if (S.pace.mode === 'court' && !S.pace.isLive) return false; // seulement pendant les temps forts
  const G = S.pace.mode === 'tf' ? CHOICE_GAP_TF : CHOICE_GAP;
  const u = m.players[c.userId];
  if (!u.onPitch || u.injured) return false;
  const b = m.ball;
  const owner = b.owner != null ? m.players[b.owner] : null;
  const justGot = owner && owner.id === u.id && c.lastOwner !== u.id;
  c.lastOwner = owner?.id ?? null;
  let ch = null;
  const tf = S.pace.mode === 'tf';
  const team = m.teams[u.team];
  c.skipped ??= 0;
  if (tf) {
    // au plus ~10 choix, répartis sur toute la rencontre
    const simDone = (m.period - 1) * 2700 + Math.min(m.periodTime, 2700);
    if (c.made + c.skipped >= Math.min(10, 1 + Math.floor(10 * simDone / 5400))) return false;
  }
  const relU = m.relX(team, u.x);
  // temps forts : au plus 3 choix « sans ballon » de chaque sorte, le reste pour les actions décisives
  c.byType ??= { ball: 0, defend: 0, support: 0 };
  const offOk = (k) => !tf || c.byType[k] < 3;
  if (justGot && m.t - c.lastBallChoice >= G.ball && !u.gkHolding && (!tf || relU > 0.5)) {
    ch = ballChoices(m, u, recentKeys()); c.lastBallChoice = m.t;
  } else if (owner && owner.id !== u.id && m.t - c.lastOffChoice >= G.off) {
    const d = Math.hypot(owner.x - u.x, owner.y - u.y);
    if (owner.team !== u.team && d < 9 && !owner.gkHolding && offOk('defend') && (!tf || m.relX(team, owner.x) < 0.35)) { ch = defendChoices(m, u, owner, recentKeys()); c.lastOffChoice = m.t; }
    else if (owner.team === u.team && d < 28 && d > 6 && offOk('support')) {
      if (relU > m.relX(team, owner.x) - 0.04 && relU > (tf ? 0.66 : 0.45)) { ch = supportChoices(m, u, owner, recentKeys()); c.lastOffChoice = m.t; }
    }
  }
  if (!ch || !ch.list.length) return false;
  if (c.byType[ch.type] != null) c.byType[ch.type]++;
  openChoice(ch, u);
  return true;
}

// gestes déjà choisis ou proposés récemment : les choix suivants varient
function recentKeys() { return [...(S.ctl.recent ?? []), ...(S.ctl.offered ?? [])]; }

function openChoice(ch, u) {
  const m = S.m;
  S.ctl.offered = [...(S.ctl.offered ?? []), ...ch.list.map((c) => `o:${c.key}`), ...ch.list.filter((c) => c.opt?.to != null).map((c) => `to:${c.opt.to}`)].slice(-14);
  S.choice = { ...ch, targets: ch.type === 'ball' || ch.type === 'support' ? choiceTargets(m, u, ch) : null, opened: performance.now() };
  const box = $('#choices');
  const vs = ch.vs != null ? m.players[ch.vs] : null;
  box.innerHTML = `<div class="ch-head">${face(u, 40, 'ch-me')}<div class="ch-ht"><strong>${esc(ch.title)}</strong><span>${esc(ch.sub)}</span></div>${vs ? face(vs, 40, 'ch-vs') : ''}</div>
    <div class="ch-list">${ch.list.map((c, i) => `<button class="ch-opt" data-i="${i}"><span class="ch-n">${i + 1}</span><span class="ch-ic">${icon(c.icon, 22)}${c.opt?.to != null ? `<span class="ch-mate">${face(m.players[c.opt.to], 22)}</span>` : ''}</span><span class="ch-t"><b>${esc(c.label)}</b><small>${esc(c.hint || '')}</small></span><span class="ch-pct calc" title="Chance de réussite : la suite de l'action est simulée plusieurs fois par le moteur"><b>…</b><small>${esc(goalOf(c, ch.type).label)}</small></span></button>`).join('')}</div>
    <div class="ch-foot"><button id="ch-auto" class="ch-skip">${icon('auto', 16)} Laisser l'instinct décider</button></div>`;
  box.hidden = false;
  S.choice.inset = panelInset(box);
  // pourcentages de réussite : simulés en tâche de fond, affichés au fur et à mesure
  const pred = createPredictor(m, u.id, ch.list, 24, ch.type);
  S.choice.pred = pred;
  const run = () => {
    if (!S.choice || S.choice.pred !== pred) return;
    const done = pred.work(14);
    showPcts(box, pred, done);
    if (!done) setTimeout(run, 0);
  };
  setTimeout(run, 40);
  sound.chime();
  box.querySelectorAll('.ch-opt').forEach((btn) => btn.addEventListener('click', () => pickChoice(Number(btn.dataset.i))));
  box.querySelector('#ch-auto').addEventListener('click', () => pickChoice(-1));
  refreshUI(true); // l'horloge et le score affichés correspondent à l'instant du choix
}

// niveau de confiance d'un pourcentage (un but n'a pas la même échelle qu'une passe)
function pctTier(p, kind) {
  const [hi, mid] = kind === 'goal' ? [0.25, 0.1] : kind === 'receive' || kind === 'chance' ? [0.4, 0.18] : [0.65, 0.4];
  return p >= hi ? 'hi' : p >= mid ? 'mid' : 'lo';
}
function showPcts(box, pred, done) {
  pred.items.forEach((it, i) => {
    const el = box.querySelector(`.ch-opt[data-i="${i}"] .ch-pct`);
    const p = pred.pct(it);
    if (!el || p == null) return;
    el.querySelector('b').textContent = `${Math.round(p * 100)} %`;
    el.classList.toggle('calc', !done);
    el.dataset.tier = pctTier(p, it.goal.kind);
    if (it.card && done && it.card / it.runs >= 0.15) el.querySelector('small').textContent = `${it.goal.label} · carton ${Math.round((it.card / it.runs) * 100)} %`;
  });
}

// Retour après un choix : l'issue réelle, jugée avec les mêmes règles que les simulations
const OUTCOME = {
  goal: ['But !', 'Pas de but'], pass: ['Passe réussie', 'Passe perdue'], cross: ['Centre pour un partenaire', 'Centre perdu'],
  keep: ['Ballon gardé', 'Ballon perdu'], win: ['Ballon récupéré', 'Pas de récupération'], foul: ['Action stoppée', 'Faute manquée'],
  stop: ['Action stoppée', 'L\'adversaire avance'], teamkeep: ['Possession gardée', 'Possession perdue'], receive: ['Ballon reçu', 'Ballon pas reçu'],
  chance: ['Occasion créée', 'Pas d\'occasion'],
};
function checkJudge() {
  const J = S.judge;
  if (!J) return;
  const r = J.j.check();
  if (!r) return;
  S.judge = null;
  if (r.ended) return;
  const m = S.m;
  (m.userChoices ??= []).push({ minute: J.minute, label: J.c.label, p: J.p, ok: !!r.ok, kind: J.goal.kind, card: !!r.card });
  const [yes, no] = OUTCOME[J.goal.kind] ?? ['Réussi', 'Raté'];
  const h = $('#pad-hint');
  h.textContent = `${r.ok ? '✓' : '✗'} ${r.ok ? yes : no}${J.p != null ? ` · ${Math.round(J.p * 100)} % annoncé` : ''}`;
  h.className = r.ok ? 'fb-ok' : 'fb-ko';
  h.hidden = false;
  clearTimeout(S.hintTimer); S.hintTimer = setTimeout(() => { h.hidden = true; h.className = ''; }, 2400);
}

// part du terrain couverte par le panneau des choix (à droite sur téléphone, en bas sinon)
function panelInset(box) {
  const cv = document.getElementById('pitch').getBoundingClientRect(), r = box.getBoundingClientRect();
  if (!cv.width || !r.width) return { r: 0, b: 0 };
  const right = r.height > cv.height * 0.6 && r.left > cv.left + cv.width * 0.35;
  return right ? { r: Math.max(0, cv.right - r.left + 8), b: 0 } : { r: 0, b: Math.max(0, cv.bottom - r.top + 8) };
}

function pickChoice(i) {
  const m = S.m, ch = S.choice;
  if (!ch) return;
  const u = m.players[S.ctl.userId];
  const c = ch.list[i];
  if (!c) S.ctl.skipped = (S.ctl.skipped ?? 0) + 1;
  if (c) {
    if (c.plan) m.queueCommand({ type: 'restartPlan', playerId: u.id, plan: c.plan });
    else if (c.opt) m.queueCommand({ type: 'choice', playerId: u.id, opt: c.opt });
    else m.queueCommand({ type: 'intent', playerId: u.id, kind: c.intent, ...(c.spot ?? {}) });
    const it = ch.pred?.items[i];
    const goal = goalOf(c, ch.type);
    S.judge = { j: createJudge(m, u.id, c, goal), c, goal, minute: m.minute(), p: it && it.runs ? ch.pred.pct(it) : null };
    S.ctl.made++;
    S.ctl.recent = [...(S.ctl.recent ?? []), c.key].slice(-4);
    // le vestiaire juge l'état d'esprit : jeu collectif ou exploit personnel forcé
    const style = (m.userStyle ??= { team: 0, selfish: 0 });
    if ((c.opt?.kind === 'shoot' && (c.opt.xg ?? 1) < 0.05) || (c.opt?.kind === 'carry' && c.cls === 'high')) style.selfish++;
    else if (TEAM_PLAY.has(c.key)) style.team++;
    flashHint(c.label);
    // on regarde la suite de l'action (pour un coup de pied arrêté : jusqu'après la frappe)
    if (S.pace.mode === 'tf') S.hl.follow = (c.plan && m.restart ? m.restart.readyAt : m.t) + (c.plan ? 6 : 4);
  }
  S.choice = null;
  $('#choices').hidden = true;
  S.uiDirty = true;
}

function flashHint(text) {
  const h = $('#pad-hint');
  h.textContent = text; h.hidden = false; h.className = '';
  clearTimeout(S.hintTimer); S.hintTimer = setTimeout(() => { h.hidden = true; }, 1400);
}

function setManual(v) {
  const c = S.ctl;
  if (!c.enabled) return;
  c.manual = v;
  if (!v && S.choice) pickChoice(-1);
  toast(v ? 'Choix activés : tu décides aux moments clés.' : 'L\'IA joue pour toi (instinct).');
  refreshUI(true);
}

function fmtTime(t) {
  const mm = Math.floor(t / 60), ss = Math.floor(t % 60);
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')} (temps de simulation)`;
}

// Nouveaux événements : fil, pauses automatiques. Renvoie true si le direct doit s'arrêter.
function handleNewEvents() {
  const m = S.m;
  let stop = false;
  for (; S.seenEvents < m.events.length; S.seenEvents++) {
    const ev = m.events[S.seenEvents];
    addFeed(ev);
    eventSound(ev);
    if (ev.type === 'but' && !S.quick && S.pace.mode !== 'tf') goalBanner(ev);
    if (S.pace.mode === 'tf' && !S.quick && isKeyEvent(ev)) queueHighlight(ev);
    if (ev.pause && (ev.type !== 'blessure' || ev.team === userTeamIdx())) {
      S.paused = true; stop = true;
      toast(ev.decision ? `${ev.text} Décision requise : préparez un remplacement ou laissez-le sur le terrain.` : ev.text);
    }
    if (ev.type === 'fin') { stop = true; setTimeout(showSummary, 400); }
  }
  return stop;
}

// Sons des événements : sifflets toujours ; frappes, « ooh » et clameurs seulement quand on regarde l'action
function eventSound(ev) {
  if (S.quick) return;
  const live = S.pace.mode === 'reel' ? S.speed <= 4 : S.pace.mode === 'court' ? S.pace.isLive : S.m.t < S.hl.follow + 1;
  if (ev.type === 'coup_envoi') sound.whistle('long');
  else if (ev.type === 'mi_temps') sound.whistle('half');
  else if (ev.type === 'fin') sound.whistle('end');
  if (!live) return;
  if (ev.type === 'faute' || ev.type === 'hors_jeu') sound.whistle('short');
  else if (ev.type === 'penalty') sound.whistle('long');
  else if (ev.type === 'tir') { sound.kick(ev.xg > 0.2 ? 1 : 0.7); S.lastShotXg = ev.xg ?? 0; }
  else if ((ev.type === 'arret' || ev.type === 'tir_rate') && (S.lastShotXg ?? 0) >= 0.15) { sound.ooh(); S.lastShotXg = 0; }
  else if (ev.type === 'but' && S.pace.mode !== 'tf') sound.goal();
}

function goalBanner(ev) {
  const m = S.m, el = $('#goal-banner');
  const t = m.teams[ev.team];
  const mine = S.career && ev.player === S.ctl.userId && !ev.own;
  const scorer = ev.player != null && !ev.own ? m.players[ev.player] : null;
  const scorerFace = scorer ? matchFace(m, scorer, S.career?.face ?? null) : null;
  el.innerHTML = `<span class="gb-crest">${scorerFace != null ? `<span class="gb-face">${face(scorer, 84)}<span class="gb-mini">${crestSVG({ id: t.def.clubId ?? t.def.id, name: t.def.name }, 30)}</span></span>` : crestSVG({ id: t.def.clubId ?? t.def.id, name: t.def.name }, 64)}</span>
    <span class="gb-txt"><strong>${mine ? 'Tu marques' : ev.own ? 'Contre son camp' : 'But'}</strong>
    <span class="gb-who">${scorer ? esc(scorer.name) : esc(t.name)} · ${esc(ev.minute)}'</span>
    <span class="gb-score">${esc(m.teams[0].short)} <b>${m.score[0]}</b><i>–</i><b>${m.score[1]}</b> ${esc(m.teams[1].short)}</span></span>`;
  el.style.setProperty('--team', t.colors.primary); el.style.setProperty('--team2', t.colors.secondary);
  S.renderer.celebrate(t.colors);
  el.hidden = false; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  S.goalUntil = performance.now() + 3000;
  clearTimeout(S.goalTimer); S.goalTimer = setTimeout(() => { el.hidden = true; }, 3000);
}

function addFeed(ev) {
  if (ev.hidden || !FEED_TYPES.has(ev.type)) return;
  if (!ev.major && !['consigne', 'remplacement', 'hors_jeu', 'corner', 'tir_rate', 'contre', 'faute'].includes(ev.type)) return;
  const li = document.createElement('li');
  if (ev.type === 'but') li.className = 'goal';
  const t = ev.team != null ? S.m.teams[ev.team] : null;
  li.innerHTML = `<span class="min">${esc(ev.minute)}'</span><span class="dot" style="background:${t ? t.colors.primary : 'transparent'}"></span><span>${esc(ev.text)}</span>`;
  if (['but', 'tir', 'arret', 'penalty', 'faute', 'carton'].includes(ev.type)) {
    const b = document.createElement('button');
    b.innerHTML = `${icon('replay', 14)} revoir`;
    b.title = 'Revoir en lecture seule';
    b.addEventListener('click', () => openReplay(ev.frame));
    li.append(' ', b);
  }
  $('#feed').prepend(li);
  while ($('#feed').children.length > 250) $('#feed').lastChild.remove();
}

// ------------------------------------------------------------------ replay (lecture seule)
function openReplay(frameIdx) {
  const m = S.m;
  if (!m.frames.length) { toast('Aucune action enregistrée à revoir.'); return; }
  const target = frameIdx ?? lastKeyFrame();
  if (target == null) { toast('Aucune action enregistrée à revoir.'); return; }
  const end = Math.min(m.frames.length - 1, target + 12);
  const start = Math.max(0, target - 40);
  if (end <= start) { toast('Action trop récente : elle n\'est pas encore enregistrée.'); return; }
  S.paused = true; // le direct se met en pause à l'ouverture du replay
  S.replay = { start, end, cursor: start, playing: true };
  refreshUI(true);
}

function lastKeyFrame() {
  const evs = S.m.events.filter((e) => ['but', 'tir', 'arret', 'faute', 'carton', 'penalty'].includes(e.type) && !e.hidden);
  return evs.length ? evs[evs.length - 1].frame : null;
}

function closeReplay() {
  if (!S.replay) return;
  S.replay = null; // l'état canonique n'a pas bougé : on retrouve exactement la pause
  refreshUI(true);
}

// ------------------------------------------------------------------ interface
function refreshUI(force) {
  const m = S.m;
  if (!m) return;
  $('#score').textContent = `${m.score[0]} – ${m.score[1]}`;
  const reds = m.teams.map((t) => t.stats.reds);
  $('#clock-t').textContent = m.clock();
  $('#clock-x').textContent = ` · ${m.period === 1 ? '1re' : '2e'} mi-temps${m.added[m.period - 1] ? ` (+${m.added[m.period - 1]})` : ''}${reds[0] || reds[1] ? ` · rouges ${reds[0]}-${reds[1]}` : ''}`;
  const badge = $('#mode-badge');
  if (S.replay && !S.replay.hl) { badge.textContent = 'REPLAY'; badge.className = 'badge replay'; }
  else if (m.phase === 'fulltime') { badge.textContent = 'TERMINÉ'; badge.className = 'badge'; }
  else if (S.paused) { badge.textContent = 'PAUSE'; badge.className = 'badge pause'; }
  else { badge.textContent = `DIRECT ${S.speed}×`; badge.className = 'badge live'; }
  $('#btn-play').innerHTML = S.paused ? `<span class="ico">${icon('play', 18)}</span><span class="lbl">Reprendre</span>` : `<span class="ico">${icon('pause', 18)}</span><span class="lbl">Pause</span>`;
  document.body.classList.toggle('ctl-manual', false);
  $('#btn-play').disabled = !!S.replay || m.phase === 'fulltime';
  $('#btn-live').hidden = !S.replay;
  $('#btn-replay').hidden = !!S.replay;
  $('#replay-banner').hidden = !S.replay;
  $('#btn-quick').disabled = m.phase === 'fulltime' || !!S.replay;
  const manual = S.ctl.enabled && S.ctl.manual;
  const court = S.pace.mode === 'court';
  document.querySelector('.speed').hidden = court || S.pace.mode === 'tf';
  if (S.pace.mode === 'tf' && !S.paused && m.phase !== 'fulltime') {
    badge.textContent = S.replay?.hl ? 'TEMPS FORT' : S.choice ? 'À TOI DE CHOISIR' : m.t < S.hl.follow ? 'SUITE DE L\'ACTION' : `ACCÉLÉRÉ ×${Math.round(S.pace.cur)}`;
    badge.className = `badge ${S.replay?.hl || S.choice ? 'live' : 'fast'}`;
  } else if (court && !S.replay && !S.paused && m.phase !== 'fulltime') {
    badge.textContent = S.choice ? 'À TOI DE CHOISIR' : S.pace.isLive ? 'TEMPS FORT' : `ACCÉLÉRÉ ×${Math.round(S.pace.cur)}`;
    badge.className = `badge ${S.pace.isLive ? 'live' : 'fast'}`;
  }
  document.querySelectorAll('.speed button').forEach((b) => {
    b.classList.toggle('active', Number(b.dataset.speed) === S.speed);
    b.disabled = false;
  });
  const bc = $('#btn-ctl'), bz = $('#btn-zoom');
  bc.hidden = !S.ctl.enabled; bz.hidden = !S.career || S.ctl.userId == null;
  bc.innerHTML = S.ctl.manual ? `<span class="ico">${icon('target', 18)}</span><span class="lbl">Choix</span>` : `<span class="ico">${icon('auto', 18)}</span><span class="lbl">Auto</span>`;
  bc.classList.toggle('active', S.ctl.manual);
  bz.innerHTML = `<span class="ico">${icon('zoom', 18)}</span><span class="lbl">${S.ctl.zoom <= 1 ? 'Large' : S.ctl.zoom < 2 ? 'Moyen' : 'Proche'}</span>`;
  if ((S.paused || S.replay || m.phase === 'fulltime') && S.choice) { /* le choix reste affiché */ }
  renderLeft();
  renderRight();
}

function energyState(p) {
  // estimation du staff : catégories, pas de jauge exacte
  if (p.energy > 0.82) return ['Frais', 'fresh'];
  if (p.energy > 0.68) return ['Correct', 'ok'];
  if (p.energy > 0.55) return ['Entamé', 'tired'];
  return ['Épuisé', 'spent'];
}

function renderLeft() {
  const m = S.m;
  const ti = viewTeamIdx();
  const team = m.teams[ti];
  const own = userTeamIdx() === ti;
  const seeState = own || (S.career && S.career.followTeam === ti); // coéquipiers : état estimé visible
  $('#left-team').textContent = team.short;
  const xi = team.slotPlayer.map((id, slot) => ({ id, slot }));
  const xiEl = $('#xi');
  xiEl.innerHTML = '';
  for (const { id, slot } of xi) {
    const li = document.createElement('li');
    if (id == null) {
      li.className = 'off';
      li.innerHTML = `<span class="num">—</span><span>Poste vacant <span class="meta">(${esc(ROLE_LABELS[team.slots[slot].role])})</span></span><span></span>`;
      xiEl.append(li); continue;
    }
    const p = m.players[id];
    const [lbl, cls] = energyState(p);
    if (S.selectedId === p.id || S.subDraft.outId === p.id) li.classList.add('sel');
    li.innerHTML = `<span class="num">${p.num}</span><span class="pl-name">${face(p, 24)}${esc(p.name)} <span class="meta">${ROLE_ABBR[p.role]}</span>${p.yellow ? '<span class="card-y" title="Averti"></span>' : ''}${p.injured ? '<span class="inj" title="Gêne physique signalée">+</span>' : ''}</span>${seeState ? `<span class="state ${cls}" title="Estimation du staff">${lbl}</span>` : '<span class="state" title="État non connu">—</span>'}`;
    li.addEventListener('click', () => onPlayerClick(p.id, 'xi'));
    li.addEventListener('dragover', (e) => { if (own) e.preventDefault(); });
    li.addEventListener('drop', (e) => { e.preventDefault(); const inId = Number(e.dataTransfer.getData('text/plain')); S.subMode = true; S.subDraft = { outId: p.id, inId }; S.subError = null; renderLeft(); });
    xiEl.append(li);
  }
  const benchEl = $('#bench');
  benchEl.innerHTML = '';
  const benchIds = [...team.bench, ...m.players.filter((p) => p.team === ti && p.used && !p.onPitch && !team.slotPlayer.includes(p.id) && !team.bench.includes(p.id)).map((p) => p.id)];
  for (const id of benchIds) {
    const p = m.players[id];
    const li = document.createElement('li');
    const gone = p.used && !p.onPitch;
    if (gone) li.className = 'off';
    if (S.subDraft.inId === p.id || S.selectedId === p.id) li.classList.add('sel');
    li.innerHTML = `<span class="num">${p.num}</span><span class="pl-name">${face(p, 24)}${esc(p.name)} <span class="meta">${ROLE_ABBR[p.role]}</span>${p.sentOff ? '<span class="card-r"></span>' : ''}</span><span class="state">${gone ? (p.sentOff ? 'expulsé' : 'sorti') : 'banc'}</span>`;
    if (!gone) {
      li.draggable = own;
      li.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/plain', String(p.id)));
      li.addEventListener('click', () => onPlayerClick(p.id, 'bench'));
    }
    benchEl.append(li);
  }
  $('#subs-info').textContent = `${team.subsUsed}/${m.competition.maxSubs} changements · ${team.windowsUsed}/${m.competition.maxSubWindows} fenêtres`;

  // brouillon de remplacement
  const box = $('#sub-draft');
  if (own && m.phase !== 'fulltime') {
    box.hidden = false;
    if (!S.subMode) {
      box.innerHTML = '<button id="sub-start">Préparer un remplacement</button> <span class="muted">ou glisser un remplaçant sur un titulaire</span>';
      box.querySelector('#sub-start').addEventListener('click', () => { S.subMode = true; S.subDraft = { outId: null, inId: null }; S.subError = null; renderLeft(); });
    } else {
      const out = S.subDraft.outId != null ? m.players[S.subDraft.outId] : null;
      const inn = S.subDraft.inId != null ? m.players[S.subDraft.inId] : null;
      const ready = out && inn;
      box.innerHTML = `<strong>Brouillon de remplacement</strong> <span class="st préparé">préparé</span>
        <div>Sortant : ${out ? `n° ${out.num} ${esc(out.name)} (${ROLE_ABBR[out.role]})` : '<em>cliquer un titulaire</em>'}</div>
        <div>Entrant : ${inn ? `n° ${inn.num} ${esc(inn.name)} (${ROLE_ABBR[inn.role]})` : '<em>cliquer un remplaçant</em>'}</div>
        ${ready && out.role !== inn.role ? `<div class="muted">Poste différent : ${esc(ROLE_LABELS[inn.role])} sur un poste de ${esc(ROLE_LABELS[out.role])}.</div>` : ''}
        ${S.subError ? `<div class="error">${esc(S.subError)}</div>` : ''}
        <div class="row"><button class="primary" id="sub-confirm" ${ready ? '' : 'disabled'}>Confirmer la demande</button><button id="sub-cancel">Annuler</button></div>`;
      box.querySelector('#sub-confirm').addEventListener('click', confirmSub);
      box.querySelector('#sub-cancel').addEventListener('click', () => { S.subMode = false; S.subDraft = { outId: null, inId: null }; S.subError = null; renderLeft(); });
    }
  } else box.hidden = true;

  const reqEl = $('#sub-requests');
  reqEl.innerHTML = '';
  if (own) {
    for (const r of [...team.subRequests].reverse()) {
      const li = document.createElement('li');
      const out = m.players[r.outId], inn = m.players[r.inId];
      li.innerHTML = `<span>${esc(inn?.name ?? '?')} ↔ ${esc(out?.name ?? '?')}${r.reason ? `<br><span class="muted">${esc(r.reason)}</span>` : ''}${r.source === 'staff' ? ' <span class="muted">(staff)</span>' : ''}</span><span class="st ${r.status}">${r.status}</span>`;
      if (r.status === 'demandé') {
        const b = document.createElement('button'); b.textContent = 'Annuler';
        b.addEventListener('click', () => { S.m.queueCommand({ type: 'cancelSub', team: team.idx, id: r.id }); S.uiDirty = true; });
        li.append(b);
      }
      reqEl.append(li);
    }
  }
}

function onPlayerClick(id, where) {
  const m = S.m;
  const p = m.players[id];
  if (S.subMode && p.team === userTeamIdx()) {
    if (where === 'xi') S.subDraft.outId = id; else S.subDraft.inId = id;
    S.subError = null;
  }
  S.selectedId = id;
  renderLeft(); renderPlayerCard();
}

function confirmSub() {
  const m = S.m, ti = userTeamIdx();
  const { outId, inId } = S.subDraft;
  const v = m.validateSub(ti, outId, inId);
  if (!v.ok) { S.subError = v.reason; renderLeft(); return; } // rejet : rien ne change sur le terrain
  m.queueCommand({ type: 'sub', team: ti, outId, inId, source: 'manager' });
  S.subMode = false; S.subDraft = { outId: null, inId: null };
  toast('Remplacement demandé : il sera effectué au prochain arrêt de jeu.');
  S.uiDirty = true;
}

// ------------------------------------------------------------------ panneau droit
function renderRight() {
  document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === S.tab));
  for (const t of ['consignes', 'analyse', 'staff']) $(`#tab-${t}`).hidden = S.tab !== t;
  if (S.tab === 'consignes') { if (S.career) renderMine(); else renderConsignes(); }
  if (S.tab === 'analyse') renderAnalyse();
  if (S.tab === 'staff') renderStaff();
  renderPlayerCard();
}

// Carrière : ton match en direct (faits observés, note provisoire)
function renderMine() {
  const m = S.m, el = $('#tab-consignes');
  const u = S.ctl.userId != null ? m.players[S.ctl.userId] : null;
  if (!u) { el.innerHTML = '<p class="muted">Tu suis ce match depuis la tribune : tu n\'es pas dans le groupe.</p>'; return; }
  const team = m.teams[u.team];
  const st = u.stats;
  const mins = u.used ? Math.max(1, Math.round(st.distance > 0 ? Math.min(95, (m.t - (u.enteredAt ?? 0)) / 60) : 0)) : 0;
  const diff = Math.sign(m.score[u.team] - m.score[1 - u.team]);
  const rating = u.used && st.distance > 50 ? matchRating({ ...st, saves: 0 }, diff, Math.max(1, mins), u.role) : null;
  const status = u.sentOff ? 'Expulsé' : u.onPitch ? 'Sur le terrain' : u.used ? 'Remplacé' : 'Sur le banc — le coach peut te faire entrer';
  const e = Math.round(u.energy * 100);
  const touch = matchMedia('(pointer: coarse)').matches;
  el.innerHTML = `
    <div class="me-head"><strong>n° ${u.num} ${esc(u.name)}</strong><span class="muted">${esc(ROLE_LABELS[u.role])} · ${esc(team.short)}</span></div>
    <p><span class="st ${u.onPitch ? 'active' : 'transmise'}">${esc(status)}</span>${u.yellow ? ' <span class="card-y"></span> averti' : ''}${u.injured ? ' <span class="inj">+</span> gêné' : ''}</p>
    <div class="me-grid">
      <div><b>${rating ? rating.toFixed(1) : '—'}</b><span>note provisoire</span></div>
      <div><b>${st.goals}</b><span>but(s)</span></div>
      <div><b>${st.passesOk}/${st.passes}</b><span>passes</span></div>
      <div><b>${st.shots}</b><span>tir(s)</span></div>
      <div><b>${st.tackles}</b><span>tacle(s)</span></div>
      <div><b>${(st.distance / 1000).toFixed(1)}</b><span>km</span></div>
    </div>
    <div class="gauge"><span>Énergie</span><span class="bar"><i class="${e > 66 ? 'good' : e > 45 ? 'mid' : 'low'}" style="width:${e}%"></i></span></div>
    ${S.ctl.enabled ? `<h2>Tes choix</h2>
    <p>${S.ctl.manual ? `Aux moments clés, le match se fige et tu choisis : passe, profondeur, frappe, dribble, centre ; sans ballon : presser, tacler, couper une passe, faire un appel ou demander le ballon. Choix faits ce match : <b>${S.ctl.made}</b>.` : 'Choix désactivés : l\'IA joue pour toi. Touche le bouton « Auto » pour les réactiver.'}</p>
    <p class="muted">Les indications (risque, chances de marquer) sont des estimations : la réussite dépend de ta technique, de la pression et de la fatigue. Clavier : touches 1 à 4, 0 pour laisser l'instinct décider.</p>`
    : u.role === 'GK' ? '<p class="muted">Le pilotage direct du gardien n\'est pas encore disponible : l\'IA joue pour toi.</p>' : ''}`;
}

function effectiveTactics(team) {
  const eff = { ...team.tactics };
  for (const i of team.instructions) if (i.status === 'transmise') Object.assign(eff, i.changes);
  for (const v of S.validated) if (S.m.commands.includes(v.cmd)) Object.assign(eff, v.changes);
  return eff;
}

function renderConsignes(force = false) {
  const m = S.m, el = $('#tab-consignes');
  const ti = userTeamIdx();
  if (ti == null) {
    el.innerHTML = `<p class="muted">Mode observateur : les consignes sont réservées aux managers.</p>${m.teams.map((t) => `<p><strong>${esc(t.name)}</strong> — ${esc(t.def.identity)}<br><span class="muted">Active : pressing ${esc(t.tactics.pressing)}, bloc ${esc(t.tactics.bloc)}, style ${esc(t.tactics.style)}</span></p>`).join('')}`;
    return;
  }
  const team = m.teams[ti];
  if (!force && document.activeElement && el.contains(document.activeElement) && document.activeElement.tagName === 'SELECT') return; // ne pas casser une sélection en cours
  S.validated = S.validated.filter((v) => S.m.commands.includes(v.cmd));
  const base = effectiveTactics(team);
  // le brouillon n'existe que si l'utilisateur modifie quelque chose
  const draft = S.draft || base;
  const diff = Object.keys(draft).filter((k) => draft[k] !== base[k]);
  if (S.draft && !diff.length) { S.draft = null; S.draftHistory = []; }
  el.innerHTML = `
    <p class="muted">Trois intentions principales (mode essentiel). Un brouillon ne touche pas le moteur.</p>
    ${Object.keys(INSTRUCTION_OPTIONS).map((k) => `
      <div class="field"><label for="ins-${k}">${esc(INSTRUCTION_LABELS[k])}</label>
        <select id="ins-${k}" data-key="${k}">${INSTRUCTION_OPTIONS[k].map((o) => `<option ${draft[k] === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>
        <span class="active-val">active : ${esc(team.tactics[k])}${base[k] !== team.tactics[k] ? ` → transmise : ${esc(base[k])}` : ''}</span></div>`).join('')}
    <div class="draft-box" ${diff.length ? '' : 'hidden'}>
      <strong>Projet en attente</strong> <span class="st validée">brouillon</span>
      <div>${diff.map((k) => `${esc(INSTRUCTION_LABELS[k])} : ${esc(base[k])} → <strong>${esc(draft[k])}</strong>`).join('<br>')}</div>
      ${S.draftError ? `<div class="error">${esc(S.draftError)}</div>` : ''}
      <div class="row"><button class="primary" id="ins-send" title="Entrée">Transmettre</button><button id="ins-undo" title="Ctrl+Z">Annuler la modification</button><button id="ins-reset">Abandonner le brouillon</button></div>
    </div>
    <h2>Suivi des consignes</h2>
    <ul class="status-list" id="ins-list"></ul>`;
  el.querySelectorAll('select').forEach((s) => s.addEventListener('change', () => {
    const cur = S.draft || { ...effectiveTactics(team) };
    S.draftHistory.push({ ...cur });
    S.draft = { ...cur, [s.dataset.key]: s.value }; S.draftError = null;
    const id = s.id;
    renderConsignes(true);
    document.getElementById(id)?.focus();
  }));
  el.querySelector('#ins-send')?.addEventListener('click', transmitDraft);
  el.querySelector('#ins-undo')?.addEventListener('click', undoDraft);
  el.querySelector('#ins-reset')?.addEventListener('click', () => { S.draft = null; S.draftHistory = []; S.draftError = null; renderConsignes(); });
  const list = el.querySelector('#ins-list');
  for (const v of S.validated) {
    const li = document.createElement('li');
    li.innerHTML = `<span>${Object.entries(v.changes).map(([k, val]) => `${esc(k)} ${esc(val)}`).join(', ')}</span><span class="st validée">validée</span>`;
    list.append(li);
  }
  for (const ins of [...team.instructions].reverse()) {
    const li = document.createElement('li');
    const last = ins.history[ins.history.length - 1];
    li.innerHTML = `<span>${Object.entries(ins.changes).map(([k, val]) => `${esc(k)} ${esc(val)}`).join(', ')}${ins.reason ? `<br><span class="muted">${esc(ins.reason)}</span>` : ''}${last?.reason ? `<br><span class="muted">${esc(last.reason)}</span>` : ''}</span><span class="st ${ins.status}">${ins.status}</span>`;
    if (ins.status === 'transmise') {
      const b = document.createElement('button'); b.textContent = 'Annuler';
      b.addEventListener('click', () => { S.m.queueCommand({ type: 'cancelInstruction', team: ti, id: ins.id }); S.uiDirty = true; });
      li.append(b);
    }
    list.append(li);
  }
}

function transmitDraft() {
  const m = S.m, ti = userTeamIdx();
  if (ti == null || !S.draft) return;
  const base = effectiveTactics(m.teams[ti]);
  const changes = {};
  for (const k of Object.keys(S.draft)) if (S.draft[k] !== base[k]) changes[k] = S.draft[k];
  const v = m.validateInstruction(ti, changes);
  if (!v.ok) { S.draftError = v.reason; renderConsignes(); return; } // rejet : la tactique active reste en place
  const cmd = m.queueCommand({ type: 'instruction', team: ti, changes, source: 'manager' });
  S.validated.push({ cmd, changes });
  S.draft = null; S.draftHistory = []; S.draftError = null;
  toast(S.paused ? 'Consigne validée : elle sera transmise à la reprise.' : 'Consigne transmise : elle deviendra active au prochain arrêt ou une fois relayée.');
  renderConsignes();
}

function undoDraft() {
  if (!S.draftHistory.length) return;
  S.draft = S.draftHistory.pop();
  renderConsignes();
}

function renderAnalyse() {
  const m = S.m, el = $('#tab-analyse');
  const [a, b] = m.teams.map((t) => t.stats);
  const totP = a.possession + b.possession || 1;
  const pct = (x, y) => (y ? `${Math.round((100 * x) / y)} %` : '—');
  const rows = [
    ['Possession', `${Math.round((100 * a.possession) / totP)} %`, `${Math.round((100 * b.possession) / totP)} %`],
    ['Tirs', a.shots, b.shots], ['Cadrés', a.onTarget, b.onTarget], ['xG pré-tir', a.xg.toFixed(2), b.xg.toFixed(2)],
    ['Passes réussies', `${a.passesOk}/${a.passes}`, `${b.passesOk}/${b.passes}`], ['Réussite passes', pct(a.passesOk, a.passes), pct(b.passesOk, b.passes)],
    ['Tacles gagnés', a.tackles, b.tackles], ['Arrêts', a.saves, b.saves], ['Corners', a.corners, b.corners],
    ['Fautes', a.fouls, b.fouls], ['Cartons J/R', `${a.yellows}/${a.reds}`, `${b.yellows}/${b.reds}`], ['Hors-jeu', a.offsides, b.offsides],
  ];
  el.innerHTML = `<table class="stats"><tr><td>${esc(m.teams[0].short)}</td><td></td><td>${esc(m.teams[1].short)}</td></tr>${rows.map((r) => `<tr><td>${r[1]}</td><td>${r[0]}</td><td>${r[2]}</td></tr>`).join('')}</table>
    <canvas id="shotmap" width="315" height="204"></canvas>
    <p class="muted">Carte des tirs (taille = xG pré-tir, or = but). Le xG est une sortie du modèle, pas une vérité certifiée.</p>`;
  const shots = m.events.filter((e) => e.type === 'tir').map((e) => {
    const i = m.events.indexOf(e);
    const goal = m.events.slice(i + 1, i + 4).some((x) => x.type === 'but' && x.player === e.player);
    return { x: e.x, y: e.y, xg: e.xg, team: e.team, goal };
  });
  PitchRenderer.drawShotMap(el.querySelector('#shotmap'), shots, m.teams);
}

function renderStaff() {
  const m = S.m, el = $('#tab-staff');
  const ti = userTeamIdx();
  if (ti == null) { el.innerHTML = '<p class="muted">Le staff ne conseille que le manager.</p>'; return; }
  const team = m.teams[ti], opp = m.teams[1 - ti];
  const msgs = [];
  const tired = m.onPitch(ti).filter((p) => p.role !== 'GK' && p.energy < 0.62).sort((x, y) => x.energy - y.energy);
  for (const p of tired.slice(0, 3)) msgs.push([`n° ${p.num} ${p.name} paraît ${energyState(p)[0].toLowerCase()}.`, 'Estimation visuelle du staff (courses répétées, temps de récupération).']);
  for (const p of m.onPitch(ti).filter((q) => q.yellow)) msgs.push([`n° ${p.num} ${p.name} est averti : un second carton l'exclurait.`, 'Fait : carton jaune reçu.']);
  for (const p of m.onPitch(ti).filter((q) => q.injured)) msgs.push([`n° ${p.num} ${p.name} joue avec une gêne : sa vitesse est réduite.`, 'Fait : contact signalé, diagnostic non posé.']);
  const ownLeft = team.dir > 0 ? 'Left' : 'Right';
  const crossesAgainst = opp.stats[`crosses${ownLeft === 'Left' ? 'Right' : 'Left'}`];
  if (opp.stats.crossesLeft + opp.stats.crossesRight >= 4) msgs.push([`L'adversaire a centré ${opp.stats.crossesLeft + opp.stats.crossesRight} fois (${opp.stats.crossesLeft} d'un côté, ${opp.stats.crossesRight} de l'autre).`, 'Fait observé : centres comptés depuis le début.']);
  if (opp.stats.shots >= team.stats.shots + 5) msgs.push([`Nous concédons ${opp.stats.shots} tirs pour ${team.stats.shots} tentés.`, 'Fait observé ; un bloc plus bas ou un pressing différent peut changer la répartition, sans garantie.']);
  if (team.stats.offsides >= 3) msgs.push([`${team.stats.offsides} hors-jeu signalés contre nous : les appels partent trop tôt.`, 'Fait observé : drapeaux levés.']);
  if (crossesAgainst == null) { /* rien */ }
  const left = m.competition.maxSubs - team.subsUsed;
  msgs.push([`Il reste ${left} changement(s) et ${m.competition.maxSubWindows - team.windowsUsed} fenêtre(s).`, 'Configuration de compétition de test (non validée réglementairement).']);
  el.innerHTML = msgs.map(([t, s]) => `<div class="staff-msg">${esc(t)}<span class="src">${esc(s)}</span></div>`).join('');
}

function renderPlayerCard() {
  const el = $('#player-card');
  const m = S.m;
  if (S.selectedId == null) { el.hidden = true; return; }
  const p = m.players[S.selectedId];
  const own = p.team === userTeamIdx();
  const team = m.teams[p.team];
  el.hidden = false;
  el.innerHTML = `<strong>n° ${p.num} ${esc(p.name)}</strong> — ${esc(team.short)}<br>
    ${esc(ROLE_LABELS[p.role])} · <span class="muted">profil synthétique</span><br>
    ${own ? `État estimé : ${energyState(p)[0]} · ${p.stats.passesOk}/${p.stats.passes} passes · ${p.stats.shots} tir(s) · ${p.stats.goals} but(s) · ${p.stats.tackles} tacle(s) · ${(p.stats.distance / 1000).toFixed(1)} km`
      : `Cartons : ${p.yellow ? 'averti' : 'aucun'} · ${p.stats.goals} but(s)<br><span class="muted">Attributs et état physique non révélés.</span>`}
    <div class="row" style="margin-top:6px"><button id="card-close">Fermer</button></div>`;
  el.querySelector('#card-close').addEventListener('click', () => { S.selectedId = null; renderPlayerCard(); renderLeft(); });
}

// ------------------------------------------------------------------ modales
function openModal(html, { closable = true, onClose } = {}) {
  S.modalOpen = true;
  const root = $('#modal-root');
  root.innerHTML = `<div class="modal-backdrop"><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`;
  root.dataset.closable = closable ? '1' : '';
  S.onModalClose = onClose || null;
  const first = root.querySelector('button.primary, select, input, button');
  first?.focus({ preventScroll: true });
  const modal = root.querySelector('.modal');
  if (modal) modal.scrollTop = 0;
  return modal;
}

function closeModal() {
  const root = $('#modal-root');
  if (!root.innerHTML) return;
  root.innerHTML = '';
  S.modalOpen = false;
  const cb = S.onModalClose; S.onModalClose = null;
  cb?.();
}

function showSetup() {
  const opts = TEAM_DEFS.map((t) => `<option value="${t.id}">${esc(t.name)} — ${esc(t.formation)}</option>`).join('');
  const prev = S.config || { home: 'coteaux', away: 'littoral', role: '0', seed: String(Math.floor(Math.random() * 1e6)), delegate: false };
  const modal = openModal(`
    <h1>Generation Football — match V1</h1>
    <p class="muted">Moteur spatial à agents et événements, vue tactique 2D. Le score n'est jamais fixé avant le match.</p>
    <div class="grid2">
      <label>Équipe A (cercles)<select id="su-home">${opts}</select></label>
      <label>Équipe B (carrés)<select id="su-away">${opts}</select></label>
    </div>
    <div id="su-ident" class="note"></div>
    <div class="grid2">
      <label>Rôle<select id="su-role"><option value="0">Manager de l'équipe A</option><option value="1">Manager de l'équipe B</option><option value="observer">Observateur</option></select></label>
      <label>Graine (reproductibilité)<input type="text" id="su-seed" value="${esc(prev.seed)}"></label>
    </div>
    <label>Durée du match<select id="su-length"><option value="tf">Temps forts (≈ 2 min, actions clés au ralenti)</option><option value="court">Match court (≈ 4 min 30)</option><option value="reel">Temps réel (vitesses 1× à 8×)</option></select></label>
    <label><input type="checkbox" id="su-delegate" ${prev.delegate ? 'checked' : ''}> Déléguer les remplacements au staff</label>
    <p class="note">Profils synthétiques : aucun club ni joueur réel n'est utilisé dans ce prototype. Le catalogue réel (docs/) reste bloqué à l'import tant que les identités et les droits ne sont pas vérifiés.</p>
    <div class="actions"><button id="su-help">Commandes</button><button class="primary" id="su-go">Lancer le match</button></div>`, { closable: !!S.m });
  const home = modal.querySelector('#su-home'), away = modal.querySelector('#su-away');
  home.value = prev.home; away.value = prev.away; modal.querySelector('#su-role').value = prev.role;
  modal.querySelector('#su-length').value = matchLength();
  const ident = () => {
    const h = TEAM_DEFS.find((t) => t.id === home.value), a = TEAM_DEFS.find((t) => t.id === away.value);
    modal.querySelector('#su-ident').innerHTML = `<strong>${esc(h.name)}</strong> : ${esc(h.identity)}<br><strong>${esc(a.name)}</strong> : ${esc(a.identity)}`;
  };
  home.addEventListener('change', ident); away.addEventListener('change', ident); ident();
  modal.querySelector('#su-help').addEventListener('click', () => showHelp(true));
  modal.querySelector('#su-go').addEventListener('click', () => {
    if (home.value === away.value) { toast('Choisissez deux équipes différentes.'); return; }
    setMatchLength(modal.querySelector('#su-length').value);
    startMatch({ home: home.value, away: away.value, role: modal.querySelector('#su-role').value, seed: modal.querySelector('#su-seed').value.trim() || 'graine', delegate: modal.querySelector('#su-delegate').checked });
  });
}

function showHelp(fromSetup = false) {
  const rows = [
    ['Espace', 'Pause / reprendre (solo). Rien ne bouge pendant la pause.'],
    ['Échap', 'Ferme la couche au premier plan (aide, fenêtre, replay), sinon ouvre le menu.'],
    ['F1', 'Cette aide.'],
    ['F8', 'Revoir la dernière action enregistrée (lecture seule, le direct se met en pause).'],
    ['F9 / bouton « Direct »', 'Revenir au direct, exactement à l\'état laissé en pause.'],
    ['1', 'Composition et banc.'],
    ['2 / 3', 'Consignes d\'équipe (organisation et intentions).'],
    ['4', 'Analyse : statistiques et carte des tirs.'],
    ['5', 'Staff : recommandations fondées sur des faits observés.'],
    ['Entrée (panneau consignes)', 'Transmettre le projet de consigne.'],
    ['Ctrl + Z (panneau consignes)', 'Annuler la dernière modification du brouillon (jamais une consigne transmise).'],
    ['+ / − (pavé numérique)', 'Accélérer / ralentir (1×, 2×, 4×, 8×).'],
    ['Clic sur le terrain', 'Sélectionner un joueur et ouvrir sa fiche autorisée.'],
    ['Glisser un remplaçant sur un titulaire', 'Préparer un remplacement, puis confirmer.'],
    ['Carrière — ZQSD / flèches, Maj', 'Déplacer ton joueur, sprinter. Sur téléphone : stick dans la moitié gauche de l\'écran.'],
    ['Carrière — E · F · R · A · C', 'Passe (ou tacle sans ballon) · tir · jeu long ou centre · passe dans la course · demander le ballon.'],
    ['Carrière — bouton Manuel / Auto', 'Piloter ton joueur ou le confier à l\'IA (nécessaire pour accélérer le temps).'],
  ];
  openModal(`<h1>Commandes du manager</h1>
    <table class="help-table">${rows.map(([k, v]) => `<tr><td><kbd>${esc(k)}</kbd></td><td>${esc(v)}</td></tr>`).join('')}</table>
    <p class="note">Les raccourcis ne se déclenchent pas quand un champ de saisie ou une fenêtre a le focus. Le pilotage direct concerne les joueurs de champ ; le gardien et les coups de pied arrêtés restent gérés par l'IA.</p>
    <div class="actions"><button class="primary" id="help-close">Fermer</button></div>`, { onClose: () => { if (fromSetup) showSetup(); } });
  $('#help-close').addEventListener('click', closeModal);
}

function showSummary() {
  const m = S.m;
  if (m.phase !== 'fulltime') return;
  const goals = m.events.filter((e) => e.type === 'but');
  const [a, b] = m.teams.map((t) => t.stats);
  const crest = (t, n) => crestSVG({ id: t.def.clubId ?? t.def.id, name: t.def.name }, n);
  const row = (label, x, y, fmt = (v) => v) => {
    const tot = (x + y) || 1;
    return `<div class="cmp"><b>${fmt(x)}</b><span>${label}</span><b>${fmt(y)}</b>
      <i class="cmp-bar"><i style="width:${(x / tot) * 100}%;background:${m.teams[0].colors.primary}"></i><i style="width:${(y / tot) * 100}%;background:${m.teams[1].colors.primary}"></i></i></div>`;
  };
  const pc = (t) => (t.passes ? Math.round((t.passesOk / t.passes) * 100) : 0);
  let me = '';
  if (S.career && S.ctl.userId != null) {
    const u = m.players[S.ctl.userId];
    const r = extractResult(m, S.career.followTeam);
    me = r.minutes ? `<div class="sum-me">${face(u, 64)}<div><span class="muted">Ton match</span><b class="sum-note">${r.rating.toFixed(1)}</b></div>
      <ul><li><b>${r.minutes}'</b>joués</li><li><b>${u.stats.goals}</b>but${u.stats.goals > 1 ? 's' : ''}</li><li><b>${u.stats.shots}</b>tir${u.stats.shots > 1 ? 's' : ''}</li><li><b>${u.stats.passesOk}/${u.stats.passes}</b>passes</li><li><b>${u.stats.tackles}</b>tacles</li><li><b>${S.ctl.made}</b>choix</li></ul></div>`
      : `<div class="sum-me">${face(u, 64)}<div><span class="muted">Ton match</span><b class="sum-note">—</b></div><p class="muted">Tu n'es pas entré en jeu.</p></div>`;
  }
  // tes décisions : issue réelle face à la chance annoncée
  const dec = m.userChoices ?? [];
  let decisions = '';
  if (S.career && dec.length) {
    const won = dec.filter((d) => d.ok).length;
    const known = dec.filter((d) => d.p != null);
    const exp = known.reduce((a, d) => a + d.p, 0), got = known.filter((d) => d.ok).length;
    const verdict = known.length < 3 ? '' : got > exp + 0.8 ? 'Mieux que prévu : tes choix ont payé.' : got < exp - 0.8 ? 'En dessous des chances annoncées : pas de réussite aujourd\'hui.' : 'Conforme aux chances annoncées.';
    decisions = `<h3>Tes décisions · ${won} réussie${won > 1 ? 's' : ''} sur ${dec.length}</h3>
      <ul class="sum-dec">${dec.map((d) => `<li class="${d.ok ? 'ok' : 'ko'}"><span class="min">${esc(d.minute)}'</span><span class="dl">${esc(d.label)}</span>${d.p != null ? `<span class="dp">${Math.round(d.p * 100)} %</span>` : '<span class="dp">—</span>'}<span class="dr">${d.ok ? '✓' : '✗'}</span></li>`).join('')}</ul>
      ${verdict ? `<p class="muted small">${verdict}${known.length ? ` Réussites attendues : ${exp.toFixed(1)} · obtenues : ${got}.` : ''}</p>` : ''}`;
  }
  openModal(`<div class="sum-head">${crest(m.teams[0], 54)}<h1>${esc(m.teams[0].name)} ${m.score[0]} – ${m.score[1]} ${esc(m.teams[1].name)}</h1>${crest(m.teams[1], 54)}</div>
    ${S.career ? '' : `<p class="muted small">Graine « ${esc(m.seed)} » · empreinte ${esc(m.fingerprint())}</p>`}
    ${me}${decisions}
    <h3>Buts</h3>${goals.length ? `<ul class="sum-goals">${goals.map((g) => `<li><span class="min">${esc(g.minute)}'</span>${g.player != null ? face(m.players[g.player], 24) : ''}<span>${esc(g.text.replace(/\s*\(.*\)\s*$/, ''))}</span></li>`).join('')}</ul>` : '<p>Aucun but.</p>'}
    <h3>Statistiques</h3>
    <div class="cmp-list">${row('Tirs', a.shots, b.shots)}${row('Cadrés', a.onTarget, b.onTarget)}${row('xG pré-tir', a.xg, b.xg, (v) => v.toFixed(2))}${row('Passes réussies', pc(a), pc(b), (v) => `${v} %`)}${row('Corners', a.corners ?? 0, b.corners ?? 0)}${row('Fautes', a.fouls, b.fouls)}</div>
    ${S.career ? '<div class="actions"><button id="sum-close">Revoir le match</button><button class="primary" id="sum-career">Retour à la carrière</button></div>'
    : '<div class="actions"><button id="sum-close">Revoir le match</button><button id="sum-home">Accueil</button><button id="sum-same">Rejouer avec la même graine</button><button class="primary" id="sum-new">Nouveau match</button></div>'}`);
  $('#sum-close').addEventListener('click', closeModal);
  if (S.career) {
    $('#sum-career').addEventListener('click', () => { closeModal(); const c = S.career; S.career = null; S.m = null; c.onFinish(m); });
    return;
  }
  $('#sum-same').addEventListener('click', () => startMatch({ ...S.config }));
  $('#sum-new').addEventListener('click', () => { closeModal(); showSetup(); });
  $('#sum-home').addEventListener('click', () => { closeModal(); S.m = null; S.onHome?.(); });
}

function quickResult() {
  const m = S.m;
  if (m.phase === 'fulltime') return;
  const ti = userTeamIdx();
  openModal(`<h1>Résultat rapide</h1>
    <p>La fin du match sera calculée par le même moteur, sans rendu ni interruption.${ti != null ? ' Votre staff prend en charge les décisions restantes (délégation explicite).' : ''}</p>
    <div class="actions"><button id="q-no">Annuler</button><button class="primary" id="q-yes">Simuler la fin</button></div>`);
  $('#q-no').addEventListener('click', closeModal);
  $('#q-yes').addEventListener('click', () => {
    closeModal();
    if (ti != null && !m.aiTeams.includes(ti)) m.aiTeams.push(ti);
    if (S.ctl.engaged) { m.queueCommand({ type: 'control', playerId: S.ctl.userId, on: false }); S.ctl.engaged = false; }
    S.ctl.manual = false; if (S.choice) pickChoice(-1);
    S.judge = null;
    S.quick = true;
    const chunk = () => {
      for (let i = 0; i < 3000 && m.phase !== 'fulltime'; i++) { m.step(); }
      handleNewEvents();
      refreshUI(true);
      if (m.phase !== 'fulltime') setTimeout(chunk, 0);
      else { S.quick = false; S.prev = snapshot(); }
    };
    chunk();
  });
}

function toast(text) {
  const el = $('#toast');
  el.textContent = text; el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 4500);
}

// ------------------------------------------------------------------ entrées
// Priorité : fenêtre modale, puis champ de saisie, puis rôle actif, puis raccourcis généraux.
function onKeyDown(e) {
  const root = $('#modal-root');
  if (S.modalOpen) {
    if (e.key === 'Escape' && root.dataset.closable) { e.preventDefault(); closeModal(); }
    if (e.key === 'F1') e.preventDefault();
    return; // une touche ne peut pas à la fois valider une fenêtre et agir sur le match
  }
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') {
    if (e.key === 'Escape') e.target.blur();
    return;
  }
  if (!S.m) return;
  // pilotage direct : touches de déplacement et de geste (jamais pendant une pause ou un replay)
  // choix ouvert : 1-4 pour choisir, Échap / 0 pour laisser l'instinct
  if (S.choice) {
    const n = Number(e.key);
    if (n >= 1 && n <= S.choice.list.length) { e.preventDefault(); pickChoice(n - 1); return; }
    if (e.key === '0') { e.preventDefault(); pickChoice(-1); return; }
  }
  const inConsignes = !S.career && $('#right').contains(document.activeElement) && S.tab === 'consignes';
  switch (e.key) {
    case ' ':
      e.preventDefault();
      if (S.replay) { S.replay.playing = !S.replay.playing; return; }
      if (S.m.phase !== 'fulltime' && !S.choice) { S.paused = !S.paused; S.acc = 0; refreshUI(true); }
      return;
    case 'Escape':
      e.preventDefault();
      if (document.body.classList.contains('show-left') || document.body.classList.contains('show-right')) { closeDrawers(); return; }
      if (S.replay) { closeReplay(); return; }
      if (S.selectedId != null) { S.selectedId = null; refreshUI(true); return; }
      if (S.subMode) { S.subMode = false; S.subDraft = { outId: null, inId: null }; refreshUI(true); return; }
      S.paused = true; refreshUI(true); showMenu();
      return;
    case 'F1': e.preventDefault(); S.paused = true; refreshUI(true); showHelp(); return;
    case 'F8': e.preventDefault(); openReplay(); return;
    case 'F9': e.preventDefault(); closeReplay(); return;
    case 'Enter':
      if (inConsignes && S.draft) { e.preventDefault(); transmitDraft(); }
      return;
    default: break;
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { if (S.tab === 'consignes') { e.preventDefault(); undoDraft(); } return; }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === '1') { $('#left').focus(); return; }
  if (e.key === '2' || e.key === '3') { S.tab = 'consignes'; renderRight(); return; }
  if (e.key === '4') { S.tab = 'analyse'; renderRight(); return; }
  if (e.key === '5') { S.tab = 'staff'; renderRight(); return; }
  if (e.code === 'NumpadAdd' || e.key === '+') { changeSpeed(1); return; }
  if (e.code === 'NumpadSubtract' || e.key === '-') { changeSpeed(-1); return; }
}

// Tiroirs (mise en page téléphone) : un seul ouvert à la fois
function toggleDrawer(side) {
  const cls = `show-${side}`, other = side === 'left' ? 'show-right' : 'show-left';
  document.body.classList.remove(other);
  document.body.classList.toggle(cls);
  if (side === 'right') renderRight(); else renderLeft();
}
function closeDrawers() { document.body.classList.remove('show-left', 'show-right'); }

function changeSpeed(d) {
  const speeds = [1, 2, 4, 8];
  const i = Math.max(0, Math.min(3, speeds.indexOf(S.speed) + d));
  S.speed = speeds[i];
  refreshUI(true);
}

// Menu du match (Échap sans couche ouverte, ou Retour sur Android)
function showMenu() {
  const career = !!S.career;
  openModal(`<h1>Menu du match</h1>
    <div class="actions" style="justify-content:flex-start">
      <button class="primary" id="mn-resume">Reprendre</button>
      <label class="inline">Durée <select id="mn-length"><option value="tf" ${S.pace.mode === 'tf' ? 'selected' : ''}>Temps forts (≈ 2 min)</option><option value="court" ${S.pace.mode === 'court' ? 'selected' : ''}>Match court (≈ 4 min 30)</option><option value="reel" ${S.pace.mode === 'reel' ? 'selected' : ''}>Temps réel</option></select></label>
      <button id="mn-help">Aide</button>
      ${career ? '<button id="mn-quick">Simuler la fin du match</button>' : '<button id="mn-new">Nouveau match</button><button id="mn-home">Accueil</button>'}
    </div>`);
  $('#mn-resume').addEventListener('click', () => { closeModal(); S.paused = false; refreshUI(true); });
  $('#mn-length').addEventListener('change', (e) => { setMatchLength(e.target.value); refreshUI(true); });
  $('#mn-help').addEventListener('click', () => showHelp());
  $('#mn-quick')?.addEventListener('click', () => { closeModal(); quickResult(); });
  $('#mn-new')?.addEventListener('click', () => showSetup());
  $('#mn-home')?.addEventListener('click', () => { closeModal(); S.m = null; S.onHome?.(); });
}

export function showQuickMatchSetup() { showSetup(); }
export function setHomeHandler(fn) { S.onHome = fn; }
export function initMatchUI() {
  bind();
  window.__gfPace = () => S.pace;
  // aide au test visuel : rejouer la célébration d'un but de l'équipe donnée
  window.__gfGoalFx = (team = 0) => S.m && goalBanner({ team, player: S.m.players.find((p) => p.team === team && p.role === 'ST')?.id ?? null, minute: S.m.minute(), own: false });
}

function bind() {
  S.renderer = new PitchRenderer($('#pitch'));
  // icônes des boutons fixes de la barre de match
  const setIco = (id, name, lbl) => { const b = $(id); if (b) b.innerHTML = `<span class="ico">${icon(name, 18)}</span>${lbl ? `<span class="lbl">${lbl}</span>` : ''}`; };
  setIco('#btn-left', 'squad'); setIco('#btn-right', 'board'); setIco('#btn-replay', 'replay', 'Replay');
  setIco('#btn-quick', 'skip', 'Résultat rapide'); setIco('#btn-help', 'help', 'Aide'); setIco('#btn-live', 'live', 'Direct');
  const soundIco = () => setIco('#btn-sound', sound.enabled ? 'sound' : 'mute');
  soundIco();
  $('#btn-sound').addEventListener('click', (e) => { e.currentTarget.blur(); sound.toggle(); soundIco(); });
  window.addEventListener('keydown', (e) => { if ((e.key === 'm' || e.key === 'M') && !e.target.closest?.('input, select, textarea') && S.m) { sound.toggle(); soundIco(); } });
  window.addEventListener('resize', () => { S.renderer.resize(); if (S.choice) S.choice.inset = panelInset($('#choices')); });
  new ResizeObserver(() => S.renderer.resize()).observe($('#center'));
  window.addEventListener('keydown', onKeyDown);
  $('#btn-ctl').addEventListener('click', (e) => { e.currentTarget.blur(); setManual(!S.ctl.manual); });
  $('#btn-zoom').addEventListener('click', (e) => { e.currentTarget.blur(); S.ctl.zoom = S.ctl.zoom <= 1 ? 1.7 : S.ctl.zoom < 2 ? 2.4 : 1; refreshUI(true); });
  $('#btn-play').addEventListener('click', (e) => { e.currentTarget.blur(); if (S.m && S.m.phase !== 'fulltime') { S.paused = !S.paused; S.acc = 0; refreshUI(true); } });
  document.querySelectorAll('.speed button').forEach((b) => b.addEventListener('click', () => { S.speed = Number(b.dataset.speed); b.blur(); refreshUI(true); }));
  $('#btn-replay').addEventListener('click', (e) => { e.currentTarget.blur(); if (S.m) openReplay(); });
  $('#btn-live').addEventListener('click', (e) => { e.currentTarget.blur(); closeReplay(); });
  $('#btn-help').addEventListener('click', (e) => { e.currentTarget.blur(); S.paused = true; refreshUI(true); showHelp(); });
  $('#btn-quick').addEventListener('click', (e) => { e.currentTarget.blur(); if (S.m) quickResult(); });
  document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => { S.tab = b.dataset.tab; renderRight(); }));
  $('#btn-left').addEventListener('click', (e) => { e.currentTarget.blur(); toggleDrawer('left'); });
  $('#btn-right').addEventListener('click', (e) => { e.currentTarget.blur(); toggleDrawer('right'); });
  $('#pitch').addEventListener('click', (e) => {
    if (!S.m) return;
    if (document.body.classList.contains('show-left') || document.body.classList.contains('show-right')) { closeDrawers(); return; }
    const r = e.currentTarget.getBoundingClientRect();
    const w = S.renderer.toWorld(e.clientX - r.left, e.clientY - r.top);
    let best = null, bd = 2.2;
    for (const p of S.m.players) {
      if (!p.onPitch) continue;
      const d = Math.hypot(p.x - w.x, p.y - w.y);
      if (d < bd) { bd = d; best = p; }
    }
    S.selectedId = best ? best.id : null; // la sélection ne transfère aucun contrôle
    refreshUI(true);
  });
  requestAnimationFrame(frame);
  // appelé par la coque Android quand l'application passe en arrière-plan
  window.gfPause = () => { if (S.m && !S.paused) { S.paused = true; S.acc = 0; refreshUI(true); } };
  document.addEventListener('visibilitychange', () => { if (document.hidden) window.gfPause(); });
}
