// Portraits générés (personnes fictives) : un visage stable par joueur FICTIF.
// Les joueurs réels (noms publiés par les clubs) n'en reçoivent pas : on n'invente pas leur visage.
import { FACES } from '../data/faces.js';
import { YOUNG, VETERAN } from '../data/face-ages.js';

// les vétérans restent disponibles pour les effectifs seniors fictifs (tirage sur tous les visages)
void VETERAN;

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export const FACE_COUNT = FACES.length;
export const faceUrl = (i) => (i == null || !FACES[i] ? null : `assets/faces/${FACES[i].f}`);
// visage stable d'un joueur fictif (clé : club + nom) ; `youth` : équipes U17/U19 (visages jeunes)
export const faceIndexFor = (key, youth = false) => {
  const h = hash(String(key));
  return youth ? YOUNG[h % YOUNG.length] : h % FACES.length;
};
export const isYouthTeamId = (id) => /-(U17|U19)$/.test(String(id)) || /^nat-[a-z-]+-U1[6-9]-/.test(String(id));

// Pastille portrait (ou initiales pour un joueur réel / sans visage)
export function avatar({ face = null, name = '', color = '#1d2a47', text = '#fff' } = {}, size = 32, cls = '') {
  const url = faceUrl(face);
  if (url) return `<img class="avatar ${cls}" src="${url}" width="${size}" height="${size}" alt="" loading="lazy" decoding="async">`;
  const ini = String(name).split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return `<span class="avatar ini ${cls}" style="width:${size}px;height:${size}px;background:${color};color:${text};font-size:${Math.round(size * 0.4)}px">${ini}</span>`;
}

// Visage d'un joueur du moteur de match (fictif seulement)
export function matchFace(m, p, userFace = null) {
  if (!p) return null;
  if (p.isUser) return userFace;
  if (p.real) return null;
  const t = m.teams[p.team];
  return faceIndexFor(`${t.def?.clubId ?? t.id}:${p.name}`, isYouthTeamId(t.def?.id ?? t.id));
}

// Sélection de visages proposés à la création : variés (toutes les planches), mélangés par graine
export function faceSample(seed, n = 24) {
  const out = [];
  let h = hash(String(seed));
  const used = new Set();
  while (out.length < Math.min(n, YOUNG.length)) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    const i = YOUNG[h % YOUNG.length];
    if (!used.has(i)) { used.add(i); out.push(i); }
  }
  return out;
}
