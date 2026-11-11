// Entrées du pilotage direct : stick tactile, boutons de geste, clavier (positions physiques
// ZQSD/WASD) et manette. Ce module ne produit que des intentions ; le moteur les interprète.

const DEAD = 0.18;
const RADIUS = 52; // course du stick en pixels CSS

export const Pad = {
  dx: 0, dy: 0, sprint: false,       // direction ÉCRAN normalisée
  onAction: null,                    // (bouton 'A' | 'B' | 'X' | 'Y' | 'C') => void
  visible: false,
  keys: new Set(),
  touch: { id: null, ox: 0, oy: 0, dx: 0, dy: 0, mag: 0 },
  gamepadPrev: {},

  init() {
    this.root = document.getElementById('pad');
    this.zone = document.getElementById('joy-zone');
    this.base = document.getElementById('joy-base');
    this.knob = document.getElementById('joy-knob');
    const z = this.zone;
    z.addEventListener('pointerdown', (e) => {
      if (this.touch.id != null) return;
      e.preventDefault();
      z.setPointerCapture(e.pointerId);
      const r = z.getBoundingClientRect();
      this.touch = { id: e.pointerId, ox: e.clientX - r.left, oy: e.clientY - r.top, dx: 0, dy: 0, mag: 0 };
      this.base.hidden = false;
      this.base.style.left = `${this.touch.ox}px`; this.base.style.top = `${this.touch.oy}px`;
      this.knob.style.transform = 'translate(-50%, -50%)';
    });
    z.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.touch.id) return;
      const r = z.getBoundingClientRect();
      let vx = e.clientX - r.left - this.touch.ox, vy = e.clientY - r.top - this.touch.oy;
      const len = Math.hypot(vx, vy);
      if (len > RADIUS) { vx *= RADIUS / len; vy *= RADIUS / len; }
      this.touch.dx = vx / RADIUS; this.touch.dy = vy / RADIUS; this.touch.mag = Math.min(1, len / RADIUS);
      this.knob.style.transform = `translate(calc(-50% + ${vx}px), calc(-50% + ${vy}px))`;
      this.base.classList.toggle('sprint', this.touch.mag > 0.92);
    });
    const end = (e) => {
      if (e.pointerId !== this.touch.id) return;
      this.touch = { id: null, ox: 0, oy: 0, dx: 0, dy: 0, mag: 0 };
      this.base.hidden = true; this.base.classList.remove('sprint');
    };
    z.addEventListener('pointerup', end);
    z.addEventListener('pointercancel', end);
    z.addEventListener('lostpointercapture', end);
    this.root.querySelectorAll('[data-btn]').forEach((b) => {
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault(); e.stopPropagation();
        b.classList.add('down');
        this.onAction?.(b.dataset.btn);
      });
      const up = () => b.classList.remove('down');
      b.addEventListener('pointerup', up); b.addEventListener('pointerleave', up); b.addEventListener('pointercancel', up);
      b.addEventListener('contextmenu', (e) => e.preventDefault());
    });
    window.addEventListener('blur', () => this.reset());
  },

  setVisible(v) {
    if (v === this.visible) return;
    this.visible = v;
    this.root.hidden = !v;
    if (!v) this.reset();
  },

  setLabels(labels) {
    for (const k of ['A', 'B', 'X', 'Y']) {
      const el = this.root.querySelector(`[data-btn="${k}"]`);
      const txt = labels[k];
      if (el.dataset.label !== String(txt)) {
        el.dataset.label = String(txt);
        el.querySelector('span').textContent = txt || '';
        el.classList.toggle('off', !txt);
      }
    }
  },

  // Relâche toutes les intentions maintenues (pause, fenêtre, changement de contexte)
  reset() {
    this.keys.clear();
    this.touch = { id: null, ox: 0, oy: 0, dx: 0, dy: 0, mag: 0 };
    if (this.base) { this.base.hidden = true; this.base.classList.remove('sprint'); }
    this.dx = 0; this.dy = 0; this.sprint = false;
  },

  // Clavier : codes physiques (ZQSD sur AZERTY = WASD sur QWERTY) et flèches
  keyDown(e) {
    const c = e.code;
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'].includes(c)) { this.keys.add(c); return true; }
    if (e.repeat) return ['KeyE', 'KeyF', 'KeyR', 'KeyQ', 'KeyC'].includes(c);
    const map = { KeyE: 'A', KeyF: 'B', KeyR: 'X', KeyQ: 'Y', KeyC: 'C' };
    if (map[c]) { this.onAction?.(map[c]); return true; }
    return false;
  },
  keyUp(e) { this.keys.delete(e.code); },

  // À appeler une fois par image : fusionne clavier, stick tactile et manette
  poll() {
    let dx = 0, dy = 0, sprint = false;
    const k = this.keys;
    if (k.has('KeyA') || k.has('ArrowLeft')) dx -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) dx += 1;
    if (k.has('KeyW') || k.has('ArrowUp')) dy -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) dy += 1;
    if (dx || dy) { const l = Math.hypot(dx, dy); dx /= l; dy /= l; sprint = k.has('ShiftLeft') || k.has('ShiftRight'); }
    else if (this.touch.id != null && this.touch.mag > DEAD) { dx = this.touch.dx; dy = this.touch.dy; sprint = this.touch.mag > 0.92; }
    else {
      const gp = (navigator.getGamepads ? [...navigator.getGamepads()] : []).find((g) => g && g.connected);
      if (gp) {
        const gx = gp.axes[0] || 0, gy = gp.axes[1] || 0;
        if (Math.hypot(gx, gy) > 0.25) { dx = gx; dy = gy; }
        sprint = (gp.buttons[7]?.value ?? 0) > 0.4;
        const btn = { 0: 'A', 1: 'B', 2: 'X', 3: 'Y', 4: 'C' };
        for (const i in btn) {
          const down = !!gp.buttons[i]?.pressed;
          if (down && !this.gamepadPrev[i]) this.onAction?.(btn[i]);
          this.gamepadPrev[i] = down;
        }
      }
    }
    this.dx = dx; this.dy = dy; this.sprint = sprint;
    return this;
  },
};
