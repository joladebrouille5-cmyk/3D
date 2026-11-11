// Recette d'interface (Playwright) : node tools/ui-check.cjs [url]
// Nécessite un serveur statique (npm run serve) et Playwright disponible.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');

const URL = process.argv[2] || 'http://localhost:8000/index.html';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 860 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(URL);
  await page.waitForSelector('#su-go');

  // Focus : taper dans le champ de graine ne déclenche aucun raccourci
  await page.fill('#su-seed', '');
  await page.type('#su-seed', 'e 1 4 f');
  assert.equal(await page.inputValue('#su-seed'), 'e 1 4 f');
  await page.fill('#su-seed', 'ui-check');
  await page.click('#su-go');
  await page.waitForTimeout(1500);
  assert.equal(await page.textContent('#mode-badge'), 'DIRECT 1×');

  // Pause : Espace fige l'horloge
  await page.keyboard.press(' ');
  const clock1 = await page.textContent('#clock');
  await page.waitForTimeout(800);
  assert.equal(await page.textContent('#clock'), clock1, 'la pause fige le temps');
  assert.equal(await page.textContent('#mode-badge'), 'PAUSE');

  // Modal : les raccourcis du match ne traversent pas une fenêtre ouverte
  await page.keyboard.press('F1');
  await page.waitForSelector('#help-close');
  await page.keyboard.press('4');
  await page.keyboard.press('F8');
  await page.keyboard.press('Escape'); // ferme d'abord la couche au premier plan
  await page.waitForTimeout(200);
  assert.equal(await page.$('#help-close'), null);
  assert.equal(await page.textContent('#mode-badge'), 'PAUSE', 'aucun replay ni reprise déclenchés');
  assert.equal(await page.isHidden('#tab-analyse'), true, 'aucun changement d\'onglet');

  // Brouillon : une modification non transmise ne crée aucune consigne
  await page.keyboard.press('3');
  await page.selectOption('#ins-bloc', 'bas');
  assert.equal((await page.textContent('#ins-list')).trim(), '');
  await page.click('#ins-undo');
  assert.equal(await page.inputValue('#ins-bloc'), 'moyen');

  // Replay : lecture seule, retour exact au direct
  await page.keyboard.press(' ');
  await page.waitForTimeout(4000);
  await page.keyboard.press(' ');
  const before = { clock: await page.textContent('#clock'), score: await page.textContent('#score') };
  await page.click('#btn-replay');
  await page.waitForTimeout(300);
  const badge = await page.textContent('#mode-badge');
  if (badge === 'REPLAY') {
    await page.waitForTimeout(1500);
    await page.keyboard.press('F9');
  }
  assert.deepEqual({ clock: await page.textContent('#clock'), score: await page.textContent('#score') }, before);
  assert.equal(await page.textContent('#mode-badge'), 'PAUSE');

  // Résultat rapide : même moteur, sans rendu, jusqu'au bilan
  await page.click('#btn-quick');
  await page.click('#q-yes');
  await page.waitForSelector('#sum-new', { timeout: 60000 });
  assert.match(await page.textContent('.modal h1'), /\d+ – \d+/);

  assert.deepEqual(errors, []);
  console.log('ui-check : OK');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
