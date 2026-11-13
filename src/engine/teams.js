// Équipes de test aux profils SYNTHÉTIQUES.
// Conformément au concept (« Prototype moteur : quelques équipes de test aux profils
// synthétiques »), aucun club ni joueur réel n'est utilisé ici : noms, attributs et
// styles sont inventés pour évaluer les mécanismes, pas pour reproduire une force réelle.

import { Rng } from './rng.js';

// Créneaux de formation : bx = profondeur dans le bloc (0 ligne défensive, 1 attaque),
// by = largeur (0 à 1). Le gardien est géré à part.
export const FORMATIONS = {
  '4-3-3': [
    { role: 'GK', bx: -1, by: 0.5 },
    { role: 'FB', bx: 0.02, by: 0.1, side: -1 },
    { role: 'CB', bx: 0, by: 0.37 },
    { role: 'CB', bx: 0, by: 0.63 },
    { role: 'FB', bx: 0.02, by: 0.9, side: 1 },
    { role: 'DM', bx: 0.28, by: 0.5 },
    { role: 'CM', bx: 0.5, by: 0.3 },
    { role: 'CM', bx: 0.5, by: 0.7 },
    { role: 'W', bx: 0.86, by: 0.1, side: -1 },
    { role: 'ST', bx: 1, by: 0.5 },
    { role: 'W', bx: 0.86, by: 0.9, side: 1 },
  ],
  '4-4-2': [
    { role: 'GK', bx: -1, by: 0.5 },
    { role: 'FB', bx: 0.02, by: 0.1, side: -1 },
    { role: 'CB', bx: 0, by: 0.37 },
    { role: 'CB', bx: 0, by: 0.63 },
    { role: 'FB', bx: 0.02, by: 0.9, side: 1 },
    { role: 'W', bx: 0.5, by: 0.1, side: -1 },
    { role: 'CM', bx: 0.42, by: 0.38 },
    { role: 'CM', bx: 0.42, by: 0.62 },
    { role: 'W', bx: 0.5, by: 0.9, side: 1 },
    { role: 'ST', bx: 1, by: 0.4 },
    { role: 'ST', bx: 0.95, by: 0.6 },
  ],
  '4-2-3-1': [
    { role: 'GK', bx: -1, by: 0.5 },
    { role: 'FB', bx: 0.02, by: 0.1, side: -1 },
    { role: 'CB', bx: 0, by: 0.37 },
    { role: 'CB', bx: 0, by: 0.63 },
    { role: 'FB', bx: 0.02, by: 0.9, side: 1 },
    { role: 'DM', bx: 0.28, by: 0.38 },
    { role: 'DM', bx: 0.28, by: 0.62 },
    { role: 'W', bx: 0.72, by: 0.12, side: -1 },
    { role: 'AM', bx: 0.68, by: 0.5 },
    { role: 'W', bx: 0.72, by: 0.88, side: 1 },
    { role: 'ST', bx: 1, by: 0.5 },
  ],
};

export const ATTRS = ['pace', 'accel', 'stamina', 'passing', 'vision', 'decisions', 'firstTouch',
  'dribbling', 'tackling', 'positioning', 'shooting', 'aerial', 'aggression', 'gk', 'composure'];

// Gabarits par rôle (0 à 1). Ce sont des intentions de profil, pas des valeurs réelles.
export const ROLE_TEMPLATES = {
  GK: { pace: 0.35, accel: 0.45, stamina: 0.5, passing: 0.45, vision: 0.4, decisions: 0.55, firstTouch: 0.45, dribbling: 0.2, tackling: 0.2, positioning: 0.6, shooting: 0.1, aerial: 0.6, aggression: 0.3, gk: 0.68, composure: 0.55 },
  CB: { pace: 0.5, accel: 0.48, stamina: 0.6, passing: 0.5, vision: 0.42, decisions: 0.58, firstTouch: 0.5, dribbling: 0.35, tackling: 0.68, positioning: 0.66, shooting: 0.25, aerial: 0.7, aggression: 0.55, gk: 0.05, composure: 0.55 },
  FB: { pace: 0.66, accel: 0.62, stamina: 0.7, passing: 0.56, vision: 0.5, decisions: 0.54, firstTouch: 0.56, dribbling: 0.52, tackling: 0.6, positioning: 0.58, shooting: 0.3, aerial: 0.5, aggression: 0.5, gk: 0.05, composure: 0.5 },
  DM: { pace: 0.52, accel: 0.52, stamina: 0.7, passing: 0.64, vision: 0.6, decisions: 0.62, firstTouch: 0.62, dribbling: 0.48, tackling: 0.64, positioning: 0.64, shooting: 0.38, aerial: 0.56, aggression: 0.56, gk: 0.05, composure: 0.6 },
  CM: { pace: 0.56, accel: 0.56, stamina: 0.72, passing: 0.66, vision: 0.64, decisions: 0.6, firstTouch: 0.64, dribbling: 0.56, tackling: 0.52, positioning: 0.56, shooting: 0.48, aerial: 0.48, aggression: 0.48, gk: 0.05, composure: 0.58 },
  AM: { pace: 0.6, accel: 0.62, stamina: 0.62, passing: 0.68, vision: 0.7, decisions: 0.62, firstTouch: 0.7, dribbling: 0.68, tackling: 0.35, positioning: 0.5, shooting: 0.6, aerial: 0.4, aggression: 0.38, gk: 0.05, composure: 0.6 },
  W: { pace: 0.72, accel: 0.72, stamina: 0.64, passing: 0.58, vision: 0.56, decisions: 0.54, firstTouch: 0.64, dribbling: 0.7, tackling: 0.34, positioning: 0.5, shooting: 0.56, aerial: 0.4, aggression: 0.4, gk: 0.05, composure: 0.55 },
  ST: { pace: 0.66, accel: 0.66, stamina: 0.6, passing: 0.5, vision: 0.5, decisions: 0.56, firstTouch: 0.64, dribbling: 0.6, tackling: 0.3, positioning: 0.66, shooting: 0.68, aerial: 0.6, aggression: 0.5, gk: 0.05, composure: 0.62 },
};

export const FIRST = ['Malo', 'Ilian', 'Sacha', 'Noé', 'Timéo', 'Eliott', 'Yanis', 'Rayan', 'Lenny', 'Kylian', 'Nolan', 'Bastien', 'Joachim', 'Anis', 'Mathis', 'Elias', 'Tidiane', 'Corentin', 'Gaspard', 'Ismaël', 'Loïc', 'Aurélien', 'Félix', 'Moussa', 'Thibaut', 'Kenzo', 'Ruben', 'Samy', 'Évan', 'Lucas', 'Romain', 'Sékou', 'Jules', 'Gabin', 'Aymeric', 'Nathan'];
export const LAST_A = ['Ber', 'Lan', 'Mar', 'Del', 'Fon', 'Gau', 'Cha', 'Ros', 'Vil', 'Mon', 'Tal', 'Quen', 'Bou', 'Lam', 'Pel', 'Cor', 'Dar', 'Sal', 'Ker', 'Bré'];
export const LAST_B = ['vaux', 'det', 'tin', 'cour', 'lier', 'rac', 'mond', 'gnac', 'ville', 'zec', 'quin', 'rieu', 'nel', 'bert', 'lou', 'ny', 'vet', 'han', 'loz', 'zard'];

export const TEAM_DEFS = [
  {
    id: 'littoral', name: 'FC Littoral Nord', short: 'LIT', formation: '4-3-3',
    colors: { primary: '#1f6feb', secondary: '#ffffff', text: '#ffffff' },
    tactics: { pressing: 'haut', bloc: 'haut', style: 'direct' },
    mods: { pace: 0.03, accel: 0.03, stamina: 0.04, aggression: 0.04, composure: -0.02 },
    level: 0.02,
    identity: 'Pressing haut, verticalité, intensité physique.',
  },
  {
    id: 'plateau', name: 'AS Plateau Central', short: 'PLA', formation: '4-4-2',
    colors: { primary: '#c2410c', secondary: '#1c1917', text: '#ffffff' },
    tactics: { pressing: 'bas', bloc: 'bas', style: 'direct' },
    mods: { tackling: 0.04, positioning: 0.04, aerial: 0.05, dribbling: -0.03, passing: -0.02 },
    level: 0,
    identity: 'Bloc bas compact, jeu aérien, contre-attaques.',
  },
  {
    id: 'coteaux', name: 'Union des Coteaux', short: 'COT', formation: '4-2-3-1',
    colors: { primary: '#15803d', secondary: '#fde047', text: '#ffffff' },
    tactics: { pressing: 'moyen', bloc: 'moyen', style: 'patient' },
    mods: { passing: 0.05, vision: 0.04, firstTouch: 0.04, composure: 0.03, pace: -0.03, aerial: -0.03 },
    level: 0.02,
    identity: 'Possession patiente, circulation courte, milieu technique.',
  },
  {
    id: 'marais', name: 'Stade des Marais', short: 'MAR', formation: '4-4-2',
    colors: { primary: '#7c3aed', secondary: '#f5f5f4', text: '#ffffff' },
    tactics: { pressing: 'moyen', bloc: 'moyen', style: 'équilibré' },
    mods: {},
    level: -0.02,
    identity: 'Équipe de niveau inférieur, organisation simple.',
  },
];

const BENCH_ROLES = ['GK', 'CB', 'FB', 'DM', 'CM', 'W', 'ST'];

function clamp01(v) { return Math.max(0.05, Math.min(0.97, v)); }

function makePlayer(rng, def, role, num, used) {
  const tpl = ROLE_TEMPLATES[role];
  const attrs = {};
  for (const a of ATTRS) {
    const base = tpl[a] + (def.mods[a] || 0) + (a === 'gk' ? (role === 'GK' ? def.level : 0) : def.level);
    attrs[a] = clamp01(base + rng.gauss(0, a === 'gk' && role !== 'GK' ? 0.01 : 0.06));
  }
  let name;
  do {
    name = `${rng.pick(FIRST)} ${rng.pick(LAST_A)}${rng.pick(LAST_B)}`;
  } while (used.has(name));
  used.add(name);
  return { num, name, role, attrs, synthetic: true };
}

// Construit l'effectif complet (titulaires + banc) de façon déterministe.
export function buildSquad(teamId) {
  const def = TEAM_DEFS.find((t) => t.id === teamId);
  if (!def) throw new Error(`Équipe inconnue : ${teamId}`);
  const rng = new Rng(`squad:${teamId}`);
  const used = new Set();
  const slots = FORMATIONS[def.formation];
  const starterNums = { GK: [1], CB: [4, 5], FB: [3, 2], DM: [6, 8], CM: [8, 10, 6], AM: [10], W: [11, 7], ST: [9, 19] };
  const taken = new Set();
  const pickNum = (role) => {
    for (const n of starterNums[role] || []) if (!taken.has(n)) { taken.add(n); return n; }
    let n = 12; while (taken.has(n)) n++; taken.add(n); return n;
  };
  const starters = slots.map((slot, i) => ({ ...makePlayer(rng, def, slot.role, pickNum(slot.role), used), slot: i }));
  let benchNum = 16;
  const bench = BENCH_ROLES.map((role) => {
    while (taken.has(benchNum)) benchNum++;
    taken.add(benchNum);
    return makePlayer(rng, def, role, benchNum++, used);
  });
  return { def, starters, bench };
}
