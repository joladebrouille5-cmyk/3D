// Coupes et sélections : présence selon l'étape, déroulé complet d'une saison, trophées.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../src/career/career.js';
import { buildCups, natCategory, NAT_REQ } from '../src/career/competitions.js';
import { simulateCareerMatch } from '../src/career/play.js';

function season(st) {
  let g = 0;
  const seen = { cup: 0, nat: 0 };
  while (st.phase !== 'season_end' && g++ < 6000) {
    if (st.phase === 'week') C.submitWeek(st, { focus: 'technique', intensity: 'normale', offpitch: 'video' });
    else if (st.phase === 'event') C.resolveEvent(st, 0);
    else if (st.phase === 'month_review') C.closeMonthReview(st);
    else {
      const ex = st.matchday.extra;
      if (ex) seen[ex.kind]++;
      // en sélection, le joueur convoqué joue (le moteur simule son match)
      if (ex?.kind === 'nat') { const s = C.matchSetup(st); C.applyMatchResult(st, simulateCareerMatch(s)); }
      else C.applyMatchResult(st, st.matchday.bye ? {} : C.resultWithoutUser(st));
    }
  }
  return seen;
}

test('coupes disputées selon l\'étape et le niveau du club', () => {
  const u19 = C.createCareer({ firstName: 'A', lastName: 'B', role: 'CM', clubId: 'fc-nantes', seed: 'c1' });
  u19.stage = 'U19';
  assert.deepEqual(buildCups(u19, 26).map((c) => c.id), ['gambardella']);
  const psg = C.createCareer({ firstName: 'A', lastName: 'B', role: 'CM', clubId: 'paris-saint-germain', seed: 'c2' });
  psg.stage = 'Pro';
  const cups = buildCups(psg, 34);
  assert.deepEqual(cups.map((c) => c.id), ['cdf', 'ucl']);
  assert.equal(cups[0].rounds[0].label, '32es de finale', 'les clubs de L1 entrent en 32es');
  const u17 = C.createCareer({ firstName: 'A', lastName: 'B', role: 'CM', clubId: 'fc-nantes', seed: 'c3' });
  assert.equal(u17.cups.length, 0, 'pas de coupe nationale en U17');
});

test('une saison pro joue ses tours de coupe jusqu\'à l\'élimination ou au titre', () => {
  const st = C.createCareer({ firstName: 'A', lastName: 'B', role: 'ST', clubId: 'paris-saint-germain', seed: 'c4' });
  st.stage = 'Pro'; st.player.age = 24;
  C.startSeason(st);
  const seen = season(st);
  assert.ok(seen.cup >= 2, `matchs de coupe joués : ${seen.cup}`);
  for (const cup of st.cups) {
    assert.ok(cup.log.length >= 1, `${cup.name} : au moins un tour`);
    assert.ok(cup.champion || !cup.alive, `${cup.name} terminée`);
    if (cup.champion) assert.ok(st.trophies.some((t) => t.name === cup.name));
  }
  assert.equal(st.history.at(-1).cups.length, st.cups.length, 'parcours en coupe archivé');
});

test('les convocations en sélection suivent l\'âge et le niveau', () => {
  assert.equal(natCategory(15, 0.5), 'U16');
  assert.equal(natCategory(19, 0.6), 'U20');
  assert.equal(natCategory(19, NAT_REQ.A + 0.01), 'A');
  const st = C.createCareer({ firstName: 'A', lastName: 'B', role: 'ST', clubId: 'fc-nantes', seed: 'c5' });
  for (const k in st.player.attrs) st.player.attrs[k] = Math.min(0.95, st.player.attrs[k] + 0.2);
  C.startSeason(st);
  const seen = season(st);
  const caps = Object.values(st.player.intl.caps).reduce((a, b) => a + b, 0);
  assert.ok(seen.nat >= 2, `un joueur très au-dessus du niveau est convoqué (${seen.nat})`);
  assert.ok(caps >= 1 && caps <= seen.nat, `sélections comptabilisées quand il joue (${caps}/${seen.nat})`);
});

test('phases finales de l\'été : sélection, poules puis élimination directe, trophée', async () => {
  const { summerTournament, tournamentMatch, resolveTournamentMatch } = await import('../src/career/competitions.js');
  const { Rng } = await import('../src/engine/rng.js');
  const st = C.createCareer({ firstName: 'A', lastName: 'B', role: 'ST', clubId: 'paris-saint-germain', seed: 'euro' });
  st.stage = 'Pro'; st.player.age = 25; st.season = 2027; // été 2028 : Euro
  st.player.intl.caps.A = 10;
  const r = new Rng('euro-test');
  let t = null;
  for (let i = 0; i < 20 && !t; i++) t = summerTournament(st, r, 0.8);
  assert.ok(t, 'un titulaire de l\'équipe de France est retenu');
  assert.equal(t.name, 'Euro 2028');
  assert.equal(t.rounds.length, 7, '3 matchs de poule + 4 tours');
  st.tournament = t;
  for (let i = 0; i < 7 && t.alive; i++) { const m = tournamentMatch(st, r); assert.ok(m.oppId.startsWith('nat-')); resolveTournamentMatch(st, 3, 0, r); }
  assert.ok(t.won && t.reached === 'Vainqueur');
  // un joueur trop juste n'est pas retenu
  assert.equal(summerTournament(st, new Rng('x'), 0.5), null);
});

test('nationalité : sélection du pays choisi, langue maternelle, presse', async () => {
  const { maybeCallup, natReq } = await import('../src/career/competitions.js');
  const { langLevel } = await import('../src/career/countries.js');
  const { abroad } = await import('../src/career/events.js');
  const { Rng } = await import('../src/engine/rng.js');
  const st = C.createCareer({ firstName: 'A', lastName: 'B', role: 'ST', clubId: 'eng-arsenal', seed: 'anglais', nation: 'angleterre' });
  assert.equal(st.player.nation, 'angleterre');
  assert.equal(langLevel(st.player, 'Angleterre'), 1, 'langue maternelle');
  st.stage = 'Pro';
  assert.equal(abroad(st), false, 'un Anglais à Arsenal est chez lui');
  st.clubId = 'paris-saint-germain';
  assert.equal(abroad(st), true, 'un Anglais au PSG est à l\'étranger');
  // une sélection moins forte convoque plus facilement
  assert.ok(natReq('A', 'japon') < natReq('A', 'france'));
  st.player.age = 24;
  for (const k in st.player.attrs) st.player.attrs[k] = Math.min(0.95, st.player.attrs[k] + 0.4);
  const len = st.league.rounds.length;
  st.week = Math.round(0.2 * len);
  let call = null;
  for (let i = 0; i < 30 && !call; i++) call = maybeCallup(st, new Rng(`c${i}`), 0.8);
  assert.ok(call && call.teamId.startsWith('nat-angleterre'), JSON.stringify(call));
  assert.ok(!call.oppId.startsWith('nat-angleterre'));
});
