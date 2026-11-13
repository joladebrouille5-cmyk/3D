// Constantes de simulation et configuration de compétition.
// Les valeurs de gameplay sont des choix d'ingénierie à calibrer, pas des mesures validées.

export const PITCH = {
  length: 105,
  width: 68,
  goalWidth: 7.32,
  goalHeight: 2.44,
  boxDepth: 16.5,
  boxWidth: 40.32,
  sixDepth: 5.5,
  sixWidth: 18.32,
  penaltySpot: 11,
  centerRadius: 9.15,
};
PITCH.goalY1 = PITCH.width / 2 - PITCH.goalWidth / 2;
PITCH.goalY2 = PITCH.width / 2 + PITCH.goalWidth / 2;

export const SIM = {
  dt: 0.1,            // intégration du mouvement (s)
  tacticalStep: 0.5,  // pas tactique (s)
  frameEvery: 2,      // une image de replay tous les 2 pas (0,2 s)
  halfLength: 45 * 60,
  gravity: 9.81,
  rollDecel: 3.2,     // décélération d'un ballon roulant (m/s²)
  airDrag: 0.06,
};

// Configuration réglementaire d'une compétition de test. Le nombre de changements
// et de fenêtres vient de cette configuration, jamais d'une règle codée en dur.
export const DEFAULT_COMPETITION = {
  id: 'proto-test',
  name: 'Compétition de test (profils synthétiques)',
  maxSubs: 5,
  maxSubWindows: 3,      // fenêtres pendant le jeu ; la mi-temps n'en consomme pas
  halftimeWindowFree: true,
  benchSize: 7,
  validated: false,      // configuration de prototype, non validée réglementairement
};

export const INSTRUCTION_OPTIONS = {
  pressing: ['bas', 'moyen', 'haut'],
  bloc: ['bas', 'moyen', 'haut'],
  style: ['patient', 'équilibré', 'direct'],
};

export const INSTRUCTION_LABELS = {
  pressing: 'Pressing',
  bloc: 'Hauteur du bloc',
  style: 'Style de possession',
};

export const ROLE_LABELS = {
  GK: 'Gardien', CB: 'Défenseur central', FB: 'Latéral', DM: 'Milieu défensif',
  CM: 'Milieu', AM: 'Milieu offensif', W: 'Ailier', ST: 'Avant-centre',
};

// Effets de la météo du jour sur le jeu (identifiants : src/career/ambiance.js)
export const WEATHER_FX = {
  pluie: { pass: 1.12, control: -0.04 },
  vent: { lofted: 1.3 },
  neige: { pass: 1.15, speed: 0.96, control: -0.05 },
  chaleur: { fatigue: 1.25 },
};
