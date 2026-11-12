// Fin de carrière : déclin physique progressif, offres des grands clubs pour une star, retraite.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../src/career/career.js';

function playSeason(st) {
  let g = 0;
  while (st.phase !== 'season_end' && g++ < 5000) {
    if (st.phase === 'week') C.submitWeek(st, { focus: 'technique', intensity: 'normale', offpitch: 'repos' });
    else if (st.phase === 'event') C.resolveEvent(st, 0);
    else if (st.phase === 'month_review') C.closeMonthReview(st);
    else C.applyMatchResult(st, st.matchday.bye ? {} : { ...C.resultWithoutUser(st), ...(st.matchday.selection === 'titulaire' ? { minutes: 90, started: true, rating: 6.9, goals: 0 } : {}) });
  }
}
function veteran(age, boost = 0.3) {
  const st = C.createCareer({ firstName: 'A', lastName: 'B', role: 'W', clubId: 'fc-nantes', seed: `v${age}`, potential: 'phenomene' });
  st.player.age = age;
  for (const k in st.player.attrs) if (k !== 'gk') st.player.attrs[k] = Math.min(0.95, st.player.attrs[k] + boost);
  st.player.pa = 0.95;
  return st;
}

test('après 30 ans, le déclin est progressif (et seulement physique au début)', () => {
  const st = veteran(31);
  const ca0 = C.currentCA(st), dec0 = st.player.attrs.decisions, pace0 = st.player.attrs.pace;
  playSeason(st);
  const drop = (ca0 - C.currentCA(st)) * 100;
  assert.ok(drop > 0.3 && drop < 4, `baisse sur une saison à 31 ans : ${drop.toFixed(1)} points`);
  assert.ok(st.player.attrs.pace < pace0, 'la vitesse baisse');
  assert.ok(st.player.attrs.decisions >= dec0 - 0.005, 'la lecture du jeu tient');
});

test('une star au-dessus du niveau de la Ligue 1 intéresse les plus grands clubs (France et étranger)', async () => {
  const { clubById, teamCA } = await import('../src/career/clubs.js');
  const st = veteran(24);
  st.stage = 'Pro';
  playSeason(st);
  const ids = st.offers.filter((o) => o.clubId).map((o) => o.clubId);
  const psg = teamCA(clubById('paris-saint-germain'), 'Pro');
  assert.ok(ids.some((id) => teamCA(clubById(id), 'Pro') >= psg - 0.01), `offres : ${ids.join(', ')}`);
});

test('la retraite est proposée à partir de 33 ans et imposée à 39', () => {
  const a = veteran(33, 0.1); a.stage = 'Pro';
  playSeason(a);
  assert.ok(a.offers.some((o) => o.retire), 'proposée à 33 ans');
  const b = veteran(39, 0.1); b.stage = 'Pro';
  playSeason(b);
  assert.equal(b.offers.length, 1);
  assert.ok(b.offers[0].retire, 'imposée à 39 ans');
  C.acceptOffer(b, 0);
  assert.equal(b.phase, 'retired');
});

test('montées et descentes : divisions de taille stable, mouvements gardés dans la sauvegarde', async () => {
  const { CLUBS: FR, FOREIGN_LEAGUES } = await import('../src/career/clubs.js');
  const st = C.createCareer({ firstName: 'A', lastName: 'B', role: 'CM', clubId: 'fc-nantes', seed: 'monde-test' });
  const sizes = () => [1, 2, 3, 4, 5].map((l) => FR.filter((c) => c.senior && c.senior.level === l).length).join('/') + ' ' + FOREIGN_LEAGUES.map((l) => l.clubs.length).join('/');
  const s0 = sizes();
  let g = 0;
  const step = () => {
    if (st.phase === 'week') C.submitWeek(st, { focus: 'technique', intensity: 'normale', offpitch: 'repos' });
    else if (st.phase === 'event') C.resolveEvent(st, 0);
    else if (st.phase === 'month_review') C.closeMonthReview(st);
    else C.applyMatchResult(st, st.matchday.bye ? {} : C.resultWithoutUser(st));
  };
  for (let s = 0; s < 2; s++) {
    while (st.phase !== 'season_end' && g++ < 9000) step();
    assert.equal(sizes(), s0, 'tailles des divisions inchangées');
    const own = st.offers.findIndex((o) => o.own); C.acceptOffer(st, own >= 0 ? own : 0);
  }
  const log = st.world.log;
  assert.equal(log.length, 2);
  assert.ok(log[0].up.length >= 20 && log[0].up.length === log[0].down.length, `${log[0].up.length} montées`);
  // une nouvelle carrière repart du catalogue ; recharger l'ancienne réapplique ses mouvements
  const moved = log[0].up[0], levelNow = FR.find((c) => c.id === moved)?.senior.level;
  const st2 = C.createCareer({ firstName: 'C', lastName: 'D', role: 'CM', clubId: 'fc-nantes', seed: 'autre' });
  void st2;
  C.ensureState(JSON.parse(JSON.stringify(st)));
  if (levelNow != null) assert.equal(FR.find((c) => c.id === moved).senior.level, levelNow);
});
