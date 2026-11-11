// Audit d'équilibre de la carrière : node tools/audit-career.mjs [saisons]
// Simule des carrières (matchs du joueur par le moteur) selon plusieurs clubs et profils de choix.
import * as C from '../src/career/career.js';
import { simulateCareerMatch } from '../src/career/play.js';

const SEASONS = Number(process.argv[2] || 4);
const PROFILES = {
  sérieux: (st, w) => ({ focus: ['technique', 'tactique', 'physique', 'finition'][w % 4], intensity: st.player.fresh < 0.45 ? 'légère' : 'normale', offpitch: w % 3 === 0 ? 'video' : w % 3 === 1 ? 'ecole' : 'repos' }),
  forcené: () => ({ focus: 'technique', intensity: 'intense', offpitch: 'extra' }),
  dilettante: (st, w) => ({ focus: 'technique', intensity: 'légère', offpitch: w % 2 ? 'sortie' : 'repos' }),
};
const CLUBS = ['paris-saint-germain', 'fc-nantes', 'us-concarneau', 'fc-bassin-arcachon'];

function run(clubId, profile, seed) {
  const st = C.createCareer({ firstName: 'A', lastName: 'B', role: 'CM', clubId, seed });
  const pa0 = st.player.pa;
  let w = 0, injuries = 0, seasons = 0, t0 = Date.now();
  const lines = [];
  while (seasons < SEASONS && st.phase !== 'retired') {
    if (st.phase === 'week') { const inj = st.player.injuryWeeks; C.submitWeek(st, PROFILES[profile](st, w++)); if (!inj && st.player.injuryWeeks) injuries++; }
    else if (st.phase === 'event') C.resolveEvent(st, 0);
    else if (st.phase === 'month_review') C.closeMonthReview(st);
    else if (st.phase === 'matchday') {
      if (st.matchday.bye) { C.applyMatchResult(st, {}); continue; }
      const s = C.matchSetup(st);
      C.applyMatchResult(st, s.inSquad ? simulateCareerMatch(s) : C.resultWithoutUser(st));
    } else if (st.phase === 'season_end') {
      const h = st.history.at(-1);
      lines.push(`${h.age}a ${h.stage.padEnd(7)} ${h.club.slice(0, 18).padEnd(18)} ${String(h.pos).padStart(2)}/${h.teams} · ${String(h.apps).padStart(2)} m (${h.starts} tit.) · ${h.goals} b · note ${h.rating ? h.rating.toFixed(1) : ' — '} · niveau ${C.pct(h.caStart)}→${C.pct(h.caEnd)} · PA ${C.pct(st.player.pa)}`);
      const own = st.offers.findIndex((o) => o.own);
      C.acceptOffer(st, own >= 0 ? own : 0);
      seasons++;
    }
  }
  return { clubId, profile, pa0, paEnd: st.player.pa, ca: C.currentCA(st), stage: st.stage, club: st.clubId, injuries, lines, secs: (Date.now() - t0) / 1000, saveKB: JSON.stringify(st).length / 1024 };
}

const results = [];
for (const club of CLUBS) for (const prof of Object.keys(PROFILES)) {
  if (club !== 'fc-nantes' && prof !== 'sérieux') continue; // profils comparés sur un même club
  const r = run(club, prof, `audit-${club}`);
  results.push(r);
  console.log(`\n=== ${club} · ${prof} · PA ${C.pct(r.pa0)}→${C.pct(r.paEnd)} · blessures ${r.injuries} · sauvegarde ${r.saveKB.toFixed(0)} Ko · ${r.secs.toFixed(0)} s`);
  for (const l of r.lines) console.log('  ' + l);
}
