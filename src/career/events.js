// Événements de vie de la semaine : génériques, liés au contexte (sélection, contrat, blessures…)
// et à la vie à l'étranger. Chaque option renvoie le texte affiché dans le bilan.
import { clubById } from './clubs.js';
import { money } from './market.js';
import { countryInfo, langLevel } from './countries.js';
// dépendances de la carrière (import circulaire sans risque : utilisées seulement à l'appel)
import { progress, selectionForecast, fixtureOfWeek, standings, nameOf } from './career.js';

export const EVENTS = [
  {
    id: 'poste', when: (st) => st.player.role !== 'GK',
    text: (st) => `Le coach te demande de dépanner à un autre poste pour le prochain match. Il compte sur toi.`,
    options: [
      { label: 'Accepter sans discuter', apply: (st) => { st.player.trust += 0.06; st.player.morale -= 0.02; return 'Le coach apprécie ton état d\'esprit.'; } },
      { label: 'Expliquer que tu préfères ton poste', apply: (st) => { st.player.trust -= 0.03; st.player.morale += 0.01; return 'Le coach prend note, un peu déçu.'; } },
    ],
  },
  {
    id: 'agent', when: (st) => st.player.age >= 16 && !st.player.agent,
    text: () => 'Un agent te contacte après un match : il promet de t\'ouvrir des portes.',
    options: [
      { label: 'Signer avec lui', apply: (st) => { st.player.agent = true; st.player.morale += 0.03; st.player.discipline -= 0.01; return 'Tu as désormais un agent : il te présentera plus d\'offres en fin de saison.'; } },
      { label: 'Demander conseil à ton formateur', apply: (st) => { st.player.trust += 0.03; st.player.pa += 0.002; return 'Ton formateur t\'aide à prendre du recul. Tu restes concentré sur ta progression.'; } },
      { label: 'Refuser poliment', apply: () => 'Tu restes sans agent pour l\'instant.' },
    ],
  },
  {
    id: 'examens', when: (st) => st.stage === 'U17' || st.stage === 'U19',
    text: () => 'Tes examens tombent la semaine d\'un tournoi important avec ton équipe.',
    options: [
      { label: 'Réviser et manquer le tournoi', apply: (st) => { st.player.school += 0.12; st.player.discipline += 0.03; st.player.pa += 0.003; st.player.trust -= 0.02; return 'Examens réussis. Le coach comprend, mais n\'oublie pas.'; } },
      { label: 'Jouer le tournoi', apply: (st) => { st.player.trust += 0.04; st.player.school -= 0.08; st.player.morale += 0.03; return 'Bon tournoi ; tes résultats scolaires en pâtissent.'; } },
    ],
  },
  {
    id: 'douleur', when: () => true,
    text: () => 'Une douleur au genou apparaît après la séance.',
    options: [
      { label: 'Le signaler au staff médical', apply: (st) => { st.player.injuryWeeks = Math.max(st.player.injuryWeeks, 1); st.player.fresh = 1; return 'Repos préventif d\'une semaine. Le staff valorise ta franchise.'; } },
      { label: 'Serrer les dents', apply: (st, r) => {
        if (r.chance(0.35)) { st.player.injuryWeeks = r.int(4, 8); st.player.pa -= 0.01; st.player.morale -= 0.08; return `La douleur s'aggrave : ${st.player.injuryWeeks} semaines d'arrêt.`; }
        st.player.trust += 0.02; return 'La douleur passe. Le coach ne s\'est rendu compte de rien.';
      } },
    ],
  },
  {
    id: 'ancien', when: () => true,
    text: () => 'Un ancien joueur du club te propose des séances individuelles le mercredi.',
    options: [
      { label: 'Accepter', apply: (st) => { st.player.pa += 0.006; st.player.fresh -= 0.08; st.player.morale += 0.02; return 'Ses conseils t\'ouvrent de nouvelles marges de progression.'; } },
      { label: 'Garder ton mercredi pour récupérer', apply: (st) => { st.player.fresh += 0.05; return 'Tu préfères préserver ta fraîcheur.'; } },
    ],
  },
  {
    id: 'soiree', when: () => true,
    text: () => 'Des amis organisent une soirée la veille du match.',
    options: [
      { label: 'Rester chez toi', apply: (st) => { st.player.discipline += 0.02; return 'Nuit complète avant le match.'; } },
      { label: 'Y aller', apply: (st, r) => {
        st.player.morale += 0.05;
        if (r.chance(0.4)) { st.player.trust -= 0.08; st.player.discipline -= 0.05; st.player.fresh -= 0.1; return 'Le coach l\'apprend le lendemain. Sa confiance en prend un coup.'; }
        st.player.fresh -= 0.05; return 'Bonne soirée, personne ne l\'a su.';
      } },
    ],
  },
  {
    id: 'mentor', when: (st) => st.player.age <= 19,
    text: () => 'Un cadre de l\'équipe te prend sous son aile et te conseille sur ton hygiène de vie.',
    options: [
      { label: 'Écouter et appliquer', apply: (st) => { st.player.pa += 0.004; st.player.discipline += 0.03; st.player.trust += 0.02; st.player.team += 0.02; return 'Sommeil, alimentation, récupération : tes habitudes changent.'; } },
      { label: 'Faire à ta façon', apply: (st) => { st.player.morale += 0.01; return 'Tu gardes tes habitudes.'; } },
    ],
  },
  {
    id: 'interview', when: (st) => (st.seasonStats?.goals ?? 0) >= 2 || (st.seasonStats?.apps ?? 0) >= 6,
    text: () => 'Le journal local veut faire ton portrait après tes derniers matchs.',
    options: [
      { label: 'Accepter l\'interview', apply: (st, r) => {
        st.player.morale += 0.04; st.player.fans += 0.03;
        if (r.chance(0.35)) { st.player.trust -= 0.03; return 'Une phrase sortie de son contexte fait le tour du vestiaire. Le coach te recadre.'; }
        return 'Bel article : ta famille l\'a encadré.';
      } },
      { label: 'Décliner poliment', apply: (st) => { st.player.discipline += 0.02; return 'Le club apprécie ta discrétion.'; } },
    ],
  },
  {
    id: 'reseaux', when: () => true,
    text: () => 'Une vidéo de ton geste technique circule sur les réseaux sociaux.',
    options: [
      { label: 'La partager partout', apply: (st, r) => {
        st.player.morale += 0.05; st.player.discipline -= 0.03; st.player.fans += 0.05; st.player.team -= 0.02;
        if (r.chance(0.3)) { st.player.trust -= 0.04; return 'Le coach n\'aime pas voir ses joueurs se mettre en avant.'; }
        return 'Des milliers de vues : ça fait du bien à la confiance.';
      } },
      { label: 'Rester discret', apply: (st) => { st.player.discipline += 0.02; st.player.trust += 0.01; return 'Tu restes concentré sur le terrain.'; } },
    ],
  },
  {
    id: 'famille', when: (st) => st.stage === 'U17' || st.stage === 'U19',
    text: () => 'Ta famille te manque : tes parents proposent de venir te chercher pour le week-end.',
    options: [
      { label: 'Rentrer à la maison', apply: (st) => { st.player.morale += 0.08; st.player.fresh += 0.08; st.player.trust -= 0.02; return 'Deux jours à la maison : tu reviens regonflé.'; } },
      { label: 'Rester au centre', apply: (st) => { st.player.morale -= 0.03; st.player.discipline += 0.02; return 'Le week-end est long, mais tu tiens bon.'; } },
    ],
  },
  {
    id: 'selection', when: (st) => st.player.trust > 0.6 && (st.seasonStats?.apps ?? 0) >= 5 && st.player.age <= 20,
    text: () => 'Tu es convoqué en sélection régionale pour un stage de trois jours.',
    options: [
      { label: 'Y aller', apply: (st) => { st.player.pa += 0.005; st.player.fresh -= 0.08; st.player.morale += 0.05; return 'Tu côtoies les meilleurs de ta génération. Tu en reviens grandi.'; } },
      { label: 'Rester avec ton club', apply: (st) => { st.player.trust += 0.03; return 'Le coach apprécie ta fidélité.'; } },
    ],
  },
  {
    id: 'nutrition', when: () => true,
    text: () => 'Le nutritionniste du club te propose un programme personnalisé.',
    options: [
      { label: 'Suivre le programme', apply: (st) => { st.player.pa += 0.003; st.player.fresh += 0.04; st.player.morale -= 0.02; return 'Moins de sucre, plus de sommeil : ton corps récupère mieux.'; } },
      { label: 'Garder tes habitudes', apply: (st) => { st.player.morale += 0.01; return 'Tu restes fidèle aux pâtes du dimanche.'; } },
    ],
  },
  {
    id: 'capitaine', when: (st) => st.player.trust >= 0.65,
    text: () => 'Le capitaine est suspendu : le coach t\'offre le brassard pour le prochain match.',
    options: [
      { label: 'Accepter le brassard', apply: (st) => { st.player.trust += 0.04; st.player.morale += 0.05; st.player.discipline += 0.02; st.player.team += 0.03; st.player.fans += 0.02; return 'Capitaine d\'un soir : un souvenir pour la vie.'; } },
      { label: 'Le laisser à un ancien', apply: (st) => { st.player.trust += 0.01; st.player.morale -= 0.01; return 'Humble, tu préfères attendre ton heure.'; } },
    ],
  },
  {
    id: 'conflit', when: () => true,
    text: () => 'À l\'entraînement, un coéquipier te cherche après un tacle appuyé.',
    options: [
      { label: 'Calmer le jeu', apply: (st) => { st.player.discipline += 0.03; st.player.trust += 0.02; st.player.team += 0.03; return 'Tu tends la main. L\'incident est clos.'; } },
      { label: 'Lui répondre', apply: (st, r) => {
        st.player.morale += 0.02; st.player.discipline -= 0.05; st.player.team -= 0.06;
        if (r.chance(0.5)) { st.player.trust -= 0.06; return 'Le coach vous sépare et te sanctionne.'; }
        return 'Le ton monte, puis tout le monde passe à autre chose.';
      } },
    ],
  },
  {
    id: 'retard', when: () => true,
    text: () => 'Ton bus est en retard : tu vas arriver après le début de la séance.',
    options: [
      { label: 'Prévenir le coach tout de suite', apply: (st) => { st.player.discipline += 0.01; st.player.trust -= 0.01; return 'Il te remercie d\'avoir prévenu.'; } },
      { label: 'Courir pour arriver à temps', apply: (st) => { st.player.fresh -= 0.06; st.player.trust += 0.02; return 'Tu arrives essoufflé mais à l\'heure.'; } },
    ],
  },
  {
    id: 'recruteur', when: (st) => st.player.age >= 16,
    text: () => 'Un recruteur d\'un grand club viendra voir ton prochain match.',
    options: [
      { label: 'Jouer pour l\'équipe', apply: (st) => { st.player.trust += 0.03; st.player.discipline += 0.02; st.player.team += 0.02; st.player.scouted = (st.player.scouted ?? 0) + 1; return 'Tu fais les efforts que personne ne voit. Lui, il les a vus.'; } },
      { label: 'Multiplier les gestes pour te montrer', apply: (st, r) => {
        st.player.trust -= 0.03; st.player.morale += 0.03;
        if (r.chance(0.5)) { st.player.scouted = (st.player.scouted ?? 0) + 1; return 'Quelques gestes réussis : ton nom est noté.'; }
        return 'Trop d\'individualisme : le recruteur repart sans conviction.';
      } },
    ],
  },
  {
    id: 'sponsor', when: (st) => st.player.age >= 17,
    text: () => 'Une marque locale te propose de porter ses crampons contre un petit contrat.',
    options: [
      { label: 'Accepter', apply: (st) => { st.player.morale += 0.04; st.player.discipline -= 0.01; return 'Ton premier contrat de sponsoring !'; } },
      { label: 'Refuser pour rester concentré', apply: (st) => { st.player.discipline += 0.02; return 'Chaque chose en son temps.'; } },
    ],
  },
  {
    id: 'ami', when: (st) => st.stage === 'U17' || st.stage === 'U19',
    text: () => 'Ton meilleur ami au centre n\'est pas conservé. Il est effondré.',
    options: [
      { label: 'Passer la soirée avec lui', apply: (st) => { st.player.morale -= 0.02; st.player.fresh -= 0.03; st.player.team += 0.04; return 'Il ne l\'oubliera pas. Le vestiaire non plus.'; } },
      { label: 'Rester concentré sur toi', apply: (st) => { st.player.morale -= 0.04; st.player.fresh += 0.03; return 'Le football a aussi ce visage-là.'; } },
    ],
  },
];

EVENTS.push(
  {
    id: 'isole', when: (st) => (st.player.team ?? 0.5) < 0.32,
    text: () => 'Tu te sens mis à l\'écart dans le vestiaire : les conversations s\'arrêtent quand tu arrives.',
    options: [
      { label: 'Inviter l\'équipe au restaurant', apply: (st) => { const cost = Math.min(st.player.money, 1.5); st.player.money -= cost; st.player.team += 0.09; st.player.morale += 0.02; return 'Une soirée qui change l\'ambiance. Les sourires reviennent.'; } },
      { label: 'Parler franchement au capitaine', apply: (st, r) => { if (r.chance(0.6)) { st.player.team += 0.06; return 'Le capitaine recadre les choses. On te laisse ta chance.'; } st.player.team -= 0.02; return 'La discussion tourne court.'; } },
      { label: 'T\'isoler et travailler', apply: (st) => { st.player.team -= 0.02; st.player.fresh += 0.03; return 'Tu te concentres sur toi. Le fossé se creuse un peu.'; } },
    ],
  },
  {
    id: 'fans', when: (st) => (st.player.fans ?? 0) >= 0.55,
    text: () => 'Des supporters t\'attendent à la sortie de l\'entraînement avec maillots et feutres.',
    options: [
      { label: 'Prendre le temps de signer', apply: (st) => { st.player.fans += 0.04; st.player.fresh -= 0.02; return 'Une heure d\'autographes et de selfies. Ils ne t\'oublieront pas.'; } },
      { label: 'Filer, tu es pressé', apply: (st) => { st.player.fans -= 0.03; return 'Quelques sifflets sur ton passage.'; } },
    ],
  },
);

// Événements liés au contexte : ils arrivent quand la situation s'y prête (après un match raté
// ou brillant, face au concurrent, sur le banc, en fin de contrat, avant un gros match…).
const lastRating = (st) => st.seasonStats?.ratings?.at(-1) ?? null;
const benchStreak = (st) => { const m = st.month?.matches ?? []; let n = 0; for (let i = m.length - 1; i >= 0 && !m[i].started; i--) n++; return n; };
EVENTS.push(
  {
    id: 'convocation', ctx: true, when: (st) => lastRating(st) != null && lastRating(st) < 5.9,
    text: () => 'Après ton match raté, le coach te convoque dans son bureau.',
    options: [
      { label: 'Reconnaître tes erreurs', apply: (st) => { st.player.trust += 0.04; st.player.morale -= 0.02; return 'Le coach apprécie ta lucidité. « On repart de là. »'; } },
      { label: 'Rejeter la faute sur l\'équipe', apply: (st) => { st.player.team -= 0.06; st.player.trust -= 0.03; st.player.morale += 0.02; return 'Le message fait le tour du vestiaire. Ça passe mal.'; } },
      { label: 'Demander des séances vidéo en plus', apply: (st, r) => { st.player.pa += 0.002; st.player.fresh -= 0.04; progress(st, 'tactique', 0.2, r); return 'Tu décortiques tes erreurs avec l\'adjoint. Tu les vois maintenant.'; } },
    ],
  },
  {
    id: 'presse', ctx: true, when: (st) => lastRating(st) != null && lastRating(st) >= 7.7,
    text: (st) => `Après ton grand match, la presse locale te consacre un article : « la pépite de ${clubById(st.clubId).name} ».`,
    options: [
      { label: 'Garder les pieds sur terre', apply: (st) => { st.player.discipline += 0.03; st.player.trust += 0.02; return 'Le coach découpe l\'article et l\'affiche… avec tes axes de progrès en dessous.'; } },
      { label: 'Savourer et partager', apply: (st) => { st.player.fans += 0.06; st.player.morale += 0.04; st.player.team -= 0.02; return 'Ton téléphone n\'arrête pas de vibrer. Les supporters adorent.'; } },
      { label: 'Te voir déjà au sommet', apply: (st) => { st.player.morale += 0.06; st.player.discipline -= 0.05; st.player.team -= 0.05; st.player.pa -= 0.002; return 'Quelques anciens te trouvent changé. Attention.'; } },
    ],
  },
  {
    id: 'duel', ctx: true, when: (st) => !!selectionForecast(st).rival && st.player.injuryWeeks === 0,
    text: (st) => `Ton concurrent au poste, ${selectionForecast(st).rival.name}, te glisse une remarque piquante à l'entraînement.`,
    options: [
      { label: 'Répondre sur le terrain', apply: (st, r) => { st.player.trust += 0.03; st.player.fresh -= 0.06; progress(st, 'technique', 0.2, r); return 'Tu sors le grand jeu à l\'opposition. Le staff a vu.'; } },
      { label: 'L\'ignorer', apply: (st) => { st.player.discipline += 0.02; st.player.morale -= 0.01; return 'Tu restes concentré. Il cherchera quelqu\'un d\'autre.'; } },
      { label: 'Lui répondre sèchement', apply: (st, r) => { st.player.team -= 0.05; st.player.discipline -= 0.03; st.player.morale += 0.02; if (r.chance(0.35)) { st.player.trust -= 0.04; return 'Le ton monte, le coach doit séparer tout le monde. Il n\'a pas aimé.'; } return 'Le ton monte, puis chacun repart de son côté.'; } },
    ],
  },
  {
    id: 'banc', ctx: true, when: (st) => benchStreak(st) >= 3,
    text: () => 'Trois matchs sans débuter : tu ronges ton frein sur le banc.',
    options: [
      { label: 'Demander une explication au coach', apply: (st, r) => { if (st.player.discipline > 0.55 && r.chance(0.6)) { st.player.trust += 0.05; return 'Discussion franche : il te donne des objectifs clairs et te promet ta chance.'; } st.player.trust -= 0.03; return '« Je fais mes choix. » La porte se referme.'; } },
      { label: 'Redoubler d\'efforts à l\'entraînement', apply: (st, r) => { st.player.trust += 0.03; st.player.fresh -= 0.08; progress(st, 'physique', 0.25, r); return 'Tu arrives le premier, tu pars le dernier.'; } },
      { label: (st) => (st.stage === 'Pro' || st.stage === 'Réserve' ? 'Faire savoir que tu veux être prêté' : 'Demander à jouer avec la catégorie au-dessous'), apply: (st) => { st.player.wantsLoan = st.season; st.player.trust -= 0.03; st.player.morale += 0.02; return st.stage === 'Pro' || st.stage === 'Réserve' ? 'Ton entourage fait passer le message : des clubs pourraient se manifester au mercato.' : 'Les éducateurs prennent note de ton envie de jouer.'; } },
    ],
  },
  {
    // voie de rattrapage : un joueur écarté peut regagner sa place en changeant d'attitude
    id: 'recadrage', ctx: true, when: (st) => (st.seasonStats?.streakOut ?? 0) >= 3 && !st.chance && st.chanceSeason !== st.season && st.player.injuryWeeks === 0,
    text: () => 'Le coach te prend à part : « Tu as des qualités, mais je ne vois pas l\'envie. Trois semaines sérieuses, et tu débutes le match suivant. »',
    options: [
      { label: 'Relever le défi', apply: (st) => { st.chance = { need: 3, done: 0, season: st.season }; st.chanceSeason = st.season; st.player.morale += 0.03; return 'Le marché est clair : suivre sa demande d\'entraînement, intensité normale ou intense, pas de sortie. Trois semaines de suite.'; } },
      { label: (st) => (st.stage === 'Pro' || st.stage === 'Réserve' ? 'Demander à être prêté' : 'Demander à jouer avec la catégorie au-dessous'), apply: (st) => { st.chanceSeason = st.season; st.player.wantsLoan = st.season; st.player.trust -= 0.02; return 'Ton entourage fait passer le message. Le coach hausse les épaules.'; } },
      { label: 'Hausser les épaules', apply: (st) => { st.chanceSeason = st.season; st.player.trust -= 0.03; st.player.discipline -= 0.01; return '« Comme tu veux. » La porte se referme un peu plus.'; } },
    ],
  },
  {
    id: 'finContrat', ctx: true, when: (st) => !!st.player.contract && st.player.contract.until === st.season && st.player.contract.type !== 'aspirant' && st.week >= 8,
    text: () => 'Dernière année de contrat : le club tarde à te proposer une prolongation.',
    options: [
      { label: 'Faire pression via les médias', apply: (st) => { st.player.fans += 0.03; st.player.trust -= 0.06; st.player.leverage = st.season; return 'Ton interview fait du bruit. Les clubs intéressés sont prévenus.'; } },
      { label: 'Montrer ton attachement au club', apply: (st) => { st.player.trust += 0.04; st.player.fans += 0.05; return 'Les supporters apprécient. Le président aussi.'; } },
      { label: 'Laisser ton agent gérer', apply: (st) => { st.player.morale += 0.02; return st.player.agent ? 'Ton agent prend les choses en main. Toi, tu joues.' : 'Sans agent, rien ne bouge vraiment. Tu te concentres sur le terrain.'; } },
    ],
  },
  {
    id: 'blessureAmi', ctx: false, when: (st) => (st.player.team ?? 0.5) > 0.45,
    text: () => 'Ton meilleur ami dans l\'équipe se blesse gravement à l\'entraînement.',
    options: [
      { label: 'Lui rendre visite chaque semaine', apply: (st) => { st.player.team += 0.06; st.player.fresh -= 0.03; st.player.morale -= 0.02; return 'Il n\'oubliera pas. Le vestiaire non plus.'; } },
      { label: 'Rester concentré sur toi', apply: (st) => { st.player.morale -= 0.04; st.player.trust += 0.01; return 'Tu lui envoies un message et tu te remets au travail.'; } },
    ],
  },
  {
    id: 'grosMatch', ctx: true, when: (st) => { const fx = fixtureOfWeek(st); if (!fx || fx.bye) return false; const t = standings(st); const i = t.findIndex((x) => x.id === fx.opponentId); return i >= 0 && i < 3 && st.week >= 4; },
    text: (st) => `Semaine de gros match contre ${nameOf(st, fixtureOfWeek(st).opponentId)}, sur le podium. L'ambiance monte au centre.`,
    options: [
      { label: 'Prendre la parole dans le vestiaire', apply: (st) => { if ((st.player.team ?? 0.5) > 0.5 || st.player.trust > 0.6) { st.player.team += 0.05; st.player.morale += 0.03; return 'Tes mots portent. Tout le monde est prêt à mourir sur le terrain.'; } st.player.team -= 0.03; return 'Quelques anciens lèvent les yeux au ciel. Pas encore ta place.'; } },
      { label: 'Te préparer dans ton coin', apply: (st) => { st.player.fresh += 0.05; st.player.morale += 0.01; return 'Sieste, étirements, vidéo de ton vis-à-vis. Tu es prêt.'; } },
      { label: 'Charger l\'adversaire en conférence', apply: (st) => { st.player.fans += 0.05; st.player.discipline -= 0.02; st.player.trust -= 0.02; return 'La phrase tourne en boucle. L\'adversaire est remonté.'; } },
    ],
  },
  {
    id: 'retourSelection', ctx: true, when: (st) => !!st.player.intl?.best && (st.month?.matches ?? []).some((m) => m.comp && /France|U1|U2|Espoirs/.test(m.comp)),
    text: () => 'De retour de sélection, les jambes lourdes. Le coach te propose de souffler cette semaine.',
    options: [
      { label: 'Souffler', apply: (st) => { st.player.fresh += 0.15; st.player.trust -= 0.02; return 'Tu récupères. Ton concurrent en profite pour se montrer.'; } },
      { label: 'Enchaîner', apply: (st) => { st.player.trust += 0.03; st.player.fresh -= 0.05; return 'Le coach apprécie. Ton corps, un peu moins.'; } },
    ],
  },
);

// Vie à l'étranger : la langue, le mal du pays, la presse locale
export const abroad = (st) => !!clubById(st.clubId)?.foreign && st.stage === 'Pro';
EVENTS.push(
  {
    id: 'langue', ctx: true, when: (st) => abroad(st) && langLevel(st.player, clubById(st.clubId).country) < 0.6,
    text: (st) => `Dans le vestiaire, tout se dit en ${countryInfo(clubById(st.clubId).country).lang}. Tu comprends un mot sur deux.`,
    options: [
      { label: 'Prendre des cours intensifs', apply: (st) => { const c = clubById(st.clubId).country; (st.player.lang ??= {})[c] = Math.min(1, langLevel(st.player, c) + 0.35); st.player.team += 0.05; st.player.fresh -= 0.04; return `Tu progresses vite en ${countryInfo(c).lang}. Les blagues du vestiaire commencent à te faire rire.`; } },
      { label: 'Rester avec les francophones', apply: (st) => { st.player.morale += 0.03; st.player.team -= 0.03; return 'Tu te sens bien dans ta bulle, un peu à l\'écart du reste du groupe.'; } },
      { label: 'Laisser le terrain parler', apply: (st) => { st.player.trust += 0.01; st.player.team -= 0.01; return 'Le coach t\'explique les consignes par gestes. Ça passe… à peu près.'; } },
    ],
  },
  {
    id: 'malpays', ctx: true, when: (st) => abroad(st) && st.player.morale < 0.55,
    text: () => 'Le mal du pays te prend : la famille, les amis, la France te manquent.',
    options: [
      { label: 'Faire venir ta famille quelques jours', apply: (st) => { const cost = Math.min(st.player.money, 3); st.player.money -= cost; st.player.morale += 0.1; return 'Une semaine en famille : tu repars regonflé.'; } },
      { label: 'Serrer les dents', apply: (st) => { st.player.morale -= 0.03; st.player.discipline += 0.02; return 'Tu tiens bon. Les appels vidéo du soir aident un peu.'; } },
      { label: 'Demander un retour en France au mercato', apply: (st) => { st.player.wantsLoan = st.season; st.player.morale += 0.02; st.player.trust -= 0.03; return 'Ton entourage fait passer le message : des clubs français pourraient se manifester.'; } },
    ],
  },
  {
    id: 'presseEtrangere', ctx: false, when: (st) => abroad(st) && (st.seasonStats?.apps ?? 0) >= 4,
    text: (st) => `La presse ${countryInfo(clubById(st.clubId).country).press} s'intéresse au « jeune Français » de ${clubById(st.clubId).name}.`,
    options: [
      { label: 'Répondre dans la langue du pays', apply: (st) => { const c = clubById(st.clubId).country; const lv = langLevel(st.player, c); st.player.fans += lv > 0.3 ? 0.06 : 0.02; return lv > 0.3 ? 'Les supporters adorent l\'effort.' : 'Quelques fautes, beaucoup de sourires : l\'effort est salué.'; } },
      { label: 'Parler en français avec un traducteur', apply: (st) => { st.player.fans += 0.02; return 'Une interview sage, sans faux pas.'; } },
    ],
  },
);

export function pickEvent(st, r, ctxOnly = false) {
  const recent = st.recentEvents ?? [];
  const all = EVENTS.filter((e) => (!ctxOnly || e.ctx) && e.when(st));
  // pas deux fois le même événement à peu d'intervalle
  const pool = all.filter((e) => !recent.includes(e.id));
  if (ctxOnly && !pool.length) return null;
  if (!all.length) return null;
  const e = r.pick(pool.length ? pool : all);
  st.recentEvents = [...recent, e.id].slice(-6);
  return { id: e.id, text: e.text(st), options: e.options.map((o) => (typeof o.label === 'function' ? o.label(st) : o.label)) };
}

export const eventById = (id) => EVENTS.find((e) => e.id === id) ?? null;
