// Simulation sans rendu : même moteur, mêmes règles, mêmes tirages.
import { Match } from './match.js';

export function simulateMatch({ home, away, seed, userTeam = null, commands = [], maxTicks = 80000 } = {}) {
  const m = new Match({ home, away, seed, userTeam, aiTeams: userTeam == null ? [0, 1] : [1 - userTeam] });
  for (const c of commands) m.queueCommand(c);
  m.runToEnd(maxTicks);
  return m;
}
