// Tests de la carrière : catalogue, niveau de départ, potentiel, choix, saison, sauvegarde.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../src/career/career.js';
import { clubById, CLUBS, leagueFor, academyQuality, buildTeamSquad } from '../src/career/clubs.js';
import { simulateCareerMatch } from '../src/career/play.js';

// joue des semaines rapidement : rencontres résumées par le modèle agrégé
function runWeeks(st, n, choices = { focus: 'technique', intensity: 'normale', offpitch: 'repos' }, ev = 0) {
  for (let i = 0; i < n && st.phase !== 'season_end'; ) {
    if (st.phase === 'week') { C.submitWeek(st, choices); i++; }
    else if (st.phase === 'event') C.resolveEvent(st, ev);
    else if (st.phase === 'matchday') C.applyMatchResult(st, st.matchday.bye ? {} : C.resultWithoutUser(st));
  }
  while (st.phase === 'event' || st.phase === 'matchday') {
    if (st.phase === 'event') C.resolveEvent(st, ev);
    else C.applyMatchResult(st, st.matchday.bye ? {} : C.resultWithoutUser(st));
  }
  return st;
}
const mk = (clubId, seed = 'seed', role = 'CM') => C.createCareer({ firstName: 'A', lastName: 'B', role, clubId, seed });

test('catalogue : clubs réels rapprochés sans confusion (PSG, Toulouse, réserves)', () => {
  assert.equal(clubById('paris-saint-germain').senior.level, 1);
  assert.equal(clubById('paris-fc').senior.level, 1);
  assert.equal(clubById('toulouse-fc').u17.name, 'Toulouse FC');
  assert.ok(clubById('ujs-toulouse'), 'UJS Toulouse reste un club distinct');
  assert.equal(clubById('stade-rennais').senior.level, 1);
  assert.equal(clubById('stade-rennais').reserve.name, 'Stade Rennais 2');
  assert.ok(CLUBS.length > 200);
});

test('catalogue : aucun nom de joueur jeune (mineurs) importé', () => {
  for (const c of CLUBS) {
    assert.equal(c.u17?.players, undefined);
    assert.equal(c.u19?.players, undefined);
  }
  const u17 = buildTeamSquad(clubById('rc-lens'), 'U17', 2026, leagueFor(clubById('rc-lens'), 'U17'));
  assert.ok([...u17.starters, ...u17.bench].every((p) => !p.real));
  const pro = buildTeamSquad(clubById('rc-lens'), 'Pro', 2026, leagueFor(clubById('rc-lens'), 'Pro'));
  assert.ok(pro.starters.some((p) => p.real), 'effectif pro : noms publiés');
});

test('le centre de formation fixe le niveau de départ ; le potentiel ne dépend pas du club', () => {
  const top = mk('olympique-lyonnais', 's');
  const amateur = mk('fc-bassin-arcachon', 's');
  assert.ok(academyQuality(clubById('olympique-lyonnais')) > academyQuality(clubById('fc-bassin-arcachon')));
  assert.ok(C.currentCA(top) > C.currentCA(amateur) + 0.05);
  assert.equal(top.player.pa, amateur.player.pa);
  assert.ok(top.player.pa > C.currentCA(top));
  // potentiel aléatoire d'une partie à l'autre
  const pas = new Set(['a', 'b', 'c', 'd'].map((s) => mk('rc-lens', s).player.pa.toFixed(4)));
  assert.ok(pas.size >= 3);
});

test('le championnat U17 utilise le groupe réel du catalogue, ou un groupe simulé signalé', () => {
  const lens = mk('rc-lens');
  assert.equal(lens.league.simulated, false);
  assert.match(lens.league.name, /National U17/);
  assert.ok(lens.league.teams.length >= 12);
  const am = mk('fc-bassin-arcachon');
  assert.equal(am.league.simulated, true);
  assert.match(am.league.name, /simulé/);
});

test('même graine et mêmes choix => même carrière (sauvegarde rejouable)', () => {
  const a = runWeeks(mk('rc-lens', 'det'), 10);
  const b = runWeeks(mk('rc-lens', 'det'), 10);
  const strip = (s) => JSON.stringify({ ...s, createdAt: 0 });
  assert.equal(strip(a), strip(b));
});

test('le potentiel évolue selon les choix', () => {
  const sage = runWeeks(mk('rc-lens', 'pa'), 20, { focus: 'tactique', intensity: 'normale', offpitch: 'video' }, 0);
  const excès = runWeeks(mk('rc-lens', 'pa'), 20, { focus: 'physique', intensity: 'intense', offpitch: 'sortie' }, 1);
  assert.ok(sage.player.pa > excès.player.pa + 0.01, `${sage.player.pa} vs ${excès.player.pa}`);
  assert.ok(sage.player.discipline > excès.player.discipline);
});

test('la progression rapproche du potentiel sans le dépasser durablement', () => {
  const st = runWeeks(mk('olympique-lyonnais', 'grow'), 26);
  const ca0 = st.seasonStats.caStart;
  const h = st.history[0];
  assert.ok(h.caEnd > ca0, 'progression sur la saison');
  assert.ok(h.caEnd - ca0 < 0.12, 'progression bornée');
  assert.ok(h.caEnd <= st.player.pa + 0.02);
});

test('fin de saison : bilan, offres, nouvelle saison et âge', () => {
  const st = runWeeks(mk('rc-lens', 'season'), 40);
  assert.equal(st.phase, 'season_end');
  assert.equal(st.player.age, 16);
  assert.ok(st.offers.length >= 1);
  const own = st.offers.findIndex((o) => o.own);
  C.acceptOffer(st, own >= 0 ? own : 0);
  assert.equal(st.phase, 'week');
  assert.equal(st.season, 2027);
  assert.equal(st.week, 0);
  assert.ok(['U17', 'U19'].includes(st.stage));
});

test('sauvegarde : l\'état est sérialisable et reprend à l\'identique', () => {
  const st = runWeeks(mk('fc-nantes', 'save'), 6);
  const copy = JSON.parse(JSON.stringify(st));
  runWeeks(st, 4); runWeeks(copy, 4);
  assert.equal(JSON.stringify(st), JSON.stringify(copy));
});

test('un match de carrière passe par le moteur : le joueur titulaire joue et reçoit une note', () => {
  const st = mk('rc-lens', 'match', 'ST');
  st.player.attrs = Object.fromEntries(Object.entries(st.player.attrs).map(([k, v]) => [k, Math.min(0.97, v + 0.2)]));
  st.player.trust = 1;
  runWeeks(st, 0);
  while (st.phase !== 'matchday' || st.matchday.bye) {
    if (st.phase === 'week') C.submitWeek(st, { focus: 'finition', intensity: 'normale', offpitch: 'repos' });
    else if (st.phase === 'event') C.resolveEvent(st, 0);
    else C.applyMatchResult(st, {});
  }
  assert.equal(st.matchday.selection, 'titulaire');
  const setup = C.matchSetup(st);
  const res = simulateCareerMatch(setup);
  assert.ok(res.minutes > 0 && res.started);
  assert.ok(res.rating >= 3 && res.rating <= 10);
  C.applyMatchResult(st, res);
  assert.equal(st.seasonStats.apps, 1);
});
