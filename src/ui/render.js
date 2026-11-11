// Rendu 2D du terrain. Lecture seule : ne modifie jamais l'état du moteur.
// L'interpolation lisse l'affichage entre deux pas, sans être réinjectée dans la simulation.

import { PITCH } from '../engine/config.js';

const MARGIN = 4; // mètres autour du terrain

export class PitchRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.mirror = false; // affichage seulement : le sens réel de l'attaque est toujours indiqué
    this.resize();
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.max(10, Math.round(r.width * dpr));
    this.canvas.height = Math.max(10, Math.round(r.height * dpr));
    const W = PITCH.length + MARGIN * 2, H = PITCH.width + MARGIN * 2;
    this.scale = Math.min(this.canvas.width / W, this.canvas.height / H);
    this.ox = (this.canvas.width - W * this.scale) / 2 + MARGIN * this.scale;
    this.oy = (this.canvas.height - H * this.scale) / 2 + MARGIN * this.scale;
    this.dpr = dpr;
  }

  // monde -> écran
  sx(x, y) { return this.ox + (this.mirror ? PITCH.length - x : x) * this.scale; }
  sy(x, y) { return this.oy + (this.mirror ? PITCH.width - y : y) * this.scale; }

  // écran -> monde (pour la sélection)
  toWorld(px, py) {
    const x = (px * this.dpr - this.ox) / this.scale, y = (py * this.dpr - this.oy) / this.scale;
    return this.mirror ? { x: PITCH.length - x, y: PITCH.width - y } : { x, y };
  }

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
  draw({ teams, players, ball, ownerId, selectedId, userTeam, showNames = false }) {
    const { ctx, scale: s } = this;
    this.drawPitch();
    this.drawDirections(teams);
    const r = 1.05 * s;
    for (const p of players) {
      if (!p.onPitch || !Number.isFinite(p.x)) continue;
      const t = teams[p.team];
      const X = this.sx(p.x, p.y), Y = this.sy(p.x, p.y);
      ctx.save();
      ctx.fillStyle = p.role === 'GK' ? (t.colors.gk || '#111827') : t.colors.primary;
      ctx.strokeStyle = t.colors.secondary; ctx.lineWidth = Math.max(1.5, 0.22 * s);
      ctx.beginPath();
      if (p.team === 0) ctx.arc(X, Y, r, 0, Math.PI * 2); // équipe A : cercles
      else { const h = r * 0.92; ctx.rect(X - h, Y - h, h * 2, h * 2); } // équipe B : carrés (lisible en niveaux de gris)
      ctx.fill(); ctx.stroke();
      if (p.id === ownerId) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(1, 0.12 * s); ctx.beginPath(); ctx.arc(X, Y, r * 1.55, 0, Math.PI * 2); ctx.stroke(); }
      if (p.isUser) {
        // joueur de l'utilisateur : double anneau, repérable sans dépendre de la couleur
        ctx.strokeStyle = '#f5c542'; ctx.lineWidth = Math.max(2, 0.25 * s);
        ctx.beginPath(); ctx.arc(X, Y, r * 1.45, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(X, Y, r * 1.85, 0, Math.PI * 2); ctx.stroke();
      }
      if (p.id === selectedId) { ctx.setLineDash([3, 3]); ctx.strokeStyle = '#f5c542'; ctx.lineWidth = Math.max(1.5, 0.2 * s); ctx.beginPath(); ctx.arc(X, Y, r * 1.9, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
      ctx.fillStyle = p.role === 'GK' ? '#ffffff' : t.colors.text;
      ctx.font = `bold ${Math.max(9, 1.15 * s)}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(p.num), X, Y + 0.05 * s);
      if (p.yellow) { ctx.fillStyle = '#facc15'; ctx.fillRect(X + r * 0.7, Y - r * 1.4, 0.45 * s, 0.65 * s); }
      if (p.injured) { ctx.fillStyle = '#f87171'; ctx.font = `bold ${Math.max(9, 1.2 * s)}px system-ui`; ctx.fillText('+', X - r * 1.2, Y - r * 1.2); }
      if (showNames || p.id === selectedId || p.isUser) {
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.font = `${Math.max(9, 1.0 * s)}px system-ui`;
        const w = ctx.measureText(p.name).width + 6;
        ctx.fillRect(X - w / 2, Y + r * 1.5, w, 1.4 * s);
        ctx.fillStyle = '#fff'; ctx.fillText(p.name, X, Y + r * 1.5 + 0.7 * s);
      }
      ctx.restore();
    }
    // ballon : ombre au sol + hauteur
    if (ball && Number.isFinite(ball.x)) {
      const X = this.sx(ball.x, ball.y), Y = this.sy(ball.x, ball.y);
      const lift = Math.min(ball.z, 8) * 0.55 * s;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.ellipse(X, Y, 0.55 * s, 0.35 * s, 0, 0, Math.PI * 2); ctx.fill();
      const br = (0.48 + Math.min(ball.z, 8) * 0.04) * s;
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
