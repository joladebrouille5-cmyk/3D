// Pays étrangers au catalogue (src/data/foreign.js) : langue du vestiaire, presse, coupe nationale, salaires.
// Les ordres de grandeur sont des valeurs de jeu, sans prétention d'exactitude.

// langStart : niveau de départ dans la langue du vestiaire (0 = rien compris, 0,6 = intégration sans peine).
// Aux Pays-Bas l'anglais passe partout ; en Belgique le français suffit souvent.
// names : noms fictifs des coéquipiers en formation ; youth : championnat de jeunes ; youthCup : coupe U19.
export const COUNTRIES = {
  Angleterre: { lang: 'anglais', press: 'anglaise', cup: 'fac', langStart: 0, names: 'en', youth: 'Championnat d\'Angleterre', youthCup: 'yfa', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  Espagne: { lang: 'espagnol', press: 'espagnole', cup: 'cdr', langStart: 0, names: 'es', youth: 'Championnat d\'Espagne', youthCup: 'ycdr', flag: '🇪🇸' },
  Italie: { lang: 'italien', press: 'italienne', cup: 'cit', langStart: 0, names: 'it', youth: 'Championnat d\'Italie', youthCup: 'ycit', flag: '🇮🇹' },
  Allemagne: { lang: 'allemand', press: 'allemande', cup: 'dfb', langStart: 0, names: 'de', youth: 'Championnat d\'Allemagne', youthCup: 'ydfb', flag: '🇩🇪' },
  Portugal: { lang: 'portugais', press: 'portugaise', cup: 'tpo', langStart: 0, names: 'pt', youth: 'Championnat du Portugal', youthCup: null, flag: '🇵🇹' },
  'Pays-Bas': { lang: 'néerlandais', press: 'néerlandaise', cup: 'knvb', langStart: 0.3, names: 'nl', youth: 'Championnat des Pays-Bas', youthCup: null, flag: '🇳🇱' },
  Belgique: { lang: 'néerlandais', press: 'belge', cup: 'cbe', langStart: 0.6, names: 'nl', youth: 'Championnat de Belgique', youthCup: null, flag: '🇧🇪' },
};
// la France, pour un joueur étranger qui y joue (langue du vestiaire, presse)
COUNTRIES.France = { lang: 'français', press: 'française', cup: null, langStart: 0, names: null, youth: 'Championnat de France', youthCup: null, flag: '🇫🇷' };
export const countryInfo = (country) => COUNTRIES[country] ?? { lang: 'la langue locale', press: 'locale', cup: null, langStart: 0, names: null, youth: 'Championnat', youthCup: null };
// pays d'origine du joueur (nationalité → pays du catalogue) : on y parle sa langue
const NATION_HOME = { france: 'France', angleterre: 'Angleterre', espagne: 'Espagne', italie: 'Italie', allemagne: 'Allemagne', portugal: 'Portugal', 'pays-bas': 'Pays-Bas', belgique: 'Belgique', turquie: 'Turquie', 'etats-unis': 'États-Unis', suisse: null };
export const homeCountry = (p) => NATION_HOME[p?.nation ?? 'france'] ?? null;
export const langLevel = (p, country) => (homeCountry(p) === country ? 1 : p.lang?.[country] ?? countryInfo(country).langStart);

// Salaire mensuel de référence (k€) d'un joueur au niveau moyen du championnat (Ligue 1 : 42)
export const LEAGUE_SALARY = {
  eng1: 85, eng2: 16, esp1: 50, esp2: 8, ita1: 44, ita2: 7, ger1: 55, ger2: 12, por1: 14, ned1: 14, bel1: 12,
};

// Coupes nationales des pays étrangers (tours et place dans la saison, de 0 à 1)
export const FOREIGN_CUPS = {
  fac: { country: 'Angleterre', name: 'FA Cup', short: 'FA Cup', rounds: ['3e tour', '4e tour', '5e tour', 'Quarts de finale', 'Demi-finale', 'Finale'], at: [0.46, 0.55, 0.64, 0.73, 0.82, 0.94] },
  cdr: { country: 'Espagne', name: 'Coupe du Roi', short: 'Coupe du Roi', rounds: ['1er tour', '2e tour', '16es de finale', '8es de finale', 'Quarts de finale', 'Demi-finale', 'Finale'], at: [0.24, 0.34, 0.46, 0.55, 0.64, 0.78, 0.92] },
  cit: { country: 'Italie', name: 'Coupe d\'Italie', short: 'Coupe d\'Italie', rounds: ['1er tour', '2e tour', '16es de finale', '8es de finale', 'Quarts de finale', 'Demi-finale', 'Finale'], at: [0.06, 0.16, 0.3, 0.45, 0.6, 0.72, 0.92] },
  dfb: { country: 'Allemagne', name: 'Coupe d\'Allemagne', short: 'Coupe d\'Allemagne', rounds: ['1er tour', '2e tour', '8es de finale', 'Quarts de finale', 'Demi-finale', 'Finale'], at: [0.06, 0.28, 0.46, 0.62, 0.76, 0.94] },
  tpo: { country: 'Portugal', name: 'Coupe du Portugal', short: 'Coupe du Portugal', rounds: ['3e tour', '4e tour', '8es de finale', 'Quarts de finale', 'Demi-finale', 'Finale'], at: [0.24, 0.36, 0.48, 0.62, 0.76, 0.94] },
  knvb: { country: 'Pays-Bas', name: 'Coupe des Pays-Bas', short: 'Coupe des Pays-Bas', rounds: ['1er tour', '2e tour', '8es de finale', 'Quarts de finale', 'Demi-finale', 'Finale'], at: [0.26, 0.38, 0.52, 0.62, 0.74, 0.86] },
  cbe: { country: 'Belgique', name: 'Coupe de Belgique', short: 'Coupe de Belgique', rounds: ['7e tour', '8es de finale', 'Quarts de finale', 'Demi-finale', 'Finale'], at: [0.26, 0.38, 0.5, 0.62, 0.84] },
};

// Coupes U19 des pays étrangers (formation commencée à l'étranger) : adversaires fictifs des clubs du pays
export const YOUTH_CUPS = {
  yfa: { country: 'Angleterre', name: 'FA Youth Cup', short: 'FA Youth Cup', rounds: ['3e tour', '4e tour', '5e tour', 'Quarts de finale', 'Demi-finale', 'Finale'], at: [0.3, 0.42, 0.54, 0.66, 0.78, 0.9] },
  ycdr: { country: 'Espagne', name: 'Coupe du Roi U19', short: 'Coupe du Roi U19', rounds: ['8es de finale', 'Quarts de finale', 'Demi-finale', 'Finale'], at: [0.6, 0.7, 0.8, 0.9] },
  ycit: { country: 'Italie', name: 'Coupe d\'Italie Primavera', short: 'Coppa Primavera', rounds: ['1er tour', '2e tour', '8es de finale', 'Quarts de finale', 'Demi-finale', 'Finale'], at: [0.12, 0.26, 0.42, 0.58, 0.74, 0.88] },
  ydfb: { country: 'Allemagne', name: 'Coupe d\'Allemagne U19', short: 'DFB-Pokal U19', rounds: ['1er tour', '8es de finale', 'Quarts de finale', 'Demi-finale', 'Finale'], at: [0.2, 0.4, 0.58, 0.76, 0.9] },
};

// En coupe d'Europe, les meilleurs clubs réels de chaque pays remplacent leurs doubles fictifs
export const EURO_SPOTS = { Angleterre: 6, Espagne: 5, Italie: 5, Allemagne: 5, Portugal: 3, 'Pays-Bas': 3, Belgique: 2 };
