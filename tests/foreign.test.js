// Championnats étrangers (Angleterre, Espagne, Italie, Allemagne, Portugal, Pays-Bas, Belgique) :
// catalogue, règle des mineurs, championnat, offres, coupes, langue.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../src/career/career.js';
import { FOREIGN } from '../src/data/foreign.js';
import { clubById, leagueFor, buildTeamSquad, FOREIGN_CLUBS, teamCA } from '../src/career/clubs.js';
import { EURO_CLUBS, buildCups } from '../src/career/competitions.js';
import { salaryFor } from '../src/career/market.js';
import { countryInfo, langLevel } from '../src/career/countries.js';

test('catalogue étranger : onze championnats, effectifs adultes, forces cohérentes', () => {
  const ids = FOREIGN.leagues.map((l) => l.id).sort();
  assert.deepEqual(ids, ['bel1', 'eng1', 'eng2', 'esp1', 'esp2', 'ger1', 'ger2', 'ita1', 'ita2', 'ned1', 'por1']);
  for (const l of FOREIGN.leagues) assert.ok(l.clubs.length >= 16, `${l.name} : ${l.clubs.length} clubs`);
  for (const c of FOREIGN.clubs) assert.ok(c.players.length >= 14, `effectif trop court : ${c.name} (${c.players.length})`);
  for (const c of FOREIGN.clubs) {
    for (const [name, , , age] of c.players) assert.ok(age >= 18, `mineur dans le catalogue : ${name} (${c.name})`);
  }
  const strength = (id) => clubById(id).strength;
  assert.ok(strength('esp-real-madrid') > teamCA(clubById('paris-saint-germain'), 'Pro'), 'le Real au-dessus du PSG');
  const avg = (lg) => FOREIGN_CLUBS.filter((c) => c.leagueId === lg).reduce((a, c) => a + c.strength, 0) / FOREIGN_CLUBS.filter((c) => c.leagueId === lg).length;
  assert.ok(avg('eng1') > avg('esp1') && avg('esp1') > avg('eng2') && avg('eng2') > avg('esp2'));
  // hiérarchie européenne : les cinq grands devant la Ligue 1 (0,63), Portugal, Pays-Bas, Belgique derrière
  for (const lg of ['eng1', 'esp1', 'ita1', 'ger1']) assert.ok(avg(lg) > 0.64, `${lg} : ${avg(lg)}`);
  for (const lg of ['por1', 'ned1', 'bel1', 'ita2', 'ger2']) assert.ok(avg(lg) < 0.63, `${lg} : ${avg(lg)}`);
  const top = (country) => FOREIGN_CLUBS.filter((c) => c.country === country).sort((a, b) => b.strength - a.strength)[0];
  assert.equal(top('Allemagne').name, 'Bayern Munich');
  assert.ok(top('Portugal').strength < teamCA(clubById('paris-saint-germain'), 'Pro'));
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

test('coupes d\'Europe : vrais clubs des sept pays, plus leurs doubles fictifs', () => {
  const ids = EURO_CLUBS.map((c) => c.id);
  assert.ok(ids.includes('esp-real-madrid') && ids.includes('eng-manchester-city') && ids.includes('ger-bayern-munich'));
  for (const fake of ['eu-real-madrid', 'eu-manchester-city', 'eu-bayern-munich', 'eu-juventus', 'eu-benfica', 'eu-psv', 'eu-club-bruges']) assert.ok(!ids.includes(fake), fake);
  for (const country of ['Italie', 'Portugal', 'Pays-Bas', 'Belgique']) assert.ok(EURO_CLUBS.some((c) => c.foreign && c.country === country), country);
  assert.ok(ids.includes('eu-galatasaray') && ids.includes('eu-celtic'), 'les autres pays restent fictifs');
});

test('chaque pays a sa coupe nationale, sa langue et son échelle de salaires', () => {
  for (const country of ['Angleterre', 'Espagne', 'Italie', 'Allemagne', 'Portugal', 'Pays-Bas', 'Belgique']) {
    const club = FOREIGN_CLUBS.find((c) => c.country === country && c.tier === 1);
    const st = C.createCareer({ firstName: 'A', lastName: 'B', role: 'CM', clubId: 'fc-nantes', seed: `pays-${country}` });
    st.stage = 'Pro'; st.clubId = club.id;
    const cups = buildCups(st, 34).map((c) => c.id);
    assert.equal(cups[0], countryInfo(country).cup, `${country} : ${cups.join(', ')}`);
    assert.ok(salaryFor(club, 'Pro', 0.65, 25) > 1, country);
  }
  const p = { lang: {} };
  assert.equal(langLevel(p, 'Allemagne'), 0);
  assert.ok(langLevel(p, 'Belgique') >= 0.6, 'en Belgique, le français suffit souvent');
  const ger = salaryFor(clubById('ger-bayern-munich'), 'Pro', 0.72, 25), por = salaryFor(FOREIGN_CLUBS.find((c) => c.country === 'Portugal'), 'Pro', 0.72, 25);
  assert.ok(ger > por, `Bundesliga ${ger} > Liga Portugal ${por}`);
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
  assert.ok(cupIds.includes(countryInfo(club.country).cup), `coupes : ${cupIds.join(', ')}`);
  g = 0;
  while (st.phase !== 'season_end' && g++ < 8000) step();
  assert.equal(st.phase, 'season_end');
  assert.ok(st.history.at(-1).league.length > 0);
  assert.ok(st.journal.length > 0);
  void buildCups;
});

test('formation à l\'étranger : championnat de jeunes du pays, coéquipiers fictifs, coupe U19, premier contrat', () => {
  const st = C.createCareer({ firstName: 'A', lastName: 'B', role: 'CM', clubId: 'eng-arsenal', seed: 'academie-arsenal', potential: 'bel' });
  const club = clubById('eng-arsenal');
  assert.equal(st.stage, 'U17');
  assert.ok(st.league.teams.length >= 10, 'championnat U17');
  for (const t of st.league.teams) assert.equal(clubById(t.id).country, 'Angleterre', `${t.id} dans le championnat d'Angleterre U17`);
  assert.ok(st.player.lang.Angleterre >= 0.6, 'formé sur place : il parle la langue');
  // jamais de vrais noms chez les jeunes (mineurs)
  const real = new Set(FOREIGN_CLUBS.flatMap((c) => c.senior.players.map((p) => p[0])));
  for (const id of ['eng-arsenal', 'esp-barcelona', 'ita-atalanta', 'ned-ajax']) {
    for (const stage of ['U17', 'U19']) {
      const sq = buildTeamSquad(clubById(id), stage, 2026, null);
      for (const p of [...sq.starters, ...sq.bench]) assert.ok(!p.real && !real.has(p.name), `${id} ${stage} : ${p.name}`);
    }
  }
  // U19 : FA Youth Cup ; centre étranger au niveau d'un centre français réputé
  st.stage = 'U19';
  assert.ok(buildCups(st, 30).some((c) => c.id === 'yfa'));
  assert.ok(teamCA(club, 'U17') < 0.55 && teamCA(club, 'U17') > 0.45, `U17 d'Arsenal ${teamCA(club, 'U17')}`);
});
