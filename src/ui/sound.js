// Sons du match, synthétisés en direct (Web Audio) : aucun fichier, rien de téléchargé.
// Rumeur de foule (qui enfle près des surfaces), sifflet, frappe, « ooh », clameur sur but, signal de choix.
// Le contexte audio ne démarre qu'après un geste de l'utilisateur (règle des navigateurs et d'Android).

const KEY = 'generation-football.sound';
let ctx = null, master = null, crowd = null, crowdGain = null, crowdFilter = null, noiseBuf = null, lfo = null;
let enabled = true;
try { enabled = localStorage.getItem(KEY) !== 'off'; } catch { /* stockage indisponible */ }

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = enabled ? 0.9 : 0; master.connect(ctx.destination);
  // bruit rose (approché) : base de la foule et des clameurs
  const len = ctx.sampleRate * 4;
  noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.997 * b0 + w * 0.029; b1 = 0.985 * b1 + w * 0.032; b2 = 0.95 * b2 + w * 0.048;
    d[i] = (b0 + b1 + b2 + w * 0.02) * 0.9;
  }
  return ctx;
}

function noise(dur) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf; src.loop = true;
  src.loopStart = Math.random() * 2; src.loopEnd = src.loopStart + 1.8;
  src.start(ctx.currentTime, Math.random() * 3);
  if (dur) src.stop(ctx.currentTime + dur);
  return src;
}

export const sound = {
  get enabled() { return enabled; },
  toggle() {
    enabled = !enabled;
    try { localStorage.setItem(KEY, enabled ? 'on' : 'off'); } catch { /* stockage indisponible */ }
    if (master) master.gain.setTargetAtTime(enabled ? 0.9 : 0, ctx.currentTime, 0.05);
    if (enabled) this.start();
    return enabled;
  },
  // ambiance de stade : rumeur continue, légèrement ondulante
  start() {
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    if (crowd) return;
    crowd = noise();
    crowdFilter = ctx.createBiquadFilter(); crowdFilter.type = 'bandpass'; crowdFilter.frequency.value = 650; crowdFilter.Q.value = 0.6;
    const low = ctx.createBiquadFilter(); low.type = 'lowpass'; low.frequency.value = 2400;
    crowdGain = ctx.createGain(); crowdGain.gain.value = 0;
    crowdGain.gain.setTargetAtTime(0.16, ctx.currentTime, 1.2);
    // ondulation lente : la foule n'est jamais immobile
    lfo = ctx.createOscillator(); lfo.frequency.value = 0.13;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.04;
    lfo.connect(lfoGain).connect(crowdGain.gain); lfo.start();
    crowd.connect(crowdFilter).connect(low).connect(crowdGain).connect(master);
  },
  stop() {
    if (!crowd) return;
    const c = crowd, g = crowdGain, l = lfo;
    g.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
    setTimeout(() => { try { c.stop(); l.stop(); } catch { /* déjà arrêté */ } }, 1500);
    crowd = null; crowdGain = null; lfo = null;
  },
  // intensité de la foule : 0 calme (accéléré), 1 normal, 2 action chaude
  intensity(x) {
    if (!crowdGain) return;
    const t = ctx.currentTime;
    crowdGain.gain.setTargetAtTime(0.06 + 0.1 * Math.min(2, x), t, 0.6);
    crowdFilter.frequency.setTargetAtTime(520 + 260 * Math.min(2, x), t, 0.6);
  },
  // sifflet à bille : sinus vers 2,9 kHz modulé par la bille (trille)
  whistle(kind = 'short') {
    if (!enabled || !ensure()) return;
    const pattern = kind === 'end' ? [0.35, 0.35, 0.9] : kind === 'long' ? [0.85] : kind === 'half' ? [0.35, 0.8] : [0.22];
    let t = ctx.currentTime + 0.02;
    for (const dur of pattern) {
      const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = 2870;
      const trill = ctx.createOscillator(); trill.frequency.value = 34;
      const trillGain = ctx.createGain(); trillGain.gain.value = 140;
      trill.connect(trillGain).connect(osc.frequency);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.16, t + 0.02); g.gain.setValueAtTime(0.16, t + dur - 0.05); g.gain.linearRampToValueAtTime(0, t + dur);
      osc.connect(g).connect(master);
      osc.start(t); trill.start(t); osc.stop(t + dur + 0.05); trill.stop(t + dur + 0.05);
      t += dur + 0.12;
    }
  },
  // frappe de balle : choc sourd + claquement
  kick(power = 1) {
    if (!enabled || !ensure()) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator(); osc.type = 'sine';
    osc.frequency.setValueAtTime(140, t); osc.frequency.exponentialRampToValueAtTime(48, t + 0.12);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.5 * power, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    osc.connect(g).connect(master); osc.start(t); osc.stop(t + 0.2);
    const n = noise(0.05); const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1800;
    const ng = ctx.createGain(); ng.gain.setValueAtTime(0.18 * power, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    n.connect(hp).connect(ng).connect(master);
  },
  // « ooooh » de la foule sur une grosse occasion manquée
  ooh() {
    if (!enabled || !ensure()) return;
    const t = ctx.currentTime;
    const n = noise(1.8);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2.2;
    f.frequency.setValueAtTime(950, t); f.frequency.exponentialRampToValueAtTime(380, t + 1.4);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.5, t + 0.25); g.gain.exponentialRampToValueAtTime(0.001, t + 1.7);
    n.connect(f).connect(g).connect(master);
  },
  // clameur sur un but : explosion qui monte puis retombe lentement
  goal() {
    if (!enabled || !ensure()) return;
    const t = ctx.currentTime;
    for (const [freq, q, vol] of [[700, 0.7, 0.75], [1500, 1.2, 0.35], [320, 0.9, 0.4]]) {
      const n = noise(5.5);
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = q;
      f.frequency.setValueAtTime(freq * 0.7, t); f.frequency.exponentialRampToValueAtTime(freq * 1.25, t + 0.6); f.frequency.exponentialRampToValueAtTime(freq, t + 4);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.18); g.gain.setValueAtTime(vol, t + 1.6); g.gain.exponentialRampToValueAtTime(0.001, t + 5.4);
      n.connect(f).connect(g).connect(master);
    }
    this.kick(0.8);
  },
  // cliquet de la roue : petit claquement sec, plus aigu quand elle va vite
  tick(speed = 1) {
    if (!enabled || !ensure()) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'square';
    o.frequency.setValueAtTime(1500 + 900 * Math.min(1, speed), t); o.frequency.exponentialRampToValueAtTime(420, t + 0.03);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.07, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    o.connect(g).connect(master); o.start(t); o.stop(t + 0.05);
  },
  // verdict de la roue : accord qui monte, d'autant plus riche que le palier est haut (0 à 5)
  fanfare(level = 2) {
    if (!enabled || !ensure()) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const t = ctx.currentTime;
    const notes = [523, 659, 784, 1047, 1319, 1568].slice(0, 3 + Math.min(3, Math.floor(level / 2) + (level >= 4 ? 1 : 0)));
    notes.forEach((fr, i) => {
      const dt = i * 0.085;
      for (const [type, mul, vol] of [['triangle', 1, 0.1], ['sawtooth', 0.5, 0.025]]) {
        const o = ctx.createOscillator(); o.type = type; o.frequency.value = fr * mul;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t + dt); g.gain.linearRampToValueAtTime(vol, t + dt + 0.02);
        g.gain.setValueAtTime(vol, t + dt + 0.5); g.gain.exponentialRampToValueAtTime(0.001, t + dt + 1.4);
        o.connect(g).connect(master); o.start(t + dt); o.stop(t + dt + 1.5);
      }
    });
    if (level >= 4) this.goal(); // pépite ou phénomène : le stade explose
  },
  // petit signal : le match se fige pour un choix
  chime() {
    if (!enabled || !ensure()) return;
    const t = ctx.currentTime;
    [[659, 0], [988, 0.09]].forEach(([fr, dt]) => {
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = fr;
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t + dt); g.gain.linearRampToValueAtTime(0.12, t + dt + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + dt + 0.35);
      o.connect(g).connect(master); o.start(t + dt); o.stop(t + dt + 0.4);
    });
  },
};
