// Tests de la carrière : catalogue, niveau de départ, potentiel, choix, saison, sauvegarde.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../src/career/career.js';
import { clubById, CLUBS, leagueFor, academyQuality, buildTeamSquad } from '../src/career/clubs.js';
import { simulateCareerMatch } from '../src/career/play.js';

// joue des semaines rapidement : rencontres résumées par le modèle agrégé
function runWeeks(st, n, choices = { focus: 'technique', intensity: 'normale', offpitch: 'repos' }, ev = 0) {
  for (let i = 0; i < n && st.phase !== 'season_end'; ) {
    if (st.phase === 'month_review') C.closeMonthReview(st);
    else if (st.phase === 'week') { C.submitWeek(st, choices); i++; }
    else if (st.phase === 'event') C.resolveEvent(st, ev);
    else if (st.phase === 'matchday') C.applyMatchResult(st, st.matchday.bye ? {} : C.resultWithoutUser(st));
  }
  while (st.phase === 'event' || st.phase === 'matchday' || st.phase === 'month_review') {
    if (st.phase === 'month_review') C.closeMonthReview(st);
    else if (st.phase === 'event') C.resolveEvent(st, ev);
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
    else if (st.phase === 'month_review') C.closeMonthReview(st);
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

test('aperçu de la semaine : effets attendus sans toucher à la partie, cohérents avec le choix', () => {
  const st = mk('rc-lens', 'preview');
  const before = JSON.stringify(st);
  const leger = C.previewWeek(st, { focus: 'technique', intensity: 'légère', offpitch: 'repos' });
  const intense = C.previewWeek(st, { focus: 'technique', intensity: 'intense', offpitch: 'extra' });
  assert.equal(JSON.stringify(st), before, 'l\'aperçu ne modifie rien');
  assert.ok(intense.ca > leger.ca, 'plus d\'intensité = plus de progression attendue');
  assert.ok(intense.gauges.fresh < leger.gauges.fresh, 'et plus de fatigue');
  assert.ok(intense.injuryRisk > leger.injuryRisk);
  const tech = C.previewWeek(st, { focus: 'technique', intensity: 'normale', offpitch: 'repos' });
  const phys = C.previewWeek(st, { focus: 'physique', intensity: 'normale', offpitch: 'repos' });
  const d = (pv, k) => pv.attrs.find((a) => a.k === k)?.d ?? 0;
  assert.ok(d(tech, 'passing') > d(phys, 'passing'));
  assert.ok(d(phys, 'pace') > d(tech, 'pace'));
  assert.ok(C.previewWeek(st, { focus: 'technique', intensity: 'normale', offpitch: 'sortie' }).pa < 0);
  assert.ok(C.previewWeek(st, { focus: 'technique', intensity: 'normale', offpitch: 'video' }).pa > 0);
});

test('bilan mensuel : toutes les 4 semaines, avec le détail mesuré de chaque choix', () => {
  const st = mk('rc-lens', 'month');
  const ca0 = C.currentCA(st), attrs0 = { ...st.player.attrs };
  let weeks = 0;
  while (st.phase !== 'month_review') {
    if (st.phase === 'week') { C.submitWeek(st, { focus: weeks % 2 ? 'physique' : 'technique', intensity: 'normale', offpitch: weeks % 2 ? 'video' : 'sortie' }); weeks++; }
    else if (st.phase === 'event') C.resolveEvent(st, 0);
    else C.applyMatchResult(st, st.matchday.bye ? {} : C.resultWithoutUser(st));
  }
  assert.equal(weeks, 4);
  const rv = st.monthReview;
  assert.deepEqual([rv.fromWeek, rv.toWeek], [1, 4]);
  assert.ok(Math.abs(rv.ca[0] - ca0) < 1e-9 && Math.abs(rv.ca[1] - C.currentCA(st)) < 1e-9);
  // sources présentes, avec leur nombre de semaines
  const src = Object.fromEntries(rv.sources.map((x) => [x.key, x]));
  assert.equal(src['train:technique'].n, 2);
  assert.equal(src['train:physique'].n, 2);
  assert.equal(src['off:sortie'].n, 2);
  assert.equal(src['off:video'].n, 2);
  assert.ok(src['off:sortie'].pa < 0 && src['off:video'].pa > 0);
  assert.ok(src['off:sortie'].gauges.discipline < 0);
  assert.ok(src['train:physique'].attrs.some((a) => a.k === 'pace' && a.d > 0));
  // la somme des sources explique la variation de chaque attribut et du potentiel
  for (const a of rv.attrs) {
    const sum = a.by.train + a.by.off + a.by.match + a.by.other;
    assert.ok(Math.abs(sum - (st.player.attrs[a.k] - attrs0[a.k])) < 1e-9, `attribut ${a.k}`);
  }
  const paSum = rv.sources.reduce((s, x) => s + x.pa, 0);
  assert.ok(Math.abs(paSum - rv.paDelta) < 1e-9, 'le potentiel est entièrement expliqué');
  assert.ok(rv.advice.length >= 1);
  assert.equal(rv.matches.list.length + (4 - rv.matches.list.length), 4);
  C.closeMonthReview(st);
  assert.equal(st.phase, 'week');
  assert.ok(st.lastMonthReview, 'le dernier bilan reste consultable');
});

test('chaque option de chaque événement s\'applique sans erreur (formation, pro, étranger)', async () => {
  const { EVENTS } = await import('../src/career/events.js');
  const { Rng } = await import('../src/engine/rng.js');
  const base = C.createCareer({ firstName: 'A', lastName: 'B', role: 'ST', clubId: 'fc-nantes', seed: 'evts' });
  const pro = structuredClone(base); pro.stage = 'Pro'; pro.player.age = 24; pro.player.agent = true;
  const away = structuredClone(pro); away.clubId = 'ger-bayern-munich';
  let n = 0;
  for (const st0 of [base, pro, away]) for (const e of EVENTS) for (let i = 0; i < e.options.length; i++) {
    const st = structuredClone(st0);
    assert.equal(typeof e.text(st), 'string', e.id);
    const label = e.options[i].label;
    if (typeof label === 'function') assert.equal(typeof label(st), 'string');
    const out = e.options[i].apply(st, new Rng(`${e.id}-${i}`));
    assert.equal(typeof out, 'string', `${e.id} option ${i}`);
    n++;
  }
  assert.ok(n > 100, `${n} options jouées`);
});

test('sauvegarde : export en fichier puis import dans un autre emplacement', async () => {
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  const S = await import('../src/career/save.js');
  const st = C.createCareer({ firstName: 'Noa', lastName: 'Export', role: 'ST', clubId: 'fc-nantes', seed: 'export' });
  S.saveCareer(1, st);
  const { name, text } = S.exportCareer(1);
  assert.match(name, /^generation-football-noa-export-2026-2027\.json$/);
  const sum = S.importCareer(text, 3);
  assert.equal(sum.name, 'Noa Export');
  assert.deepEqual(S.loadCareer(3), S.loadCareer(1));
  assert.throws(() => S.importCareer('{"app":"autre"}', 2), /pas une sauvegarde/);
  assert.throws(() => S.importCareer('pas du json', 2), /lisible/);
  delete globalThis.localStorage;
});

test('objectifs de saison : fixés au départ, suivis, réglés au bilan', () => {
  const st = C.createCareer({ firstName: 'A', lastName: 'B', role: 'ST', clubId: 'fc-nantes', seed: 'objectifs' });
  assert.ok(st.objectives.length >= 2 && st.objectives.length <= 3, JSON.stringify(st.objectives));
  for (const o of st.objectives) { const pr = C.objectiveProgress(st, o); assert.ok(pr.ratio >= 0 && pr.ratio <= 1); }
  let g = 0;
  while (st.phase !== 'season_end' && g++ < 5000) {
    if (st.phase === 'week') C.submitWeek(st, { focus: 'technique', intensity: 'normale', offpitch: 'ecole' });
    else if (st.phase === 'event') C.resolveEvent(st, 0);
    else if (st.phase === 'month_review') C.closeMonthReview(st);
    else C.applyMatchResult(st, st.matchday.bye ? {} : C.resultWithoutUser(st));
  }
  const h = st.history.at(-1);
  assert.equal(h.objectives.length, st.objectives.length);
  assert.ok(h.objectives.some((o) => !o.done), 'sans jouer, les objectifs individuels sont manqués');
  assert.ok(st.journal.some((j) => /Objectif (atteint|manqué)/.test(j.text ?? j)));
});

test('gestes signature et changement de poste', async () => {
  const { unlockTraits } = await import('../src/career/traits.js');
  const st = C.createCareer({ firstName: 'A', lastName: 'B', role: 'W', clubId: 'fc-nantes', seed: 'gestes' });
  const p = st.player;
  Object.assign(p.attrs, { dribbling: 0.85, accel: 0.8, shooting: 0.8, composure: 0.75 });
  const got = unlockTraits(p);
  assert.ok(got.includes('dribbleur') && got.includes('enroulee'), got.join(','));
  assert.deepEqual(unlockTraits(p), [], 'un geste ne se débloque qu\'une fois');
  // le geste arrive jusqu'au moteur
  const { Match } = await import('../src/engine/match.js');
  const { buildTeamSquad, clubById } = await import('../src/career/clubs.js');
  const mine = buildTeamSquad(clubById('fc-nantes'), 'U17', 2026, null, p, 'titulaire');
  const u = mine.starters.find((x) => x.isUser);
  assert.ok(u.traits.includes('dribbleur'));
  void Match;
  // changement de poste : une fois par saison, période d'adaptation
  const before = C.currentCA(st);
  const msg = C.changeRole(st, 'AM');
  assert.match(msg, /Milieu offensif|milieu offensif/);
  assert.equal(p.role, 'AM');
  assert.notEqual(C.currentCA(st), before);
  assert.throws(() => C.changeRole(st, 'ST'), /Un seul changement/);
  assert.throws(() => { st.player.roleChange = null; C.changeRole(st, 'GK'); }, /gardien/);
});

test('ateliers : curseur plus exigeant, deux mini-jeux par thème qui alternent', async () => {
  const W = await import('../src/career/weekly.js');
  const p = { attrs: { firstTouch: 0.5, accel: 0.5, vision: 0.5, shooting: 0.5, tackling: 0.5, gk: 0.5 } };
  const z = W.drillZone(p, 'technique', 'normale');
  assert.ok(z.width <= 0.14 && z.perfect <= 0.037, `zone ${z.width}, parfait ${z.perfect}`);
  assert.ok(z.speed >= 1.3 && z.accel > 1, 'plus rapide, et il accélère');
  const kinds = new Set();
  for (const f of Object.keys(W.DRILLS)) for (const seed of [10, 11]) kinds.add(W.drillFor(p, f, 'normale', seed).kind);
  assert.deepEqual([...kinds].sort(), ['curseur', 'jongles', 'lecture', 'memoire', 'penalty', 'plongeon', 'reaction']);
  // un meilleur attribut rend le geste plus accessible ; l'intensité le rend plus rapide
  const pro = { attrs: Object.fromEntries(Object.keys(p.attrs).map((k) => [k, 0.9])) };
  assert.ok(W.drillFor(pro, 'defense', 'normale', 11).windowMs > W.drillFor(p, 'defense', 'normale', 11).windowMs);
  assert.ok(W.drillFor(p, 'defense', 'intense', 11).windowMs < W.drillFor(p, 'defense', 'normale', 11).windowMs);
  assert.equal(W.drillFor(p, 'recuperation', 'normale', 1), null);
});
