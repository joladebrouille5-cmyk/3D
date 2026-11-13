// Recette de la vue 3D (Playwright, téléphone en paysage) : node tools/ui-check-3d.cjs [url] [dossier-captures]
// Un match de carrière en temps forts : après un choix, la suite de l'action passe en 3D (WebGL),
// les choix restent en 2D ; un ralenti s'affiche en 3D ; aucune erreur.
const { chromium, devices } = require('playwright');
const assert = require('node:assert/strict');
const URL = process.argv[2] || 'http://localhost:8000/index.html';
const SHOTS = process.argv[3] || null;

(async () => {
  const b = await chromium.launch({ args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ ...devices['Pixel 7 landscape'] });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.clock.install();
  await page.goto(URL);
  await page.evaluate(async () => {
    localStorage.clear();
    const C = await import('./src/career/career.js'); const S = await import('./src/career/save.js');
    const st = C.createCareer({ firstName: 'Léo', lastName: 'Trois', role: 'ST', clubId: 'rc-lens', seed: 'v3d', potential: 'grand', level: 'avance' });
    st.player.trust = 1; for (const k in st.player.attrs) if (k !== 'gk') st.player.attrs[k] += 0.12;
    while (st.phase !== 'matchday' || st.matchday.bye) { if (st.phase === 'week') C.submitWeek(st, { focus: 'technique', intensity: 'normale', offpitch: 'repos' }); else if (st.phase === 'event') C.resolveEvent(st, 0); else if (st.phase === 'month_review') C.closeMonthReview(st); else C.applyMatchResult(st, {}); }
    S.saveCareer(1, st);
  });
  await page.reload();
  await page.click('#h-continue');
  await page.click('#w-watch');
  await page.waitForSelector('#pitch');
  let seen3dFollow = false, seen3dReplay = false, choiceIn2d = 0, choices = 0;
  for (let t = 0; t < 320 && !(seen3dFollow && seen3dReplay && choices >= 2); t++) {
    await page.clock.runFor(1000);
    const s = await page.evaluate(() => ({ badge: document.getElementById('mode-badge').textContent, choice: !document.getElementById('choices').hidden, v3d: !document.getElementById('pitch3d').hidden, done: !!document.getElementById('sum-career') }));
    if (s.done) break;
    if (s.choice) {
      choices++;
      if (!s.v3d) choiceIn2d++;
      await page.keyboard.press('1');
      await page.clock.runFor(1500);
      const f = await page.evaluate(() => ({ v3d: !document.getElementById('pitch3d').hidden, badge: document.getElementById('mode-badge').textContent }));
      if (f.v3d && /SUITE/.test(f.badge)) { if (!seen3dFollow && SHOTS) await page.screenshot({ path: `${SHOTS}/3d-suite.png` }); seen3dFollow = true; }
    } else if (s.v3d && /TEMPS FORT/.test(s.badge)) { if (!seen3dReplay && SHOTS) await page.screenshot({ path: `${SHOTS}/3d-ralenti.png` }); seen3dReplay = true; }
    else if (s.badge === 'PAUSE') await page.keyboard.press(' ');
  }
  const gl = await page.evaluate(() => { const c = document.getElementById('pitch3d'); return !!(c.getContext('webgl2') || c.getContext('webgl')); });
  console.log(`choix ${choices} (en 2D : ${choiceIn2d}) · suite en 3D : ${seen3dFollow} · ralenti en 3D : ${seen3dReplay} · WebGL : ${gl}`);
  assert.ok(gl, 'contexte WebGL créé');
  assert.ok(choices >= 1 && choiceIn2d === choices, 'les choix s\'affichent en 2D');
  assert.ok(seen3dFollow || seen3dReplay, 'la 3D prend le relais (suite de l\'action ou ralenti)');
  // bouton 2D : retour à la vue du dessus, mémorisé ; puis 3D de nouveau
  const state = () => page.evaluate(() => ({ v3d: !document.getElementById('pitch3d').hidden, choice: !document.getElementById('choices').hidden, done: !!document.getElementById('sum-career'), badge: document.getElementById('mode-badge').textContent }));
  await page.click('#btn-view [data-view="2d"]');
  assert.equal(await page.evaluate(() => localStorage.getItem('generation-football.view3d')), 'off');
  await page.clock.runFor(500);
  const s2 = await state();
  assert.ok(!s2.v3d, `en 2D, la vue 3D est masquée (${JSON.stringify(s2)})`);
  await page.click('#btn-view [data-view="3d"]');
  let live = null;
  for (let i = 0; i < 12; i++) {
    await page.clock.runFor(500);
    live = await state();
    if (live.v3d || live.done) break;
    if (live.choice) await page.keyboard.press('1');
    else if (live.badge === 'PAUSE') await page.keyboard.press(' ');
  }
  assert.ok(live.v3d || live.done, `en 3D, le direct s'affiche en 3D (${JSON.stringify(live)})`);
  if (SHOTS && live.v3d) await page.screenshot({ path: `${SHOTS}/3d-direct.png` });
  assert.deepEqual(errs, []);
  console.log('ui-check-3d : OK');
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
