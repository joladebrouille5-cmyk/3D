// Recette du match court (Playwright, horloge simulée) : node tools/ui-check-pace.cjs [url]
// Vérifie qu'un match de carrière regardé en entier dure environ 4 min 30 de temps réel.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const URL = process.argv[2] || 'http://localhost:8000/index.html';
(async () => {
  const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 1200, height: 760 } });
  const errs=[]; page.on('pageerror', e=>errs.push(e.message));
  await page.clock.install();
  await page.goto(URL);
  await page.evaluate(async () => {
    localStorage.clear(); localStorage.setItem('generation-football.matchLength', 'court');
    const C = await import('/src/career/career.js'); const S = await import('/src/career/save.js');
    const st = C.createCareer({ firstName: 'Léo', lastName: 'Rythme', role: 'CM', clubId: 'fc-nantes', seed: 'pace' });
    for (const k in st.player.attrs) if (k !== 'gk') st.player.attrs[k] = Math.min(0.9, st.player.attrs[k] + 0.2);
    st.player.trust = 1;
    while (st.phase !== 'matchday' || st.matchday.bye) { if (st.phase === 'week') C.submitWeek(st, { focus: 'technique', intensity: 'normale', offpitch: 'repos' }); else if (st.phase === 'event') C.resolveEvent(st, 0); else if (st.phase === 'month_review') C.closeMonthReview(st); else C.applyMatchResult(st, {}); }
    S.saveCareer(1, st);
  });
  await page.reload();
  await page.click('#h-load'); await page.click('[data-load="1"]'); await page.click('#w-watch');
  let t = 0, liveSeen = 0, fastMax = 0;
  while (t < 600) {
    await page.clock.runFor(5000); t += 5;
    const st = await page.evaluate(() => ({ badge: document.getElementById('mode-badge').textContent, clock: document.getElementById('clock-t').textContent, done: !!document.getElementById('sum-career'), choice: !document.getElementById('choices').hidden }));
    if (st.choice) await page.keyboard.press('1'); // choix rapide (le temps de réflexion n'est pas mesuré ici)
    if (/CHOISIR|TEMPS FORT/.test(st.badge)) liveSeen++;
    const mm = st.badge.match(/×(\d+)/); if (mm) fastMax = Math.max(fastMax, +mm[1]);
    if (st.badge === 'PAUSE' && !st.done) { await page.keyboard.press(' '); }
    if (st.done) break;
  }
  console.log(`match terminé en ${t} s réelles (pause de mi-temps comprise), temps forts observés : ${liveSeen}`);
  assert.ok(t >= 200 && t <= 330, `durée hors cible : ${t} s`);
  assert.ok(liveSeen > 5, 'des temps forts à vitesse réelle');
  assert.ok(fastMax > 20, 'accéléré hors des temps forts');
  assert.deepEqual(errs, []);
  console.log('ui-check-pace : OK');
  await b.close();
})();
