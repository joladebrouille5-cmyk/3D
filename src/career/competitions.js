// Compétitions en plus du championnat : coupes nationales, coupes d'Europe, sélections nationales.
//
// - Les adversaires hors catalogue (clubs européens, sélections) sont des équipes « synthétiques » :
//   noms de clubs et de pays réels, effectifs ENTIÈREMENT FICTIFS, force fixée par le jeu.
// - Les tours sont placés à des fractions de la saison : la même logique vaut pour un
//   championnat de 26 ou de 34 journées.

import { registerClub, clubById, CLUBS, clubLevel, academyQuality, SENIOR_CA, FOREIGN_CLUBS, divisionCA } from './clubs.js';
import { FOREIGN_CUPS, EURO_SPOTS, countryInfo } from './countries.js';
import { CLUB_PRESTIGE } from '../data/club-prestige.js';
import { registerColors } from '../ui/crest.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// ------------------------------------------------------------------ noms fictifs par langue
const NAMES = {
  es: { first: ['Pablo', 'Álvaro', 'Hugo', 'Sergio', 'Iker', 'Marco', 'Rodrigo', 'Javier', 'Dani', 'Unai', 'Mikel', 'Adrián', 'Raúl', 'Óscar'], last: ['García', 'Romero', 'Navarro', 'Ortega', 'Castillo', 'Morales', 'Delgado', 'Vidal', 'Moreno', 'Serrano', 'Iglesias', 'Herrera', 'Marín', 'Vega'] },
  en: { first: ['Jack', 'Harry', 'Oliver', 'George', 'Callum', 'Mason', 'Reece', 'Jordan', 'Kyle', 'Ryan', 'Ethan', 'Lewis', 'Jamie', 'Tom'], last: ['Walker', 'Bennett', 'Hughes', 'Carter', 'Mitchell', 'Ward', 'Turner', 'Collins', 'Parker', 'Morgan', 'Hayes', 'Fletcher', 'Baker', 'Shaw'] },
  de: { first: ['Leon', 'Jonas', 'Lukas', 'Felix', 'Niklas', 'Tim', 'Florian', 'Jan', 'Paul', 'Max', 'Kai', 'Julian', 'Moritz', 'Elias'], last: ['Müller', 'Schmidt', 'Becker', 'Hoffmann', 'Wagner', 'Krüger', 'Weber', 'Richter', 'Neumann', 'Schulz', 'Brandt', 'Vogel', 'Lang', 'Keller'] },
  it: { first: ['Lorenzo', 'Matteo', 'Andrea', 'Federico', 'Alessandro', 'Nicolò', 'Davide', 'Riccardo', 'Gianluca', 'Simone', 'Marco', 'Tommaso', 'Luca', 'Pietro'], last: ['Rossi', 'Bianchi', 'Esposito', 'Romano', 'Colombo', 'Ricci', 'Marino', 'Greco', 'Conti', 'De Luca', 'Mancini', 'Lombardi', 'Moretti', 'Barbieri'] },
  pt: { first: ['João', 'Diogo', 'Rúben', 'Tiago', 'Gonçalo', 'André', 'Rafael', 'Pedro', 'Bruno', 'Nuno', 'Vitinho', 'Gabriel', 'Lucas', 'Matheus'], last: ['Silva', 'Santos', 'Ferreira', 'Pereira', 'Costa', 'Oliveira', 'Rodrigues', 'Almeida', 'Carvalho', 'Sousa', 'Ribeiro', 'Lima', 'Araújo', 'Gomes'] },
  nl: { first: ['Daan', 'Sem', 'Bram', 'Thijs', 'Ruben', 'Jesse', 'Lars', 'Milan', 'Stijn', 'Joris', 'Wout', 'Arne', 'Senne', 'Jens'], last: ['de Jong', 'Jansen', 'Bakker', 'Visser', 'Smit', 'Mertens', 'Peeters', 'de Vries', 'van Dijk', 'Maes', 'Willems', 'Claes', 'Wouters', 'Hendriks'] },
  ar: { first: ['Youssef', 'Achraf', 'Hakim', 'Sofiane', 'Ilyas', 'Amine', 'Bilal', 'Nabil', 'Riyad', 'Walid', 'Ayoub', 'Karim', 'Mehdi', 'Hamza'], last: ['El Amrani', 'Benali', 'Bouzid', 'Haddad', 'Mansouri', 'Ziani', 'Brahimi', 'Belkacem', 'Chérif', 'Saidi', 'Taoufik', 'Ouahbi', 'Rahmani', 'Kaddour'] },
  af: { first: ['Moussa', 'Ibrahima', 'Cheikh', 'Pape', 'Sadio', 'Seydou', 'Kalidou', 'Lamine', 'Ismaïla', 'Boubacar', 'Franck', 'Wilfried', 'Serge', 'Yao'], last: ['Diop', 'Ndiaye', 'Sarr', 'Gueye', 'Koné', 'Traoré', 'Cissé', 'Touré', 'Kouassi', 'Diallo', 'Bamba', 'Sow', 'Faye', 'Yao'] },
  la: { first: ['Lautaro', 'Thiago', 'Enzo', 'Julián', 'Facundo', 'Matías', 'Gabriel', 'Rodrygo', 'Vinícius', 'Bruno', 'Nicolás', 'Lucas', 'Joaquín', 'Endrick'], last: ['González', 'Martínez', 'Fernández', 'Álvarez', 'Romero', 'Paredes', 'Souza', 'Barbosa', 'Moura', 'Carvalho', 'Acosta', 'Ruiz', 'Sosa', 'Correa'] },
  ja: { first: ['Kaoru', 'Takumi', 'Daichi', 'Ritsu', 'Kyogo', 'Hiroki', 'Wataru', 'Ao', 'Yuto', 'Kento', 'Junya', 'Sota', 'Ren', 'Haruto'], last: ['Tanaka', 'Suzuki', 'Kubo', 'Endo', 'Ito', 'Mitoma', 'Nakamura', 'Sato', 'Watanabe', 'Kobayashi', 'Yamamoto', 'Kato', 'Morita', 'Hayashi'] },
  nordic: { first: ['Erling', 'Martin', 'Kasper', 'Mikkel', 'Jonas', 'Oscar', 'Emil', 'Viktor', 'Anders', 'Rasmus', 'Mads', 'Sander', 'Kristoffer', 'Elias'], last: ['Hansen', 'Larsen', 'Nielsen', 'Andersen', 'Johansson', 'Karlsson', 'Berg', 'Lindqvist', 'Olsen', 'Pedersen', 'Strand', 'Holm', 'Dahl', 'Lund'] },
  hr: { first: ['Luka', 'Ivan', 'Mateo', 'Josip', 'Marko', 'Ante', 'Nikola', 'Domagoj', 'Lovro', 'Mario', 'Dejan', 'Petar', 'Duje', 'Bruno'], last: ['Horvat', 'Kovačić', 'Babić', 'Marić', 'Jurić', 'Novak', 'Perić', 'Vuković', 'Knežević', 'Pavlović', 'Matić', 'Petković', 'Radić', 'Šarić'] },
  tr: { first: ['Arda', 'Kerem', 'Emre', 'Barış', 'Cengiz', 'Hakan', 'Ferdi', 'Yusuf', 'Kaan', 'Mert', 'Orkun', 'Salih', 'Altay', 'Zeki'], last: ['Yılmaz', 'Kaya', 'Demir', 'Şahin', 'Çelik', 'Aydın', 'Öztürk', 'Arslan', 'Doğan', 'Kılıç', 'Kurt', 'Aksoy', 'Polat', 'Erdem'] },
};

// ------------------------------------------------------------------ clubs européens (effectifs fictifs)
// [id, nom, langue, force, couleur 1, couleur 2, motif]
const EURO = [
  ['real-madrid', 'Real Madrid', 'es', 0.765, '#ffffff', '#1e2a78', 'plain'], ['fc-barcelone', 'FC Barcelone', 'es', 0.745, '#a50044', '#004d98', 'stripes'],
  ['bayern-munich', 'Bayern Munich', 'de', 0.755, '#dc052d', '#ffffff', 'plain'], ['manchester-city', 'Manchester City', 'en', 0.76, '#6cabdd', '#1c2c5b', 'plain'],
  ['liverpool', 'Liverpool', 'en', 0.745, '#c8102e', '#ffffff', 'plain'], ['arsenal', 'Arsenal', 'en', 0.74, '#ef0107', '#ffffff', 'band'],
  ['inter-milan', 'Inter Milan', 'it', 0.725, '#0068a8', '#000000', 'stripes'], ['juventus', 'Juventus', 'it', 0.705, '#ffffff', '#000000', 'stripes'],
  ['atletico-madrid', 'Atlético Madrid', 'es', 0.715, '#cb3524', '#ffffff', 'stripes'], ['borussia-dortmund', 'Borussia Dortmund', 'de', 0.705, '#fde100', '#000000', 'plain'],
  ['chelsea', 'Chelsea', 'en', 0.715, '#034694', '#ffffff', 'plain'], ['ac-milan', 'AC Milan', 'it', 0.7, '#fb090b', '#000000', 'stripes'],
  ['napoli', 'Naples', 'it', 0.7, '#12a0d7', '#ffffff', 'plain'], ['bayer-leverkusen', 'Bayer Leverkusen', 'de', 0.705, '#e32221', '#000000', 'plain'],
  ['tottenham', 'Tottenham', 'en', 0.695, '#ffffff', '#132257', 'plain'], ['benfica', 'Benfica', 'pt', 0.685, '#e83030', '#ffffff', 'plain'],
  ['fc-porto', 'FC Porto', 'pt', 0.685, '#003893', '#ffffff', 'stripes'], ['sporting-cp', 'Sporting Portugal', 'pt', 0.675, '#008057', '#ffffff', 'hoops'],
  ['psv', 'PSV Eindhoven', 'nl', 0.675, '#ed1c24', '#ffffff', 'stripes'], ['ajax', 'Ajax Amsterdam', 'nl', 0.665, '#ffffff', '#d2122e', 'band'],
  ['villarreal', 'Villarreal', 'es', 0.67, '#ffe667', '#005187', 'plain'], ['as-rome', 'AS Rome', 'it', 0.67, '#8e1f2f', '#f0bc42', 'plain'],
  ['real-sociedad', 'Real Sociedad', 'es', 0.665, '#0067b1', '#ffffff', 'stripes'], ['feyenoord', 'Feyenoord', 'nl', 0.655, '#ff0000', '#ffffff', 'halves'],
  ['club-bruges', 'Club Bruges', 'nl', 0.645, '#0067ce', '#000000', 'stripes'], ['galatasaray', 'Galatasaray', 'tr', 0.65, '#a90432', '#fdb912', 'halves'],
  ['celtic', 'Celtic Glasgow', 'en', 0.635, '#018749', '#ffffff', 'hoops'], ['dinamo-zagreb', 'Dinamo Zagreb', 'hr', 0.62, '#0a3d91', '#ffffff', 'plain'],
  ['fc-copenhague', 'FC Copenhague', 'nordic', 0.625, '#ffffff', '#0d1f63', 'plain'], ['bodo-glimt', 'Bodø/Glimt', 'nordic', 0.62, '#ffdd00', '#000000', 'plain'],
];
const LANG_COUNTRY = { en: 'Angleterre', es: 'Espagne', it: 'Italie', de: 'Allemagne', pt: 'Portugal', nl: 'Pays-Bas', tr: 'Turquie', hr: 'Croatie' };
const EURO_NATION = { 'club-bruges': 'Belgique', celtic: 'Écosse', 'fc-copenhague': 'Danemark', 'bodo-glimt': 'Norvège' };
const FICTIONAL_EURO = EURO.map(([id, name, lang, strength, p, s, pat]) => {
  const cid = `eu-${id}`;
  registerColors(cid, { p, s, pat });
  // échelle commune avec la Ligue 1 (PSG ≈ 0,695) : les cadors européens restent devant, sans écraser
  return registerClub({ id: cid, name, strength: 0.69 + (strength - 0.69) * 0.55, names: NAMES[lang], senior: { level: 1, competition: 'Europe', group: '—', players: [] }, country: lang, nation: EURO_NATION[id] ?? LANG_COUNTRY[lang] ?? lang });
});
// Les pays dont les vrais effectifs sont au catalogue remplacent leurs clubs fictifs :
// en coupe d'Europe, on affronte le vrai Real Madrid ou le vrai Bayern, avec leurs joueurs.
const REAL_COUNTRIES = new Set(FOREIGN_CLUBS.map((c) => c.country));
const topOf = (country, n) => FOREIGN_CLUBS.filter((c) => c.country === country && c.tier === 1).sort((a, b) => b.strength - a.strength).slice(0, n);
export const EURO_CLUBS = [
  ...FICTIONAL_EURO.filter((c) => !REAL_COUNTRIES.has(c.nation)),
  ...Object.entries(EURO_SPOTS).flatMap(([country, n]) => topOf(country, n)),
];
const countryOfClub = (c) => (c?.foreign ? c.country : c?.synthetic ? c.nation ?? c.country : 'France');

// ------------------------------------------------------------------ sélections nationales (effectifs fictifs)
// [id, nom, langue, écart de niveau, couleur 1, couleur 2]
const NATIONS = [
  ['espagne', 'Espagne', 'es', 0.035, '#c60b1e', '#ffc400'], ['allemagne', 'Allemagne', 'de', 0.03, '#ffffff', '#000000'], ['angleterre', 'Angleterre', 'en', 0.03, '#ffffff', '#cf081f'],
  ['italie', 'Italie', 'it', 0.02, '#0066b3', '#ffffff'], ['portugal', 'Portugal', 'pt', 0.025, '#c8102e', '#046a38'], ['pays-bas', 'Pays-Bas', 'nl', 0.02, '#f36c21', '#ffffff'],
  ['belgique', 'Belgique', 'nl', 0.015, '#e30613', '#000000'], ['bresil', 'Brésil', 'la', 0.035, '#ffdf00', '#009c3b'], ['argentine', 'Argentine', 'la', 0.035, '#75aadb', '#ffffff'],
  ['maroc', 'Maroc', 'ar', 0.01, '#c1272d', '#006233'], ['senegal', 'Sénégal', 'af', 0.005, '#ffffff', '#00853f'], ['croatie', 'Croatie', 'hr', 0.01, '#ff0000', '#ffffff'],
  ['suisse', 'Suisse', 'de', 0, '#d52b1e', '#ffffff'], ['danemark', 'Danemark', 'nordic', 0, '#c60c30', '#ffffff'], ['japon', 'Japon', 'ja', -0.005, '#000555', '#ffffff'],
  ['etats-unis', 'États-Unis', 'en', -0.01, '#ffffff', '#002868'], ['norvege', 'Norvège', 'nordic', -0.01, '#ba0c2f', '#00205b'], ['cote-ivoire', 'Côte d\'Ivoire', 'af', 0, '#f77f00', '#009e60'],
  ['algerie', 'Algérie', 'ar', -0.01, '#ffffff', '#006233'], ['turquie', 'Turquie', 'tr', -0.005, '#e30a17', '#ffffff'],
];
// niveau requis pour une convocation, par catégorie (note de poste 0-1)
export const NAT_REQ = { U16: 0.48, U17: 0.52, U18: 0.55, U19: 0.58, U20: 0.61, U21: 0.64, A: 0.74 };
const NAT_TOURNEY = { U16: 'Tournoi de Montaigu', U17: 'Qualifications à l\'Euro U17', U18: 'Tournoi international', U19: 'Qualifications à l\'Euro U19', U20: 'Tournoi de Toulon', U21: 'Qualifications à l\'Euro Espoirs', A: 'Qualifications à la Coupe du monde' };

export function nationTeam(nid, cat) {
  const n = nid === 'france' ? ['france', 'France', 'fr', 0.04, '#1d3d8f', '#ffffff'] : NATIONS.find((x) => x[0] === nid);
  const [id, name, lang, off, p, s] = n;
  const cid = `nat-${id}-${cat}`;
  registerColors(cid, { p, s, t: id === 'france' ? '#e1000f' : null, pat: id === 'france' ? 'band' : 'plain' });
  return registerClub({
    id: cid, name: cat === 'A' ? name : `${name} ${cat === 'U21' ? 'Espoirs' : cat}`, short: id === 'france' ? 'FRA' : name.normalize('NFKD').replace(/[̀-ͯ]/g, '').slice(0, 3).toUpperCase(),
    strength: NAT_REQ[cat] + off, names: lang === 'fr' ? null : NAMES[lang], senior: { level: 1, competition: 'Sélections', group: '—', players: [] }, nation: id, cat,
  });
}

// catégorie selon l'âge (l'équipe A reste possible plus tôt pour un joueur au niveau)
export function natCategory(age, ca) {
  if (age >= 18 && ca >= NAT_REQ.A) return 'A';
  if (age <= 15) return 'U16';
  if (age === 16) return 'U17';
  if (age === 17) return 'U18';
  if (age === 18) return 'U19';
  if (age === 19) return 'U20';
  if (age <= 21) return 'U21';
  return 'A';
}

// ------------------------------------------------------------------ calendrier
const weekAt = (len, f) => clamp(Math.round(f * len), 1, len - 1);
export const INTL_WINDOWS = [0.2, 0.44, 0.7, 0.9];
export const WINTER_WINDOW = 0.5;

const CUP_FORMATS = {
  gambardella: { name: 'Coupe Gambardella', short: 'Gambardella', rounds: ['32es de finale', '16es de finale', '8es de finale', 'Quarts de finale', 'Demi-finale', 'Finale'], at: [0.24, 0.36, 0.48, 0.6, 0.74, 0.88] },
  cdf: { name: 'Coupe de France', short: 'Coupe de France', rounds: ['7e tour', '8e tour', '32es de finale', '16es de finale', '8es de finale', 'Quarts de finale', 'Demi-finale', 'Finale'], at: [0.14, 0.22, 0.32, 0.42, 0.52, 0.62, 0.76, 0.9] },
  ...FOREIGN_CUPS,
  ucl: { name: 'Ligue des champions', short: 'Ligue des champions', league: 6, at: [0.08, 0.15, 0.22, 0.29, 0.36, 0.43], ko: ['Barrage', '8es de finale', 'Quarts de finale', 'Demi-finale', 'Finale'], koAt: [0.53, 0.6, 0.69, 0.8, 0.95] },
  uel: { name: 'Ligue Europa', short: 'Ligue Europa', league: 6, at: [0.08, 0.15, 0.22, 0.29, 0.36, 0.43], ko: ['Barrage', '8es de finale', 'Quarts de finale', 'Demi-finale', 'Finale'], koAt: [0.53, 0.6, 0.69, 0.8, 0.95] },
};

// Coupes disputées par l'équipe du joueur cette saison
export function buildCups(st, len) {
  const club = clubById(st.clubId);
  const cups = [];
  const mk = (id, startIdx = 0) => {
    const f = CUP_FORMATS[id];
    const rounds = f.league
      ? f.at.map((x, i) => ({ label: `Phase de ligue · J${i + 1}`, week: weekAt(len, x), league: true }))
      : f.rounds.map((label, i) => ({ label, week: weekAt(len, f.at[i]) })).slice(startIdx);
    return { id, name: f.name, rounds, idx: 0, alive: true, points: 0, log: [], champion: false };
  };
  if (st.stage === 'U19') cups.push(mk('gambardella'));
  if (st.stage === 'Pro' && club.senior) {
    // coupe nationale du pays du club
    if (club.foreign) { const cup = countryInfo(club.country).cup; if (cup) cups.push(mk(cup)); }
    else cups.push(mk('cdf', clubLevel(club) <= 2 ? 2 : 0));
    if (clubLevel(club) === 1 && !club.synthetic) {
      const prev = st.history.at(-1);
      const sameClub = prev && prev.club === club.name && prev.stage === 'Pro';
      const prestige = club.foreign ? club.strength - divisionCA(club) : CLUB_PRESTIGE[club.id] ?? 0;
      const euro = sameClub ? (prev.pos <= 3 ? 'ucl' : prev.pos <= 6 ? 'uel' : null) : prestige >= 0.03 ? 'ucl' : prestige >= 0.012 ? 'uel' : null;
      if (euro) cups.push(mk(euro));
    }
  }
  return cups;
}

function teamPower(c) { return c.strength ?? (SENIOR_CA[clubLevel(c)] + (CLUB_PRESTIGE[c.id] ?? 0)); }

// Tirage de l'adversaire d'un tour (plus le tour avance, plus l'adversaire est fort)
export function drawOpponent(st, cup, r) {
  const used = new Set(cup.log.map((x) => x.opp));
  const n = cup.rounds.length, k = cup.idx / Math.max(1, n - 1);
  let pool;
  if (cup.id === 'gambardella') {
    pool = CLUBS.filter((c) => c.id !== st.clubId && (c.u19 || c.u17 || c.senior) && !used.has(c.id));
    const w = pool.map((c) => Math.pow(academyQuality(c), 2 + 10 * k));
    return pool[r.weighted(w)].id;
  }
  if (cup.id === 'cdf') {
    pool = CLUBS.filter((c) => c.id !== st.clubId && c.senior && !used.has(c.id));
    const w = pool.map((c) => { const lv = clubLevel(c); return k < 0.3 ? (lv >= 4 ? 3 : lv === 3 ? 1 : 0.15) : Math.pow(7 - lv, 1 + 3 * k); });
    return pool[r.weighted(w)].id;
  }
  if (FOREIGN_CUPS[cup.id]) {
    const country = FOREIGN_CUPS[cup.id].country;
    pool = FOREIGN_CLUBS.filter((c) => c.country === country && c.id !== st.clubId && !used.has(c.id));
    const w = pool.map((c) => (k < 0.35 ? (c.tier === 2 ? 3 : 1) : Math.exp((c.strength - 0.6) * (10 + 25 * k))));
    return pool[r.weighted(w)].id;
  }
  // coupes d'Europe : chapeaux en phase de ligue (2 forts, 2 moyens, 2 plus faibles), puis adversaires plus forts
  // (jamais son propre club ni un club du même pays)
  const mine = countryOfClub(clubById(st.clubId));
  const eligible = EURO_CLUBS.filter((c) => c.id !== st.clubId && countryOfClub(c) !== mine);
  const ranked = [...eligible].sort((a, b) => b.strength - a.strength);
  const third = Math.ceil(ranked.length / 3);
  const top = cup.id === 'ucl';
  const tiers = top ? [ranked.slice(0, third), ranked.slice(third, 2 * third), ranked.slice(2 * third)] : [ranked.slice(third, 2 * third), ranked.slice(2 * third), ranked.slice(2 * third)];
  if (cup.rounds[cup.idx]?.league) {
    pool = tiers[Math.min(2, Math.floor(cup.idx / 2))].filter((c) => !used.has(c.id));
    if (!pool.length) pool = eligible.filter((c) => !used.has(c.id));
    return pool[r.int(0, pool.length - 1)].id;
  }
  pool = eligible.filter((c) => !used.has(c.id));
  const w = pool.map((c) => Math.exp((c.strength - 0.69) * (top ? 30 + 50 * k : 10 + 30 * k)));
  return pool[r.weighted(w)].id;
}

// Rencontres supplémentaires de la semaine (coupes, sélection)
export function extrasForWeek(st) {
  const out = [];
  for (const cup of st.cups ?? []) {
    if (!cup.alive) continue;
    const rd = cup.rounds[cup.idx];
    if (rd && rd.week === st.week) out.push({ kind: 'cup', cupId: cup.id, label: `${cup.name} · ${rd.label}` });
  }
  if (st.callup && st.callup.week === st.week && !st.player.injuryWeeks) out.push({ kind: 'nat', label: st.callup.label });
  return out;
}

// Issue d'un tour de coupe ; renvoie le texte du compte rendu
export function resolveCupRound(st, cupId, oppId, home, gf, ga, r) {
  const cup = st.cups.find((c) => c.id === cupId);
  const rd = cup.rounds[cup.idx];
  const entry = { label: rd.label, opp: oppId, home, gf, ga, pens: null, won: null };
  let text;
  if (rd.league) {
    entry.won = gf > ga ? true : gf < ga ? false : null;
    cup.points += gf > ga ? 3 : gf === ga ? 1 : 0;
    text = `${cup.name} (${rd.label}) : ${gf > ga ? 'victoire' : gf < ga ? 'défaite' : 'nul'} ${gf}-${ga}. ${cup.points} pts.`;
    cup.log.push(entry);
    cup.idx++;
    if (cup.idx >= cup.rounds.length) {
      // fin de la phase de ligue : qualification directe, barrage ou élimination
      const len = st.league.rounds.length;
      const f = CUP_FORMATS[cupId];
      const ko = f.ko.map((label, i) => ({ label, week: weekAt(len, f.koAt[i]) }));
      if (cup.points >= 10) { cup.rounds.push(...ko.slice(1)); text += ' Qualifiés directement pour les 8es de finale !'; }
      else if (cup.points >= 7) { cup.rounds.push(...ko); text += ' Barrage pour accéder aux 8es.'; }
      else { cup.alive = false; text += ' Éliminés en phase de ligue.'; }
    }
    return text;
  }
  let won = gf > ga;
  if (gf === ga) {
    // tirs au but : légère prime à l'équipe la plus forte
    const me = clubById(st.clubId), opp = clubById(oppId);
    const pWin = clamp(0.5 + 2 * (teamPower(me) - teamPower(opp)), 0.3, 0.7);
    won = r.chance(pWin);
    const a = r.int(3, 5), b = Math.max(0, a - r.int(1, 2));
    entry.pens = won ? [a, b] : [b, a];
  }
  entry.won = won;
  cup.log.push(entry);
  const pens = entry.pens ? ` (t.a.b. ${entry.pens[0]}-${entry.pens[1]})` : '';
  if (!won) { cup.alive = false; return `${cup.name} (${rd.label}) : éliminés ${gf}-${ga}${pens}.`; }
  cup.idx++;
  if (cup.idx >= cup.rounds.length) {
    cup.champion = true; cup.alive = false;
    st.trophies ??= [];
    st.trophies.push({ season: st.season, name: cup.name, kind: 'cup', club: clubById(st.clubId).name });
    return `${cup.name} : VICTOIRE EN FINALE ${gf}-${ga}${pens} ! Le trophée est à vous.`;
  }
  return `${cup.name} (${rd.label}) : qualifiés ${gf}-${ga}${pens}. Prochain tour : ${cup.rounds[cup.idx].label}.`;
}

// ------------------------------------------------------------------ convocations
// Décidée en début de semaine de trêve : niveau, forme, état physique.
export function maybeCallup(st, r, ca) {
  const len = st.league.rounds.length;
  const windows = INTL_WINDOWS.map((f) => weekAt(len, f));
  if (!windows.includes(st.week)) return null;
  const p = st.player;
  if (p.injuryWeeks > 0) return null;
  const cat = natCategory(p.age, ca);
  const req = NAT_REQ[cat];
  const recent = (st.seasonStats?.ratings ?? []).slice(-5);
  const form = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : null;
  const formF = form == null ? 0.75 : form >= 7 ? 1.15 : form >= 6.6 ? 1 : form >= 6.2 ? 0.75 : 0.5;
  // en équipe A, il faut jouer en équipe première d'un bon niveau
  const proF = cat === 'A' ? (st.stage === 'Pro' && clubLevel(clubById(st.clubId)) <= 2 ? 1 : 0.2) : 1;
  const prob = clamp(0.5 + (ca - req) / 0.04, 0, 0.93) * formF * proF;
  if (!r.chance(prob)) return null;
  const opp = NATIONS[r.int(0, NATIONS.length - 1)][0];
  const team = nationTeam('france', cat);
  const vs = nationTeam(opp, cat);
  const friendly = r.chance(0.4);
  return { week: st.week, cat, teamId: team.id, oppId: vs.id, home: r.chance(0.5), comp: friendly ? 'Match amical' : NAT_TOURNEY[cat], label: `${team.name} · ${friendly ? 'Match amical' : NAT_TOURNEY[cat]}`, starter: ca >= team.strength - 0.01 };
}
