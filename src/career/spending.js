// Ce que ton argent peut acheter : un entourage (abonnements mensuels) et quelques achats marquants.
// Tout agit sur des jauges déjà présentes (fraîcheur, moral, blessures, scolarité, vestiaire, supporters…).
// Montants en milliers d'euros (k€). Un aspirant gagne 0,3 k€ par mois, un pro de Ligue 1 bien plus.

export const SERVICES = {
  nutri: { label: 'Nutritionniste', monthly: 0.1, icon: 'recuperation', desc: 'Meilleure récupération chaque semaine, un peu moins de blessures.' },
  prepa: { label: 'Préparateur physique personnel', monthly: 0.3, icon: 'physique', desc: 'Nettement moins de blessures, plus de fraîcheur.' },
  mental: { label: 'Préparateur mental', monthly: 0.25, icon: 'chat', desc: 'Moral plus stable, sang-froid qui progresse.' },
  video: { label: 'Analyste vidéo personnel', monthly: 0.6, icon: 'video', desc: 'Lecture du jeu et potentiel, semaine après semaine.' },
  staff: { label: 'Staff privé à domicile', monthly: 40, icon: 'physique', pro: true, desc: 'Kiné, cuisinier et préparateur chez toi : moins de blessures, plus de fraîcheur, et après 30 ans un déclin physique nettement ralenti.' },
};
// abonnements proposés selon l'étape (le staff privé n'a de sens qu'en professionnel)
export const servicesFor = (st) => Object.entries(SERVICES).filter(([, sv]) => !sv.pro || st.stage === 'Pro');

// Effets hebdomadaires d'un abonnement actif ; `injury` multiplie le risque de blessure
export function serviceEffects(p) {
  const s = p.services ?? {};
  const fx = { fresh: 0, morale: 0, injury: 1, composure: 0, decisions: 0, pa: 0 };
  if (s.nutri) { fx.fresh += 0.03; fx.injury *= 0.9; }
  if (s.prepa) { fx.fresh += 0.03; fx.injury *= 0.7; }
  if (s.mental) { fx.morale += 0.02; fx.composure += 0.0008; }
  if (s.video) { fx.decisions += 0.001; fx.pa += 0.0003; }
  if (s.staff) { fx.fresh += 0.04; fx.injury *= 0.75; }
  if (p.perks?.appart) fx.fresh += 0.03; // moins de trajets
  if (p.perks?.recovery) fx.fresh += 0.03; // bain froid, cryothérapie à la maison
  return fx;
}

// Déclin physique après 30 ans : ralenti par le staff privé et l'espace de récupération (jamais annulé)
export function ageingMul(p) {
  return (p.services?.staff ? 0.65 : 1) * (p.perks?.recovery ? 0.85 : 1);
}

// Revenus de tes placements (k€ par mois) : loyers des immeubles de rapport
export const RENT_PER_BUILDING = 12;
export const passiveIncome = (p) => (p.bought?.immo ?? 0) * RENT_PER_BUILDING;

// Ce qu'il reste de ta carrière une fois les crampons raccrochés
export const LEGACY = {
  fondation: (p) => `Fondation ${p.lastName}`,
  academie: (p) => `Académie ${p.firstName} ${p.lastName}`,
  actionnaire: (p, st) => `Actionnaire de ${st.formativeName ?? 'ton club formateur'}`,
};

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
  // ---- les grosses sommes d'une carrière professionnelle
  maison: {
    label: 'Maison avec espace de récupération', cost: 1500, icon: 'recuperation', once: true, pro: true,
    desc: 'Bain froid, cryothérapie, salle de soins : plus de fraîcheur chaque semaine et un déclin physique ralenti.',
    apply: (st) => { const p = st.player; (p.perks ??= {}).recovery = true; p.morale += 0.05; return 'Ta maison a sa propre salle de récupération. Les lendemains de match ne sont plus les mêmes.'; },
  },
  immo: {
    label: 'Immeuble de rapport', cost: 3000, icon: 'home', max: 4, pro: true,
    desc: `Des loyers chaque mois (${RENT_PER_BUILDING} k€), pendant et après ta carrière. Quatre au plus.`,
    apply: (st) => { st.player.discipline += 0.01; return 'Ton conseiller est content : les loyers tomberont chaque mois, même quand tu ne joueras plus.'; },
  },
  startup: {
    label: 'Miser sur la start-up d\'un ami', cost: 1000, icon: 'forward', perSeason: true, pro: true,
    desc: 'Un pari : verdict en fin de saison. Le triple, une petite plus-value… ou tout perdre.',
    apply: (st) => { st.player.startup = { season: st.season, stake: 1000 }; st.player.morale += 0.02; return 'Ton ami jure que c\'est la bonne. Réponse en fin de saison.'; },
  },
  fondation: {
    label: 'Créer ta fondation', cost: 5000, icon: 'chat', once: true, pro: true, legacy: true,
    desc: 'Pour les jeunes de ton quartier : les supporters t\'adorent, le vestiaire te respecte. Elle reste après ta carrière.',
    apply: (st) => { const p = st.player; p.fans += 0.15; p.team += 0.04; p.morale += 0.06; p.discipline += 0.03; return 'La fondation qui porte ton nom ouvre ses portes. Les premiers gamins arrivent dès lundi.'; },
  },
  academie: {
    label: 'Ouvrir une académie à ton nom', cost: 8000, icon: 'ball', once: true, pro: true, legacy: true,
    desc: 'Un centre de formation privé : ton nom dans le football bien après ta carrière.',
    apply: (st) => { const p = st.player; p.fans += 0.1; p.morale += 0.05; return 'Ton académie accueille sa première promotion. Certains te regardent comme tu regardais tes idoles.'; },
  },
  actionnaire: {
    label: 'Entrer au capital de ton club formateur', cost: 20000, icon: 'stadium', once: true, pro: true, legacy: true,
    desc: 'Le club qui t\'a formé : tu en deviens actionnaire, et tu y auras ta place après ta carrière.',
    apply: (st) => { const p = st.player; p.fans += 0.08; p.morale += 0.08; return `Te voilà actionnaire de ${st.formativeName ?? 'ton club formateur'}. Le président t\'a déjà réservé un bureau.`; },
  },
};

// achats proposés : ceux de ton étape ; les grosses sommes seulement quand elles deviennent envisageables
export const purchasesFor = (st) => Object.entries(PURCHASES).filter(([id, it]) => (!it.when || it.when(st)) && (!it.pro || (st.stage === 'Pro' && (st.player.money >= it.cost * 0.25 || st.player.bought?.[id]))));
export const boughtState = (st, id) => { const it = PURCHASES[id], b = st.player.bought?.[id]; return it.once ? !!b : it.max ? (b ?? 0) >= it.max : b === st.season; };

export const monthlyCost = (p) => Object.keys(p.services ?? {}).filter((k) => p.services[k]).reduce((a, k) => a + (SERVICES[k]?.monthly ?? 0), 0);

export function canBuy(st, id) {
  const it = PURCHASES[id];
  const p = st.player;
  if (!it || (it.when && !it.when(st)) || (it.pro && st.stage !== 'Pro')) return { ok: false, why: 'Indisponible pour l\'instant.' };
  const bought = p.bought ?? {};
  if (it.once && bought[id]) return { ok: false, why: 'Déjà acheté.' };
  if (it.max && (bought[id] ?? 0) >= it.max) return { ok: false, why: 'Maximum atteint.' };
  if (it.perSeason && bought[id] === st.season) return { ok: false, why: 'Déjà fait cette saison.' };
  if (p.money < it.cost) return { ok: false, why: 'Économies insuffisantes.' };
  return { ok: true };
}
