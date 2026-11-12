// Recette du mode « temps forts » (Playwright, horloge simulée) : node tools/ui-check-tf.cjs [url] [dossier-captures]
// Un match de carrière regardé en entier : défilement rapide, actions clés rejouées, choix.
const { chromium, devices } = require('playwright');
const assert = require('node:assert/strict');
const URL = process.argv[2] || 'http://localhost:8000/index.html';
const SHOTS = process.argv[3] || null;

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['Pixel 7 landscape'] });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.clock.install();
  await page.goto(URL);
  await page.evaluate(async () => {
    localStorage.clear(); localStorage.setItem('generation-football.view3d', 'off');
    const C = await import('./src/career/career.js'); const S = await import('./src/career/save.js');
    const st = C.createCareer({ firstName: 'Léo', lastName: 'Tempsforts', role: 'ST', clubId: 'rc-lens', seed: 'tf' });
    st.player.trust = 1; for (const k in st.player.attrs) if (k !== 'gk') st.player.attrs[k] += 0.15;
    while (st.phase !== 'matchday' || st.matchday.bye) { if (st.phase === 'week') C.submitWeek(st, { focus: 'technique', intensity: 'normale', offpitch: 'repos' }); else if (st.phase === 'event') C.resolveEvent(st, 0); else if (st.phase === 'month_review') C.closeMonthReview(st); else C.applyMatchResult(st, {}); }
    S.saveCareer(1, st);
  });
  await page.reload();
  await page.click('#h-continue');
  await page.click('#w-watch');
  let t = 0, hlSeen = 0, choices = 0, choiceWait = 0, lastHl = '', shots = 0;
  while (t < 600) {
    await page.clock.runFor(1000); t++;
    const st = await page.evaluate(() => ({ badge: document.getElementById('mode-badge').textContent, banner: document.getElementById('replay-banner').textContent, choice: !document.getElementById('choices').hidden, done: !!document.getElementById('sum-career') }));
    if (st.done) break;
    if (/TEMPS FORT/.test(st.badge) && st.banner !== lastHl) {
      hlSeen++; lastHl = st.banner;
      if (SHOTS && shots < 2) { await page.screenshot({ path: `${SHOTS}/tf-hl-${shots}.png` }); shots++; }
    }
    if (st.choice) { choices++; choiceWait++; await page.keyboard.press('1'); }
    if (st.badge === 'PAUSE' && !st.choice) await page.keyboard.press(' ');
  }
  const realPlay = t - choiceWait;
  console.log(`match terminé en ${t} s (dont ${choiceWait} s de choix simulés) · ${hlSeen} temps forts · ${choices} choix`);
  assert.ok(realPlay >= 60 && realPlay <= 210, `durée hors cible : ${realPlay} s`);
  assert.ok(hlSeen >= 3, 'des actions clés rejouées');
  assert.deepEqual(errs, []);
  console.log('ui-check-tf : OK');
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
