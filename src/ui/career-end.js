// Écrans de fin de saison, d'argent, de palmarès et d'après-carrière (découpés de career-ui.js).
import * as C from '../career/career.js';
import { STAGE_LABEL, academyStars, clubById, divisionName } from '../career/clubs.js';
import { avatar } from './faces.js';
import { icon } from './icons.js';
import { G, clubVars, crest, esc, flash, persist, renderHub, show, showHome, stars } from './career-ui.js';

// ------------------------------------------------------------------ fin de saison
export function honoursBlock(h) {
  const list = [...(h?.trophies ?? []), ...(h?.awards ?? [])];
  if (!list.length) return '';
  return `<div class="honours">${list.map((t) => `<span class="honour ${t.kind}">${icon(t.kind === 'award' || t.kind === 'ballon-rank' ? 'star' : 'trophy', 18)}${esc(t.name)}</span>`).join('')}</div>`;
}

// Palmarès : vitrine, totaux, records, sélections, saison par saison

// objectifs de la saison : progression (tableau de bord) ou bilan (fin de saison)
export function objectivesBlock(st) {
  const list = st.objectives ?? [];
  if (!list.length) return '';
  return `<div class="objectives"><h3>${icon('target', 16)} Objectifs du club</h3><ul>${list.map((o) => {
    const pr = C.objectiveProgress(st, o);
    const val = o.kind === 'rating' ? (pr.value ? pr.value.toFixed(1).replace('.', ',') : '—') : o.kind === 'school' ? Math.round(pr.value * 100) : o.kind === 'rank' ? (pr.value ? `${pr.value}e` : '—') : pr.value;
    return `<li class="${pr.done ? 'done' : ''}"><span>${esc(o.label)}</span><span class="obj-bar"><i style="width:${Math.round(pr.ratio * 100)}%"></i></span><b>${val}</b></li>`;
  }).join('')}</ul></div>`;
}

// ------------------------------------------------------------------ après-carrière : entraîneur
export function renderCoach() {
  const st = G.st, c = st.coach;
  const club = c.clubId ? clubById(c.clubId) : null;
  const last = c.seasons.at(-1);
  G.coachChoice ??= { style: 'equilibre', prio: 'mixte' };
  const ch = G.coachChoice;
  const offers = (c.offers ?? []).map((id) => clubById(id)).filter(Boolean);
  const el = show(`<div class="panel-screen narrow coach" style="${club ? clubVars(club) : ''}">
    <header class="screen-head"><button class="icon-btn" id="co-back" aria-label="Retour">${icon('back', 20)}</button><div><h1>${club ? `Entraîneur · ${esc(club.name)}` : 'Entraîneur sans club'}</h1><p class="muted">Saison ${st.season}-${st.season + 1} · ${st.player.age} ans${club ? ` · ${esc(C.divisionName(club))}` : ''}</p></div></header>
    <div class="mo-kpis"><div><span>Talent</span><b>${C.pct(c.skill)}</b></div><div><span>Réputation</span><b>${C.pct(c.rep)}</b></div><div><span>Saisons</span><b>${c.seasons.length}</b></div><div><span>Titres</span><b>${c.trophies.length}</b></div></div>
    ${last ? `<p class="note">${esc(last.season)}-${last.season + 1} · ${esc(last.club)} : <b>${last.pos}e sur ${last.teams}</b> (attendu ${last.expected}e), ${last.pts} pts${last.move ? ` · <b>${last.move === 'promu' ? 'promu' : 'relégué'}</b> en ${esc(last.division)}` : ''}${last.fired ? ' · <b>limogé</b>' : ''}.</p>
      ${c.table ? `<details><summary>Classement</summary><table class="table">${c.table.map((t, i) => `<tr class="${t.id === (last.fired ? null : c.clubId) || t.name === last.club ? 'me' : ''}"><td class="rk">${i + 1}</td><td class="tn">${crest(clubById(t.id), 18)}${esc(t.name)}</td><td><strong>${t.pts}</strong></td><td>${t.diff > 0 ? '+' : ''}${t.diff}</td></tr>`).join('')}</table></details>` : ''}` : ''}
    ${club ? `<h2>La saison qui vient</h2>
      <p class="muted">Style de jeu</p><div class="row seg">${Object.entries(C.COACH_STYLES).map(([k, v]) => `<button data-style="${k}" class="${ch.style === k ? 'active' : ''}" title="${esc(v.desc)}">${esc(v.label)}</button>`).join('')}</div>
      <p class="muted">Priorité</p><div class="row seg">${Object.entries(C.COACH_PRIORITIES).map(([k, v]) => `<button data-prio="${k}" class="${ch.prio === k ? 'active' : ''}" title="${esc(v.desc)}">${esc(v.label)}</button>`).join('')}</div>
      <p class="small muted">${esc(C.COACH_STYLES[ch.style].desc)} ${esc(C.COACH_PRIORITIES[ch.prio].desc)}</p>
      <div class="actions"><button class="primary" id="co-play">${icon('play', 18)} Jouer la saison</button></div>` : ''}
    ${offers.length ? `<h2>${club ? 'D\'autres clubs te veulent' : 'Clubs intéressés'}</h2><ul class="offers">${offers.map((o) => `<li style="${clubVars(o)}">${crest(o, 34)}<span class="of-main"><strong>${esc(o.name)}</strong><br><span class="muted">${esc(C.divisionName(o))}</span></span><button data-job="${o.id}" class="${club ? '' : 'primary'}">${club ? 'Partir' : 'Accepter'}</button></li>`).join('')}</ul>` : ''}
    ${c.trophies.length ? `<div class="honours">${c.trophies.map((t) => `<span class="honour">${icon('trophy', 18)}${esc(t.name)} (${t.season})</span>`).join('')}</div>` : ''}
  </div>`);
  el.querySelector('#co-back').addEventListener('click', () => { st.phase = 'retired'; persist(); renderRetired(); });
  el.querySelectorAll('[data-style]').forEach((b) => b.addEventListener('click', () => { ch.style = b.dataset.style; renderCoach(); }));
  el.querySelectorAll('[data-prio]').forEach((b) => b.addEventListener('click', () => { ch.prio = b.dataset.prio; renderCoach(); }));
  el.querySelector('#co-play')?.addEventListener('click', () => { C.playCoachSeason(st, ch.style, ch.prio); persist(); renderCoach(); });
  el.querySelectorAll('[data-job]').forEach((b) => b.addEventListener('click', () => { C.takeCoachJob(st, b.dataset.job); persist(); renderCoach(); }));
}

// ------------------------------------------------------------------ changement de poste
export function showRoleChange() {
  const st = G.st, p = st.player;
  const cur = C.currentCA(st);
  const rows = C.roleLevels(st).filter((r) => r.role !== p.role && (r.role === 'GK') === (p.role === 'GK')).sort((a, b) => b.ca - a.ca);
  const back = document.createElement('div');
  back.className = 'dialog-back';
  back.innerHTML = `<div class="dialog role-dialog" role="dialog" aria-modal="true" aria-label="Changer de poste">
    <p><b>Changer de poste</b> (une fois par saison, six semaines d'adaptation). Ton niveau à chaque poste, avec tes qualités actuelles :</p>
    <ul class="role-list">${rows.map((r) => `<li><button data-role="${r.role}"><span>${esc(r.label)}</span><b class="${r.ca >= cur ? 'up' : 'down'}">${C.pct(r.ca)}</b><small>${r.ca >= cur ? '+' : ''}${Math.round((r.ca - cur) * 100)}</small></button></li>`).join('')}</ul>
    <div class="actions"><button id="dlg-no">Annuler</button></div></div>`;
  document.body.append(back);
  const close = () => back.remove();
  back.querySelector('#dlg-no').addEventListener('click', close);
  back.addEventListener('click', (e) => { if (e.target === back) close(); });
  back.querySelectorAll('[data-role]').forEach((b) => b.addEventListener('click', () => {
    try { flash(C.changeRole(st, b.dataset.role)); persist(); } catch (e) { flash(e.message); }
    close(); renderHub();
  }));
}

// ------------------------------------------------------------------ ton argent
export function renderMoney(back) {
  const st = G.st;
  const p = st.player;
  const club = clubById(st.clubId);
  const len = st.league.rounds.length;
  const rent = C.passiveIncome(p);
  const income = (p.contract?.salary ?? 0) + rent;
  const cost = C.monthlyCost(p);
  const services = C.servicesFor(st).map(([id, sv]) => {
    const on = !!p.services?.[id];
    return `<li class="${on ? 'on' : ''}"><span class="mi">${icon(sv.icon, 22)}</span><span class="mt"><b>${esc(sv.label)}</b><small>${esc(sv.desc)}</small></span><span class="mp">${C.money(sv.monthly)}<small>/mois</small></span><button data-svc="${id}" class="${on ? 'ghost' : 'primary'} small">${on ? 'Arrêter' : 'Engager'}</button></li>`;
  }).join('');
  const purchases = C.purchasesFor(st).map(([id, it]) => {
    const c = C.canBuy(st, id);
    const done = C.boughtState(st, id);
    const count = it.max && p.bought?.[id] ? ` <small class="muted">(${p.bought[id]}/${it.max})</small>` : '';
    return `<li class="${done ? 'done' : ''}"><span class="mi">${icon(it.icon, 22)}</span><span class="mt"><b>${esc(it.label)}${count}</b><small>${esc(it.desc)}</small></span><span class="mp">${C.money(it.cost)}</span><button data-buy="${id}" class="small" ${c.ok ? '' : 'disabled'} title="${esc(c.ok ? '' : c.why)}">${done ? (it.once ? 'Acheté' : it.max ? 'Complet' : 'Fait') : 'Acheter'}</button></li>`;
  }).join('');
  const el = show(`<div class="panel-screen money" style="${clubVars(club)}">
    <header class="screen-head"><button class="icon-btn" id="mo-back" aria-label="Retour">${icon('back', 20)}</button><div><h1>Ton argent</h1><p class="muted">${esc(p.firstName)} ${esc(p.lastName)} · ${esc(C.CONTRACT_LABEL[p.contract?.type] ?? 'Contrat')}</p></div></header>
    <div class="mo-kpis"><div><span>Économies</span><b>${C.money(p.money)}</b></div><div><span>${rent ? 'Salaire + loyers' : 'Salaire'}</span><b>${C.money(income)}<small>/mois</small></b></div><div><span>Entourage</span><b>${C.money(cost)}<small>/mois</small></b></div><div><span>Reste chaque mois</span><b class="${income - cost >= 0 ? 'up' : 'down'}">${C.money(income - cost)}</b></div></div>
    <div class="mo-cols">
      <section class="card"><h3>${icon('squad', 16)} Ton entourage <small class="muted">prélevé chaque semaine (${len} semaines par saison)</small></h3><ul class="mo-list">${services}</ul></section>
      <section class="card"><h3>${icon('star', 16)} Achats</h3><ul class="mo-list">${purchases}</ul></section>
    </div>
    <p class="muted small">Sans économies, les abonnements s'arrêtent d'eux-mêmes. Les effets apparaissent dans le bilan du mois (« Ton entourage et tes achats »).</p>
  </div>`);
  el.querySelector('#mo-back').addEventListener('click', back);
  el.querySelectorAll('[data-svc]').forEach((b) => b.addEventListener('click', () => {
    const msg = C.toggleService(st, b.dataset.svc);
    persist();
    if (msg) flash(msg);
    renderMoney(back);
  }));
  el.querySelectorAll('[data-buy]').forEach((b) => b.addEventListener('click', () => {
    try { const out = C.buy(st, b.dataset.buy); persist(); flash(out); } catch (e) { flash(e.message); }
    renderMoney(back);
  }));
}

export function renderPalmares(back) {
  const st = G.st;
  const p = st.player;
  const rec = C.careerRecord(st);
  const T = rec.totals;
  const club = clubById(st.clubId);
  const cabinet = [...rec.trophies.map((t) => ({ ...t, big: true })), ...rec.awards.filter((a) => a.kind !== 'award' || /Joueur de la saison|Meilleur buteur/.test(a.name))];
  const others = rec.awards.filter((a) => !cabinet.includes(a));
  const caps = Object.entries(rec.intl.caps ?? {});
  const seasonLabel = (y) => `${y}-${String(y + 1).slice(2)}`;
  const el = show(`<div class="panel-screen palmares" style="${clubVars(club)}">
    <header class="screen-head"><button class="icon-btn" id="pm-back" aria-label="Retour">${icon('back', 20)}</button>
      ${p.face != null ? avatar({ face: p.face }, 56, 'se-face') : ''}<div><h1>Palmarès</h1><p class="muted">${esc(p.firstName)} ${esc(p.lastName)} · ${p.age} ans · ${esc(club.name)}</p></div></header>
    <div class="pm-totals">
      <div><b>${T.apps}</b><span>matchs</span></div><div><b>${T.goals}</b><span>buts</span></div><div><b>${T.assists}</b><span>passes déc.</span></div>
      <div><b>${T.rating ? T.rating.toFixed(2).replace('.', ',') : '—'}</b><span>note moyenne</span></div><div><b>${caps.reduce((a, [, v]) => a + v, 0)}</b><span>sélections</span></div><div><b>${C.pct(rec.records.peak)}</b><span>niveau max.</span></div>
    </div>
    <h2>${icon('trophy', 18)} Vitrine</h2>
    ${cabinet.length ? `<div class="cabinet">${cabinet.map((t) => `<div class="trophy ${t.kind}">${icon(t.kind === 'award' ? 'star' : 'trophy', 34)}<b>${esc(t.name)}</b><span>${seasonLabel(t.season)} · ${esc(t.club ?? '')}</span></div>`).join('')}</div>` : '<p class="muted">Ta vitrine est vide pour l\'instant. Un titre, une coupe, une distinction : tout viendra s\'afficher ici.</p>'}
    ${others.length ? `<h2>${icon('star', 18)} Distinctions</h2><ul class="plain">${others.map((a) => `<li><span class="muted">${seasonLabel(a.season)}</span> · ${esc(a.name)}</li>`).join('')}</ul>` : ''}
    <h2>${icon('chart', 18)} Records</h2>
    <ul class="plain">
      <li>Meilleure saison au but : ${rec.records.goals ? `<b>${rec.records.goals.goals} buts</b> (${seasonLabel(rec.records.goals.season)}, ${esc(rec.records.goals.club)})` : '—'}</li>
      <li>Meilleur passeur : ${rec.records.assists && rec.records.assists.assists ? `<b>${rec.records.assists.assists} passes décisives</b> (${seasonLabel(rec.records.assists.season)})` : '—'}</li>
      <li>Meilleure note sur une saison : ${rec.records.rating ? `<b>${rec.records.rating.rating.toFixed(2).replace('.', ',')}</b> (${seasonLabel(rec.records.rating.season)}, ${esc(rec.records.rating.club)})` : '—'}</li>
      ${rec.ballonDor.length ? `<li>Ballon d'or : ${rec.ballonDor.map((b) => `${b.rank === 1 ? '<b>lauréat</b>' : `${b.rank}e`} en ${seasonLabel(b.season)}`).join(', ')}</li>` : ''}
    </ul>
    <h2>${icon('star', 18)} Sélections · ${esc(C.nationality(st.player.nation).name)}</h2>
    ${caps.length ? `<p>${caps.map(([k, v]) => `${k === 'A' ? `<b>${esc(C.nationality(st.player.nation).name)} A</b>` : k === 'U21' ? 'Espoirs' : k} : <b>${v}</b>`).join(' · ')} · ${rec.intl.goals} but(s)</p>` : '<p class="muted">Pas encore de sélection.</p>'}
    <h2>${icon('calendar', 18)} Saison par saison</h2>
    ${st.history.length ? `<table class="table"><tr><th>Saison</th><th>Club</th><th>M</th><th>B</th><th>PD</th><th>Note</th><th>Rang</th></tr>${st.history.map((h) => `<tr><td>${seasonLabel(h.season)}${h.partial ? ' (1)' : ''}</td><td>${esc(h.club)} <span class="muted">${esc(h.stage)}</span></td><td>${h.apps}</td><td>${h.goals}</td><td>${h.assists ?? 0}</td><td>${h.rating ? h.rating.toFixed(1) : '—'}</td><td>${h.pos}/${h.teams}</td></tr>`).join('')}</table>` : '<p class="muted">Première saison en cours.</p>'}
  </div>`);
  el.querySelector('#pm-back').addEventListener('click', back);
}

export function renderSeasonEnd() {
  const st = G.st;
  const h = st.history[st.history.length - 1];
  const el = show(`<div class="panel-screen narrow season-end" style="${clubVars(clubById(st.clubId))}">
    <header class="se-head">${st.player.face != null ? avatar({ face: st.player.face }, 72, 'se-face') : ''}
      <div><p class="muted">${icon('trophy', 18)} Bilan de la saison</p><h1>Fin de saison ${h.season}-${h.season + 1}</h1></div></header>
    <p>${esc(h.club)} ${esc(h.stage)} · ${esc(h.league)} : <strong>${h.pos}e sur ${h.teams}</strong></p>
    <p>${h.apps} matchs (${h.starts} titularisations), ${h.goals} but(s), ${h.minutes} minutes${h.rating ? `, note moyenne ${h.rating.toFixed(1)}` : ''}.</p>
    <p>Niveau : ${C.pct(h.caStart)} → <strong>${C.pct(h.caEnd)}</strong> · Potentiel estimé : ${stars(C.toStars(C.potentialEstimate(st).center))}</p>
    ${h.move ? `<p class="note move-${h.move === 'promu' ? 'up' : 'down'}">${icon(h.move === 'promu' ? 'trophy' : 'injury', 18)} <b>${esc(h.club)} ${h.move === 'promu' ? 'monte' : 'descend'}</b> : la saison prochaine en ${esc(C.divisionName(clubById(st.clubId)))}.</p>` : ''}
    ${st.seasonMoves && (st.seasonMoves.up.length || st.seasonMoves.down.length) ? `<details class="moves"><summary>Montées et descentes (${st.seasonMoves.up.length + st.seasonMoves.down.length} clubs)</summary>
      <p><b>Montent</b> : ${st.seasonMoves.up.map((id) => `${esc(clubById(id).name)} <span class="muted">(${esc(C.divisionName(clubById(id)))})</span>`).join(', ')}</p>
      <p><b>Descendent</b> : ${st.seasonMoves.down.map((id) => `${esc(clubById(id).name)} <span class="muted">(${esc(C.divisionName(clubById(id)))})</span>`).join(', ')}</p></details>` : ''}
    ${h.objectives?.length ? `<ul class="obj-result">${h.objectives.map((o) => `<li class="${o.done ? 'ok' : 'ko'}">${o.done ? '✓' : '✗'} ${esc(o.label)} <span class="muted">· ${esc(o.effect)}</span></li>`).join('')}</ul>` : ''}
    ${honoursBlock(st.seasonHonours)}
    <h2>Pour la saison prochaine (${st.player.age} ans)</h2>
    <ul class="offers">${st.offers.map((o, i) => o.retire ? `<li><span>${esc(o.kind)}</span><button data-offer="${i}">Choisir</button></li>` : `<li style="${clubVars(clubById(o.clubId))}">
      ${crest(clubById(o.clubId), 40)}<span class="of-main"><strong>${esc(clubById(o.clubId).name)}</strong> — ${esc(STAGE_LABEL[o.stage])}<br><span class="muted">${esc(o.kind)} · ${esc(C.divisionName(clubById(o.clubId)))}${o.stage === 'U17' || o.stage === 'U19' ? ` · centre ${stars(academyStars(clubById(o.clubId)))}` : ''}</span>
        ${o.contract ? `<span class="of-terms">${esc(C.CONTRACT_LABEL[o.contract.type])} · <b>${C.money(o.contract.salary)}</b>/mois · ${o.contract.years} an${o.contract.years > 1 ? 's' : ''}${o.negotiated ? ' · négocié' : ''}${o.contract.clause ? `<br><small>Primes ${C.money(o.contract.goalBonus)}/but, ${C.money(o.contract.winBonus)}/victoire · clause ${C.money(o.contract.clause)}</small>` : ''}</span>` : o.loan ? '<span class="of-terms">Prêt : ton contrat actuel continue</span>' : o.keep ? '<span class="of-terms">Tu gardes ton contrat actuel</span>' : ''}</span>
      <span class="row">${o.withdrawn ? '<span class="error">Offre retirée</span>' : `${st.player.agent && o.contract && !o.negotiated ? `<button class="ghost" data-neg="${i}">${icon('chat', 16)} Négocier</button>` : ''}<button class="${o.own ? 'primary' : ''}" data-offer="${i}">Accepter</button>`}</span></li>`).join('')}</ul>
    ${G.negMsg ? `<p class="note">${esc(G.negMsg)}</p>` : ''}
    ${st.offers.some((o) => o.own) ? '' : '<p class="note">Ton club ne te conserve pas. L\'échec ouvre d\'autres chemins : choisis où rebondir.</p>'}
  </div>`);
  el.querySelectorAll('[data-offer]').forEach((b) => b.addEventListener('click', () => { G.negMsg = null; C.acceptOffer(st, Number(b.dataset.offer)); persist(); renderHub(); }));
  el.querySelectorAll('[data-neg]').forEach((b) => b.addEventListener('click', () => { G.negMsg = C.negotiateOffer(st, Number(b.dataset.neg)).text; persist(); renderSeasonEnd(); }));
}

export function renderRetired() {
  const st = G.st;
  const p = st.player;
  const tot = st.history.reduce((a, h) => ({ apps: a.apps + h.apps, goals: a.goals + h.goals }), { apps: 0, goals: 0 });
  const titles = (st.trophies ?? []).length, awards = (st.awards ?? []).length;
  const rent = C.passiveIncome(p);
  const legacy = st.legacy ?? [];
  // l'après-carrière : ce que tes choix (et ton argent) ont construit
  const after = legacy.find((l) => l.id === 'actionnaire') ? `Tu retrouves ${esc(st.formativeName ?? 'ton club formateur')}, cette fois dans le bureau des actionnaires.`
    : legacy.find((l) => l.id === 'academie') ? 'Tu te consacres à ton académie : la prochaine génération porte ton nom.'
    : legacy.find((l) => l.id === 'fondation') ? 'Ta fondation devient ton nouveau terrain de jeu.'
    : p.money > 5000 ? 'Consultant télé, quelques matchs de gala : ta reconversion est tranquille.'
    : p.money > 500 ? 'Tu passes tes diplômes d\'entraîneur pour transmettre ce que tu as appris.'
    : 'Il va falloir trouver un travail : le football ne t\'a pas mis à l\'abri.';
  const el = show(`<div class="panel-screen narrow retired">
    <h1>Fin de carrière</h1>
    <p>${esc(p.firstName)} ${esc(p.lastName)} : ${st.history.length} saisons, ${tot.apps} matchs, ${tot.goals} buts${titles ? `, ${titles} titre${titles > 1 ? 's' : ''}` : ''}${awards ? `, ${awards} distinction${awards > 1 ? 's' : ''}` : ''}.</p>
    <div class="mo-kpis"><div><span>Patrimoine</span><b>${C.money(p.money)}</b></div><div><span>Loyers</span><b>${C.money(rent)}<small>/mois</small></b></div><div><span>Héritage</span><b>${legacy.length || '—'}</b></div></div>
    ${legacy.length ? `<div class="honours">${legacy.map((l) => `<span class="honour legacy">${icon('stadium', 18)}${esc(l.name)}</span>`).join('')}</div>` : ''}
    <p><b>Et maintenant ?</b> ${after}</p>
    <ul class="plain">${st.history.map((h) => `<li>${h.season} · ${esc(h.club)} ${esc(h.stage)} · ${h.apps} matchs, ${h.goals} buts</li>`).join('')}</ul>
    ${st.after ? `<p class="note">${esc(st.after)}</p>` : `<h2>Ta reconversion</h2>
    <div class="row after-row"><button class="primary" id="r-coach">${icon('whistle', 18)} Devenir entraîneur</button><button id="r-tv">${icon('chat', 18)} Consultant à la télé</button><button id="r-rest">${icon('repos', 18)} Profiter de la retraite</button></div>`}
    ${st.coach ? `<p><button id="r-coach2">${icon('whistle', 18)} Reprendre ta carrière d'entraîneur</button></p>` : ''}
    <div class="actions"><button id="r-palm">${icon('trophy', 18)} Palmarès</button><button class="primary" id="r-home">Accueil</button></div>
  </div>`);
  const afterChoice = (text, money = 0) => { st.after = text; st.player.money += money; persist(); renderRetired(); };
  el.querySelector('#r-coach')?.addEventListener('click', () => { C.startCoaching(st); persist(); renderCoach(); });
  el.querySelector('#r-coach2')?.addEventListener('click', () => { st.phase = 'coach'; persist(); renderCoach(); });
  el.querySelector('#r-tv')?.addEventListener('click', () => afterChoice(`Consultant sur une grande chaîne : tes analyses font mouche. ${(st.trophies ?? []).length >= 3 ? 'Ton palmarès t\'ouvre les plateaux du dimanche soir.' : 'Tu te fais un nom à l\'antenne.'}`, 600));
  el.querySelector('#r-rest')?.addEventListener('click', () => afterChoice('Tu profites de ta famille, loin des terrains. Les supporters ne t\'oublient pas.'));
  el.querySelector('#r-home').addEventListener('click', showHome);
  el.querySelector('#r-palm').addEventListener('click', () => renderPalmares(renderRetired));
}
