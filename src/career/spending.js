// Ce que ton argent peut acheter : un entourage (abonnements mensuels) et quelques achats marquants.
// Tout agit sur des jauges déjà présentes (fraîcheur, moral, blessures, scolarité, vestiaire, supporters…).
// Montants en milliers d'euros (k€). Un aspirant gagne 0,3 k€ par mois, un pro de Ligue 1 bien plus.

export const SERVICES = {
  nutri: { label: 'Nutritionniste', monthly: 0.1, icon: 'recuperation', desc: 'Meilleure récupération chaque semaine, un peu moins de blessures.' },
  prepa: { label: 'Préparateur physique personnel', monthly: 0.3, icon: 'physique', desc: 'Nettement moins de blessures, plus de fraîcheur.' },
  mental: { label: 'Préparateur mental', monthly: 0.25, icon: 'chat', desc: 'Moral plus stable, sang-froid qui progresse.' },
  video: { label: 'Analyste vidéo personnel', monthly: 0.6, icon: 'video', desc: 'Lecture du jeu et potentiel, semaine après semaine.' },
};

// Effets hebdomadaires d'un abonnement actif ; `injury` multiplie le risque de blessure
export function serviceEffects(p) {
  const s = p.services ?? {};
  const fx = { fresh: 0, morale: 0, injury: 1, composure: 0, decisions: 0, pa: 0 };
  if (s.nutri) { fx.fresh += 0.03; fx.injury *= 0.9; }
  if (s.prepa) { fx.fresh += 0.03; fx.injury *= 0.7; }
  if (s.mental) { fx.morale += 0.02; fx.composure += 0.0008; }
  if (s.video) { fx.decisions += 0.001; fx.pa += 0.0003; }
  if (p.perks?.appart) fx.fresh += 0.03; // moins de trajets
  return fx;
}

export const PURCHASES = {
  cours: {
    label: 'Cours particuliers', cost: 0.5, icon: 'ecole', desc: 'Scolarité en hausse : utile si les notes décrochent.',
    when: (st) => st.stage === 'U17' || st.stage === 'U19', perSeason: true,
    apply: (st) => { st.player.school += 0.1; st.player.discipline += 0.01; return 'Les cours particuliers paient : tes notes remontent.'; },
  },
  famille: {
    label: 'Aider ta famille', cost: 2, icon: 'repos', desc: 'Un vrai soulagement à la maison : moral et sérénité.', perSeason: true,
    apply: (st) => { st.player.morale += 0.1; st.player.discipline += 0.02; return 'Tes parents n\'en reviennent pas. Toi, tu joues plus libéré.'; },
  },
  appart: {
    label: 'Appartement près du centre', cost: 20, icon: 'home', desc: 'Moins de trajets : un peu de fraîcheur en plus chaque semaine, pour toujours.', once: true,
    apply: (st) => { (st.player.perks ??= {}).appart = true; st.player.morale += 0.04; return 'Ton premier chez-toi, à dix minutes du centre.'; },
  },
  voiture: {
    label: 'Voiture de sport', cost: 60, icon: 'forward', desc: 'Plaisir immédiat… le vestiaire et le staff apprécient moyennement.', once: true,
    apply: (st) => { const p = st.player; p.morale += 0.1; p.fans += 0.02; p.discipline -= 0.04; p.team -= 0.03; return 'Elle fait tourner les têtes sur le parking du centre. Pas toujours dans le bon sens.'; },
  },
  terrain: {
    label: 'Rénover le terrain de ton club d\'enfance', cost: 250, icon: 'stadium', desc: 'Un geste qui marque : supporters et vestiaire te voient autrement.', once: true,
    apply: (st) => { const p = st.player; p.fans += 0.15; p.team += 0.05; p.morale += 0.06; return 'Le terrain porte désormais ton nom. Tout le quartier était là pour l\'inauguration.'; },
  },
};

export const monthlyCost = (p) => Object.keys(p.services ?? {}).filter((k) => p.services[k]).reduce((a, k) => a + (SERVICES[k]?.monthly ?? 0), 0);

export function canBuy(st, id) {
  const it = PURCHASES[id];
  const p = st.player;
  if (!it || (it.when && !it.when(st))) return { ok: false, why: 'Indisponible pour l\'instant.' };
  const bought = p.bought ?? {};
  if (it.once && bought[id]) return { ok: false, why: 'Déjà acheté.' };
  if (it.perSeason && bought[id] === st.season) return { ok: false, why: 'Déjà fait cette saison.' };
  if (p.money < it.cost) return { ok: false, why: 'Économies insuffisantes.' };
  return { ok: true };
}
