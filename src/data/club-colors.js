// Couleurs de club (faits publics : couleurs de maillot) et motif dominant, pour les écussons
// GÉNÉRÉS par le jeu. Aucun logo officiel n'est reproduit : ce sont des marques protégées.
// p = couleur principale, s = secondaire, pat = motif (plain, stripes, halves, sash, hoops, chevron, band)
// Les clubs absents de cette table reçoivent des couleurs et un motif déterministes.

export const CLUB_COLORS = {
  'paris-saint-germain': { p: '#0b2a5b', s: '#d6182a', pat: 'band' },
  'olympique-de-marseille': { p: '#ffffff', s: '#2fa8de', pat: 'plain' },
  'olympique-lyonnais': { p: '#ffffff', s: '#1d3c8f', pat: 'sash', t: '#d6182a' },
  'rc-lens': { p: '#e10600', s: '#ffd200', pat: 'halves' },
  'losc-lille': { p: '#d6182a', s: '#1b2a56', pat: 'plain' },
  'stade-rennais': { p: '#d6182a', s: '#111111', pat: 'halves' },
  'fc-nantes': { p: '#ffe000', s: '#0a7d3b', pat: 'plain' },
  'as-monaco': { p: '#e2001a', s: '#ffffff', pat: 'sash' },
  'ogc-nice': { p: '#d6182a', s: '#111111', pat: 'stripes' },
  'rc-strasbourg-alsace': { p: '#0b5fb0', s: '#ffffff', pat: 'plain' },
  'stade-brestois': { p: '#e2001a', s: '#ffffff', pat: 'plain' },
  'toulouse-fc': { p: '#5b2a86', s: '#ffffff', pat: 'plain' },
  'aj-auxerre': { p: '#ffffff', s: '#1d4f9c', pat: 'hoops' },
  'angers-sco': { p: '#111111', s: '#ffffff', pat: 'stripes' },
  'le-havre-ac': { p: '#6cb4e4', s: '#0b2a5b', pat: 'halves' },
  'fc-lorient': { p: '#f47a1f', s: '#111111', pat: 'plain' },
  'fc-metz': { p: '#7a1f2b', s: '#ffffff', pat: 'plain' },
  'stade-de-reims': { p: '#e2001a', s: '#ffffff', pat: 'band' },
  'montpellier-hsc': { p: '#0b2a5b', s: '#f47a1f', pat: 'chevron' },
  'as-saint-etienne': { p: '#0a8a3c', s: '#ffffff', pat: 'plain' },
  'en-avant-guingamp': { p: '#d6182a', s: '#111111', pat: 'stripes' },
  'sc-bastia': { p: '#1d4f9c', s: '#ffffff', pat: 'plain' },
  'sm-caen': { p: '#1d4f9c', s: '#d6182a', pat: 'stripes' },
  'fc-sochaux-montbeliard': { p: '#ffd200', s: '#0b2a5b', pat: 'plain' },
  'as-nancy-lorraine': { p: '#d6182a', s: '#ffffff', pat: 'band' },
  'dijon-fco': { p: '#d6182a', s: '#ffffff', pat: 'plain' },
  'clermont-foot': { p: '#c8102e', s: '#1b2a56', pat: 'halves' },
  'grenoble-foot': { p: '#1d63b8', s: '#ffffff', pat: 'plain' },
  'stade-lavallois': { p: '#f47a1f', s: '#111111', pat: 'plain' },
  'red-star-fc': { p: '#0a8a3c', s: '#ffffff', pat: 'plain' },
  'usl-dunkerque': { p: '#1d4f9c', s: '#ffffff', pat: 'stripes' },
  'pau-fc': { p: '#ffd200', s: '#1d4f9c', pat: 'plain' },
  'rodez-af': { p: '#d6182a', s: '#ffd200', pat: 'halves' },
  'estac-troyes': { p: '#1d4f9c', s: '#ffffff', pat: 'plain' },
  'le-mans-fc': { p: '#d6182a', s: '#ffd200', pat: 'band' },
  'paris-fc': { p: '#0b2a5b', s: '#ffffff', pat: 'plain' },
  'valenciennes-fc': { p: '#d6182a', s: '#ffffff', pat: 'plain' },
  'amiens-sc': { p: '#ffffff', s: '#111111', pat: 'plain' },
  'fc-annecy': { p: '#d6182a', s: '#ffffff', pat: 'plain' },
  'fc-rouen': { p: '#d6182a', s: '#ffffff', pat: 'plain' },
  'us-boulogne': { p: '#d6182a', s: '#111111', pat: 'halves' },
  'us-quevilly': { p: '#ffd200', s: '#111111', pat: 'stripes' },
  'as-cannes': { p: '#d6182a', s: '#ffffff', pat: 'plain' },
  'la-berrichonne-de-chateauroux': { p: '#1d4f9c', s: '#ffffff', pat: 'plain' },
  'us-creteil': { p: '#1d4f9c', s: '#ffffff', pat: 'plain' },
  'nimes-olympique': { p: '#d6182a', s: '#ffffff', pat: 'plain' },
  'ac-ajaccio': { p: '#d6182a', s: '#ffffff', pat: 'plain' },
  'gfc-ajaccio': { p: '#d6182a', s: '#1d4f9c', pat: 'halves' },
  'fc-girondins-de-bordeaux': { p: '#0b2a5b', s: '#ffffff', pat: 'chevron' },
  'aviron-bayonnais': { p: '#6cb4e4', s: '#ffffff', pat: 'plain' },
  'sc-toulon': { p: '#ffd200', s: '#1d4f9c', pat: 'plain' },
  'racing-club-de-france': { p: '#6cb4e4', s: '#ffffff', pat: 'hoops' },
  'fc-mulhouse': { p: '#ffd200', s: '#1d4f9c', pat: 'plain' },
  'stade-briochin': { p: '#d6182a', s: '#ffffff', pat: 'plain' },
  'us-orleans': { p: '#d6182a', s: '#ffd200', pat: 'plain' },
  'sr-colmar': { p: '#0a8a3c', s: '#ffffff', pat: 'plain' },
  'fc-chambly-oise': { p: '#1d4f9c', s: '#ffffff', pat: 'plain' },
  'fc-villefranche-beaujolais': { p: '#1d4f9c', s: '#ffffff', pat: 'plain' },
  'vannes-oc': { p: '#d6182a', s: '#ffffff', pat: 'plain' },
};

// Couleurs des équipes de test (profils synthétiques)
export const TEST_TEAM_COLORS = {
  littoral: { p: '#1f6feb', s: '#ffffff', pat: 'hoops' },
  plateau: { p: '#c2410c', s: '#1c1917', pat: 'halves' },
  coteaux: { p: '#15803d', s: '#fde047', pat: 'stripes' },
  marais: { p: '#7c3aed', s: '#f5f5f4', pat: 'sash' },
};

// Surcharges facultatives par images fournies par l'utilisateur (droits à sa charge) :
// { 'rc-lens': 'assets/crests/rc-lens.png' } — chemin relatif à index.html.
export const CREST_IMAGES = {};
