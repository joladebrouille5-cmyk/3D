// Vue 3D « caméra de télévision » du match (WebGL, Three.js embarqué : aucun téléchargement).
// Même état de match que la vue 2D : seuls positions et ballon sont lus, rien n'est simulé ici.
// Stade de nuit, pelouse tondue, joueurs articulés animés selon leur vitesse réelle, ombres croisées
// des quatre projecteurs, ballon avec sa hauteur réelle, caméra principale qui pivote et zoome.
import * as THREE from '../../assets/vendor/three.module.min.js';

const L = 105, W = 68, HX = L / 2, HZ = W / 2;
const PLAYER_SCALE = 1.12; // légèrement plus grands que nature : lisibles sur un téléphone
const MAXP = 40;

function hash(n) { let h = (n + 1) * 2654435761 >>> 0; h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13; return (h >>> 0) / 4294967296; }
function canvasTex(w, h, draw, { repeat = false, srgb = true } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = 8;
  return t;
}
const SKIN = ['#f1c9a5', '#e0ac82', '#c68a5e', '#9a6340', '#6f4428', '#4a2c1a'];
const HAIR = ['#17120e', '#2b1d12', '#4a3320', '#7a5a34', '#b8944f', '#111111', '#3a3a3a'];
const BOOTS = ['#111318', '#f2f2f2', '#e8402c', '#22c0d8', '#f5d21f', '#111318', '#111318'];

export class Pitch3D {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', alpha: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#05080f');
    this.scene.fog = new THREE.Fog('#070b14', 120, 330);
    this.camera = new THREE.PerspectiveCamera(30, 2, 1, 600);
    this.mirror = false;
    this.cam = { x: HX, y: HZ, zoom: 1 };
    this.look = new THREE.Vector3(0, 0, 0);
    this.fresh = true; // première image après un changement de vue : caméra placée sans transition
    this.state = new Map();
    this.kitKey = '';
    this.lastT = 0; this.shake = 0; this.celebrateUntil = 0; this.celebrateTeam = -1; this.prevOwner = null;
    this.#lights();
    this.#pitch();
    this.#stadium();
    this.#goals();
    this.#players();
    this.#ball();
    this.resize();
  }

  // ---------------------------------------------------------------- décor
  #lights() {
    this.scene.add(new THREE.HemisphereLight('#b8c8ee', '#1c3a22', 1.7));
    this.towers = [[-HX - 22, -HZ - 26], [HX + 22, -HZ - 26], [-HX - 22, HZ + 26], [HX + 22, HZ + 26]];
    for (const [x, z] of this.towers) {
      const d = new THREE.DirectionalLight('#fff4dc', 2.3);
      d.position.set(x, 46, z);
      this.scene.add(d);
    }
  }

  #pitch() {
    // pelouse : bandes de tonte, damier léger, usure devant les buts, grain
    const tex = canvasTex(1024, 664, (c, w, h) => {
      const bands = 14;
      for (let i = 0; i < bands; i++) { c.fillStyle = i % 2 ? '#2f7f3d' : '#2a7337'; c.fillRect((i * w) / bands, 0, w / bands + 1, h); }
      for (let j = 0; j < 9; j++) { if (j % 2) { c.fillStyle = 'rgba(255,255,255,0.028)'; c.fillRect(0, (j * h) / 9, w, h / 9); } }
      const g = c.createRadialGradient(w / 2, h / 2, h * 0.1, w / 2, h / 2, w * 0.62);
      g.addColorStop(0, 'rgba(255,255,220,0.07)'); g.addColorStop(1, 'rgba(0,0,0,0.16)');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      for (const gx of [0.045, 0.955]) { const u = c.createRadialGradient(gx * w, h / 2, 2, gx * w, h / 2, h * 0.14); u.addColorStop(0, 'rgba(120,100,60,0.22)'); u.addColorStop(1, 'rgba(120,100,60,0)'); c.fillStyle = u; c.fillRect(0, 0, w, h); }
      const img = c.getImageData(0, 0, w, h), d = img.data;
      for (let i = 0; i < d.length; i += 4) { const n = (hash(i) - 0.5) * 16; d[i] += n; d[i + 1] += n; d[i + 2] += n * 0.6; }
      c.putImageData(img, 0, 0);
    });
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(L, W), new THREE.MeshLambertMaterial({ map: tex }));
    grass.rotation.x = -Math.PI / 2;
    this.scene.add(grass);
    // abords : pelouse plus sombre puis piste
    const around = new THREE.Mesh(new THREE.PlaneGeometry(L + 16, W + 14), new THREE.MeshLambertMaterial({ color: '#235f2e' }));
    around.rotation.x = -Math.PI / 2; around.position.y = -0.02; this.scene.add(around);
    const track = new THREE.Mesh(new THREE.PlaneGeometry(L + 90, W + 90), new THREE.MeshLambertMaterial({ color: '#1a1f2b' }));
    track.rotation.x = -Math.PI / 2; track.position.y = -0.05; this.scene.add(track);

    // lignes : géométrie fine posée sur la pelouse (nettes à toutes les distances)
    const lineMat = new THREE.MeshBasicMaterial({ color: '#eef3ea', transparent: true, opacity: 0.9, depthWrite: false });
    const lines = new THREE.Group();
    const w = 0.14;
    const rect = (x1, z1, x2, z2) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(Math.abs(x2 - x1) || w, Math.abs(z2 - z1) || w), lineMat);
      m.rotation.x = -Math.PI / 2; m.position.set((x1 + x2) / 2, 0.012, (z1 + z2) / 2); lines.add(m);
    };
    const box = (x1, z1, x2, z2) => { rect(x1, z1, x2, z1); rect(x1, z2, x2, z2); rect(x1, z1, x1, z2); rect(x2, z1, x2, z2); };
    const arc = (cx, cz, r, a0, a1) => {
      const m = new THREE.Mesh(new THREE.RingGeometry(r - w / 2, r + w / 2, 48, 1, a0, a1 - a0), lineMat);
      m.rotation.x = -Math.PI / 2; m.position.set(cx, 0.012, cz); lines.add(m);
    };
    box(-HX, -HZ, HX, HZ); rect(0, -HZ, 0, HZ);
    arc(0, 0, 9.15, 0, Math.PI * 2);
    for (const s of [-1, 1]) {
      const gx = s * HX;
      box(gx, -20.16, gx - s * 16.5, 20.16); box(gx, -9.16, gx - s * 5.5, 9.16);
      // arc de cercle de la surface (angles dans le plan x/-z de l'anneau)
      const a = Math.acos(5.5 / 9.15);
      arc(gx - s * 11, 0, 9.15, s > 0 ? Math.PI - a : -a, s > 0 ? Math.PI + a : a);
      const spot = new THREE.Mesh(new THREE.CircleGeometry(0.16, 12), lineMat); spot.rotation.x = -Math.PI / 2; spot.position.set(gx - s * 11, 0.012, 0); lines.add(spot);
      for (const z of [-1, 1]) arc(gx, z * HZ, 1, s > 0 ? (z > 0 ? Math.PI / 2 : Math.PI) : (z > 0 ? 0 : -Math.PI / 2), s > 0 ? (z > 0 ? Math.PI : Math.PI * 1.5) : (z > 0 ? Math.PI / 2 : 0));
      // drapeaux de corner
      for (const z of [-1, 1]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.5, 6), new THREE.MeshLambertMaterial({ color: '#f4f4f0' }));
        pole.position.set(gx, 0.75, z * HZ); this.scene.add(pole);
        const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.3), new THREE.MeshBasicMaterial({ color: '#ffd65a', side: THREE.DoubleSide }));
        flag.position.set(gx - s * 0.22, 1.33, z * HZ); this.scene.add(flag);
      }
    }
    const c0 = new THREE.Mesh(new THREE.CircleGeometry(0.2, 12), lineMat); c0.rotation.x = -Math.PI / 2; c0.position.y = 0.012; lines.add(c0);
    this.scene.add(lines);
  }

  #crowdTexture(cols) {
    return canvasTex(512, 256, (c, w, h) => {
      c.fillStyle = '#0a0f1c'; c.fillRect(0, 0, w, h);
      const neutral = ['#2a3348', '#3b4560', '#1d2436', '#56607c', '#8d97ae', '#d8dbe4', '#6a4a3a'];
      let k = 0;
      for (let y = 5; y < h; y += 8) {
        c.fillStyle = 'rgba(255,255,255,0.03)'; c.fillRect(0, y + 4, w, 1.5); // gradins
        for (let x = 3 + ((y / 8) % 2) * 3; x < w; x += 6) {
          const u = hash(k++);
          if (u < 0.07) continue; // siège vide
          const col = u < 0.48 ? cols[hash(k * 7) < 0.72 ? 0 : 1] : neutral[(hash(k * 13) * neutral.length) | 0];
          c.globalAlpha = 0.55 + hash(k * 3) * 0.45;
          c.fillStyle = col; c.fillRect(x, y, 3.6, 4.4);
          c.fillStyle = SKIN[(hash(k * 5) * SKIN.length) | 0]; c.fillRect(x + 0.8, y - 2.2, 2, 2.2);
        }
      }
      c.globalAlpha = 1;
    }, { repeat: true });
  }

  #stadium() {
    const g = new THREE.Group();
    this.ledTex = canvasTex(1024, 48, (c, w, h) => {
      const gr = c.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#0d2a5c'); gr.addColorStop(0.5, '#123a7a'); gr.addColorStop(1, '#0d2a5c');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
      c.font = '900 30px "Big Shoulders Display", Impact, sans-serif'; c.textBaseline = 'middle'; c.fillStyle = '#e8f0ff';
      let x = 20; for (const t of ['ALLEZ !', 'NUIT DE MATCH', 'ALLEZ !', 'NUIT DE MATCH', 'ALLEZ !']) { const tw = c.measureText(t).width; if (x + tw > w - 10) break; c.fillText(t, x, h / 2 + 2); x += tw + 70; }
    }, { repeat: true });
    this.ledTex.repeat.set(4, 1);
    this.ledMat = new THREE.MeshBasicMaterial({ map: this.ledTex });
    this.standMats = [];
    const dark = new THREE.MeshLambertMaterial({ color: '#0d1320' });
    // quatre tribunes inclinées + toit ; `len` le long de la ligne, repère local : x le long, z vers l'extérieur
    const mk = (cx, cz, rotY, len) => {
      const s = new THREE.Group();
      const mat = new THREE.MeshLambertMaterial({ color: '#ffffff' });
      this.standMats.push({ mat, len });
      const depth = 30, rise = 21;
      const slope = new THREE.Mesh(new THREE.PlaneGeometry(len, Math.hypot(depth, rise)), mat);
      slope.rotation.x = -Math.PI / 2 - Math.atan2(rise, depth); slope.position.set(0, 2.6 + rise / 2, depth / 2);
      s.add(slope);
      const front = new THREE.Mesh(new THREE.BoxGeometry(len, 2.6, 0.6), dark); front.position.set(0, 1.3, -0.3); s.add(front);
      // bandeau lumineux en bas de la tribune
      const led = new THREE.Mesh(new THREE.PlaneGeometry(len, 1.1), this.ledMat); led.position.set(0, 1.6, -0.62); led.rotation.y = Math.PI; s.add(led);
      const back = new THREE.Mesh(new THREE.BoxGeometry(len, rise + 9, 1), dark); back.position.set(0, (rise + 9) / 2, depth + 0.5); s.add(back);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(len + 4, 0.8, depth * 0.78), new THREE.MeshLambertMaterial({ color: '#141b2b' }));
      roof.position.set(0, rise + 9.4, depth * 0.64); s.add(roof);
      // rampe d'éclairage sous le bord du toit
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(len * 0.92, 0.9), new THREE.MeshBasicMaterial({ color: '#fff6dc' }));
      strip.position.set(0, rise + 8.8, depth * 0.25 - 0.1); strip.rotation.x = Math.PI * 0.62; s.add(strip);
      s.position.set(cx, 0, cz); s.rotation.y = rotY;
      g.add(s);
    };
    mk(0, HZ + 9, 0, L + 30); mk(0, -HZ - 9, Math.PI, L + 30);
    mk(HX + 11, 0, Math.PI / 2, W + 16); mk(-HX - 11, 0, -Math.PI / 2, W + 16);
    // angles fermés
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(26, 30, 26), dark); c.position.set(sx * (HX + 30), 15, sz * (HZ + 28)); g.add(c);
    }
    // mâts d'éclairage : batteries de projecteurs et halos
    const glow = canvasTex(128, 128, (c, w, h) => { const r = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); r.addColorStop(0, 'rgba(255,250,235,1)'); r.addColorStop(0.18, 'rgba(255,244,214,0.75)'); r.addColorStop(0.5, 'rgba(255,236,190,0.16)'); r.addColorStop(1, 'rgba(255,236,190,0)'); c.fillStyle = r; c.fillRect(0, 0, w, h); });
    this.glows = [];
    for (const [x, z] of this.towers) {
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 46, 8), dark); mast.position.set(x, 23, z); g.add(mast);
      const bank = new THREE.Mesh(new THREE.PlaneGeometry(9, 5), new THREE.MeshBasicMaterial({ color: '#fffdf2' }));
      bank.position.set(x, 47, z); bank.lookAt(0, 0, 0); g.add(bank);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.95 }));
      sp.position.set(x * 0.985, 47, z * 0.985); sp.scale.set(44, 44, 1); g.add(sp); this.glows.push(sp);
    }
    // panneaux lumineux autour du terrain (texte défilant)
    this.boardTex = canvasTex(1024, 64, (c, w, h) => {
      c.fillStyle = '#0b1220'; c.fillRect(0, 0, w, h);
      c.font = '900 40px "Big Shoulders Display", Impact, sans-serif'; c.textBaseline = 'middle';
      const words = ['GENERATION FOOTBALL', '★', 'CENTRE DE FORMATION', '★'];
      let x = 12;
      for (let i = 0; i < 12; i++) {
        const t = words[i % words.length], tw = c.measureText(t).width;
        if (x + tw > w - 10) break; // un mot entier ou rien : pas de texte coupé au raccord
        c.fillStyle = i % 2 ? '#ffd65a' : '#eef2ea'; c.fillText(t, x, h / 2 + 2); x += tw + 34;
      }
    }, { repeat: true });
    this.boardTex.repeat.set(3, 1);
    const boardMat = new THREE.MeshBasicMaterial({ map: this.boardTex });
    const board = (cx, cz, len, rotY) => { const b = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.95), boardMat); b.position.set(cx, 0.5, cz); b.rotation.y = rotY; g.add(b); };
    board(0, -HZ - 4.2, L + 6, 0); board(0, HZ + 4.2, L + 6, Math.PI);
    board(-HX - 5, 0, W - 12, Math.PI / 2); board(HX + 5, 0, W - 12, -Math.PI / 2);
    // flashs d'appareils photo dans le public
    const pts = [];
    for (let i = 0; i < 360; i++) {
      const side = i % 4, u = hash(i * 3) - 0.5, v = hash(i * 7);
      const d = 3 + v * 26, y = 3.4 + v * 19;
      if (side === 0) pts.push(u * (L + 26), y, HZ + 9 + d); else if (side === 1) pts.push(u * (L + 26), y, -HZ - 9 - d);
      else if (side === 2) pts.push(HX + 11 + d, y, u * (W + 12)); else pts.push(-HX - 11 - d, y, u * (W + 12));
    }
    this.flashGeo = new THREE.BufferGeometry();
    this.flashAll = new Float32Array(pts);
    this.flashGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(30 * 3), 3));
    this.flashes = new THREE.Points(this.flashGeo, new THREE.PointsMaterial({ color: '#ffffff', size: 1.5, sizeAttenuation: true, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.flashes.frustumCulled = false;
    g.add(this.flashes);
    this.scene.add(g);
  }

  #goals() {
    const post = new THREE.MeshLambertMaterial({ color: '#f6f6f2', emissive: '#555555' });
    const net = canvasTex(64, 64, (c, w, h) => { c.clearRect(0, 0, w, h); c.strokeStyle = 'rgba(240,244,250,0.55)'; c.lineWidth = 2; c.strokeRect(0, 0, w, h); }, { repeat: true });
    for (const s of [-1, 1]) {
      const gx = s * HX, grp = new THREE.Group();
      const cyl = (len, x, y, z, rx, rz) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, len, 10), post); m.position.set(x, y, z); m.rotation.set(rx, 0, rz); grp.add(m); };
      cyl(2.44, 0, 1.22, -3.66, 0, 0); cyl(2.44, 0, 1.22, 3.66, 0, 0); cyl(7.44, 0, 2.44, 0, Math.PI / 2, 0);
      const mat = (rx, ry) => { const t = net.clone(); t.needsUpdate = true; t.repeat.set(rx, ry); return new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.DoubleSide, depthWrite: false }); };
      const back = new THREE.Mesh(new THREE.PlaneGeometry(7.32, 2.44), mat(30, 10)); back.rotation.y = Math.PI / 2; back.position.set(s * 2, 1.22, 0); grp.add(back);
      const top = new THREE.Mesh(new THREE.PlaneGeometry(2, 7.32), mat(8, 30)); top.rotation.x = -Math.PI / 2; top.position.set(s * 1, 2.44, 0); grp.add(top);
      for (const z of [-3.66, 3.66]) { const side = new THREE.Mesh(new THREE.PlaneGeometry(2, 2.44), mat(8, 10)); side.position.set(s * 1, 1.22, z); grp.add(side); }
      grp.position.x = gx;
      this.scene.add(grp);
    }
  }

  // ---------------------------------------------------------------- joueurs
  // Chaque joueur est une petite hiérarchie d'articulations (nœuds sans maillage) ; les membres sont
  // dessinés par lots (InstancedMesh) : une quinzaine d'appels de dessin pour les deux équipes.
  #players() {
    const lam = () => new THREE.MeshLambertMaterial({ color: '#ffffff' });
    const cap = (r, len, y0 = 0) => { const g = new THREE.CapsuleGeometry(r, len, 4, 10); g.translate(0, y0 - len / 2, 0); return g; };
    const torso = new THREE.CylinderGeometry(0.2, 0.165, 0.5, 14); torso.scale(1, 1, 0.66); torso.translate(0, 0.27, 0);
    const shoulders = new THREE.SphereGeometry(0.2, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2); shoulders.scale(1.02, 0.42, 0.68); shoulders.translate(0, 0.52, 0);
    const shorts = new THREE.CylinderGeometry(0.168, 0.185, 0.22, 14); shorts.scale(1, 1, 0.72); shorts.translate(0, -0.06, 0);
    const head = new THREE.SphereGeometry(0.105, 16, 12); head.scale(0.95, 1.14, 1.02);
    const hair = new THREE.SphereGeometry(0.112, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.52); hair.scale(0.97, 1.12, 1.06); hair.translate(0, 0.012, -0.012);
    const foot = new THREE.BoxGeometry(0.095, 0.075, 0.26); foot.translate(0, -0.035, 0.075);
    // [clé, géométrie, canal de couleur]
    this.parts = [
      ['torso', torso, 'shirt'], ['shoulders', shoulders, 'shirt'], ['hips', shorts, 'shorts'],
      ['neck', new THREE.CylinderGeometry(0.05, 0.055, 0.1, 8), 'skin'], ['head', head, 'skin'], ['hair', hair, 'hair'],
      ['armL', cap(0.052, 0.2, -0.03), 'sleeve'], ['armR', cap(0.052, 0.2, -0.03), 'sleeve'],
      ['foreL', cap(0.042, 0.2, -0.02), 'skin'], ['foreR', cap(0.042, 0.2, -0.02), 'skin'],
      ['handL', new THREE.SphereGeometry(0.046, 8, 6), 'hand'], ['handR', new THREE.SphereGeometry(0.046, 8, 6), 'hand'],
      ['thighL', cap(0.082, 0.3, -0.05), 'thigh'], ['thighR', cap(0.082, 0.3, -0.05), 'thigh'],
      ['shinL', cap(0.057, 0.3, -0.05), 'socks'], ['shinR', cap(0.057, 0.3, -0.05), 'socks'],
      ['footL', foot, 'boots'], ['footR', foot, 'boots'],
    ].map(([key, geo, ch]) => {
      const mesh = new THREE.InstancedMesh(geo, lam(), MAXP);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false; mesh.count = 0;
      this.scene.add(mesh);
      return { key, ch, mesh };
    });
    this.rigs = [];
    // ombres : quatre par joueur (une par projecteur), plus celles du ballon
    const sh = canvasTex(64, 64, (c, w, h) => { const r = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); r.addColorStop(0, 'rgba(0,0,0,0.85)'); r.addColorStop(0.6, 'rgba(0,0,0,0.4)'); r.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = r; c.fillRect(0, 0, w, h); }, { srgb: false });
    const sg = new THREE.PlaneGeometry(1, 1); sg.rotateX(-Math.PI / 2);
    this.shadows = new THREE.InstancedMesh(sg, new THREE.MeshBasicMaterial({ map: sh, transparent: true, opacity: 0.3, depthWrite: false }), (MAXP + 1) * 4);
    this.shadows.frustumCulled = false; this.shadows.count = 0; this.shadows.renderOrder = 1;
    this.scene.add(this.shadows);
    // repère du joueur de l'utilisateur : anneau au sol et flèche au-dessus de la tête
    this.meRing = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.8, 32), new THREE.MeshBasicMaterial({ color: '#ffd65a', transparent: true, opacity: 0.95, depthWrite: false }));
    this.meRing.rotation.x = -Math.PI / 2; this.meRing.visible = false; this.meRing.renderOrder = 2; this.scene.add(this.meRing);
    this.meArrow = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.36, 4), new THREE.MeshBasicMaterial({ color: '#ffd65a' }));
    this.meArrow.rotation.x = Math.PI; this.meArrow.visible = false; this.scene.add(this.meArrow);
    this.dummy = new THREE.Object3D();
    this.col = new THREE.Color();
  }

  #rig(i) {
    if (this.rigs[i]) return this.rigs[i];
    const N = () => new THREE.Object3D();
    const r = { root: N(), body: N(), hips: N(), spine: N(), torso: N(), shoulders: N(), neck: N(), head: N(), hair: N() };
    r.root.add(r.body); r.body.add(r.hips); r.hips.position.y = 0.93;
    r.hips.add(r.spine); r.spine.add(r.torso, r.shoulders, r.neck);
    r.neck.position.y = 0.6; r.neck.add(r.head); r.head.position.y = 0.14; r.head.add(r.hair);
    for (const [s, sx] of [['L', 1], ['R', -1]]) {
      const arm = N(), fore = N(), hand = N(), thigh = N(), shin = N(), foot = N();
      arm.position.set(sx * 0.235, 0.5, 0); r.spine.add(arm);
      fore.position.y = -0.27; arm.add(fore); hand.position.y = -0.27; fore.add(hand);
      thigh.position.set(sx * 0.09, -0.04, 0); r.hips.add(thigh);
      shin.position.y = -0.42; thigh.add(shin); foot.position.y = -0.4; shin.add(foot);
      Object.assign(r, { [`arm${s}`]: arm, [`fore${s}`]: fore, [`hand${s}`]: hand, [`thigh${s}`]: thigh, [`shin${s}`]: shin, [`foot${s}`]: foot });
    }
    // numéro dans le dos
    r.numMat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    r.num = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.26), r.numMat);
    r.num.position.set(0, 0.32, -0.14); r.num.rotation.y = Math.PI;
    r.spine.add(r.num);
    r.root.scale.setScalar(PLAYER_SCALE);
    this.scene.add(r.root);
    this.rigs[i] = r;
    return r;
  }

  #numberTex(num, color) {
    return canvasTex(64, 64, (c, w, h) => { c.clearRect(0, 0, w, h); c.fillStyle = color; c.font = '900 50px "Big Shoulders Display", Impact, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(num), w / 2, h / 2 + 3); });
  }

  // couleurs des tenues et du public quand les équipes changent
  #kits(teams, players) {
    const key = teams.map((t) => `${t.colors.primary}${t.colors.secondary}${t.colors.text}`).join('|') + players.length;
    if (key === this.kitKey) return;
    this.kitKey = key;
    this.looks = players.map((p) => {
      const t = teams[p.team], gk = p.role === 'GK';
      const shirt = gk ? (t.colors.gk || (p.team === 0 ? '#1f9d55' : '#e8590c')) : t.colors.primary;
      const second = gk ? '#111827' : t.colors.secondary;
      const lum = (hex) => { const n = parseInt(hex.slice(1), 16); return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255); };
      const shorts = gk ? shirt : (Math.abs(lum(second) - lum(shirt)) < 40 ? shirt : second);
      const h = hash(p.id * 31 + 7), h2 = hash(p.id * 17 + 3);
      const skin = SKIN[(h * SKIN.length) | 0];
      return {
        shirt, sleeve: shirt, shorts, socks: gk ? shirt : t.colors.primary, skin, thigh: skin, hand: gk ? '#f3f3ef' : skin,
        hair: HAIR[(h2 * HAIR.length) | 0], boots: BOOTS[(hash(p.id * 5 + 1) * BOOTS.length) | 0],
        bald: h2 > 0.9, tall: 0.95 + hash(p.id * 13) * 0.1, text: gk ? '#ffffff' : t.colors.text,
      };
    });
    players.forEach((p, i) => {
      const r = this.#rig(i);
      r.numMat.map?.dispose(); r.numMat.map = this.#numberTex(p.num ?? '', this.looks[i].text); r.numMat.needsUpdate = true;
    });
    const crowd = this.#crowdTexture([teams[0].colors.primary, teams[1].colors.primary === teams[0].colors.primary ? teams[1].colors.secondary : teams[1].colors.primary]);
    for (const { mat, len } of this.standMats) {
      mat.map?.dispose();
      const t = crowd.clone(); t.flipY = false; t.needsUpdate = true; t.repeat.set(len / 22, 3.2); // têtes vers le haut des gradins
      mat.map = t; mat.needsUpdate = true;
    }
    crowd.dispose();
  }

  #ball() {
    const tex = canvasTex(256, 128, (c, w, h) => {
      c.fillStyle = '#f7f7f3'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#16181d';
      for (let i = 0; i < 12; i++) { const x = ((i % 6) + (i < 6 ? 0.25 : 0.75)) * (w / 6), y = i < 6 ? h * 0.3 : h * 0.72; c.beginPath(); for (let k = 0; k < 5; k++) { const a = (k * 2 * Math.PI) / 5 - Math.PI / 2; c.lineTo(x + Math.cos(a) * 11, y + Math.sin(a) * 11); } c.closePath(); c.fill(); }
    });
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(0.16, 18, 14), new THREE.MeshLambertMaterial({ map: tex, emissive: '#3a3a3a' }));
    this.scene.add(this.ball);
    this.ballPrev = null;
  }

  // ---------------------------------------------------------------- caméra
  resize() {
    const w = this.canvas.clientWidth || this.canvas.parentElement?.clientWidth || 300, h = this.canvas.clientHeight || this.canvas.parentElement?.clientHeight || 150;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
  setInset() { /* la vue 3D n'est pas utilisée pendant les choix */ }
  toWorld() { return { x: -99, y: -99 }; }
  reset() { this.fresh = true; this.state.clear(); this.ballPrev = null; this.prevOwner = null; }

  // même signature que la vue 2D : point visé (repère du terrain) et niveau de zoom
  follow(wx, wy, zoom, smooth = 0.12) {
    const k = this.fresh ? 1 : smooth;
    this.cam.x += (wx - this.cam.x) * k; this.cam.y += (wy - this.cam.y) * k;
    this.cam.zoom += (zoom - this.cam.zoom) * (this.fresh ? 1 : 0.1);
  }

  #placeCamera(dt) {
    const side = this.mirror ? -1 : 1; // l'équipe suivie attaque vers la droite de l'écran
    const tx = this.cam.x - HX, tz = this.cam.y - HZ;
    // caméra principale : en haut de la tribune, elle pivote et accompagne un peu l'action
    const z = Math.max(1, this.cam.zoom);
    const px = THREE.MathUtils.clamp(tx * 0.58, -30, 30);
    const pos = new THREE.Vector3(px, 27, side * (HZ + 36.5)); // passerelle des caméras, sous le toit
    const look = new THREE.Vector3(tx, 0.9, tz * 0.94);
    if (this.fresh) { this.camera.position.copy(pos); this.look.copy(look); }
    else { this.camera.position.lerp(pos, 0.08); this.look.lerp(look, 0.16); }
    const aspect = this.camera.aspect;
    // plan large : tout le terrain dans le cadre, quel que soit le format de l'écran
    const wide = THREE.MathUtils.clamp((2 * Math.atan((L * 0.56) / (85 * aspect)) * 180) / Math.PI, 26, 60);
    const fov = z <= 1.02 ? wide : Math.max(7, 30 / Math.pow(z, 1.6)); // plan serré façon réalisateur télé
    this.camera.fov += (fov - this.camera.fov) * (this.fresh ? 1 : 0.08);
    this.camera.updateProjectionMatrix();
    if (this.shake > 0) { this.shake -= dt; const a = this.shake * 0.5; this.camera.position.x += (Math.random() - 0.5) * a; this.camera.position.y += (Math.random() - 0.5) * a; }
    this.camera.lookAt(this.look);
    this.fresh = false;
  }

  celebrate(colors) {
    this.shake = 0.6;
    this.celebrateUntil = performance.now() + 3600;
    this.celebrateColor = colors?.primary ?? null;
  }

  // ---------------------------------------------------------------- image
  draw({ teams, players, ball, ownerId = null }) {
    const now = performance.now();
    const dt = Math.min(0.1, (now - (this.lastT || now)) / 1000) || 0.016; this.lastT = now;
    this.#kits(teams, players);
    const celebrating = now < this.celebrateUntil;
    if (this.prevOwner != null && ownerId !== this.prevOwner) { const s = this.state.get(this.prevOwner); if (s) s.kick = 1; }
    this.prevOwner = ownerId;

    let n = 0, ns = 0;
    const d = this.dummy;
    let me = null;
    for (let i = 0; i < players.length; i++) {
      const p = players[i], r = this.#rig(i), lk = this.looks[i];
      const on = p.onPitch && Number.isFinite(p.x);
      r.root.visible = !!on;
      if (!on || n >= MAXP) { this.state.delete(p.id); continue; }
      let s = this.state.get(p.id);
      if (!s) { s = { x: p.x, y: p.y, a: teams[p.team].dir > 0 ? 0 : Math.PI, v: 0, ph: hash(p.id) * 6, kick: 0, idle: hash(p.id * 9) * 6 }; this.state.set(p.id, s); }
      const dx = p.x - s.x, dy = p.y - s.y, dist = Math.hypot(dx, dy);
      const vNow = dist < 6 ? dist / dt : 0; // un saut (remplacement, coup d'envoi) n'est pas une course
      s.v += (Math.min(vNow, 9.5) - s.v) * 0.25;
      if (dist > 0.012 && dist < 6) {
        let da = Math.atan2(dy, dx) - s.a; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
        s.a += da * Math.min(1, 0.12 + s.v * 0.035);
        s.ph += (2 * Math.PI * dist) / (1.25 + 0.36 * s.v);
      } else if (s.v < 0.5 && ball) {
        // à l'arrêt : regarde le ballon
        let da = Math.atan2(ball.y - p.y, ball.x - p.x) - s.a; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
        s.a += da * 0.06;
      }
      s.x = p.x; s.y = p.y;
      s.kick = Math.max(0, s.kick - dt / 0.36);
      s.idle += dt;
      const v = s.v, run = Math.min(1, v / 7.5), move = Math.min(1, v / 1.2);
      const A = (0.18 + 0.75 * run) * move, K = (0.25 + 1.35 * run) * move, sw = Math.sin(s.ph), cw = Math.cos(s.ph);
      const gkReady = p.role === 'GK' && ball && Math.hypot(ball.x - p.x, ball.y - p.y) < 22 ? 1 : 0;
      const joy = celebrating && this.celebrateColor && teams[p.team].colors.primary === this.celebrateColor ? 1 : 0;

      r.root.position.set(p.x - HX, 0, p.y - HZ);
      r.root.rotation.y = Math.PI / 2 - s.a;
      r.root.scale.setScalar(PLAYER_SCALE * lk.tall);
      r.body.position.y = 0.035 * run * Math.abs(sw) - 0.05 * gkReady + (joy ? 0.12 * Math.abs(Math.sin(now / 130 + p.id)) : 0);
      r.spine.rotation.x = 0.04 + 0.2 * run + 0.12 * gkReady - 0.22 * Math.sin(Math.PI * s.kick);
      r.spine.rotation.y = 0.16 * A * sw;
      r.spine.rotation.z = 0.02 * Math.sin(s.idle * 1.3) * (1 - move);
      r.head.rotation.x = -0.12 * run;
      // jambes : cuisse en balancier, genou plié quand la jambe revient vers l'avant
      r.thighL.rotation.x = -A * sw - 0.1 * gkReady; r.thighR.rotation.x = A * sw - 0.1 * gkReady;
      r.shinL.rotation.x = 0.08 + K * Math.max(0, cw) + 0.25 * gkReady; r.shinR.rotation.x = 0.08 + K * Math.max(0, -cw) + 0.25 * gkReady;
      r.thighL.rotation.z = 0.05 + 0.1 * gkReady; r.thighR.rotation.z = -0.05 - 0.1 * gkReady;
      r.footL.rotation.x = -0.25 * Math.max(0, sw) * run; r.footR.rotation.x = -0.25 * Math.max(0, -sw) * run;
      if (s.kick > 0) { // frappe : la jambe droite arme puis traverse le ballon
        const k = 1 - s.kick, swing = k < 0.35 ? 0.9 * (k / 0.35) : 0.9 - 2.2 * ((k - 0.35) / 0.65);
        r.thighR.rotation.x = swing; r.shinR.rotation.x = k < 0.35 ? 1.3 * (k / 0.35) : Math.max(0, 1.3 - 3 * (k - 0.35));
      }
      // bras : opposés aux jambes, coude plié en course
      const elbow = 0.25 + 1.15 * run;
      r.armL.rotation.set(0.8 * A * sw, 0, 0.13 + 0.05 * run); r.armR.rotation.set(-0.8 * A * sw, 0, -0.13 - 0.05 * run);
      r.foreL.rotation.x = -elbow; r.foreR.rotation.x = -elbow;
      if (gkReady) { r.armL.rotation.set(-0.5, 0, 0.75); r.armR.rotation.set(-0.5, 0, -0.75); r.foreL.rotation.x = -0.7; r.foreR.rotation.x = -0.7; }
      if (joy) { const w2 = 0.25 * Math.sin(now / 110 + p.id); r.armL.rotation.set(-2.7, 0, 0.5 + w2); r.armR.rotation.set(-2.7, 0, -0.5 - w2); r.foreL.rotation.x = -0.25; r.foreR.rotation.x = -0.25; }
      r.hair.scale.setScalar(lk.bald ? 0.001 : 1);
      r.root.updateMatrixWorld(true);
      for (const part of this.parts) {
        part.mesh.setMatrixAt(n, r[part.key].matrixWorld);
        part.mesh.setColorAt(n, this.col.set(lk[part.ch]));
      }
      // ombres croisées des projecteurs
      for (const [lx, lz] of this.towers) {
        const ax = (p.x - HX) - lx, az = (p.y - HZ) - lz, al = Math.hypot(ax, az) || 1;
        const len = 1.0 + al * 0.016;
        d.position.set(p.x - HX + (ax / al) * len * 0.5, 0.02, p.y - HZ + (az / al) * len * 0.5);
        d.rotation.set(0, -Math.atan2(az, ax), 0); d.scale.set(len + 0.5, 1, 0.62);
        d.updateMatrix(); this.shadows.setMatrixAt(ns++, d.matrix);
      }
      if (p.isUser) me = { p, lk };
      n++;
    }
    for (let i = players.length; i < this.rigs.length; i++) this.rigs[i].root.visible = false;
    for (const part of this.parts) { part.mesh.count = n; part.mesh.instanceMatrix.needsUpdate = true; if (part.mesh.instanceColor) part.mesh.instanceColor.needsUpdate = true; }

    // ballon : hauteur réelle, rotation selon le déplacement, ombres qui s'écartent avec la hauteur
    if (ball && Number.isFinite(ball.x)) {
      const bz = Math.max(0, ball.z || 0);
      this.ball.visible = true;
      this.ball.position.set(ball.x - HX, 0.16 + bz, ball.y - HZ);
      if (this.ballPrev) { const mx = ball.x - this.ballPrev.x, mz = ball.y - this.ballPrev.y; if (Math.hypot(mx, mz) < 8) { this.ball.rotation.z -= mx / 0.16; this.ball.rotation.x += mz / 0.16; } }
      this.ballPrev = { x: ball.x, y: ball.y };
      for (const [lx, lz] of this.towers) {
        const ax = (ball.x - HX) - lx, az = (ball.y - HZ) - lz, al = Math.hypot(ax, az) || 1;
        const off = 0.12 + bz * (al / 46); // plus le ballon est haut, plus son ombre s'éloigne
        d.position.set(ball.x - HX + (ax / al) * off, 0.021, ball.y - HZ + (az / al) * off);
        d.rotation.set(0, 0, 0); const sc = 0.42 + Math.min(1.2, bz * 0.12); d.scale.set(sc, 1, sc);
        d.updateMatrix(); this.shadows.setMatrixAt(ns++, d.matrix);
      }
    } else this.ball.visible = false;
    this.shadows.count = ns; this.shadows.instanceMatrix.needsUpdate = true;

    // repère de ton joueur
    if (me) {
      const pulse = 1 + 0.08 * Math.sin(now / 220);
      this.meRing.visible = this.meArrow.visible = true;
      this.meRing.position.set(me.p.x - HX, 0.03, me.p.y - HZ); this.meRing.scale.setScalar(pulse);
      this.meArrow.position.set(me.p.x - HX, 2.45 * me.lk.tall + 0.1 * Math.sin(now / 260), me.p.y - HZ);
      this.meArrow.rotation.y = now / 600;
    } else this.meRing.visible = this.meArrow.visible = false;

    // vie du stade : panneaux défilants, flashs dans le public (plus nombreux sur un but)
    this.boardTex.offset.x = (now / 14000) % 1;
    this.ledTex.offset.x = -(now / 22000) % 1;
    const fa = this.flashGeo.attributes.position, total = this.flashAll.length / 3;
    const count = celebrating ? 30 : 5;
    for (let i = 0; i < 30; i++) {
      const j = i < count ? ((Math.random() * total) | 0) * 3 : -1;
      fa.setXYZ(i, j < 0 ? 0 : this.flashAll[j], j < 0 ? -50 : this.flashAll[j + 1], j < 0 ? 0 : this.flashAll[j + 2]);
    }
    fa.needsUpdate = true;

    this.#placeCamera(dt);
    this.renderer.render(this.scene, this.camera);
  }

  dispose() { this.renderer.dispose(); }
}
