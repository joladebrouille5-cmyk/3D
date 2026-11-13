// Vue 3D « retransmission télé » du match (WebGL, Three.js embarqué : aucun téléchargement).
// Même état de match que la vue 2D : seuls positions et ballon sont lus, rien n'est simulé ici.
// Rendu réaliste à la mesure d'un téléphone : matériaux physiques (PBR) et éclairage d'environnement, ombres
// portées en temps réel, pelouse détaillée (tonte, grain, usure, pluie qui la fait briller), joueurs aux
// formes anatomiques et maillots à motifs, foule animée, nuit sous les projecteurs ou jour au soleil, pluie et
// neige, halo des projecteurs (bloom), anticrénelage et étalonnage façon caméra de télévision.
// Trois paliers de qualité, choisis et ajustés selon la fluidité réelle de l'appareil.
import * as THREE from '../../assets/vendor/three.module.min.js';
import { EffectComposer } from '../../assets/vendor/three-addons/EffectComposer.js';
import { RenderPass } from '../../assets/vendor/three-addons/RenderPass.js';
import { ShaderPass } from '../../assets/vendor/three-addons/ShaderPass.js';
import { UnrealBloomPass } from '../../assets/vendor/three-addons/UnrealBloomPass.js';
import { OutputPass } from '../../assets/vendor/three-addons/OutputPass.js';
import { FXAAShader } from '../../assets/vendor/three-addons/FXAAShader.js';
import { RoomEnvironment } from '../../assets/vendor/three-addons/RoomEnvironment.js';

const L = 105, W = 68, HX = L / 2, HZ = W / 2;
const PLAYER_SCALE = 1.1;
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
// carte de relief à partir d'un bruit (pelouse, tissu)
function noiseNormal(size, scale, strength, seed = 1) {
  return canvasTex(size, size, (c, w, h) => {
    const hgt = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) hgt[y * w + x] = hash((x * 73856093) ^ (y * 19349663) ^ seed) * (1 - scale) + scale * hash(((x >> 2) * 83492791) ^ ((y >> 2) * 2654435) ^ seed);
    const img = c.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const l = hgt[y * w + ((x + w - 1) % w)], r = hgt[y * w + ((x + 1) % w)], u = hgt[((y + h - 1) % h) * w + x], d = hgt[((y + 1) % h) * w + x];
      let nx = (l - r) * strength, ny = (u - d) * strength, nz = 1; const n = Math.hypot(nx, ny, nz); nx /= n; ny /= n; nz /= n;
      const i = (y * w + x) * 4; img.data[i] = (nx * 0.5 + 0.5) * 255; img.data[i + 1] = (ny * 0.5 + 0.5) * 255; img.data[i + 2] = (nz * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
    }
    c.putImageData(img, 0, 0);
  }, { repeat: true, srgb: false });
}
const SKIN = ['#f1c9a5', '#e3b18a', '#c99068', '#a26a45', '#7a4b2e', '#57341f'];
const HAIR = ['#17120e', '#2b1d12', '#4a3320', '#7a5a34', '#b8944f', '#0e0e0e', '#3a3a3a'];
const BOOTS = ['#111318', '#f2f2f2', '#e8402c', '#22c0d8', '#f5d21f', '#111318', '#ff6b1a'];
const lum = (hex) => { const n = parseInt(String(hex).slice(1), 16); return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255); };

const QUALITY_KEY = 'generation-football.q3d';
// paliers : 0 = complet (ombres fines, halo, anticrénelage), 1 = ombres moyennes sans post-traitement, 2 = minimal
const PIXEL_RATIO = [(dpr) => Math.min(dpr, 1.75), (dpr) => Math.min(dpr, 1.25), () => 0.85];

// profil de révolution (rayon, hauteur) → géométrie de tour (torse, membres)
const lathe = (pts, seg = 16) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);

export class Pitch3D {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', alpha: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 2, 1, 900);
    this.mirror = false;
    this.cam = { x: HX, y: HZ, zoom: 1 };
    this.look = new THREE.Vector3(0, 0, 0);
    this.fresh = true;
    this.state = new Map();
    this.kitKey = '';
    this.lastT = 0; this.shake = 0; this.celebrateUntil = 0; this.prevOwner = null; this.ballPrev = null; this.ballVel = { x: 0, y: 0 };
    this.quality = 0; try { this.quality = Math.min(2, Number(localStorage.getItem(QUALITY_KEY)) || 0); } catch { /* stockage indisponible */ }
    this.frameMs = 16; this.frames = 0;
    this.cond = { night: true, weather: null };
    // éclairage d'environnement (reflets sur le ballon, les maillots, les poteaux)
    const pm = new THREE.PMREMGenerator(this.renderer);
    this.envMap = pm.fromScene(new RoomEnvironment(this.renderer), 0.04).texture;
    pm.dispose();
    this.scene.environment = this.envMap;
    this.#sky();
    this.#lights();
    this.#pitch();
    this.#stadium();
    this.#goals();
    this.#players();
    this.#ball();
    this.#weather();
    this.#post();
    this.setConditions({ night: true, weather: null });
    this.#applyQuality();
    this.resize();
  }

  // ---------------------------------------------------------------- ciel, lumière, conditions
  #sky() {
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color('#03060d') }, horizon: { value: new THREE.Color('#141c2c') }, sunDir: { value: new THREE.Vector3(0.3, 0.6, -0.7).normalize() }, sunAmt: { value: 0 } },
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir; uniform float sunAmt; varying vec3 vDir;
        void main(){ float h = clamp(vDir.y, 0.0, 1.0); vec3 c = mix(horizon, top, pow(h, 0.55));
          float s = max(dot(normalize(vDir), sunDir), 0.0); c += sunAmt * (vec3(1.0,0.9,0.7) * pow(s, 600.0) * 6.0 + vec3(1.0,0.85,0.6) * pow(s, 8.0) * 0.25);
          gl_FragColor = vec4(c, 1.0); }`,
    });
    this.skyDome = new THREE.Mesh(new THREE.SphereGeometry(700, 32, 16), this.skyMat);
    this.scene.add(this.skyDome);
    const pts = [];
    for (let i = 0; i < 700; i++) { const a = hash(i) * Math.PI * 2, e = 0.08 + hash(i * 7) * 1.3, r = 650; pts.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.stars = new THREE.Points(g, new THREE.PointsMaterial({ color: '#cfd8ff', size: 1.4, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.7 }));
    this.scene.add(this.stars);
  }

  #lights() {
    this.hemi = new THREE.HemisphereLight('#b8c8ee', '#2a4a2a', 0.6);
    this.scene.add(this.hemi);
    // lumière principale (soleil ou batterie de projecteurs) : ombres portées en temps réel
    this.key = new THREE.DirectionalLight('#fff4e0', 2.6);
    this.key.castShadow = true;
    const sc = this.key.shadow.camera; sc.left = -78; sc.right = 78; sc.top = 62; sc.bottom = -62; sc.near = 10; sc.far = 300;
    this.key.shadow.bias = -0.0004; this.key.shadow.normalBias = 0.03;
    this.scene.add(this.key); this.scene.add(this.key.target);
    // projecteurs des trois autres coins : éclairage d'appoint sans ombre (les ombres de contact suffisent)
    this.towers = [[-HX - 22, -HZ - 26], [HX + 22, -HZ - 26], [-HX - 22, HZ + 26], [HX + 22, HZ + 26]];
    this.fills = this.towers.slice(1).map(([x, z]) => { const d = new THREE.DirectionalLight('#fff4dc', 0.9); d.position.set(x, 60, z); this.scene.add(d); return d; });
  }

  // nuit sous les projecteurs ou jour au soleil ; pluie ou neige
  setConditions({ night = this.cond.night, weather = this.cond.weather } = {}) {
    this.cond = { night, weather };
    const wet = weather === 'pluie', snow = weather === 'neige', grey = wet || snow || weather === 'nuages' || weather === 'vent';
    if (night) {
      this.skyMat.uniforms.top.value.set('#02040a'); this.skyMat.uniforms.horizon.value.set(grey ? '#1a1f2a' : '#0f1626'); this.skyMat.uniforms.sunAmt.value = 0;
      this.key.position.set(-HX - 22, 62, -HZ - 26); this.key.color.set('#fff3dc'); this.key.intensity = 2.4;
      this.fills.forEach((f) => { f.intensity = 0.95; });
      this.hemi.color.set('#9fb0d8'); this.hemi.groundColor.set('#1e3a22'); this.hemi.intensity = 0.45;
      this.scene.fog = new THREE.Fog(grey ? '#11151d' : '#070b14', 150, 520);
      this.stars.visible = !grey; this.renderer.toneMappingExposure = 1.05;
    } else {
      this.skyMat.uniforms.top.value.set(grey ? '#6e7887' : '#2f6fc4'); this.skyMat.uniforms.horizon.value.set(grey ? '#a9b0b8' : '#b9d4ee'); this.skyMat.uniforms.sunAmt.value = grey ? 0 : 1;
      this.key.position.set(-70, 95, -55); this.key.color.set(grey ? '#e8edf2' : '#fff1d6'); this.key.intensity = grey ? 1.3 : 3.2;
      this.skyMat.uniforms.sunDir.value.copy(this.key.position).normalize();
      this.fills.forEach((f) => { f.intensity = 0.15; });
      this.hemi.color.set(grey ? '#c9d0d8' : '#cfe3ff'); this.hemi.groundColor.set('#3b5a2e'); this.hemi.intensity = grey ? 1.3 : 0.85;
      this.scene.fog = new THREE.Fog(grey ? '#9aa3ad' : '#b9d4ee', 220, 760);
      this.stars.visible = false; this.renderer.toneMappingExposure = grey ? 1.05 : 0.95;
    }
    this.key.target.position.set(0, 0, 0);
    // pelouse mouillée : plus brillante, plus sombre
    if (this.grassMat) { this.grassMat.roughness = wet ? 0.42 : snow ? 0.75 : 0.9; this.grassMat.color.set(wet ? '#c9d4c6' : snow ? '#f2f6f8' : '#ffffff'); this.grassMat.envMapIntensity = wet ? 0.8 : 0.25; }
    for (const g of this.glows ?? []) g.visible = night;
    // reflets de l'environnement : discrets la nuit, plus présents au soleil
    for (const part of this.parts ?? []) part.mesh.material.envMapIntensity = night ? 0.28 : 0.5;
    if (this.bloom) this.bloom.strength = night ? 0.32 : 0.08;
    if (this.rain) { this.rain.visible = wet; this.snow.visible = snow; }
  }

  // ---------------------------------------------------------------- pelouse
  #pitch() {
    // pelouse : bandes de tonte (14 dans la longueur, 9 dans la largeur, en damier léger), usure, grain
    const tex = canvasTex(2048, 1328, (c, w, h) => {
      const bands = 14;
      for (let i = 0; i < bands; i++) { c.fillStyle = i % 2 ? '#3b8a45' : '#337c3d'; c.fillRect((i * w) / bands, 0, w / bands + 1, h); }
      for (let j = 0; j < 9; j++) if (j % 2) { c.fillStyle = 'rgba(255,255,255,0.025)'; c.fillRect(0, (j * h) / 9, w, h / 9); }
      // usure : surfaces de but, point de penalty, rond central (terre et herbe plus claire)
      const wear = (x, y, r, a) => { const u = c.createRadialGradient(x, y, 1, x, y, r); u.addColorStop(0, `rgba(122,104,64,${a})`); u.addColorStop(0.55, `rgba(122,110,70,${a * 0.45})`); u.addColorStop(1, 'rgba(120,110,70,0)'); c.fillStyle = u; c.fillRect(x - r, y - r, r * 2, r * 2); };
      for (const gx of [0.012, 0.988]) { wear(gx * w, h / 2, h * 0.09, 0.42); wear(gx * w, h / 2, h * 0.17, 0.12); }
      for (const gx of [0.105, 0.895]) wear(gx * w, h / 2, h * 0.05, 0.25);
      wear(w / 2, h / 2, h * 0.08, 0.12);
      // grain : touffes, nuances
      const img = c.getImageData(0, 0, w, h), d = img.data;
      for (let i = 0; i < d.length; i += 4) { const k = i >> 2, n = (hash(k) - 0.5) * 22 + (hash(k >> 3) - 0.5) * 10; d[i] += n * 0.8; d[i + 1] += n; d[i + 2] += n * 0.5; }
      c.putImageData(img, 0, 0);
    });
    tex.anisotropy = 16;
    const nrm = noiseNormal(256, 0.35, 2.2, 7);
    nrm.repeat.set(70, 45);
    this.grassMat = new THREE.MeshStandardMaterial({ map: tex, normalMap: nrm, normalScale: new THREE.Vector2(0.55, 0.55), roughness: 0.9, metalness: 0, envMapIntensity: 0.25 });
    // reflet de la tonte : une bande paraît claire ou sombre selon le sens de la caméra, comme à la télé
    this.grassMat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nfloat gHash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }')
        .replace('#include <map_fragment>', `#include <map_fragment>
          float band = step(0.5, fract((vWPos.x + 52.5) / 15.0));
          vec3 vdir = normalize(cameraPosition - vWPos);
          diffuseColor.rgb *= 1.0 + (band - 0.5) * 0.10 * sign(vdir.x + 0.0001);
          vec2 cell = floor(vWPos.xz * 9.0);
          diffuseColor.rgb *= 0.93 + 0.14 * gHash(cell);`);
    };
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(L, W), this.grassMat);
    grass.rotation.x = -Math.PI / 2; grass.receiveShadow = true;
    this.scene.add(grass);
    const aroundMat = new THREE.MeshStandardMaterial({ color: '#2b6a33', roughness: 0.95, normalMap: nrm });
    const around = new THREE.Mesh(new THREE.PlaneGeometry(L + 18, W + 16), aroundMat);
    around.rotation.x = -Math.PI / 2; around.position.y = -0.02; around.receiveShadow = true; this.scene.add(around);
    const track = new THREE.Mesh(new THREE.PlaneGeometry(L + 120, W + 120), new THREE.MeshStandardMaterial({ color: '#22262f', roughness: 0.9 }));
    track.rotation.x = -Math.PI / 2; track.position.y = -0.05; track.receiveShadow = true; this.scene.add(track);

    // lignes : peinture blanche légèrement mate, géométrie fine posée sur la pelouse
    const lineMat = new THREE.MeshStandardMaterial({ color: '#f4f6f0', roughness: 0.75, transparent: true, opacity: 0.92, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
    const lines = new THREE.Group();
    const w = 0.12;
    const rect = (x1, z1, x2, z2) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(Math.abs(x2 - x1) || w, Math.abs(z2 - z1) || w), lineMat);
      m.rotation.x = -Math.PI / 2; m.position.set((x1 + x2) / 2, 0.012, (z1 + z2) / 2); m.receiveShadow = true; lines.add(m);
    };
    const box = (x1, z1, x2, z2) => { rect(x1, z1, x2, z1); rect(x1, z2, x2, z2); rect(x1, z1, x1, z2); rect(x2, z1, x2, z2); };
    const arc = (cx, cz, r, a0, a1) => {
      const m = new THREE.Mesh(new THREE.RingGeometry(r - w / 2, r + w / 2, 64, 1, a0, a1 - a0), lineMat);
      m.rotation.x = -Math.PI / 2; m.position.set(cx, 0.012, cz); m.receiveShadow = true; lines.add(m);
    };
    box(-HX, -HZ, HX, HZ); rect(0, -HZ, 0, HZ);
    arc(0, 0, 9.15, 0, Math.PI * 2);
    this.flags = [];
    for (const s of [-1, 1]) {
      const gx = s * HX;
      box(gx, -20.16, gx - s * 16.5, 20.16); box(gx, -9.16, gx - s * 5.5, 9.16);
      const a = Math.acos(5.5 / 9.15);
      arc(gx - s * 11, 0, 9.15, s > 0 ? Math.PI - a : -a, s > 0 ? Math.PI + a : a);
      const spot = new THREE.Mesh(new THREE.CircleGeometry(0.15, 16), lineMat); spot.rotation.x = -Math.PI / 2; spot.position.set(gx - s * 11, 0.012, 0); lines.add(spot);
      for (const z of [-1, 1]) arc(gx, z * HZ, 1, s > 0 ? (z > 0 ? Math.PI / 2 : Math.PI) : (z > 0 ? 0 : -Math.PI / 2), s > 0 ? (z > 0 ? Math.PI : Math.PI * 1.5) : (z > 0 ? Math.PI / 2 : 0));
      // drapeaux de corner qui flottent
      for (const z of [-1, 1]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.5, 8), new THREE.MeshStandardMaterial({ color: '#f4f4f0', roughness: 0.4 }));
        pole.position.set(gx, 0.75, z * HZ); pole.castShadow = true; this.scene.add(pole);
        const fg = new THREE.PlaneGeometry(0.42, 0.3, 6, 1); fg.translate(0.21, 0, 0);
        const flag = new THREE.Mesh(fg, new THREE.MeshStandardMaterial({ color: '#ffcf3a', side: THREE.DoubleSide, roughness: 0.8 }));
        flag.position.set(gx, 1.33, z * HZ); flag.rotation.y = s > 0 ? Math.PI : 0; flag.castShadow = true; this.scene.add(flag); this.flags.push(flag);
      }
    }
    const c0 = new THREE.Mesh(new THREE.CircleGeometry(0.18, 16), lineMat); c0.rotation.x = -Math.PI / 2; c0.position.y = 0.012; lines.add(c0);
    this.scene.add(lines);
  }

  // ---------------------------------------------------------------- stade
  #crowdTexture(cols) {
    return canvasTex(1024, 512, (c, w, h) => {
      c.fillStyle = '#0b0f18'; c.fillRect(0, 0, w, h);
      const neutral = ['#2a3348', '#3b4560', '#1d2436', '#56607c', '#8d97ae', '#d8dbe4', '#6a4a3a', '#3d2f2a', '#b9b2a6'];
      let k = 0;
      for (let y = 6; y < h; y += 12) {
        // marche de gradin et rangée de sièges
        c.fillStyle = 'rgba(255,255,255,0.035)'; c.fillRect(0, y + 7, w, 2);
        c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(0, y + 9, w, 3);
        for (let x = 4 + ((y / 12) % 2) * 4; x < w; x += 8) {
          const u = hash(k++);
          if (u < 0.05) { c.fillStyle = '#1a2233'; c.fillRect(x, y + 2, 6, 5); continue; } // siège vide
          const col = u < 0.55 ? cols[hash(k * 7) < 0.75 ? 0 : 1] : neutral[(hash(k * 13) * neutral.length) | 0];
          const lean = (hash(k * 17) - 0.5) * 1.5;
          // épaules et buste
          c.fillStyle = col; c.beginPath(); c.ellipse(x + 3 + lean, y + 6, 3.4, 3.2, 0, Math.PI, 0); c.fill(); c.fillRect(x - 0.4 + lean, y + 6, 6.8, 3);
          // écharpe aux couleurs du club, de temps en temps
          if (hash(k * 23) < 0.18) { c.fillStyle = cols[hash(k * 29) < 0.5 ? 0 : 1]; c.fillRect(x + 1 + lean, y + 4.6, 4, 1.4); }
          // tête et cheveux
          const sk = SKIN[(hash(k * 5) * SKIN.length) | 0];
          c.fillStyle = sk; c.beginPath(); c.arc(x + 3 + lean, y + 1.4, 2.1, 0, Math.PI * 2); c.fill();
          c.fillStyle = HAIR[(hash(k * 11) * HAIR.length) | 0]; c.beginPath(); c.arc(x + 3 + lean, y + 0.9, 2.15, Math.PI, 0); c.fill();
          // bras levés (ambiance)
          if (hash(k * 31) < 0.06) { c.fillStyle = sk; c.fillRect(x + 6 + lean, y - 3, 1.2, 5); }
        }
      }
      // éclairage : légère ombre vers le haut de la tribune (le toit)
      const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.45)');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
    }, { repeat: true });
  }

  #stadium() {
    const g = new THREE.Group();
    const concrete = new THREE.MeshStandardMaterial({ color: '#4a4f58', roughness: 0.9 });
    const dark = new THREE.MeshStandardMaterial({ color: '#141a26', roughness: 0.8 });
    const steel = new THREE.MeshStandardMaterial({ color: '#8b93a3', roughness: 0.45, metalness: 0.8 });
    // bandeaux LED (devant les tribunes) et panneaux autour du terrain
    this.ledTex = canvasTex(1024, 48, (c, w, h) => {
      const gr = c.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#0d2a5c'); gr.addColorStop(0.5, '#1a4a9a'); gr.addColorStop(1, '#0d2a5c');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
      c.font = '900 30px "Big Shoulders Display", Impact, sans-serif'; c.textBaseline = 'middle'; c.fillStyle = '#e8f0ff';
      let x = 20; for (const t of ['ALLEZ !', 'BIENVENUE AU STADE', 'ALLEZ !', 'BIENVENUE AU STADE', 'ALLEZ !']) { const tw = c.measureText(t).width; if (x + tw > w - 10) break; c.fillText(t, x, h / 2 + 2); x += tw + 70; }
    }, { repeat: true });
    this.ledTex.repeat.set(4, 1);
    this.ledMat = new THREE.MeshStandardMaterial({ map: this.ledTex, emissive: '#ffffff', emissiveMap: this.ledTex, emissiveIntensity: 0.75, roughness: 0.5 });
    this.standMats = [];
    // tribunes à deux étages : gradins inclinés, balcon avec bandeau, toit sur poutres, rampe de projecteurs
    const mk = (cx, cz, rotY, len) => {
      const s = new THREE.Group();
      for (const [y0, d0, depth, rise] of [[1.2, 0, 22, 12], [15.5, 14, 20, 13]]) {
        const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.06 });
        this.standMats.push({ mat, len, rows: depth });
        const slope = new THREE.Mesh(new THREE.PlaneGeometry(len, Math.hypot(depth, rise)), mat);
        slope.rotation.x = -Math.PI / 2 - Math.atan2(rise, depth); slope.position.set(0, y0 + rise / 2, d0 + depth / 2); slope.receiveShadow = true;
        s.add(slope);
        // dessous du gradin (béton) visible depuis le terrain
        const under = new THREE.Mesh(new THREE.BoxGeometry(len, rise, 0.5), concrete); under.position.set(0, y0 + rise / 2 - 0.4, d0 + depth + 0.2); s.add(under);
      }
      // balcon de l'étage supérieur avec bandeau lumineux
      const balcony = new THREE.Mesh(new THREE.BoxGeometry(len, 1.6, 0.8), dark); balcony.position.set(0, 15, 14); s.add(balcony);
      const led2 = new THREE.Mesh(new THREE.PlaneGeometry(len, 1.1), this.ledMat); led2.position.set(0, 15.1, 13.58); led2.rotation.y = Math.PI; s.add(led2);
      const front = new THREE.Mesh(new THREE.BoxGeometry(len, 1.4, 0.5), dark); front.position.set(0, 0.7, -0.25); s.add(front);
      const led = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.9), this.ledMat); led.position.set(0, 0.85, -0.52); led.rotation.y = Math.PI; s.add(led);
      const back = new THREE.Mesh(new THREE.BoxGeometry(len, 34, 1), concrete); back.position.set(0, 17, 34.5); s.add(back);
      // toit : couverture, poutres en acier, rampe de projecteurs sous le bord
      const roof = new THREE.Mesh(new THREE.BoxGeometry(len + 4, 0.6, 30), new THREE.MeshStandardMaterial({ color: '#d5d9e0', roughness: 0.6, metalness: 0.2 }));
      roof.position.set(0, 34.5, 19); s.add(roof);
      const beams = new THREE.InstancedMesh(new THREE.BoxGeometry(0.35, 1.6, 30), steel, Math.ceil(len / 9));
      for (let i = 0; i < beams.count; i++) { const m = new THREE.Matrix4().makeTranslation(-len / 2 + 4 + i * 9, 33.4, 19); beams.setMatrixAt(i, m); }
      s.add(beams);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(len * 0.94, 0.5, 0.9), new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#fff4d6', emissiveIntensity: 2.2 }));
      strip.position.set(0, 33.6, 4.6); s.add(strip); (this.roofStrips ??= []).push(strip);
      s.position.set(cx, 0, cz); s.rotation.y = rotY;
      g.add(s);
      return s;
    };
    // la tribune du côté de la caméra principale est masquée (la caméra est sur sa passerelle)
    this.stands = { posZ: mk(0, HZ + 8, 0, L + 30), negZ: mk(0, -HZ - 8, Math.PI, L + 30) };
    mk(HX + 10, 0, Math.PI / 2, W + 16); mk(-HX - 10, 0, -Math.PI / 2, W + 16);
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(28, 34, 28), concrete); c.position.set(sx * (HX + 31), 17, sz * (HZ + 29)); g.add(c);
    }
    // mâts d'éclairage aux quatre coins : batteries de projecteurs et halos (la nuit)
    const glow = canvasTex(128, 128, (c, w, h) => { const r = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); r.addColorStop(0, 'rgba(255,250,235,1)'); r.addColorStop(0.15, 'rgba(255,244,214,0.7)'); r.addColorStop(0.5, 'rgba(255,236,190,0.12)'); r.addColorStop(1, 'rgba(255,236,190,0)'); c.fillStyle = r; c.fillRect(0, 0, w, h); });
    this.glows = [];
    const bankMat = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#fffbef', emissiveIntensity: 3 });
    for (const [x, z] of this.towers) {
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 50, 10), steel); mast.position.set(x, 25, z); g.add(mast);
      const bank = new THREE.Mesh(new THREE.BoxGeometry(9, 5, 0.4), bankMat);
      bank.position.set(x, 51, z); bank.lookAt(0, 0, 0); g.add(bank);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8, fog: false }));
      sp.position.set(x * 0.985, 51, z * 0.985); sp.scale.set(40, 40, 1); g.add(sp); this.glows.push(sp);
    }
    // panneaux publicitaires LED autour du terrain
    this.boardTex = canvasTex(1024, 64, (c, w, h) => {
      c.fillStyle = '#0b1220'; c.fillRect(0, 0, w, h);
      c.font = '900 40px "Big Shoulders Display", Impact, sans-serif'; c.textBaseline = 'middle';
      const words = ['GENERATION FOOTBALL', '★', 'CENTRE DE FORMATION', '★'];
      let x = 12;
      for (let i = 0; i < 12; i++) { const t = words[i % words.length], tw = c.measureText(t).width; if (x + tw > w - 10) break; c.fillStyle = i % 2 ? '#ffd65a' : '#eef2ea'; c.fillText(t, x, h / 2 + 2); x += tw + 34; }
    }, { repeat: true });
    this.boardTex.repeat.set(3, 1);
    const boardMat = new THREE.MeshStandardMaterial({ map: this.boardTex, emissive: '#ffffff', emissiveMap: this.boardTex, emissiveIntensity: 0.85, roughness: 0.4 });
    const boardBox = new THREE.MeshStandardMaterial({ color: '#10141c', roughness: 0.6 });
    const board = (cx, cz, len, rotY) => {
      const grp = new THREE.Group();
      const b = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.9), boardMat); b.position.set(0, 0.5, 0.08); grp.add(b); // devant la face du caisson
      const body = new THREE.Mesh(new THREE.BoxGeometry(len, 1, 0.12), boardBox); body.position.set(0, 0.5, 0); grp.add(body);
      grp.position.set(cx, 0, cz); grp.rotation.y = rotY; g.add(grp);
    };
    board(0, -HZ - 4.2, L + 6, 0); board(0, HZ + 4.2, L + 6, Math.PI);
    board(-HX - 5, 0, W - 12, Math.PI / 2); board(HX + 5, 0, W - 12, -Math.PI / 2);
    // bancs de touche, du côté de la tribune principale (sous la caméra) : abri vitré teinté, sièges
    const glass = new THREE.MeshStandardMaterial({ color: '#1c2a3a', roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.55 });
    for (const sx of [-1, 1]) {
      const shell = new THREE.Mesh(new THREE.BoxGeometry(11, 2.2, 2.4), glass); shell.position.set(sx * 9, 1.1, HZ + 6.2); g.add(shell);
      const seats = new THREE.Mesh(new THREE.BoxGeometry(10.4, 0.5, 0.7), new THREE.MeshStandardMaterial({ color: sx > 0 ? '#b3261e' : '#1d3d8f', roughness: 0.5 })); seats.position.set(sx * 9, 0.45, HZ + 6.9); g.add(seats);
    }
    // flashs d'appareils photo dans le public
    const pts = [];
    for (let i = 0; i < 360; i++) {
      const side = i % 4, u = hash(i * 3) - 0.5, v = hash(i * 7);
      const d = 3 + v * 30, y = 2.5 + v * 26;
      if (side === 0) pts.push(u * (L + 26), y, HZ + 8 + d); else if (side === 1) pts.push(u * (L + 26), y, -HZ - 8 - d);
      else if (side === 2) pts.push(HX + 10 + d, y, u * (W + 12)); else pts.push(-HX - 10 - d, y, u * (W + 12));
    }
    this.flashGeo = new THREE.BufferGeometry();
    this.flashAll = new Float32Array(pts);
    this.flashGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(30 * 3), 3));
    this.flashes = new THREE.Points(this.flashGeo, new THREE.PointsMaterial({ color: '#ffffff', size: 1.4, sizeAttenuation: true, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.flashes.frustumCulled = false;
    g.add(this.flashes);
    this.scene.add(g);
  }

  #goals() {
    const post = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.25, metalness: 0.05, envMapIntensity: 1.2 });
    const netMat = new THREE.LineBasicMaterial({ color: '#e9edf2', transparent: true, opacity: 0.55 });
    this.nets = [];
    for (const s of [-1, 1]) {
      const gx = s * HX, grp = new THREE.Group();
      const cyl = (len, x, y, z, rx, rz) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, len, 16), post); m.position.set(x, y, z); m.rotation.set(rx, 0, rz); m.castShadow = true; grp.add(m); };
      cyl(2.44, 0, 1.22, -3.66, 0, 0); cyl(2.44, 0, 1.22, 3.66, 0, 0); cyl(7.44, 0, 2.44, 0, Math.PI / 2, 0);
      cyl(2.0, s * 1, 2.44, -3.66, 0, Math.PI / 2); cyl(2.0, s * 1, 2.44, 3.66, 0, Math.PI / 2);
      // filet en mailles : arrière, toit et côtés (un peu détendu vers le bas de l'arrière)
      const net = new THREE.Group();
      const grid = (w, h, nx, ny, place) => {
        const pos = [];
        for (let i = 0; i <= nx; i++) for (let j = 0; j < ny; j++) { const a = place(i / nx, j / ny), b = place(i / nx, (j + 1) / ny); pos.push(...a, ...b); }
        for (let j = 0; j <= ny; j++) for (let i = 0; i < nx; i++) { const a = place(i / nx, j / ny), b = place((i + 1) / nx, j / ny); pos.push(...a, ...b); }
        const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        net.add(new THREE.LineSegments(geo, netMat));
      };
      const sag = (v) => 0.18 * Math.sin(Math.PI * v);
      grid(7.32, 2.44, 48, 16, (u, v) => [s * (2 + sag(v) * 0.6), 2.44 * v, -3.66 + 7.32 * u]); // arrière
      grid(2, 7.32, 12, 48, (u, v) => [s * 2 * u, 2.44 - 0.12 * Math.sin(Math.PI * u), -3.66 + 7.32 * v]); // toit
      for (const z of [-3.66, 3.66]) grid(2, 2.44, 12, 16, (u, v) => [s * 2 * u, 2.44 * v, z]);
      grp.add(net); this.nets.push({ net, s });
      grp.position.x = gx;
      this.scene.add(grp);
    }
  }

  // ---------------------------------------------------------------- joueurs
  // Chaque joueur est une hiérarchie d'articulations ; les membres (formes anatomiques en révolution) sont
  // dessinés par lots (InstancedMesh). Maillot : une texture à motifs par tenue (deux équipes, deux gardiens).
  #players() {
    const std = (rough = 0.7) => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: rough, metalness: 0 });
    const torso = lathe([[0.001, 0.0], [0.152, 0.02], [0.158, 0.12], [0.178, 0.26], [0.2, 0.38], [0.212, 0.47], [0.205, 0.52], [0.15, 0.575], [0.06, 0.6]], 20); torso.scale(1, 1, 0.64);
    // short : bassin (avec le haut du corps) et une jambe de short par cuisse, qui suit sa cuisse
    const shorts = lathe([[0.001, 0.06], [0.165, 0.06], [0.172, -0.03], [0.168, -0.09], [0.001, -0.1]], 18); shorts.scale(1, 1, 0.74);
    const shortLeg = lathe([[0.001, 0.05], [0.098, 0.04], [0.104, -0.06], [0.104, -0.17], [0.098, -0.19], [0.001, -0.19]], 14);
    const thigh = lathe([[0.001, -0.14], [0.084, -0.15], [0.078, -0.24], [0.068, -0.33], [0.058, -0.41], [0.001, -0.43]], 12);
    const deltoid = new THREE.SphereGeometry(0.068, 12, 8); deltoid.scale(1.05, 0.9, 1);
    const shin = lathe([[0.001, 0], [0.056, -0.01], [0.064, -0.11], [0.052, -0.24], [0.04, -0.36], [0.036, -0.4], [0.001, -0.41]], 12);
    const upper = lathe([[0.001, 0.02], [0.056, 0.0], [0.052, -0.12], [0.046, -0.24], [0.04, -0.28], [0.001, -0.29]], 10);
    const sleeve = lathe([[0.001, 0.03], [0.07, 0.02], [0.068, -0.08], [0.062, -0.13], [0.001, -0.13]], 12);
    const fore = lathe([[0.001, 0], [0.042, -0.01], [0.044, -0.08], [0.032, -0.24], [0.001, -0.26]], 10);
    const head = new THREE.SphereGeometry(0.105, 18, 14); head.scale(0.94, 1.16, 1.04);
    // visage : calotte de sphère tournée vers l'avant (+z), sourcils, yeux, nez, bouche peints
    const face = new THREE.SphereGeometry(0.108, 16, 12, Math.PI * 0.18, Math.PI * 0.64, Math.PI * 0.28, Math.PI * 0.5); face.scale(0.94, 1.16, 1.04);
    const hairShort = new THREE.SphereGeometry(0.113, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5); hairShort.scale(0.97, 1.12, 1.07); hairShort.translate(0, 0.012, -0.012);
    const hairCurly = new THREE.IcosahedronGeometry(0.128, 1); hairCurly.scale(1.02, 0.95, 1.06); hairCurly.translate(0, 0.045, -0.02);
    const hairLong = new THREE.SphereGeometry(0.117, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.72); hairLong.scale(1, 1.18, 1.1); hairLong.translate(0, 0.0, -0.025);
    const boot = new THREE.CapsuleGeometry(0.047, 0.16, 4, 10); boot.rotateX(Math.PI / 2); boot.scale(1, 0.72, 1); boot.translate(0, -0.03, 0.06);
    const hand = new THREE.SphereGeometry(0.045, 10, 8); hand.scale(0.8, 1.15, 0.6);
    // tissu : relief fin des maillots
    this.fabricN = noiseNormal(128, 0.2, 1.2, 3); this.fabricN.repeat.set(6, 6);
    this.faceTex = canvasTex(128, 128, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      // sourcils, yeux, ombre du nez, bouche : visibles en gros plan
      c.fillStyle = 'rgba(30,20,14,0.85)'; c.fillRect(w * 0.28, h * 0.36, w * 0.16, h * 0.035); c.fillRect(w * 0.56, h * 0.36, w * 0.16, h * 0.035);
      c.fillStyle = '#f5f5f0'; c.beginPath(); c.ellipse(w * 0.36, h * 0.45, w * 0.06, h * 0.03, 0, 0, Math.PI * 2); c.ellipse(w * 0.64, h * 0.45, w * 0.06, h * 0.03, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#2a1d14'; c.beginPath(); c.arc(w * 0.36, h * 0.45, w * 0.028, 0, Math.PI * 2); c.arc(w * 0.64, h * 0.45, w * 0.028, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(60,30,20,0.25)'; c.fillRect(w * 0.47, h * 0.47, w * 0.06, h * 0.14);
      c.fillStyle = 'rgba(120,50,45,0.55)'; c.fillRect(w * 0.4, h * 0.7, w * 0.2, h * 0.035);
    }, { srgb: true });
    // [clé du nœud, géométrie, canal de couleur, maillot à motifs ?, matériau]
    const def = [
      ['torso', torso, 'shirt', true], ['hips', shorts, 'shorts'],
      ['neck', new THREE.CylinderGeometry(0.052, 0.058, 0.11, 10), 'skin'], ['head', head, 'skin'], ['face', face, 'face'],
      ['sleeveL', sleeve, 'shirt', true], ['sleeveR', sleeve, 'shirt', true], ['sleeveL', deltoid, 'shirt', true], ['sleeveR', deltoid, 'shirt', true],
      ['armL', upper, 'skin'], ['armR', upper, 'skin'], ['thighL', shortLeg, 'shorts'], ['thighR', shortLeg, 'shorts'],
      ['foreL', fore, 'skin'], ['foreR', fore, 'skin'], ['handL', hand, 'hand'], ['handR', hand, 'hand'],
      ['thighL', thigh, 'skin'], ['thighR', thigh, 'skin'], ['shinL', shin, 'socks'], ['shinR', shin, 'socks'],
      ['footL', boot, 'boots'], ['footR', boot, 'boots'],
      ['hair', hairShort, 'hair', false, 'h0'], ['hair', hairCurly, 'hair', false, 'h1'], ['hair', hairLong, 'hair', false, 'h2'],
    ];
    this.kitTex = [0, 1, 2, 3].map(() => null);
    this.parts = [];
    for (const [key, geo, ch, kit, style] of def) {
      const copies = kit ? 4 : 1; // une version par tenue pour les pièces à motifs
      for (let k = 0; k < copies; k++) {
        const mat = ch === 'face' ? new THREE.MeshStandardMaterial({ map: this.faceTex, transparent: true, roughness: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })
          : ch === 'skin' || ch === 'hand' ? std(0.55) : ch === 'boots' ? std(0.35) : ch === 'hair' ? std(0.85) : std(0.78);
        if (kit || ch === 'shorts' || ch === 'socks') { mat.normalMap = this.fabricN; mat.normalScale = new THREE.Vector2(0.35, 0.35); }
        const mesh = new THREE.InstancedMesh(geo, mat, MAXP);
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.frustumCulled = false; mesh.count = 0; mesh.castShadow = ch !== 'face';
        this.scene.add(mesh);
        this.parts.push({ key, ch, mesh, kit: kit ? k : null, style: style ?? null, n: 0 });
      }
    }
    this.rigs = [];
    // ombres de contact au sol (et, au palier minimal, ombres des projecteurs)
    const sh = canvasTex(64, 64, (c, w, h) => { const r = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); r.addColorStop(0, 'rgba(0,0,0,0.85)'); r.addColorStop(0.6, 'rgba(0,0,0,0.4)'); r.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = r; c.fillRect(0, 0, w, h); }, { srgb: false });
    const sg = new THREE.PlaneGeometry(1, 1); sg.rotateX(-Math.PI / 2);
    this.shadows = new THREE.InstancedMesh(sg, new THREE.MeshBasicMaterial({ map: sh, transparent: true, opacity: 0.3, depthWrite: false }), (MAXP + 1) * 4);
    this.shadows.frustumCulled = false; this.shadows.count = 0; this.shadows.renderOrder = 1;
    this.scene.add(this.shadows);
    // repère du joueur de l'utilisateur
    this.meRing = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.78, 40), new THREE.MeshBasicMaterial({ color: '#ffd65a', transparent: true, opacity: 0.9, depthWrite: false }));
    this.meRing.rotation.x = -Math.PI / 2; this.meRing.visible = false; this.meRing.renderOrder = 2; this.scene.add(this.meRing);
    this.meArrow = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.32, 4), new THREE.MeshBasicMaterial({ color: '#ffd65a' }));
    this.meArrow.rotation.x = Math.PI; this.meArrow.visible = false; this.scene.add(this.meArrow);
    this.dummy = new THREE.Object3D();
    this.col = new THREE.Color();
  }

  #rig(i) {
    if (this.rigs[i]) return this.rigs[i];
    const N = () => new THREE.Object3D();
    const r = { root: N(), body: N(), hips: N(), spine: N(), torso: N(), neck: N(), head: N(), hair: N(), face: N() };
    r.root.add(r.body); r.body.add(r.hips); r.hips.position.y = 0.93;
    r.hips.add(r.spine); r.spine.add(r.torso, r.neck); r.spine.position.y = 0.06;
    r.neck.position.y = 0.6; r.neck.add(r.head); r.head.position.y = 0.15; r.head.add(r.hair, r.face);
    for (const [s, sx] of [['L', 1], ['R', -1]]) {
      const arm = N(), sleeve = N(), fore = N(), hand = N(), thigh = N(), shin = N(), foot = N();
      arm.position.set(sx * 0.2, 0.5, 0); r.spine.add(arm); arm.add(sleeve);
      fore.position.y = -0.28; arm.add(fore); hand.position.y = -0.27; fore.add(hand);
      thigh.position.set(sx * 0.088, -0.04, 0); r.hips.add(thigh);
      shin.position.y = -0.42; thigh.add(shin); foot.position.y = -0.41; shin.add(foot);
      Object.assign(r, { [`arm${s}`]: arm, [`sleeve${s}`]: sleeve, [`fore${s}`]: fore, [`hand${s}`]: hand, [`thigh${s}`]: thigh, [`shin${s}`]: shin, [`foot${s}`]: foot });
    }
    // numéro dans le dos
    r.numMat = new THREE.MeshStandardMaterial({ transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, roughness: 0.6 });
    r.num = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.24), r.numMat);
    r.num.position.set(0, 0.34, -0.136); r.num.rotation.y = Math.PI;
    r.spine.add(r.num);
    r.root.scale.setScalar(PLAYER_SCALE);
    this.scene.add(r.root);
    this.rigs[i] = r;
    return r;
  }

  #numberTex(num, color) {
    return canvasTex(64, 64, (c, w, h) => { c.clearRect(0, 0, w, h); c.fillStyle = color; c.font = '900 50px "Big Shoulders Display", Impact, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(num), w / 2, h / 2 + 3); });
  }

  // maillot : couleur, motif du club (rayures, cerceaux, moitiés, bande), col et liseré, plis du tissu
  #kitTexture(p, s, pat) {
    return canvasTex(256, 256, (c, w, h) => {
      c.fillStyle = p; c.fillRect(0, 0, w, h);
      c.fillStyle = s;
      if (pat === 'stripes') for (let i = 0; i < 10; i++) { if (i % 2) c.fillRect((i * w) / 10, 0, w / 10, h); }
      else if (pat === 'hoops') for (let j = 0; j < 8; j++) { if (j % 2) c.fillRect(0, (j * h) / 8, w, h / 8); }
      else if (pat === 'halves') c.fillRect(0, 0, w / 4, h), c.fillRect((3 * w) / 4, 0, w / 4, h);
      else if (pat === 'band') { c.save(); c.translate(w * 0.02, h * 0.55); c.rotate(-0.5); c.fillRect(-w * 0.2, -h * 0.06, w * 0.5, h * 0.12); c.restore(); c.save(); c.translate(w, h * 0.55); c.rotate(-0.5); c.fillRect(-w * 0.3, -h * 0.06, w * 0.5, h * 0.12); c.restore(); }
      // col (haut de la texture) et bas du maillot
      c.fillStyle = s; c.fillRect(0, 0, w, h * 0.045); c.fillRect(0, h * 0.97, w, h * 0.03);
      // panneaux latéraux plus sombres (sous les bras)
      const side = (x) => { const g = c.createLinearGradient(x - w * 0.08, 0, x + w * 0.08, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, 'rgba(0,0,0,0.18)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(x - w * 0.08, 0, w * 0.16, h); };
      side(w * 0.25); side(w * 0.75);
      // écusson et partenaire sur la poitrine (devant = bords de la texture)
      c.fillStyle = lum(p) > 150 ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.8)';
      c.fillRect(w * 0.94, h * 0.42, w * 0.06, h * 0.07); c.fillRect(0, h * 0.42, w * 0.06, h * 0.07);
      c.fillRect(w * 0.06, h * 0.22, w * 0.03, h * 0.04);
      // plis du tissu
      for (let i = 0; i < 26; i++) { const y = hash(i * 3) * h, x = hash(i * 7) * w; c.strokeStyle = `rgba(0,0,0,${0.04 + hash(i) * 0.05})`; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 10, y + 6, x + 22, y + 2); c.stroke(); }
    });
  }

  // tenues et public quand les équipes changent
  #kits(teams, players) {
    const key = teams.map((t) => `${t.colors.primary}${t.colors.secondary}${t.colors.text}${t.colors.pat ?? ''}`).join('|') + players.length;
    if (key === this.kitKey) return;
    this.kitKey = key;
    const kits = [];
    teams.forEach((t, ti) => {
      kits[ti * 2] = { p: t.colors.primary, s: t.colors.secondary, pat: t.colors.pat ?? 'plain' };
      const gk = t.colors.gk || (ti === 0 ? '#1f9d55' : '#e8590c');
      kits[ti * 2 + 1] = { p: gk, s: '#111827', pat: 'plain' };
    });
    kits.forEach((k, i) => { this.kitTex[i]?.dispose(); this.kitTex[i] = this.#kitTexture(k.p, k.s, k.pat); });
    for (const part of this.parts) if (part.kit != null) { part.mesh.material.map = this.kitTex[part.kit]; part.mesh.material.needsUpdate = true; }
    this.looks = players.map((p) => {
      const t = teams[p.team], gk = p.role === 'GK';
      const shirt = gk ? kits[p.team * 2 + 1].p : t.colors.primary;
      const second = gk ? '#111827' : t.colors.secondary;
      const shorts = gk ? '#1b1f2a' : (Math.abs(lum(second) - lum(shirt)) < 40 ? shirt : second);
      const h = hash(p.id * 31 + 7), h2 = hash(p.id * 17 + 3);
      const skin = SKIN[(h * SKIN.length) | 0];
      return {
        kit: p.team * 2 + (gk ? 1 : 0), shirt: '#ffffff', shorts, socks: gk ? shirt : t.colors.primary, skin, hand: gk ? '#f3f3ef' : skin, face: '#ffffff',
        hair: HAIR[(h2 * HAIR.length) | 0], boots: BOOTS[(hash(p.id * 5 + 1) * BOOTS.length) | 0],
        hairStyle: h2 > 0.92 ? null : skin === SKIN[5] || skin === SKIN[4] ? (h2 < 0.55 ? 'h1' : 'h0') : h2 < 0.12 ? 'h2' : 'h0',
        tall: 0.95 + hash(p.id * 13) * 0.1, text: gk ? '#ffffff' : t.colors.text,
      };
    });
    players.forEach((p, i) => {
      const r = this.#rig(i);
      r.numMat.map?.dispose(); r.numMat.map = this.#numberTex(p.num ?? '', this.looks[i].text); r.numMat.needsUpdate = true;
    });
    const crowd = this.#crowdTexture([teams[0].colors.primary, teams[1].colors.primary === teams[0].colors.primary ? teams[1].colors.secondary : teams[1].colors.primary]);
    for (const { mat, len, rows } of this.standMats) {
      mat.map?.dispose();
      const t = crowd.clone(); t.flipY = false; t.needsUpdate = true; t.repeat.set(len / 26, rows / 9);
      mat.map = t; mat.emissiveMap = t; mat.needsUpdate = true;
    }
    crowd.dispose();
  }

  #ball() {
    // ballon moderne : panneaux thermosoudés, coutures, logo ; reflets de l'éclairage
    const tex = canvasTex(512, 256, (c, w, h) => {
      c.fillStyle = '#f6f6f2'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 6; i++) {
        const x = (i + 0.5) * (w / 6), y = h * (i % 2 ? 0.32 : 0.68);
        c.fillStyle = i % 3 === 0 ? '#1b2a6b' : i % 3 === 1 ? '#c8202f' : '#16181d';
        c.beginPath(); c.moveTo(x - 30, y); c.bezierCurveTo(x - 10, y - 40, x + 30, y - 30, x + 34, y + 4); c.bezierCurveTo(x + 14, y + 30, x - 20, y + 26, x - 30, y); c.fill();
      }
      c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 1.5;
      for (let i = 0; i < 12; i++) { c.beginPath(); c.moveTo((i * w) / 12, 0); c.bezierCurveTo((i * w) / 12 + 20, h * 0.3, (i * w) / 12 - 20, h * 0.7, (i * w) / 12, h); c.stroke(); }
    });
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(0.11, 28, 20), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.32, metalness: 0, envMapIntensity: 1.0 }));
    this.ball.castShadow = true;
    this.scene.add(this.ball);
  }

  // pluie et neige autour de l'action
  #weather() {
    const n = 1400, pos = new Float32Array(n * 6);
    for (let i = 0; i < n; i++) { const x = (hash(i) - 0.5) * 120, y = hash(i * 3) * 40, z = (hash(i * 7) - 0.5) * 90; pos.set([x, y, z, x + 0.05, y - 0.9, z], i * 6); }
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: '#c9d6e8', transparent: true, opacity: 0.35, depthWrite: false }));
    this.rain.frustumCulled = false; this.rain.visible = false; this.scene.add(this.rain);
    const sp = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) sp.set([(hash(i * 11) - 0.5) * 120, hash(i * 13) * 40, (hash(i * 17) - 0.5) * 90], i * 3);
    const sgeo = new THREE.BufferGeometry(); sgeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.snow = new THREE.Points(sgeo, new THREE.PointsMaterial({ color: '#ffffff', size: 0.16, transparent: true, opacity: 0.85, depthWrite: false }));
    this.snow.frustumCulled = false; this.snow.visible = false; this.scene.add(this.snow);
  }

  // post-traitement : halo des projecteurs, étalonnage (contraste, vignette), anticrénelage
  #post() {
    const size = new THREE.Vector2(512, 256);
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 0 });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(size, 0.3, 0.5, 0.95);
    this.composer.addPass(this.bloom);
    this.grade = new ShaderPass({
      uniforms: { tDiffuse: { value: null }, amount: { value: 0.32 }, time: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform sampler2D tDiffuse; uniform float amount; uniform float time; varying vec2 vUv;
        float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + time) * 43758.5453); }
        void main(){ vec4 c = texture2D(tDiffuse, vUv);
          vec2 d = vUv - 0.5; float v = 1.0 - amount * dot(d, d) * 2.2;
          c.rgb *= v; c.rgb = mix(c.rgb, c.rgb * c.rgb * (3.0 - 2.0 * c.rgb), 0.12);
          c.rgb += (h(vUv * 1000.0) - 0.5) * 0.012;
          gl_FragColor = c; }`,
    });
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());
    this.fxaa = new ShaderPass(FXAAShader);
    this.composer.addPass(this.fxaa);
  }

  #applyQuality() {
    const q = this.quality;
    this.renderer.shadowMap.enabled = q < 2;
    this.key.castShadow = q < 2;
    const sz = q === 0 ? 2048 : 1024;
    if (this.key.shadow.mapSize.x !== sz) { this.key.shadow.mapSize.set(sz, sz); this.key.shadow.map?.dispose(); this.key.shadow.map = null; }
    this.usePost = q === 0;
    // au palier minimal : pas d'ombres portées, les ombres des projecteurs redeviennent des taches au sol
    this.scene.traverse((o) => { if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms) m.needsUpdate = true; } });
  }

  // ---------------------------------------------------------------- caméra
  resize() {
    const w = this.canvas.clientWidth || this.canvas.parentElement?.clientWidth || 300, h = this.canvas.clientHeight || this.canvas.parentElement?.clientHeight || 150;
    const pr = PIXEL_RATIO[this.quality ?? 0](window.devicePixelRatio || 1);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.composer?.setPixelRatio(pr);
    this.composer?.setSize(w, h);
    if (this.fxaa) this.fxaa.material.uniforms.resolution.value.set(1 / (w * pr), 1 / (h * pr));
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
  setInset() { /* la vue 3D n'est pas utilisée pendant les choix */ }
  toWorld() { return { x: -99, y: -99 }; }
  reset() { this.fresh = true; this.state.clear(); this.ballPrev = null; this.prevOwner = null; }

  follow(wx, wy, zoom, smooth = 0.12) {
    const k = this.fresh ? 1 : smooth;
    this.cam.x += (wx - this.cam.x) * k; this.cam.y += (wy - this.cam.y) * k;
    this.cam.zoom += (zoom - this.cam.zoom) * (this.fresh ? 1 : 0.1);
  }

  #placeCamera(dt, now) {
    const side = this.mirror ? -1 : 1;
    this.stands.posZ.visible = side < 0; this.stands.negZ.visible = side > 0;
    const tx = this.cam.x - HX, tz = this.cam.y - HZ;
    const z = Math.max(1, this.cam.zoom);
    // caméra principale sur la passerelle de la tribune, à mi-hauteur : elle pivote et suit l'action
    const px = THREE.MathUtils.clamp(tx * 0.55, -32, 32);
    const pos = new THREE.Vector3(px, 23, side * (HZ + 40));
    const look = new THREE.Vector3(tx, 0.8, tz * 0.94);
    if (this.fresh) { this.camera.position.copy(pos); this.look.copy(look); }
    else { this.camera.position.lerp(pos, 1 - Math.exp(-dt * 3)); this.look.lerp(look, 1 - Math.exp(-dt * 6)); }
    const aspect = this.camera.aspect;
    const wide = THREE.MathUtils.clamp((2 * Math.atan((L * 0.55) / (90 * aspect)) * 180) / Math.PI, 22, 55);
    const fov = z <= 1.02 ? wide : Math.max(6, 26 / Math.pow(z, 1.55)); // téléobjectif du réalisateur
    this.camera.fov += (fov - this.camera.fov) * (this.fresh ? 1 : 1 - Math.exp(-dt * 3));
    this.camera.updateProjectionMatrix();
    // léger mouvement de caméra tenue à l'épaule, et secousse sur un but
    const hand = 0.04 * Math.sin(now / 900) + 0.03 * Math.sin(now / 470);
    this.camera.position.y += hand;
    if (this.shake > 0) { this.shake -= dt; const a = this.shake * 0.4; this.camera.position.x += (Math.random() - 0.5) * a; this.camera.position.y += (Math.random() - 0.5) * a; }
    this.camera.lookAt(this.look);
    this.fresh = false;
  }

  celebrate(colors) {
    this.shake = 0.5;
    this.celebrateUntil = performance.now() + 3600;
    this.celebrateColor = colors?.primary ?? null;
  }

  // ---------------------------------------------------------------- image
  #adapt(raw) {
    if (!(raw > 0 && raw < 400)) return;
    this.frameMs = this.frameMs * 0.95 + raw * 0.05;
    if (++this.frames < 90 || this.quality >= 2) return;
    this.frames = 0;
    if (this.frameMs > 38) {
      this.quality++;
      try { localStorage.setItem(QUALITY_KEY, String(this.quality)); } catch { /* stockage indisponible */ }
      this.#applyQuality();
      this.resize();
    }
  }

  draw({ teams, players, ball, ownerId = null }) {
    const now = performance.now();
    if (this.lastT) this.#adapt(now - this.lastT);
    const dt = Math.min(0.1, (now - (this.lastT || now)) / 1000) || 0.016; this.lastT = now;
    this.#kits(teams, players);
    const celebrating = now < this.celebrateUntil;
    if (this.prevOwner != null && ownerId !== this.prevOwner) { const s = this.state.get(this.prevOwner); if (s) s.kick = 1; }
    this.prevOwner = ownerId;
    // vitesse du ballon (pour les plongeons des gardiens et les têtes)
    if (ball && this.ballPrev) { const vx = (ball.x - this.ballPrev.x) / dt, vy = (ball.y - this.ballPrev.y) / dt; if (Math.hypot(vx, vy) < 60) { this.ballVel.x += (vx - this.ballVel.x) * 0.4; this.ballVel.y += (vy - this.ballVel.y) * 0.4; } }

    for (const part of this.parts) part.n = 0;
    let ns = 0;
    const d = this.dummy;
    const blobs = this.quality >= 2;
    let me = null;
    for (let i = 0; i < players.length; i++) {
      const p = players[i], r = this.#rig(i), lk = this.looks[i];
      const on = p.onPitch && Number.isFinite(p.x);
      r.root.visible = !!on;
      if (!on) { this.state.delete(p.id); continue; }
      let s = this.state.get(p.id);
      if (!s) { s = { x: p.x, y: p.y, a: teams[p.team].dir > 0 ? 0 : Math.PI, v: 0, mvA: 0, ph: hash(p.id) * 6, kick: 0, idle: hash(p.id * 9) * 6, dive: 0, diveSide: 1, jump: 0 }; this.state.set(p.id, s); }
      const dx = p.x - s.x, dy = p.y - s.y, dist = Math.hypot(dx, dy);
      const vNow = dist < 6 ? dist / dt : 0;
      s.v += (Math.min(vNow, 9.5) - s.v) * 0.25;
      const toBall = ball ? Math.atan2(ball.y - p.y, ball.x - p.x) : s.a;
      if (dist > 0.012 && dist < 6) {
        s.mvA = Math.atan2(dy, dx);
        // près du ballon et à faible allure, on garde le ballon face à soi (déplacement latéral ou en reculant)
        const nearBall = ball && Math.hypot(ball.x - p.x, ball.y - p.y) < 9 && s.v < 4.5;
        let want = nearBall ? toBall : s.mvA;
        let da = want - s.a; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
        s.a += da * Math.min(1, 0.12 + s.v * 0.035);
        s.ph += (2 * Math.PI * dist) / (1.3 + 0.38 * s.v);
      } else if (s.v < 0.5 && ball) {
        let da = toBall - s.a; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
        s.a += da * 0.06;
      }
      // sens du déplacement par rapport au regard : avant, arrière, de côté
      let rel = s.mvA - s.a; while (rel > Math.PI) rel -= 2 * Math.PI; while (rel < -Math.PI) rel += 2 * Math.PI;
      const back = s.v > 0.6 && Math.abs(rel) > 2.1, sideStep = s.v > 0.6 && !back && Math.abs(rel) > 0.9;
      s.x = p.x; s.y = p.y;
      s.kick = Math.max(0, s.kick - dt / 0.38);
      s.idle += dt;
      // gardien : plongeon sur une frappe qui arrive vers lui
      if (p.role === 'GK' && ball && s.dive <= 0) {
        const bs = Math.hypot(this.ballVel.x, this.ballVel.y), bdist = Math.hypot(ball.x - p.x, ball.y - p.y);
        const coming = (this.ballVel.x * (p.x - ball.x) + this.ballVel.y * (p.y - ball.y)) > 0;
        if (bs > 14 && coming && bdist < 9 && bdist > 1.2) { s.dive = 1; const cross = Math.sin(Math.atan2(ball.y - p.y, ball.x - p.x) - s.a); s.diveSide = cross >= 0 ? 1 : -1; }
      }
      s.dive = Math.max(0, s.dive - dt / 0.9);
      // jeu de tête : ballon haut tout près
      if (ball && s.jump <= 0 && (ball.z ?? 0) > 1.5 && (ball.z ?? 0) < 2.9 && Math.hypot(ball.x - p.x, ball.y - p.y) < 1.1) s.jump = 1;
      s.jump = Math.max(0, s.jump - dt / 0.6);

      const v = s.v, run = Math.min(1, v / 7.5), move = Math.min(1, v / 1.2);
      const dir = back ? -1 : 1;
      const A = (0.2 + 0.78 * run) * move * (sideStep ? 0.5 : 1), K = (0.3 + 1.45 * run) * move, sw = Math.sin(s.ph) * dir, cw = Math.cos(s.ph);
      const gkReady = p.role === 'GK' && ball && Math.hypot(ball.x - p.x, ball.y - p.y) < 22 && s.dive <= 0 ? 1 : 0;
      const joy = celebrating && this.celebrateColor && teams[p.team].colors.primary === this.celebrateColor ? 1 : 0;
      const breath = Math.sin(s.idle * 1.8) * (1 - move);

      r.root.position.set(p.x - HX, 0, p.y - HZ);
      r.root.rotation.set(0, Math.PI / 2 - s.a, 0);
      r.root.scale.setScalar(PLAYER_SCALE * lk.tall);
      // corps : rebond de la foulée, inclinaison du sprint, respiration à l'arrêt
      r.body.position.set(0, 0.04 * run * Math.abs(Math.sin(s.ph)) - 0.06 * gkReady + (joy ? 0.14 * Math.abs(Math.sin(now / 130 + p.id)) : 0), 0);
      r.body.rotation.set(0, 0, 0);
      r.hips.rotation.set(0, 0.12 * A * sw, 0);
      r.spine.rotation.set(0.03 + 0.22 * run * dir + 0.14 * gkReady - 0.25 * Math.sin(Math.PI * s.kick) + 0.01 * breath, -0.2 * A * sw, sideStep ? 0.12 * Math.sign(rel) : 0);
      r.head.rotation.set(-0.14 * run, 0, 0);
      // jambes : flexion de hanche, genou qui se plie au retour, pied qui déroule
      r.thighL.rotation.set(-A * sw - 0.12 * gkReady, 0, 0.04 + 0.12 * gkReady); r.thighR.rotation.set(A * sw - 0.12 * gkReady, 0, -0.04 - 0.12 * gkReady);
      r.shinL.rotation.set(0.06 + K * Math.max(0, cw) + 0.3 * gkReady, 0, 0); r.shinR.rotation.set(0.06 + K * Math.max(0, -cw) + 0.3 * gkReady, 0, 0);
      r.footL.rotation.set(-0.3 * Math.max(0, sw) * run, 0, 0); r.footR.rotation.set(-0.3 * Math.max(0, -sw) * run, 0, 0);
      if (s.kick > 0) { // frappe : appui, jambe armée puis traversée du ballon, bras d'équilibre
        const k = 1 - s.kick, swing = k < 0.35 ? 1.0 * (k / 0.35) : 1.0 - 2.4 * ((k - 0.35) / 0.65);
        r.thighR.rotation.x = swing; r.shinR.rotation.x = k < 0.35 ? 1.4 * (k / 0.35) : Math.max(0, 1.4 - 3.2 * (k - 0.35));
        r.thighL.rotation.x = -0.1; r.shinL.rotation.x = 0.25;
      }
      // bras : opposés aux jambes, coude plié en course
      const elbow = 0.3 + 1.2 * run;
      r.armL.rotation.set(0.85 * A * sw, 0, 0.12 + 0.06 * run); r.armR.rotation.set(-0.85 * A * sw, 0, -0.12 - 0.06 * run);
      r.foreL.rotation.set(-elbow, 0, 0); r.foreR.rotation.set(-elbow, 0, 0);
      if (s.kick > 0) { r.armL.rotation.z = 0.6; r.armR.rotation.z = -0.35; }
      if (gkReady) { r.armL.rotation.set(-0.55, 0, 0.7); r.armR.rotation.set(-0.55, 0, -0.7); r.foreL.rotation.x = -0.8; r.foreR.rotation.x = -0.8; }
      if (s.dive > 0) { // plongeon : le corps bascule sur le côté, bras tendus vers le ballon
        const k = Math.sin(Math.PI * Math.min(1, (1 - s.dive) * 1.4));
        r.body.rotation.z = -s.diveSide * 1.3 * k; r.body.position.y = 0.35 * k; r.body.position.x = s.diveSide * 0.9 * k;
        r.armL.rotation.set(-2.6, 0, 0.3); r.armR.rotation.set(-2.6, 0, -0.3); r.foreL.rotation.x = -0.1; r.foreR.rotation.x = -0.1;
        r.thighL.rotation.x = -0.3; r.thighR.rotation.x = 0.2; r.shinL.rotation.x = 0.4; r.shinR.rotation.x = 0.2;
      }
      if (s.jump > 0) { // détente pour une tête
        const k = Math.sin(Math.PI * (1 - s.jump));
        r.body.position.y += 0.5 * k; r.spine.rotation.x -= 0.25 * k;
        r.armL.rotation.set(-1.2 * k, 0, 0.6); r.armR.rotation.set(-1.2 * k, 0, -0.6);
        r.shinL.rotation.x += 0.7 * k; r.shinR.rotation.x += 0.5 * k;
      }
      if (joy) { const w2 = 0.25 * Math.sin(now / 110 + p.id); r.armL.rotation.set(-2.7, 0, 0.5 + w2); r.armR.rotation.set(-2.7, 0, -0.5 - w2); r.foreL.rotation.x = -0.25; r.foreR.rotation.x = -0.25; }
      r.root.updateMatrixWorld(true);
      for (const part of this.parts) {
        if (part.kit != null && part.kit !== lk.kit) continue;
        if (part.key === 'hair' && part.style !== lk.hairStyle) continue;
        part.mesh.setMatrixAt(part.n, r[part.key].matrixWorld);
        if (part.ch !== 'shirt' && part.ch !== 'face') part.mesh.setColorAt(part.n, this.col.set(lk[part.ch]));
        part.n++;
      }
      // ombre de contact sous les pieds ; au palier minimal, les quatre ombres des projecteurs
      if (blobs) {
        for (const [lx, lz] of this.towers) {
          const ax = (p.x - HX) - lx, az = (p.y - HZ) - lz, al = Math.hypot(ax, az) || 1;
          const len = 1.0 + al * 0.016;
          d.position.set(p.x - HX + (ax / al) * len * 0.5, 0.02, p.y - HZ + (az / al) * len * 0.5);
          d.rotation.set(0, -Math.atan2(az, ax), 0); d.scale.set(len + 0.5, 1, 0.62);
          d.updateMatrix(); this.shadows.setMatrixAt(ns++, d.matrix);
        }
      } else {
        d.position.set(p.x - HX, 0.02, p.y - HZ); d.rotation.set(0, 0, 0); d.scale.set(0.9, 1, 0.9);
        d.updateMatrix(); this.shadows.setMatrixAt(ns++, d.matrix);
      }
      if (p.isUser) me = { p, lk };
    }
    for (let i = players.length; i < this.rigs.length; i++) this.rigs[i].root.visible = false;
    for (const part of this.parts) { part.mesh.count = part.n; part.mesh.instanceMatrix.needsUpdate = true; if (part.mesh.instanceColor) part.mesh.instanceColor.needsUpdate = true; }

    // ballon : hauteur réelle, rotation selon le déplacement
    if (ball && Number.isFinite(ball.x)) {
      const bz = Math.max(0, ball.z || 0);
      this.ball.visible = true;
      this.ball.position.set(ball.x - HX, 0.11 + bz, ball.y - HZ);
      if (this.ballPrev) { const mx = ball.x - this.ballPrev.x, mz = ball.y - this.ballPrev.y; if (Math.hypot(mx, mz) < 8) { this.ball.rotation.z -= mx / 0.11; this.ball.rotation.x += mz / 0.11; } }
      this.ballPrev = { x: ball.x, y: ball.y };
      const sc = 0.28 + Math.min(0.8, bz * 0.08);
      d.position.set(ball.x - HX, 0.021, ball.y - HZ); d.rotation.set(0, 0, 0); d.scale.set(sc, 1, sc);
      d.updateMatrix(); this.shadows.setMatrixAt(ns++, d.matrix);
    } else this.ball.visible = false;
    this.shadows.count = ns; this.shadows.instanceMatrix.needsUpdate = true;
    this.shadows.material.opacity = blobs ? 0.3 : 0.38;

    // repère de ton joueur
    if (me) {
      const pulse = 1 + 0.08 * Math.sin(now / 220);
      this.meRing.visible = this.meArrow.visible = true;
      this.meRing.position.set(me.p.x - HX, 0.03, me.p.y - HZ); this.meRing.scale.setScalar(pulse);
      this.meArrow.position.set(me.p.x - HX, 2.4 * me.lk.tall + 0.1 * Math.sin(now / 260), me.p.y - HZ);
      this.meArrow.rotation.y = now / 600;
    } else this.meRing.visible = this.meArrow.visible = false;

    // vie du stade : panneaux, drapeaux, foule qui bouge (et saute sur un but), flashs, filets
    this.boardTex.offset.x = (now / 14000) % 1;
    this.ledTex.offset.x = -(now / 22000) % 1;
    for (const [i, f] of this.flags.entries()) f.rotation.y = (i % 2 ? Math.PI : 0) + 0.25 * Math.sin(now / 420 + i);
    const jump = celebrating ? 0.012 * Math.abs(Math.sin(now / 160)) : 0.0015 * Math.sin(now / 700);
    for (const { mat } of this.standMats) if (mat.map) mat.map.offset.y = jump;
    const fa = this.flashGeo.attributes.position, total = this.flashAll.length / 3;
    const count = celebrating ? 30 : 5;
    for (let i = 0; i < 30; i++) {
      const j = i < count ? ((Math.random() * total) | 0) * 3 : -1;
      fa.setXYZ(i, j < 0 ? 0 : this.flashAll[j], j < 0 ? -50 : this.flashAll[j + 1], j < 0 ? 0 : this.flashAll[j + 2]);
    }
    fa.needsUpdate = true;
    for (const { net, s } of this.nets) net.scale.x = celebrating && ball && Math.sign(ball.x - HX) === s && Math.abs(ball.x - HX) > HX - 1 ? 1 + 0.25 * Math.abs(Math.sin(now / 90)) : 1;
    // pluie et neige : suivent la caméra
    if (this.rain.visible) { this.rain.position.set(this.look.x, -((now / 25) % 40) + 20, this.look.z); }
    if (this.snow.visible) { this.snow.position.set(this.look.x + Math.sin(now / 3000) * 2, -((now / 600) % 40) + 20, this.look.z); }

    this.#placeCamera(dt, now);
    this.key.target.position.set(this.look.x * 0.2, 0, this.look.z * 0.2);
    if (this.usePost) { this.grade.uniforms.time.value = (now / 1000) % 100; this.composer.render(dt); }
    else this.renderer.render(this.scene, this.camera);
  }

  dispose() { this.composer?.dispose(); this.renderer.dispose(); }
}
