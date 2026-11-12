// Contrats, salaires, mercato d'hiver et prêts.
// Montants en milliers d'euros (k€) par mois : ordres de grandeur du football français, sans prétention
// d'exactitude. L'agent négocie les offres (une tentative par offre) et prend une commission.

import { clubById, CLUBS, clubLevel, SENIOR_CA, academyQuality, PRO_CLUBS, teamCA, divisionCA } from './clubs.js';
import { CLUB_PRESTIGE } from '../data/club-prestige.js';
import { LEAGUE_SALARY } from './countries.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// salaire mensuel selon le club, l'étape et le niveau du joueur
export function salaryFor(club, stage, ca, age) {
  if (stage === 'U17') return 0.3;
  if (stage === 'U19') return age >= 17 ? 1.0 : 0.5;
  if (stage === 'Réserve') return Math.round((1.4 + 3 * Math.max(0, ca - 0.5)) * 10) / 10;
  if (club.foreign) {
    // ordres de grandeur (countries.js) : Premier League ≈ 2× la Ligue 1, Bundesliga et LaLiga un peu au-dessus
    const base = LEAGUE_SALARY[club.leagueId] ?? 20;
    const prestige = 1 + 5 * Math.max(0, club.strength - divisionCA(club));
    return Math.round(clamp(base * prestige * Math.exp(6 * (ca - divisionCA(club))), 2, 2500) * 10) / 10;
  }
  const lv = clubLevel(club);
  const base = { 1: 42, 2: 13, 3: 5, 4: 2.8, 5: 1.6, 6: 1 }[lv];
  const prestige = 1 + 5 * Math.max(0, CLUB_PRESTIGE[club.id] ?? 0);
  const s = base * prestige * Math.exp(6 * (ca - SENIOR_CA[lv]));
  return Math.round(clamp(s, 0.8, 900) * 10) / 10;
}

// Pays d'un club et tirage mêlant clubs du pays et de l'étranger (deux pour un)
export const countryOf = (c) => (c?.foreign ? c.country : 'France');
export function mixByCountry(list, here, r, n) {
  const local = shuffle(list.filter((c) => countryOf(c) === here), r), away = shuffle(list.filter((c) => countryOf(c) !== here), r);
  const out = [];
  while (out.length < n && (local.length || away.length)) {
    if (local.length && (out.length % 3 !== 2 || !away.length)) out.push(local.shift());
    else if (away.length) out.push(away.shift());
  }
  return out;
}

export function contractType(club, stage) {
  if (stage === 'U17' || stage === 'U19') return 'aspirant';
  if (stage === 'Réserve') return 'stagiaire';
  if (club.foreign) return 'professionnel';
  return clubLevel(club) >= 5 ? 'fédéral' : 'professionnel';
}

export function contractTerms(club, stage, ca, age, { first = false } = {}) {
  const years = stage === 'U17' || stage === 'U19' ? 1 : first ? 3 : age >= 31 ? 1 + (age < 33 ? 1 : 0) : age <= 23 ? 4 : 3;
  const salary = salaryFor(club, stage, ca, age);
  const terms = { type: contractType(club, stage), years, salary };
  if (stage === 'Pro') Object.assign(terms, contractExtras(salary, age, ca, club));
  return terms;
}
// Primes (par but marqué, par victoire en ayant joué) et clause libératoire (k€) d'un contrat professionnel.
// La clause dépend du salaire et de l'âge : plus tu es jeune et prometteur, plus elle est élevée.
export function contractExtras(salary, age, ca, club) {
  const goalBonus = Math.round(Math.max(0.2, salary * 0.08) * 10) / 10;
  const winBonus = Math.round(Math.max(0.1, salary * 0.05) * 10) / 10;
  const clause = Math.round(salary * 12 * (age <= 23 ? 6 : age <= 28 ? 4 : 2.5) * (1 + 2 * Math.max(0, ca - divisionCA(club))));
  return { goalBonus, winBonus, clause };
}

export const CONTRACT_LABEL = { aspirant: 'Contrat aspirant', stagiaire: 'Contrat stagiaire', professionnel: 'Contrat professionnel', 'fédéral': 'Contrat fédéral', 'prêt': 'Prêt' };

export function money(k) {
  if (k == null) return '—';
  if (Math.abs(k) >= 1000) return `${(k / 1000).toFixed(k >= 10000 ? 0 : 1).replace('.', ',')} M€`;
  if (Math.abs(k) < 10) return `${(Math.round(k * 10) / 10).toString().replace('.', ',')} k€`;
  return `${Math.round(k)} k€`;
}

// Indemnité de transfert indicative (le club acheteur la paie au club vendeur)
export function transferFee(salary, yearsLeft) { return Math.round(salary * 12 * (1.2 + 0.6 * Math.max(0, yearsLeft)) * 10) / 10; }

// ------------------------------------------------------------------ mercato d'hiver
// Offres possibles au milieu de saison : prêt si le joueur ne joue pas, transfert s'il brille.
export function winterOffers(st, ca, r) {
  const p = st.player;
  if (!(st.stage === 'Pro' || st.stage === 'Réserve') || p.age < 17 || p.loan) return [];
  const s = st.seasonStats;
  const weeks = Math.max(1, st.week);
  const share = s.apps / weeks;
  const avg = s.ratings.length ? s.ratings.reduce((a, b) => a + b, 0) / s.ratings.length : 0;
  const club = clubById(st.clubId);
  const here = countryOf(club), power = teamCA(club, 'Pro');
  const out = [];
  // demande de transfert : le club accepte de vendre, les prétendants se signalent
  if (p.transferRequest === st.season) {
    const cands = PRO_CLUBS().filter((c) => c.id !== club.id && ca >= divisionCA(c) - 0.03 && teamCA(c, 'Pro') >= power - 0.04);
    for (const c of mixByCountry(cands, here, r, 3)) out.push({ clubId: c.id, stage: 'Pro', kind: 'Transfert (demande de transfert)', contract: contractTerms(c, 'Pro', ca, p.age) });
  }
  // clause libératoire : un club bien plus huppé peut la payer, ton club ne peut pas refuser
  if (p.contract?.clause && avg >= 7.0 && share >= 0.5) {
    const rich = PRO_CLUBS().filter((c) => c.id !== club.id && teamCA(c, 'Pro') > power + 0.04 && ca >= divisionCA(c) - 0.03 && p.contract.clause <= 2500 * (teamCA(c, 'Pro') - 0.55) * 40);
    if (rich.length && r.chance(0.4)) { const c = r.pick(rich); out.push({ clubId: c.id, stage: 'Pro', kind: `Clause libératoire payée (${p.contract.clause >= 1000 ? `${Math.round(p.contract.clause / 100) / 10} M€` : `${p.contract.clause} k€`})`, contract: contractTerms(c, 'Pro', ca, p.age) }); }
  }
  if (share < 0.35 || p.wantsLoan === st.season) {
    // peu de temps de jeu : prêt dans un club un peu plus modeste où il jouera (en France ou à l'étranger)
    const cands = PRO_CLUBS().filter((c) => c.id !== club.id && teamCA(c, 'Pro') < power - 0.015 && teamCA(c, 'Pro') >= power - 0.12 && ca >= divisionCA(c) - 0.02);
    for (const c of mixByCountry(cands, here, r, 2)) out.push({ clubId: c.id, stage: 'Pro', kind: 'Prêt jusqu\'à la fin de saison', loan: true });
  }
  if (avg >= 7.1 && share >= 0.5) {
    // il brille : un club plus huppé tente sa chance
    const cands = PRO_CLUBS().filter((c) => c.id !== club.id && teamCA(c, 'Pro') > power + 0.01 && ca >= divisionCA(c) - 0.05);
    for (const c of mixByCountry(cands, here, r, r.chance(0.5) ? 2 : 1)) out.push({ clubId: c.id, stage: 'Pro', kind: 'Transfert', contract: contractTerms(c, 'Pro', ca, p.age) });
  }
  return out;
}

function shuffle(a, r) { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r.next() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }

// Offres de prêt d'un an (fin de saison) pour un jeune qui a peu joué
export function seasonLoanOffers(st, ca, r) {
  const p = st.player;
  const s = st.seasonStats;
  if (p.loan || p.age > 22 || !(st.stage === 'Pro' || st.stage === 'Réserve')) return [];
  if (s.apps >= st.league.rounds.length * 0.35) return [];
  const club = clubById(st.clubId), power = teamCA(club, 'Pro');
  const cands = PRO_CLUBS().filter((c) => c.id !== st.clubId && teamCA(c, 'Pro') < power - 0.02 && teamCA(c, 'Pro') >= power - 0.13 && ca >= divisionCA(c) - 0.03);
  return mixByCountry(cands, countryOf(club), r, 2).map((c) => ({ clubId: c.id, stage: 'Pro', kind: 'Prêt d\'un an', loan: true }));
}

// Négociation par l'agent : une tentative par offre
export function negotiate(offer, ca, r) {
  if (offer.negotiated || !offer.contract) return { ok: false, text: 'Rien à négocier.' };
  offer.negotiated = true;
  const club = clubById(offer.clubId);
  const margin = ca - divisionCA(club);
  const pOk = clamp(0.55 + margin * 3, 0.25, 0.85);
  if (r.chance(pOk)) {
    offer.contract = { ...offer.contract, salary: Math.round(offer.contract.salary * (1.12 + r.range(0, 0.15)) * 10) / 10, years: Math.min(5, offer.contract.years + (r.chance(0.3) ? 1 : 0)) };
    return { ok: true, text: `Ton agent obtient une revalorisation : ${money(offer.contract.salary)}/mois.` };
  }
  if (r.chance(0.25)) { offer.withdrawn = true; return { ok: false, text: 'Le club se braque et retire son offre.' }; }
  return { ok: false, text: 'Le club ne bouge pas : l\'offre reste la même.' };
}

export { academyQuality };
