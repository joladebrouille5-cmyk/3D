// Recette du mode carrière (Playwright) : node tools/ui-check-career.cjs [url] [dossier-captures]
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const URL = process.argv[2] || 'http://localhost:8000/index.html';
const SHOTS = process.argv[3] || null;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 860 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const shot = async (n) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${n}.png` }); };
  await page.goto(URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('#h-new');
  assert.equal(await page.isDisabled('#h-load'), true, 'aucune sauvegarde au départ');
  await shot('c1-home');

  // création du joueur
  await page.click('#h-new');
  await page.click('#n-next');
  assert.match(await page.textContent('#n-err'), /prénom/);
  await page.fill('#n-first', 'Enzo');
  await page.fill('#n-last', 'Testeur');
  await page.selectOption('#n-role', 'W');
  await page.click('#n-next');

  // choix du club
  await page.waitForSelector('#c-list li[data-id]');
  await page.fill('#c-q', 'lens');
  await page.click('#c-list li[data-id="rc-lens"]');
  await shot('c2-club');
  assert.match(await page.textContent('#c-detail'), /Centre de formation/);
  await page.click('#c-go');
  await page.waitForSelector('.hub');
  assert.match(await page.textContent('.hub-head'), /RC Lens/);
  assert.match(await page.textContent('.hub-head'), /U17/);
  await shot('c3-hub');

  // semaines : entraînement, événements, matchs simulés
  let simulated = 0;
  for (let i = 0; i < 12 && simulated < 2; i++) {
    if (await page.$('[data-ev]')) { await page.click('[data-ev="0"]'); continue; }
    if (await page.$('#w-go')) { await page.click('[data-int="intense"]'); await page.click('#w-go'); continue; }
    if (await page.$('#w-bye')) { await page.click('#w-bye'); continue; }
    if (await page.$('#w-sim')) { await page.click('#w-sim'); await page.waitForSelector('.hub', { timeout: 60000 }); simulated++; continue; }
  }
  assert.ok(simulated >= 1, 'au moins un match simulé');
  assert.match(await page.textContent('.report'), /\d+-\d+/);
  await shot('c4-after-sim');

  // match en vue 2D jusqu'au bilan, puis retour à la carrière
  for (let i = 0; i < 8 && !(await page.$('#w-watch')); i++) {
    if (await page.$('[data-ev]')) await page.click('[data-ev="0"]');
    else if (await page.$('#w-go')) await page.click('#w-go');
    else if (await page.$('#w-bye')) await page.click('#w-bye');
  }
  const week = await page.textContent('.week h2');
  await page.click('#w-watch');
  await page.waitForSelector('#pitch');
  await page.waitForTimeout(1500);
  await shot('c5-match');
  assert.match(await page.textContent('#role-label'), /Testeur/);
  await page.click('#btn-quick');
  await page.click('#q-yes');
  await page.waitForSelector('#sum-career', { timeout: 60000 });
  await page.click('#sum-career');
  await page.waitForSelector('.hub');
  assert.notEqual(await page.textContent('.week h2'), week, 'la semaine a avancé');

  // sauvegarde et chargement
  await page.click('#hub-home');
  assert.equal(await page.isDisabled('#h-load'), false);
  await page.click('#h-load');
  assert.match(await page.textContent('.slots'), /Enzo Testeur/);
  await page.click('[data-load="1"]');
  await page.waitForSelector('.hub');
  assert.match(await page.textContent('.hub-head'), /RC Lens/);
  await shot('c6-loaded');

  assert.deepEqual(errors, []);
  console.log('ui-check-career : OK');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
