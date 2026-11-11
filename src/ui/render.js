// Rendu 2D du terrain. Lecture seule : ne modifie jamais l'état du moteur.
// L'interpolation lisse l'affichage entre deux pas, sans être réinjectée dans la simulation.

import { PITCH } from '../engine/config.js';

const MARGIN = 4; // mètres autour du terrain

export class PitchRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.mirror = false; // affichage seulement : le sens réel de l'attaque est toujours indiqué
    // caméra (affichage seulement) : centre en coordonnées affichées, zoom ≥ 1
    this.cam = { x: PITCH.length / 2, y: PITCH.width / 2, zoom: 1 };
    this.resize();
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.max(10, Math.round(r.width * dpr));
    this.canvas.height = Math.max(10, Math.round(r.height * dpr));
    const W = PITCH.length + MARGIN * 2, H = PITCH.width + MARGIN * 2;
    this.base = Math.min(this.canvas.width / W, this.canvas.height / H);
    this.dpr = dpr;
    this.#applyCam();
  }

  #applyCam() {
    const z = Math.max(1, this.cam.zoom);
    this.scale = this.base * z;
    // la vue ne sort pas du terrain (marge comprise)
    const halfW = this.canvas.width / 2 / this.scale, halfH = this.canvas.height / 2 / this.scale;
    const cx = halfW >= PITCH.length / 2 + MARGIN ? PITCH.length / 2 : Math.min(PITCH.length + MARGIN - halfW, Math.max(-MARGIN + halfW, this.cam.x));
    const cy = halfH >= PITCH.width / 2 + MARGIN ? PITCH.width / 2 : Math.min(PITCH.width + MARGIN - halfH, Math.max(-MARGIN + halfH, this.cam.y));
    this.ox = this.canvas.width / 2 - cx * this.scale;
    this.oy = this.canvas.height / 2 - cy * this.scale;
  }

  // Suivi fluide d'un point du monde (ex. le joueur piloté) ; zoom 1 = terrain entier.
  follow(wx, wy, zoom, smooth = 0.12) {
    const tx = this.mirror ? PITCH.length - wx : wx, ty = this.mirror ? PITCH.width - wy : wy;
    this.cam.zoom += (zoom - this.cam.zoom) * 0.15;
    if (zoom <= 1.01 && Math.abs(this.cam.zoom - 1) < 0.01) { this.cam.zoom = 1; this.cam.x = PITCH.length / 2; this.cam.y = PITCH.width / 2; }
    else { this.cam.x += (tx - this.cam.x) * smooth; this.cam.y += (ty - this.cam.y) * smooth; }
    this.#applyCam();
  }

  // monde -> écran
  sx(x, y) { return this.ox + (this.mirror ? PITCH.length - x : x) * this.scale; }
  sy(x, y) { return this.oy + (this.mirror ? PITCH.width - y : y) * this.scale; }

  // écran -> monde (pour la sélection)
  toWorld(px, py) {
    const x = (px * this.dpr - this.ox) / this.scale, y = (py * this.dpr - this.oy) / this.scale;
    return this.mirror ? { x: PITCH.length - x, y: PITCH.width - y } : { x, y };
  }

  // direction écran -> direction monde (stick, clavier)
  dirToWorld(dx, dy) { return this.mirror ? { dx: -dx, dy: -dy } : { dx, dy }; }

  drawPitch() {
    const { ctx, scale: s } = this;
    ctx.fillStyle = '#12301c';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    const stripes = 12;
    for (let i = 0; i < stripes; i++) {
      ctx.fillStyle = i % 2 ? '#2a6037' : '#2f6b3d';
      const x0 = (PITCH.length / stripes) * i;
      ctx.fillRect(this.ox + x0 * s, this.oy, (PITCH.length / stripes) * s + 1, PITCH.width * s);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.82)';
    ctx.lineWidth = Math.max(1, 0.12 * s);
    const L = PITCH.length, Wd = PITCH.width;
    const line = (x1, y1, x2, y2) => { ctx.beginPath(); ctx.moveTo(this.sx(x1, y1), this.sy(x1, y1)); ctx.lineTo(this.sx(x2, y2), this.sy(x2, y2)); ctx.stroke(); };
    const rect = (x1, y1, x2, y2) => { line(x1, y1, x2, y1); line(x2, y1, x2, y2); line(x2, y2, x1, y2); line(x1, y2, x1, y1); };
    rect(0, 0, L, Wd);
    line(L / 2, 0, L / 2, Wd);
    ctx.beginPath(); ctx.arc(this.sx(L / 2, Wd / 2), this.sy(L / 2, Wd / 2), PITCH.centerRadius * s, 0, Math.PI * 2); ctx.stroke();
    for (const gx of [0, L]) {
      const d = gx === 0 ? 1 : -1;
      rect(gx, Wd / 2 - PITCH.boxWidth / 2, gx + d * PITCH.boxDepth, Wd / 2 + PITCH.boxWidth / 2);
      rect(gx, Wd / 2 - PITCH.sixWidth / 2, gx + d * PITCH.sixDepth, Wd / 2 + PITCH.sixWidth / 2);
      ctx.fillStyle = 'rgba(255,255,255,0.82)';
      ctx.beginPath(); ctx.arc(this.sx(gx + d * PITCH.penaltySpot, Wd / 2), this.sy(0, Wd / 2), 0.25 * s, 0, Math.PI * 2); ctx.fill();
      // but
      ctx.save(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(2, 0.3 * s);
      line(gx - d * 1.2, PITCH.goalY1, gx, PITCH.goalY1); line(gx - d * 1.2, PITCH.goalY2, gx, PITCH.goalY2); line(gx - d * 1.2, PITCH.goalY1, gx - d * 1.2, PITCH.goalY2);
      ctx.restore();
    }
  }

  // Flèche indiquant le sens d'attaque réel de chaque équipe.
  drawDirections(teams) {
    const { ctx, scale: s } = this;
    teams.forEach((t, i) => {
      const y = i === 0 ? -2.2 : PITCH.width + 2.2;
      const x0 = PITCH.length / 2 - 8 * t.dir, x1 = PITCH.length / 2 + 8 * t.dir;
      const X0 = this.sx(x0, y), X1 = this.sx(x1, y), Y = this.sy(x0, y);
      ctx.strokeStyle = t.colors.primary; ctx.fillStyle = t.colors.primary; ctx.lineWidth = Math.max(2, 0.35 * s);
      ctx.beginPath(); ctx.moveTo(X0, Y); ctx.lineTo(X1, Y); ctx.stroke();
      const dir = Math.sign(X1 - X0);
      ctx.beginPath(); ctx.moveTo(X1, Y); ctx.lineTo(X1 - dir * 1.2 * s, Y - 0.8 * s); ctx.lineTo(X1 - dir * 1.2 * s, Y + 0.8 * s); ctx.closePath(); ctx.fill();
      ctx.font = `${Math.max(10, 1.5 * s)}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(`${t.short} attaque`, (X0 + X1) / 2, Y + (i === 0 ? -1.4 : 1.4) * s);
    });
  }

  // players : [{id, x, y, team, num, onPitch, yellow, injured, role, user}] ; ball : {x, y, z}
  draw({ teams, players, ball, ownerId, selectedId, userTeam, showNames = false, aim = null }) {
    const { ctx, scale: s } = this;
    this.drawPitch();
    this.drawDirections(teams);
    // rayon des pastilles : grossit moins vite que le zoom pour garder de l'espace lisible
    const r = 1.05 * this.base * Math.pow(Math.max(1, this.cam.zoom), 0.55);
    if (aim) {
      // options proposées : flèches numérotées (intention, résultat non garanti)
      const list = Array.isArray(aim) ? aim : [aim];
      ctx.save();
      for (const a of list) {
        const X0 = this.sx(a.x0, a.y0), Y0 = this.sy(a.x0, a.y0), X1 = this.sx(a.x1, a.y1), Y1 = this.sy(a.x1, a.y1);
        ctx.strokeStyle = 'rgba(245,197,66,0.9)'; ctx.lineWidth = Math.max(2, 0.16 * s); ctx.setLineDash([0.8 * s, 0.6 * s]);
        ctx.beginPath(); ctx.moveTo(X0, Y0); ctx.lineTo(X1, Y1); ctx.stroke(); ctx.setLineDash([]);
        if (a.n) {
          const R = Math.max(9, 0.95 * r);
          ctx.fillStyle = '#f5c542'; ctx.beginPath(); ctx.arc(X1, Y1, R, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#111'; ctx.font = `bold ${Math.round(R * 1.2)}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(String(a.n), X1, Y1 + 0.5);
        }
      }
      ctx.restore();
    }
    for (const p of players) {
      if (!p.onPitch || !Number.isFinite(p.x)) continue;
      const t = teams[p.team];
      const X = this.sx(p.x, p.y), Y = this.sy(p.x, p.y);
      ctx.save();
      ctx.fillStyle = p.role === 'GK' ? (t.colors.gk || '#111827') : t.colors.primary;
      ctx.strokeStyle = t.colors.secondary; ctx.lineWidth = Math.max(1.5, 0.21 * r);
      ctx.beginPath();
      if (p.team === 0) ctx.arc(X, Y, r, 0, Math.PI * 2); // équipe A : cercles
      else { const h = r * 0.92; ctx.rect(X - h, Y - h, h * 2, h * 2); } // équipe B : carrés (lisible en niveaux de gris)
      ctx.fill(); ctx.stroke();
      if (p.id === ownerId) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(1, 0.12 * r); ctx.beginPath(); ctx.arc(X, Y, r * 1.55, 0, Math.PI * 2); ctx.stroke(); }
      if (p.isUser) {
        // joueur de l'utilisateur : double anneau, repérable sans dépendre de la couleur
        ctx.strokeStyle = '#f5c542'; ctx.lineWidth = Math.max(2, 0.24 * r);
        ctx.beginPath(); ctx.arc(X, Y, r * 1.45, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(X, Y, r * 1.85, 0, Math.PI * 2); ctx.stroke();
      }
      if (p.id === selectedId) { ctx.setLineDash([3, 3]); ctx.strokeStyle = '#f5c542'; ctx.lineWidth = Math.max(1.5, 0.19 * r); ctx.beginPath(); ctx.arc(X, Y, r * 1.9, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
      ctx.fillStyle = p.role === 'GK' ? '#ffffff' : t.colors.text;
      ctx.font = `bold ${Math.max(9, 1.1 * r)}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(p.num), X, Y + 0.05 * r);
      if (p.yellow) { ctx.fillStyle = '#facc15'; ctx.fillRect(X + r * 0.7, Y - r * 1.4, 0.43 * r, 0.62 * r); }
      if (p.injured) { ctx.fillStyle = '#f87171'; ctx.font = `bold ${Math.max(9, 1.15 * r)}px system-ui`; ctx.fillText('+', X - r * 1.2, Y - r * 1.2); }
      if (showNames || p.id === selectedId || p.isUser) {
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.font = `${Math.max(9, 0.95 * r)}px system-ui`;
        const w = ctx.measureText(p.name).width + 6;
        ctx.fillRect(X - w / 2, Y + r * 1.5, w, 1.35 * r);
        ctx.fillStyle = '#fff'; ctx.fillText(p.name, X, Y + r * 1.5 + 0.68 * r);
      }
      ctx.restore();
    }
    // ballon : ombre au sol + hauteur
    if (ball && Number.isFinite(ball.x)) {
      const X = this.sx(ball.x, ball.y), Y = this.sy(ball.x, ball.y);
      const W = this.canvas.width, H = this.canvas.height, pad = 14 * this.dpr;
      if (X < 0 || X > W || Y < 0 || Y > H) {
        // ballon hors champ (vue zoomée) : repère sur le bord de l'écran
        const bx = Math.min(W - pad, Math.max(pad, X)), by = Math.min(H - pad, Math.max(pad, Y));
        ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#111'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(bx, by, 6 * this.dpr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#f5c542'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(bx, by, 10 * this.dpr, 0, Math.PI * 2); ctx.stroke();
      }
      const rb = r / 1.05;
      const lift = Math.min(ball.z, 8) * 0.55 * rb;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.ellipse(X, Y, 0.55 * rb, 0.35 * rb, 0, 0, Math.PI * 2); ctx.fill();
      const br = (0.48 + Math.min(ball.z, 8) * 0.04) * rb;
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#111'; ctx.lineWidth = Math.max(1, 0.1 * s);
      ctx.beginPath(); ctx.arc(X, Y - lift, br, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
  }

  // Petite carte des tirs (bilan) : taille = xG pré-tir.
  static drawShotMap(canvas, shots, teams) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const s = Math.min(W / PITCH.length, H / PITCH.width);
    ctx.fillStyle = '#2a6037'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, PITCH.length * s - 1, PITCH.width * s - 1);
    ctx.beginPath(); ctx.moveTo(PITCH.length / 2 * s, 0); ctx.lineTo(PITCH.length / 2 * s, PITCH.width * s); ctx.stroke();
    for (const sh of shots) {
      const t = teams[sh.team];
      ctx.fillStyle = sh.goal ? '#f5c542' : t.colors.primary;
      ctx.strokeStyle = '#fff';
      ctx.beginPath(); ctx.arc(sh.x * s, sh.y * s, 2 + Math.sqrt(sh.xg) * 10, 0, Math.PI * 2);
      ctx.globalAlpha = 0.85; ctx.fill(); ctx.globalAlpha = 1; ctx.stroke();
    }
  }
}
