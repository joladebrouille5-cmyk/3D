// Contrats, salaires, mercato d'hiver et prêts.
// Montants en milliers d'euros (k€) par mois : ordres de grandeur du football français, sans prétention
// d'exactitude. L'agent négocie les offres (une tentative par offre) et prend une commission.

import { clubById, CLUBS, clubLevel, SENIOR_CA, academyQuality } from './clubs.js';
import { CLUB_PRESTIGE } from '../data/club-prestige.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// salaire mensuel selon le club, l'étape et le niveau du joueur
export function salaryFor(club, stage, ca, age) {
  if (stage === 'U17') return 0.3;
  if (stage === 'U19') return age >= 17 ? 1.0 : 0.5;
  if (stage === 'Réserve') return Math.round((1.4 + 3 * Math.max(0, ca - 0.5)) * 10) / 10;
  const lv = clubLevel(club);
  const base = { 1: 42, 2: 13, 3: 5, 4: 2.8, 5: 1.6, 6: 1 }[lv];
  const prestige = 1 + 5 * Math.max(0, CLUB_PRESTIGE[club.id] ?? 0);
  const s = base * prestige * Math.exp(6 * (ca - SENIOR_CA[lv]));
  return Math.round(clamp(s, 0.8, 900) * 10) / 10;
}

export function contractType(club, stage) {
  if (stage === 'U17' || stage === 'U19') return 'aspirant';
  if (stage === 'Réserve') return 'stagiaire';
  return clubLevel(club) >= 5 ? 'fédéral' : 'professionnel';
}

export function contractTerms(club, stage, ca, age, { first = false } = {}) {
  const years = stage === 'U17' || stage === 'U19' ? 1 : first ? 3 : age >= 31 ? 1 + (age < 33 ? 1 : 0) : age <= 23 ? 4 : 3;
  return { type: contractType(club, stage), years, salary: salaryFor(club, stage, ca, age) };
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
  const lv = clubLevel(club);
  const out = [];
  if (share < 0.35) {
    // peu de temps de jeu : prêt dans un club où il jouera
    const cands = CLUBS.filter((c) => c.id !== club.id && c.senior && clubLevel(c) >= Math.min(5, lv + 1) && clubLevel(c) <= lv + 2 && ca >= SENIOR_CA[clubLevel(c)] - 0.02);
    for (const c of shuffle(cands, r).slice(0, 2)) out.push({ clubId: c.id, stage: 'Pro', kind: 'Prêt jusqu\'à la fin de saison', loan: true });
  }
  if (avg >= 7.1 && share >= 0.5) {
    // il brille : un club d'un cran au-dessus tente sa chance
    const cands = CLUBS.filter((c) => c.id !== club.id && c.senior && (clubLevel(c) < lv || (clubLevel(c) === lv && (CLUB_PRESTIGE[c.id] ?? 0) > (CLUB_PRESTIGE[club.id] ?? 0) + 0.01)) && ca >= SENIOR_CA[clubLevel(c)] - 0.05);
    for (const c of shuffle(cands, r).slice(0, r.chance(0.5) ? 2 : 1)) out.push({ clubId: c.id, stage: 'Pro', kind: 'Transfert', contract: contractTerms(c, 'Pro', ca, p.age) });
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
  const lv = clubLevel(clubById(st.clubId));
  const cands = CLUBS.filter((c) => c.id !== st.clubId && c.senior && clubLevel(c) > lv && clubLevel(c) <= lv + 2 && ca >= SENIOR_CA[clubLevel(c)] - 0.03);
  return shuffle(cands, r).slice(0, 2).map((c) => ({ clubId: c.id, stage: 'Pro', kind: 'Prêt d\'un an', loan: true }));
}

// Négociation par l'agent : une tentative par offre
export function negotiate(offer, ca, r) {
  if (offer.negotiated || !offer.contract) return { ok: false, text: 'Rien à négocier.' };
  offer.negotiated = true;
  const club = clubById(offer.clubId);
  const margin = ca - (SENIOR_CA[clubLevel(club)] ?? 0.5);
  const pOk = clamp(0.55 + margin * 3, 0.25, 0.85);
  if (r.chance(pOk)) {
    offer.contract = { ...offer.contract, salary: Math.round(offer.contract.salary * (1.12 + r.range(0, 0.15)) * 10) / 10, years: Math.min(5, offer.contract.years + (r.chance(0.3) ? 1 : 0)) };
    return { ok: true, text: `Ton agent obtient une revalorisation : ${money(offer.contract.salary)}/mois.` };
  }
  if (r.chance(0.25)) { offer.withdrawn = true; return { ok: false, text: 'Le club se braque et retire son offre.' }; }
  return { ok: false, text: 'Le club ne bouge pas : l\'offre reste la même.' };
}

export { academyQuality };
