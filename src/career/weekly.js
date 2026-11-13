// Ce qui change d'une semaine à l'autre : la demande du coach, une proposition hors du terrain
// qui n'existe que cette semaine, et l'atelier (geste à réussir) qui module la séance.
import { clamp } from '../engine/geom.js';
import { langLevel } from './countries.js';

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
    apply: (p, country) => { (p.lang ??= {})[country] = Math.min(1, langLevel(p, country) + 0.15); p.team += 0.03; p.trust += 0.01; return 'Deux heures de cours : tu suis enfin les consignes du coach sans traducteur.'; } },
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
  if (abroadCountry && langLevel(st.player, abroadCountry) < 0.8 && !recent.slice(-2).includes('langue') && r.chance(0.5)) {
    st.recentSpecials = [...recent, 'langue'].slice(-4);
    return 'langue';
  }
  const pool = SPECIALS.filter((s) => (!s.youth || youth) && !s.abroad && !recent.includes(s.id));
  const sp = r.pick(pool.length ? pool : SPECIALS);
  st.recentSpecials = [...recent, sp.id].slice(-4);
  return sp.id;
}

// Atelier : un geste à réussir, lié au thème. Deux mini-jeux par thème, qui alternent d'une semaine à l'autre :
// le curseur à arrêter dans la zone, et un geste propre au thème (jongles, réaction, mémoire, penalty,
// lecture du dribble, plongeon). Plus l'attribut concerné est bon, plus c'est accessible ; plus l'intensité
// est haute, plus c'est rapide.
export const DRILLS = {
  technique: { title: 'Contrôle orienté', task: 'Arrête le curseur quand le ballon arrive dans ta zone.', attr: 'firstTouch',
    alt: { kind: 'jongles', title: 'Jongles', task: 'Touche quand le ballon passe dans la zone : quatre jongles de suite, de plus en plus vite.' } },
  physique: { title: 'Départ arrêté', task: 'Arrête le curseur dans la zone verte : c\'est le coup de sifflet, ni avant ni après.', attr: 'accel',
    alt: { kind: 'reaction', title: 'Réaction au sifflet', task: 'Attends le signal vert, puis touche le plus vite possible. Trop tôt : faux départ.' } },
  tactique: { title: 'Ligne de passe', task: 'Arrête le curseur quand la ligne de passe s\'ouvre.', attr: 'vision',
    alt: { kind: 'memoire', title: 'Combinaison', task: 'Retiens l\'enchaînement de passes montré par le coach, puis refais-le dans l\'ordre.' } },
  finition: { title: 'Lucarne', task: 'Arrête le curseur dans la lucarne.', attr: 'shooting',
    alt: { kind: 'penalty', title: 'Tir au but', task: 'La mire balaie le but : déclenche quand elle est dans la cible.' } },
  defense: { title: 'Timing du tacle', task: 'Arrête le curseur dans la zone : c\'est le moment où l\'attaquant pousse son ballon.', attr: 'tackling',
    alt: { kind: 'lecture', title: 'Lire le dribble', task: 'L\'attaquant feinte puis part d\'un côté : touche le bon côté avant qu\'il ne passe. Trois duels.' } },
  gardien: { title: 'Parade', task: 'Arrête le curseur dans la zone : c\'est le moment de plonger.', attr: 'gk',
    alt: { kind: 'plongeon', title: 'Plongeon', task: 'Le tireur frappe : plonge du bon côté (gauche, centre, droite). Trois tirs.' } },
};
export const DRILL_MUL = { parfait: 1.25, bien: 1.08, rate: 0.9 };
export const DRILL_LABEL = { parfait: 'Parfait', bien: 'Réussi', rate: 'Raté' };
const pace = (intensity) => (intensity === 'intense' ? 1.3 : intensity === 'légère' ? 0.8 : 1);

// Curseur : zone plus étroite qu'avant et placée au hasard ; le curseur accélère à chaque aller-retour
export function drillZone(p, focus, intensity, u = 0.5) {
  const d = DRILLS[focus];
  if (!d) return null;
  const a = p.attrs[d.attr] ?? 0.5;
  const width = clamp(0.07 + 0.13 * a, 0.07, 0.2), perfect = clamp(0.022 + 0.028 * a, 0.022, 0.05);
  return { kind: 'curseur', title: d.title, task: d.task, width, perfect, center: clamp(0.22 + 0.56 * u, width / 2 + 0.02, 1 - width / 2 - 0.02), speed: 1.3 * pace(intensity), accel: 1.08 };
}

// Mini-jeu de la semaine : `seed` décide lequel des deux (il alterne d'une semaine à l'autre)
export function drillFor(p, focus, intensity, seed = 0) {
  const d = DRILLS[focus];
  if (!d) return null;
  const a = p.attrs[d.attr] ?? 0.5, sp = pace(intensity);
  const u = ((Math.sin(seed * 12.9898) * 43758.5453) % 1 + 1) % 1;
  if (seed % 2 === 0) return drillZone(p, focus, intensity, u);
  const base = { kind: d.alt.kind, title: d.alt.title, task: d.alt.task };
  switch (d.alt.kind) {
    case 'jongles': return { ...base, count: 4, width: clamp(0.09 + 0.12 * a, 0.09, 0.2), speed: 1.15 * sp, accel: 1.14 };
    case 'reaction': return { ...base, perfectMs: Math.round(230 + 80 * a), goodMs: Math.round(330 + 110 * a) };
    case 'memoire': return { ...base, length: a >= 0.72 ? 5 : 4, showMs: Math.round(700 / sp), fastMs: 4500 };
    case 'penalty': return { ...base, target: clamp(0.14 + 0.1 * a, 0.14, 0.24), speed: 0.85 * sp };
    case 'lecture': case 'plongeon': return { ...base, rounds: 3, windowMs: Math.round((520 + 260 * a) / sp), sides: d.alt.kind === 'plongeon' ? 3 : 2 };
    default: return drillZone(p, focus, intensity, u);
  }
}
