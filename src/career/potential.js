// Roue du potentiel : à la création, le joueur tire son palier de potentiel.
// La taille de chaque part est sa vraie probabilité (le « Phénomène » est rare).
// Le potentiel exact reste caché dans le palier ; il évolue ensuite selon les choix.

export const TIERS = [
  { id: 'modeste', label: 'Espoir modeste', lo: 0.50, hi: 0.56, p: 0.16, color: '#5b6b8c', blurb: 'Personne ne t\'attend. Tant mieux : tu as tout à prouver.' },
  { id: 'bon', label: 'Bon espoir', lo: 0.56, hi: 0.62, p: 0.26, color: '#3a8f6b', blurb: 'Un profil solide. Le travail fera la différence.' },
  { id: 'bel', label: 'Bel espoir', lo: 0.62, hi: 0.68, p: 0.27, color: '#2f7fc1', blurb: 'Les formateurs ont noté ton nom dès le premier jour.' },
  { id: 'grand', label: 'Grand espoir', lo: 0.68, hi: 0.74, p: 0.19, color: '#8a4fd1', blurb: 'Le genre de joueur que les recruteurs viennent voir.' },
  { id: 'pepite', label: 'Pépite', lo: 0.74, hi: 0.81, p: 0.09, color: '#e0812f', blurb: 'Un talent rare. Ne le gâche pas.' },
  { id: 'phenomene', label: 'Phénomène', lo: 0.81, hi: 0.9, p: 0.03, color: '#f2c230', blurb: 'Une génération en produit un. C\'est toi.' },
];

// Ordre des parts sur la roue (alterné pour que les paliers rares ne soient pas voisins)
export const WHEEL_ORDER = ['bel', 'phenomene', 'bon', 'grand', 'modeste', 'pepite', 'bel', 'bon', 'grand', 'modeste'];

// Parts de la roue : chaque palier est réparti sur ses occurrences, angles en degrés
export function wheelSlices() {
  const counts = {};
  for (const id of WHEEL_ORDER) counts[id] = (counts[id] ?? 0) + 1;
  let a = 0;
  return WHEEL_ORDER.map((id) => {
    const t = TIERS.find((x) => x.id === id);
    const span = (t.p / counts[id]) * 360;
    const s = { id, tier: t, start: a, end: a + span };
    a += span;
    return s;
  });
}

// Tirage d'un palier (aléa fourni : 0 ≤ u < 1)
export function drawTier(u) {
  let acc = 0;
  for (const t of TIERS) { acc += t.p; if (u < acc) return t; }
  return TIERS[TIERS.length - 1];
}

export const tierById = (id) => TIERS.find((t) => t.id === id) ?? null;

// ------------------------------------------------------------------ roue du niveau de départ
// Décalage du niveau de départ par rapport aux autres jeunes du centre choisi (repère : le benjamin
// moyen de l'effectif U17). Même principe : la taille de chaque part est sa vraie probabilité.
export const LEVEL_TIERS = [
  { id: 'retard', label: 'En retard', lo: -0.05, hi: -0.025, p: 0.15, color: '#5b6b8c', blurb: 'Le plus tendre du groupe. Il va falloir rattraper les autres, vite.' },
  { id: 'groupe', label: 'Dans le groupe', lo: -0.025, hi: 0, p: 0.3, color: '#3a8f6b', blurb: 'Un parmi d\'autres. Chaque entraînement compte pour sortir du lot.' },
  { id: 'niveau', label: 'Au niveau', lo: 0, hi: 0.025, p: 0.28, color: '#2f7fc1', blurb: 'Tu tiens la comparaison dès la première séance.' },
  { id: 'avance', label: 'En avance', lo: 0.025, hi: 0.05, p: 0.17, color: '#8a4fd1', blurb: 'Les éducateurs te voient déjà dans le onze.' },
  { id: 'surclasse', label: 'Surclassé', lo: 0.05, hi: 0.08, p: 0.08, color: '#e0812f', blurb: 'Tu joues avec un an d\'avance sur ton âge.' },
  { id: 'precoce', label: 'Précoce', lo: 0.08, hi: 0.12, p: 0.02, color: '#f2c230', blurb: 'À quinze ans, tu as déjà le niveau des plus grands.' },
];
export const LEVEL_ORDER = ['niveau', 'precoce', 'groupe', 'avance', 'retard', 'surclasse', 'niveau', 'groupe', 'avance', 'retard'];

export const WHEELS = {
  level: { id: 'level', tiers: LEVEL_TIERS, order: LEVEL_ORDER, short: { retard: 'En retard', groupe: 'Groupe', niveau: 'Au niveau', avance: 'En avance', surclasse: 'Surclassé', precoce: 'Précoce' } },
  potential: { id: 'potential', tiers: TIERS, order: WHEEL_ORDER, short: { modeste: 'Modeste', bon: 'Bon espoir', bel: 'Bel espoir', grand: 'Grand espoir', pepite: 'Pépite', phenomene: 'Phénomène' } },
};

// Parts d'une roue (angles en degrés) et tirage, pour n'importe quelle roue
export function slicesOf(w) {
  const counts = {};
  for (const id of w.order) counts[id] = (counts[id] ?? 0) + 1;
  let a = 0;
  return w.order.map((id) => {
    const t = w.tiers.find((x) => x.id === id);
    const span = (t.p / counts[id]) * 360;
    const s = { id, tier: t, start: a, end: a + span };
    a += span;
    return s;
  });
}
export function drawFrom(w, u) {
  let acc = 0;
  for (const t of w.tiers) { acc += t.p; if (u < acc) return t; }
  return w.tiers[w.tiers.length - 1];
}
export const levelTierById = (id) => LEVEL_TIERS.find((t) => t.id === id) ?? null;
