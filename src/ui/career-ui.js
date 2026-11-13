// Écrans de la carrière : accueil, chargement, création, choix du club, semaine, fin de saison.
import * as C from '../career/career.js';
import { CLUBS, clubById, academyQuality, academyStars, clubLevel, LEVEL_NAMES, leagueFor, STAGE_LABEL, youthCA, ACADEMY_COUNTRIES, academiesOf, divisionName, FOREIGN_LEAGUES } from '../career/clubs.js';
import { countryInfo } from '../career/countries.js';
import { listSaves, saveCareer, loadCareer, deleteSave, firstFreeSlot, hasSaves, SLOTS, exportCareer, importCareer } from '../career/save.js';
import { createCareerMatch, extractResult } from '../career/play.js';
import { CATALOG } from '../data/catalog.js';
import { startMatch, showQuickMatchSetup, setHomeHandler } from './app.js';
import { crestSVG, clubColors } from './crest.js';
import { icon } from './icons.js';
import { avatar, faceUrl, faceIndexFor, faceSample } from './faces.js';
import { extrasForWeek } from '../career/competitions.js';
import { startHomeScene, stopHomeScene } from './home-scene.js';
import { sound } from './sound.js';
import { WHEELS, slicesOf, drawFrom, tierById, LEVEL_TIERS } from '../career/potential.js';
import { objectivesBlock, renderCoach, renderMoney, renderPalmares, renderRetired, renderSeasonEnd, showRoleChange } from './career-end.js';
import { runDrill } from './drills.js';
const LEVEL_COLORS = Object.fromEntries(LEVEL_TIERS.map((t) => [t.id, t.color]));
export const crest = (c, size = 28) => `<span class="crest-wrap">${crestSVG(c, size)}</span>`;

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const root = () => document.getElementById('screen');
export const stars = (n) => '★'.repeat(Math.floor(n)) + (n % 1 ? '½' : '') + '☆'.repeat(5 - Math.ceil(n));
const ATTR_LABELS = { pace: 'Vitesse', accel: 'Accélération', stamina: 'Endurance', passing: 'Passe', vision: 'Vision', decisions: 'Décisions', firstTouch: 'Contrôle', dribbling: 'Dribble', tackling: 'Tacle', positioning: 'Placement', shooting: 'Frappe', aerial: 'Jeu aérien', aggression: 'Agressivité', gk: 'Gardien', composure: 'Sang-froid' };

const FOCUS_ICON = { technique: 'technique', physique: 'physique', tactique: 'tactique', finition: 'finition', defense: 'defense', gardien: 'gardien', recuperation: 'recuperation' };
const OFF_ICON = { ecole: 'ecole', video: 'video', extra: 'extra', repos: 'repos', sortie: 'sortie' };
const ROLE_ABBR = { GK: 'G', CB: 'DC', FB: 'DL', DM: 'MD', CM: 'MC', AM: 'MO', W: 'AIL', ST: 'BU' };
// couleurs d'un club pour le décor (fond lisible + accent)
export function clubVars(c) {
  const cc = clubColors(c.id);
  const light = cc.text === '#111111';
  return `--club:${light ? cc.secondary : cc.primary};--club2:${light ? cc.primary : cc.secondary}`;
}
const INT_DESC = { 'légère': 'Progression réduite, peu de fatigue', normale: 'Équilibre progression / fatigue', intense: 'Progression forte, fatigue et risque de blessure' };

export const G = { st: null, slot: null, tab: 'classement', choices: { focus: 'technique', intensity: 'normale', offpitch: 'repos' }, filter: { q: '', level: 'all' }, pick: null, form: null, busy: false, showReview: null };

// pastille de variation : valeur en points (×100), couleur selon le sens
function chip(label, v, { unit = '', digits = 0, invert = false, title = '' } = {}) {
  const x = v * 100;
  const shown = Math.abs(x) < Math.pow(10, -digits) / 2 ? 0 : x;
  const cls = shown === 0 ? 'flat' : (shown > 0) !== invert ? 'up' : 'down';
  const sign = shown > 0 ? '+' : shown < 0 ? '−' : '±';
  return `<span class="chip ${cls}" title="${esc(title)}">${esc(label)} <b>${sign}${Math.abs(shown).toFixed(digits)}${unit}</b></span>`;
}
const fmtLvl = (v) => `${v >= 0 ? '+' : '−'}${Math.abs(v * 100).toFixed(1)}`;

export function show(html) {
  stopHomeScene();
  sound.stop(); // l'ambiance du stade s'arrête en quittant le match
  const el = root();
  el.hidden = false;
  el.innerHTML = html;
  el.scrollTop = 0;
  el.classList.remove('enter'); void el.offsetWidth; el.classList.add('enter');
  document.body.classList.add('in-screen');
  return el;
}
function hideScreen() { stopHomeScene(); root().hidden = true; document.body.classList.remove('in-screen'); }
export function persist() {
  if (!G.slot || !G.st) return true;
  const ok = saveCareer(G.slot, G.st);
  if (!ok && !G.saveWarned) { G.saveWarned = true; flash('Sauvegarde impossible (stockage plein ou indisponible).'); }
  return ok;
}

// ------------------------------------------------------------------ accueil
export function showHome() {
  G.st = null; G.slot = null; G.showReview = null;
  const nClubs = CATALOG.clubs.length;
  const saves = listSaves().filter((x) => !x.empty && !x.corrupt).sort((a, b) => b.savedAt - a.savedAt);
  const last = saves[0];
  const lc = last?.clubId ? clubById(last.clubId) : null;
  const ticket = last ? `<button class="ticket" id="h-continue" style="${lc ? clubVars(lc) : ''}">
      <span class="tk-band">${last.face != null ? `<span class="tk-face">${avatar({ face: last.face }, 54)}${lc ? `<span class="tk-mini">${crestSVG(lc, 22)}</span>` : ''}</span>` : lc ? crest(lc, 46) : icon('ball', 30)}</span>
      <span class="tk-body"><small>Reprendre la carrière</small><b>${esc(last.name)}</b><span>${esc(last.club)} · ${esc(last.stage)} · ${last.age} ans</span></span>
      <span class="tk-stub">${icon('play', 22)}<small>Continuer</small></span>
    </button>` : '';
  const el = show(`<div class="home">
    <div class="stadium" aria-hidden="true">
      <div class="sky"></div>
      <div class="stand"></div>
      <div class="tilt"><canvas id="home-pitch"></canvas></div>
      <div class="beam b1"></div><div class="beam b2"></div><div class="beam b3"></div><div class="beam b4"></div>
      <div class="haze"></div>
    </div>
    <div class="home-inner">
      <header class="brand">
        <p class="season">Saison 2026-2027</p>
        <h1 class="wordmark"><span>Generation</span><span>Football</span></h1>
        <p class="tagline">Tu n'es pas le centre du monde. Tu essaies d'y trouver ta place, puis d'y laisser une trace.</p>
      </header>
      <nav class="home-menu" aria-label="Menu principal">
        ${ticket}
        <button class="menu-btn ${last ? '' : 'primary'}" id="h-new">${icon('ball', 22)}<span><b>Débuter la partie</b><small>15 ans, un centre de formation, tout à prouver</small></span></button>
        <div class="menu-row">
          <button class="menu-btn" id="h-load">${icon('folder', 20)}<span><b>Charger la partie</b>${hasSaves() ? '' : '<small>ou importer un fichier</small>'}</span></button>
          <button class="menu-btn" id="h-quick">${icon('stadium', 20)}<span><b>Match amical</b></span></button>
        </div>
      </nav>
    </div>
    <p class="home-note">${nClubs} clubs réels, saison 2026-2027. Effectifs pros : noms publiés par les clubs, notes estimées par le jeu. Coéquipiers du centre de formation fictifs.</p>
  </div>`);
  el.querySelector('#h-continue')?.addEventListener('click', () => openSave(last.slot));
  el.querySelector('#h-new').addEventListener('click', showNewCareer);
  el.querySelector('#h-load').addEventListener('click', showLoad);
  el.querySelector('#h-quick').addEventListener('click', () => { hideScreen(); showQuickMatchSetup(); });
  startHomeScene(el.querySelector('#home-pitch'), last?.clubId ?? null);
}

function openSave(slot) {
  try { G.st = C.ensureState(loadCareer(slot)); G.slot = slot; G.showReview = null; renderHub(); } catch (e) { flash(e.message); }
}

// Confirmation dans le jeu : la WebView Android n'affiche pas les boîtes natives (confirm() y répond toujours « non »)
function askConfirm(text, okLabel = 'Confirmer') {
  return new Promise((resolve) => {
    const back = document.createElement('div');
    back.className = 'dialog-back';
    back.innerHTML = `<div class="dialog" role="alertdialog" aria-modal="true" aria-label="Confirmation"><p>${esc(text)}</p><div class="actions"><button id="dlg-no">Annuler</button><button class="primary" id="dlg-yes">${esc(okLabel)}</button></div></div>`;
    document.body.append(back);
    const onKey = (e) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); close(false); } };
    const close = (v) => { back.remove(); window.removeEventListener('keydown', onKey, true); resolve(v); };
    window.addEventListener('keydown', onKey, true);
    back.querySelector('#dlg-no').addEventListener('click', () => close(false));
    back.querySelector('#dlg-yes').addEventListener('click', () => close(true));
    back.addEventListener('click', (e) => { if (e.target === back) close(false); });
    back.querySelector('#dlg-yes').focus();
  });
}

function showLoad() {
  const saves = listSaves();
  const el = show(`<div class="panel-screen narrow">
    <header class="screen-head"><button class="icon-btn" id="l-back2" aria-label="Retour">${icon('back', 20)}</button><h1>Charger la partie</h1></header>
    <ul class="slots">${saves.map((s) => `<li style="${s.clubId ? clubVars(clubById(s.clubId)) : ''}">
      <span class="slot-crest">${s.face != null ? avatar({ face: s.face }, 46) : s.clubId ? crest(clubById(s.clubId), 40) : `<span class="slot-n">${s.slot}</span>`}</span>
      <strong>Emplacement ${s.slot}</strong>
      ${s.empty ? '<span class="muted">vide</span>' : s.corrupt ? '<span class="error">sauvegarde illisible</span>' : `<span>${esc(s.name)} · ${s.age} ans · ${esc(s.club)} (${esc(s.stage)}) · saison ${esc(s.season)}, semaine ${s.week} · niveau ${s.ca}<br><span class="muted">Sauvegardé le ${new Date(s.savedAt).toLocaleString('fr-FR')}</span></span>`}
      <span class="row">${s.empty ? '' : `${s.corrupt ? '' : `<button class="primary" data-load="${s.slot}">Charger</button><button data-exp="${s.slot}" title="Enregistrer un fichier de cette carrière (hors du téléphone)">Exporter</button>`}<button data-del="${s.slot}">Supprimer</button>`}</span>
    </li>`).join('')}</ul>
    <p class="muted small">Tes carrières vivent dans l'application : exporte-les en fichier pour les garder en cas de réinstallation ou de nouveau téléphone.</p>
    <div class="actions"><button id="l-back">Retour</button><button id="l-import">${icon('folder', 18)} Importer un fichier</button><input type="file" id="l-file" accept=".json,application/json" hidden></div>
  </div>`);
  el.querySelectorAll('[data-exp]').forEach((b) => b.addEventListener('click', () => {
    try {
      const { name, text } = exportCareer(Number(b.dataset.exp));
      if (window.GFAndroid?.saveFile) { window.gfExported = (ok) => flash(ok ? 'Sauvegarde exportée.' : 'Export annulé.'); window.GFAndroid.saveFile(name, text); return; }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      a.download = name; document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      flash('Sauvegarde exportée.');
    } catch (e) { flash(e.message); }
  }));
  const file = el.querySelector('#l-file');
  el.querySelector('#l-import').addEventListener('click', () => file.click());
  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    if (!f) return;
    try {
      const text = await f.text();
      let slot = firstFreeSlot();
      if (slot == null) {
        const old = listSaves().filter((x) => !x.empty).sort((a, b) => (a.savedAt ?? 0) - (b.savedAt ?? 0))[0];
        if (!(await askConfirm(`Tes emplacements sont pleins. Remplacer l'emplacement ${old.slot} (${old.name ?? 'partie'}, la plus ancienne) par la carrière importée ?`, 'Remplacer'))) return;
        slot = old.slot;
      }
      const sum = importCareer(text, slot);
      flash(`Carrière importée : ${sum.name} (emplacement ${slot}).`);
      showLoad();
    } catch (e) { flash(e.message); }
  });
  el.querySelectorAll('[data-load]').forEach((b) => b.addEventListener('click', () => {
    openSave(Number(b.dataset.load));
  }));
  el.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
    if (await askConfirm(`Supprimer définitivement la sauvegarde de l'emplacement ${b.dataset.del} ?`, 'Supprimer')) { deleteSave(Number(b.dataset.del)); hasSaves() ? showLoad() : showHome(); }
  }));
  el.querySelector('#l-back').addEventListener('click', showHome);
  el.querySelector('#l-back2').addEventListener('click', showHome);
}

// ------------------------------------------------------------------ création du joueur
const POS_SPOTS = [['GK', 7, 50], ['CB', 22, 50], ['FB', 27, 16], ['DM', 40, 50], ['CM', 53, 34], ['AM', 66, 52], ['W', 75, 16], ['ST', 87, 50]];
function showNewCareer() {
  const oldest = () => listSaves().filter((x) => !x.empty).sort((a, b) => (a.savedAt ?? 0) - (b.savedAt ?? 0))[0]?.slot ?? 1;
  const f = G.form ?? { firstName: '', lastName: '', role: 'CM', foot: 'droit', nation: 'france', slot: firstFreeSlot() ?? oldest() };
  f.faceSeed ??= Date.now();
  const sample = faceSample(f.faceSeed, 14);
  if (f.face == null || !sample.includes(f.face)) f.face = f.face ?? sample[0];
  const saves = listSaves();
  const el = show(`<div class="panel-screen narrow new-career">
    <header class="screen-head"><button class="icon-btn" id="n-back2" aria-label="Retour">${icon('back', 20)}</button><h1>Nouveau joueur</h1></header>
    <p class="lead">Tu as 15 ans. Ton potentiel sera tiré au hasard : personne ne le connaît, pas même toi.</p>
    <div class="nc-grid">
      <div class="nc-fields">
        <div class="face-pick"><span class="fp-label">Ton visage</span>
          <div class="face-row" role="radiogroup" aria-label="Choisir son visage">${(sample.includes(f.face) ? sample : [f.face, ...sample.slice(0, 13)]).map((i) => `<button type="button" class="face ${i === f.face ? 'on' : ''}" data-face="${i}" role="radio" aria-checked="${i === f.face}">${avatar({ face: i }, 52)}</button>`).join('')}</div>
          <button type="button" class="ghost small" id="n-faces">${icon('replay', 16)} Autres visages</button>
        </div>
        <label>Prénom<input type="text" id="n-first" maxlength="20" value="${esc(f.firstName)}" autocomplete="off"></label>
        <label>Nom<input type="text" id="n-last" maxlength="24" value="${esc(f.lastName)}" autocomplete="off"></label>
        <label>Nationalité<select id="n-nation">${C.NATIONALITIES.map(([id]) => { const n = C.nationality(id); return `<option value="${id}" ${(f.nation ?? 'france') === id ? 'selected' : ''}>${esc(n.name)}</option>`; }).join('')}</select></label>
        <label>Pied fort<select id="n-foot"><option ${f.foot === 'droit' ? 'selected' : ''}>droit</option><option ${f.foot === 'gauche' ? 'selected' : ''}>gauche</option></select></label>
        ${saves.every((s) => !s.empty) ? `<p class="slot-full">${icon('save', 16)}<span>Tes ${saves.length} emplacements sont pleins : choisis la partie que la nouvelle remplacera.</span></p>` : ''}
        <label>Emplacement de sauvegarde<select id="n-slot">${saves.map((s) => `<option value="${s.slot}" ${f.slot === s.slot ? 'selected' : ''}>${s.slot} — ${s.empty ? 'vide' : `remplacer ${esc(s.name ?? 'la sauvegarde')}`}</option>`).join('')}</select></label>
      </div>
      <div class="nc-pos">
        <label>Poste<select id="n-role">${Object.entries(C.ROLES).map(([k, v]) => `<option value="${k}" ${f.role === k ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label>
        <div class="pos-pick" role="group" aria-label="Choisir son poste sur le terrain">
          <svg class="mini-pitch" viewBox="0 0 160 100" preserveAspectRatio="none" aria-hidden="true">
            <rect x="1" y="1" width="158" height="98" rx="2"/><path d="M80 1v98M1 30h24v40H1M159 30h-24v40h24M1 42h8v16H1M159 42h-8v16h8"/><circle cx="80" cy="50" r="12"/>
          </svg>
          ${POS_SPOTS.map(([k, x, y]) => `<button type="button" class="pos ${f.role === k ? 'on' : ''}" data-pos="${k}" style="left:${x}%;top:${y}%" title="${esc(C.ROLES[k])}">${ROLE_ABBR[k]}</button>`).join('')}
        </div>
      </div>
    </div>
    <div id="n-err" class="error"></div>
    <div class="actions"><button id="n-back">Retour</button><button class="primary" id="n-next">Choisir le club ${icon('next', 18)}</button></div>
  </div>`);
  const readForm = () => ({ ...f, firstName: el.querySelector('#n-first').value, lastName: el.querySelector('#n-last').value, role: el.querySelector('#n-role').value, foot: el.querySelector('#n-foot').value, nation: el.querySelector('#n-nation').value, slot: Number(el.querySelector('#n-slot').value) });
  el.querySelectorAll('.face').forEach((b) => b.addEventListener('click', () => {
    f.face = Number(b.dataset.face);
    el.querySelectorAll('.face').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', String(x === b)); });
  }));
  el.querySelector('#n-faces').addEventListener('click', () => { G.form = { ...readForm(), faceSeed: Date.now(), face: null }; showNewCareer(); });
  const roleSel = el.querySelector('#n-role');
  const syncPos = () => el.querySelectorAll('.pos').forEach((b) => b.classList.toggle('on', b.dataset.pos === roleSel.value));
  el.querySelectorAll('.pos').forEach((b) => b.addEventListener('click', () => { roleSel.value = b.dataset.pos; syncPos(); }));
  roleSel.addEventListener('change', syncPos);
  const back = () => { G.form = null; showHome(); };
  el.querySelector('#n-back').addEventListener('click', back);
  el.querySelector('#n-back2').addEventListener('click', back);
  el.querySelector('#n-next').addEventListener('click', async () => {
    const form = { ...readForm(), firstName: el.querySelector('#n-first').value.trim(), lastName: el.querySelector('#n-last').value.trim() };
    if (!form.firstName || !form.lastName) { el.querySelector('#n-err').textContent = 'Indique un prénom et un nom.'; return; }
    const prev = saves.find((s) => s.slot === form.slot);
    if (!prev.empty && !(await askConfirm(`L'emplacement ${form.slot} contient la partie de ${prev.name ?? 'quelqu\'un'}. La remplacer par ta nouvelle carrière ?`, 'Remplacer'))) return;
    G.form = form;
    showClubPicker();
  });
}

// ------------------------------------------------------------------ choix du club
// divisions proposées au filtre : niveaux français, ou championnats du pays choisi
const levelOptions = (country) => (country === 'France'
  ? [1, 2, 3, 4, 5, 6].map((l) => [String(l), LEVEL_NAMES[l]])
  : FOREIGN_LEAGUES.filter((l) => l.country === country).map((l) => [String(l.tier), l.name]));
const divisionOf = (c) => (c.foreign ? c.senior.competition : LEVEL_NAMES[clubLevel(c)]);
function clubRows() {
  const q = G.filter.q.trim().toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
  return academiesOf(G.filter.country ?? 'France').filter((c) => {
    if (G.filter.level !== 'all' && String(clubLevel(c)) !== G.filter.level) return false;
    if (!q) return true;
    return c.name.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').includes(q);
  }).sort((a, b) => academyQuality(b) - academyQuality(a) || a.name.localeCompare(b.name, 'fr'));
}

function showClubPicker() {
  G.filter.country ??= 'France';
  const country = G.filter.country;
  const el = show(`<div class="panel-screen picker">
    <div class="picker-head">
      <header class="screen-head"><button class="icon-btn" id="c-back2" aria-label="Retour">${icon('back', 20)}</button><h1>Où commence ta formation ?</h1></header>
      <div class="row">
        <select id="c-country" aria-label="Pays">${ACADEMY_COUNTRIES.map((k) => `<option value="${esc(k)}" ${k === country ? 'selected' : ''}>${countryInfo(k).flag ?? '🇫🇷'} ${esc(k)}</option>`).join('')}</select>
        <input type="text" id="c-q" placeholder="Rechercher un club…" value="${esc(G.filter.q)}">
        <select id="c-level"><option value="all">Toutes les divisions</option>${levelOptions(country).map(([v, label]) => `<option value="${v}" ${G.filter.level === v ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select>
      </div>
    </div>
    <div class="picker-body">
      <ul class="clubs" id="c-list"></ul>
      <aside class="club-detail" id="c-detail"><p class="muted">Choisis un club pour voir son centre de formation.</p></aside>
    </div>
    <div class="actions"><button id="c-back">Retour</button></div>
  </div>`);
  const list = el.querySelector('#c-list');
  const renderList = () => {
    const rows = clubRows();
    list.innerHTML = rows.map((c) => `<li data-id="${c.id}" class="${G.pick === c.id ? 'sel' : ''}" style="${clubVars(c)}">
      <span class="cr">${crestSVG(c, 26)}</span><span class="cn">${esc(c.name)}</span>
      <span class="cd">${esc(divisionOf(c))}</span>
      <span class="cs" title="Centre de formation">${stars(academyStars(c))}</span>
    </li>`).join('') || '<li class="muted">Aucun club.</li>';
    list.querySelectorAll('li[data-id]').forEach((li) => li.addEventListener('click', () => { G.pick = li.dataset.id; renderList(); renderDetail(); }));
  };
  const renderDetail = () => {
    const c = clubById(G.pick);
    const box = el.querySelector('#c-detail');
    if (!c) return;
    const q = academyQuality(c);
    const lg17 = leagueFor(c, 'U17'), lg19 = leagueFor(c, 'U19');
    const start = Math.round((youthCA(q, 'U17') - 0.03) * 100);
    box.setAttribute('style', clubVars(c));
    box.innerHTML = `<div class="club-hero"><span class="kit-stripes" aria-hidden="true"></span>${crestSVG(c, 84)}<h2>${esc(c.name)}</h2></div>
      <p>${c.foreign ? esc(divisionName(c)) : c.senior ? `${esc(c.senior.competition.split(', ').pop())}${c.senior.group !== 'Unique' ? ` (groupe ${esc(c.senior.group)})` : ''}` : esc(LEVEL_NAMES[clubLevel(c)])}${c.reserve ? ` · réserve en ${esc(c.reserve.competition.split(', ').pop())}` : ''}</p>
      <div class="cd-facts"><div><span>Centre de formation</span><b class="stars">${stars(academyStars(c))}</b></div><div><span>Niveau de départ</span><b class="num">${start - 5}–${start + 9}</b><small class="muted">selon la roue</small></div></div>
      <p class="small">U17 : ${esc(lg17.name)}<br>U19 : ${esc(lg19.name)}</p>
      <p>Un centre réputé t'entoure de meilleurs joueurs et de meilleurs formateurs, mais la concurrence y est plus rude.</p>
      <p><strong>Ton niveau et ton potentiel</strong> : deux roues décident, juste après. Le niveau se situe par rapport aux jeunes du club ; le potentiel ne dépend pas du club et évoluera selon tes choix.</p>
      ${c.foreign ? `<p>Formation à l'étranger : ta famille te suit, l'école se fait en ${esc(countryInfo(c.country).lang)}. Pas d'équipe réserve : à 18 ans, premier contrat au club ou prêt dans un club du pays. Les sélections de ton pays te suivent toujours.</p>` : ''}
      <p class="muted">${c.senior?.players?.length >= 11 ? `Effectif professionnel : noms publiés${c.foreign ? ' (Wikipédia)' : ' par le club'}, notes estimées par le jeu. Tes coéquipiers en formation sont fictifs.` : 'Effectif professionnel : non établi dans la collecte, joueurs générés.'}</p>
      <button class="primary" id="c-go">Commencer au centre de formation ${icon('next', 18)}</button>`;
    box.querySelector('#c-go').addEventListener('click', () => showWheel(c));
  };
  el.querySelector('#c-q').addEventListener('input', (e) => { G.filter.q = e.target.value; renderList(); });
  el.querySelector('#c-level').addEventListener('change', (e) => { G.filter.level = e.target.value; renderList(); });
  el.querySelector('#c-country').addEventListener('change', (e) => { G.filter.country = e.target.value; G.filter.level = 'all'; G.pick = null; showClubPicker(); });
  el.querySelector('#c-back').addEventListener('click', showNewCareer);
  el.querySelector('#c-back2').addEventListener('click', showNewCareer);
  renderList();
  if (G.pick) renderDetail();
}

// ------------------------------------------------------------------ roues du niveau et du potentiel
// Deux tours, sans relance : le niveau de départ (par rapport aux jeunes du centre choisi), puis le
// potentiel. Le sort fixe les paliers ; les choix de la carrière feront le reste.
const tierStars = (t) => stars(C.toStars((t.lo + t.hi) / 2));
const WHEEL_STEPS = ['level', 'potential'];
// texte des paliers : étoiles pour le potentiel, niveaux chiffrés (selon le club) pour le niveau
function tierRange(w, t, club) {
  if (w.id === 'potential') return `<span class="stars">${tierStars(t)}</span>`;
  const base = youthCA(academyQuality(club), 'U17') - 0.03;
  return `<span class="w-num">${C.pct(base + t.lo)}–${C.pct(base + t.hi)}</span>`;
}

function wheelSVG(face, w) {
  const sl = slicesOf(w);
  const R = 90;
  const pt = (a, r) => { const t = ((a - 90) * Math.PI) / 180; return `${(r * Math.cos(t)).toFixed(2)} ${(r * Math.sin(t)).toFixed(2)}`; };
  const parts = sl.map((s, i) => {
    const mid = (s.start + s.end) / 2, span = s.end - s.start;
    return `<g class="ws" data-tier="${s.id}" data-i="${i}">
      <path d="M0 0L${pt(s.start, R)}A${R} ${R} 0 ${span > 180 ? 1 : 0} 1 ${pt(s.end, R)}Z" fill="${s.tier.color}"/>
      <path d="M0 0L${pt(s.start, R)}A${R} ${R} 0 ${span > 180 ? 1 : 0} 1 ${pt(s.end, R)}Z" fill="url(#w-shade)"/>
      <text transform="rotate(${(mid - 90).toFixed(2)}) translate(84 0)" text-anchor="end" dominant-baseline="central" font-size="${span < 14 ? 6.2 : span < 24 ? 7 : 7.8}">${esc(w.short[s.id].toUpperCase())}</text>
    </g>`;
  }).join('');
  const seps = sl.map((s) => `<line x1="0" y1="0" x2="${pt(s.start, R).replace(' ', '" y2="')}"/>`).join('');
  const lights = Array.from({ length: 28 }, (_, i) => { const [x, y] = pt((i * 360) / 28, 96.5).split(' '); return `<circle cx="${x}" cy="${y}" r="2.1" class="wl ${i % 2 ? 'odd' : ''}"/>`; }).join('');
  const hub = face
    ? `<clipPath id="w-hubclip"><circle r="17"/></clipPath><image href="${face}" x="-17" y="-19" width="34" height="38" clip-path="url(#w-hubclip)" preserveAspectRatio="xMidYMin slice"/>`
    : `<text class="w-hubstar" text-anchor="middle" dominant-baseline="central">★</text>`;
  return `<svg class="wheel" viewBox="-110 -114 220 224" role="img" aria-label="${w.id === 'level' ? 'Roue du niveau de départ' : 'Roue du potentiel'}">
    <defs>
      <radialGradient id="w-shade" cx="0" cy="0" r="90" gradientUnits="userSpaceOnUse"><stop offset="0.2" stop-color="#000" stop-opacity="0.35"/><stop offset="0.75" stop-color="#fff" stop-opacity="0.05"/><stop offset="1" stop-color="#000" stop-opacity="0.25"/></radialGradient>
      <linearGradient id="w-gold" x1="0" y1="-1" x2="0" y2="1"><stop offset="0" stop-color="#fff2bf"/><stop offset="0.5" stop-color="#e2b23c"/><stop offset="1" stop-color="#8a5f12"/></linearGradient>
      <radialGradient id="w-hub" cx="0.35" cy="0.3" r="0.9"><stop offset="0" stop-color="#2a3a60"/><stop offset="1" stop-color="#070c18"/></radialGradient>
    </defs>
    <circle r="104" class="w-glow"/>
    <g class="wheel-rot" id="wheel-rot">${parts}<g class="w-seps">${seps}</g></g>
    <circle r="96.5" class="w-rim"/>${lights}
    <circle r="21" fill="url(#w-hub)" stroke="url(#w-gold)" stroke-width="3"/>${hub}
    <g class="wheel-ptr" id="wheel-ptr"><path d="M0 -84L-9.5 -104Q0 -110 9.5 -104Z" fill="url(#w-gold)" stroke="#5a3d08" stroke-width="1"/><circle cy="-102" r="2.4" fill="#fff6d6"/></g>
  </svg>`;
}

function showWheel(club, step = 0) {
  const f = G.form;
  const w = WHEELS[WHEEL_STEPS[step]];
  const isLevel = w.id === 'level';
  const el = show(`<div class="panel-screen wheel-screen" style="${clubVars(club)}">
    <header class="screen-head"><button class="icon-btn" id="w-back" aria-label="Retour">${icon('back', 20)}</button><h1>${isLevel ? 'La roue du niveau' : 'La roue du potentiel'} <small class="w-step">${step + 1}/${WHEEL_STEPS.length}</small></h1></header>
    <div class="wheel-body">
      <div class="wheel-stage" id="wheel-stage">${wheelSVG(faceUrl(f.face), w)}</div>
      <aside class="wheel-side" id="wheel-side">
        <p class="w-eyebrow">${crest(club, 22)}<span>${esc(f.firstName)} ${esc(f.lastName)} · ${esc(club.name)}</span></p>
        <h2>${isLevel ? 'Quel joueur arrive au centre ?' : 'Jusqu\'où iras-tu ?'}</h2>
        <p class="w-lead">${isLevel
          ? `La roue fixe ton niveau de départ face aux autres jeunes de ${esc(club.name)}. Plus il est haut, plus vite tu joues… mais c'est le potentiel qui dira jusqu'où tu montes.`
          : 'La roue fixe ton potentiel de départ. Une part plus grande, c\'est un palier plus fréquent : le Phénomène ne sort qu\'une fois sur trente-trois. Ensuite, ce sont tes choix qui le feront monter… ou baisser.'}</p>
        <ul class="w-odds">${w.tiers.map((t) => `<li style="--tier:${t.color}"><i></i><span>${esc(t.label)}</span>${tierRange(w, t, club)}<b>${Math.round(t.p * 100)} %</b></li>`).join('')}</ul>
        <button class="primary w-spin" id="wheel-spin">${icon('next', 18)} Tourner la roue</button>
      </aside>
    </div>
  </div>`);
  el.querySelector('#w-back').addEventListener('click', showClubPicker);
  if (step > 0) el.querySelector('#w-back').disabled = true; // pas de retour après un premier tirage
  el.querySelector('#wheel-spin').addEventListener('click', () => {
    const tier = drawFrom(w, Math.random());
    el.querySelector('#w-back').disabled = true;
    el.querySelector('#wheel-spin').disabled = true;
    el.querySelector('#wheel-spin').textContent = 'La roue tourne…';
    spinWheel(el, w, tier, () => wheelVerdict(el, club, step, tier));
  });
}

function spinWheel(el, w, tier, done) {
  const sl = slicesOf(w);
  const own = sl.filter((s) => s.id === tier.id);
  const s = own[Math.floor(Math.random() * own.length)];
  const target = s.start + (s.end - s.start) * (0.22 + Math.random() * 0.56); // jamais pile sur une frontière
  const total = 6 * 360 + (360 - target); // la part visée finit sous le pointeur
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const dur = reduce ? 1200 : 5800;
  const rot = el.querySelector('#wheel-rot'), ptr = el.querySelector('#wheel-ptr'), svg = el.querySelector('.wheel');
  const under = (a) => { const x = (((360 - (a % 360)) % 360) + 360) % 360; return sl.findIndex((q) => x >= q.start && x < q.end); };
  const ease = (x) => 1 - Math.pow(1 - x, 4);
  let last = under(0), t0 = null;
  svg.classList.add('spinning');
  const frame = (now) => {
    t0 ??= now;
    const x = Math.min(1, (now - t0) / dur);
    const a = total * ease(x);
    rot.setAttribute('transform', `rotate(${a.toFixed(2)})`);
    const i = under(a);
    if (i !== last) {
      last = i;
      const speed = Math.pow(1 - x, 3);
      sound.tick(speed);
      ptr.animate?.([{ transform: `rotate(${-10 - 18 * (1 - speed)}deg)` }, { transform: 'rotate(0deg)' }], { duration: 90 + 160 * (1 - speed), easing: 'ease-out' });
    }
    if (x < 1) requestAnimationFrame(frame);
    else { svg.classList.remove('spinning'); setTimeout(done, 380); }
  };
  requestAnimationFrame(frame);
}

function wheelVerdict(el, club, step, tier) {
  const w = WHEELS[WHEEL_STEPS[step]];
  const level = w.tiers.indexOf(tier);
  const svg = el.querySelector('.wheel');
  svg.classList.add('decided');
  svg.querySelectorAll('.ws').forEach((g) => g.classList.toggle('won', g.dataset.tier === tier.id));
  sound.fanfare(level);
  const stage = el.querySelector('#wheel-stage');
  stage.style.setProperty('--tier', tier.color);
  stage.classList.add(level >= 4 ? 'jackpot' : 'landed');
  if (level >= 3) confetti(stage, level >= 5 ? 90 : level >= 4 ? 60 : 30, tier.color);
  G.form[w.id] = tier.id;
  const last = step === WHEEL_STEPS.length - 1;
  const base = youthCA(academyQuality(club), 'U17') - 0.03;
  const detail = w.id === 'level'
    ? `Niveau de départ entre ${C.pct(base + tier.lo)} et ${C.pct(base + tier.hi)} (le benjamin moyen de ${esc(club.name)} est à ${C.pct(base)}).`
    : 'Potentiel de départ entre ' + C.pct(tier.lo) + ' et ' + C.pct(tier.hi) + '. Le staff ne le connaît pas encore précisément ; il bougera selon ton travail, ta discipline et ton temps de jeu.';
  const side = el.querySelector('#wheel-side');
  side.innerHTML = `<p class="w-eyebrow">${crest(club, 22)}<span>La roue a parlé</span></p>
    <h2 class="w-verdict" style="--tier:${tier.color}">${esc(tier.label)}</h2>
    ${w.id === 'potential' ? `<p class="stars w-stars">${tierStars(tier)}</p>` : ''}
    <p class="w-blurb">${esc(tier.blurb)}</p>
    <p class="muted small">${detail}</p>
    ${last ? `<button class="primary" id="wheel-go">Commencer au centre de formation ${icon('next', 18)}</button>`
      : `<button class="primary" id="wheel-next">Roue suivante : le potentiel ${icon('next', 18)}</button>`}`;
  side.classList.remove('enter-side'); void side.offsetWidth; side.classList.add('enter-side');
  if (!last) { side.querySelector('#wheel-next').addEventListener('click', () => showWheel(club, step + 1)); return; }
  side.querySelector('#wheel-go').addEventListener('click', () => {
    const fm = G.form;
    G.st = C.createCareer({ firstName: fm.firstName, lastName: fm.lastName, role: fm.role, foot: fm.foot, nation: fm.nation ?? 'france', clubId: club.id, face: fm.face ?? null, potential: fm.potential, level: fm.level });
    G.slot = fm.slot; G.form = null; G.pick = null;
    persist();
    renderHub();
  });
}

function confetti(stage, n, color) {
  const box = document.createElement('div');
  box.className = 'w-confetti';
  const cols = [color, '#ffd65a', '#ffffff', '#4ee08a', '#ff8a5c'];
  box.innerHTML = Array.from({ length: n }, (_, i) => {
    const dx = (Math.random() - 0.5) * 140, rot = Math.round(Math.random() * 720 - 360), delay = Math.random() * 0.25, dur = 1.4 + Math.random() * 1.2;
    return `<i style="--dx:${dx.toFixed(1)}vmin;--rot:${rot}deg;--c:${cols[i % cols.length]};animation-delay:${delay.toFixed(2)}s;animation-duration:${dur.toFixed(2)}s;left:${(50 + (Math.random() - 0.5) * 20).toFixed(1)}%"></i>`;
  }).join('');
  stage.appendChild(box);
  setTimeout(() => box.remove(), 3200);
}

// ------------------------------------------------------------------ tableau de bord
function gauge(label, v, hint = '') {
  const cls = v > 0.66 ? 'good' : v > 0.4 ? 'mid' : 'low';
  return `<div class="gauge" title="${esc(hint)}"><span>${esc(label)}</span><span class="bar"><i class="${cls}" style="width:${Math.round(v * 100)}%"></i></span><span class="gv">${Math.round(v * 100)}</span></div>`;
}

// Silhouette « photo à venir » des albums de vignettes, maillot aux couleurs du club
function silhouette(num) {
  return `<svg class="pc-sil" viewBox="0 0 120 112" aria-hidden="true">
    <path d="M14 112c2-24 16-36 46-36s44 12 46 36z" fill="var(--club)"/>
    <path d="M14 112c2-24 16-36 46-36s44 12 46 36z" fill="url(#pcsh)"/>
    <path d="M47 77l13 14 13-14" fill="none" stroke="var(--club2)" stroke-width="4" stroke-linejoin="round"/>
    <path d="M51 62h18v16c-3 3-15 3-18 0z" fill="rgba(4,8,18,0.82)"/>
    <ellipse cx="60" cy="42" rx="19" ry="23" fill="rgba(4,8,18,0.85)"/>
    <text x="60" y="106" text-anchor="middle" class="pc-num">${num}</text>
    <defs><linearGradient id="pcsh" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".28"/><stop offset=".5" stop-color="#fff" stop-opacity=".08"/><stop offset="1" stop-color="#000" stop-opacity=".32"/></linearGradient></defs>
  </svg>`;
}

function profileCard(st) {
  const p = st.player;
  const ca = C.currentCA(st);
  const est = C.potentialEstimate(st);
  const youth = st.stage === 'U17' || st.stage === 'U19';
  const club = clubById(st.clubId);
  const w = Object.keys(p.attrs).filter((k) => k !== 'gk' || p.role === 'GK').sort((a, b) => p.attrs[b] - p.attrs[a]);
  const season = ca - st.seasonStats.caStart;
  return `<section class="card profile">
    <div class="pc-row">
      <figure class="sticker" aria-label="Vignette de ${esc(p.firstName)} ${esc(p.lastName)}">
        <div class="st-photo ${faceUrl(p.face) ? 'has-face' : ''}"><span class="st-crest">${crest(club, 28)}</span><span class="st-role">${ROLE_ABBR[p.role]}</span>${faceUrl(p.face) ? `<img class="st-face" src="${faceUrl(p.face)}" alt=""><span class="st-num">${p.number ?? 27}</span>` : silhouette(p.number ?? 27)}</div>
        <figcaption><b>${esc(p.firstName)} ${esc(p.lastName)}</b><span>${p.age} ans · pied ${esc(p.foot)}</span></figcaption>
      </figure>
      <div class="pc-stats">
        <h2 class="sr-only">${esc(p.firstName)} ${esc(p.lastName)}</h2>
        <div class="lvl"><span class="label">Niveau actuel${p.levelTier && st.season === 2026 ? ` <span class="tier-chip" style="--tier:${LEVEL_COLORS[p.levelTier.id] ?? 'var(--flood)'}" title="Palier tiré à la roue en arrivant au centre">${esc(p.levelTier.label)}</span>` : ''}</span><span class="value">${C.pct(ca)}</span><span class="delta ${season >= 0 ? 'up' : 'down'}">${fmtLvl(season)} cette saison</span></div>
        <div class="pot"><span class="label">Potentiel estimé par le staff${p.potentialTier ? ` <span class="tier-chip" style="--tier:${tierById(p.potentialTier.id)?.color ?? 'var(--flood)'}" title="Palier tiré à la roue en arrivant au centre">${esc(p.potentialTier.label)}</span>` : ''}</span><span class="stars">${stars(C.toStars(est.center))}</span><span class="muted">entre ${C.pct(est.lo)} et ${C.pct(est.hi)}</span></div>
        <p class="role-line">${esc(C.ROLES[p.role])}${p.roleChange?.season === st.season && st.week < p.roleChange.until ? ' <span class="muted">(en adaptation)</span>' : ''} ${st.phase === 'week' && p.roleChange?.season !== st.season ? '<button class="ghost small" id="hub-role">Changer de poste</button>' : ''}</p>
        ${p.traits?.length ? `<p class="traits">${p.traits.map((id) => { const t = C.traitById(id); return t ? `<span class="trait" title="${esc(t.desc)}">${icon(t.icon, 14)}${esc(t.label)}</span>` : ''; }).join('')}</p>` : ''}
        ${p.contract ? `<p class="contract-line">${icon('save', 14)}<span>${p.loan ? `Prêté par ${esc(clubById(p.loan.parentId).name)} · ` : ''}${esc(C.CONTRACT_LABEL[p.contract.type] ?? 'Contrat')} · <b>${C.money(p.contract.salary)}</b>/mois · fin juin ${p.contract.until + 1}${p.contract.goalBonus ? `<br>Primes : ${C.money(p.contract.goalBonus)} par but, ${C.money(p.contract.winBonus)} par victoire · clause ${C.money(p.contract.clause)}` : ''}<br>Économies : <b>${C.money(p.money)}</b>${p.agent ? ' · agent' : ''}</span></p>` : ''}
        ${st.stage === 'Pro' && !p.loan && st.phase === 'week' ? (p.transferRequest === st.season ? '<p class="muted small">Demande de transfert déposée : offres au mercato et en fin de saison.</p>' : '<button class="ghost small" id="hub-transfer">Demander un transfert</button>') : ''}
      </div>
    </div>
    ${p.injuryWeeks ? `<p class="error">${icon('injury', 16)} Blessé : encore ${p.injuryWeeks} semaine(s).</p>` : ''}
    <div class="gauges">${gauge('Moral', p.morale, 'Influence ta progression et tes performances')}${gauge('Fraîcheur', p.fresh, 'Basse : progression ralentie et risque de blessure')}${gauge('Discipline', p.discipline, 'Basse : le coach perd confiance')}${youth ? gauge('Scolarité', p.school, 'Le centre de formation y est attentif') : ''}</div>
    <h3 class="rel-h">${icon('squad', 16)} Relations</h3>
    <div class="gauges">${gauge('Coach', p.trust, 'Pèse sur ta place dans le onze')}${gauge('Vestiaire', p.team ?? 0.5, 'Ton état d\'esprit vu par tes coéquipiers : jeu collectif, passes décisives, attitude')}${gauge('Supporters', p.fans ?? 0.15, 'Buts, prestations, fidélité : ta cote auprès du public')}</div>
    <details><summary>Attributs détaillés</summary><ul class="attrs">${w.map((k) => `<li><span>${esc(ATTR_LABELS[k])}</span><span class="bar"><i style="width:${Math.round(p.attrs[k] * 100)}%"></i></span><span class="num">${C.pct(p.attrs[k])}</span></li>`).join('')}</ul></details>
    ${st.lastMonthReview ? `<button id="hub-review" class="wide ghost">${icon('chart', 18)} Revoir le dernier bilan mensuel</button>` : ''}
  </section>`;
}

// pastille seulement si la variation est visible (pas de « ±0 »)
function chipNZ(label, v, opts = {}) {
  const digits = opts.digits ?? 0;
  return Math.abs(v * 100) < Math.pow(10, -digits) / 2 ? '' : chip(label, v, opts);
}
// Compte rendu de la semaine : replié sur téléphone en paysage (une ligne), déplié sinon
function reportBlock(rep) {
  if (!rep || !rep.lines.length) return '';
  const d = rep.delta;
  const chips = d ? `<div class="chips">${chipNZ('Niveau', d.ca, { digits: 1 })}${chipNZ('Fraîcheur', d.fresh)}${chipNZ('Moral', d.morale)}${chipNZ('Confiance', d.trust)}${chipNZ('Discipline', d.discipline)}${chipNZ('Scolarité', d.school)}${chipNZ('Vestiaire', d.team ?? 0)}${chipNZ('Supporters', d.fans ?? 0)}</div>` : '';
  const m = rep.match;
  const mInner = m ? `${chipNZ('Niveau', m.ca, { digits: 1 })}${chipNZ('Fraîcheur', m.fresh)}${chipNZ('Moral', m.morale)}${chipNZ('Confiance', m.trust)}${chipNZ('Vestiaire', m.team ?? 0)}${chipNZ('Supporters', m.fans ?? 0)}` : '';
  const mchips = mInner ? `<div class="chips"><span class="muted">Effet du match :</span>${mInner}</div>` : '';
  const compact = window.matchMedia?.('(max-height: 520px)').matches;
  const lvl = d ? d.ca + (m?.ca ?? 0) : m?.ca ?? 0;
  return `<details class="report" ${compact ? '' : 'open'}><summary><strong>Semaine ${rep.week != null ? rep.week + 1 : ''} : ce qui s'est passé</strong>${Math.abs(lvl) >= 0.0005 ? `<span class="rep-lvl ${lvl >= 0 ? 'up' : 'down'}">niveau ${fmtLvl(lvl)}</span>` : ''}<span class="rep-more muted">détails</span></summary><ul>${rep.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>${chips}${mchips}</details>`;
}

// Aperçu des effets attendus du programme choisi (sans aléa)
function previewBlock(st) {
  const pv = C.previewWeek(st, G.choices);
  const top = pv.attrs.filter((a) => a.d > 0).slice(0, 4);
  const pa = pv.pa * 100;
  const paTxt = Math.abs(pa) < 0.005 ? 'stable' : `${pa > 0 ? '▲' : '▼'} ${pa > 0 ? '+' : '−'}${Math.abs(pa).toFixed(2)}`;
  return `<div class="preview">
    <strong>Effets attendus cette semaine</strong>
    <div class="chips">
      ${chip('Niveau', pv.ca, { digits: 1, title: 'Progression attendue de ta note de poste' })}
      ${chip('Fraîcheur', pv.gauges.fresh, { title: 'Récupération naturelle comprise' })}
      ${chip('Moral', pv.gauges.morale)}${chip('Confiance', pv.gauges.trust)}
      ${Math.abs(pv.gauges.discipline) > 0.004 ? chip('Discipline', pv.gauges.discipline) : ''}${Math.abs(pv.gauges.school) > 0.004 ? chip('Scolarité', pv.gauges.school) : ''}
      <span class="chip ${pa > 0.005 ? 'up' : pa < -0.005 ? 'down' : 'flat'}" title="Effet attendu sur ton potentiel (points)">Potentiel <b>${paTxt}</b></span>
      <span class="chip ${pv.injuryRisk > 0.03 ? 'down' : pv.injuryRisk > 0.015 ? 'warn' : 'flat'}" title="Probabilité de blessure à l'entraînement cette semaine">Risque blessure <b>${(pv.injuryRisk * 100).toFixed(1)} %</b></span>
    </div>
    ${top.length ? `<p class="muted">Attributs travaillés : ${top.map((a) => `${esc(ATTR_LABELS[a.k])} +${(a.d * 100).toFixed(1)}`).join(' · ')}</p>` : ''}
    ${pv.parts.length ? `<p class="muted">${pv.parts.map((x) => `${esc(x.label)} : niveau ${fmtLvl(x.ca)}`).join(' · ')}</p>` : ''}
    ${pv.warnings.map((w) => `<p class="error">${esc(w)}</p>`).join('')}
    ${st.player.fresh + pv.choiceFresh < 0.3 ? '<p class="error">Tu finirais la semaine épuisé : progression ralentie, blessure plus probable.</p>' : ''}
  </div>`;
}

function rivalLine(st, rival) {
  const cc = clubColors(st.clubId);
  return `<p class="rival">${avatar({ face: rival.real ? null : faceIndexFor(`${st.clubId}:${rival.name}`, st.stage === 'U17' || st.stage === 'U19'), name: rival.name, color: cc.primary, text: cc.text }, 30)}<span>${rival.signing ? 'Renfort recruté à ton poste' : 'Concurrent direct au poste'} : <b>${esc(rival.name)}</b> · niveau ${C.pct(rival.ca)}</span></p>`;
}

function weekCard(st) {
  const p = st.player;
  const n = C.seasonLength(st);
  const fx = C.fixtureOfWeek(st);
  const report = reportBlock(st.lastReport);
  const myName = st.league.teams.find((t) => t.id === st.clubId).name;
  if (st.phase === 'event') {
    return `<section class="card week">${report}<h2>${icon('chat', 20)} Un choix à faire</h2><p class="event-text">${esc(st.pendingEvent.text)}</p>
      <div class="options">${st.pendingEvent.options.map((o, i) => `<button class="opt" data-ev="${i}">${esc(o)}</button>`).join('')}</div>
      <p class="muted">Chaque réponse a des conséquences durables (confiance, potentiel, moral…).</p></section>`;
  }
  if (st.phase === 'matchday') {
    const md = st.matchday;
    if (md.bye) return `<section class="card week">${report}<h2>Semaine ${st.week + 1}/${n}</h2><p>Pas de match cette semaine.</p><button class="primary cta" id="w-bye">Continuer</button></section>`;
    const ex = md.extra;
    const opp = ex ? C.extraTeamName(st, md.opponentId) : st.league.teams.find((t) => t.id === md.opponentId)?.name;
    const myId = ex?.kind === 'nat' ? ex.teamId : st.clubId;
    const meName = ex ? C.extraTeamName(st, myId) : myName;
    const inSquad = md.selection === 'titulaire' || md.selection === 'remplaçant';
    const selTxt = { titulaire: 'Le coach t\'aligne d\'entrée.', remplaçant: 'Tu commences sur le banc : le coach peut te faire entrer.', 'non retenu': 'Tu n\'es pas retenu dans le groupe cette semaine.', 'blessé': 'Tu es blessé et ne peux pas jouer.' }[md.selection];
    const canPlay = inSquad && p.role !== 'GK';
    return `<section class="card week">${report}
      <h2>${icon(ex ? (ex.kind === 'nat' ? 'star' : 'trophy') : 'whistle', 20)} ${ex ? esc(ex.label) : `Jour de match · journée ${st.week + 1}/${n}`}</h2>
      ${ex ? `<p class="comp-tag ${ex.kind}">${ex.kind === 'nat' ? 'Sélection nationale · effectifs fictifs' : 'Match de coupe à élimination directe'}</p>` : ''}
      <div class="fixture-box ${ex ? 'extra' : ''}">
        <span class="fx ${md.home ? 'me' : ''}">${crest(clubById(md.home ? myId : md.opponentId), 54)}<b>${esc(md.home ? meName : opp)}</b></span>
        <span class="vs">${md.home ? 'Domicile' : 'Extérieur'}</span>
        <span class="fx ${md.home ? '' : 'me'}">${crest(clubById(md.home ? md.opponentId : myId), 54)}<b>${esc(md.home ? opp : meName)}</b></span>
      </div>
      <p><span class="sel sel-${md.selection.replace(/\s/g, '-')}">${esc(md.selection)}</span> ${esc(selTxt)}${md.reason && C.SELECTION_REASON[md.reason] ? ` <span class="muted">${esc(C.SELECTION_REASON[md.reason])}</span>` : ''}</p>${md.rival && md.selection !== 'titulaire' && md.selection !== 'blessé' ? rivalLine(st, md.rival) : ''}
      <div class="options">
        ${inSquad ? `<button class="primary cta" id="w-watch">${icon('play', 20)}<span>${canPlay ? 'Jouer le match' : 'Suivre le match'}<small>${canPlay ? 'Tu fais les choix de ton joueur aux moments clés' : 'Le gardien est piloté par l\'IA'}</small></span></button><button id="w-sim">${icon('skip', 18)} Simuler le match</button>`
          : `<button class="primary cta" id="w-sim">${icon('skip', 20)}<span>Voir le résultat</span></button><button id="w-watch">${icon('stadium', 18)} Regarder depuis la tribune</button>`}
      </div></section>`;
  }
  const c = G.choices;
  if (p.role !== 'GK' && c.focus === 'gardien') c.focus = 'technique';
  const wk = st.weekly?.week === st.week ? st.weekly : null;
  const sp = wk ? C.specialById(wk.special) : null;
  if (c.offpitch === 'special' && !sp) c.offpitch = 'repos';
  const sel = C.selectionForecast(st);
  const opp = fx && !fx.bye ? st.league.teams.find((t) => t.id === fx.opponentId)?.name : null;
  const focusList = Object.entries(C.FOCUS).filter(([k]) => k !== 'gardien' || p.role === 'GK');
  return `<section class="card week">
    ${st.window && st.window.week === st.week ? `<div class="window"><h3>${icon('swap', 18)} Mercato d'hiver</h3>
      <ul class="win-list">${st.window.offers.map((o, i) => { const c = clubById(o.clubId); return `<li style="${clubVars(c)}">${crest(c, 30)}<span><b>${esc(c.name)}</b><small>${esc(o.kind)}${o.contract ? ` · ${C.money(o.contract.salary)}/mois, ${o.contract.years} an${o.contract.years > 1 ? 's' : ''}` : ' · tu gardes ton contrat'} · ${esc(C.divisionName(c))}</small></span><button data-win="${i}">Accepter</button></li>`; }).join('')}</ul>
      <button class="ghost small" id="win-stay">Rester au club</button></div>` : ''}
    ${report}
    <h2>${icon('calendar', 20)} Semaine ${st.week + 1}/${n} · ton programme</h2>
    ${extrasForWeek(st).map((x) => `<p class="extra-note ${x.kind}">${icon(x.kind === 'nat' ? 'star' : 'trophy', 18)}<span>${x.kind === 'nat' ? `<b>Convoqué !</b> ${esc(x.label)} cette semaine` : `En semaine : <b>${esc(x.label)}</b>`}</span></p>`).join('')}
    ${opp ? `<p class="next">Prochain match : ${fx.home ? 'contre' : 'chez'} <strong>${esc(opp)}</strong>${C.derbyOf(st.clubId, fx.opponentId) ? ` <span class="derby-chip">${esc(C.derbyOf(st.clubId, fx.opponentId))}</span>` : ''} · <span class="sel sel-${sel.status.replace(/\s/g, '-')}">${esc(sel.status)}</span>${sel.reason && C.SELECTION_REASON[sel.reason] ? ` <span class="muted small">${esc(C.SELECTION_REASON[sel.reason])}</span>` : ''}</p>${sel.rival && (sel.status !== 'titulaire' || sel.rival.signing) && sel.status !== 'blessé' ? rivalLine(st, sel.rival) : ''}` : '<p class="muted">Pas de match cette semaine.</p>'}
    ${p.injuryWeeks ? `<p>${icon('injury', 16)} Programme imposé : soins et réathlétisation.</p>` : `
    <h3>Entraînement</h3>
    ${wk?.coachFocus ? `<p class="coach-ask">${icon('whistle', 16)}<span><b>Le coach :</b> « ${esc(C.FOCUS[wk.coachFocus]?.label ?? '')} » cette semaine. ${esc(wk.why)}</span></p>` : ''}
    ${st.chance && !st.chance.earned ? `<p class="coach-ask challenge">${icon('target', 16)}<span><b>Défi du coach : ${st.chance.done}/${st.chance.need}.</b> Suis sa demande, intensité normale ou intense, pas de sortie.</span></p>` : ''}
    <div class="choice-grid" id="w-focus">${focusList.map(([k, v]) => `<button data-focus="${k}" class="choice ${c.focus === k ? 'active' : ''} ${wk?.coachFocus === k ? 'asked' : ''}">${wk?.coachFocus === k ? '<span class="ask-badge">Demandé</span>' : ''}<span class="ci">${icon(FOCUS_ICON[k], 24)}</span><span class="cl">${esc(v.label)}</span><span class="cs2">${v.attrs.length ? esc(v.attrs.map((a) => ATTR_LABELS[a]).join(', ')) : 'Récupération active'}</span></button>`).join('')}</div>
    <h3>Intensité</h3>
    <div class="seg wide" role="group" aria-label="Intensité">${Object.keys(C.INTENSITY).map((k) => `<button data-int="${k}" class="${c.intensity === k ? 'active' : ''}" title="${esc(INT_DESC[k])}">${esc(k)}</button>`).join('')}</div>
    <h3>Hors du terrain</h3>
    <div class="choice-grid" id="w-off">${sp ? `<button data-off="special" class="choice special ${c.offpitch === 'special' ? 'active' : ''}"><span class="ask-badge gold">Cette semaine</span><span class="ci">${icon(sp.icon, 24)}</span><span class="cl">${esc(sp.label)}</span><span class="cs2">${esc(sp.desc)}</span></button>` : ''}${Object.entries(C.OFFPITCH).filter(([k]) => k !== 'special').map(([k, v]) => `<button data-off="${k}" class="choice ${c.offpitch === k ? 'active' : ''}"><span class="ci">${icon(OFF_ICON[k], 24)}</span><span class="cl">${esc(v.label)}</span><span class="cs2">${esc(v.desc)}</span></button>`).join('')}</div>
    <div id="w-preview">${previewBlock(st)}</div>`}
    <button class="primary cta" id="w-go">Valider la semaine</button>
  </section>`;
}

function leagueCard(st) {
  const tabs = { classement: 'Classement', resultats: 'Résultats', coupes: 'Coupes', journal: 'Journal', carriere: 'Carrière' };
  let body = '';
  if (G.tab === 'classement') {
    const t = C.standings(st);
    body = `${objectivesBlock(st)}<p class="muted">${esc(st.league.name)}${st.league.simulated ? ' — composition simulée' : ''}</p>
      <table class="table"><tr><th>#</th><th>Équipe</th><th>J</th><th>Pts</th><th>Diff.</th></tr>${t.map((x, i) => `<tr class="${x.id === st.clubId ? 'me' : ''}"><td class="rk">${i + 1}</td><td class="tn">${crest(clubById(x.id), 18)}${esc(x.name)}</td><td>${x.p}</td><td><strong>${x.pts}</strong></td><td>${x.gf - x.ga > 0 ? '+' : ''}${x.gf - x.ga}</td></tr>`).join('')}</table>
      <p class="muted">Les rencontres où ton équipe joue passent par le moteur de match ; les autres par un modèle agrégé.</p>`;
  } else if (G.tab === 'resultats') {
    const mine = st.league.results.filter((r) => r.h === st.clubId || r.a === st.clubId);
    const name = (id) => st.league.teams.find((t) => t.id === id)?.name ?? id;
    body = mine.length ? `<ul class="plain">${mine.map((r) => { const w = (r.h === st.clubId ? r.gh - r.ga : r.ga - r.gh); return `<li><span class="res ${w > 0 ? 'w' : w < 0 ? 'l' : 'd'}">${w > 0 ? 'V' : w < 0 ? 'D' : 'N'}</span> J${r.week + 1} · ${esc(name(r.h))} <strong>${r.gh}-${r.ga}</strong> ${esc(name(r.a))}</li>`; }).join('')}</ul>` : '<p class="muted">Aucun match joué.</p>';
  } else if (G.tab === 'coupes') {
    const cups = st.cups ?? [];
    const intl = st.player.intl ?? { caps: {}, goals: 0 };
    const caps = Object.entries(intl.caps);
    body = (cups.length ? cups.map((c) => {
      const status = c.champion ? '<span class="cup-st win">Vainqueur</span>' : c.alive ? `<span class="cup-st on">En lice${c.rounds[c.idx] ? ` · ${esc(c.rounds[c.idx].label)} en semaine ${c.rounds[c.idx].week + 1}` : ''}</span>` : '<span class="cup-st out">Éliminé</span>';
      return `<div class="cup"><div class="cup-head">${icon('trophy', 18)}<strong>${esc(c.name)}</strong>${status}${c.points ? `<span class="muted small">${c.points} pts</span>` : ''}</div>
        <ul class="cup-log">${c.log.map((l) => `<li><span class="res ${l.won === true ? 'w' : l.won === false ? 'l' : 'd'}">${l.won === true ? 'V' : l.won === false ? 'D' : 'N'}</span><span class="cl-round">${esc(l.label)}</span>${crest(clubById(l.opp), 18)}<span class="cl-opp">${esc(clubById(l.opp)?.name ?? l.opp)}</span><b>${l.gf}-${l.ga}${l.pens ? ` <small>(t.a.b. ${l.pens[0]}-${l.pens[1]})</small>` : ''}</b></li>`).join('') || '<li class="muted">Premier tour à venir.</li>'}</ul></div>`;
    }).join('') : '<p class="muted">Pas de coupe cette saison à ce niveau.</p>')
      + `<div class="cup"><div class="cup-head">${icon('star', 18)}<strong>Sélections · ${esc(C.nationality(st.player.nation).name)}</strong></div>${caps.length ? `<p>${caps.map(([k, v]) => `${k === 'A' ? `${esc(C.nationality(st.player.nation).name)} A` : k} : <b>${v}</b> sélection${v > 1 ? 's' : ''}`).join(' · ')} · ${intl.goals} but(s)</p>` : '<p class="muted">Pas encore de convocation. Les trêves internationales tombent vers les semaines ' + [0.2, 0.44, 0.7, 0.9].map((f) => Math.round(f * C.seasonLength(st)) + 1).join(', ') + '.</p>'}</div>`;
  } else if (G.tab === 'journal') {
    body = `<ul class="plain">${st.journal.slice(0, 60).map((j) => `<li><span class="muted">${j.season} · S${j.week + 1}</span> ${esc(j.text)}</li>`).join('')}</ul>`;
  } else {
    const h = st.history;
    const pts = st.player.caHistory.slice(-80);
    const min = Math.min(...pts, 0.3), max = Math.max(...pts, 0.8);
    const path = pts.map((v, i) => `${(i / Math.max(1, pts.length - 1)) * 300},${60 - ((v - min) / (max - min)) * 56}`).join(' ');
    body = `${pts.length > 1 ? `<svg viewBox="0 0 300 62" class="spark" aria-label="Évolution du niveau"><polyline points="${path}" fill="none" stroke="currentColor" stroke-width="2"/></svg><p class="muted">Évolution du niveau (dernières semaines)</p>` : ''}
      ${h.length ? `<table class="table"><tr><th>Saison</th><th>Club</th><th>Matchs</th><th>Buts</th><th>Note</th><th>Niveau</th></tr>${h.map((x) => `<tr><td>${x.season}</td><td>${esc(x.club)} ${esc(x.stage)}</td><td>${x.apps}</td><td>${x.goals}</td><td>${x.rating ? x.rating.toFixed(1) : '—'}</td><td>${C.pct(x.caStart)}→${C.pct(x.caEnd)}</td></tr>`).join('')}</table>` : '<p class="muted">Première saison en cours.</p>'}
      <p>Cette saison : ${st.seasonStats.apps} matchs (${st.seasonStats.starts} titularisations), ${st.seasonStats.goals} but(s), ${st.seasonStats.minutes} minutes.</p>`;
  }
  return `<section class="card league"><nav class="tabs">${Object.entries(tabs).map(([k, v]) => `<button data-tab="${k}" class="${G.tab === k ? 'active' : ''}">${v}</button>`).join('')}</nav>${body}</section>`;
}

// ------------------------------------------------------------------ bilan mensuel (pop-up)
function monthReviewHtml(rv, st, closable) {
  const dCa = rv.ca[1] - rv.ca[0];
  const e0 = rv.est[0], e1 = rv.est[1];
  const m = rv.matches;
  const tot = rv.totals;
  const parts = [['Entraînement', tot.train.ca, 'p-train'], ['Hors terrain', tot.off.ca, 'p-off'], ['Matchs', tot.match.ca, 'p-match'], ['Autres', tot.other.ca, 'p-other']];
  const posSum = parts.reduce((a, x) => a + Math.max(0, x[1]), 0) || 1;
  const effChips = (x) => `${Math.abs(x.ca) > 5e-5 ? chip('Niveau', x.ca, { digits: 1 }) : ''}${Math.abs(x.pa) > 5e-5 ? chip('Potentiel', x.pa, { digits: 2 }) : ''}${Object.entries(x.gauges).map(([k, v]) => chip(C.GAUGE_LABELS[k].replace(' du coach', ''), v)).join('')}`;
  const row = (x) => `<li><div class="src-head"><strong>${esc(x.label)}</strong>${x.n ? `<span class="muted">${x.n} semaine${x.n > 1 ? 's' : ''}</span>` : ''}</div>
      <div class="chips">${effChips(x) || '<span class="muted">Aucun effet mesurable</span>'}</div>
      ${x.attrs.length ? `<div class="muted small">${x.attrs.slice(0, 5).map((a) => `${esc(ATTR_LABELS[a.k])} ${a.d >= 0 ? '+' : '−'}${Math.abs(a.d * 100).toFixed(1)}`).join(' · ')}</div>` : ''}</li>`;
  const of = (kinds) => rv.sources.filter((x) => kinds.includes(x.kind));
  const others = rv.sources.filter((x) => !['train', 'off'].includes(x.kind));
  const maxAbs = Math.max(0.002, ...rv.attrs.map((a) => Math.abs(a.d)));
  return `<div class="modal-backdrop" id="mr-backdrop"><div class="modal review" role="dialog" aria-modal="true">
    <h1>${st.player.face != null ? avatar({ face: st.player.face }, 44, 'mr-face') : icon('chart', 24)} Bilan du mois ${rv.index} <small>semaines ${rv.fromWeek} à ${rv.toWeek} · saison ${rv.season}-${rv.season + 1}</small></h1>
    <div class="kpis">
      <div><span class="label">Niveau</span><span class="value">${C.pct(rv.ca[0])} → ${C.pct(rv.ca[1])}</span>${chip('', dCa, { digits: 1 })}</div>
      <div><span class="label">Potentiel estimé</span><span class="value stars">${stars(C.toStars(e1.center))}</span><span class="muted">${C.pct(e0.lo)}–${C.pct(e0.hi)} → ${C.pct(e1.lo)}–${C.pct(e1.hi)}</span>${chip('Ce mois-ci', rv.paDelta, { digits: 2, title: 'Variation réelle du potentiel ce mois-ci, en points (détail par source ci-dessous)' })}</div>
      <div><span class="label">Matchs</span><span class="value">${m.played}<small> joué${m.played > 1 ? 's' : ''}</small></span><span class="muted">${m.minutes} min · ${m.goals} but${m.goals > 1 ? 's' : ''} · note ${m.avg != null ? m.avg.toFixed(1) : '—'}</span><span class="muted">Équipe : ${m.w} V · ${m.d} N · ${m.l} D</span></div>
      <div><span class="label">Classement</span><span class="value">${rv.pos[0] ?? '—'}<sup>e</sup> → ${rv.pos[1]}<sup>e</sup></span><span class="muted">sur ${rv.teams} équipes</span>${rv.earned ? `<span class="muted">Salaire perçu : ${C.money(rv.earned)}${rv.spent ? ` · entourage : −${C.money(rv.spent)}` : ''}</span>` : ''}</div>
    </div>

    <h3>D'où vient ta progression (${fmtLvl(dCa)} de niveau)</h3>
    <div class="stack">${parts.filter((x) => x[1] > 0).map((x) => `<i class="${x[2]}" style="width:${(Math.max(0, x[1]) / posSum) * 100}%" title="${x[0]}"></i>`).join('')}</div>
    <div class="legend">${parts.map((x) => `<span><i class="${x[2]}"></i>${x[0]} <b>${fmtLvl(x[1])}</b></span>`).join('')}</div>

    <div class="review-cols">
      <div>
        <h3>${icon('technique', 18)} Tes choix d'entraînement</h3>
        <ul class="src">${of(['train']).map(row).join('') || '<li class="muted">Aucune séance (blessure).</li>'}</ul>
        <h3>${icon('home', 18)} Hors du terrain</h3>
        <ul class="src">${of(['off']).map(row).join('') || '<li class="muted">—</li>'}</ul>
        <h3>${icon('ball', 18)} Matchs, événements et reste</h3>
        <ul class="src">${others.map(row).join('') || '<li class="muted">—</li>'}</ul>
      </div>
      <div>
        <h3>${icon('chart', 18)} Attributs ce mois-ci</h3>
        <ul class="attr-delta">${rv.attrs.map((a) => `<li><span>${esc(ATTR_LABELS[a.k])}</span><span class="num">${C.pct(a.a)} → ${C.pct(a.b)}</span>
          <span class="dbar" title="Entraînement ${fmtLvl(a.by.train)} · Hors terrain ${fmtLvl(a.by.off)} · Matchs ${fmtLvl(a.by.match)} · Autres ${fmtLvl(a.by.other)}">${[['p-train', a.by.train], ['p-off', a.by.off], ['p-match', a.by.match], ['p-other', a.by.other]].filter((x) => x[1] > 0).map((x) => `<i class="${x[0]}" style="width:${(x[1] / maxAbs) * 100}%"></i>`).join('')}</span>
          <b class="${a.d > 5e-4 ? 'up' : a.d < -5e-4 ? 'down' : ''}">${a.d >= 0 ? '+' : '−'}${Math.abs(a.d * 100).toFixed(1)}</b></li>`).join('')}</ul>
        <h3>${icon('target', 18)} Ton état</h3>
        <ul class="attr-delta">${Object.entries(rv.gauges).filter(([k]) => k !== 'school' || st.stage === 'U17' || st.stage === 'U19').map(([k, v]) => `<li><span>${esc(C.GAUGE_LABELS[k])}</span><span class="num">${C.pct(v[0])} → ${C.pct(v[1])}</span><span class="dbar"></span><b class="${v[1] - v[0] > 0.004 ? 'up' : v[1] - v[0] < -0.004 ? 'down' : ''}">${v[1] - v[0] >= 0 ? '+' : '−'}${Math.abs((v[1] - v[0]) * 100).toFixed(0)}</b></li>`).join('')}</ul>
        ${m.list.length ? `<h3>${icon('calendar', 18)} Tes matchs</h3><ul class="plain">${m.list.map((x) => `<li><span class="res ${x.outcome === 'victoire' ? 'w' : x.outcome === 'défaite' ? 'l' : 'd'}">${x.outcome[0].toUpperCase()}</span> ${x.comp ? `<span class="muted">${esc(x.comp)} ·</span> ` : ''}${x.gf}-${x.ga} ${x.home ? 'contre' : 'chez'} ${esc(x.opp)} · ${x.minutes ? `${x.minutes} min, note ${x.rating.toFixed(1)}${x.goals ? `, ${x.goals} but(s)` : ''}` : esc(x.selection)}</li>`).join('')}</ul>` : ''}
      </div>
    </div>

    <h3>${icon('chat', 18)} Le staff te dit</h3>
    <ul class="advice">${rv.advice.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>
    <p class="muted small">Chaque chiffre est mesuré : c'est la variation réellement produite par tes choix ce mois-ci (niveau et attributs en points sur 100, potentiel en points).</p>
    <div class="actions"><button class="primary cta" id="mr-close">${closable ? 'Fermer' : 'Continuer'}</button></div>
  </div></div>`;
}

// La saison en un coup d'œil : une case par semaine, colorée selon le résultat de ton équipe
function seasonStrip(st) {
  const n = C.seasonLength(st);
  const res = {};
  for (const r of st.league.results) {
    if (r.h !== st.clubId && r.a !== st.clubId) continue;
    const d = r.h === st.clubId ? r.gh - r.ga : r.ga - r.gh;
    res[r.week] = { c: d > 0 ? 'w' : d < 0 ? 'l' : 'd', t: `J${r.week + 1} : ${r.h === st.clubId ? r.gh : r.ga}-${r.h === st.clubId ? r.ga : r.gh}` };
  }
  return `<ol class="season-strip" aria-label="Saison : ${st.week} semaines jouées sur ${n}">${Array.from({ length: n }, (_, i) => `<li class="${res[i]?.c ?? (i < st.week ? 'bye' : '')}${i === st.week ? ' now' : ''}" title="${res[i]?.t ?? `Semaine ${i + 1}`}"></li>`).join('')}</ol>`;
}

export function renderHub() {
  const st = G.st;
  if (!st) return showHome();
  if (st.phase === 'season_end') return renderSeasonEnd();
  if (st.phase === 'retired') return renderRetired();
  if (st.phase === 'coach') return renderCoach();
  const club = clubById(st.clubId);
  const n = C.seasonLength(st);
  const review = st.phase === 'month_review' ? st.monthReview : G.showReview;
  const el = show(`<div class="hub" style="${clubVars(club)}">
    <header class="hub-head">
      <span class="kit-stripes" aria-hidden="true"></span>
      <div class="hub-title">${crest(club, 52)}
        <div><strong>${esc(club.name)}</strong><span class="stage-pill">${esc(STAGE_LABEL[st.stage])}</span><br><span class="muted">Saison ${st.season}-${st.season + 1} · ${st.week >= n && st.tournament ? `été : ${esc(st.tournament.name)}` : `semaine ${Math.min(st.week + 1, n)}/${n}`}</span></div></div>
      ${seasonStrip(st)}
      <div class="row hub-actions"><button id="hub-money" title="Ton argent">${icon('wallet', 18)}<span>${C.money(st.player.money)}</span></button><button id="hub-palmares" title="Palmarès">${icon('trophy', 18)}<span>Palmarès</span></button><button id="hub-save">${icon('save', 18)}<span>Sauvegarder</span></button><button id="hub-home">${icon('home', 18)}<span>Accueil</span></button></div>
    </header>
    <div class="hub-grid">${weekCard(st)}${profileCard(st)}${leagueCard(st)}</div>
  </div>${review ? monthReviewHtml(review, st, st.phase !== 'month_review') : ''}`);
  bindHub(el);
}

function bindHub(el) {
  const st = G.st;
  el.querySelector('#hub-save').addEventListener('click', () => { if (persist()) flash('Partie sauvegardée.'); });
  el.querySelector('#hub-palmares').addEventListener('click', () => renderPalmares(renderHub));
  el.querySelector('#hub-money').addEventListener('click', () => renderMoney(renderHub));
  el.querySelector('#hub-role')?.addEventListener('click', () => showRoleChange());
  el.querySelector('#hub-transfer')?.addEventListener('click', async () => {
    if (!(await askConfirm('Demander un transfert ? Le club acceptera d\'écouter les offres (mercato et fin de saison), mais le coach, le vestiaire et les supporters le prendront mal.', 'Demander'))) return;
    try { flash(C.requestTransfer(G.st)); persist(); } catch (e) { flash(e.message); }
    renderHub();
  });
  el.querySelector('#hub-home').addEventListener('click', () => { persist(); showHome(); });
  el.querySelector('#hub-review')?.addEventListener('click', () => { G.showReview = st.lastMonthReview; renderHub(); });
  el.querySelector('#mr-close')?.addEventListener('click', () => {
    if (st.phase === 'month_review') { C.closeMonthReview(st); persist(); }
    G.showReview = null;
    renderHub();
  });
  el.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { G.tab = b.dataset.tab; const y = root().scrollTop; renderHub(); root().scrollTop = y; }));
  const refreshPreview = () => { const box = el.querySelector('#w-preview'); if (box) box.innerHTML = previewBlock(st); };
  const pickIn = (sel, attr, key) => el.querySelectorAll(sel).forEach((b) => b.addEventListener('click', () => {
    G.choices[key] = b.dataset[attr];
    el.querySelectorAll(sel).forEach((x) => x.classList.toggle('active', x === b));
    refreshPreview();
  }));
  pickIn('[data-focus]', 'focus', 'focus');
  pickIn('[data-int]', 'int', 'intensity');
  pickIn('[data-off]', 'off', 'offpitch');
  el.querySelector('#w-go')?.addEventListener('click', () => {
    const finish = (drill) => { C.submitWeek(st, { ...G.choices, drill }); persist(); renderHub(); };
    // mini-jeu de la semaine : deux par thème, ils alternent d'une semaine à l'autre
    const z = st.player.injuryWeeks ? null : C.drillFor(st.player, G.choices.focus, G.choices.intensity, st.season * 53 + st.week);
    if (z && drillsOn()) runDrill(z, finish, { onDisable: () => setDrills(false) }); else finish(null);
  });
  el.querySelectorAll('[data-win]').forEach((b) => b.addEventListener('click', () => { C.acceptWinterOffer(st, Number(b.dataset.win)); persist(); renderHub(); }));
  el.querySelector('#win-stay')?.addEventListener('click', () => { C.declineWinter(st); persist(); renderHub(); });
  el.querySelectorAll('[data-ev]').forEach((b) => b.addEventListener('click', () => { C.resolveEvent(st, Number(b.dataset.ev)); persist(); renderHub(); }));
  el.querySelector('#w-bye')?.addEventListener('click', () => { C.applyMatchResult(st, {}); persist(); renderHub(); });
  el.querySelector('#w-sim')?.addEventListener('click', simulateWeekMatch);
  el.querySelector('#w-watch')?.addEventListener('click', watchWeekMatch);
}

// ------------------------------------------------------------------ atelier de la semaine
// Un geste à réussir (src/ui/drills.js) : curseur, jongles, réaction, mémoire, penalty, lecture, plongeon.
const DRILL_KEY = 'generation-football.drills';
function drillsOn() { try { return localStorage.getItem(DRILL_KEY) !== 'off'; } catch { return true; } }
function setDrills(on) { try { localStorage.setItem(DRILL_KEY, on ? 'on' : 'off'); } catch { /* stockage indisponible */ } }
let flashTimer;
export function flash(text) {
  let t = document.getElementById('screen-flash');
  if (!t) { t = document.createElement('div'); t.id = 'screen-flash'; document.body.append(t); }
  t.textContent = text; t.hidden = false;
  clearTimeout(flashTimer); flashTimer = setTimeout(() => { t.hidden = true; }, 2500);
}

// ------------------------------------------------------------------ matchs
function simulateWeekMatch() {
  if (G.busy) return;
  const st = G.st;
  const setup = C.matchSetup(st);
  if (!setup.inSquad) { C.applyMatchResult(st, C.resultWithoutUser(st)); persist(); renderHub(); return; }
  G.busy = true;
  const m = createCareerMatch(setup);
  show(`<div class="sim-screen"><p class="muted">Simulation du match</p><h1>${crest(clubById(setup.home.def.clubId), 56)}<span>${esc(setup.homeName)}</span><i>–</i><span>${esc(setup.awayName)}</span>${crest(clubById(setup.away.def.clubId), 56)}</h1><progress id="sim-p" max="100" value="0"></progress><p class="muted small">Même moteur que la vue 2D, sans rendu.</p></div>`);
  const step = () => {
    for (let i = 0; i < 2500 && m.phase !== 'fulltime'; i++) m.step();
    const prog = document.getElementById('sim-p');
    if (prog) prog.value = Math.min(100, (m.t / 5600) * 100);
    if (m.phase !== 'fulltime') { setTimeout(step, 0); return; }
    G.busy = false;
    C.applyMatchResult(st, extractResult(m, setup.userTeam));
    persist();
    renderHub();
  };
  setTimeout(step, 30);
}

function watchWeekMatch() {
  const st = G.st;
  const setup = C.matchSetup(st);
  const m = createCareerMatch(setup);
  const p = st.player;
  hideScreen();
  startMatch({
    match: m,
    career: {
      followTeam: setup.userTeam,
      face: p.face ?? null,
      competition: `${st.matchday.extra ? st.matchday.extra.label : `${st.league.name} · journée ${st.week + 1}`}${setup.derby ? ` · ${setup.derby}` : ''}${setup.weather && C.WEATHER[setup.weather] ? ` · ${C.WEATHER[setup.weather].icon} ${C.WEATHER[setup.weather].label}` : ''}`,
      weather: setup.weather ?? null,
      label: setup.inSquad ? `Joueur : ${p.firstName} ${p.lastName} (n° ${m.players.find((x) => x.isUser)?.num}) — ${st.matchday.selection}` : `Dans les tribunes : ${p.firstName} ${p.lastName} (${st.matchday.selection})`,
      onFinish: (match) => {
        C.applyMatchResult(st, extractResult(match, setup.userTeam));
        persist();
        renderHub();
      },
    },
  });
}


export function initCareerUI() {
  setHomeHandler(showHome);
  // Retour Android / Échap sur un écran de carrière : revenir en arrière proprement
  window.addEventListener('keydown', (e) => {
    if (root().hidden || e.key !== 'Escape' || document.querySelector('.dialog-back')) return;
    e.stopImmediatePropagation();
    if (G.showReview) { G.showReview = null; renderHub(); return; }
    if (G.st && G.st.phase === 'month_review') { C.closeMonthReview(G.st); persist(); renderHub(); return; }
    if (G.st) { persist(); showHome(); } else showHome();
  }, true);
}

export { SLOTS };
