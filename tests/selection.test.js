// Titularisation vivante et progression par les matchs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../src/career/career.js';

function toWeekPhase(st) {
  while (st.phase !== 'week') {
    if (st.phase === 'event') C.resolveEvent(st, 0);
    else if (st.phase === 'month_review') C.closeMonthReview(st);
    else if (st.phase === 'matchday') C.applyMatchResult(st, st.matchday.bye ? {} : C.resultWithoutUser(st));
  }
}

test('la forme récente et la fraîcheur pèsent sur la titularisation', () => {
  const st = C.createCareer({ firstName: 'A', lastName: 'B', role: 'CM', clubId: 'fc-nantes', seed: 'sel1' });
  toWeekPhase(st);
  // place le joueur juste au niveau de son concurrent
  const base = C.selectionForecast(st);
  st.player.trust = 0.5; st.player.morale = 0.5; st.player.team = 0.5; st.player.fresh = 0.8;
  const gap = base.rival.ca - C.currentCA(st);
  for (const k in st.player.attrs) st.player.attrs[k] += gap + 0.01;
  st.seasonStats.ratings = [];
  const neutral = C.selectionForecast(st).status;
  st.seasonStats.ratings = [5.4, 5.6, 5.5];
  const bad = C.selectionForecast(st);
  st.seasonStats.ratings = [7.9, 8.1, 7.8];
  const good = C.selectionForecast(st);
  const rank = { titulaire: 2, remplaçant: 1, 'non retenu': 0 };
  assert.ok(rank[good.status] >= rank[neutral], `${good.status} ≥ ${neutral}`);
  assert.ok(rank[bad.status] <= rank[neutral], `${bad.status} ≤ ${neutral}`);
  assert.ok(rank[good.status] > rank[bad.status], 'la forme change la décision du coach');
  // épuisé : le coach le ménage
  st.player.fresh = 0.2;
  const tired = C.selectionForecast(st);
  assert.notEqual(tired.status, 'titulaire');
});

test('un renfort peut être recruté au poste d\'un titulaire installé', () => {
  let signings = 0;
  for (let i = 0; i < 12; i++) {
    const st = C.createCareer({ firstName: 'A', lastName: 'B', role: 'CM', clubId: 'fc-nantes', seed: `sig${i}` });
    for (const k in st.player.attrs) if (k !== 'gk') st.player.attrs[k] = Math.min(0.97, st.player.attrs[k] + 0.12);
    st.player.trust = 0.9;
    for (let w = 0; w < 16 && st.phase !== 'season_end'; ) {
      if (st.phase === 'week') { C.submitWeek(st, { focus: 'technique', intensity: 'normale', offpitch: 'repos' }); w++; }
      else toWeekPhase(st);
    }
    if (st.signing) {
      signings++;
      assert.ok(st.signing.name && st.signing.ca > 0.3);
      assert.ok(st.journal.some((j) => j.text.includes('recrute à ton poste')));
    }
  }
  assert.ok(signings >= 1, 'au moins un renfort sur douze carrières');
});

test('un match joué fait progresser, davantage avec une bonne note et de bonnes décisions', () => {
  const mk = () => {
    const st = C.createCareer({ firstName: 'A', lastName: 'B', role: 'CM', clubId: 'fc-nantes', seed: 'grow' });
    while (st.phase !== 'matchday' || st.matchday.bye) {
      if (st.phase === 'week') C.submitWeek(st, { focus: 'technique', intensity: 'normale', offpitch: 'repos' });
      else if (st.phase === 'event') C.resolveEvent(st, 0);
      else if (st.phase === 'month_review') C.closeMonthReview(st);
      else C.applyMatchResult(st, {});
    }
    return st;
  };
  const play = (st, rating, choices) => {
    const before = C.currentCA(st), dec = st.player.attrs.decisions;
    const res = C.resultWithoutUser(st);
    C.applyMatchResult(st, { ...res, minutes: 90, started: true, rating, goals: 0, choices });
    return { ca: C.currentCA(st) - before, dec: st.player.attrs.decisions - dec };
  };
  const bench = mk(); const b0 = C.currentCA(bench);
  C.applyMatchResult(bench, C.resultWithoutUser(bench));
  const none = C.currentCA(bench) - b0;
  const avg = play(mk(), 6.4, null);
  const great = play(mk(), 7.8, { made: 8, ok: 7, expected: 4.5 });
  assert.ok(avg.ca > none, `jouer fait progresser (${avg.ca} > ${none})`);
  assert.ok(great.ca > avg.ca, 'un grand match fait progresser davantage');
  assert.ok(great.dec > avg.dec, 'de bonnes décisions affinent la lecture du jeu');
});

test('voie de rattrapage : le défi du coach relevé donne une titularisation, manqué il s\'arrête', () => {
  const st = C.createCareer({ firstName: 'A', lastName: 'B', role: 'CM', clubId: 'fc-nantes', seed: 'defi' });
  const serious = () => ({ focus: st.weekly?.coachFocus ?? 'technique', intensity: 'normale', offpitch: 'repos' });
  const finish = () => {
    while (st.phase !== 'week' && st.phase !== 'season_end') {
      if (st.phase === 'event') C.resolveEvent(st, 0);
      else if (st.phase === 'month_review') C.closeMonthReview(st);
      else C.applyMatchResult(st, st.matchday.bye ? {} : C.resultWithoutUser(st));
    }
  };
  st.chance = { need: 3, done: 0, season: st.season }; st.chanceSeason = st.season;
  st.player.trust = 0.1; st.player.attrs = Object.fromEntries(Object.keys(st.player.attrs).map((k) => [k, 0.2]));
  for (let i = 0; i < 3 && !st.chance?.earned; i++) {
    st.player.fresh = 0.8; st.player.injuryWeeks = 0;
    C.submitWeek(st, serious());
    if (i < 2) { assert.equal(st.chance?.done, i + 1); finish(); }
  }
  assert.ok(st.chance?.earned, 'défi relevé');
  assert.equal(C.selectionForecast(st).status, 'titulaire', 'le coach tient parole malgré un niveau très bas');
  finish();
  assert.equal(st.chance, null, 'la titularisation promise est consommée');
  // un défi manqué s'arrête tout de suite
  st.chance = { need: 3, done: 1, season: st.season };
  st.player.injuryWeeks = 0;
  C.submitWeek(st, { focus: serious().focus, intensity: 'normale', offpitch: 'sortie' });
  assert.equal(st.chance, null);
});
