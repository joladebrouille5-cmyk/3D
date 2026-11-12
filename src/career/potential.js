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
