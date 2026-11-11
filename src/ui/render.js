// Rendu 2D du terrain, de nuit sous quatre projecteurs. Lecture seule : ne modifie jamais
// l'état du moteur. L'interpolation lisse l'affichage entre deux pas, sans être réinjectée.

import { PITCH } from '../engine/config.js';

const MARGIN = 4; // mètres autour du terrain visibles à zoom 1 (bornes de la caméra)
const APRON = 3.2; // pelouse au-delà des lignes
const BOARD = 0.75; // épaisseur des panneaux
const L = PITCH.length, W = PITCH.width;
// projecteurs (coins du stade) : chaque joueur porte quatre ombres croisées
const LIGHTS = [[-14, -12], [L + 14, -12], [-14, W + 12], [L + 14, W + 12]];
const DISPLAY = '"Big Shoulders Display", "Archivo", system-ui, sans-serif';
const TEXT = '"Archivo", system-ui, sans-serif';

// ------------------------------------------------------------------ couleurs
function rgb(hex) {
  const h = String(hex || '#888').replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const mix = (a, b, t) => { const A = rgb(a), B = rgb(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`; };
const alpha = (hex, a) => `rgba(${rgb(hex).join(',')},${a})`;
const lum = (hex) => { const [r, g, b] = rgb(hex); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };

// petite graine déterministe pour les textures
function noiseRand(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

function makeCanvas(w, h) {
  const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
  return c;
}

export class PitchRenderer {
  constructor(canvas, { maxDpr = 2.5 } = {}) {
    this.canvas = canvas;
    this.maxDpr = maxDpr;
    this.ctx = canvas.getContext('2d');
    this.mirror = false; // affichage seulement : le sens réel de l'attaque est toujours indiqué
    this.cam = { x: L / 2, y: W / 2, zoom: 1 };
    this.heading = new Map(); // orientation lissée par joueur (dérivée des positions affichées)
    this.trail = [];
    this.particles = [];
    this.flash = 0; this.shake = 0; this.lastT = 0;
    this.crowdKey = '';
    this.#textures();
    this.resize();
    document.fonts?.load?.(`800 20px ${DISPLAY}`).catch(() => {});
  }

  // ---------------------------------------------------------------- textures
  #textures() {
    // brins d'herbe : bruit fin clair/sombre, répété
    const g = makeCanvas(160, 160), c = g.getContext('2d'), r = noiseRand(7);
    for (let i = 0; i < 2600; i++) {
      const x = r() * 160, y = r() * 160, l = r();
      c.fillStyle = l > 0.5 ? `rgba(255,255,230,${0.035 + r() * 0.05})` : `rgba(0,20,0,${0.05 + r() * 0.07})`;
      c.fillRect(x, y, 1 + r() * 1.4, 2 + r() * 3);
    }
    this.grassTex = this.ctx.createPattern(g, 'repeat');
    // filet
    const n = makeCanvas(24, 24), nc = n.getContext('2d');
    nc.strokeStyle = 'rgba(235,240,245,0.55)'; nc.lineWidth = 1.4;
    nc.beginPath(); nc.moveTo(0, 0); nc.lineTo(24, 24); nc.moveTo(24, 0); nc.lineTo(0, 24); nc.stroke();
    this.netTex = this.ctx.createPattern(n, 'repeat');
  }

  // public : couleurs des tribunes (supporters des deux équipes, surtout à domicile)
  #crowd(teams) {
    const key = teams.map((t) => t.colors.primary + t.colors.secondary).join('|');
    if (key === this.crowdKey) return;
    this.crowdKey = key;
    const cv = makeCanvas(240, 240), c = cv.getContext('2d'), r = noiseRand(key.length * 97 + 3);
    c.fillStyle = '#0b1120'; c.fillRect(0, 0, 240, 240);
    const home = [teams[0].colors.primary, teams[0].colors.secondary], away = [teams[1].colors.primary, teams[1].colors.secondary];
    const neutral = ['#2a3348', '#39425a', '#1d2436', '#4a5470', '#7c869e'];
    for (let y = 4; y < 240; y += 8) {
      for (let x = 2 + (y % 16 ? 4 : 0); x < 240; x += 8) {
        const u = r();
        const col = u < 0.42 ? home[r() < 0.7 ? 0 : 1] : u < 0.56 ? away[r() < 0.7 ? 0 : 1] : neutral[(r() * neutral.length) | 0];
        c.globalAlpha = 0.28 + r() * 0.4;
        c.fillStyle = col;
        c.beginPath(); c.arc(x + r() * 2, y + r() * 2, 2.1 + r() * 1.1, 0, Math.PI * 2); c.fill();
      }
    }
    c.globalAlpha = 1;
    this.crowdTex = this.ctx.createPattern(cv, 'repeat');
  }

  resize() {
    // taille de mise en page (indépendante d'une éventuelle transformation 3D CSS)
    const cw = this.canvas.clientWidth || this.canvas.getBoundingClientRect().width;
    const ch = this.canvas.clientHeight || this.canvas.getBoundingClientRect().height;
    const dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr);
    this.canvas.width = Math.max(10, Math.round(cw * dpr));
    this.canvas.height = Math.max(10, Math.round(ch * dpr));
    this.base = Math.min(this.canvas.width / (L + MARGIN * 2), this.canvas.height / (W + MARGIN * 2));
    this.dpr = dpr;
    this.#applyCam();
  }

  #applyCam() {
    const z = Math.max(1, this.cam.zoom);
    this.scale = this.base * z;
    const halfW = this.canvas.width / 2 / this.scale, halfH = this.canvas.height / 2 / this.scale;
    const cx = halfW >= L / 2 + MARGIN ? L / 2 : Math.min(L + MARGIN - halfW, Math.max(-MARGIN + halfW, this.cam.x));
    const cy = halfH >= W / 2 + MARGIN ? W / 2 : Math.min(W + MARGIN - halfH, Math.max(-MARGIN + halfH, this.cam.y));
    this.ox = this.canvas.width / 2 - cx * this.scale;
    this.oy = this.canvas.height / 2 - cy * this.scale;
  }

  follow(wx, wy, zoom, smooth = 0.12) {
    const tx = this.mirror ? L - wx : wx, ty = this.mirror ? W - wy : wy;
    this.cam.zoom += (zoom - this.cam.zoom) * 0.15;
    if (zoom <= 1.01 && Math.abs(this.cam.zoom - 1) < 0.01) { this.cam.zoom = 1; this.cam.x = L / 2; this.cam.y = W / 2; }
    else { this.cam.x += (tx - this.cam.x) * smooth; this.cam.y += (ty - this.cam.y) * smooth; }
    this.#applyCam();
  }

  // monde -> écran
  sx(x) { return this.ox + (this.mirror ? L - x : x) * this.scale; }
  sy(x, y) { return this.oy + (this.mirror ? W - y : y) * this.scale; }
  toWorld(px, py) {
    const x = (px * this.dpr - this.ox) / this.scale, y = (py * this.dpr - this.oy) / this.scale;
    return this.mirror ? { x: L - x, y: W - y } : { x, y };
  }
  dirToWorld(dx, dy) { return this.mirror ? { dx: -dx, dy: -dy } : { dx, dy }; }

  // rectangle en coordonnées du monde (indépendant du miroir)
  #rectW(x1, y1, x2, y2) {
    const a = this.sx(x1), b = this.sy(0, y1), c = this.sx(x2), d = this.sy(0, y2);
    return [Math.min(a, c), Math.min(b, d), Math.abs(c - a), Math.abs(d - b)];
  }

  // ---------------------------------------------------------------- effets
  // Explosion de couleurs (but) : particules en espace écran
  celebrate(colors) {
    const cw = this.canvas.width, ch = this.canvas.height, r = Math.random;
    const cols = [colors.primary, colors.secondary, '#ffffff', '#ffe6a0'];
    for (let i = 0; i < 170; i++) {
      const fromLeft = i % 2 === 0;
      this.particles.push({
        x: fromLeft ? -10 : cw + 10, y: ch * (0.55 + r() * 0.4),
        vx: (fromLeft ? 1 : -1) * (cw * (0.35 + r() * 0.55)), vy: -ch * (0.9 + r() * 0.9),
        rot: r() * 6, vr: (r() - 0.5) * 14, w: (5 + r() * 7) * this.dpr, h: (3 + r() * 4) * this.dpr,
        c: cols[(r() * cols.length) | 0], life: 2.6 + r() * 1.2, age: 0,
      });
    }
    this.flash = 1; this.shake = 0.5;
  }

  // ---------------------------------------------------------------- décor
  drawPitch(teams, now) {
    const { ctx } = this;
    const s = this.scale, cw = this.canvas.width, ch = this.canvas.height;
    ctx.save();
    // tribunes
    ctx.fillStyle = '#080d18'; ctx.fillRect(0, 0, cw, ch);
    if (this.crowdTex) {
      const m = new DOMMatrix().translateSelf(this.ox, this.oy).scaleSelf(s / 40, s / 40);
      this.crowdTex.setTransform(m);
      ctx.fillStyle = this.crowdTex; ctx.fillRect(0, 0, cw, ch);
      // les tribunes s'assombrissent en s'éloignant du terrain
      const [ax, ay, aw, ah] = this.#rectW(-APRON - BOARD, -APRON - BOARD, L + APRON + BOARD, W + APRON + BOARD);
      const pad = 18 * s;
      const v = ctx.createLinearGradient(0, ay - pad, 0, ay); v.addColorStop(0, 'rgba(6,9,18,0.85)'); v.addColorStop(1, 'rgba(6,9,18,0.05)');
      ctx.fillStyle = v; ctx.fillRect(0, 0, cw, ay);
      const v2 = ctx.createLinearGradient(0, ay + ah, 0, ay + ah + pad); v2.addColorStop(0, 'rgba(6,9,18,0.05)'); v2.addColorStop(1, 'rgba(6,9,18,0.85)');
      ctx.fillStyle = v2; ctx.fillRect(0, ay + ah, cw, ch - ay - ah);
      const h1 = ctx.createLinearGradient(ax - pad, 0, ax, 0); h1.addColorStop(0, 'rgba(6,9,18,0.8)'); h1.addColorStop(1, 'rgba(6,9,18,0.05)');
      ctx.fillStyle = h1; ctx.fillRect(0, 0, ax, ch);
      const h2 = ctx.createLinearGradient(ax + aw, 0, ax + aw + pad, 0); h2.addColorStop(0, 'rgba(6,9,18,0.05)'); h2.addColorStop(1, 'rgba(6,9,18,0.8)');
      ctx.fillStyle = h2; ctx.fillRect(ax + aw, 0, cw - ax - aw, ch);
    }
    // panneaux publicitaires LED
    this.#boards(teams, now);
    // pelouse (bords compris)
    const [gx, gy, gw, gh] = this.#rectW(-APRON, -APRON, L + APRON, W + APRON);
    ctx.fillStyle = '#1b5630'; ctx.fillRect(gx, gy, gw, gh);
    // bandes de tonte (dans le sens de la largeur) + damier léger
    const n = 18, bw = L / n;
    for (let i = 0; i < n; i++) {
      const [x, y, w, h] = this.#rectW(i * bw, -APRON, (i + 1) * bw, W + APRON);
      ctx.fillStyle = i % 2 ? '#22683a' : '#297642';
      ctx.fillRect(x - 0.5, y, w + 1, h);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.025)';
    for (let j = 0; j < 8; j += 2) { const [x, y, w, h] = this.#rectW(-APRON, (j * W) / 8, L + APRON, ((j + 1) * W) / 8); ctx.fillRect(x, y, w, h); }
    // texture des brins
    const tm = new DOMMatrix().translateSelf(this.ox, this.oy).scaleSelf(s / 26, s / 26);
    this.grassTex.setTransform(tm);
    ctx.fillStyle = this.grassTex; ctx.fillRect(gx, gy, gw, gh);
    // usure : surfaces de but et rond central
    for (const [wx, wy, rad] of [[6, W / 2, 7], [L - 6, W / 2, 7], [L / 2, W / 2, 6]]) {
      const X = this.sx(wx), Y = this.sy(0, wy), R = rad * s;
      const g = ctx.createRadialGradient(X, Y, 0, X, Y, R);
      g.addColorStop(0, 'rgba(176,170,110,0.16)'); g.addColorStop(1, 'rgba(176,170,110,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(X, Y, R * 1.25, R, 0, 0, Math.PI * 2); ctx.fill();
    }
    this.#lines();
    this.#goals();
    // flaques de lumière des projecteurs
    ctx.globalCompositeOperation = 'lighter';
    for (const [lx, ly] of LIGHTS) {
      const px = Math.min(L - 8, Math.max(8, lx)), py = Math.min(W - 6, Math.max(6, ly));
      const X = this.sx(px), Y = this.sy(0, py), R = 62 * s;
      const g = ctx.createRadialGradient(X, Y, 0, X, Y, R);
      g.addColorStop(0, 'rgba(255,236,190,0.11)'); g.addColorStop(0.6, 'rgba(255,236,190,0.03)'); g.addColorStop(1, 'rgba(255,236,190,0)');
      ctx.fillStyle = g; ctx.fillRect(X - R, Y - R, R * 2, R * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }

  #boards(teams, now) {
    const { ctx } = this;
    const s = this.scale;
    const o = APRON, t = BOARD;
    const sides = [
      [-o, -o - t, L + o, -o, 'h'], [-o, W + o, L + o, W + o + t, 'h'],
      [-o - t, -o, -o, W + o, 'v'], [L + o, -o, L + o + t, W + o, 'v'],
    ];
    const msg = ['GENERATION FOOTBALL', teams[0]?.name?.toUpperCase() ?? '', 'CENTRE DE FORMATION', teams[1]?.name?.toUpperCase() ?? ''];
    const phase = Math.floor((now / 4000) % msg.length);
    ctx.save();
    for (const [x1, y1, x2, y2, dir] of sides) {
      const [x, y, w, h] = this.#rectW(x1, y1, x2, y2);
      ctx.fillStyle = '#0c1424'; ctx.fillRect(x, y, w, h);
      // segments lumineux
      const len = dir === 'h' ? w : h, seg = 15 * s;
      for (let k = 0, i = 0; k < len; k += seg, i++) {
        const col = i % 3 === 0 ? teams[0].colors.primary : i % 3 === 1 ? '#0f1b33' : teams[1].colors.primary;
        ctx.fillStyle = i % 3 === 1 ? '#101a30' : alpha(col, 0.55);
        if (dir === 'h') ctx.fillRect(x + k + 1, y + 1, Math.min(seg, len - k) - 2, h - 2);
        else ctx.fillRect(x + 1, y + k + 1, w - 2, Math.min(seg, len - k) - 2);
      }
      if (t * s > 7) {
        ctx.fillStyle = 'rgba(255,240,205,0.92)';
        ctx.font = `800 ${Math.round(t * s * 0.72)}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const text = msg[phase];
        if (dir === 'h') { for (let k = seg * 1.5; k < len; k += seg * 3) ctx.fillText(text, x + k, y + h / 2 + 1); }
        else { for (let k = seg * 1.5; k < len; k += seg * 3) { ctx.save(); ctx.translate(x + w / 2, y + k); ctx.rotate(Math.PI / 2 * (x < this.canvas.width / 2 ? -1 : 1)); ctx.fillText(text, 0, 1); ctx.restore(); } }
      }
      // reflet sur la pelouse
      ctx.fillStyle = 'rgba(255,230,180,0.05)';
      if (dir === 'h') ctx.fillRect(x, y1 < 0 ? y + h : y - 0.8 * s, w, 0.8 * s);
    }
    ctx.restore();
  }

  #lines() {
    const { ctx } = this;
    const s = this.scale;
    const line = (x1, y1, x2, y2) => { ctx.moveTo(this.sx(x1), this.sy(0, y1)); ctx.lineTo(this.sx(x2), this.sy(0, y2)); };
    const rect = (x1, y1, x2, y2) => { line(x1, y1, x2, y1); line(x2, y1, x2, y2); line(x2, y2, x1, y2); line(x1, y2, x1, y1); };
    const path = () => {
      ctx.beginPath();
      rect(0, 0, L, W);
      line(L / 2, 0, L / 2, W);
      for (const gx of [0, L]) {
        const d = gx === 0 ? 1 : -1;
        rect(gx, W / 2 - PITCH.boxWidth / 2, gx + d * PITCH.boxDepth, W / 2 + PITCH.boxWidth / 2);
        rect(gx, W / 2 - PITCH.sixWidth / 2, gx + d * PITCH.sixDepth, W / 2 + PITCH.sixWidth / 2);
      }
    };
    const arcs = () => {
      ctx.beginPath();
      ctx.moveTo(this.sx(L / 2) + PITCH.centerRadius * s, this.sy(0, W / 2));
      ctx.arc(this.sx(L / 2), this.sy(0, W / 2), PITCH.centerRadius * s, 0, Math.PI * 2);
      // arcs de cercle des surfaces (« D ») et arcs de coin
      const spot = PITCH.penaltySpot, rD = 9.15, ang = Math.acos((PITCH.boxDepth - spot) / rD);
      for (const gx of [0, L]) {
        const d = gx === 0 ? 1 : -1;
        const X = this.sx(gx + d * spot), Y = this.sy(0, W / 2);
        const right = (d === 1) !== this.mirror; // l'arc est du côté du terrain
        ctx.moveTo(X + Math.cos(right ? -ang : Math.PI - ang) * rD * s, Y + Math.sin(right ? -ang : Math.PI - ang) * rD * s);
        if (right) ctx.arc(X, Y, rD * s, -ang, ang); else ctx.arc(X, Y, rD * s, Math.PI - ang, Math.PI + ang);
      }
      for (const [cx, cy] of [[0, 0], [L, 0], [0, W], [L, W]]) {
        const X = this.sx(cx), Y = this.sy(0, cy);
        ctx.moveTo(X + s, Y); ctx.arc(X, Y, 1 * s, 0, Math.PI * 2);
      }
    };
    ctx.save();
    ctx.lineCap = 'round';
    // halo de craie puis trait net ; les arcs sont limités au terrain (quarts de cercle aux coins)
    ctx.strokeStyle = 'rgba(255,255,240,0.10)'; ctx.lineWidth = Math.max(2, 0.42 * s);
    path(); ctx.stroke();
    ctx.save();
    ctx.beginPath(); const [cx0, cy0, cw0, ch0] = this.#rectW(0, 0, L, W); ctx.rect(cx0, cy0, cw0, ch0); ctx.clip();
    arcs(); ctx.stroke();
    ctx.strokeStyle = 'rgba(246,248,238,0.86)'; ctx.lineWidth = Math.max(1, 0.13 * s);
    arcs(); ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = 'rgba(246,248,238,0.86)'; ctx.lineWidth = Math.max(1, 0.13 * s);
    path(); ctx.stroke();
    ctx.fillStyle = 'rgba(246,248,238,0.9)';
    for (const [x, y] of [[L / 2, W / 2], [PITCH.penaltySpot, W / 2], [L - PITCH.penaltySpot, W / 2]]) {
      ctx.beginPath(); ctx.arc(this.sx(x), this.sy(0, y), Math.max(1.5, 0.22 * s), 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  #goals() {
    const { ctx } = this;
    const s = this.scale, depth = 2.0;
    const b = this.ballNow;
    for (const gx of [0, L]) {
      const d = gx === 0 ? -1 : 1; // vers l'extérieur
      // filet (gonfle quand le ballon y entre)
      let bulge = 0, by = W / 2;
      if (b && (d < 0 ? b.x < 0.3 : b.x > L - 0.3) && b.y > PITCH.goalY1 - 0.5 && b.y < PITCH.goalY2 + 0.5) { bulge = Math.min(1, Math.abs(b.x - gx) / depth) * 0.9; by = b.y; }
      const back = gx + d * (depth + bulge);
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(this.sx(gx), this.sy(0, PITCH.goalY1));
      ctx.lineTo(this.sx(gx + d * depth), this.sy(0, PITCH.goalY1));
      ctx.quadraticCurveTo(this.sx(back + d * bulge), this.sy(0, by), this.sx(gx + d * depth), this.sy(0, PITCH.goalY2));
      ctx.lineTo(this.sx(gx), this.sy(0, PITCH.goalY2));
      ctx.closePath();
      ctx.fillStyle = 'rgba(8,14,26,0.55)'; ctx.fill();
      this.netTex.setTransform(new DOMMatrix().translateSelf(this.ox, this.oy).scaleSelf(s / 70, s / 70));
      ctx.fillStyle = this.netTex; ctx.fill();
      ctx.strokeStyle = 'rgba(230,236,242,0.6)'; ctx.lineWidth = Math.max(1, 0.08 * s); ctx.stroke();
      // ombre de la barre transversale
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = Math.max(2, 0.28 * s);
      ctx.beginPath(); ctx.moveTo(this.sx(gx + d * 0.9), this.sy(0, PITCH.goalY1 + 0.5)); ctx.lineTo(this.sx(gx + d * 0.9), this.sy(0, PITCH.goalY2 + 0.5)); ctx.stroke();
      // poteaux et barre (vus de dessus)
      ctx.strokeStyle = '#fbfcff'; ctx.lineWidth = Math.max(2, 0.24 * s); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(this.sx(gx), this.sy(0, PITCH.goalY1)); ctx.lineTo(this.sx(gx), this.sy(0, PITCH.goalY2)); ctx.stroke();
      ctx.fillStyle = '#ffffff';
      for (const py of [PITCH.goalY1, PITCH.goalY2]) { ctx.beginPath(); ctx.arc(this.sx(gx), this.sy(0, py), Math.max(2, 0.2 * s), 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
  }

  // Sens d'attaque réel de chaque équipe : chevrons dans ses couleurs, le long de la ligne de touche
  drawDirections(teams) {
    const { ctx } = this;
    const s = this.scale;
    teams.forEach((t, i) => {
      const y = i === 0 ? -1.6 : W + 1.6;
      const dir = (this.mirror ? -1 : 1) * t.dir;
      const X = this.sx(L / 2), Y = this.sy(0, y);
      const size = Math.max(9, 1.15 * s);
      ctx.save();
      ctx.font = `700 ${Math.round(size)}px ${TEXT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const label = `${t.short}`;
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(6,10,20,0.55)';
      ctx.beginPath(); ctx.roundRect?.(X - tw / 2 - size * 2.6, Y - size * 0.75, tw + size * 5.2, size * 1.5, size * 0.75); ctx.fill();
      ctx.fillStyle = '#f4f6ef'; ctx.fillText(label, X, Y + 0.5);
      ctx.strokeStyle = t.colors.primary === '#ffffff' || lum(t.colors.primary) < 0.12 ? t.colors.secondary : t.colors.primary;
      ctx.lineWidth = Math.max(2, 0.22 * s); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (let k = 0; k < 3; k++) {
        const cx = X + dir * (tw / 2 + size * (0.9 + k * 0.55));
        ctx.globalAlpha = 0.45 + k * 0.25;
        ctx.beginPath(); ctx.moveTo(cx - dir * size * 0.22, Y - size * 0.32); ctx.lineTo(cx + dir * size * 0.12, Y); ctx.lineTo(cx - dir * size * 0.22, Y + size * 0.32); ctx.stroke();
      }
      ctx.restore();
    });
  }

  // ---------------------------------------------------------------- scène
  // players : [{id, x, y, team, num, onPitch, yellow, injured, role, isUser, name}] ; ball : {x, y, z}
  draw({ teams, players, ball, ownerId, selectedId, showNames = false, aim = null }) {
    const { ctx } = this;
    const now = performance.now();
    const dt = Math.min(0.1, (now - (this.lastT || now)) / 1000); this.lastT = now;
    this.#crowd(teams);
    this.ballNow = ball;
    // secousse (but)
    let sx0 = 0, sy0 = 0;
    if (this.shake > 0) { this.shake -= dt; const a = this.shake * 10 * this.dpr; sx0 = (Math.random() - 0.5) * a; sy0 = (Math.random() - 0.5) * a; this.ox += sx0; this.oy += sy0; }
    const s = this.scale;
    this.drawPitch(teams, now);
    this.drawDirections(teams);
    const r = 1.3 * this.base * Math.pow(Math.max(1, this.cam.zoom), 0.5);

    // orientation lissée (déplacement affiché), mémorisée par joueur
    for (const p of players) {
      if (!p.onPitch || !Number.isFinite(p.x)) continue;
      const h = this.heading.get(p.id) ?? { x: p.x, y: p.y, a: p.team === 0 ? 0 : Math.PI };
      const dx = p.x - h.x, dy = p.y - h.y;
      if (dx * dx + dy * dy > 0.0004) {
        const target = Math.atan2(dy, dx);
        let da = target - h.a; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
        h.a += da * 0.2;
      }
      h.x = p.x; h.y = p.y;
      this.heading.set(p.id, h);
    }

    // 1) ombres croisées des quatre projecteurs + halo du porteur
    ctx.save();
    for (const p of players) {
      if (!p.onPitch || !Number.isFinite(p.x)) continue;
      const X = this.sx(p.x), Y = this.sy(0, p.y);
      for (const [lx, ly] of LIGHTS) {
        const dx = (this.mirror ? -1 : 1) * (p.x - lx), dy = (this.mirror ? -1 : 1) * (p.y - ly);
        const d = Math.hypot(dx, dy) || 1, a = Math.atan2(dy, dx);
        ctx.fillStyle = 'rgba(2,8,6,0.12)';
        ctx.beginPath(); ctx.ellipse(X + (dx / d) * r * 1.15, Y + (dy / d) * r * 1.15, r * 1.3, r * 0.42, a, 0, Math.PI * 2); ctx.fill();
      }
      if (p.id === ownerId) {
        const g = ctx.createRadialGradient(X, Y, 0, X, Y, r * 2.6);
        g.addColorStop(0, 'rgba(255,238,190,0.42)'); g.addColorStop(1, 'rgba(255,238,190,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X, Y, r * 2.6, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();

    // 2) flèches des choix proposés
    if (aim) this.#aims(Array.isArray(aim) ? aim : [aim], r);

    // 3) joueurs
    for (const p of players) {
      if (!p.onPitch || !Number.isFinite(p.x)) continue;
      const t = teams[p.team];
      const X = this.sx(p.x), Y = this.sy(0, p.y);
      const kit = p.role === 'GK' ? (t.colors.gk || (p.team === 0 ? '#1f2937' : '#0f766e')) : t.colors.primary;
      const trim = p.role === 'GK' ? '#e5e7eb' : t.colors.secondary;
      ctx.save();
      if (p.isUser) {
        const pulse = 0.5 + 0.5 * Math.sin(now / 260);
        const g = ctx.createRadialGradient(X, Y, r, X, Y, r * 3.2);
        g.addColorStop(0, `rgba(255,214,90,${0.35 + 0.15 * pulse})`); g.addColorStop(1, 'rgba(255,214,90,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X, Y, r * 3.2, 0, Math.PI * 2); ctx.fill();
      }
      // corps : disque (équipe A) ou carré arrondi (équipe B), lisible sans les couleurs
      const grad = ctx.createRadialGradient(X - r * 0.45, Y - r * 0.5, r * 0.1, X, Y, r * 1.15);
      grad.addColorStop(0, mix(kit, '#ffffff', 0.38)); grad.addColorStop(0.55, kit); grad.addColorStop(1, mix(kit, '#000000', 0.35));
      ctx.fillStyle = grad;
      ctx.beginPath();
      if (p.team === 0) ctx.arc(X, Y, r, 0, Math.PI * 2);
      else { const h = r * 0.95; if (ctx.roundRect) ctx.roundRect(X - h, Y - h, h * 2, h * 2, r * 0.42); else ctx.rect(X - h, Y - h, h * 2, h * 2); }
      ctx.fill();
      ctx.strokeStyle = trim; ctx.lineWidth = Math.max(1.5, 0.2 * r); ctx.stroke();
      // orientation : petit repère sur le bord, côté regard
      const hd = this.heading.get(p.id);
      if (hd) {
        const a = this.mirror ? hd.a + Math.PI : hd.a;
        const ex = X + Math.cos(a) * r * 1.05, ey = Y + Math.sin(a) * r * 1.05;
        ctx.fillStyle = trim;
        ctx.beginPath();
        ctx.moveTo(ex + Math.cos(a) * r * 0.42, ey + Math.sin(a) * r * 0.42);
        ctx.lineTo(ex + Math.cos(a + 2.1) * r * 0.32, ey + Math.sin(a + 2.1) * r * 0.32);
        ctx.lineTo(ex + Math.cos(a - 2.1) * r * 0.32, ey + Math.sin(a - 2.1) * r * 0.32);
        ctx.closePath(); ctx.fill();
      }
      if (p.isUser) {
        ctx.strokeStyle = '#ffd65a'; ctx.lineWidth = Math.max(2, 0.22 * r);
        ctx.beginPath(); ctx.arc(X, Y, r * 1.5, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([r * 0.5, r * 0.35]); ctx.lineDashOffset = -now / 60;
        ctx.beginPath(); ctx.arc(X, Y, r * 1.9, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      }
      if (p.id === selectedId) { ctx.setLineDash([3, 3]); ctx.strokeStyle = '#ffd65a'; ctx.lineWidth = Math.max(1.5, 0.19 * r); ctx.beginPath(); ctx.arc(X, Y, r * 2.05, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
      // numéro
      const txt = p.role === 'GK' ? '#ffffff' : t.colors.text;
      ctx.font = `800 ${Math.max(9, Math.round(1.28 * r))}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = lum(txt) > 0.5 ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.3)';
      ctx.fillText(String(p.num), X + 0.6, Y + 0.12 * r + 0.8);
      ctx.fillStyle = txt; ctx.fillText(String(p.num), X, Y + 0.12 * r);
      if (p.yellow) { ctx.fillStyle = '#facc15'; ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect?.(X + r * 0.75, Y - r * 1.45, 0.48 * r, 0.66 * r, 1.5); ctx.fill(); ctx.stroke(); }
      if (p.injured) { ctx.fillStyle = '#f87171'; ctx.fillRect(X - r * 1.45, Y - r * 1.25, r * 0.5, r * 0.16); ctx.fillRect(X - r * 1.28, Y - r * 1.42, r * 0.16, r * 0.5); }
      if (showNames || p.id === selectedId || p.isUser) {
        const name = p.isUser ? p.name.split(' ').slice(-1)[0] : p.name;
        ctx.font = `700 ${Math.max(9, Math.round(0.95 * r))}px ${TEXT}`;
        const w = ctx.measureText(name).width + r * 1.1, hh = 1.45 * r, ty = Y + r * 2.25;
        ctx.fillStyle = p.isUser ? 'rgba(255,214,90,0.95)' : 'rgba(6,10,20,0.78)';
        ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(X - w / 2, ty - hh / 2, w, hh, hh / 2); else ctx.rect(X - w / 2, ty - hh / 2, w, hh); ctx.fill();
        ctx.fillStyle = p.isUser ? '#141414' : '#f4f6ef'; ctx.fillText(name, X, ty + 0.5);
      }
      ctx.restore();
    }

    // 4) ballon : traînée, ombre, hauteur
    if (ball && Number.isFinite(ball.x)) this.#ball(ball, r, now);

    // 5) éclat et confettis (but)
    this.#effects(dt);
    if (sx0 || sy0) { this.ox -= sx0; this.oy -= sy0; }
    // vignettage : la lumière tombe au bord du cadre
    const cw = this.canvas.width, ch = this.canvas.height;
    const vg = ctx.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.38, cw / 2, ch / 2, Math.max(cw, ch) * 0.72);
    vg.addColorStop(0, 'rgba(2,5,12,0)'); vg.addColorStop(1, 'rgba(2,5,12,0.62)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, cw, ch);
    void s;
  }

  #aims(list, r) {
    const { ctx } = this;
    const s = this.scale;
    ctx.save();
    for (const a of list) {
      const X0 = this.sx(a.x0), Y0 = this.sy(0, a.y0), X1 = this.sx(a.x1), Y1 = this.sy(0, a.y1);
      const mx = (X0 + X1) / 2, my = (Y0 + Y1) / 2, len = Math.hypot(X1 - X0, Y1 - Y0) || 1;
      const nx = -(Y1 - Y0) / len, ny = (X1 - X0) / len, bend = Math.min(len * 0.12, 3 * s);
      const cx = mx + nx * bend, cy = my + ny * bend;
      const g = ctx.createLinearGradient(X0, Y0, X1, Y1);
      g.addColorStop(0, 'rgba(255,214,90,0.15)'); g.addColorStop(1, 'rgba(255,214,90,0.95)');
      ctx.strokeStyle = g; ctx.lineWidth = Math.max(2.5, 0.22 * s); ctx.lineCap = 'round';
      ctx.setLineDash([0.9 * s, 0.55 * s]);
      ctx.beginPath(); ctx.moveTo(X0, Y0); ctx.quadraticCurveTo(cx, cy, X1, Y1); ctx.stroke(); ctx.setLineDash([]);
      if (a.n) {
        const R = Math.max(10, 1.05 * r);
        ctx.fillStyle = 'rgba(8,12,22,0.9)'; ctx.beginPath(); ctx.arc(X1, Y1, R, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#ffd65a'; ctx.lineWidth = Math.max(2, R * 0.16); ctx.stroke();
        ctx.fillStyle = '#ffd65a'; ctx.font = `800 ${Math.round(R * 1.25)}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(a.n), X1, Y1 + R * 0.08);
      }
    }
    ctx.restore();
  }

  #ball(ball, r, now) {
    const { ctx } = this;
    const X = this.sx(ball.x), Y = this.sy(0, ball.y);
    const cw = this.canvas.width, ch = this.canvas.height, pad = 14 * this.dpr;
    if (X < 0 || X > cw || Y < 0 || Y > ch) {
      // ballon hors champ (vue zoomée) : repère sur le bord de l'écran
      const bx = Math.min(cw - pad, Math.max(pad, X)), by = Math.min(ch - pad, Math.max(pad, Y));
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(bx, by, 6 * this.dpr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#ffd65a'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(bx, by, 10 * this.dpr, 0, Math.PI * 2); ctx.stroke();
    }
    const rb = r / 1.05, z = Math.min(Math.max(ball.z || 0, 0), 9);
    // halo discret : le ballon reste repérable à toutes les vitesses
    const hg = ctx.createRadialGradient(X, Y, 0, X, Y, rb * 1.6);
    hg.addColorStop(0, 'rgba(255,255,240,0.32)'); hg.addColorStop(1, 'rgba(255,255,240,0)');
    ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(X, Y, rb * 1.6, 0, Math.PI * 2); ctx.fill();
    const lift = z * 0.6 * rb, br = (0.6 + z * 0.05) * rb;
    // traînée (frappes, longs ballons)
    const tr = this.trail;
    tr.push({ x: X, y: Y - lift, t: now });
    while (tr.length > 14 || (tr.length && now - tr[0].t > 260)) tr.shift();
    if (tr.length > 2) {
      const sp = Math.hypot(tr.at(-1).x - tr[0].x, tr.at(-1).y - tr[0].y);
      if (sp > r * 2.2) {
        ctx.save(); ctx.lineCap = 'round';
        for (let i = 1; i < tr.length; i++) {
          const k = i / tr.length;
          ctx.strokeStyle = `rgba(255,248,225,${0.28 * k})`; ctx.lineWidth = br * 1.6 * k;
          ctx.beginPath(); ctx.moveTo(tr[i - 1].x, tr[i - 1].y); ctx.lineTo(tr[i].x, tr[i].y); ctx.stroke();
        }
        ctx.restore();
      }
    }
    // ombre au sol (s'étale et pâlit avec la hauteur)
    ctx.fillStyle = `rgba(0,0,0,${0.42 - z * 0.03})`;
    ctx.beginPath(); ctx.ellipse(X + z * 0.12 * rb, Y + z * 0.08 * rb, (0.58 + z * 0.06) * rb, (0.36 + z * 0.04) * rb, 0, 0, Math.PI * 2); ctx.fill();
    // ballon
    const g = ctx.createRadialGradient(X - br * 0.35, Y - lift - br * 0.4, br * 0.1, X, Y - lift, br);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.7, '#e8ecf2'); g.addColorStop(1, '#9aa3b2');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X, Y - lift, br, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = Math.max(0.8, br * 0.12); ctx.stroke();
    // panneau sombre qui tourne avec la course du ballon
    const spin = (ball.x + ball.y) * 1.3;
    ctx.fillStyle = 'rgba(20,24,32,0.85)';
    ctx.beginPath();
    for (let i = 0; i < 5; i++) { const a = spin + (i * 2 * Math.PI) / 5; const px = X + Math.cos(a) * br * 0.38, py = Y - lift + Math.sin(a) * br * 0.38; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
    ctx.closePath(); ctx.fill();
  }

  #effects(dt) {
    const { ctx } = this;
    const cw = this.canvas.width, ch = this.canvas.height;
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,244,214,${this.flash * 0.35})`; ctx.fillRect(0, 0, cw, ch);
      this.flash = Math.max(0, this.flash - dt * 2.2);
    }
    if (!this.particles.length) return;
    const g = ch * 1.1;
    ctx.save();
    this.particles = this.particles.filter((p) => (p.age += dt) < p.life);
    for (const p of this.particles) {
      p.vy += g * dt; p.vx *= 1 - 0.9 * dt; p.vy *= 1 - 0.6 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      ctx.globalAlpha = Math.min(1, (p.life - p.age) * 1.5);
      ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2 * Math.abs(Math.cos(p.rot * 1.7)), p.w, p.h * Math.abs(Math.cos(p.rot * 1.7)) + 0.5);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    ctx.restore();
  }

  // Petite carte des tirs (bilan) : taille = xG pré-tir.
  static drawShotMap(canvas, shots, teams) {
    const ctx = canvas.getContext('2d');
    const Wc = canvas.width, Hc = canvas.height;
    const s = Math.min(Wc / L, Hc / W);
    ctx.fillStyle = '#1f5f34'; ctx.fillRect(0, 0, Wc, Hc);
    for (let i = 0; i < 12; i++) { ctx.fillStyle = i % 2 ? '#25703d' : '#2b7c45'; ctx.fillRect((L / 12) * i * s, 0, (L / 12) * s + 1, W * s); }
    ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, L * s - 1, W * s - 1);
    ctx.beginPath(); ctx.moveTo((L / 2) * s, 0); ctx.lineTo((L / 2) * s, W * s); ctx.stroke();
    for (const gx of [0, L]) { const d = gx ? -1 : 1; ctx.strokeRect(gx * s + (d < 0 ? -16.5 * s : 0), (W / 2 - 20.16) * s, 16.5 * s, 40.32 * s); }
    for (const sh of shots) {
      const t = teams[sh.team];
      ctx.fillStyle = sh.goal ? '#ffd65a' : t.colors.primary;
      ctx.strokeStyle = sh.goal ? '#1a1a1a' : '#fff';
      ctx.beginPath(); ctx.arc(sh.x * s, sh.y * s, 2 + Math.sqrt(sh.xg) * 10, 0, Math.PI * 2);
      ctx.globalAlpha = 0.9; ctx.fill(); ctx.globalAlpha = 1; ctx.stroke();
    }
  }
}
