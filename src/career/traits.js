// Gestes signature : débloqués quand les qualités du joueur atteignent un palier, gardés ensuite.
// Ils agissent dans le moteur de match (src/engine/match.js et decisions.js lisent player.traits).
export const TRAITS = {
  enroulee: { label: 'Frappe enroulée', desc: 'Tes frappes de loin sont nettement plus précises.', icon: 'shoot', need: { shooting: 0.78, composure: 0.68 } },
  coupsfrancs: { label: 'Spécialiste des coups francs', desc: 'Tes coups francs directs trouvent bien plus souvent le cadre.', icon: 'target', need: { shooting: 0.74, passing: 0.74 } },
  dribbleur: { label: 'Dribbleur', desc: 'Tu élimines plus souvent ton adversaire direct.', icon: 'dribble', need: { dribbling: 0.8, accel: 0.72 } },
  passeur: { label: 'Passeur de génie', desc: 'Tu vois et réussis davantage de passes dans l\'espace.', icon: 'through', need: { vision: 0.8, passing: 0.78 } },
  tete: { label: 'Jeu de tête', desc: 'Tes têtes sont mieux cadrées.', icon: 'cross', need: { aerial: 0.8 } },
  sprinteur: { label: 'Sprinteur', desc: 'Pointe de vitesse supérieure.', icon: 'run', need: { pace: 0.86 } },
  rugueux: { label: 'Défenseur rugueux', desc: 'Tu gagnes plus de duels défensifs.', icon: 'tackle', need: { tackling: 0.8, positioning: 0.74 } },
  reflexes: { label: 'Réflexes de chat', desc: 'Tu sors plus de ballons sur ta ligne.', icon: 'gardien', need: { gk: 0.82 }, gk: true },
};
export const traitById = (id) => TRAITS[id] ?? null;

// Gestes nouvellement débloqués (ajoutés à p.traits)
export function unlockTraits(p) {
  p.traits ??= [];
  const fresh = [];
  for (const [id, t] of Object.entries(TRAITS)) {
    if (p.traits.includes(id) || (t.gk && p.role !== 'GK') || (!t.gk && p.role === 'GK')) continue;
    if (Object.entries(t.need).every(([k, v]) => (p.attrs[k] ?? 0) >= v)) { p.traits.push(id); fresh.push(id); }
  }
  return fresh;
}
