// Mesure de calibration sur N rencontres : node tools/calibrate.js [N]
import { simulateMatch } from '../src/engine/sim.js';
import { TEAM_DEFS } from '../src/engine/teams.js';

const N = Number(process.argv[2] || 20);
const ids = TEAM_DEFS.map((t) => t.id);
const acc = { goals: 0, shots: 0, onTarget: 0, xg: 0, passes: 0, passesOk: 0, fouls: 0, yellows: 0, reds: 0, corners: 0, offsides: 0, saves: 0, possDiff: 0 };
const res = { home: 0, draw: 0, away: 0 };
const t0 = Date.now();
for (let i = 0; i < N; i++) {
  const home = ids[i % ids.length], away = ids[(i + 1 + Math.floor(i / ids.length)) % ids.length === i % ids.length ? (i + 2) % ids.length : (i + 1 + Math.floor(i / ids.length)) % ids.length];
  const m = simulateMatch({ home, away, seed: `cal-${i}` });
  for (const t of m.teams) for (const k of Object.keys(acc)) if (k in t.stats) acc[k] += t.stats[k];
  res[m.score[0] > m.score[1] ? 'home' : m.score[0] < m.score[1] ? 'away' : 'draw']++;
  if (process.argv.includes('-v')) console.log(`${m.teams[0].short} ${m.score[0]}-${m.score[1]} ${m.teams[1].short}  tirs ${m.teams[0].stats.shots}/${m.teams[1].stats.shots}  xG ${m.teams[0].stats.xg.toFixed(2)}/${m.teams[1].stats.xg.toFixed(2)}  poss ${(100 * m.teams[0].stats.possession / (m.teams[0].stats.possession + m.teams[1].stats.possession)).toFixed(0)}%`);
}
const per = (k) => (acc[k] / N).toFixed(2);
console.log(`${N} matchs en ${((Date.now() - t0) / 1000).toFixed(1)} s`);
console.log(`buts/match ${per('goals')} | tirs ${per('shots')} | cadrés ${per('onTarget')} | xG ${per('xg')} | arrêts ${per('saves')}`);
console.log(`passes ${per('passes')} | réussite ${(100 * acc.passesOk / Math.max(1, acc.passes)).toFixed(1)}% | fautes ${per('fouls')} | jaunes ${per('yellows')} | rouges ${per('reds')} | corners ${per('corners')} | hors-jeu ${per('offsides')}`);
console.log(`résultats : dom ${res.home} / nul ${res.draw} / ext ${res.away}`);
