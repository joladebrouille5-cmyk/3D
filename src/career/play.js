// Pont carrière <-> moteur de match.
import { Match } from '../engine/match.js';
import { matchRating } from './career.js';

const TICKS_PER_MIN = 600;

// Crée le match de la semaine (même construction pour le direct 2D et la simulation sans rendu)
export function createCareerMatch(setup) {
  const m = new Match({ home: setup.home, away: setup.away, seed: setup.seed, userTeam: null, aiTeams: [0, 1] });
  // ambiance : derby (plus d'engagement) et météo du jour
  m.derby = setup.derby ?? null;
  m.weather = setup.weather ?? null;
  if (setup.subPlan) {
    const user = m.players.find((p) => p.isUser);
    if (user && !user.onPitch) {
      const team = m.teams[user.team];
      const outId = team.slotPlayer.map((id) => m.players[id]).find((p) => p && p.role === user.role)?.id
        ?? team.slotPlayer.find((id) => id != null && m.players[id].role !== 'GK');
      // ~3 min de temps additionnel en 1re période : approximation de l'horodatage
      m.queueCommand({ tick: (setup.subPlan.minute + 3) * TICKS_PER_MIN, type: 'sub', team: user.team, outId, inId: user.id, source: 'staff' });
    }
  }
  return m;
}

const minuteOf = (ev) => {
  const [a, b] = String(ev.minute).split('+').map(Number);
  return Math.min(90, a + (b || 0));
};

// Performance du joueur de l'utilisateur à partir des événements canoniques
export function extractResult(m, userTeam) {
  const u = m.players.find((p) => p.isUser);
  let minutes = 0, started = false;
  if (u && u.used) {
    const inEv = m.events.find((e) => e.type === 'remplacement' && e.inId === u.id);
    const outEv = m.events.find((e) => e.type === 'remplacement' && e.outId === u.id);
    const red = m.events.find((e) => e.type === 'carton' && e.card === 'red' && e.player === u.id);
    started = !inEv;
    const from = inEv ? minuteOf(inEv) : 0;
    const to = outEv ? minuteOf(outEv) : red ? minuteOf(red) : 90;
    minutes = Math.max(1, to - from);
  }
  const mine = m.score[userTeam], theirs = m.score[1 - userTeam];
  const stats = u ? { ...u.stats, saves: u.role === 'GK' ? m.teams[userTeam].stats.saves : 0 } : null;
  // décisions prises pendant le match (joué, pas simulé) : réussites et chances annoncées
  const uc = m.userChoices ?? [];
  const choices = uc.length ? { made: uc.length, ok: uc.filter((d) => d.ok).length, expected: uc.reduce((a, d) => a + (d.p ?? 0.5), 0) } : null;
  return {
    score: [...m.score], minutes, started, goals: u?.stats.goals ?? 0, assists: u?.stats.assists ?? 0, style: m.userStyle ?? null, choices,
    rating: u && minutes ? matchRating(stats, Math.sign(mine - theirs), minutes, u.role, theirs) : null,
    fingerprint: m.fingerprint(),
  };
}

export function simulateCareerMatch(setup) {
  const m = createCareerMatch(setup);
  m.runToEnd();
  return extractResult(m, setup.userTeam);
}
