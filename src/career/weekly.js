// Ce qui change d'une semaine à l'autre : la demande du coach, une proposition hors du terrain
// qui n'existe que cette semaine, et l'atelier (geste à réussir) qui module la séance.
import { clamp } from '../engine/geom.js';

// Propositions de la semaine (une seule à la fois, jamais deux fois de suite)
export const SPECIALS = [
  { id: 'ancien', icon: 'star', label: 'Séance avec un ancien pro', desc: 'Sang-froid et lecture du jeu ; un peu de fatigue.',
    apply: (p) => { p.attrs.composure = clamp(p.attrs.composure + 0.004, 0.05, 0.97); p.attrs.decisions = clamp(p.attrs.decisions + 0.003, 0.05, 0.97); p.fresh -= 0.03; return 'Une heure avec un ancien pro du club : ses conseils sur le sang-froid face au but te marquent.'; } },
  { id: 'kine', icon: 'recuperation', label: 'Bilan complet avec le kiné', desc: 'Fraîcheur, et blessure bien moins probable cette semaine.', injury: 0.55,
    apply: (p) => { p.fresh += 0.12; return 'Le kiné dénoue tout. Tu repars léger.'; } },
  { id: 'tribune', icon: 'stadium', label: 'Match des pros en tribune', desc: 'Lecture du jeu et placement, moral en hausse.',
    apply: (p) => { p.attrs.decisions = clamp(p.attrs.decisions + 0.003, 0.05, 0.97); p.attrs.positioning = clamp(p.attrs.positioning + 0.003, 0.05, 0.97); p.morale += 0.03; return 'En tribune, tu ne regardes que ton poste. Tu vois des choses que tu ne voyais pas.'; } },
  { id: 'anniv', icon: 'chat', label: 'Anniversaire d\'un coéquipier', desc: 'Le vestiaire se soude ; un peu moins frais.',
    apply: (p) => { p.team += 0.05; p.morale += 0.03; p.fresh -= 0.04; return 'Une belle soirée : le groupe se resserre.'; } },
  { id: 'interview', icon: 'chat', label: 'Interview pour le site du club', desc: 'Supporters et confiance du club.',
    apply: (p) => { p.fans += 0.04; p.trust += 0.01; return 'Ton interview tourne sur les réseaux du club. Les supporters apprennent ton nom.'; } },
  { id: 'analyste', icon: 'video', label: 'Une heure avec l\'analyste vidéo', desc: 'Décisions et potentiel.',
    apply: (p) => { p.attrs.decisions = clamp(p.attrs.decisions + 0.004, 0.05, 0.97); p.pa += 0.001; return 'L\'analyste te montre tes trois dernières pertes de balle. Tu ne referas plus la même erreur.'; } },
  { id: 'yoga', icon: 'repos', label: 'Yoga et mobilité', desc: 'Fraîcheur, blessure moins probable cette semaine.', injury: 0.75,
    apply: (p) => { p.fresh += 0.08; p.morale += 0.01; return 'Souplesse retrouvée, dos dénoué.'; } },
  { id: 'ecolefoot', icon: 'ball', label: 'Aider à l\'école de foot du club', desc: 'Supporters, vestiaire et moral.',
    apply: (p) => { p.fans += 0.03; p.team += 0.02; p.morale += 0.03; p.fresh -= 0.02; return 'Les petits de l\'école de foot ne te lâchent plus. Tu repars avec le sourire.'; } },
  { id: 'soutien', icon: 'ecole', label: 'Soutien scolaire au centre', desc: 'Scolarité en nette hausse.', youth: true,
    apply: (p) => { p.school += 0.08; p.discipline += 0.01; return 'Deux heures de soutien : le contrôle de vendredi ne te fait plus peur.'; } },
  { id: 'langue', icon: 'chat', label: 'Cours de langue', desc: 'Tu comprends mieux le vestiaire et le coach.', abroad: true,
    apply: (p, country) => { (p.lang ??= {})[country] = Math.min(1, (p.lang[country] ?? 0) + 0.15); p.team += 0.03; p.trust += 0.01; return 'Deux heures de cours : tu suis enfin les consignes du coach sans traducteur.'; } },
  { id: 'poste', icon: 'target', label: 'Atelier avec un entraîneur de poste', desc: 'Progression des qualités de ton poste.', progress: 0.3,
    apply: () => 'Un spécialiste de ton poste corrige tes appuis et ton orientation.' },
];
export const specialById = (id) => SPECIALS.find((s) => s.id === id) ?? null;

// Demande du coach : un thème, et pourquoi
const FOCUS_ATTRS = {
  technique: ['passing', 'firstTouch', 'dribbling'], physique: ['pace', 'accel', 'stamina'], tactique: ['decisions', 'vision', 'positioning'],
  finition: ['shooting', 'composure'], defense: ['tackling', 'aerial', 'positioning'], gardien: ['gk', 'positioning', 'aerial'],
};
export function coachRequest(st, r) {
  const p = st.player;
  if (p.fresh < 0.4) return { focus: 'recuperation', why: 'Tu es dans le rouge : il veut te voir récupérer.' };
  const last = st.seasonStats?.ratings?.at(-1);
  if (last != null && last < 6 && r.chance(0.5)) return { focus: 'tactique', why: 'Après ton dernier match, il veut que tu revoies tes placements.' };
  // le point faible de ton profil, parmi les thèmes de ton poste
  const ok = Object.keys(FOCUS_ATTRS).filter((k) => (k === 'gardien') === (p.role === 'GK') || (p.role === 'GK' && k === 'physique'));
  const score = (k) => FOCUS_ATTRS[k].reduce((a, x) => a + p.attrs[x], 0) / FOCUS_ATTRS[k].length;
  const sorted = ok.sort((a, b) => score(a) - score(b));
  const focus = r.chance(0.65) ? sorted[0] : r.pick(sorted.slice(0, 3));
  const why = focus === sorted[0] ? 'C\'est ton point faible : il veut le voir progresser.' : 'Il prépare le prochain match sur ce thème.';
  return { focus, why };
}

export function pickSpecial(st, r, abroadCountry = null) {
  const youth = st.stage === 'U17' || st.stage === 'U19';
  const recent = st.recentSpecials ?? [];
  // à l'étranger, le cours de langue revient souvent tant que la langue n'est pas maîtrisée
  if (abroadCountry && (st.player.lang?.[abroadCountry] ?? 0) < 0.8 && !recent.slice(-2).includes('langue') && r.chance(0.5)) {
    st.recentSpecials = [...recent, 'langue'].slice(-4);
    return 'langue';
  }
  const pool = SPECIALS.filter((s) => (!s.youth || youth) && !s.abroad && !recent.includes(s.id));
  const sp = r.pick(pool.length ? pool : SPECIALS);
  st.recentSpecials = [...recent, sp.id].slice(-4);
  return sp.id;
}

// Atelier : un geste à réussir, lié au thème. Plus l'attribut concerné est bon, plus la zone est large ;
// plus l'intensité est haute, plus le curseur va vite.
export const DRILLS = {
  technique: { title: 'Contrôle orienté', task: 'Arrête le curseur quand le ballon arrive dans ta zone.', attr: 'firstTouch' },
  physique: { title: 'Départ arrêté', task: 'Arrête le curseur dans la zone verte : c\'est le coup de sifflet, ni avant ni après.', attr: 'accel' },
  tactique: { title: 'Ligne de passe', task: 'Arrête le curseur quand la ligne de passe s\'ouvre.', attr: 'vision' },
  finition: { title: 'Lucarne', task: 'Arrête le curseur dans la lucarne.', attr: 'shooting' },
  defense: { title: 'Timing du tacle', task: 'Arrête le curseur dans la zone : c\'est le moment où l\'attaquant pousse son ballon.', attr: 'tackling' },
  gardien: { title: 'Parade', task: 'Arrête le curseur dans la zone : c\'est le moment de plonger.', attr: 'gk' },
};
export const DRILL_MUL = { parfait: 1.25, bien: 1.08, rate: 0.9 };
export const DRILL_LABEL = { parfait: 'Parfait', bien: 'Réussi', rate: 'Raté' };
export function drillZone(p, focus, intensity) {
  const d = DRILLS[focus];
  if (!d) return null;
  const a = p.attrs[d.attr] ?? 0.5;
  return { ...d, width: clamp(0.12 + 0.22 * a, 0.12, 0.32), perfect: clamp(0.035 + 0.05 * a, 0.035, 0.08), speed: intensity === 'intense' ? 1.35 : intensity === 'légère' ? 0.75 : 1 };
}
