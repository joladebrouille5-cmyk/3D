// Championnats étrangers (Angleterre, Espagne) : catalogue, règle des mineurs, championnat, offres, coupes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../src/career/career.js';
import { FOREIGN } from '../src/data/foreign.js';
import { clubById, leagueFor, buildTeamSquad, FOREIGN_CLUBS, teamCA } from '../src/career/clubs.js';
import { EURO_CLUBS, buildCups } from '../src/career/competitions.js';
import { salaryFor } from '../src/career/market.js';

test('catalogue étranger : quatre championnats, effectifs adultes, forces cohérentes', () => {
  const ids = FOREIGN.leagues.map((l) => l.id).sort();
  assert.deepEqual(ids, ['eng1', 'eng2', 'esp1', 'esp2']);
  for (const l of FOREIGN.leagues) assert.ok(l.clubs.length >= 18, `${l.name} : ${l.clubs.length} clubs`);
  for (const c of FOREIGN.clubs) {
    for (const [name, , , age] of c.players) assert.ok(age >= 18, `mineur dans le catalogue : ${name} (${c.name})`);
  }
  const strength = (id) => clubById(id).strength;
  assert.ok(strength('esp-real-madrid') > teamCA(clubById('paris-saint-germain'), 'Pro'), 'le Real au-dessus du PSG');
  const avg = (lg) => FOREIGN_CLUBS.filter((c) => c.leagueId === lg).reduce((a, c) => a + c.strength, 0) / FOREIGN_CLUBS.filter((c) => c.leagueId === lg).length;
  assert.ok(avg('eng1') > avg('esp1') && avg('esp1') > avg('eng2') && avg('eng2') > avg('esp2'));
});

test('un club étranger a son championnat, un effectif réel et un salaire à son échelle', () => {
  const ars = clubById('eng-arsenal');
  const lg = leagueFor(ars, 'Pro');
  assert.equal(lg.name, 'Premier League');
  assert.equal(lg.clubs.length, 20);
  const sq = buildTeamSquad(ars, 'Pro', 2026, lg);
  assert.equal(sq.starters.length, 11);
  assert.ok(sq.starters.filter((p) => p.real).length >= 9, 'titulaires aux noms réels');
  assert.ok(salaryFor(ars, 'Pro', 0.72, 25) > salaryFor(clubById('paris-saint-germain'), 'Pro', 0.72, 25) * 0.6);
});

test('coupes d\'Europe : vrais clubs anglais et espagnols, plus leurs doubles fictifs', () => {
  const ids = EURO_CLUBS.map((c) => c.id);
  assert.ok(ids.includes('esp-real-madrid') && ids.includes('eng-manchester-city'));
  assert.ok(!ids.includes('eu-real-madrid') && !ids.includes('eu-manchester-city'));
  assert.ok(ids.includes('eu-bayern-munich'), 'les autres pays restent fictifs');
});

test('une star reçoit des offres de l\'étranger ; une saison en Angleterre se joue jusqu\'au bout', () => {
  const st = C.createCareer({ firstName: 'A', lastName: 'B', role: 'ST', clubId: 'paris-saint-germain', seed: 'star', potential: 'phenomene' });
  st.stage = 'Pro'; st.player.age = 24;
  for (const k in st.player.attrs) if (k !== 'gk') st.player.attrs[k] = Math.min(0.95, st.player.attrs[k] + 0.35);
  let g = 0;
  const step = () => {
    if (st.phase === 'week') C.submitWeek(st, { focus: 'technique', intensity: 'normale', offpitch: 'repos' });
    else if (st.phase === 'event') C.resolveEvent(st, 0);
    else if (st.phase === 'month_review') C.closeMonthReview(st);
    else C.applyMatchResult(st, st.matchday.bye ? {} : C.resultWithoutUser(st));
  };
  while (st.phase !== 'season_end' && g++ < 5000) step();
  const abroad = st.offers.filter((o) => o.clubId && clubById(o.clubId)?.foreign);
  assert.ok(abroad.length >= 1, `offres : ${st.offers.map((o) => o.clubId).join(', ')}`);
  const i = st.offers.indexOf(abroad[0]);
  C.acceptOffer(st, i);
  const club = clubById(st.clubId);
  assert.ok(club.foreign, 'joue à l\'étranger');
  assert.equal(st.league.teams.length, leagueFor(club, 'Pro').clubs.length);
  const cupIds = st.cups.map((c) => c.id);
  assert.ok(cupIds.includes(club.country === 'Espagne' ? 'cdr' : 'fac'), `coupes : ${cupIds.join(', ')}`);
  g = 0;
  while (st.phase !== 'season_end' && g++ < 8000) step();
  assert.equal(st.phase, 'season_end');
  assert.ok(st.history.at(-1).league.length > 0);
  assert.ok(st.journal.length > 0);
  void buildCups;
});
