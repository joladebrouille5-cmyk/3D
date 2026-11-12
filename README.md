# Generation Football — prototype V1

Premier livrable jouable du concept *Generation Football* (voir [`docs/concept-enrichi.md`](docs/concept-enrichi.md)) : **un moteur de match spatial à agents et événements, observable en vue tactique 2D**, avec les décisions du manager, la pause, le replay en lecture seule et la simulation rapide par le même moteur.

Le concept recommande de prouver le cœur avant d'empiler le contenu (« Prototype moteur : quelques équipes de test aux profils synthétiques »). Ce dépôt suit donc cet ordre. Les 401 inscriptions d'équipes et les effectifs réels collectés restent dans `docs/` et `data/`, **bloqués à l'import** (`import_autorise=false`).

## Lancer

```bash
npm run serve            # serveur statique sur http://localhost:8000 (python3 -m http.server)
# puis ouvrir http://localhost:8000/index.html
```

Il n'y a aucune dépendance à installer. Le moteur est en JavaScript (modules ES) et tourne aussi bien dans le navigateur que dans Node ≥ 20.

```bash
npm test                 # tests du moteur et de la carrière (node --test)
npm run calibrate        # mesure de calibration sur 40 matchs simulés sans rendu
node tools/ui-check.cjs http://localhost:8000/index.html   # recette d'interface (Playwright)
```

## Mode carrière

L'accueil propose **Débuter la partie**, **Charger la partie** (3 emplacements, sauvegarde automatique chaque semaine) et **Match amical**.

1. **Nouveau joueur** : prénom, nom, poste, pied fort. Il a 15 ans.
2. **Choix du club** parmi les 218 clubs masculins du catalogue (`data/joueurs-v1.csv`). Tu peux chercher un club et filtrer par division. La carrière commence dans le **centre de formation** du club choisi.
3. **Niveau et potentiel** :
   - Le **niveau actuel** dépend du centre choisi. Un grand centre donne un meilleur niveau de départ, mais la concurrence y est plus rude.
   - Le **potentiel** se tire à la **roue du potentiel**, juste après le choix du club (un seul tour, pas de relance).
     Chaque part a la taille de sa probabilité : Espoir modeste 16 %, Bon espoir 26 %, Bel espoir 27 %, Grand espoir 19 %,
     Pépite 9 %, Phénomène 3 %. La roue donne le palier ; la valeur exacte, tirée dans ce palier, reste cachée.
     Le staff n'en donne qu'une fourchette, qui se resserre avec le temps (`src/career/potential.js`).
   - Ce potentiel **évolue selon tes choix** : études, analyse vidéo, séances supplémentaires, surmenage, sorties, temps de jeu, blessures et événements de vie.
4. **Chaque semaine**, tu choisis un thème d'entraînement, une intensité et une activité hors du terrain. Des événements de vie à choix peuvent survenir. Le coach annonce ensuite si tu es titulaire, remplaçant, non retenu ou blessé.
5. **Les matchs** :
   - Si tu es dans le groupe, tu peux **jouer le match en vue 2D** (ton joueur est entouré d'un double anneau doré) ou le **simuler** avec le même moteur.
   - Ta note et tes minutes font évoluer la confiance du coach, ton moral et ta progression.
6. **Fin de saison** : un bilan, puis des offres. Selon ton niveau, tu restes en formation (U17, puis U19), tu signes ton premier contrat pro ou un contrat stagiaire en réserve, ou tu es libéré et dois rebondir dans un autre centre ou un autre club. La carrière continue jusqu'à la retraite.

### Tes choix pendant le match

Plus de boutons de pilotage : aux moments clés, le match se fige et tu **choisis** ce que fait ton joueur. Tu ne subis aucun malus de temps pendant la réflexion. Ces options sont celles que l'IA envisagerait elle-même dans la même situation.

| Situation | Choix proposés |
|---|---|
| Tu reçois le ballon | Frapper (≈ % de chances), passe en profondeur, passe vers l'avant, passe sûre, centre, percée balle au pied, temporiser |
| Un adversaire porteur arrive sur toi | Tacler (s'il est à portée), presser, couper la ligne de passe, garder ta position |
| Un partenaire a le ballon | Appel en profondeur, demander le ballon, rester en soutien |

- **Ce qu'affiche chaque choix** : un niveau de risque estimé, et des flèches numérotées sur le terrain. La réussite reste résolue par le moteur, selon ta technique, la pression et la fatigue.
- **Comment choisir** : toucher l'option, ou les touches 1 à 4. « Laisser l'instinct décider » (touche 0) confie l'action à l'IA.
- **Entre deux choix**, l'IA joue pour toi. Le bouton 🎯 / 🤖 désactive les choix pour tout le match.
- **Fréquence** : en match court, les choix n'arrivent que pendant les temps forts, soit une vingtaine par match.
- **Hors de ce lot** : le gardien et les coups de pied arrêtés restent gérés par l'IA.

### Programme de la semaine et bilan mensuel

- **Aperçu avant de valider** : chaque choix (thème, intensité, hors terrain) met à jour les « effets attendus » : niveau, attributs travaillés, fraîcheur, moral, confiance, potentiel et risque de blessure.
- **Compte rendu de la semaine** : les variations réelles s'affichent en pastilles, effet du match compris.
- **Bilan du mois** (pop-up toutes les 4 semaines, consultable ensuite) :
  - niveau et potentiel estimé, matchs joués, classement ;
  - d'où vient ta progression (entraînement, hors terrain, matchs) ;
  - le détail **mesuré** de chaque choix d'entraînement et de chaque activité hors terrain ;
  - l'évolution de chaque attribut avec la part de chaque source ;
  - les remarques du staff, fondées sur ces faits.
- Les chiffres ne sont pas estimés après coup : chaque effet est enregistré au moment où il se produit, et la somme des sources explique exactement chaque variation (`tests/career.test.js`).

### Données réelles utilisées

`tools/build-catalog.mjs` génère `src/data/catalog.js` à partir du CSV (`npm run catalog`).

- **Clubs, compétitions et groupes** : repris du catalogue. Les réserves (« Club 2 ») sont rattachées à leur club, et les noms entre équipes jeunes et seniors sont rapprochés prudemment.
  - Si le club a une équipe en U17 ou U19 nationaux, ce championnat est son **groupe réel**.
  - Sinon, le jeu compose un **groupe régional simulé**, signalé comme tel à l'écran.
- **Effectifs professionnels** : les **noms publiés par les clubs** sont repris (statut `liste_publiee` uniquement, quarantaine exclue). Les **notes sont des estimations du jeu** dérivées du niveau de la division, pas des valeurs réelles.
- **Jeunes** : les effectifs U17 et U19 réels (des mineurs) ne sont **pas** importés. Les coéquipiers et adversaires du centre de formation sont fictifs, conformément au concept.
- **Classement** : les matchs de ton équipe passent par le moteur, les autres rencontres par un modèle agrégé. Le volume de buts de ce modèle est aligné sur celui du moteur (≈ 6 buts par match, calibration en cours) pour que le classement reste cohérent.
- **Hors de ce lot** : la carrière féminine (le catalogue ne contient pas de championnat féminin de jeunes).

## APK Android

Chaque push déclenche la GitHub Action `APK Android` (`.github/workflows/apk.yml`). Elle lance les tests, construit l'APK et le publie en **pré-version** `apk-<n° de build>`, téléchargeable directement depuis un téléphone, ainsi qu'en artefact du run.

En local :

```bash
npm run apk              # nécessite le SDK Android (ANDROID_HOME, ou ~/android-sdk) et Java 17+
# -> dist/generation-football-<version>.apk
```

- L'APK est une coque WebView (`android/`) qui embarque `index.html`, `styles.css` et `src/`, copiés à chaque build. Il n'y a qu'une seule source pour le web et le mobile.
- Il fonctionne hors ligne, en paysage et en plein écran. La touche Retour agit comme Échap, et l'application se met en pause quand elle passe en arrière-plan.
- Sur téléphone, le terrain occupe l'écran. Les boutons « Effectif » et « Tactique » ouvrent les panneaux en tiroirs.
- Le versionCode est le nombre de commits, et le versionName vaut `0.1.<n>-<sha>`.
- L'APK est signé avec une **clé de prototype versionnée** (`android/keystore/prototype.jks`), si bien que chaque nouvel APK s'installe par-dessus le précédent. Ce n'est pas une clé de publication : pour un store, il faudra une clé privée gardée hors du dépôt.

## Ce qui est jouable

- **Configuration d'un match** : deux équipes parmi quatre profils synthétiques (styles distincts), rôle *manager A*, *manager B* ou *observateur*, graine de reproductibilité, délégation des remplacements au staff.
- **Vue 2D** : terrain vu du dessus, équipe A en cercles et équipe B en carrés (lisible en niveaux de gris), flèches du sens d'attaque réel (inversées à la mi-temps), ombre et hauteur du ballon, porteur et sélection signalés.
- **Consignes** : trois intentions en mode essentiel (pressing, hauteur du bloc, style de possession). Une consigne passe par les états `brouillon → validée → transmise → active`, avec les issues `rejetée`, `annulée`, `remplacée` et `expirée`. Les agents s'adaptent progressivement, sans téléportation. La file est limitée à trois changements en attente.
- **Remplacements** : préparation par clic ou glisser-déposer, puis `préparé → demandé → effectué` au prochain arrêt de jeu. L'entrant arrive par la ligne de touche. Les refus sont motivés : joueur inéligible, limite atteinte ou fenêtres épuisées. Les limites viennent de la configuration de compétition, pas d'une règle codée en dur.
- **Pause, vitesses (1×, 2×, 4×, 8×) et replay** : le replay est en lecture seule, avec un bandeau permanent. Le retour au direct (F9) retrouve exactement l'état laissé en pause. Les arrêts de jeu sont accélérés en présentation seulement.
- **Résultat rapide** : même moteur, sans rendu ni interruption, après une délégation explicite au staff.
- **Analyse et staff** : statistiques, carte des tirs avec xG pré-tir, et messages du staff fondés sur des faits observables. L'état physique des adversaires n'est jamais révélé.
- **Gestion des entrées** : la priorité va à la fenêtre modale, puis au champ de saisie, puis au rôle, puis aux raccourcis généraux. Aucune touche ne peut à la fois valider une fenêtre et agir sur le match. Les commandes sont détaillées dans l'aide (F1).

## Architecture

```
src/engine/            moteur (aucune dépendance au DOM)
  rng.js               PRNG déterministe sfc32 avec curseur enregistrable
  config.js            dimensions du terrain, pas de simulation, configuration de compétition
  teams.js             formations et 4 équipes synthétiques (noms et attributs inventés)
  match.js             état canonique, boucle, ballon, contacts, duels, tirs, règles, commandes
  decisions.js         utilité contextuelle du porteur + sélection probabiliste (softmax)
  movement.js          organisation collective, pressing, marquage, appels, courses au ballon
  manager.js           staff / manager IA (passe par les mêmes commandes que l'utilisateur)
  sim.js               simulation sans rendu
src/ui/                interface 2D (render.js : rendu canvas ; app.js : panneaux, entrées, replay)
tests/                 tests du moteur
tools/                 calibration et recette d'interface
docs/, data/           documents de conception et collecte d'effectifs réels (non importés)
```

Principes repris de la spécification :

- **Le résultat émerge des actions.** Une passe est une trajectoire que l'adversaire doit physiquement atteindre. Un tir est résolu par sa trajectoire réelle, les contres et la portée du gardien, qui dépend du temps de réaction. Aucun score n'est choisi à l'avance.
- **Décider n'est pas exécuter.** Le porteur compare un ensemble borné d'actions (passe, passe dans la course, centre, conduite, tir, conservation, dégagement) par rapport à la valeur de garder le ballon. L'exécution ajoute ensuite une erreur qui dépend de la technique, de la pression et de la fatigue.
- **Pas de 0,1 s** pour le mouvement et **pas tactique de 0,5 s**. Les duels et le pressing sont évalués à chaque pas.
- **Hasard borné et enregistré** : un seul flux de tirages. Même graine et mêmes commandes horodatées donnent les mêmes événements, avec ou sans rendu, ce qui est testé.
- **Règles** : hors-jeu au départ du ballon (drapeau avec erreur bornée), fautes, cartons, penalties, corners, touches, six-mètres, temps additionnel issu des interruptions, poste laissé vacant après une expulsion.
- **Le rendu ne touche jamais l'état.** L'interpolation n'est pas réinjectée dans le moteur.

## État de la calibration

Mesures sur 40 matchs entre équipes synthétiques (`npm run calibrate`), comparées aux ordres de grandeur du football professionnel :

| Indicateur par match | Moteur actuel | Ordre de grandeur réel |
|---|---:|---:|
| Buts | ~2,6 | ~2,7-2,9 |
| Tirs | ~24,5 | ~25 |
| Tirs cadrés | ~9,6 | ~9 |
| Arrêts du gardien | ~65 % des tirs cadrés | ~70 % |
| Domicile / nul / extérieur | ~45 % / 30 % / 25 % (120 matchs) | ~44 % / 26 % / 30 % |
| xG pré-tir total | ~2,5 (≈ buts) | ~2,7 |
| Passes (deux équipes, hors dégagements) | ~1 150 | ~950-1 100 |
| Réussite des passes | ~82 % | ~82-85 % |
| Corners | ~7,9 | ~9-10 |
| Fautes | ~25 | ~22-24 |
| Cartons jaunes / rouges | ~4,2 / ~0,07 | ~4 / ~0,15 |
| Buts contre son camp | ~3 % des buts | ~3-4 % |

- **Avantage du terrain** : l'équipe qui reçoit est portée par son public (passes et frappes un peu
  plus précises, duels un peu mieux gagnés, arbitre un peu plus clément) ; rien sur terrain neutre.
- **Corrections principales** :
  - passes en profondeur réservées aux vrais appels ;
  - frappes contrées dans la trajectoire ;
  - parades et dégagements qui sortent en corner ;
  - couverture défensive dans les duels ;
  - deux défauts de parade qui renvoyaient le ballon dans le but ;
  - ballons relâchés par le gardien qui repartaient dans son but (14 % de buts contre son camp, 3 % désormais) ;
  - dégagements exclus du décompte des passes ; passes appuyées au sol plus difficiles à couper ;
  - déviations de la tête des défenseurs sur centre qui sortent en corner (trajectoire toujours hors du cadre).
- **xG** : l'indicateur affiché est calibré sur la résolution réelle des tirs ; le joueur décide sur sa propre perception de l'occasion.
- **Ligne haute** : une ligne défensive haute laisse de l'espace dans son dos, que les attaquants exploitent par leurs appels.
- **Écarts restants** :
  - un peu trop de tirs cadrés et pas assez de corners ;
  - environ 1 250 passes par match, encore au-dessus de la réalité ;
  - une tactique très agressive face à une équipe plus faible domine encore nettement.

### Durée d'un match

Le mode **Match court** est le mode par défaut. Le moteur simule toujours les 90 minutes, mais le rythme s'adapte pour que la rencontre regardée ou jouée dure **environ 4 min 30** :
- le jeu accélère loin de l'action, jusqu'à ×80 environ ;
- il revient à 1× pendant les temps forts : ballon près de ton joueur en pilotage manuel, ou action de but en observation ;
- un budget de temps forts est réparti sur tout le match.

Le mode **Temps réel** (vitesses 1× à 8×) reste disponible dans le menu du match et sur l'écran du match amical. La recette `npm run ui-check-pace` vérifie la durée.

### Choix en match

Aux moments clés, le match se fige et tu choisis. Les options viennent du moteur et dépendent de la situation :
- **avec le ballon** : frappe placée, en force ou piquée (gardien sorti), passe en profondeur, une-deux, renversement,
  centre en retrait, jeu long, centres au premier ou au second poteau, repiquer dans l'axe, déborder, se dégager ;
- **en défense** : tacle debout ou glissé, faute tactique (contre-attaque), presser, l'orienter vers l'extérieur,
  marquer ou suivre l'appel d'un attaquant, fermer l'angle de frappe, couper une ligne de passe ;
- **sans le ballon** : selon la zone du porteur (relance, milieu, trente derniers mètres, centre) : appel en profondeur
  ou croisé, dédoubler, décrocher, se démarquer, attaquer le premier poteau, filer au second, rester pour le second ballon ;
- **coups de pied arrêtés** : si ton joueur en a le profil, il tire les penalties (côté, en force, Panenka ; le gardien
  choisit un côté), les corners et les coups francs.

Les gestes proposés juste avant passent après les nouveautés ; en mode Temps forts, au plus trois choix sans ballon de
chaque sorte par match. `tests/choices.test.js` vérifie la variété sur un match complet.

### Portraits

533 portraits générés (personnes fictives, planches dans `art/faces-src/`, découpées par `python3 tools/split-faces.py`),
classés par âge apparent (`src/data/face-ages.js`). Tu choisis ton visage à la création ; les coéquipiers et adversaires
fictifs reçoivent un visage stable (jeune en U17/U19). Les joueurs réels n'ont jamais de visage inventé : leurs initiales
s'affichent aux couleurs du club.

### Logos et habillage

Jeu à usage personnel : les **vrais logos** des clubs sont utilisés quand ils ont pu être récupérés, par ordre de priorité :
1. `assets/crests-tm/` — logos Transfermarkt (identifiants dans `tools/tm-ids.json`, trouvés par `node tools/tm-ids.mjs` ;
   images téléchargées par le workflow `.github/workflows/tm-crests.yml`, le serveur d'images n'étant pas joignable depuis
   l'environnement de développement) ;
2. `assets/crests-l1/` — clubs passés par la Ligue 1 ;
3. `assets/crests/` — Wikimedia Commons (`tools/fetch-crests.mjs`, workflow manuel).

Couverture : Ligue 1 18/18, Ligue 2 16/18, National 14/18 (59 clubs sur 218).

**Compléter les logos des clubs amateurs.** Transfermarkt bloque les recherches automatiques depuis l'environnement de
développement (vérification anti-robot ; le script s'arrête aussitôt et ne la contourne pas). Depuis ton propre ordinateur :
`node tools/tm-ids.mjs` (une recherche toutes les 6 secondes, reprend là où il s'est arrêté), puis pousse
`tools/tm-ids.json` : le workflow « Logos Transfermarkt » télécharge les images et les commite tout seul. Les autres reçoivent un **écusson généré**
aux couleurs réelles du club (`src/data/club-colors.js`), couleurs aussi utilisées pour les maillots.

Direction artistique « nuit de match » : terrain sous quatre projecteurs (ombres croisées, tribunes, panneaux LED, filets),
accueil avec un vrai match IA en perspective, vignette d'album du joueur, bande de résultats de la saison, icônes dessinées
(`src/ui/icons.js`). Polices embarquées (licence OFL, `assets/fonts/`) : Big Shoulders Display et Archivo.

## Hors de ce lot

- Pilotage direct : gardien, coups de pied arrêtés, gestes chargés et remappage des touches.
- Éditeur tactique par glisser-déposer des positions cibles, coups de pied arrêtés préparés.
- Carrière, saison, monde : le moteur de match est le socle, pas encore le jeu complet.
- Import des clubs et joueurs réels : bloqué tant que les identités, les droits et les questions liées aux mineurs ne sont pas validés (voir `docs/effectifs-v1.md`).

## Données

- `docs/concept-enrichi.md` : document de conception complet.
- `docs/effectifs-v1.md` : annexe des effectifs publics sourcés (saison 2026-2027, collecte du 11 novembre 2026).
- `data/joueurs-v1.csv` : occurrences équipe–nom avec provenance et statut. Tous les enregistrements ont `import_autorise=false`, et le prototype ne les lit pas.

## Pourcentages de réussite des choix

Chaque choix proposé en match affiche sa chance de réussite. Elle n'est pas estimée à côté du moteur :
la suite de l'action est **rejouée 24 fois** dans une copie du match (`Match.fork`, `src/engine/predict.js`),
avec un autre aléa à chaque fois, et on compte les réussites. Le pourcentage dépend donc de tout ce que
simule le moteur : tes attributs et ta fraîcheur, ceux du partenaire visé, le placement et la qualité des
adversaires (interception, tacle, gardien), la pression et la distance.

- Ce qui compte comme une réussite dépend du choix : passe réussie, ballon gardé, but, ballon récupéré,
  action adverse stoppée, ballon reçu…
- Après ton choix, le même arbitre juge l'issue réelle : ✓ ou ✗ s'affiche avec le pourcentage annoncé ;
  le bilan du match liste tes décisions (réussites attendues / obtenues).
- Calibration mesurée sur 581 choix : annoncé 51 % → réel 52 %, annoncé 88 % → réel 92 %, annoncé 30 % → réel 37 %.

