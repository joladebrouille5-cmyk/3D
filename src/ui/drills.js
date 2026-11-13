// Ateliers de la semaine : mini-jeux d'une dizaine de secondes, un geste à réussir.
// Résultat : 'parfait', 'bien', 'rate' (ou null si l'atelier est passé).
import { icon } from './icons.js';
import { sound } from './sound.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c]));
const MSG = { parfait: 'Parfait ! Séance nettement plus profitable.', bien: 'Réussi : bonne séance.', rate: 'Raté : séance un peu moins profitable.' };

// Cadre commun : titre, consigne, zone de jeu, ligne de résultat, « Passer » et « Ne plus proposer »
export function runDrill(z, done, { onDisable } = {}) {
  const box = document.createElement('div');
  box.className = 'drill-backdrop';
  box.innerHTML = `<div class="drill drill-${z.kind}" role="dialog" aria-label="Atelier">
    <p class="dr-eyebrow">${icon('whistle', 16)} Atelier de la semaine</p>
    <h2>${esc(z.title)}</h2>
    <p class="muted">${esc(z.task)}</p>
    <div class="dr-stage" id="dr-stage"></div>
    <p class="dr-result" id="dr-result" aria-live="polite"></p>
    <div class="actions"><label class="inline small"><input type="checkbox" id="dr-off"> Ne plus proposer d'atelier</label><button class="ghost small" id="dr-skip">Passer</button></div>
  </div>`;
  document.body.append(box);
  const stage = box.querySelector('#dr-stage'), out = box.querySelector('#dr-result');
  let ended = false, cleanup = () => {};
  const say = (t) => { out.textContent = t; };
  const finish = (res, text) => {
    if (ended) return;
    ended = true;
    cleanup();
    if (res) { box.querySelector('.drill').classList.add(`res-${res}`); say(text ?? MSG[res]); if (res === 'parfait') sound.chime(); }
    if (box.querySelector('#dr-off').checked) onDisable?.();
    setTimeout(() => { box.remove(); done(res); }, res ? 1100 : 0);
  };
  box.querySelector('#dr-skip').addEventListener('click', () => finish(null));
  const game = GAMES[z.kind] ?? GAMES.curseur;
  cleanup = game(stage, z, { say, finish, isOver: () => ended }) ?? (() => {});
  return box;
}

// boucle d'animation arrêtable
function loop(fn) {
  let on = true, last = null;
  const step = (now) => { if (!on) return; const dt = Math.min(0.05, (now - (last ?? now)) / 1000); last = now; fn(dt, now); requestAnimationFrame(step); };
  requestAnimationFrame(step);
  return () => { on = false; };
}
// une touche de l'écran ou Espace / Entrée
function onTap(el, fn) {
  const key = (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); fn(); } };
  const ptr = (e) => { e.preventDefault(); fn(); };
  el.addEventListener('pointerdown', ptr);
  document.addEventListener('keydown', key);
  return () => { el.removeEventListener('pointerdown', ptr); document.removeEventListener('keydown', key); };
}

const GAMES = {
  // curseur : arrête-le dans la zone (au centre doré : parfait) ; il accélère à chaque aller-retour
  curseur(stage, z, { say, finish }) {
    const c = z.center ?? 0.5;
    stage.innerHTML = `<div class="dr-track"><i class="dr-zone" style="left:${(c - z.width / 2) * 100}%;width:${z.width * 100}%"></i><i class="dr-perfect" style="left:${(c - z.perfect / 2) * 100}%;width:${z.perfect * 100}%"></i><b class="dr-cursor"></b></div>`;
    say('Touche l\'écran (ou Espace) au bon moment.');
    const cur = stage.querySelector('.dr-cursor');
    let x = 0, dir = 1, v = 0.95 * z.speed;
    const stop = loop((dt) => {
      x += dir * dt * v;
      if (x > 1) { x = 1; dir = -1; v *= z.accel ?? 1; } else if (x < 0) { x = 0; dir = 1; v *= z.accel ?? 1; }
      cur.style.left = `${x * 100}%`;
    });
    const off = onTap(stage, () => {
      const d = Math.abs(x - c);
      finish(d <= z.perfect / 2 ? 'parfait' : d <= z.width / 2 ? 'bien' : 'rate');
    });
    return () => { stop(); off(); };
  },

  // jongles : le ballon descend vers le pied ; touche quand il est dans la zone, quatre fois, de plus en plus vite
  jongles(stage, z, { say, finish }) {
    stage.innerHTML = `<div class="dr-juggle"><i class="dj-zone" style="height:${z.width * 100}%"></i><b class="dj-ball"></b><span class="dj-count">0 / ${z.count}</span></div>`;
    say('Touche quand le ballon arrive dans la zone verte.');
    const ball = stage.querySelector('.dj-ball'), cnt = stage.querySelector('.dj-count');
    let y = 0, v = 0.9 * z.speed, hits = 0, clean = 0, falling = true;
    const stop = loop((dt) => {
      if (!falling) return;
      y += dt * v;
      ball.style.top = `${Math.min(1, y) * 92}%`;
      if (y > 1.02) { falling = false; finish(hits >= z.count - 1 ? 'bien' : 'rate', hits ? `Ballon tombé après ${hits} jongle${hits > 1 ? 's' : ''}.` : 'Ballon tombé.'); }
    });
    const off = onTap(stage, () => {
      if (!falling) return;
      const inZone = y >= 1 - z.width && y <= 1.02;
      if (!inZone) { falling = false; finish(hits >= z.count - 1 ? 'bien' : 'rate', `Touché trop tôt après ${hits} jongle${hits > 1 ? 's' : ''}.`); return; }
      hits++; if (y >= 1 - z.width * 0.45) clean++;
      cnt.textContent = `${hits} / ${z.count}`;
      if (hits >= z.count) { falling = false; finish(clean >= z.count - 1 ? 'parfait' : 'bien', clean >= z.count - 1 ? 'Parfait : quatre jongles propres !' : 'Réussi : quatre jongles.'); return; }
      y = 0; v *= z.accel;
    });
    return () => { stop(); off(); };
  },

  // réaction : attendre le vert, puis toucher vite ; trop tôt = faux départ
  reaction(stage, z, { say, finish }) {
    stage.innerHTML = '<div class="dr-light wait"><span>Prêt…</span></div>';
    const light = stage.querySelector('.dr-light');
    say('Ne bouge pas avant le signal.');
    let goAt = null;
    const t = setTimeout(() => { goAt = performance.now(); light.className = 'dr-light go'; light.innerHTML = '<span>GO !</span>'; sound.chime?.(); }, 1200 + Math.random() * 2300);
    const late = setTimeout(() => { if (goAt) finish('rate', 'Trop tard : le coach a déjà sifflé la fin.'); }, 6000);
    const off = onTap(stage, () => {
      if (goAt == null) { clearTimeout(t); finish('rate', 'Faux départ !'); return; }
      const ms = Math.round(performance.now() - goAt);
      finish(ms <= z.perfectMs ? 'parfait' : ms <= z.goodMs ? 'bien' : 'rate', `${ms} ms. ${ms <= z.perfectMs ? 'Fulgurant !' : ms <= z.goodMs ? 'Bon départ.' : 'Trop lent.'}`);
    });
    return () => { clearTimeout(t); clearTimeout(late); off(); };
  },

  // mémoire : retenir un enchaînement de passes (flèches), puis le refaire
  memoire(stage, z, { say, finish, isOver }) {
    const DIRS = [['up', '↑'], ['right', '→'], ['down', '↓'], ['left', '←']];
    const seq = Array.from({ length: z.length }, () => Math.floor(Math.random() * 4));
    stage.innerHTML = `<div class="dr-memo"><div class="dm-show" aria-live="polite"></div><div class="dm-pad">${DIRS.map(([id, a], i) => `<button class="dm-key" data-k="${i}" aria-label="${id}" disabled>${a}</button>`).join('')}</div><div class="dm-progress"></div></div>`;
    const show = stage.querySelector('.dm-show'), keys = [...stage.querySelectorAll('.dm-key')], prog = stage.querySelector('.dm-progress');
    say('Regarde bien…');
    const timers = [];
    seq.forEach((k, i) => {
      timers.push(setTimeout(() => { show.textContent = DIRS[k][1]; show.classList.add('on'); }, 400 + i * z.showMs));
      timers.push(setTimeout(() => { show.textContent = ''; show.classList.remove('on'); }, 400 + i * z.showMs + z.showMs * 0.7));
    });
    let pos = 0, t0 = 0;
    timers.push(setTimeout(() => { if (isOver()) return; keys.forEach((b) => { b.disabled = false; }); show.textContent = 'À toi !'; say('Refais l\'enchaînement dans l\'ordre.'); t0 = performance.now(); }, 400 + seq.length * z.showMs));
    const press = (k) => {
      if (keys[0].disabled || isOver()) return;
      if (k !== seq[pos]) { finish('rate', `Mauvaise passe à la ${pos + 1}e touche.`); return; }
      pos++; prog.textContent = '●'.repeat(pos) + '○'.repeat(seq.length - pos);
      if (pos === seq.length) { const ms = performance.now() - t0; finish(ms <= z.fastMs ? 'parfait' : 'bien', ms <= z.fastMs ? 'Parfait : enchaînement juste et rapide.' : 'Juste, mais un peu lent.'); }
    };
    keys.forEach((b) => b.addEventListener('click', () => press(Number(b.dataset.k))));
    const key = (e) => { const m = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3 }[e.key]; if (m != null) { e.preventDefault(); press(m); } };
    document.addEventListener('keydown', key);
    return () => { timers.forEach(clearTimeout); document.removeEventListener('keydown', key); };
  },

  // tir au but : la mire suit une trajectoire en huit devant le but ; déclencher dans la cible
  penalty(stage, z, { say, finish }) {
    const tx = Math.random() < 0.5 ? 0.15 : 0.85, ty = Math.random() < 0.6 ? 0.25 : 0.7; // lucarne ou petit filet
    stage.innerHTML = `<div class="dr-goal"><i class="dg-target" style="left:${(tx - z.target / 2) * 100}%;top:${(ty - z.target * 0.9) * 100}%;width:${z.target * 100}%;height:${z.target * 180}%"></i><i class="dg-keeper"></i><b class="dg-aim"></b></div>`;
    say('Touche quand la mire est dans la cible.');
    const aim = stage.querySelector('.dg-aim');
    let t = Math.random() * 6, x = 0.5, y = 0.5;
    const stop = loop((dt) => {
      t += dt * 2.2 * z.speed;
      x = 0.5 + 0.44 * Math.sin(t); y = 0.5 + 0.38 * Math.sin(t * 1.7 + 0.6);
      aim.style.left = `${x * 100}%`; aim.style.top = `${y * 100}%`;
    });
    const off = onTap(stage, () => {
      const dx = Math.abs(x - tx) / (z.target / 2), dy = Math.abs(y - ty) / (z.target * 0.9);
      const d = Math.max(dx, dy);
      finish(d <= 0.5 ? 'parfait' : d <= 1 ? 'bien' : 'rate', d <= 0.5 ? 'En pleine lucarne !' : d <= 1 ? 'But, bien placé.' : x < 0.04 || x > 0.96 || y < 0.04 ? 'À côté !' : 'Arrêté par le gardien.');
    });
    return () => { stop(); off(); };
  },

  // lecture du dribble (défense) et plongeon (gardien) : trois duels, un côté à deviner après une feinte
  lecture(stage, z, ctx) { return duels(stage, z, ctx, ['Gauche', 'Droite'], 'L\'attaquant'); },
  plongeon(stage, z, ctx) { return duels(stage, z, ctx, ['Gauche', 'Centre', 'Droite'], 'Le tireur'); },
};

function duels(stage, z, { say, finish, isOver }, sides, who) {
  stage.innerHTML = `<div class="dr-duel"><div class="dd-cue" aria-live="polite">…</div><div class="dd-pad">${sides.map((s, i) => `<button class="dd-key" data-k="${i}" disabled>${s}</button>`).join('')}</div><div class="dd-score"></div></div>`;
  const cue = stage.querySelector('.dd-cue'), keys = [...stage.querySelectorAll('.dd-key')], score = stage.querySelector('.dd-score');
  const ARROW = sides.length === 3 ? ['⬅', '⬆', '➡'] : ['⬅', '➡'];
  let round = 0, good = 0, fast = 0, open = false, real = 0, shownAt = 0;
  const timers = [];
  const next = () => {
    if (isOver()) return;
    if (round >= z.rounds) { finish(good === z.rounds ? (fast >= 2 ? 'parfait' : 'bien') : good >= z.rounds - 1 ? 'bien' : 'rate', `${good} duel${good > 1 ? 's' : ''} gagné${good > 1 ? 's' : ''} sur ${z.rounds}.`); return; }
    round++;
    // feinte (souvent l'inverse du vrai côté), puis le vrai départ
    real = Math.floor(Math.random() * sides.length);
    const feint = (real + 1 + Math.floor(Math.random() * (sides.length - 1))) % sides.length;
    cue.className = 'dd-cue'; cue.textContent = `${who} s'élance…`;
    timers.push(setTimeout(() => { cue.textContent = `Feinte ${ARROW[feint]}`; cue.className = 'dd-cue feint'; }, 600));
    timers.push(setTimeout(() => {
      cue.textContent = ARROW[real]; cue.className = 'dd-cue real'; open = true; shownAt = performance.now();
      keys.forEach((b) => { b.disabled = false; });
      timers.push(setTimeout(() => { if (open) resolve(-1); }, z.windowMs));
    }, 1050 + Math.random() * 500));
  };
  const resolve = (k) => {
    open = false; keys.forEach((b) => { b.disabled = true; });
    const ok = k === real;
    if (ok) { good++; if (performance.now() - shownAt < z.windowMs * 0.55) fast++; }
    score.textContent += ok ? '✓ ' : '✗ ';
    say(ok ? 'Bien lu !' : k < 0 ? 'Trop tard…' : 'Mauvais côté.');
    timers.push(setTimeout(next, 700));
  };
  keys.forEach((b) => b.addEventListener('click', () => { if (open) resolve(Number(b.dataset.k)); }));
  const key = (e) => { if (!open) return; const m = sides.length === 3 ? { ArrowLeft: 0, ArrowUp: 1, ArrowRight: 2 }[e.key] : { ArrowLeft: 0, ArrowRight: 1 }[e.key]; if (m != null) { e.preventDefault(); resolve(m); } };
  document.addEventListener('keydown', key);
  say('Attends la vraie direction, pas la feinte.');
  timers.push(setTimeout(next, 300));
  return () => { timers.forEach(clearTimeout); document.removeEventListener('keydown', key); };
}
