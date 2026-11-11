// Écrans de la carrière : accueil, chargement, création, choix du club, semaine, fin de saison.
import * as C from '../career/career.js';
import { CLUBS, clubById, academyQuality, academyStars, clubLevel, LEVEL_NAMES, leagueFor, STAGE_LABEL, youthCA } from '../career/clubs.js';
import { listSaves, saveCareer, loadCareer, deleteSave, firstFreeSlot, hasSaves, SLOTS } from '../career/save.js';
import { createCareerMatch, extractResult } from '../career/play.js';
import { CATALOG } from '../data/catalog.js';
import { startMatch, showQuickMatchSetup, setHomeHandler } from './app.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const root = () => document.getElementById('screen');
const stars = (n) => '★'.repeat(Math.floor(n)) + (n % 1 ? '½' : '') + '☆'.repeat(5 - Math.ceil(n));
const ATTR_LABELS = { pace: 'Vitesse', accel: 'Accélération', stamina: 'Endurance', passing: 'Passe', vision: 'Vision', decisions: 'Décisions', firstTouch: 'Contrôle', dribbling: 'Dribble', tackling: 'Tacle', positioning: 'Placement', shooting: 'Frappe', aerial: 'Jeu aérien', aggression: 'Agressivité', gk: 'Gardien', composure: 'Sang-froid' };

const G = { st: null, slot: null, tab: 'classement', choices: { focus: 'technique', intensity: 'normale', offpitch: 'repos' }, filter: { q: '', level: 'all' }, pick: null, form: null, busy: false };

function show(html) {
  const el = root();
  el.hidden = false;
  el.innerHTML = html;
  el.scrollTop = 0;
  document.body.classList.add('in-screen');
  return el;
}
function hideScreen() { root().hidden = true; document.body.classList.remove('in-screen'); }
function persist() { if (G.slot && G.st) saveCareer(G.slot, G.st); }

// ------------------------------------------------------------------ accueil
export function showHome() {
  G.st = null; G.slot = null;
  const nClubs = CATALOG.clubs.length;
  const el = show(`<div class="home">
    <h1>Generation Football</h1>
    <p class="tagline">« Tu n'es pas le centre du monde. Tu essaies d'y trouver ta place, puis d'y laisser une trace. »</p>
    <div class="home-actions">
      <button class="primary big" id="h-new">Débuter la partie</button>
      <button class="big" id="h-load" ${hasSaves() ? '' : 'disabled'}>Charger la partie</button>
      <button id="h-quick">Match amical (moteur 2D)</button>
    </div>
    <p class="note">${nClubs} clubs réels du catalogue V1 (saison 2026-2027). Les effectifs professionnels reprennent les noms publiés par les clubs ; les notes sont des estimations du jeu. Les coéquipiers du centre de formation sont fictifs.</p>
  </div>`);
  el.querySelector('#h-new').addEventListener('click', showNewCareer);
  el.querySelector('#h-load').addEventListener('click', showLoad);
  el.querySelector('#h-quick').addEventListener('click', () => { hideScreen(); showQuickMatchSetup(); });
}

function showLoad() {
  const saves = listSaves();
  const el = show(`<div class="panel-screen narrow">
    <h1>Charger la partie</h1>
    <ul class="slots">${saves.map((s) => `<li>
      <strong>Emplacement ${s.slot}</strong>
      ${s.empty ? '<span class="muted">vide</span>' : s.corrupt ? '<span class="error">sauvegarde illisible</span>' : `<span>${esc(s.name)} · ${s.age} ans · ${esc(s.club)} (${esc(s.stage)}) · saison ${esc(s.season)}, semaine ${s.week} · niveau ${s.ca}<br><span class="muted">Sauvegardé le ${new Date(s.savedAt).toLocaleString('fr-FR')}</span></span>`}
      <span class="row">${s.empty ? '' : `${s.corrupt ? '' : `<button class="primary" data-load="${s.slot}">Charger</button>`}<button data-del="${s.slot}">Supprimer</button>`}</span>
    </li>`).join('')}</ul>
    <div class="actions"><button id="l-back">Retour</button></div>
  </div>`);
  el.querySelectorAll('[data-load]').forEach((b) => b.addEventListener('click', () => {
    try { G.st = loadCareer(Number(b.dataset.load)); G.slot = Number(b.dataset.load); renderHub(); } catch (e) { alert(e.message); }
  }));
  el.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => {
    if (confirm(`Supprimer définitivement la sauvegarde de l'emplacement ${b.dataset.del} ?`)) { deleteSave(Number(b.dataset.del)); hasSaves() ? showLoad() : showHome(); }
  }));
  el.querySelector('#l-back').addEventListener('click', showHome);
}

// ------------------------------------------------------------------ création du joueur
function showNewCareer() {
  const f = G.form ?? { firstName: '', lastName: '', role: 'CM', foot: 'droit', slot: firstFreeSlot() ?? 1 };
  const saves = listSaves();
  const el = show(`<div class="panel-screen narrow">
    <h1>Nouveau joueur</h1>
    <p class="muted">Tu as 15 ans. Ton potentiel sera tiré au hasard : personne ne le connaît, pas même toi.</p>
    <div class="grid2">
      <label>Prénom<input type="text" id="n-first" maxlength="20" value="${esc(f.firstName)}"></label>
      <label>Nom<input type="text" id="n-last" maxlength="24" value="${esc(f.lastName)}"></label>
      <label>Poste<select id="n-role">${Object.entries(C.ROLES).map(([k, v]) => `<option value="${k}" ${f.role === k ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label>
      <label>Pied fort<select id="n-foot"><option ${f.foot === 'droit' ? 'selected' : ''}>droit</option><option ${f.foot === 'gauche' ? 'selected' : ''}>gauche</option></select></label>
      <label>Emplacement de sauvegarde<select id="n-slot">${saves.map((s) => `<option value="${s.slot}" ${f.slot === s.slot ? 'selected' : ''}>${s.slot} — ${s.empty ? 'vide' : `remplacer ${esc(s.name ?? 'la sauvegarde')}`}</option>`).join('')}</select></label>
    </div>
    <div id="n-err" class="error"></div>
    <div class="actions"><button id="n-back">Retour</button><button class="primary" id="n-next">Choisir le club</button></div>
  </div>`);
  el.querySelector('#n-back').addEventListener('click', () => { G.form = null; showHome(); });
  el.querySelector('#n-next').addEventListener('click', () => {
    const form = { firstName: el.querySelector('#n-first').value.trim(), lastName: el.querySelector('#n-last').value.trim(), role: el.querySelector('#n-role').value, foot: el.querySelector('#n-foot').value, slot: Number(el.querySelector('#n-slot').value) };
    if (!form.firstName || !form.lastName) { el.querySelector('#n-err').textContent = 'Indique un prénom et un nom.'; return; }
    const occupied = !saves.find((s) => s.slot === form.slot).empty;
    if (occupied && !confirm(`L'emplacement ${form.slot} contient déjà une partie. La remplacer ?`)) return;
    G.form = form;
    showClubPicker();
  });
}

// ------------------------------------------------------------------ choix du club
function clubRows() {
  const q = G.filter.q.trim().toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
  return CLUBS.filter((c) => {
    if (G.filter.level !== 'all' && String(clubLevel(c)) !== G.filter.level) return false;
    if (!q) return true;
    return c.name.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').includes(q);
  }).sort((a, b) => academyQuality(b) - academyQuality(a) || a.name.localeCompare(b.name, 'fr'));
}

function showClubPicker() {
  const levels = [1, 2, 3, 4, 5, 6];
  const el = show(`<div class="panel-screen picker">
    <div class="picker-head">
      <h1>Où commence ta formation ?</h1>
      <div class="row">
        <input type="text" id="c-q" placeholder="Rechercher un club…" value="${esc(G.filter.q)}">
        <select id="c-level"><option value="all">Toutes les divisions</option>${levels.map((l) => `<option value="${l}" ${G.filter.level === String(l) ? 'selected' : ''}>${esc(LEVEL_NAMES[l])}</option>`).join('')}</select>
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
    list.innerHTML = rows.map((c) => `<li data-id="${c.id}" class="${G.pick === c.id ? 'sel' : ''}">
      <span class="cn">${esc(c.name)}</span>
      <span class="cd">${esc(LEVEL_NAMES[clubLevel(c)])}</span>
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
    box.innerHTML = `<h2>${esc(c.name)}</h2>
      <p>${c.senior ? `${esc(c.senior.competition.split(', ').pop())}${c.senior.group !== 'Unique' ? ` (groupe ${esc(c.senior.group)})` : ''}` : esc(LEVEL_NAMES[clubLevel(c)])}${c.reserve ? ` · réserve en ${esc(c.reserve.competition.split(', ').pop())}` : ''}</p>
      <p><strong>Centre de formation</strong> ${stars(academyStars(c))}</p>
      <p>U17 : ${esc(lg17.name)}<br>U19 : ${esc(lg19.name)}</p>
      <p><strong>Ton niveau de départ</strong> : environ ${start}. Un centre réputé t'entoure de meilleurs joueurs et de meilleurs formateurs, mais la concurrence y est plus rude.</p>
      <p><strong>Ton potentiel</strong> : tiré au hasard, indépendant du club. Il évoluera selon tes choix.</p>
      <p class="muted">${c.senior?.players?.length >= 11 ? 'Effectif professionnel : noms publiés par le club (notes estimées par le jeu).' : 'Effectif professionnel : non établi dans la collecte, joueurs générés.'}</p>
      <button class="primary" id="c-go">Commencer au centre de formation</button>`;
    box.querySelector('#c-go').addEventListener('click', () => {
      const f = G.form;
      G.st = C.createCareer({ firstName: f.firstName, lastName: f.lastName, role: f.role, foot: f.foot, clubId: c.id });
      G.slot = f.slot; G.form = null; G.pick = null;
      persist();
      renderHub();
    });
  };
  el.querySelector('#c-q').addEventListener('input', (e) => { G.filter.q = e.target.value; renderList(); });
  el.querySelector('#c-level').addEventListener('change', (e) => { G.filter.level = e.target.value; renderList(); });
  el.querySelector('#c-back').addEventListener('click', showNewCareer);
  renderList();
  if (G.pick) renderDetail();
}

// ------------------------------------------------------------------ tableau de bord
function gauge(label, v, hint = '') {
  const cls = v > 0.66 ? 'good' : v > 0.4 ? 'mid' : 'low';
  return `<div class="gauge" title="${esc(hint)}"><span>${esc(label)}</span><span class="bar"><i class="${cls}" style="width:${Math.round(v * 100)}%"></i></span></div>`;
}

function profileCard(st) {
  const p = st.player;
  const ca = C.currentCA(st);
  const est = C.potentialEstimate(st);
  const youth = st.stage === 'U17' || st.stage === 'U19';
  const w = Object.keys(p.attrs).filter((k) => k !== 'gk' || p.role === 'GK').sort((a, b) => p.attrs[b] - p.attrs[a]);
  return `<section class="card">
    <h2>${esc(p.firstName)} ${esc(p.lastName)} <small>${p.age} ans · ${esc(C.ROLES[p.role])} · pied ${esc(p.foot)}</small></h2>
    <div class="big-stats">
      <div><span class="label">Niveau actuel</span><span class="value">${C.pct(ca)}</span></div>
      <div><span class="label">Potentiel estimé par le staff</span><span class="value stars">${stars(C.toStars(est.center))}</span><span class="muted">entre ${C.pct(est.lo)} et ${C.pct(est.hi)}</span></div>
    </div>
    ${p.injuryWeeks ? `<p class="error">Blessé : encore ${p.injuryWeeks} semaine(s).</p>` : ''}
    ${gauge('Moral', p.morale)}${gauge('Fraîcheur', p.fresh)}${gauge('Confiance du coach', p.trust)}${gauge('Discipline', p.discipline)}${youth ? gauge('Scolarité', p.school) : ''}
    <details><summary>Attributs</summary><ul class="attrs">${w.map((k) => `<li><span>${esc(ATTR_LABELS[k])}</span><span class="bar"><i style="width:${Math.round(p.attrs[k] * 100)}%"></i></span><span>${C.pct(p.attrs[k])}</span></li>`).join('')}</ul></details>
  </section>`;
}

function weekCard(st) {
  const p = st.player;
  const n = C.seasonLength(st);
  const fx = C.fixtureOfWeek(st);
  const rep = st.lastReport;
  const report = rep && rep.lines.length ? `<div class="report"><strong>Dernière semaine</strong><ul>${rep.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul></div>` : '';
  if (st.phase === 'event') {
    return `<section class="card week">${report}<h2>Un choix à faire</h2><p class="event-text">${esc(st.pendingEvent.text)}</p>
      <div class="options">${st.pendingEvent.options.map((o, i) => `<button data-ev="${i}">${esc(o)}</button>`).join('')}</div></section>`;
  }
  if (st.phase === 'matchday') {
    const md = st.matchday;
    if (md.bye) return `<section class="card week">${report}<h2>Semaine ${st.week + 1}/${n}</h2><p>Pas de match cette semaine.</p><button class="primary" id="w-bye">Continuer</button></section>`;
    const opp = st.league.teams.find((t) => t.id === md.opponentId)?.name;
    const inSquad = md.selection === 'titulaire' || md.selection === 'remplaçant';
    const selTxt = { titulaire: 'Le coach t\'aligne d\'entrée.', remplaçant: 'Tu commences sur le banc.', 'non retenu': 'Tu n\'es pas retenu dans le groupe cette semaine.', 'blessé': 'Tu es blessé et ne peux pas jouer.' }[md.selection];
    return `<section class="card week">${report}
      <h2>Jour de match — journée ${st.week + 1}/${n}</h2>
      <p class="fixture">${md.home ? `<strong>${esc(st.league.teams.find((t) => t.id === st.clubId).name)}</strong> – ${esc(opp)}` : `${esc(opp)} – <strong>${esc(st.league.teams.find((t) => t.id === st.clubId).name)}</strong>`}</p>
      <p>${esc(selTxt)}${md.rival && md.selection !== 'titulaire' ? ` Concurrent direct : ${esc(md.rival.name)}.` : ''}</p>
      <div class="options">
        ${inSquad ? '<button class="primary" id="w-watch">Jouer le match (vue 2D)</button><button id="w-sim">Simuler le match</button>'
          : '<button class="primary" id="w-sim">Voir le résultat</button><button id="w-watch">Regarder depuis la tribune</button>'}
      </div></section>`;
  }
  const c = G.choices;
  if (p.role !== 'GK' && c.focus === 'gardien') c.focus = 'technique';
  const sel = C.selectionForecast(st);
  const opp = fx && !fx.bye ? st.league.teams.find((t) => t.id === fx.opponentId)?.name : null;
  return `<section class="card week">${report}
    <h2>Semaine ${st.week + 1}/${n}</h2>
    ${opp ? `<p class="muted">Prochain match : ${fx.home ? 'contre' : 'chez'} ${esc(opp)} · le coach t'annonce <strong>${esc(sel.status)}</strong>${sel.rival && sel.status !== 'titulaire' && sel.status !== 'blessé' ? ` (concurrent : ${esc(sel.rival.name)})` : ''}.</p>` : '<p class="muted">Pas de match cette semaine.</p>'}
    ${p.injuryWeeks ? '<p>Programme imposé : soins et réathlétisation.</p>' : `
    <label>Thème d'entraînement<select id="w-focus">${Object.entries(C.FOCUS).filter(([k]) => k !== 'gardien' || p.role === 'GK').map(([k, v]) => `<option value="${k}" ${c.focus === k ? 'selected' : ''}>${esc(v.label)}</option>`).join('')}</select></label>
    <div class="seg" role="group" aria-label="Intensité">${Object.keys(C.INTENSITY).map((k) => `<button data-int="${k}" class="${c.intensity === k ? 'active' : ''}">${esc(k)}</button>`).join('')}</div>
    <label>Hors du terrain<select id="w-off">${Object.entries(C.OFFPITCH).map(([k, v]) => `<option value="${k}" ${c.offpitch === k ? 'selected' : ''}>${esc(v.label)}</option>`).join('')}</select></label>
    <p class="muted" id="w-offdesc">${esc(C.OFFPITCH[c.offpitch].desc)}</p>`}
    <button class="primary" id="w-go">Valider la semaine</button>
  </section>`;
}

function leagueCard(st) {
  const tabs = { classement: 'Classement', resultats: 'Résultats', journal: 'Journal', carriere: 'Carrière' };
  let body = '';
  if (G.tab === 'classement') {
    const t = C.standings(st);
    body = `<p class="muted">${esc(st.league.name)}${st.league.simulated ? ' — composition simulée' : ''}</p>
      <table class="table"><tr><th>#</th><th>Équipe</th><th>J</th><th>Pts</th><th>Diff.</th></tr>${t.map((x, i) => `<tr class="${x.id === st.clubId ? 'me' : ''}"><td>${i + 1}</td><td>${esc(x.name)}</td><td>${x.p}</td><td><strong>${x.pts}</strong></td><td>${x.gf - x.ga > 0 ? '+' : ''}${x.gf - x.ga}</td></tr>`).join('')}</table>
      <p class="muted">Les rencontres où ton équipe joue passent par le moteur de match ; les autres par un modèle agrégé.</p>`;
  } else if (G.tab === 'resultats') {
    const mine = st.league.results.filter((r) => r.h === st.clubId || r.a === st.clubId);
    const name = (id) => st.league.teams.find((t) => t.id === id)?.name ?? id;
    body = mine.length ? `<ul class="plain">${mine.map((r) => `<li>J${r.week + 1} · ${esc(name(r.h))} ${r.gh}-${r.ga} ${esc(name(r.a))}</li>`).join('')}</ul>` : '<p class="muted">Aucun match joué.</p>';
  } else if (G.tab === 'journal') {
    body = `<ul class="plain">${st.journal.slice(0, 60).map((j) => `<li><span class="muted">${j.season} · S${j.week + 1}</span> ${esc(j.text)}</li>`).join('')}</ul>`;
  } else {
    const h = st.history;
    const hist = st.player.caHistory;
    const pts = hist.slice(-80);
    const min = Math.min(...pts, 0.3), max = Math.max(...pts, 0.8);
    const path = pts.map((v, i) => `${(i / Math.max(1, pts.length - 1)) * 300},${60 - ((v - min) / (max - min)) * 56}`).join(' ');
    body = `${pts.length > 1 ? `<svg viewBox="0 0 300 62" class="spark" aria-label="Évolution du niveau"><polyline points="${path}" fill="none" stroke="currentColor" stroke-width="2"/></svg><p class="muted">Évolution du niveau (dernières semaines)</p>` : ''}
      ${h.length ? `<table class="table"><tr><th>Saison</th><th>Club</th><th>Matchs</th><th>Buts</th><th>Note</th><th>Niveau</th></tr>${h.map((x) => `<tr><td>${x.season}</td><td>${esc(x.club)} ${esc(x.stage)}</td><td>${x.apps}</td><td>${x.goals}</td><td>${x.rating ? x.rating.toFixed(1) : '—'}</td><td>${C.pct(x.caStart)}→${C.pct(x.caEnd)}</td></tr>`).join('')}</table>` : '<p class="muted">Première saison en cours.</p>'}
      <p>Cette saison : ${st.seasonStats.apps} matchs (${st.seasonStats.starts} titularisations), ${st.seasonStats.goals} but(s), ${st.seasonStats.minutes} minutes.</p>`;
  }
  return `<section class="card"><nav class="tabs">${Object.entries(tabs).map(([k, v]) => `<button data-tab="${k}" class="${G.tab === k ? 'active' : ''}">${v}</button>`).join('')}</nav>${body}</section>`;
}

export function renderHub() {
  const st = G.st;
  if (!st) return showHome();
  if (st.phase === 'season_end') return renderSeasonEnd();
  if (st.phase === 'retired') return renderRetired();
  const club = clubById(st.clubId);
  const el = show(`<div class="hub">
    <header class="hub-head">
      <div><strong>${esc(club.name)}</strong> · ${esc(STAGE_LABEL[st.stage])} <span class="muted">· saison ${st.season}-${st.season + 1}</span></div>
      <div class="row"><button id="hub-save">Sauvegarder</button><button id="hub-home">Accueil</button></div>
    </header>
    <div class="hub-grid">${profileCard(st)}${weekCard(st)}${leagueCard(st)}</div>
  </div>`);
  bindHub(el);
}

function bindHub(el) {
  const st = G.st;
  el.querySelector('#hub-save').addEventListener('click', () => { persist(); flash('Partie sauvegardée.'); });
  el.querySelector('#hub-home').addEventListener('click', () => { persist(); showHome(); });
  el.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { G.tab = b.dataset.tab; renderHub(); }));
  el.querySelector('#w-focus')?.addEventListener('change', (e) => { G.choices.focus = e.target.value; });
  el.querySelector('#w-off')?.addEventListener('change', (e) => { G.choices.offpitch = e.target.value; el.querySelector('#w-offdesc').textContent = C.OFFPITCH[e.target.value].desc; });
  el.querySelectorAll('[data-int]').forEach((b) => b.addEventListener('click', () => { G.choices.intensity = b.dataset.int; el.querySelectorAll('[data-int]').forEach((x) => x.classList.toggle('active', x === b)); }));
  el.querySelector('#w-go')?.addEventListener('click', () => { C.submitWeek(st, { ...G.choices }); persist(); renderHub(); });
  el.querySelectorAll('[data-ev]').forEach((b) => b.addEventListener('click', () => { C.resolveEvent(st, Number(b.dataset.ev)); persist(); renderHub(); }));
  el.querySelector('#w-bye')?.addEventListener('click', () => { C.applyMatchResult(st, {}); persist(); renderHub(); });
  el.querySelector('#w-sim')?.addEventListener('click', simulateWeekMatch);
  el.querySelector('#w-watch')?.addEventListener('click', watchWeekMatch);
}

let flashTimer;
function flash(text) {
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
  show(`<div class="home"><h1>Simulation du match…</h1><p>${esc(setup.homeName)} – ${esc(setup.awayName)}</p><p class="muted">Même moteur que la vue 2D, sans rendu.</p><progress id="sim-p" max="100" value="0"></progress></div>`);
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
      competition: `${st.league.name} · journée ${st.week + 1}`,
      label: setup.inSquad ? `Joueur : ${p.firstName} ${p.lastName} (n° ${m.players.find((x) => x.isUser)?.num}) — ${st.matchday.selection}` : `Dans les tribunes : ${p.firstName} ${p.lastName} (${st.matchday.selection})`,
      onFinish: (match) => {
        C.applyMatchResult(st, extractResult(match, setup.userTeam));
        persist();
        renderHub();
      },
    },
  });
}

// ------------------------------------------------------------------ fin de saison
function renderSeasonEnd() {
  const st = G.st;
  const h = st.history[st.history.length - 1];
  const el = show(`<div class="panel-screen narrow">
    <h1>Fin de saison ${h.season}-${h.season + 1}</h1>
    <p>${esc(h.club)} ${esc(h.stage)} · ${esc(h.league)} : <strong>${h.pos}e sur ${h.teams}</strong></p>
    <p>${h.apps} matchs (${h.starts} titularisations), ${h.goals} but(s), ${h.minutes} minutes${h.rating ? `, note moyenne ${h.rating.toFixed(1)}` : ''}.</p>
    <p>Niveau : ${C.pct(h.caStart)} → <strong>${C.pct(h.caEnd)}</strong> · Potentiel estimé : ${stars(C.toStars(C.potentialEstimate(st).center))}</p>
    <h2>Pour la saison prochaine (${st.player.age} ans)</h2>
    <ul class="offers">${st.offers.map((o, i) => o.retire ? `<li><span>${esc(o.kind)}</span><button data-offer="${i}">Choisir</button></li>` : `<li>
      <span><strong>${esc(clubById(o.clubId).name)}</strong> — ${esc(STAGE_LABEL[o.stage])}<br><span class="muted">${esc(o.kind)} · ${esc(LEVEL_NAMES[clubLevel(clubById(o.clubId))])}${o.stage === 'U17' || o.stage === 'U19' ? ` · centre ${stars(academyStars(clubById(o.clubId)))}` : ''}</span></span>
      <button class="${o.own ? 'primary' : ''}" data-offer="${i}">Accepter</button></li>`).join('')}</ul>
    ${st.offers.some((o) => o.own) ? '' : '<p class="note">Ton club ne te conserve pas. L\'échec ouvre d\'autres chemins : choisis où rebondir.</p>'}
  </div>`);
  el.querySelectorAll('[data-offer]').forEach((b) => b.addEventListener('click', () => { C.acceptOffer(st, Number(b.dataset.offer)); persist(); renderHub(); }));
}

function renderRetired() {
  const st = G.st;
  const tot = st.history.reduce((a, h) => ({ apps: a.apps + h.apps, goals: a.goals + h.goals }), { apps: 0, goals: 0 });
  const el = show(`<div class="panel-screen narrow">
    <h1>Fin de carrière</h1>
    <p>${esc(st.player.firstName)} ${esc(st.player.lastName)} : ${st.history.length} saisons, ${tot.apps} matchs, ${tot.goals} buts.</p>
    <ul class="plain">${st.history.map((h) => `<li>${h.season} · ${esc(h.club)} ${esc(h.stage)} · ${h.apps} matchs, ${h.goals} buts</li>`).join('')}</ul>
    <div class="actions"><button class="primary" id="r-home">Accueil</button></div>
  </div>`);
  el.querySelector('#r-home').addEventListener('click', showHome);
}

export function initCareerUI() {
  setHomeHandler(showHome);
  // Retour Android / Échap sur un écran de carrière : revenir en arrière proprement
  window.addEventListener('keydown', (e) => {
    if (root().hidden || e.key !== 'Escape') return;
    e.stopImmediatePropagation();
    if (G.st) { persist(); showHome(); } else showHome();
  }, true);
}

export { SLOTS };
