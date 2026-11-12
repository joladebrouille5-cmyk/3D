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
  // valider la semaine : l'atelier s'ouvre (thème avec geste), on tente le geste une fois
  let drills = 0;
  const goWeek = async () => {
    await page.click('#w-go');
    if (await page.waitForSelector('.drill-backdrop', { timeout: 800 }).catch(() => null)) {
      drills++;
      if (drills === 1) await shot('c3b-drill');
      await page.click('#dr-track');
      await page.waitForSelector('.drill-backdrop', { state: 'detached', timeout: 5000 });
    }
  };
  await page.goto(URL);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('generation-football.view3d', 'off'); });
  await page.reload();
  await page.waitForSelector('#h-new');
  // sans sauvegarde, « Charger » reste ouvert pour importer un fichier
  assert.match(await page.textContent('#h-load'), /importer un fichier/, 'aucune sauvegarde au départ : import proposé');
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
  // roues du niveau puis du potentiel : un tour chacune, verdict sous le pointeur, puis entrée au centre
  const ids = { 'En retard': 'retard', 'Dans le groupe': 'groupe', 'Au niveau': 'niveau', 'En avance': 'avance', 'Surclassé': 'surclasse', 'Précoce': 'precoce',
    'Espoir modeste': 'modeste', 'Bon espoir': 'bon', 'Bel espoir': 'bel', 'Grand espoir': 'grand', 'Pépite': 'pepite', 'Phénomène': 'phenomene' };
  const verdicts = [];
  for (const step of [0, 1]) {
    await page.waitForSelector('.wheel-screen .wheel');
    assert.equal(await page.locator('.wheel .ws').count(), 10);
    if (step === 0) await shot('c2b-wheel');
    await page.click('#wheel-spin');
    await page.waitForSelector(step === 0 ? '#wheel-next' : '#wheel-go', { timeout: 15000 });
    const verdict = (await page.textContent('.w-verdict')).trim();
    assert.ok(ids[verdict], verdict);
    // le palier tiré est bien celui qui s'est arrêté sous le pointeur
    const under = await page.evaluate(() => {
      const ptr = document.querySelector('#wheel-ptr').getBoundingClientRect();
      const el = document.elementFromPoint(ptr.left + ptr.width / 2, ptr.bottom + 6);
      return el?.closest('.ws')?.dataset.tier ?? null;
    });
    assert.equal(under, ids[verdict], `sous le pointeur : ${under}, verdict : ${verdict}`);
    verdicts.push(verdict);
    if (step === 0) await page.click('#wheel-next');
  }
  const verdict = verdicts[1];
  await page.waitForTimeout(600);
  await shot('c2c-wheel-verdict');
  await page.click('#wheel-go');
  await page.waitForSelector('.hub');
  assert.match(await page.textContent('.profile .pot'), new RegExp(verdict));
  assert.match(await page.textContent('.hub-head'), /RC Lens/);
  assert.match(await page.textContent('.hub-head'), /U17/);
  await shot('c3-hub');

  // programme de la semaine : l'aperçu des effets suit les choix, sans rien valider
  const prev1 = await page.textContent('#w-preview');
  assert.match(prev1, /Effets attendus/);
  await page.click('[data-focus="physique"]');
  await page.click('[data-int="intense"]');
  await page.click('[data-off="sortie"]');
  const prev2 = await page.textContent('#w-preview');
  assert.notEqual(prev1, prev2, 'l\'aperçu change avec les choix');
  assert.match(prev2, /Risque blessure/);
  assert.match(prev2, /Vitesse/);
  assert.match(await page.textContent('.week h2'), /Semaine 1\//, 'rien n\'est validé par un simple choix');

  // semaines : entraînement, événements, matchs simulés, bilan mensuel
  let simulated = 0, reviews = 0;
  for (let i = 0; i < 30 && (simulated < 2 || reviews < 1); i++) {
    if (await page.$('#mr-close')) {
      const txt = await page.textContent('.modal.review');
      assert.match(txt, /Bilan du mois 1/);
      assert.match(txt, /Tes choix d'entraînement/i);
      assert.match(txt, /Hors du terrain/i);
      assert.match(txt, /Sortie entre amis/);
      assert.match(txt, /Potentiel/);
      assert.match(txt, /Le staff te dit/);
      await shot('c4b-review');
      await page.click('#mr-close'); reviews++; continue;
    }
    if (await page.$('[data-ev]')) { await page.click('[data-ev="0"]'); continue; }
    if (await page.$('#w-go')) { await goWeek(); continue; }
    if (await page.$('#w-bye')) { await page.click('#w-bye'); continue; }
    if (await page.$('#w-sim')) { await page.click('#w-sim'); await page.waitForSelector('.hub', { timeout: 60000 }); simulated++; continue; }
  }
  assert.ok(simulated >= 1, 'au moins un match simulé');
  assert.equal(reviews, 1, 'un bilan mensuel après quatre semaines');
  assert.ok(await page.$('#hub-review'), 'le dernier bilan reste consultable');
  await shot('c4-after-sim');

  // match en vue 2D jusqu'au bilan, puis retour à la carrière
  for (let i = 0; i < 8 && !(await page.$('#w-watch')); i++) {
    if (await page.$('#mr-close')) await page.click('#mr-close');
    else if (await page.$('[data-ev]')) await page.click('[data-ev="0"]');
    else if (await page.$('#w-go')) await goWeek();
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

  // pilotage direct : une partie préparée où le joueur est titulaire
  await page.evaluate(async () => {
    const C = await import('/src/career/career.js'); const S = await import('/src/career/save.js');
    const st = C.createCareer({ firstName: 'Léa', lastName: 'Pilote', role: 'CM', clubId: 'fc-nantes', seed: 'pilot' });
    for (const k in st.player.attrs) if (k !== 'gk') st.player.attrs[k] = Math.min(0.9, st.player.attrs[k] + 0.2);
    st.player.trust = 1;
    while (st.phase !== 'matchday' || st.matchday.bye) { if (st.phase === 'week') C.submitWeek(st, { focus: 'technique', intensity: 'normale', offpitch: 'repos' }); else if (st.phase === 'event') C.resolveEvent(st, 0); else if (st.phase === 'month_review') C.closeMonthReview(st); else C.applyMatchResult(st, {}); }
    S.saveCareer(3, st);
  });
  await page.click('#hub-home');
  await page.click('#h-load');
  await page.click('[data-load="3"]');
  await page.waitForSelector('#w-watch');
  assert.match(await page.textContent('.week'), /titulaire/);
  await page.click('#w-watch');
  // choix en match : le match se fige et propose des options ; on en choisit une au clavier
  await page.waitForFunction(() => !document.getElementById('choices').hidden, null, { timeout: 60000 });
  assert.match(await page.textContent('#btn-ctl'), /Choix/);
  const nOpts = await page.locator('#choices .ch-opt').count();
  assert.ok(nOpts >= 2 && nOpts <= 4, `2 à 4 options (${nOpts})`);
  const clock1 = await page.textContent('#clock-t');
  await page.waitForTimeout(700);
  assert.equal(await page.textContent('#clock-t'), clock1, 'le match est figé pendant le choix');
  await shot('c7-choice');
  await page.keyboard.press('1');
  assert.equal(await page.isHidden('#choices'), true);
  assert.match(await page.textContent('#tab-consignes'), /Pilote/);
  await page.click('#btn-ctl'); // déléguer à l'IA
  assert.match(await page.textContent('#btn-ctl'), /Auto/);
  await page.click('#btn-quick');
  await page.click('#q-yes');
  await page.waitForSelector('#sum-career', { timeout: 60000 });
  await page.click('#sum-career');
  await page.waitForSelector('.hub');
  assert.match(await page.textContent('.report'), /min, note/);

  assert.deepEqual(errors, []);
  assert.ok(drills >= 1, 'l\'atelier de la semaine est proposé');
  console.log('ui-check-career : OK');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
