// Audit d'équilibre de la carrière : node tools/audit-career.mjs [saisons] [club] [profil] [niveau] [potentiel]
// Simule des carrières (matchs du joueur par le moteur) selon un club, un profil de choix et, au besoin,
// les paliers des deux roues. Sans arguments de club : les combinaisons de référence de l'audit.
import * as C from '../src/career/career.js';
import { simulateCareerMatch } from '../src/career/play.js';

const SEASONS = Number(process.argv[2] || 4);
const PROFILES = {
  sérieux: (st, w) => ({ focus: st.weekly?.coachFocus && w % 2 ? st.weekly.coachFocus : ['technique', 'tactique', 'physique', 'finition'][w % 4], intensity: st.player.fresh < 0.45 ? 'légère' : 'normale', offpitch: w % 3 === 0 ? 'video' : w % 3 === 1 ? 'ecole' : st.weekly?.special ? 'special' : 'repos', drill: 'bien' }),
  forcené: () => ({ focus: 'technique', intensity: 'intense', offpitch: 'extra', drill: 'bien' }),
  dilettante: (st, w) => ({ focus: 'technique', intensity: 'légère', offpitch: w % 2 ? 'sortie' : 'repos', drill: 'rate' }),
};

export function run(clubId, profile, seed, { level = null, potential = null, seasons = SEASONS } = {}) {
  const st = C.createCareer({ firstName: 'A', lastName: 'B', role: 'CM', clubId, seed, level, potential });
  const pa0 = st.player.pa, ca0 = C.currentCA(st);
  let w = 0, injuries = 0, done = 0, events = 0;
  const t0 = Date.now();
  const lines = [];
  while (done < seasons && st.phase !== 'retired') {
    if (st.phase === 'week') { const inj = st.player.injuryWeeks; C.submitWeek(st, PROFILES[profile](st, w++)); if (!inj && st.player.injuryWeeks) injuries++; }
    else if (st.phase === 'event') { events++; C.resolveEvent(st, 0); }
    else if (st.phase === 'month_review') C.closeMonthReview(st);
    else if (st.phase === 'matchday') {
      if (st.matchday.bye) { C.applyMatchResult(st, {}); continue; }
      const s = C.matchSetup(st);
      C.applyMatchResult(st, s.inSquad ? simulateCareerMatch(s) : C.resultWithoutUser(st));
    } else if (st.phase === 'season_end') {
      const h = st.history.at(-1);
      lines.push(`${h.age}a ${h.stage.padEnd(7)} ${h.club.slice(0, 18).padEnd(18)} ${String(h.pos).padStart(2)}/${h.teams} · ${String(h.apps).padStart(2)} m (${h.starts} tit.) · ${h.goals} b · note ${h.rating ? h.rating.toFixed(1) : ' — '} · niveau ${C.pct(h.caStart)}→${C.pct(h.caEnd)} · PA ${C.pct(st.player.pa)} · ${C.money(st.player.money)}`);
      const own = st.offers.findIndex((o) => o.own);
      C.acceptOffer(st, own >= 0 ? own : 0);
      done++;
    }
  }
  return { clubId, profile, pa0, ca0, paEnd: st.player.pa, ca: C.currentCA(st), stage: st.stage, club: st.clubId, injuries, events, lines, secs: (Date.now() - t0) / 1000, saveKB: JSON.stringify(st).length / 1024 };
}

const print = (r, label) => {
  console.log(`\n=== ${label} · niveau ${C.pct(r.ca0)}→${C.pct(r.ca)} · PA ${C.pct(r.pa0)}→${C.pct(r.paEnd)} · blessures ${r.injuries} · événements ${r.events} · sauvegarde ${r.saveKB.toFixed(0)} Ko · ${r.secs.toFixed(0)} s`);
  for (const l of r.lines) console.log('  ' + l);
};

if (process.argv[1]?.endsWith('audit-career.mjs')) {
  const [club, prof, level, potential] = process.argv.slice(3);
  if (club) print(run(club, prof || 'sérieux', `audit-${club}`, { level: level || null, potential: potential || null }), `${club} · ${prof || 'sérieux'}${level ? ` · ${level}` : ''}${potential ? ` · ${potential}` : ''}`);
  else {
    const CLUBS = ['paris-saint-germain', 'fc-nantes', 'us-concarneau', 'fc-bassin-arcachon'];
    for (const c of CLUBS) for (const p of Object.keys(PROFILES)) {
      if (c !== 'fc-nantes' && p !== 'sérieux') continue; // profils comparés sur un même club
      print(run(c, p, `audit-${c}`), `${c} · ${p}`);
    }
  }
}
