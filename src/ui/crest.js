// Écussons GÉNÉRÉS (SVG) : forme, motif et initiales dérivés du nom du club et de ses couleurs.
// Ce ne sont pas les logos officiels (marques protégées). Une image fournie par l'utilisateur
// dans src/data/club-colors.js (CREST_IMAGES) remplace l'écusson généré.

import { CLUB_COLORS, TEST_TEAM_COLORS, CREST_IMAGES } from '../data/club-colors.js';

const PAIRS = [
  ['#1d4f9c', '#ffffff'], ['#d6182a', '#ffffff'], ['#0a8a3c', '#ffffff'], ['#111111', '#ffd200'],
  ['#5b2a86', '#ffffff'], ['#f47a1f', '#111111'], ['#0b2a5b', '#d6182a'], ['#ffd200', '#1d4f9c'],
  ['#7a1f2b', '#f2e6c9'], ['#0e7490', '#ffffff'], ['#d6182a', '#111111'], ['#6cb4e4', '#0b2a5b'],
  ['#ffffff', '#0a8a3c'], ['#334155', '#f5c542'], ['#be185d', '#ffffff'], ['#1d63b8', '#ffd200'],
];
const PATTERNS = ['plain', 'stripes', 'halves', 'sash', 'hoops', 'chevron', 'band'];
const SHAPES = ['shield', 'round', 'pointed', 'badge'];
const STOP = new Set(['fc', 'sc', 'as', 'us', 'ac', 'rc', 'cs', 'es', 'sa', 'so', 'ea', 'en', 'avant', 'de', 'du', 'la', 'le', 'les', 'l', 'd', 'et', 'football', 'foot', 'club', 'stade', 'olympique', 'sporting', 'association', 'union', 'u17', 'u19', '2']);

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

// Couleurs d'un club (réelles si connues, sinon déterministes)
export function clubColors(id) {
  const base = String(id).replace(/-(U17|U19|Pro|Réserve)$/, '');
  const known = CLUB_COLORS[base] ?? TEST_TEAM_COLORS[base];
  const h = hash(base);
  const [p, s] = known ? [known.p, known.s] : PAIRS[h % PAIRS.length];
  const pat = known?.pat ?? PATTERNS[(h >>> 4) % PATTERNS.length];
  const shape = SHAPES[(h >>> 8) % SHAPES.length];
  const text = luminance(p) > 0.5 ? '#111111' : '#ffffff';
  return { primary: p, secondary: s, tertiary: known?.t ?? null, pattern: pat, shape, text, known: !!known };
}

// Couleurs d'équipe pour le moteur (maillot + liseré lisible)
export function kitColors(id) {
  const c = clubColors(id);
  return { primary: c.primary, secondary: luminance(c.primary) > 0.8 ? c.secondary : c.secondary === c.primary ? '#ffffff' : c.secondary, text: c.text };
}

export function initials(name) {
  const words = String(name).normalize('NFKD').replace(/[̀-ͯ]/g, '').split(/[^A-Za-z0-9]+/).filter(Boolean);
  const main = words.filter((w) => !STOP.has(w.toLowerCase()) && !/^\d+$/.test(w));
  const use = main.length ? main : words;
  if (use.length === 1) return use[0].slice(0, 3).toUpperCase();
  return use.slice(0, 3).map((w) => w[0]).join('').toUpperCase();
}

const SHAPE_PATHS = {
  shield: 'M6 4 H94 V46 C94 76 72 92 50 100 C28 92 6 76 6 46 Z',
  pointed: 'M50 2 L94 14 V52 C94 78 74 92 50 100 C26 92 6 78 6 52 V14 Z',
  badge: 'M14 4 H86 Q96 4 96 14 V60 Q96 92 50 100 Q4 92 4 60 V14 Q4 4 14 4 Z',
  round: null,
};

function patternSvg(pat, p, s, t) {
  const third = t || s;
  switch (pat) {
    case 'stripes': return [0, 1, 2, 3, 4, 5, 6].map((i) => `<rect x="${i * 15}" y="0" width="7.5" height="104" fill="${s}"/>`).join('');
    case 'hoops': return [0, 1, 2, 3, 4, 5].map((i) => `<rect x="0" y="${8 + i * 18}" width="100" height="9" fill="${s}"/>`).join('');
    case 'halves': return `<rect x="50" y="0" width="50" height="104" fill="${s}"/>`;
    case 'sash': return `<polygon points="0,30 0,58 100,100 100,72" fill="${s}"/>${t ? `<polygon points="0,58 0,66 100,108 100,100" fill="${third}"/>` : ''}`;
    case 'chevron': return `<polygon points="0,18 50,58 100,18 100,40 50,80 0,40" fill="${s}"/>`;
    case 'band': return `<rect x="36" y="0" width="28" height="104" fill="${s}"/><rect x="41" y="0" width="18" height="104" fill="${third === s ? p : third}" opacity="${third === s ? 0 : 1}"/>`;
    default: return '';
  }
}

// Écusson SVG (chaîne). `size` en pixels CSS.
export function crestSVG(club, size = 40) {
  const id = club.clubId ?? club.id;
  const img = CREST_IMAGES[String(id).replace(/-(U17|U19|Pro|Réserve)$/, '')];
  if (img) return `<img class="crest-img" src="${img}" width="${size}" height="${size}" alt="">`;
  const c = clubColors(id);
  const txt = initials(club.name ?? id);
  const uid = `cr${hash(String(id) + size).toString(36)}`;
  const shapeEl = c.shape === 'round' ? `<circle cx="50" cy="52" r="46"/>` : `<path d="${SHAPE_PATHS[c.shape]}"/>`;
  const fs = txt.length >= 3 ? 26 : 32;
  // bandeau de texte lisible quel que soit le motif
  const lumP = luminance(c.primary);
  const plate = c.pattern === 'plain' ? '' : `<rect x="12" y="${c.shape === 'round' ? 38 : 40}" width="76" height="30" rx="6" fill="${c.primary}" opacity="0.92"/>`;
  return `<svg class="crest-svg" viewBox="0 0 100 104" width="${size}" height="${size * 1.04}" role="img" aria-label="Écusson généré : ${txt}">
    <defs><clipPath id="${uid}">${shapeEl}</clipPath>
      <linearGradient id="${uid}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.28"/><stop offset="0.55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.22"/></linearGradient></defs>
    <g clip-path="url(#${uid})"><rect x="0" y="0" width="100" height="104" fill="${c.primary}"/>${patternSvg(c.pattern, c.primary, c.secondary, c.tertiary)}${plate}<rect x="0" y="0" width="100" height="104" fill="url(#${uid}g)"/></g>
    <g fill="none" stroke="${lumP > 0.75 ? c.secondary : '#ffffff'}" stroke-width="5" stroke-opacity="0.9">${shapeEl}</g>
    <g fill="none" stroke="#000" stroke-opacity="0.35" stroke-width="1.5">${shapeEl}</g>
    <text x="50" y="${c.shape === 'round' ? 63 : 64}" text-anchor="middle" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif" font-weight="800" font-size="${fs}" fill="${c.text}" letter-spacing="1">${txt}</text>
    <circle cx="50" cy="${c.shape === 'round' ? 22 : 20}" r="5" fill="${c.text}" opacity="0.85"/>
  </svg>`;
}
