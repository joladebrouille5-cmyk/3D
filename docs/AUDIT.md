# Audit de Generation Football — 11 novembre 2026

Méthode : mesures reproductibles plutôt qu'impressions.

- **Moteur** : `npm run calibrate` (40 matchs simulés, statistiques moyennes).
- **Carrière** : `node tools/audit-career.mjs 4` simule 4 saisons complètes (tous les matchs du joueur
  passent par le moteur) pour 4 clubs de niveaux différents et 3 profils de choix sur un même club :
  *sérieux* (entraînement varié, intensité adaptée à la fraîcheur, vidéo/école/repos),
  *forcené* (toujours intense + séances en plus), *dilettante* (léger + sorties).
- **Interface** : `npm run ui-check`, `ui-check-career`, `ui-check-pace`, `ui-check-tf` (Playwright, téléphone en paysage).

## 1. Moteur de match

| Statistique par match | Avant audit | Après | Référence Ligue 1 |
|---|---|---|---|
| Buts | 2,5–3,0 | 2,6 | 2,7–2,9 |
| Tirs / cadrés | 28 / 11,6 | 28 / 11,9 | 24–26 / 8–9 |
| Fautes | 26 | 26 | 24–26 |
| Cartons jaunes | 4,45 | 3,75 | 3,5–4 |
| **Cartons rouges** | **0,47** | **0,10** | 0,12–0,18 |
| Corners | 6,0 | 6,2 | 9–10 |
| Passes (2 équipes) / réussite | 1 257 / 72 % | inchangé | 900–1 000 / 82–85 % |

Corrigé :
- **Trop d'expulsions** : tous les rouges venaient de seconds avertissements (aucun rouge direct n'était
  possible : la gravité maximale ne dépassait jamais le seuil). Un joueur averti est désormais plus
  prudent (seuil du second jaune relevé) et le rouge direct existe pour un tacle glissé violent du
  dernier défenseur.

Reste à travailler (non bloquant, documenté) :
- Passes trop nombreuses et un peu trop ratées (72 % au lieu de ~83 %) ; tirs légèrement trop nombreux ;
  corners un peu rares. Ces trois points touchent l'équilibre général du moteur et demandent un passage
  de calibration dédié pour ne pas dérégler les buts.
- Performance : ≈ 2,2 s pour simuler 90 min sans rendu (résultat rapide) ; mémoire des replays
  ≈ 6 Mo par match (Float32Array) : acceptable sur téléphone.

## 2. Carrière (4 saisons simulées)

Avant correction :

| Club · profil | Potentiel départ → fin | Niveau à 18 ans | Remarque |
|---|---|---|---|
| PSG · sérieux | 73 → 85 | 78 | PSG **12e de Ligue 1** |
| Nantes · sérieux | 63 → 76 | 67 | |
| Nantes · forcené | 63 → **39** | 46 | 6 blessures, **niveau > potentiel** |
| Nantes · dilettante | 63 → 61 | 58 | titulaire 33 fois en pro malgré tout |
| Concarneau · sérieux | 62 → 74 | 67 | |

Problèmes trouvés et corrigés :
1. **Tous les clubs d'une division avaient exactement la même force** (le PSG valait le promu) : les
   classements étaient une loterie. Ajout d'une hiérarchie interne (`src/data/club-prestige.js`) utilisée
   par les résultats simulés **et** par le niveau des effectifs. Sur 300 saisons simulées de Ligue 1 :
   PSG 1er en moyenne (≈ 73 pts), OM/Monaco/Lyon/Lille 4e–5e, promus ≈ 32 pts.
   Les centres de formation réputés (PSG, Lyon, Rennes, Nantes, Sochaux, Monaco…) ont un bonus de qualité.
2. **Notes de match gonflées** (7,5–8,0 de moyenne sur une saison) : la note comptait les tacles bruts,
   très nombreux pour les attaquants dans le moteur. Note désormais normalisée par poste (références
   mesurées) et tenant compte des buts encaissés pour le gardien et les défenseurs : un match moyen
   ≈ 6,6–6,8, un très bon match > 7,5.
3. **Le potentiel pouvait passer sous le niveau actuel** (incohérent) et s'effondrait trop vite en cas
   de surmenage (−24 points en 4 ans). Le potentiel ne descend plus sous le niveau atteint ; la pénalité
   du surmenage est divisée par ~2 (les blessures restent la principale sanction).
4. **Sélection trop facile en équipe première** : il faut désormais dépasser nettement le titulaire en
   place pour prendre sa place en pro.
5. **Sauvegarde silencieuse** : si le stockage est plein ou indisponible, le jeu affichait quand même
   « Partie sauvegardée ». Un message d'erreur s'affiche maintenant.

Observations sans correction :
- Taille des sauvegardes : 26–40 Ko par carrière de 4 saisons (largement sous la limite du stockage).
- Un profil *sérieux* gagne ~12 points de potentiel en 4 ans quel que soit le club : la progression
  récompense bien les bons choix ; l'écart entre profils (sérieux +12, dilettante −2, forcené en baisse)
  est net et lisible.

## 3. Interface et rythme

- Mode « Temps forts » par défaut : ≈ 3 min réelles par match, 10–14 actions revues, ≤ 10 décisions.
- Affichage téléphone en paysage vérifié par les tests Playwright (hauteur ≤ 520 px).
- Logos : **41 vrais logos** — les 18 clubs de Ligue 1, 12 des 18 clubs de Ligue 2, plus 11 autres
  (26 depuis github.com/luukhopman/football-logos, 15 via Wikimedia). Les autres clubs ont un écusson
  généré aux vraies couleurs. Le téléchargement automatique (GitHub Actions) n'a ramené que 2 logos en
  35 min, tous deux **faux** (Metz APM ← FC Metz, Montpellier Atlas Paillade ← MHSC) : ils sont retirés,
  la correspondance exige désormais tous les mots distinctifs du nom, chaque requête a un délai de 20 s,
  et le workflow ne se lance plus qu'à la main (Wikimedia limite fortement les requêtes).

## 4. Données et règles

- Effectifs jeunes : uniquement des coéquipiers fictifs (aucun nom de mineur réel).
- `data/` et `docs/` : `import_autorise=false` conservé ; le catalogue est régénéré par `npm run catalog`.
- Notes des joueurs réels : estimations du jeu dérivées du niveau du club, jamais des valeurs réelles.

## 5. Suivi (12 novembre 2026)

- **Poste « milieu offensif » inutilisable** : absent du 4-3-3, il faisait planter la recherche du concurrent direct
  (le tableau de bord ne s'ouvrait pas). Le joueur dispute désormais la place du poste le plus proche ;
  `tests/roles.test.js` couvre les huit postes.
- **Moteur** : dégagements exclus des passes, passes au sol moins faciles à couper, receveur visé favorisé ;
  ≈ 1 150 passes à 82 % (au lieu de 1 260 à 72 %), ≈ 9,3 corners (au lieu de 6) ; les ballons relâchés par le
  gardien repartaient dans son but (14-19 % de buts contre son camp) : 3 % désormais. Buts, tirs et xG inchangés.
- **Mode Court** : la recalibration allongeait les temps forts (340 s) ; budget resserré, ≈ 300 s pause comprise.
- **Logos des clubs amateurs** : Transfermarkt oppose une vérification anti-robot aux recherches depuis
  l'environnement de développement ; le script s'arrête sans la contourner. Procédure depuis un ordinateur
  personnel décrite dans le README.

## 6. Suivi (12 novembre 2026, second passage)

- **Choix en match** : pourcentage de réussite simulé pour chaque choix (24 simulations de la suite de l'action
  sur une copie du match) ; annoncé ≈ réel sur près de 600 choix. Verdict ✓ / ✗ après le choix, bilan des décisions.
- **Caméra** : sur téléphone, le panneau des choix ne cache plus l'action (zone visible prise en compte).
- **Carrière** : les matchs font progresser (temps de jeu, adversaire, note, décisions) ; titularisation selon la
  forme, la fraîcheur et un éventuel renfort ; 8 à 12 événements par saison, dont des événements liés au contexte.
- **Moteur** : avantage du terrain (aucun auparavant : 27 victoires à l'extérieur contre 17 à domicile sur 60 matchs),
  moins de frappes lointaines (24,5 tirs, 9,6 cadrés au lieu de 29 et 12), gardiens un peu moins infaillibles.

## 7. Audit complet (12 novembre 2026, soir)

Outils : `npm run calibrate` (120 matchs), `node tools/audit-career.mjs 4 <club> <profil> [niveau] [potentiel]`
(matchs du joueur par le moteur), carrière longue jusqu'à la retraite, tour des écrans sur téléphone en paysage
(Pixel 7), recettes `ui-check`, `ui-check-career`, `ui-check-tf`, `ui-check-3d`, 65 tests unitaires.

### Moteur (120 matchs)

| Par match | Mesure | Référence |
|---|---|---|
| Buts | 2,61 | 2,7-2,9 |
| Tirs / cadrés | 24,7 / 9,9 | 24-26 / 8-9 |
| Passes / réussite | 1 163 / 83 % | 950-1 100 / 82-85 % |
| Passes en profondeur | ≈ 23, dont ≈ 40 % arrivent | — |
| Fautes / jaunes / rouges | 24,3 / 3,9 / **0,06** | 22-24 / 4 / 0,12-0,18 |
| Corners | **7,6** | 9-10 |
| Hors-jeu | **1,6** | 3-4 |
| Domicile / nul / extérieur | 49 % / 27 % / 24 % | 44 % / 26 % / 30 % |

Pourcentages des choix (605 choix réels) : annoncé ≈ réel à ±5-7 points par tranche.

### Carrière (4 saisons, milieu central)

| Club · profil · roues | Niveau | Potentiel | Matchs par saison |
|---|---|---|---|
| Nantes · sérieux | 43 → 66 | 63 → 75 | 5, 24, 27, 32 |
| Nantes · dilettante | 43 → 54 | 63 → 54 | 4, 14, 15, 1 |
| Nantes · forcené (7 blessures) | 43 → 53 | 63 → 54 | 2, 18, 13, 7 |
| Nantes · sérieux · Précoce + Phénomène | 57 → 86 | 90 → 95 | 26, 20, 26, 21 |
| Nantes · sérieux · En retard + Modeste | 44 → 59 | 56 → 64 | 5, 15, 27, 27 |
| PSG · sérieux | 50 → 77 | 73 → 87 | 23, 26, 28, 43 |

Les profils et les roues pèsent nettement ; 7 à 9 événements par saison ; sauvegarde 33-50 Ko (90 Ko en 18 saisons).

### Corrigé pendant l'audit

1. **Déclin après 30 ans démultiplié** : il était appliqué à chaque calcul de progression ; depuis que les matchs
   font progresser, il tombait à chaque match. Un joueur passait de 92 à 10 entre 29 et 36 ans. Le vieillissement
   est désormais hebdomadaire et surtout physique (vitesse, accélération, endurance, jeu aérien) : 92 → 90 entre
   29 et 32 ans, accélération ensuite.
2. **Plus aucune offre pour une star** : les clubs candidats devaient avoir un niveau proche du joueur ; au-delà
   du niveau de la Ligue 1, personne. Les plus grands clubs français se positionnent désormais.
3. **Pas de vraie retraite** : proposée à 35 ans seulement, jamais imposée (un joueur jouait encore à 37 ans avec
   un niveau de 10). Proposée dès 33 ans (30 si le niveau ne suit plus), imposée à 39.
4. **Téléphone** : sur la création, le choix du club et le bilan du mois, le bouton principal reste accessible
   (collé en bas) au lieu d'être sous le pli. Aucun débordement horizontal ni erreur sur les 12 écrans visités.

### À traiter (par priorité)

1. **Plafond du monde du jeu** : une fois au PSG, aucune offre pendant six saisons (aucun club au-dessus).
   C'est la limite structurelle principale : voir la recommandation sur les championnats étrangers.
2. **L'argent perd son sens en fin de carrière** : 20 à 40 M€ d'économies, achat le plus cher 250 k€.
3. **Une star domine peu en match** : à 86 de niveau en Ligue 2, note moyenne 7,2 et 3 buts en 21 matchs
   (milieu central) ; l'écart de niveau se voit trop peu dans le moteur.
4. **Moteur** : corners (7,6), hors-jeu (1,6) et cartons rouges (0,06) en dessous des références.
5. **Profils négligents** presque jamais titulaires (1 match en équipe première) : cohérent, mais sans voie de
   rattrapage.
6. **Vue 3D** : fluidité non mesurée sur un vrai téléphone (≈ 6 images/s ici en rendu logiciel, sans carte graphique).
7. **Code** : quatre fichiers au-delà de 950 lignes (`career.js`, `match.js`, `app.js`, `career-ui.js`) ; à découper
   avant d'ajouter beaucoup de contenu.

### Suivi de la liste (12 novembre 2026, nuit)

- Point 1 (plafond) : sept pays étrangers au catalogue (216 clubs, 5 271 joueurs adultes, 152 vrais logos) ;
  une star du PSG reçoit des offres d'Arsenal, Liverpool, Manchester City, Barcelone.
- Point 2 (argent) : staff privé, maison de récupération, immeubles de rapport, pari sur une start-up, fondation,
  académie, entrée au capital du club formateur ; héritage et reconversion sur l'écran de fin de carrière.
- Point 5 (rattrapage) : défi du coach après trois matchs sans être retenu.

### Championnats étrangers (2 plus hauts niveaux, vrais effectifs) : recommandé, par étapes

- **Pourquoi** : c'est la réponse directe au point 1 (destinations pour une star, transferts et prêts à l'étranger,
  coupes d'Europe contre de vrais clubs au lieu des 30 clubs fictifs actuels).
- **Périmètre conseillé** : Angleterre, Espagne, Italie, Allemagne (deux divisions chacune : 162 clubs) et la
  première division du Portugal, des Pays-Bas et de la Belgique (tremplins classiques des jeunes Français :
  52 clubs). Environ 214 clubs et 5 300 joueurs, trois fois le catalogue actuel (218 clubs, 1 912 joueurs réels).
  Pas « plein » de championnats au départ : chaque pays ajouté se paie en données à tenir à jour.
- **Règles respectées** : la carrière commence toujours dans un centre français, donc aucun mineur étranger
  réel ; à l'étranger, seuls les effectifs professionnels (adultes) sont réels ; notes estimées par le jeu.
- **Logos** : vrais logos disponibles pour les premières divisions (dépôt public, 25 pays) ; écussons générés aux
  couleurs du club pour les deuxièmes divisions.
- **Données** : Wikipédia limite fortement les requêtes depuis l'environnement de développement (429) et
  Transfermarkt bloque les robots. Deux voies : une GitHub Action qui récupère les effectifs poliment (comme pour
  les logos), ou un CSV fourni au même format que `data/joueurs-v1.csv`.

