// Générateur pseudo-aléatoire déterministe (sfc32) avec curseur enregistrable.
// Tous les tirages du moteur passent par ici : même graine + mêmes commandes
// horodatées => mêmes événements canoniques, avec ou sans rendu.

function hashSeed(seed) {
  const str = String(seed);
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0];
}

export class Rng {
  constructor(seed) {
    this.seed = String(seed);
    [this.a, this.b, this.c, this.d] = hashSeed(this.seed);
    this.draws = 0; // curseur : nombre de tirages consommés
  }

  next() {
    let { a, b, c, d } = this;
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    const t = (a + b | 0) + d | 0;
    d = d + 1 | 0;
    a = b ^ b >>> 9;
    b = c + (c << 3) | 0;
    c = (c << 21 | c >>> 11);
    c = c + t | 0;
    this.a = a; this.b = b; this.c = c; this.d = d;
    this.draws++;
    return (t >>> 0) / 4294967296;
  }

  range(min, max) { return min + (max - min) * this.next(); }
  chance(p) { return this.next() < p; }
  int(min, max) { return Math.floor(this.range(min, max + 1)); }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }

  // Loi normale (Box-Muller), bornée pour éviter des valeurs aberrantes.
  gauss(mean = 0, sd = 1) {
    const u = Math.max(1e-9, this.next());
    const v = this.next();
    const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    return mean + sd * Math.max(-3.5, Math.min(3.5, z));
  }

  // Tirage pondéré : renvoie l'indice choisi.
  weighted(weights) {
    let total = 0;
    for (const w of weights) total += Math.max(0, w);
    if (total <= 0) return Math.floor(this.next() * weights.length);
    let r = this.next() * total;
    for (let i = 0; i < weights.length; i++) {
      r -= Math.max(0, weights[i]);
      if (r <= 0) return i;
    }
    return weights.length - 1;
  }

  snapshot() { return { seed: this.seed, a: this.a, b: this.b, c: this.c, d: this.d, draws: this.draws }; }
  restore(s) { Object.assign(this, s); }
}
