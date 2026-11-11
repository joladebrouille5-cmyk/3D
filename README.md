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
npm test                 # 13 tests du moteur (node --test)
npm run calibrate        # mesure de calibration sur 40 matchs simulés sans rendu
node tools/ui-check.cjs http://localhost:8000/index.html   # recette d'interface (Playwright)
```

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

## État de la calibration (à lire avant de juger le football produit)

Mesures sur 40 matchs entre équipes synthétiques (`npm run calibrate`), comparées aux ordres de grandeur du football professionnel :

| Indicateur par match | Moteur actuel | Ordre de grandeur réel |
|---|---:|---:|
| Buts | ~7 | ~2,7 |
| Tirs | ~44 | ~25 |
| xG pré-tir total | ~8,4 | ~2,6 |
| Réussite des passes | ~65 % | ~80 % |
| Fautes | ~30 | ~22 |
| Cartons jaunes | ~3,3 | ~4 |
| Corners | ~3 | ~10 |

Ce qui est cohérent :

- les buts suivent les xG estimés, donc l'estimateur de danger et la résolution sont reliés ;
- la résolution isolée des tirs est plausible : sans pression, environ 35 % de buts à 11 m, 10 % à 18 m et 6 % à 25 m ;
- les styles produisent des matchs différents.

Ce qui reste à calibrer :

- trop d'occasions de qualité sont créées ;
- le style « pressing haut + bloc haut + direct » (FC Littoral Nord) domine trop nettement ;
- les petits écarts de niveau ont un effet excessif ;
- les passes sont trop souvent perdues ;
- il y a trop peu de corners.

Ces écarts sont assumés pour un prototype. Le concept demande de mesurer avant d'affirmer quoi que ce soit, et aucun coefficient n'est présenté comme réaliste.

## Hors de ce lot

- Pilotage direct d'un joueur (lot P1) : commandes ZQSD/WASD, gestes chargés, profils d'assistance, manette.
- Éditeur tactique par glisser-déposer des positions cibles, coups de pied arrêtés préparés.
- Carrière, saison, monde : le moteur de match est le socle, pas encore le jeu complet.
- Import des clubs et joueurs réels : bloqué tant que les identités, les droits et les questions liées aux mineurs ne sont pas validés (voir `docs/effectifs-v1.md`).

## Données

- `docs/concept-enrichi.md` : document de conception complet.
- `docs/effectifs-v1.md` : annexe des effectifs publics sourcés (saison 2026-2027, collecte du 11 novembre 2026).
- `data/joueurs-v1.csv` : occurrences équipe–nom avec provenance et statut. Tous les enregistrements ont `import_autorise=false`, et le prototype ne les lit pas.
