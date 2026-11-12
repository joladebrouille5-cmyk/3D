// Ambiance des matchs : derbys et rivalités, météo du jour.
import { Rng } from '../engine/rng.js';
import { clubById } from './clubs.js';

// [club, club, nom] (identifiants du catalogue)
const RIVALRIES = [
  ['paris-saint-germain', 'olympique-de-marseille', 'Le Classique'], ['olympique-lyonnais', 'as-saint-etienne', 'Derby du Rhône'],
  ['rc-lens', 'losc-lille', 'Derby du Nord'], ['ogc-nice', 'as-monaco', 'Derby de la Côte d\'Azur'], ['fc-nantes', 'stade-rennais-fc', 'Derby de l\'Ouest'],
  ['girondins-de-bordeaux', 'toulouse-fc', 'Derby de la Garonne'], ['olympique-de-marseille', 'olympique-lyonnais', 'Olympico'],
  ['eng-arsenal', 'eng-tottenham-hotspur', 'Derby du nord de Londres'], ['eng-liverpool', 'eng-everton', 'Derby de la Mersey'],
  ['eng-manchester-united', 'eng-manchester-city', 'Derby de Manchester'], ['eng-liverpool', 'eng-manchester-united', 'North West Derby'],
  ['eng-chelsea', 'eng-arsenal', 'Derby de Londres'], ['esp-real-madrid', 'esp-barcelona', 'El Clásico'], ['esp-real-madrid', 'esp-atletico-madrid', 'Derby madrilène'],
  ['esp-real-betis', 'esp-sevilla', 'Derby sévillan'], ['esp-athletic-club', 'esp-real-sociedad', 'Derby basque'],
  ['ita-inter-milan', 'ita-ac-milan', 'Derby della Madonnina'], ['ita-roma', 'ita-lazio', 'Derby della Capitale'], ['ita-juventus', 'ita-inter-milan', 'Derby d\'Italia'],
  ['ita-juventus', 'ita-torino', 'Derby della Mole'], ['ger-borussia-dortmund', 'ger-schalke-04', 'Revierderby'], ['ger-bayern-munich', 'ger-borussia-dortmund', 'Der Klassiker'],
  ['por-benfica', 'por-sporting-cp', 'Derby de Lisbonne'], ['por-benfica', 'por-porto', 'O Clássico'], ['ned-ajax', 'ned-feyenoord', 'De Klassieker'],
  ['ned-psv', 'ned-ajax', 'Topper'], ['bel-club-brugge', 'bel-anderlecht', 'Le Topper belge'], ['bel-club-brugge', 'bel-cercle-brugge', 'Derby de Bruges'],
  ['sco-celtic', 'sco-rangers', 'Old Firm'], ['tur-galatasaray', 'tur-fenerbahce', 'Derby intercontinental'], ['tur-besiktas', 'tur-galatasaray', 'Derby d\'Istanbul'],
  ['ksa-al-hilal', 'ksa-al-nassr', 'Derby de Riyad'], ['usa-la-galaxy', 'usa-los-angeles', 'El Tráfico'],
];
const KEY = new Map();
for (const [a, b, name] of RIVALRIES) { KEY.set(`${a}|${b}`, name); KEY.set(`${b}|${a}`, name); }
// deux clubs de la même ville (même début d'identifiant après le pays) : petit derby local
export function derbyOf(a, b) {
  if (!a || !b) return null;
  return KEY.get(`${a}|${b}`) ?? null;
}

// Météo : selon la saison de l'année et le pays ; effets légers sur le jeu (match.js lit `weather.fx`)
export const WEATHER = {
  soleil: { label: 'Soleil', icon: '☀️', fx: {} },
  nuages: { label: 'Ciel couvert', icon: '☁️', fx: {} },
  pluie: { label: 'Pluie', icon: '🌧️', fx: { pass: 1.12, control: -0.04 } },
  vent: { label: 'Vent', icon: '💨', fx: { lofted: 1.3 } },
  neige: { label: 'Neige', icon: '❄️', fx: { pass: 1.15, speed: 0.96, control: -0.05 } },
  chaleur: { label: 'Forte chaleur', icon: '🔥', fx: { fatigue: 1.25 } },
};
// `f` : avancée de la saison (0 = août, 1 = mai)
export function weatherFor(seed, f, clubId) {
  const r = new Rng(`meteo:${seed}`);
  const c = clubById(clubId);
  const country = c?.foreign ? c.country : 'France';
  const winter = f > 0.3 && f < 0.7;
  if (country === 'Arabie saoudite') return r.chance(0.5) ? 'chaleur' : 'soleil';
  const north = ['Angleterre', 'Écosse', 'Pays-Bas', 'Belgique', 'Allemagne'].includes(country);
  const w = [['soleil', winter ? 1 : 4], ['nuages', 3], ['pluie', north ? 3 : 1.5], ['vent', north ? 1.5 : 1], ['neige', winter && (north || country === 'Turquie') ? 0.6 : winter ? 0.15 : 0]];
  if (country === 'États-Unis' && !winter) w.push(['chaleur', 1.5]);
  let t = r.next() * w.reduce((a, x) => a + x[1], 0);
  for (const [id, wt] of w) { t -= wt; if (t <= 0) return id; }
  return 'nuages';
}
