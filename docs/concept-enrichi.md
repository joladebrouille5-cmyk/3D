# Generation Football

## Le football comme une vie, pas comme une succession de menus

Version de conception enrichie du 11 novembre 2026, complétée par le catalogue réel de la V1, une annexe d'effectifs publics sourcés, la spécification du moteur et les commandes du match 2D. Issue du document « Concept de jeu idéal football », elle conserve son ambition : commencer à 14 ou 15 ans, jouer ou simuler les matchs, parcourir une pyramide mondiale, puis poursuivre sa vie de football comme entraîneur, manager ou sélectionneur.

L'ajout central est un monde connecté : les championnats ne sont pas des listes indépendantes et les systèmes d'immersion ne sont pas des mini-jeux isolés. La formation, le niveau scolaire, les blessures, le rôle tactique, les finances du club, les recruteurs et les relations doivent produire ensemble une carrière personnelle, crédible et mémorable.

**Promesse : « Tu n'es pas le centre du monde. Tu essaies d'y trouver ta place, puis d'y laisser une trace. »**

### Repères de lecture

- **La carte :** [France](#france--la-pyramide-de-référence), [grandes pyramides nommées](#les-grandes-pyramides-nommées-à-intégrer) et [couverture des associations](#carte-exhaustive-des-associations--personne-ne-disparaît-du-monde).
- **L'expérience :** [immersion](#immersion--une-simulation-qui-produit-des-histoires), [vie du joueur](#la-vie-dun-joueur--de-14-ans-à-la-reconversion), [match](#le-match--faire-sentir-les-causes) et [envie de continuer](#donner-envie-de-continuer--captivant-plutôt-que-compulsif).
- **La réalisation :** [architecture](#architecture-de-simulation-et-garde-fous), [exigences](#exigences-prioritaires-et-critères-dacceptation) et [feuille de route](#feuille-de-route-pilotée-par-des-preuves).
- **Les nouveaux ajouts V1 :** [vrais clubs et divisions](#v1--les-vrais-clubs-et-leurs-divisions), [moteur de simulation](#v1--comment-simuler-un-match) et [choix à faire](#v1--les-décisions-qui-changent-vraiment-un-match).
- **Effectifs et prise en main :** [données des joueurs](#v1--joueurs-réels-et-effectifs), [écran 2D](#v1--interface-du-match-en-vue-2d), [commandes](#v1--commandes-du-match-2d) et [validation](#v1--critères-dacceptation-de-lexpérience-2d).

### Statut de ce document

- **Faits vérifiés :** les références externes accompagnent les structures de compétitions et les contraintes réglementaires utilisées.
- **Propositions de conception :** les profondeurs de simulation, priorités, mécaniques, parcours et critères de qualité sont des choix proposés pour le jeu. Ce ne sont pas des fonctionnalités déjà développées.
- **Couverture mondiale :** la carte couvre les 211 associations membres de la FIFA, pas 211 championnats professionnels supposés identiques ; la FIFA décrit bien un ensemble de pays et territoires, et non uniquement des États ([FIFA, associations membres](https://inside.fifa.com/associations)).
- **Limite de vérification :** les noms et niveaux de plusieurs pyramides prioritaires ont été contrôlés ; ce document n'est pas une base exhaustive des règlements, clubs et calendriers de chaque compétition mondiale. Les éléments non audités restent explicitement des cibles.
- **Licences :** noms, écussons, visages, équipements, stades, chants et habillages sont des objectifs de droits distincts. Aucun accord de licence n'est présumé acquis et aucun avantage exclusif sur un concurrent n'est affirmé.

## Problème à résoudre

Le besoin exprimé est de réunir la sensation de jouer au football, la profondeur d'une simulation de gestion et l'attachement à une carrière vécue depuis l'adolescence. Le risque est de construire trois jeux séparés, reliés par des menus, plutôt qu'une seule simulation cohérente.

Le deuxième problème est l'échelle : promettre toutes les divisions du monde avec la même précision rendrait le projet impossible à maîtriser. La réponse proposée est une profondeur variable, mais des règles et une histoire persistantes à tous les niveaux.

## Objectifs et limites

### Objectifs de conception

- **Carrière personnelle :** permettre plusieurs trajectoires intéressantes, dont une carrière amateure, une percée tardive, une carrière de rotation et une reconversion.
- **Monde cohérent :** conserver le même état sportif lorsqu'on passe du match complet aux temps forts ou à la simulation.
- **Profondeur choisie :** laisser déléguer chaque domaine sans rendre la délégation volontairement punitive.
- **Compréhension :** expliquer les décisions importantes par des faits observables, sans exposer toutes les variables cachées.
- **Attachement durable :** donner envie de retrouver des personnes, un club et des objectifs, sans bonus de connexion ni pression quotidienne.

### Ce que le jeu ne doit pas devenir

- **Un GTA du football :** pas de ville ouverte immense ni de déplacements obligatoires sans intérêt sportif.
- **Un simulateur de formulaires :** pas de tâches administratives répétées quand le staff peut les traiter.
- **Une histoire de prodige imposée :** aucune garantie de devenir international ou de gagner un trophée majeur.
- **Une machine à frustration :** pas d'adversaires secrètement renforcés, de blessures punitives scénarisées ou de remontées forcées.
- **Une promesse mondiale au lancement :** le catalogue cible et le contenu effectivement livrable sont séparés.

## Le socle conservé du concept initial

- **Carrière joueur :** départ à 14 ou 15 ans, club de jeunes, détection, formation, premiers contrats, réserve, prêts et équipe première.
- **Carrière manager :** tactiques avec et sans ballon, formation, recrutement, staff, finances, objectifs du conseil et marché des entraîneurs.
- **Formats de match :** match complet, contrôle d'un seul joueur, temps forts offensifs ou complets, simulation interactive et résultat rapide.
- **Passerelle de carrière :** joueur, capitaine, mentor, entraîneur de jeunes, adjoint, entraîneur principal, manager et sélectionneur dans une sauvegarde persistante.
- **Monde commun :** clubs masculins et féminins, compétitions de jeunes et sélections partagent un calendrier et une histoire, mais pas artificiellement les mêmes règles ni les mêmes marchés.
- **Présentation :** sensation de retransmission à haut niveau, ambiance locale et moyens plus modestes dans le football amateur.

La référence aux jeux existants sert à exprimer une intention de design. Elle ne dispense pas de concevoir un moteur propre et de vérifier séparément les fonctionnalités et licences de chaque produit cité dans le document initial.

## Carte mondiale : quatre profondeurs, un seul monde

### Les profondeurs de simulation

| Code | Profondeur proposée | Ce qui existe réellement dans la sauvegarde |
|---|---|---|
| A | Carrière intégrale | Club sélectionnable, matchs contrôlables, entraînement, staff, finances, jeunes, relations et règlements détaillés |
| B | Championnat actif | Calendrier, résultats, effectifs, contrats, marché, progression et décisions des clubs ; contrôle jouable activable après chargement des ressources |
| C | Championnat de contexte | Classement, résultats, mouvements importants, joueurs suivis et qualification continentale ; décisions individuelles moins fréquentes |
| D | Présence mondiale | Association, sélection, vivier, clubs identifiés si documentés et résultats agrégés ; pas de fausse promesse de championnat intégral |

Ces catégories sont des propositions techniques et éditoriales. Même les niveaux C et D ont un coût : aucun « monde simulé gratuitement » n'est promis.

- **Activation :** un pays peut passer de C à B lors d'une fenêtre de maintenance entre saisons ; le passage vers A exige les données et ressources nécessaires.
- **Continuité :** l'activation ne recrée pas les effectifs et ne réécrit pas les champions passés ; les historiques agrégés restent agrégés.
- **Transparence :** avant une signature, le jeu affiche la profondeur disponible dans la destination et les éventuelles limites.
- **Performance :** les ligues proches du joueur, de son marché et des compétitions continentales reçoivent davantage de calcul, sans garantir une exactitude identique partout.
- **Équité :** les frontières de simulation ne créent pas de joueurs gratuits, de budgets infinis ou de clubs sans obligation d'effectif.

### Les priorités de contenu

| Vague | Intention | Périmètre proposé |
|---|---|---|
| Prototype | Prouver le plaisir et la cohérence | Une région française fictive, deux niveaux seniors reliés, une compétition de jeunes |
| Socle France | Prouver une vie de football | France masculine D1 à D5, football de jeunes ; D6 à D8 selon la région de départ ; football féminin français |
| Extension européenne | Ouvrir les trajectoires | Angleterre, Espagne, Allemagne, Italie, Portugal, Belgique et Pays-Bas |
| Monde connecté | Diversifier les parcours | Autres marchés européens, Amériques, Afrique, Asie et Océanie par lots validés |
| Horizon mondial | Compléter le catalogue | Les 211 associations présentes ; profondeur jouable élargie selon droits, qualité des données et performances |

Il n'y a pas de date, de budget ou de délai de production implicite dans ces vagues. Le passage de l'une à l'autre dépend de critères de qualité, pas d'un chiffre de ligues annoncé.

## France : la pyramide de référence

### Football masculin senior

La réforme 2026-2027 officialise la Ligue 3 à la place du National et renomme les anciens National 2 et National 3 en National 1 et National 2 ; le jeu doit attacher ces appellations à une saison, plutôt que remplacer les noms dans tout l'historique ([FFF, création de la Ligue 3](https://www.fff.fr/article/16778-la-fff-officialise-la-ligue-3-professionnelle.html)).

| Niveau | Compétition à intégrer | Profondeur cible | Règle structurante |
|---|---|---|---|
| D1 | Ligue 1 ([pyramide française](https://en.wikipedia.org/wiki/French_football_league_system)) | A | Élite nationale ; moteur de droits, revenus, pression et qualification |
| D2 | Ligue 2 ([pyramide française](https://en.wikipedia.org/wiki/French_football_league_system)) | A | Transition entre football d'élite et clubs à moyens plus limités |
| D3 | Ligue 3 | A | 18 clubs, 34 journées ; deux montées directes, play-offs des 3e à 6e puis barrage contre le 16e de Ligue 2 ; trois descentes ([FFF](https://www.fff.fr/article/16778-la-fff-officialise-la-ligue-3-professionnelle.html)) |
| D4 | National 1 | A | Composition corrigée : 49 équipes, groupes A et B de 16, groupe C de 17 ; l'intégration de l'UF Touraine entraîne une neuvième relégation au total ([FFF, décision du 20 août 2026](https://www.fff.fr/article/17198-l-uf-touraine-integree-au-championnat.html)) |
| D5 | National 2 | A | Composition corrigée : 111 équipes, sept groupes de 14 et groupe H de 13 ; règles de relégation révisées après le départ de l'UF Touraine vers le N1 ([FFF](https://www.fff.fr/article/17198-l-uf-touraine-integree-au-championnat.html)) |
| D6 | Régional 1 | A dans les régions activées | Cible de profondeur ; groupes, accession et éligibilité à auditer ligue par ligue |
| D7 | Régional 2 | A ou B | Cible de profondeur régionale ; aucune structure uniforme présumée |
| D8 | Régional 3, là où ce niveau existe | A ou B | Cible pour un départ local ; règles locales à vérifier |
| Sous la pyramide régionale | Divisions de district | B, puis A à terme | Intitulés, nombre d'échelons et raccordement au régional à charger district par district |

Les désignations Ligue 1 et Ligue 2 au sommet de la pyramide sont également décrites par la présentation de la structure française ; les détails de groupes de divisions inférieures de cette page ne doivent pas supplanter les publications FFF ci-dessus ([présentation de la pyramide française](https://en.wikipedia.org/wiki/French_football_league_system)).

### Ce qui rend la France vraiment profonde

- **Coupes :** coupe nationale, tours régionaux et coupes locales à intégrer avec leurs participants et conditions d'accès vérifiés ; aucun tirage fictif de confort.
- **Réserves :** même identité de club, effectifs articulés, règles de mouvement et plafond d'accession propres à la compétition.
- **Territoires :** ligues et districts configurables ; pas d'hypothèse selon laquelle tous possèdent le même nombre de niveaux.
- **Outre-mer :** compétitions territoriales et liens avec les compétitions nationales traités explicitement, sans les raccorder automatiquement à une pyramide métropolitaine.
- **Statuts :** distinction entre statut du club, type de contrat du joueur, disponibilité réelle et niveau de compétition.
- **Contrôle économique :** dossiers financiers, décisions et recours représentés par des règles versionnées, pas par un événement aléatoire de retrait de points.

### Football féminin français

| Niveau | Compétition | Cible de simulation |
|---|---|---|
| D1 | Arkema Première Ligue : 12 clubs, 22 journées, puis play-offs des quatre premiers selon le calendrier 2026-2027 ([FFF](https://www.fff.fr/article/16277-competitions-feminines-le-calendrier-2026-2027.html)) | A |
| D2 | Seconde Ligue : composition corrigée à 11 équipes, 22 journées de calendrier avec exemptions et 110 rencontres au total ([FFF, calendrier actualisé](https://www.fff.fr/article/17024-le-calendrier-de-la-saison-2026-2027.html)) | A |
| D3 | D3 Féminine : deux groupes de 12 ; accession des premiers éligibles, hors réserves ([FFF](https://www.fff.fr/article/17114-toutes-les-affiches-de-la-saison.html)) | A |
| Régional et local | Compétitions à cartographier par ligue | B, puis A selon la région |
| Formation | Compétitions de jeunes et parcours scolaires à auditer | A dans les filières activées |

Les moyens, contrats, attentes et environnements de formation sont paramétrés séparément. Il ne s'agit ni d'une simple apparence différente appliquée au football masculin ni d'une pénalisation uniforme des joueuses.

## Les grandes pyramides nommées à intégrer

Les niveaux ci-dessous ont été contrôlés comme repères structurels ; les noms commerciaux, effectifs, barrages et formats exacts doivent encore être verrouillés pour la saison de départ. La profondeur indiquée est une cible de conception et non une affirmation de disponibilité.

### Europe

| Association | Divisions et branches à intégrer | Cible |
|---|---|---|
| Angleterre | D1 Premier League ; D2 Championship ; D3 League One ; D4 League Two ; D5 National League ; D6 National League North et South ; D7 Northern Premier Premier, Southern Premier Central/South et Isthmian Premier ([pyramide anglaise](https://en.wikipedia.org/wiki/English_football_league_system)) | A jusqu'en D6 ; D7 en extension |
| Espagne | D1 Primera División ; D2 Segunda División ; D3 Primera Federación ; D4 Segunda Federación ; D5 Tercera Federación, avec groupes parallèles ([pyramide espagnole](https://en.wikipedia.org/wiki/Spanish_football_league_system)) | A jusqu'en D4 ; D5 en extension |
| Allemagne | D1 Bundesliga ; D2 2. Bundesliga ; D3 3. Liga ; D4 Regionalliga Nord, Nordost, West, Südwest, Bayern ; D5 branches d'Oberliga et équivalents ([pyramide allemande](https://en.wikipedia.org/wiki/German_football_league_system)) | A jusqu'en D4 ; D5 après audit |
| Italie | D1 Serie A ; D2 Serie B ; D3 Serie C ; D4 Serie D ; D5 Eccellenza, avec groupes interrégionaux ou régionaux ([pyramide italienne](https://en.wikipedia.org/wiki/Italian_football_league_system)) | A jusqu'en D4 ; D5 en extension |
| Portugal | D1 Liga Portugal ; D2 Liga Portugal 2 ; D3 Liga 3 ; D4 Campeonato de Portugal ; puis championnats de district ([pyramide portugaise](https://en.wikipedia.org/wiki/Portuguese_football_league_system)) | A jusqu'en D4 |
| Écosse | D1 Premiership ; D2 Championship ; D3 League One ; D4 League Two ([pyramide écossaise](https://en.wikipedia.org/wiki/Scottish_football_league_system)) | A jusqu'en D4 ; niveaux suivants à auditer |
| Pays-Bas | D1 Eredivisie ; D2 Eerste Divisie ; D3 Tweede Divisie ; D4 Derde Divisie ; ne pas supposer une accession libre entre tous les niveaux ([pyramide néerlandaise](https://en.wikipedia.org/wiki/Dutch_football_league_system)) | A jusqu'en D3 ; D4 en extension |
| Belgique | D1 Pro League ; D2 Challenger Pro League ; D3 branches Division 1 VV et FFA ; « Division 1 » amateur ne signifie pas premier niveau national ([pyramide belge](https://en.wikipedia.org/wiki/Belgian_football_league_system)) | A jusqu'en D3 |
| Suisse | D1 Super League ; D2 Challenge League ; D3 Promotion League ; D4 1re Ligue Classic ([pyramide suisse](https://en.wikipedia.org/wiki/Swiss_football_league_system)) | A jusqu'en D3 ; D4 en extension |
| Autriche | D1 Bundesliga ; D2 2. Liga ; D3 branches de Regionalliga ; structure inférieure à vérifier pour la saison choisie ([pyramide autrichienne](https://en.wikipedia.org/?title=Austrian_football_league_system)) | A jusqu'en D3 |
| Turquie | D1 Süper Lig ; D2 TFF 1. Lig ; D3 TFF 2. Lig ; D4 TFF 3. Lig ([pyramide turque](https://en.wikipedia.org/wiki/Turkish_football_league_system)) | A jusqu'en D3 ; D4 en extension |

### Amériques, Asie, Afrique et Océanie

| Association | Divisions et branches à intégrer | Cible |
|---|---|---|
| Brésil | Série A, B, C et D ; championnats d'État en parallèle, et non « D5 nationale » sous la Série D ([structure brésilienne](https://en.wikipedia.org/wiki/Brazilian_football_league_system)) | A jusqu'en Série C ; Série D et États par lots |
| Argentine | D1 Primera División ; D2 Primera Nacional ; D3 Primera B et Torneo Federal A ; D4 Primera C et Torneo Regional Federal Amateur ([structure argentine](https://en.wikipedia.org/wiki/Argentine_football_league_system)) | A jusqu'aux deux branches D3 ; D4 en extension |
| États-Unis | MLS ; USL Championship ; MLS Next Pro et USL League One comme branches distinctes, sans pyramide de promotion automatique inventée ([structure américaine](https://en.wikipedia.org/wiki/United_States_soccer_league_system)) | A sur les ligues validées |
| Mexique | Liga MX ; Liga de Expansión MX ; Liga Premier ; Liga TDP ; statut des montées/descentes à vérifier à chaque saison ([structure mexicaine](https://en.wikipedia.org/wiki/Mexican_football_league_system)) | A sur les deux premiers niveaux ; suivants en extension |
| Japon | J1, J2, J3 ; Japan Football League ; ligues régionales au niveau suivant, avec critères de licence pour l'accès professionnel ([structure japonaise](https://en.wikipedia.org/wiki/Japanese_football_league_system)) | A jusqu'en J3 ; JFL en extension |
| Corée du Sud | K League 1 ; K League 2 ; K3 League ; K4 League ; articulations soumises aux conditions d'accès applicables ([structure sud-coréenne](https://en.wikipedia.org/wiki/South_Korean_football_league_system)) | A sur les deux premiers niveaux ; K3/K4 en extension |
| Maroc | Botola Pro ; Botola Pro 2 ; National ; Amateurs I ([structure marocaine](https://en.wikipedia.org/wiki/Moroccan_football_league_system)) | A jusqu'au troisième niveau |
| Australie | A-League Men ; branches de National Premier Leagues et compétitions d'État ; ne pas traiter ces branches comme une accession automatique vers l'A-League ([structure australienne](https://en.wikipedia.org/wiki/Australian_soccer_league_system)) | A en A-League ; B sur branches validées |

L'USL a annoncé un système de promotion-relégation à trois niveaux ; cette annonce doit être stockée comme projet daté, et non appliquée rétroactivement ou assimilée à une ouverture de la MLS ([USL, projet de promotion-relégation](https://www.uslsoccer.com/promotion-relegation)). La source australienne consultée ne suffit pas à verrouiller toutes les évolutions nationales de 2026 : l'architecture complète reste à auditer avant intégration.

## Carte exhaustive des associations : personne ne disparaît du monde

Les listes suivantes reprennent la répartition des 211 membres FIFA entre confédérations ; elles définissent la couverture du catalogue, pas la disponibilité immédiate d'une carrière intégrale dans chaque association ([répartition et listes des associations](https://en.wikipedia.org/wiki/Geography_of_association_football)). Chaque association reçoit une profondeur cible ; un niveau national n'est créé que s'il existe et si son organisation est vérifiée.

La notation « D1-D2 cible » signifie donc : documenter puis intégrer les deux premiers niveaux réels lorsqu'ils existent. Elle ne signifie pas qu'une deuxième division nationale uniforme a déjà été vérifiée partout.

### UEFA : 55 associations

Les quatre lots ci-dessous couvrent les 55 membres UEFA figurant dans la liste consultée ([liste des associations UEFA](https://en.wikipedia.org/wiki/Geography_of_association_football)).

| Lot | Associations | Profondeur cible |
|---|---|---|
| Pyramides prioritaires | Allemagne, Angleterre, Autriche, Belgique, Écosse, Espagne, France, Italie, Pays-Bas, Portugal, Suisse, Turquie | Détail dans les cartes précédentes |
| Marchés connectés | Croatie, Danemark, Finlande, Grèce, Hongrie, Irlande, Islande, Norvège, Pologne, Roumanie, Serbie, Slovaquie, Slovénie, Suède, Tchéquie, Ukraine | A D1-D2 cible ; B niveau suivant si documenté |
| Autres pyramides européennes | Albanie, Arménie, Azerbaïdjan, Biélorussie, Bosnie-Herzégovine, Bulgarie, Chypre, Estonie, Géorgie, Israël, Kazakhstan, Kosovo, Lettonie, Lituanie, Macédoine du Nord, Moldavie, Monténégro, Russie | B D1-D2 cible ; A par extensions |
| Petites associations et parcours spécifiques | Andorre, Gibraltar, Îles Féroé, Irlande du Nord, Liechtenstein, Luxembourg, Malte, pays de Galles, Saint-Marin | B sur compétitions documentées ; A par lots ; architecture transfrontalière à auditer |

Les restrictions de participation, sanctions, terrains neutres et délocalisations doivent dépendre d'une saison et d'un règlement vérifiés. La présence d'une association dans le catalogue ne constitue pas une affirmation sur son éligibilité actuelle à une compétition.

### CONMEBOL : 10 associations

Les lots couvrent les dix membres sud-américains de la liste consultée ([associations CONMEBOL](https://en.wikipedia.org/wiki/Geography_of_association_football)).

| Lot | Associations | Profondeur cible |
|---|---|---|
| Pyramides prioritaires | Argentine, Brésil | Détail dans les cartes précédentes |
| Deuxième cercle | Chili, Colombie, Équateur, Paraguay, Pérou, Uruguay | A D1-D2 cible ; B sur l'échelon suivant documenté |
| Complément continental | Bolivie, Venezuela | B D1-D2 cible, puis A |

Les calendriers, phases, classements annuels, éventuels coefficients de relégation et critères continentaux sont des modules propres à chaque compétition. Le jeu ne force pas tout le continent dans un championnat européen aller-retour.

### CONCACAF : 35 associations membres FIFA

Les quatre lots couvrent les 35 membres FIFA de la confédération ; les membres régionaux non FIFA sont traités séparément plus bas ([associations CONCACAF](https://en.wikipedia.org/wiki/Geography_of_association_football)).

| Lot | Associations | Profondeur cible |
|---|---|---|
| Pôles prioritaires | États-Unis, Mexique | Détail dans les cartes précédentes |
| Marchés régionaux | Canada, Costa Rica, Guatemala, Honduras, Jamaïque, Panama, Salvador | A première compétition nationale documentée ; B niveaux suivants ; branches transfrontalières séparées |
| Réseaux caribéens et continentaux | Belize, Cuba, Curaçao, Guyana, Haïti, Nicaragua, République dominicaine, Suriname, Trinité-et-Tobago | B première compétition documentée ; A par lots |
| Autres associations | Anguilla, Antigua-et-Barbuda, Aruba, Bahamas, Barbade, Bermudes, Dominique, Grenade, Îles Caïmans, Îles Turques-et-Caïques, Îles Vierges américaines, Îles Vierges britanniques, Montserrat, Porto Rico, Saint-Christophe-et-Niévès, Sainte-Lucie, Saint-Vincent-et-les-Grenadines | C puis B selon données, avec accès aux parcours de recrutement et sélections |

### CAF : 54 associations membres FIFA

Les lots couvrent les 54 membres FIFA africains de la liste consultée ([associations CAF](https://en.wikipedia.org/wiki/Geography_of_association_football)).

| Lot | Associations | Profondeur cible |
|---|---|---|
| Priorité de profondeur | Maroc | Détail dans la carte précédente |
| Pôles continentaux | Afrique du Sud, Algérie, Cameroun, Côte d'Ivoire, Égypte, Ghana, Nigeria, Sénégal, Tunisie | A D1-D2 cible ; jeunes et formation régionale |
| Marchés connectés | Angola, Burkina Faso, Guinée, Kenya, Mali, Ouganda, RD Congo, République du Congo, Tanzanie, Zambie | B D1-D2 cible ; A par lots |
| Complément mondial | Bénin, Botswana, Burundi, Cap-Vert, Comores, Djibouti, Érythrée, Eswatini, Éthiopie, Gabon, Gambie, Guinée-Bissau, Guinée équatoriale, Lesotho, Liberia, Libye, Madagascar, Malawi, Maurice, Mauritanie, Mozambique, Namibie, Niger, République centrafricaine, Rwanda, São Tomé-et-Príncipe, Seychelles, Sierra Leone, Somalie, Soudan, Soudan du Sud, Tchad, Togo, Zimbabwe | C sur toutes ; B sur compétition documentée et viviers activés |

La profondeur africaine ne doit pas se limiter à produire des recrues pour l'Europe. Une carrière locale, une rivalité nationale et une conquête continentale doivent constituer des expériences complètes.

### AFC : 46 associations membres FIFA

Les lots couvrent les 46 membres FIFA asiatiques de la liste consultée, dont l'Australie dans cette confédération ([associations AFC](https://en.wikipedia.org/wiki/Geography_of_association_football)).

| Lot | Associations | Profondeur cible |
|---|---|---|
| Pyramides prioritaires | Australie, Corée du Sud, Japon | Détail dans les cartes précédentes |
| Pôles régionaux | Arabie saoudite, Chine, Émirats arabes unis, Inde, Indonésie, Iran, Irak, Malaisie, Qatar, Thaïlande, Vietnam | A D1-D2 cible ; format local propre |
| Réseaux connectés | Bahreïn, Bangladesh, Hong Kong, Jordanie, Kirghizistan, Koweït, Liban, Oman, Ouzbékistan, Philippines, Singapour, Tadjikistan | B première compétition documentée ; niveau suivant selon structure réelle |
| Complément mondial | Afghanistan, Bhoutan, Brunei, Cambodge, Corée du Nord, Guam, Laos, Macao, Maldives, Mongolie, Myanmar, Népal, Pakistan, Palestine, Sri Lanka, Syrie, Taipei chinois, Timor-Leste, Turkménistan, Yémen | C puis B selon données et compétition effectivement organisée |

### OFC : 11 associations membres FIFA

Les lots couvrent les onze membres FIFA océaniens de la liste consultée ([associations OFC](https://en.wikipedia.org/wiki/Geography_of_association_football)).

| Lot | Associations | Profondeur cible |
|---|---|---|
| Pôle initial | Nouvelle-Zélande | A sur structure nationale et régionale vérifiée |
| Réseau océanien | Fidji, Îles Salomon, Nouvelle-Calédonie, Papouasie-Nouvelle-Guinée, Tahiti, Vanuatu | B première compétition documentée ; A par lots |
| Complément mondial | Îles Cook, Samoa, Samoa américaines, Tonga | C puis B selon données |

L'OFC Pro League doit être un objet distinct des championnats domestiques et de l'OFC Champions League ; les règlements publiés par l'OFC distinguent ces compétitions ([OFC, règlements des compétitions](https://www.oceaniafootball.com/competition-regulations/)). Les voyages et l'accessibilité des infrastructures peuvent créer une identité forte sans réduire ces carrières à une difficulté arbitraire.

### Associations régionales non FIFA et territoires

La liste consultée distingue onze associations membres de confédérations mais non de la FIFA : Réunion et Zanzibar pour la CAF ; Îles Mariannes du Nord pour l'AFC ; Bonaire, Guyane française, Guadeloupe, Martinique, Saint-Martin et Sint Maarten pour la CONCACAF ; Kiribati et Tuvalu pour l'OFC ([associations non FIFA](https://en.wikipedia.org/wiki/Geography_of_association_football)). Elles doivent pouvoir exister dans le catalogue sans recevoir automatiquement l'éligibilité à une Coupe du monde FIFA.

La conception doit séparer association, nationalité, territoire, résidence, identité du club et compétition. C'est indispensable pour ne pas déduire l'éligibilité sportive d'un simple drapeau.

## Carte transversale : féminin, jeunes, réserves et sélections

### Football féminin mondial

Le football féminin doit utiliser les mêmes outils de carrière, de tactique, d'analyse et de mémoire. Les ressources et règles sont spécifiques à chaque compétition et les événements médicaux ou personnels sensibles restent facultatifs, respectueux et non sensationnalistes.

| Marché | Premier championnat identifié | Profondeur proposée |
|---|---|---|
| France | Première Ligue, Seconde Ligue et D3 Féminine, détaillées plus haut ; la composition actualisée de Seconde Ligue remplace le projet initial à douze équipes ([FFF, Seconde Ligue](https://www.fff.fr/article/17024-le-calendrier-de-la-saison-2026-2027.html), [FFF, D3](https://www.fff.fr/article/17114-toutes-les-affiches-de-la-saison.html)) | A trois niveaux |
| Angleterre | Women's Super League ([Eurovision Sport](https://eurovisionsport.com/en/explore/sports/football/info)) | A D1 ; D2-D3 après audit |
| Espagne | Liga F ([Eurovision Sport](https://eurovisionsport.com/en/explore/sports/football/info)) | A D1 ; niveaux suivants après audit |
| Allemagne | Frauen-Bundesliga ([Eurovision Sport](https://eurovisionsport.com/en/explore/sports/football/info)) | A D1 ; D2 après audit |
| Italie | Serie A Femminile ([Eurovision Sport](https://eurovisionsport.com/en/explore/sports/football/info)) | A D1 ; D2 après audit |
| États-Unis | NWSL ([Eurovision Sport](https://eurovisionsport.com/en/explore/sports/football/info)) | A ; autres ligues en branches séparées à auditer |
| Brésil | Brasileiro Feminino Série A1 ([Eurovision Sport](https://eurovisionsport.com/en/explore/sports/football/info)) | A ; niveaux suivants après audit |
| Japon | WE League ([Eurovision Sport](https://eurovisionsport.com/en/explore/sports/football/info)) | A ; articulation avec autres ligues à auditer |
| Australie | A-League Women ([Eurovision Sport](https://eurovisionsport.com/en/explore/sports/football/info)) | A ; branches régionales à auditer |
| Chine | Chinese Women's Super League ([Eurovision Sport](https://eurovisionsport.com/en/explore/sports/football/info)) | B puis A |
| Autres marchés prioritaires | Canada, Mexique, Portugal, Pays-Bas, Belgique, Écosse, Suède, Norvège, Danemark, Finlande, Islande, Suisse, Autriche, Corée du Sud, Nouvelle-Zélande, Afrique du Sud, Maroc, Nigeria | D1 cible ; noms, formats et données non verrouillés ici |
| Autres associations de la carte | Compétitions existantes à inventorier, sans création d'une ligue fictive présentée comme réelle | D ou C, puis B après validation |

La carte mondiale ne suffit donc pas à affirmer une couverture féminine complète et jouable. Le registre de production doit suivre séparément chaque branche masculine, féminine et de jeunes.

### Formation et réserves

| Couche | Contenu proposé | Fonction dans une carrière |
|---|---|---|
| U14-U15 | Compétitions locales ou régionales réelles à documenter | Découverte, scolarité, croissance, premiers regards |
| U16-U17 | Championnats et parcours de préformation propres au pays | Concurrence, rythme d'entraînement, premiers changements de club |
| U18-U19 | Ligues et coupes de jeunes, dont Gambardella et Youth League comme cibles à auditer | Premiers grands rendez-vous, sortie de formation |
| Réserves et U21/U23 | Réserve intégrée à la pyramide ou compétition distincte selon le pays | Transition vers le football senior |
| Universités et filières scolaires | Circuits spécifiques à documenter, pas simple copie du centre français | Alternative crédible aux académies |
| Sélections de jeunes | Catégories et calendriers propres à chaque organisateur | Visibilité, rassemblements et arbitrages avec le club |

Un joueur de 14 ans débute normalement dans l'équipe de jeunes de son club, pas automatiquement dans son équipe senior de D4 ou D5. Les surclassements et apparitions seniors ne deviennent possibles que si les règles locales d'âge, de santé et d'éligibilité les autorisent.

### Compétitions continentales et mondiales

| Zone | Carte de compétitions à intégrer |
|---|---|
| UEFA | Champions League, Europa League, Conference League et Super Cup ; Women's Champions League et Women's Europa Cup ([UEFA, compétitions de clubs](https://www.uefa.com/running-competitions/our-competitions/clubs/)) |
| CONMEBOL | Copa Libertadores, Copa Sudamericana et Recopa Sudamericana ; Copa Libertadores Femenina ; U-20 Copa Libertadores ; formats et accès à verrouiller par édition ([compétitions CONMEBOL](https://en.wikipedia.org/wiki/CONMEBOL)) |
| CAF | Champions League, Confederation Cup, Super Cup ; Women's Champions League ([CAF, calendrier des compétitions](https://www.cafonline.com/media/kiwfx5vc/caf-competition-calendar-2026-2030.pdf)) |
| AFC | Champions League Elite, Champions League Two et Challenge League ; règles d'accès à charger par édition ([AFC, règlement d'accès 2026](https://assets.the-afc.com/downloads/miscellaneous-regulations/AFC-Club-Competitions---Entry-Regulations-(Edition-2026)-.pdf)) |
| CONCACAF | Champions Cup, Central American Cup, Caribbean Cup ; Leagues Cup comme compétition distincte ([CONCACAF, voies de qualification](https://www.concacaf.com/competitions/champions-cup/news/2027-concacaf-champions-cup-qualified-clubs)) |
| OFC | Men's Champions League, Women's Champions League et Pro League, chacune avec son propre règlement ([OFC](https://www.oceaniafootball.com/competition-regulations/)) |
| Monde et sélections | Coupes du monde, qualifications, compétitions continentales, tournois de jeunes et Jeux olympiques comme familles de contenu ; éditions, âges, quotas et formats à auditer |

Les qualifications ne peuvent pas être approximées si le club de l'utilisateur est concerné. Aucun tournoi ne doit être ajouté seulement parce que son nom est célèbre : il faut aussi ses participants éligibles, son calendrier, ses règles et ses conséquences.

## Le moteur réglementaire : le vrai socle du réalisme

Chaque compétition est un ensemble de règles datées, pas une feuille de classement décorative. Les changements de nom, de format et de statut sont versionnés sans effacer les anciennes saisons.

### Le registre minimal d'une compétition

| Domaine | Données indispensables |
|---|---|
| Identité | Identifiant stable, association, branche, genre, âge, nom par saison, organisateur, source et date de vérification |
| Structure | Niveau ou branche parallèle, groupes, phases, calendrier, règles de tirage et conditions d'annulation |
| Résultat | Points, départages ordonnés, forfaits, sanctions, prolongation, tirs au but |
| Mobilité | Promotions, relégations, barrages, repêchages, licences nécessaires et réserves inéligibles |
| Effectifs | Taille de liste, fenêtres, étrangers, formation locale, âges, mouvements entre équipes |
| Match | Banc, remplacements, protocole médical, technologie arbitrale autorisée |
| Économie | Primes, répartition des revenus, contrôle financier, paiements et recours |
| Qualifications | Places nationales et continentales, coefficients éventuels, chemins alternatifs |
| Validation | Statut vérifié, incomplet ou bloquant ; responsable du contrôle ; version du règlement |

### Règles qui ne peuvent pas être remplacées par du hasard

- **Mineurs :** une offre étrangère ne suffit pas à autoriser un transfert ; le cadre FIFA pose une interdiction générale avant 18 ans avec exceptions, et les demandes correspondantes relèvent d'un traitement réglementaire ([FIFA, protection des mineurs](https://inside.fifa.com/human-rights/fifa-guardians/news/it-s-up-to-all-of-us), [FIFA, Chambre du statut du joueur](https://inside.fifa.com/legal/football-tribunal)).
- **Réforme de la Ligue 3 :** l'annonce FFF prévoit à partir de 2027-2028 une limite de 20 joueurs sous contrat fédéral avec exceptions, dont les moins de 21 ans et les joueurs formés dans la ligue régionale du club ; cette formulation ne doit pas être remplacée par « uniquement formés au club » ([FFF](https://www.fff.fr/article/16778-la-fff-officialise-la-ligue-3-professionnelle.html)).
- **Régulation économique de la Ligue 3 :** la source FFF annonce des seuils de masse salariale de 60 %, puis 50 %, puis 40 % à partir de 2027-2028 ; le jeu doit reproduire le texte applicable, les assiettes et conséquences vérifiées plutôt qu'un résumé approximatif en années civiles ([FFF](https://www.fff.fr/article/16778-la-fff-officialise-la-ligue-3-professionnelle.html)).
- **Éligibilité :** âge, contrat, nationalité sportive, inscription en liste et autorisation de travail sont des vérifications séparées.
- **Dossiers incomplets :** en cas de règle bloquante inconnue, ne pas vendre la compétition comme intégralement fidèle ; proposer un mode simplifié explicitement nommé ou différer son activation.

Un mode « histoire alternative » peut autoriser des réformes fictives après le début de la sauvegarde. Il doit être séparé du mode réglementaire fidèle et les changements doivent être annoncés, cohérents et appliqués à tous.

## Immersion : une simulation qui produit des histoires

### Une chaîne causale plutôt qu'une collection de jauges

Exemple proposé : trois matchs rapprochés augmentent la fatigue ; le staff recommande du repos ; le joueur insiste pour disputer une finale ; son rendement baisse ; un concurrent saisit sa chance ; l'entraîneur modifie la hiérarchie ; l'agent conseille un prêt. Une décision sportive devient une histoire sans imposer de blessure ni de conflit.

Chaque événement significatif doit posséder un déclencheur, des acteurs, un contexte, des options plausibles et des conséquences persistantes. Un tirage aléatoire peut varier l'issue, mais ne doit pas fabriquer la cause après coup.

### Les variables centrales

| Couche | Variables proposées | Ce que le joueur perçoit |
|---|---|---|
| Corps | Charge récente, fatigue aiguë, récupération, croissance, tolérance individuelle, antécédents | Sensations, rapports du staff, tests et fourchettes de risque |
| Jeu | Technique contextualisée, lecture, choix, pied faible, automatismes | Séquences vidéo, conseils, comportements sur le terrain |
| Mental | Confiance située, gestion de pression, motivation, besoin d'autonomie | Entretiens et réactions, pas diagnostic médical automatique |
| Relations | Confiance réciproque, promesses, affinités, conflits de rôle | Interactions contextualisées et mémoire des actes |
| Environnement | Qualité du staff, terrain, infrastructures, voyage, stabilité | Expérience d'entraînement, récupération et contraintes du calendrier |
| Marché | Visibilité, réputation locale, intérêt, besoin tactique, budget | Rapports incertains, offres, rumeurs et contacts |

Une note générale peut exister en mode accessible, mais elle ne doit pas gouverner à elle seule les sélections. Un joueur moins réputé peut être le meilleur choix pour une tâche précise.

## La vie d'un joueur : de 14 ans à la reconversion

### Départ à 14 ou 15 ans

Le joueur choisit une origine, un milieu familial de départ, un profil de jeu encore incomplet et un contexte local. Aucun milieu social ne doit être un bonus moral ou un déterminisme sportif.

- **Point de départ :** équipe de jeunes d'un club, filière scolaire ou structure de formation disponible dans le pays choisi.
- **Compétences :** quelques forces observables et des inconnues, pas un potentiel final de superstar affiché.
- **Famille :** soutien, disponibilité, distance et préférences influencent les décisions ; ils peuvent être simplifiés ou désactivés.
- **École :** projets, examens, déplacements et compatibilité avec le football, sans mini-jeu scolaire obligatoire.
- **Repérage :** les recruteurs possèdent un périmètre, un calendrier, un budget et des critères ; ils ne savent pas tout.
- **Protection :** pas de contenu adulte dans les parcours de mineurs, pas de marchandisation spectaculaire de leurs difficultés.

### Détection : être vu ne signifie pas être compris

L'observateur doit réellement avoir une raison de suivre le joueur : match pertinent, recommandation d'un éducateur, tournoi, réseau de recrutement ou essai. Une vidéo virale peut augmenter la visibilité sans améliorer automatiquement l'évaluation sportive.

Un rapport peut apprécier la vitesse mais sous-estimer le placement, ou être faussé par l'adversaire, le temps de jeu et le niveau de maturation. Les rapports convergent progressivement sans dévoiler une vérité absolue sur un plafond de potentiel.

### Formation : apprendre un métier

- **Technique :** répétition de situations, variation des contextes et transfert vers le match.
- **Tactique :** lecture de déclencheurs, couverture, orientation du corps, choix sous pression.
- **Physique :** charge compatible avec la croissance et l'encadrement ; pas de promesse d'augmentation de taille ou de force par simple dépense de points.
- **Psychologie :** confiance spécifique à certaines situations et capacité à rebondir, pas jauge de « mental » qui explique tout.
- **Identité :** un éducateur peut changer le poste ; le joueur peut discuter, essayer ou refuser avec conséquences raisonnables.
- **Sortie de formation :** maintien, contrat, prêt, autre niveau, poursuite d'études ou pause ; aucun rejet n'est automatiquement un game over.

### Le développement sans arbre magique

La progression proposée dépend de la qualité d'apprentissage, des occasions de pratique, de la récupération et de la maturité ; elle ralentit lorsque les situations deviennent trop faciles. Les menus d'entraînement ne peuvent pas transformer instantanément un défenseur en meneur de jeu.

Les points d'expérience, s'ils sont conservés en mode accessible, représentent des priorités de travail. Ils n'achètent ni taille, ni santé parfaite, ni potentiel illimité.

### Le quotidien professionnel et amateur

| Situation | Expérience proposée |
|---|---|
| Amateur | Disponibilités limitées, études ou emploi, entraînement collectif moins fréquent, logistique concrète |
| Semi-professionnel | Arbitrages entre revenus, disponibilité, déplacement et ambition |
| Professionnel en rotation | Concurrence, rythme, préparation, banc et gestion des attentes |
| Titulaire | Responsabilité tactique, fatigue, exigences et exposition |
| Cadre | Leadership, accompagnement des jeunes et négociation du rôle |
| Fin de carrière | Adaptation du jeu, temps de jeu ciblé, diplômes et transmission |

### Une vie personnelle utile, pas envahissante

Le logement, la langue, la proximité des proches et la familiarité avec une ville influencent surtout l'adaptation. Les achats de luxe n'accordent aucun bonus de vitesse et les relations personnelles ne sont pas des distributeurs de statistiques.

Les scènes hors terrain restent courtes, facultatives et liées à une décision. Un bouton permet de résumer la semaine tout en conservant les faits importants.

## Le match : faire sentir les causes

### Un seul état sportif

Match complet, temps forts et simulation interactive lisent les mêmes compositions, rôles, condition physique, sanctions, score et événements persistants. La simulation rapide peut utiliser une approximation statistique calibrée ; elle doit le signaler et ne pas prétendre exécuter silencieusement une physique 3D identique.

Le passage du mode simulation au contrôle ne remet jamais à zéro la fatigue ou la confiance. Un événement déjà résolu ne peut pas être rejoué jusqu'à obtenir un résultat favorable sans passer explicitement par un rechargement de sauvegarde.

### Football collectif crédible

- **Avec ballon :** occupation de l'espace, recherche d'homme libre, appels de fixation, orientation des contrôles et coût du pressing adverse.
- **Sans ballon :** hauteur du bloc, couverture, protection de l'axe, compensations et discipline de ligne.
- **Transitions :** choix de contre-pressing ou de repli, distance de retour, soutien disponible.
- **Erreurs :** contrôle difficile après une passe forte ou sous pression ; pas une animation de raté déclenchée pour équilibrer le score.
- **Contact :** inertie, équilibre, duel, protection et arbitrage avec cohérence ; toute collision ne provoque pas une faute.
- **Gardien :** placement, lecture des centres, jeu au pied, communication et relances, pas seulement réflexes.
- **Météo et terrain :** effets cohérents sur trajectoire, appuis et rythme ; aucun multiplicateur caché identique pour toutes les équipes.

### Le hors-ballon doit être jouable

En carrière joueur, un appel pertinent, une fermeture de ligne ou un retour défensif peut être plus utile qu'un dribble. Le retour d'évaluation doit distinguer ce que le joueur contrôle, ce que le collectif a réalisé et ce qui relève du résultat.

Un milieu défensif ne doit pas recevoir systématiquement « marquer deux buts ». Les objectifs découlent du rôle confié, des consignes et du temps de présence réel.

### Des temps forts qui ne trichent pas

- **Sélection :** choisir des séquences selon l'importance et le rôle, pas seulement des occasions favorables à l'utilisateur.
- **Contexte :** afficher score, minute, fatigue, rôle et intention tactique avant le contrôle.
- **Variété :** inclure une sortie de pressing, une couverture, une conservation ou une entrée tardive.
- **Continuité :** le résultat d'une action contrôlée modifie la simulation restante.
- **Équilibre :** tester statistiquement l'absence d'avantage systématique lié à la fréquence des interventions.

### Arbitres, tribunes et présentation

Les arbitres peuvent avoir des tendances mesurées et une marge d'erreur, mais pas un biais scénarisé contre l'utilisateur. Les technologies d'assistance doivent dépendre de la compétition, avec des séquences rapides à passer.

Les spectateurs réagissent à l'enjeu, au score, à l'historique et au style de match. Une tribune de district, un stade à moitié rempli et une soirée continentale doivent se distinguer par le son, la caméra et les comportements, sans exiger trois moteurs de jeu.

## Relations, vestiaire et réputation

### Les personnes ont leurs propres objectifs

L'entraîneur cherche des résultats, une cohérence de jeu et la confiance de sa direction ; le directeur sportif gère aussi la valeur des actifs ; l'agent peut privilégier revenus ou trajectoire ; un coéquipier cherche du temps de jeu. Ces intérêts peuvent s'aligner ou entrer en conflit sans que quelqu'un devienne automatiquement un antagoniste.

Chaque personnage possède une mémoire limitée aux événements qu'il connaît. Une conversation privée ne devient pas instantanément une information mondiale.

### Une mémoire d'événements, pas une simple jauge

- **Promesses :** contenu précis, conditions, échéance et témoin éventuel.
- **Confiance :** issue des comportements répétés ; ne revient pas à zéro après chaque mercato.
- **Statut :** vestiaire, staff, supporters et médias peuvent avoir des opinions différentes.
- **Conflits :** désaccord sur un rôle, une charge ou une sélection, pas seulement réponse « gentille » contre réponse « méchante ».
- **Réparation :** une explication et des actes peuvent reconstruire une relation ; un clic ne supprime pas un conflit.
- **Transmission :** un ancien entraîneur peut recommander le joueur des années plus tard s'il existe encore une relation crédible.

### Presse et réseaux sociaux

La presse possède un territoire, une ligne éditoriale et un niveau d'accès. Les rumeurs sont traçables à une origine plausible et peuvent être fausses ; elles n'ont pas toutes une réponse obligatoire.

Un mode calme résume l'environnement médiatique. Les insultes explicites, le harcèlement détaillé et la reproduction de scandales personnels de personnes réelles sont exclus du contenu généré.

## Santé, préparation et confiance

### Une incertitude lisible

Le staff donne des estimations, pas un compteur exact avant blessure. Une surcharge peut accroître le risque sans provoquer automatiquement un incident et un joueur prudent peut quand même se blesser.

Le jeu montre les signaux utiles : charge récente, récupération estimée, gêne signalée et recommandations. Il ne transforme pas le joueur en médecin ni n'affiche de pseudo-diagnostic pour toute baisse de performance.

### Le retour de blessure est une histoire jouable

- **Diagnostic :** incertitude initiale, examens et horizon réévalué.
- **Rééducation :** choix limités mais significatifs, rapports, lien avec le groupe.
- **Reprise :** minutes progressives, adaptation tactique et concurrence.
- **Conséquences :** forme et confiance peuvent revenir à des rythmes différents ; perte définitive d'attributs jamais automatique.
- **Réglages :** fréquence, gravité et détail médical configurables ; mode sans blessures graves possible.
- **Respect :** aucun achat réel, défi quotidien ou mécanique payante pour guérir plus vite.

## Marché des transferts et économie vivante

### Pourquoi un club recrute

Le recrutement naît d'un besoin et d'une capacité : poste, rôle, âge, statut, disponibilité, budget, règles d'inscription et risque accepté. Un club ne recrute pas cinq gardiens parce que leurs notes générales sont élevées.

L'offre doit expliquer le projet : concurrence actuelle, rôle envisagé, style, qualité de l'encadrement, stabilité et possibilités de prêt. Le nom prestigieux du club ne vaut pas garantie de temps de jeu.

### Une négociation multidimensionnelle

- **Joueur :** rôle souhaité, rémunération, environnement, proximité, ambitions et tolérance à l'incertitude.
- **Club vendeur :** besoin de liquidités, durée de contrat, remplaçant et valeur sportive.
- **Club acheteur :** trésorerie, engagements futurs, inscription et marge salariale.
- **Agent :** mandat, réputation, qualité d'information et rémunération autorisée.
- **Contrat :** échéancier, primes, clauses, options, obligations et contraintes légales à vérifier selon pays et âge.
- **Prêt :** rôle annoncé, contribution salariale, conditions de rappel et suivi sportif sans promesse de titularisation absolue.

### De vraies finances

Compte de résultat, trésorerie et engagements futurs sont distincts. Un club peut annoncer une vente élevée tout en manquer de liquidités si le paiement est étalé.

Les infrastructures coûtent à construire puis à entretenir ; une montée augmente aussi certaines dépenses. Les dirigeants IA préparent leur saison suivante au lieu d'attendre le dernier jour pour combler leurs effectifs.

### Une carrière amateure économiquement intéressante

Les frais de déplacement, la stabilité d'un emploi et la disponibilité peuvent peser davantage qu'une petite prime. Une décision de rester près de chez soi peut être un choix rationnel et satisfaisant, pas une mauvaise réponse imposée par le jeu.

## Le manager et le club comme institutions

### Gouvernance et identité

Le conseil possède une stratégie, une tolérance au risque et une mémoire de ses engagements. Une ambition de montée doit être cohérente avec le budget accepté et le niveau de concurrence.

Le manager peut négocier ses objectifs, documenter une contrainte et déléguer. Le licenciement doit être compréhensible même lorsqu'il est sévère : résultats, confiance, désaccord ou crise, pas un seuil invisible de satisfaction.

### Tactique enseignée, pas télépathique

Changer de système modifie les besoins d'apprentissage et les automatismes. Les joueurs comprennent et exécutent les consignes selon expérience, communication et répétition.

L'utilisateur doit pouvoir voir où le système fonctionne ou échoue : distances de bloc, sorties de pressing, couloirs vulnérables et responsabilités. L'adjoint propose une lecture, pas une solution parfaite.

### La formation comme projet de club

- **Recrutement des jeunes :** zone, moyens, concurrence et qualité des évaluations.
- **Éducateurs :** méthodes, spécialités, stabilité et relation avec les joueurs.
- **Passerelle senior :** minutes utiles, prêts adaptés et coordination entre équipes.
- **Rendement :** un bon centre augmente les opportunités de développement, pas la garantie d'un prodige annuel.
- **Mémoire :** joueurs libérés qui progressent ailleurs, anciens devenus éducateurs et générations marquantes.
- **Éthique :** double projet et accompagnement de sortie, pas seulement valeur de revente.

## Donner envie de continuer : captivant plutôt que compulsif

Le plaisir recherché est celui de revenir dans un monde auquel on tient. L'objectif n'est pas d'allonger artificiellement le temps de jeu ou d'exploiter la peur de manquer.

### Trois horizons simultanés

| Horizon | Question qui donne envie | Récompense proposée |
|---|---|---|
| Séance ou match | Vais-je réussir cette tâche ? | Retour clair, séquence réussie, compréhension nouvelle |
| Mois ou saison | Vais-je gagner ma place, rester en bonne santé ou obtenir une montée ? | Changement de rôle, confiance, progression et résultats |
| Carrière | Quelle trace vais-je laisser ? | Histoire personnelle, relations, records et héritage |

### Les boucles de jeu

- **Boucle courte :** recevoir une consigne, essayer, observer l'effet, comprendre et ajuster.
- **Boucle hebdomadaire :** choisir une priorité, gérer sa préparation, affronter une situation et lire un bilan court.
- **Boucle saisonnière :** se fixer un projet, traverser des phases contrastées, décider d'un tournant et faire le bilan.
- **Boucle générationnelle :** revoir des personnes, suivre d'anciens coéquipiers, transmettre et observer l'évolution du club.

Une bonne fin de session offre une fermeture satisfaisante avec une envie naturelle de revenir. Elle n'interrompt pas systématiquement une scène au moment de sa résolution.

### Le système « Horizons »

Trois pistes maximum restent affichées : un objectif proche, une décision possible et un projet long. Le joueur peut remplacer, masquer ou ignorer ces pistes sans punition.

Exemple : « mieux fermer ton couloir », « discuter d'un prêt avant le mercato », « devenir cadre de ton club formateur ». La formulation découle de la situation ; il ne s'agit pas de quêtes répétées chaque saison.

### L'échec qui ouvre autre chose

Une mise à l'écart peut mener à un nouveau rôle, un prêt ou un départ ; elle ne doit pas toujours débloquer une récompense de compensation. L'intérêt vient de la nouvelle situation, pas d'une garantie que toute mauvaise décision devient favorable.

Un joueur anonyme peut vivre une carrière réussie en trouvant un équilibre, en accompagnant une génération ou en remportant une coupe locale. La satisfaction ne repose pas uniquement sur le Ballon d'Or.

### Ce qui est interdit

- **Connexion quotidienne :** aucune série perdue, prime de présence ou récompense expirante nécessaire à la carrière.
- **Fausse urgence :** pas de transfert qui disparaît en temps réel lorsque le jeu est fermé.
- **Paiement :** pas de potentiel, guérison, confiance ou titularisation achetés.
- **Aléatoire monétisé :** pas de loot boxes, de tirages payants ou de relance payante d'une génération de jeunes.
- **Allongement artificiel :** pas de scènes impossibles à passer ni de calendrier volontairement lent.
- **Punition de pause :** la carrière solo attend le retour du joueur.

## Une interface qui laisse vivre la carrière

### L'écran principal

L'accueil répond à trois questions : « Où en suis-je ? », « Qu'est-ce qui demande vraiment une décision ? » et « Quelle est la prochaine scène intéressante ? ». Les informations secondaires restent accessibles sans interrompre la progression.

| Zone | Contenu |
|---|---|
| Aujourd'hui | Prochaine séance, sélection ou rencontre |
| Mon rôle | Attentes du staff, état de forme et priorité actuelle |
| Mes personnes | Conversations importantes et engagements à échéance |
| Le monde | Quelques faits liés au parcours, pas tout le flux mondial |
| Horizons | Trois pistes maximum, modifiables |

### Délégation et granularité

- **Mode essentiel :** matchs, grandes décisions, bilan hebdomadaire et préparation guidée.
- **Mode carrière :** entraînement, conversations, négociations et analyse accessibles.
- **Mode expert :** règlements, charges, finances et suivi détaillés.
- **Délégation par domaine :** confier les tâches sans changer tout le niveau de difficulté.
- **Résumé :** passer un mois ou une saison en définissant les événements qui doivent arrêter l'avance.
- **Accessibilité :** sous-titres, lisibilité, contraste, commandes adaptées, réduction des animations et des stimulations.

Le détail de simulation et le nombre de clics sont deux réglages différents. On peut vouloir un monde très réaliste tout en demandant au staff de gérer la majorité des tâches.

## La mémoire du monde : le meilleur moteur d'attachement

### Le journal de carrière

Le jeu conserve les premiers matchs, rencontres importantes, décisions, promesses, blessures marquantes et changements de statut. Il compose en fin de saison une rétrospective courte, modifiable et exportable.

Un événement n'est pas important seulement parce qu'il débloque un trophée. Le premier salaire, un retour au club formateur, une sélection manquée ou le départ d'un éducateur peuvent être retenus si leur contexte le justifie.

### Les trajectoires croisées

- **Ancien rival :** devient coéquipier puis capitaine.
- **Joueur libéré :** progresse ailleurs et croise le club formateur.
- **Ancien entraîneur :** change de pays et conserve son appréciation du joueur.
- **Jeune accompagné :** devient titulaire au moment de la fin de carrière du mentor.
- **Club quitté :** monte, descend ou change de projet sans attendre le retour de l'utilisateur.
- **Famille sportive :** un joueur créé peut devenir entraîneur ; la succession n'impose pas une dynastie biologique.

### Sauvegarde longue

La cible est une sauvegarde qui peut dépasser plusieurs générations sportives, sans limite arbitraire courte. Sa viabilité doit être démontrée par des tests de vieillissement de base, de génération de joueurs, d'économie, de stabilité réglementaire et de taille des historiques.

Les records doivent conserver leur contexte : compétition, saison, nombre de matchs et éventuelles réformes. Un nouveau nom de ligue ne crée pas automatiquement une nouvelle histoire sans passé.

## Exemple de carrière : une semaine, puis vingt ans

Les scènes suivantes sont entièrement fictives et illustrent les systèmes proposés. Elles ne décrivent ni un joueur réel ni un parcours garanti.

### À 14 ans, dans les Hauts-de-France

Tu joues dans une équipe U15 d'un club amateur. Un éducateur apprécie ta lecture du jeu, mais tu traverses une période d'adaptation physique et ta famille ne peut pas multiplier les déplacements.

Un recruteur te voit sur un match moyen, puis revient après la recommandation d'un entraîneur. Tu peux accepter un essai, attendre les vacances ou privilégier une filière plus proche ; chacune de ces décisions modifie les occasions futures sans choisir d'avance la meilleure carrière.

### À 17 ans, le premier vrai dilemme

Tu joues régulièrement chez les jeunes, mais une réserve propose surtout un rôle différent du tien. Un autre club offre un chemin vers le senior sans garantir de place.

La discussion expose les faits connus : joueurs devant toi, style de l'équipe, stabilité du coach et attentes de formation. Tu décides sous incertitude, pas devant deux options étiquetées « bonne » et « mauvaise ».

### À 22 ans, la semaine d'un joueur de rotation

| Jour | Situation | Choix utile |
|---|---|---|
| Lundi | Bilan vidéo après une entrée mitigée | Comprendre une erreur de positionnement ou demander un retour sur ton rôle |
| Mardi | Charge d'entraînement ajustée | Travailler une situation ciblée ou suivre le programme recommandé |
| Mercredi | Conversation avec un coéquipier | Aider à préparer un adversaire, sans quête sociale obligatoire |
| Jeudi | Mise en place tactique | Montrer que tu peux remplir la tâche demandée |
| Vendredi | Annonce du groupe | Accepter le banc ou demander un entretien à un moment pertinent |
| Samedi | Entrée à la 68e minute | Conserver l'avantage, fermer un côté et exploiter les espaces disponibles |
| Dimanche | Bilan court | Le coach relève ton rôle réel, pas seulement ton nombre de buts |

### À 34 ans, transmettre

Tu n'as jamais été une superstar, mais tu connais ton club et sais aider un jeune à occuper ton poste. L'entraîneur peut te proposer une rotation, une première mission de mentorat ou un accompagnement vers un diplôme.

La carrière n'a pas besoin d'une finale mondiale pour se conclure de façon forte. Son aboutissement peut être un maintien, une remontée, une génération formée ou le retour là où tout a commencé.

## Architecture de simulation et garde-fous

### Cinq couches proposées

| Couche | Responsabilité | Garde-fou |
|---|---|---|
| État du monde | Personnes, clubs, contrats, calendriers et événements | Identifiants stables et historique des changements |
| Règles | Inscription, compétition, transferts, finance et éligibilité | Règles versionnées, sourcées et testées |
| Décisions | Objectifs et arbitrages des personnes et institutions | Informations limitées à ce que chaque acteur sait |
| Match | Actions, physique, tactique et résolution statistique | État cohérent entre formats ; approximations documentées |
| Présentation | Scènes, texte, son, presse et rétrospectives | Ne peut pas inventer un fait canonique hors simulation |

### Usage éventuel d'IA générative

Une génération de texte peut reformuler un entretien ou varier un article à partir de faits autorisés. Elle ne décide pas seule d'un contrat, d'une blessure, d'un résultat ou d'une sanction.

Un système de modèles de texte doit permettre de jouer hors ligne sans dépendance obligatoire à un service distant. Les dialogues vérifient les noms, dates, rôles et promesses avant affichage ; un échec déclenche une formulation de secours.

### Reproductibilité et diagnostic

- **Graine :** les tirages significatifs sont enregistrés pour reproduire un problème.
- **Journal causal :** les événements importants disposent d'une trace interne expliquant leurs entrées et leurs sorties.
- **Séparation :** un changement de caméra ne modifie pas un résultat.
- **Rattrapage :** les ligues de contexte ne réécrivent pas le passé lors de leur activation.
- **Vieillissement :** tests de sauvegardes sur plusieurs décennies.
- **Confidentialité :** données de jeunes fictifs par défaut ; exploitation de données de personnes réelles et mineures soumise à validation juridique et aux droits nécessaires.

## Exigences prioritaires et critères d'acceptation

Les priorités P0/P1/P2 de cette section portent sur l'ordre de construction et de preuve du prototype. Le catalogue de la V1 détaillé plus loin décrit la première version de contenu visée ; son inclusion ne transforme pas rétroactivement chaque compétition et chaque fonctionnalité en besoin du tout premier test technique.

### Histoires utilisateur

- **Joueur débutant :** en tant que jeune en formation, je veux comprendre pourquoi je suis retenu ou non afin de choisir une réponse adaptée.
- **Joueur pressé :** en tant que joueur disposant de peu de temps, je veux résumer les semaines ordinaires sans manquer une décision importante.
- **Amateur de simulation :** en tant que manager, je veux que les règles d'inscription et d'accession correspondent à ma compétition afin de préparer réellement l'avenir.
- **Joueuse :** en tant que joueuse en carrière, je veux un parcours complet et spécifique à mon environnement, pas un mode secondaire dépourvu des systèmes centraux.
- **Joueur de longue durée :** en tant que vétéran d'une sauvegarde, je veux retrouver des personnes et des événements passés afin de ressentir la continuité du monde.
- **Utilisateur d'une ligue de contexte :** en tant que joueur transféré à l'étranger, je veux connaître les limites de simulation avant de signer.

### P0 : indispensable à la première expérience

| Exigence | Critère d'acceptation | Dépendance |
|---|---|---|
| Une carrière jeune crédible | Étant donné un personnage de 14 ans, lorsqu'une offre senior ou étrangère est évaluée, alors les contrôles d'âge, d'éligibilité et d'autorisation sont effectués avant toute signature | Règles locales et mineurs |
| Une chaîne causale persistante | Étant donné une promesse datée, lorsque l'échéance passe, alors l'issue est enregistrée et peut influencer les relations concernées | Journal d'événements |
| Formats de match cohérents | Étant donné un match en cours, lors du passage vers le contrôle, alors score, minute, fatigue, sanctions et remplacements sont conservés | État de match commun |
| Retour utile au joueur | Étant donné une non-sélection, lorsque le joueur demande un retour, alors le staff fournit au moins un motif pertinent et compatible avec ses informations | Décisions traçables |
| Continuité entre divisions | Étant donné une promotion éligible, à la fin de saison, alors le club change de compétition avec un effectif et un calendrier valides | Moteur réglementaire |
| Délégation réelle | Étant donné un domaine délégué, lorsque survient une tâche courante, alors le staff la traite sans demander le même clic de confirmation | Gestion des interruptions |
| Arrêt sans pénalité | Étant donné une sauvegarde solo fermée, après une absence réelle, alors aucun temps de carrière ni avantage de connexion n'a expiré | Horloge de sauvegarde |

### P1 : forte valeur après le socle

- **Féminin français complet :** mêmes systèmes centraux, règles spécifiques, pas seulement matchs isolés.
- **Marché crédible :** besoins d'effectif, trésorerie et règles d'inscription bornent les recrutements.
- **Mémoire sociale :** anciennes promesses et trajectoires réapparaissent de manière pertinente.
- **Retour de blessure :** suivi, reprise et réintégration sans séquences répétitives obligatoires.
- **Activation d'une ligue :** historique conservé, limitations annoncées et intégrité des contrats vérifiée.
- **Reconversion :** transition joueur vers staff conditionnée à des étapes et occasions crédibles.

### P2 : horizon ambitieux

- **Toutes les associations :** présence mondiale et extension jouable progressive de la carte.
- **Pyramides locales profondes :** districts et championnats régionaux intégralement documentés.
- **Carrière multi-rôle avancée :** entraîneur de jeunes, directeur sportif et sélectionneur avec interfaces adaptées.
- **Défis connectés à l'actualité :** facultatifs, sans récompense indispensable ni dépendance de la carrière solo.
- **Éditeur :** données, règles, compétitions et ressources créées par la communauté, sous conditions de droits et de validation technique.

## Feuille de route pilotée par des preuves

### Prototype : prouver le cœur

Créer un club fictif, une compétition de jeunes et deux niveaux seniors raccordés. Tester le plaisir hors ballon, la sélection par rôle, la progression, les temps forts et les conséquences d'une décision.

Critère de sortie : plusieurs parcours différents produisent des raisons compréhensibles de continuer, sans dépendre de scènes exceptionnelles. La fidélité des visages et la quantité de championnats ne sont pas des critères de réussite du prototype.

### Socle France : prouver la profondeur

Brancher D1 à D5, jeunes et parcours féminin français selon disponibilité des données et droits. Ajouter une région locale détaillée pour que le départ amateur soit réel et non une introduction de vingt minutes.

Critère de sortie : les règles d'accession, d'inscription et de calendrier passent les tests ; les trajectoires joueur, réserve et prêt fonctionnent ; la base vieillit correctement. Une licence non obtenue ne doit pas être dissimulée derrière un nom officiel utilisé sans autorisation.

### Expansion : prouver la variété

Ajouter un lot européen, puis au moins un environnement à structure différente et un marché non européen en profondeur. Chaque lot doit apporter autre chose qu'une liste de clubs.

Critère de sortie : les systèmes supportent branches parallèles, calendriers différents, ligues fermées et règles de formation distinctes sans produire d'exceptions incohérentes.

### Monde durable : prouver l'échelle

Compléter progressivement les associations de contexte, les compétitions continentales et les marchés activables. Mesurer les coûts avant d'augmenter le nombre de ligues actives par défaut.

Critère de sortie : stabilité des historiques, économie viable sur plusieurs décennies et qualité préservée des carrières déjà intégrées. La quantité mondiale ne compense jamais une carrière française cassée.

## Mesures de réussite

Les valeurs suivantes sont des seuils de prototype proposés, pas des performances mesurées ni des normes du marché. Une première campagne de test doit établir la référence avant de fixer les cibles finales.

| Dimension | Mesure proposée | Seuil initial proposé et méthode |
|---|---|---|
| Compréhension | Les testeurs expliquent une sélection ou un refus à partir des éléments du jeu | Au moins 80 % sur scénarios testés, entretien de fin de session |
| Rythme | Interruptions obligatoires pendant une semaine sans événement majeur en mode essentiel | Au plus trois décisions imposées, comptées dans les traces de session |
| Cohérence | Erreurs bloquantes d'inscription et d'accession sur compétitions validées | Zéro sur la suite de tests réglementaires |
| Continuité | Divergences d'état après changement de format de match | Zéro sur les champs canoniques testés |
| Équilibre des formats | Distribution des résultats selon format | Écarts comparés sur séries de graines et effectifs identiques ; tolérance à fixer avant validation |
| Attachement | Souvenir spontané d'un personnage ou événement non lié à un trophée | Au moins 70 % après un arc de saison en test qualitatif |
| Santé de l'expérience | Sentiment de pouvoir arrêter sans perdre un avantage | Au moins 90 % des répondants comprennent l'absence de pénalité |
| Stabilité longue | Corruption, contrats incohérents, économie divergente et fichiers excessifs | Batterie automatisée sur au moins trente saisons ; budgets chiffrés après profilage |

La durée de session et le retour dans le jeu peuvent être observés avec consentement, mais ne doivent pas devenir l'unique boussole. Une session courte et satisfaisante peut être un meilleur résultat qu'une longue session subie.

## Questions ouvertes et risques

| Sujet | Décision nécessaire | Responsable proposé | Bloquant |
|---|---|---|---|
| Plateformes | Matériel cible, commandes, stockage et budgets de calcul | Direction technique | Oui, avant dimensionnement |
| Moteur de match | Partage entre physique contrôlée et simulation statistique | Équipe match | Oui |
| Droits | Périmètre par compétition, club, joueur et ressource | Production et juridique | Oui pour contenu authentique |
| Données | Qualité, fréquence, traçabilité et droits d'usage | Équipe données | Oui |
| Mineurs | Données, image, parcours et limites de représentation | Juridique et protection des publics | Oui |
| Profondeur mondiale | Nombre de ligues actives selon configuration | Technique et design | Oui avant promesse commerciale |
| Féminin | Lots de données et validation de parcours spécifiques | Production et design | Oui pour chaque lot |
| Dialogue génératif | Hors ligne, coût, contrôle des faits et modération | Technique et narration | Non pour le prototype |
| Multijoueur | Synchronisation temporelle et portée des sauvegardes partagées | Direction produit | Non ; hors socle initial |
| Éditeur communautaire | Sécurité, compatibilité, droits et règles modifiées | Production et technique | Non |

Le risque principal n'est pas de manquer d'idées, mais d'intégrer trop tôt des systèmes qui ne se répondent pas. Le bon ordre est de prouver une trajectoire forte, puis une pyramide cohérente, puis un monde durable.

## V1 : les vrais clubs et leurs divisions

### Le périmètre retenu pour cette spécification

La première version de contenu proposée est centrée sur la France : seniors masculins D1 à D5, seniors féminins D1 à D3, National U17 et National U19 masculins. Les autres pays restent un horizon d'extension et un environnement de recrutement à documenter ; aucune carrière étrangère intégrale n'est promise dans cette V1.

Le prototype technique reste plus petit : deux niveaux et quelques équipes suffisent à valider le moteur avant d'importer tout ce catalogue. Il ne faut pas confondre « première version de données » et « quantité nécessaire au premier test jouable ».

- **Saison :** 2026-2027, avec corrections de composition identifiées au 11 novembre 2026 ; les affectations ci-dessous ne doivent jamais être utilisées pour une autre saison par simple changement d'étiquette.
- **Date de départ proposée :** pré-saison d'été 2026 en mode uchronie sportive, avec compositions corrigées verrouillées pour éviter de commencer sur un championnat incomplet ; le jeu l'annonce explicitement.
- **Alternative fidèle :** départ daté après les décisions administratives, ou événements réglementaires datés avant la reprise des divisions concernées.
- **Limite de l'instantané :** la liste valide les participants et groupes, pas les effectifs de joueurs, les contrats, les notes, les budgets ou les stades.
- **Noms :** formes d'affichage harmonisées lorsque l'identité est claire ; ni audit des raisons sociales ni preuve de droits d'utilisation.
- **Droits :** une référence dans le cahier de conception ne signifie pas que le jeu dispose des licences de nom, écusson, maillot, image ou stade.

### Corrections qui changent réellement la V1

L'UF Touraine est intégrée en National 1 groupe C, qui passe à 17 équipes ; son ancienne place de National 2 groupe H reste vacante, ce groupe passant à 13 équipes ([FFF, intégration de l'UF Touraine](https://www.fff.fr/article/17198-l-uf-touraine-integree-au-championnat.html)). Le nouveau calendrier du groupe C comporte quatre journées supplémentaires et ne peut pas être obtenu en ajoutant simplement un club à un calendrier de seize équipes ([FFF, nouveau calendrier](https://www.fff.fr/article/17222-groupe-c-le-nouveau-calendrier.html)).

La Seconde Ligue féminine ne comporte finalement que onze équipes, à la suite des décisions d'exclusion et de repêchage signalées dans le calendrier actualisé de la FFF ([FFF, Seconde Ligue 2026-2027](https://www.fff.fr/article/17024-le-calendrier-de-la-saison-2026-2027.html)). Il faut donc produire des journées exemptes, pas inventer un douzième participant.

### Catalogue senior masculin

Chaque ligne du tableau est un groupe de compétition et liste l'intégralité des équipes retenues dans ce groupe. Une mention « 2 » désigne une équipe réserve et ne crée pas un nouveau club indépendant.

| Code de lot | Division | Groupe | Nombre | Équipes |
|---|---|---|---:|---|
| V1-H1 | D1, Ligue 1 | Unique | 18 | Angers SCO ; AJ Auxerre ; Stade Brestois ; Le Havre AC ; Le Mans FC ; RC Lens ; LOSC Lille ; FC Lorient ; Olympique Lyonnais ; Olympique de Marseille ; AS Monaco ; OGC Nice ; Paris FC ; Paris Saint-Germain ; Stade Rennais ; RC Strasbourg Alsace ; Toulouse FC ; ESTAC Troyes ([classement officiel Ligue 1 2026-2027](https://ligue1.com/en/competitions/ligue1mcdonalds/standings)) |
| V1-H2 | D2, Ligue 2 | Unique | 18 | FC Annecy ; US Boulogne ; Clermont Foot ; Dijon FCO ; USL Dunkerque ; Grenoble Foot ; En Avant Guingamp ; Stade Lavallois ; FC Metz ; Montpellier HSC ; AS Nancy Lorraine ; FC Nantes ; Pau FC ; Red Star FC ; Stade de Reims ; Rodez AF ; AS Saint-Étienne ; FC Sochaux-Montbéliard ([classement publié par l'AS Saint-Étienne](https://www.asse.fr/en/club/saison-2026-2027/classement-ligue-2-bkt/)) |
| V1-H3 | D3, Ligue 3 | Unique | 18 | Amiens SC ; AS Cannes ; FC Bourg-en-Bresse Péronnas 01 ; FC Fleury 91 ; FC Rouen ; FC Versailles 78 ; FC Villefranche Beaujolais ; Le Puy Foot 43 Auvergne ; Paris 13 Atletico ; SC Aubagne Air Bel ; SC Bastia ; SM Caen ; US Concarneau ; US Orléans ; US Quevilly ; US Thionville Lusitanos ; Valenciennes FC ; VFC La Roche-sur-Yon ([participants Ligue 3 2026-2027](https://www.liguesdefoot.fr/en/championnats/2026-2027/national/ligue-3/)) |
| V1-H4A | D4, National 1 | A | 16 | AS Furiani Agliani ; ASC Biesheim ; SR Colmar ; FC Borgo ; FC Chambly Oise ; FC Dieppe ; FC Montlouis ; Entente Feignies Aulnoye ; FCSR Haguenau ; Racing Club de France ; SAS Épinal ; US Lusitanos Saint-Maur ; FC Saint-Pryvé Saint-Hilaire ; US Chantilly ; US Créteil ; US Pays du Valois ([composition publiée du N1](https://www.foot-national.com/actus/national-1-la-composition-des-trois-groupes-de-la-saison-2026-2027-950026)) |
| V1-H4B | D4, National 1 | B | 16 | Angoulême Charente FC ; Aviron Bayonnais ; Voltigeurs de Châteaubriant ; Dinan Léhon FC ; FC Chauray ; GSI Pontivy ; Le Poiré-sur-Vie VF ; Les Herbiers VF ; Saint-Colomban Locminé ; FC Lorient 2 ; Olympique Saumur FC ; US Saint-Malo ; Stade Briochin ; Tarbes PF ; US Avranches MSM ; US Granville ([composition publiée du N1](https://www.foot-national.com/actus/national-1-la-composition-des-trois-groupes-de-la-saison-2026-2027-950026)) |
| V1-H4C | D4, National 1 | C | 17 | Andrézieux-Bouthéon FC ; AS Saint-Priest ; Bourges FC ; Canet Roussillon FC ; ESTAC Troyes 2 ; FC Limonest Dardilly Saint-Didier ; EFC Fréjus Saint-Raphaël ; GFA Rumilly Vallières ; GOAL FC ; Hauts Lyonnais ; Hyères FC ; Istres FC ; La Berrichonne de Châteauroux ; Lyon La Duchère ; Nîmes Olympique ; SC Toulon ; Union Foot Touraine ([composition initiale](https://www.foot-national.com/actus/national-1-la-composition-des-trois-groupes-de-la-saison-2026-2027-950026), corrigée par la [décision FFF](https://www.fff.fr/article/17198-l-uf-touraine-integree-au-championnat.html)) |
| V1-H5A | D5, National 2 | A | 14 | US Colomiers ; FC Bassin Arcachon ; FC Blagnac ; FC Chamalières ; Pau FC 2 ; FCE Mérignac Arlac ; Genêts Anglet ; Onet-le-Château Foot ; Rodez AF 2 ; SAG Cestas ; Toulouse FC 2 ; Trélissac Antonne Périgord FC ; US Castanet ; US Lège-Cap-Ferret ([composition publiée du N2](https://www.foot-national.com/actus/national-2-la-composition-des-huit-groupes-de-la-saison-2026-2027-950029)) |
| V1-H5B | D5, National 2 | B | 14 | AS Panazol ; Avoine Olympique Chinon Cinais ; Challans FC 85 ; FC Nantes 2 ; AS La Châtaigneraie ; Le Mans FC 2 ; Sablé FC ; Les Sables VF ; US Saint-Philbert-de-Grand-Lieu ; Stade Lavallois 2 ; US Alençonnaise 61 ; US Chauvigny ; Vendée Fontenay Foot ; USSA Vertou ([composition publiée du N2](https://www.foot-national.com/actus/national-2-la-composition-des-huit-groupes-de-la-saison-2026-2027-950029)) |
| V1-H5C | D5, National 2 | C | 14 | AF Virois ; AS Saint-Brieuc Ginglin Cesson ; AS Vitré ; ASPTT Caen ; EA Guingamp 2 ; FC Saint-Lô Manche ; Saint-Pierre de Milizac ; Lannion FC ; OC Cesson ; TA Rennes ; SM Caen 2 ; Stade Brestois 2 ; Stade Rennais 2 ; Vannes OC ([composition publiée du N2](https://www.foot-national.com/actus/national-2-la-composition-des-huit-groupes-de-la-saison-2026-2027-950029)) |
| V1-H5D | D5, National 2 | D | 14 | AS Steenvoorde ; AS Trouville Deauville ; C'Chartres Football ; CMS Oissel ; Croix Football IC ; FC Balagne ; FC Versailles 2 ; LOSC Lille 2 ; Olympique Saint-Quentin ; Red Star FC 2 ; AS Saint-Ouen-l'Aumône ; SC Bastia 2 ; Saint-Amand FC ; US Vimy ([composition publiée du N2](https://www.foot-national.com/actus/national-2-la-composition-des-huit-groupes-de-la-saison-2026-2027-950029)) |
| V1-H5E | D5, National 2 | E | 14 | AS Nancy Lorraine 2 ; FCM Aubervilliers ; ASM Belfort ; Charleville Prix OAM ; FC Metz 2 ; FC Mulhouse ; FC Sochaux-Montbéliard 2 ; US Ivry Football ; JA Drancy ; Metz APM ; SFC Neuilly-sur-Marne ; RC Strasbourg Alsace 2 ; ES Thaon ; US Torcy PVM ([composition publiée du N2](https://www.foot-national.com/actus/national-2-la-composition-des-huit-groupes-de-la-saison-2026-2027-950029)) |
| V1-H5F | D5, National 2 | F | 14 | ASPTT Dijon ; CA Pontarlier ; Dijon FCO 2 ; FC Annecy 2 ; FC Bourgoin-Jallieu ; FC Chalon ; FC Vesoul ; Is/Selongey Foot ; Jura Dolois Football ; Mâcon 71 ; Olympique Lyonnais 2 ; Racing Besançon ; Thonon Évian Grand Genève FC ; US Feurs ([composition publiée du N2](https://www.foot-national.com/actus/national-2-la-composition-des-huit-groupes-de-la-saison-2026-2027-950029)) |
| V1-H5G | D5, National 2 | G | 14 | AS Saint-Étienne 2 ; Stade Beaucairois 30 ; ES Cannet Rocheville ; Entente Sportive Fosséenne ; FC Espaly ; FC Rousset Sainte-Victoire ; Gallia Lucciana ; Montpellier Atlas Paillade ; Montpellier HSC 2 ; Olympique Alès-en-Cévennes ; Olympique de Marseille 2 ; Riviera FC ; SC Berre ; US Mandelieu Napoule Football ([composition publiée du N2](https://www.foot-national.com/actus/national-2-la-composition-des-huit-groupes-de-la-saison-2026-2027-950029)) |
| V1-H5H | D5, National 2 | H | 13 | AJ Auxerre 2 ; Blois Foot 41 ; La Berrichonne de Châteauroux 2 ; ESA Linas Montlhéry ; FC Saint-Jean-le-Blanc ; CS Brétigny ; GFC Ajaccio ; Paris FC 2 ; Sologne Foot Romorantin 41 ; Sainte-Geneviève FC ; US Orléans 2 ; USC Corte ; Vierzon FC ([composition initiale](https://www.foot-national.com/actus/national-2-la-composition-des-huit-groupes-de-la-saison-2026-2027-950029), corrigée par la [décision FFF retirant l'UF Touraine du groupe](https://www.fff.fr/article/17198-l-uf-touraine-integree-au-championnat.html)) |

Les lots masculins représentent 214 inscriptions d'équipes seniors : 18 + 18 + 18 + 49 + 111, calculées à partir des listes ci-dessus ([Ligue 1](https://ligue1.com/en/competitions/ligue1mcdonalds/standings), [Ligue 2](https://www.asse.fr/en/club/saison-2026-2027/classement-ligue-2-bkt/), [Ligue 3](https://www.liguesdefoot.fr/en/championnats/2026-2027/national/ligue-3/), [N1](https://www.foot-national.com/actus/national-1-la-composition-des-trois-groupes-de-la-saison-2026-2027-950026), [N2](https://www.foot-national.com/actus/national-2-la-composition-des-huit-groupes-de-la-saison-2026-2027-950029), [correction FFF](https://www.fff.fr/article/17198-l-uf-touraine-integree-au-championnat.html)). Ce ne sont pas 214 organisations distinctes : certaines lignes comprennent les réserves d'un même club.

### Catalogue senior féminin

| Code de lot | Division | Groupe | Nombre | Équipes |
|---|---|---|---:|---|
| V1-F1 | D1, Première Ligue | Unique | 12 | OL Lyonnes ; Paris Saint-Germain ; Paris FC ; FC Fleury 91 ; Montpellier HSC ; FC Nantes ; Le Havre AC ; Olympique de Marseille ; Toulouse FC ; RC Strasbourg Alsace ; US Saint-Malo ; RC Lens ([clubs engagés en Première Ligue](https://radiosports.fr/arkema-premiere-ligue-calendrier-et-resultats.html)) |
| V1-F2 | D2, Seconde Ligue | Unique | 11 | AJ Auxerre ; Bourges FC ; AS Cannes ; Grenoble Foot ; Le Mans FC ; LOSC Lille ; FC Metz ; OGC Nice ; Roubaix Wervicq ; AS Saint-Étienne ; Thonon Évian Grand Genève FC ([participants de Seconde Ligue](https://en.wikipedia.org/wiki/2026%E2%80%9327_Seconde_Ligue), recoupés avec le [classement publié par l'ASSE](https://www.asse.fr/en/feminines/saison-2026-2027/seconde-ligue/classement)) |
| V1-F3A | D3 Féminine | A | 12 | AAS Sarcelles ; CPB Bréquigny Rennes ; En Avant Guingamp ; ESOF Vendée La Roche-sur-Yon ; FC Lorient ; FC Rouen 1899 ; Orvault SF ; Quevilly Rouen Métropole ; Saint-Georges Guyonnière FC ; SM Caen ; Stade Rennais FC ; VGA Saint-Maur ([groupes de D3 Féminine](https://www.foot-national.com/foot-feminin/division-3-feminine-les-groupes-de-la-saison-2026-2027-951039)) |
| V1-F3B | D3 Féminine | B | 12 | Albi Marssac TF ; ALC Longvic ; Clermont Foot 63 ; ESTAC Troyes ; FC Girondins de Bordeaux ; FC Rousset Sainte-Victoire ; Le Puy-en-Velay FC ; Montauban FC TG ; Montpellier HSC 2 ; Olympique de Marseille 2 ; Olympique Lyonnais 2 ; Rodez Aveyron Football ([groupes de D3 Féminine](https://www.foot-national.com/foot-feminin/division-3-feminine-les-groupes-de-la-saison-2026-2027-951039)) |

Les lots féminins représentent 47 inscriptions d'équipes seniors, calculées sur les 12, 11 et 24 participants identifiés ; les réserves conservent leur rattachement à leur organisation ([Première Ligue](https://radiosports.fr/arkema-premiere-ligue-calendrier-et-resultats.html), [Seconde Ligue](https://en.wikipedia.org/wiki/2026%E2%80%9327_Seconde_Ligue), [D3 Féminine](https://www.foot-national.com/foot-feminin/division-3-feminine-les-groupes-de-la-saison-2026-2027-951039)). La forme historique « Olympique Lyonnais 2 » de la publication ne doit pas être transformée silencieusement en une nouvelle entité distincte d'OL Lyonnes : le rattachement juridique et l'affichage restent à valider dans les données.

### Catalogue de formation : National U17 masculin

| Code de lot | Compétition | Groupe | Nombre | Équipes |
|---|---|---|---:|---|
| V1-U17A | National U17 | A | 14 | Amiens SC ; CS Brétigny Football ; CS Mainvilliers ; Évreux FC 27 ; Le Havre AC ; FC Mantois 78 ; Montrouge FC 92 ; Paris FC ; Paris Saint-Germain ; Quevilly RM ; Racing Club de France ; SM Caen ; US Boulogne CO ; FC Versailles 78 ([groupes U17 2026-2027](https://www.foot-national.com/actus/u17-la-composition-des-groupes-pour-la-saison-2026-2027-951037)) |
| V1-U17B | National U17 | B | 14 | AAS Sarcelles ; Entente Feignies Aulnoye ; FC Metz ; JA Drancy ; Jeunesse Aubervilliers ; LOSC Lille ; Montfermeil FC ; ES Nanterre ; RC Joinville ; RC Lens ; Red Star FC ; US Thionville Lusitanos ; USL Dunkerque ; Valenciennes FC ([groupes U17](https://www.foot-national.com/actus/u17-la-composition-des-groupes-pour-la-saison-2026-2027-951037)) |
| V1-U17C | National U17 | C | 14 | AJ Auxerre ; AS Nancy Lorraine ; AS Strasbourg ; Chambéry Savoie Foot ; Dijon FCO ; ESTAC Troyes ; FC Chalonnais ; FC Annecy ; FC Lyon ; FC Sochaux-Montbéliard ; Grenoble Foot 38 ; Olympique Lyonnais ; RC Strasbourg Alsace ; US Torcy PVMF ([groupes U17](https://www.foot-national.com/actus/u17-la-composition-des-groupes-pour-la-saison-2026-2027-951037)) |
| V1-U17D | National U17 | D | 14 | AC Ajaccio ; AS Monaco ; AS Saint-Étienne ; AS Saint-Priest ; Cavigal Nice SF ; Clermont Foot 63 ; FC Villefranche Beaujolais ; GFC Ajaccio ; Istres FC ; Nîmes Olympique ; OGC Nice ; Olympique de Valence ; SC Aubagne Air Bel ; SC Bastia ([groupes U17](https://www.foot-national.com/actus/u17-la-composition-des-groupes-pour-la-saison-2026-2027-951037)) |
| V1-U17E | National U17 | E | 14 | Académie Univers Club ; AS Béziers ; Balma SC ; Burel FC ; FC Girondins de Bordeaux ; Gardanne Biver FC ; Jeunesse Villenavaise ; Montpellier HSC ; Olympique de Marseille ; Olympique Rovenain ; RCO Agde ; Rodez AF ; Toulouse FC ; UJS Toulouse ([groupes U17](https://www.foot-national.com/actus/u17-la-composition-des-groupes-pour-la-saison-2026-2027-951037)) |
| V1-U17F | National U17 | F | 14 | Angers SCO ; Blois Foot 41 ; EA Guingamp ; FC Lorient ; FC Nantes ; SO Cholet ; Stade Brestois 29 ; Stade Briochin ; Stade Rennais FC ; TA Rennes ; US Avranches MSM ; USJA Carquefou ; USSA Vertou ; Vendée FC La Roche ([groupes U17](https://www.foot-national.com/actus/u17-la-composition-des-groupes-pour-la-saison-2026-2027-951037)) |

### Catalogue de formation : National U19 masculin

| Code de lot | Compétition | Groupe | Nombre | Équipes |
|---|---|---|---:|---|
| V1-U19A | National U19 | A | 14 | Amiens SC ; C'Chartres Football ; FC Rouen 1899 ; Le Havre AC ; LOSC Lille ; Paris Saint-Germain ; Quevilly RM ; Racing Club de France ; RC Lens ; SM Caen ; US Orléans Loiret ; USL Dunkerque ; Valenciennes FC ; FC Versailles 78 ([groupes U19 2026-2027](https://www.foot-national.com/actus/u19-la-composition-des-groupes-pour-la-saison-2026-2027-951035)) |
| V1-U19B | National U19 | B | 14 | AJ Auxerre ; AS Nancy Lorraine ; CA Pontarlier ; Clermont Foot 63 ; Dijon FCO ; ESTAC Troyes ; FC Annecy ; FC Metz ; FC Sochaux-Montbéliard ; Montfermeil FC ; Olympique Lyonnais ; Paris FC ; RC Strasbourg Alsace ; Stade de Reims ([groupes U19](https://www.foot-national.com/actus/u19-la-composition-des-groupes-pour-la-saison-2026-2027-951035)) |
| V1-U19C | National U19 | C | 14 | Angers SCO ; EA Guingamp ; FC Lorient ; FC Nantes ; FC Saint-Lô Manche ; SA Mérignacais ; SC Beaucouzé ; Stade Brestois 29 ; Stade Briochin ; Stade Lavallois ; Stade Poitevin FC ; Stade Rennais FC ; TA Rennes ; USSA Vertou ([groupes U19](https://www.foot-national.com/actus/u19-la-composition-des-groupes-pour-la-saison-2026-2027-951035)) |
| V1-U19D | National U19 | D | 14 | AS Béziers ; AS Monaco ; AS Saint-Étienne ; Balma SC ; Cavigal Nice SF ; FC Borgo ; GFC Ajaccio ; Montpellier HSC ; OGC Nice ; Olympique de Marseille ; Olympique Rovenain ; SC Bastia ; US Cap d'Ail ; US Colomiers ([groupes U19](https://www.foot-national.com/actus/u19-la-composition-des-groupes-pour-la-saison-2026-2027-951035)) |

Les listes U17 et U19 totalisent respectivement 84 et 56 inscriptions ; leurs équipes appartiennent aux clubs cités, sans que toutes ces organisations disposent nécessairement d'une équipe première dans les cinq divisions seniors déjà intégrées ([composition U17](https://www.foot-national.com/actus/u17-la-composition-des-groupes-pour-la-saison-2026-2027-951037), [composition U19](https://www.foot-national.com/actus/u19-la-composition-des-groupes-pour-la-saison-2026-2027-951035)). Le périmètre des tableaux atteint ainsi 401 inscriptions d'équipes, pas 401 clubs uniques, par addition des lots seniors et jeunes ci-dessus.

### Ce qui reste hors du catalogue validé

- **Régional et district :** toujours prévus dans l'ambition générale, mais aucun faux catalogue réel ne sera inventé pour remplir la V1 ; une région pilote doit être auditée avant activation de sa carrière locale.
- **U15 et catégories plus jeunes :** le départ à 14 ans peut utiliser un prologue d'entraînement et de rencontres internes ; un championnat officiel U15 n'est activé qu'après validation de ses clubs et règles. L'inscription en U17 n'est pas automatique parce qu'un personnage a 14 ans.
- **Formation féminine :** compétitions et inscriptions à vérifier dans un lot distinct ; la présence des seniors féminines n'autorise pas à annoncer une filière complète à 14 ans déjà documentée.
- **Coupes :** Coupe de France, Gambardella et coupes féminines restent des modules à verrouiller, notamment parce que leurs plateaux peuvent inclure des équipes absentes des divisions jouables.
- **Étranger :** clubs et effectifs nécessaires au marché et aux compétitions internationales à auditer ; ne pas annoncer un marché mondial authentique tant que cette base n'existe pas.
- **Joueurs réels :** liste de clubs vérifiée ne signifie pas liste d'effectifs vérifiée. Les jeunes mineurs peuvent être générés, clairement identifiés comme fictifs, sans prétendre reproduire de vraies personnes.

Les PDF officiels de composition liés depuis la FFF n'ont pas pu être exploités directement lors de cette vérification. Les listes complètes s'appuient donc sur les publications détaillées citées, complétées par les corrections administratives FFF ; les identifiants d'affiliation et ultimes décisions d'engagement restent à contrôler avant import de production.

### Relier les équipes sans casser le monde

Le modèle de données doit distinguer l'organisation, sa section, son équipe et son inscription annuelle. Par exemple, une équipe première, une réserve et une équipe U19 ne possèdent pas trois trésoreries de clubs totalement indépendantes.

```text
Organisation
  → section masculine ou féminine, selon structure vérifiée
    → équipe première, réserve, U19, U17…
      → inscription à une compétition pour une saison
```

- **Identifiant stable :** utiliser un identifiant interne et conserver l'affiliation vérifiée comme référence ; ne pas fusionner automatiquement deux noms similaires.
- **Alias :** « QRM », « Quevilly RM » et « US Quevilly » doivent être rapprochés par validation d'identité, pas par un simple nettoyage de texte.
- **Réserve :** une promotion de l'équipe première ne déplace pas sa réserve automatiquement dans la même division.
- **Formation :** un passage U17 vers U19 est un mouvement d'effectif autorisé, pas un transfert payant entre clubs.
- **Féminin :** vérifier la structure d'organisation avant de partager budgets ou dirigeants avec une équipe masculine de nom proche.
- **Calendrier :** les exemptions sont des états officiels du calendrier, pas des matchs simulés contre une équipe fantôme.

## V1 : comment simuler un match

### La décision de conception

**Recommandation : un moteur spatial à agents et événements, observable d'abord en 2D, dont le résultat émerge des actions.** Il ne choisit jamais un score final pour fabriquer ensuite les occasions censées l'expliquer.

La V1 technique priorise la cohérence tactique, les temps forts interactifs et la simulation rapide. Le contrôle direct de type jeu d'action et la présentation 3D haut de gamme restent l'objectif du concept complet, mais ne doivent pas être confondus avec un simple changement d'habillage : ils exigent un chantier spécifique de commandes, animation, collisions et synchronisation.

Cette recommandation réduit le risque de construire un moteur statistique, un moteur de temps forts et un moteur d'action qui se contredisent. Elle ne signifie pas qu'un moteur 2D événementiel devient automatiquement un jeu de football 3D contrôlable.

### Ce qui existe à chaque instant

| État canonique | Données proposées | Pourquoi c'est nécessaire |
|---|---|---|
| Rencontre | Temps, score, période, compétition, contexte aller-retour | Les décisions dépendent de l'enjeu réel, pas seulement du score du soir |
| Ballon | Position, vitesse, hauteur simplifiée, dernier contact, contrôle ou trajectoire | Une passe et un ballon libre n'ont pas le même traitement |
| Joueurs | Position, vitesse, orientation simplifiée, rôle, intention, fatigue, statut disciplinaire | Permet de générer des espaces et des erreurs explicables |
| Équipes | Structure avec/sans ballon, largeur, hauteur, couverture, familiarité | Les consignes changent les comportements collectifs |
| Phases | Construction, progression, création, finition, transition, arrêt de jeu | Évite de produire uniquement des tirs sans construction |
| Règles | Remplacements, hors-jeu, fautes, reprises et éventuelle assistance vidéo | Une animation ne peut pas décider si un joueur est éligible |
| Connaissance | Observation locale et rapports de staff | L'IA ne connaît ni les intentions adverses futures ni tous les attributs cachés |
| Hasard | Flux de tirages et curseur de simulation enregistrés | Reproduire un problème sans relancer arbitrairement l'issue |

### La boucle de simulation

Le prototype peut commencer par un pas tactique de 0,5 seconde et une intégration de mouvement plus fine, par exemple 0,1 seconde pendant une action. Ces valeurs sont des choix d'ingénierie à profiler, pas des fréquences validées ni une promesse de précision physique.

```text
tant que la rencontre n'est pas terminée :
    appliquer les commandes autorisées et arrivées à échéance
    mettre à jour phase, organisation et observations
    générer les intentions des agents à leur rythme de décision
    coordonner les responsabilités collectives
    sélectionner une action admissible pour le porteur
    faire évoluer déplacements et trajectoires
    résoudre contacts, contrôle, interceptions et décisions arbitrales
    mettre à jour charge, score, sanctions et temps effectif
    enregistrer les événements canoniques et les images utiles
    s'arrêter si une décision utilisateur pertinente est requise
```

Les décisions et exécutions sont séparées : avoir vu une bonne passe ne garantit pas de la réussir. Un déplacement commencé ne peut pas être annulé instantanément sans coût de réorientation.

### Les phases qui produisent le football

| Phase | Question du moteur | Exemples d'actions |
|---|---|---|
| Relance | Comment sortir face à la pression présente ? | Passe courte, appui, renversement, jeu long, conservation |
| Progression | Comment gagner de l'espace sans perdre l'équilibre ? | Conduite, passe entre lignes, troisième homme, changement de côté |
| Création | Comment libérer une situation de tir ? | Appel, fixation, centre, combinaison, dédoublement |
| Finition | Le tir est-il accessible et préférable ? | Tir, passe supplémentaire, contrôle, protection |
| Transition offensive | Faut-il accélérer ou sécuriser ? | Contre, soutien, temporisation |
| Transition défensive | Qui presse, qui couvre et qui protège la profondeur ? | Contre-pressing, ralentissement, repli |
| Défense placée | Quelle menace devient prioritaire ? | Coulissement, couverture, duel, marquage de zone |
| Coup de pied arrêté | Quelle organisation et quelle deuxième balle ? | Course, écran légal, dégagement, conservation de couverture |

### Choisir une action : une utilité contextuelle

Le porteur compare un ensemble borné d'actions plausibles selon ce qu'il perçoit. L'évaluation peut combiner progression attendue, conservation, création de danger, consigne, énergie et risque d'exposer son équipe.

```text
utilité(action)
  = valeur de progression et de création
  + adéquation au rôle et aux consignes comprises
  + préférence individuelle contextualisée
  - risque estimé de perte et de contre
  - coût physique et difficulté perçue
```

Une sélection probabiliste pondérée laisse varier les choix sans les rendre arbitraires. Les coefficients sont calibrés ; aucune formule finale n'est prétendue « réaliste » avant observation et validation.

- **Vision :** réduit certaines informations manquées, sans lire tout le terrain parfaitement.
- **Décision :** améliore l'estimation comparative, sans imposer toujours la même passe optimale.
- **Technique :** agit principalement sur l'exécution, pas sur la connaissance de toutes les solutions.
- **Personnalité sportive :** influence les préférences dans un contexte, pas un multiplicateur universel de réussite.
- **Consigne :** oriente la prise de risque, mais ne transforme pas un joueur en marionnette.
- **Fatigue :** modifie des capacités et la répétition d'efforts ; éviter de pénaliser deux fois la même cause par plusieurs multiplicateurs globaux.

### Réussir une passe, un contrôle ou un duel

La qualité d'exécution dépend de la difficulté présente : distance, angle, vitesse, pression, pied utilisé, équilibre, espace et compétence spécifique. Le modèle doit être calibré sur des événements comparables, pas seulement sur le pourcentage global de passes réussies.

Une approche simple pour le prototype est une probabilité bornée obtenue à partir d'un score de difficulté et de compétence, puis une résolution spatiale de l'erreur. L'intercepteur doit avoir le temps d'atteindre le ballon ; il ne reçoit pas magiquement la possession parce que le tirage « passe ratée » est tombé.

- **Passe :** déterminer cible, trajectoire et erreur d'exécution, puis tester les possibilités réelles d'interception.
- **Contrôle :** traiter direction du premier contact, ballon conservé ou remis en jeu, pas uniquement succès/échec.
- **Dribble :** engagement, lecture du défenseur, espace de sortie et couverture éventuelle.
- **Duel :** vitesse relative, équilibre, position et engagement ; une faute est une issue possible, pas une conclusion systématique.
- **Ballon aérien :** zone de chute, course d'approche et contestation ; taille seule insuffisante.
- **Deuxième ballon :** nouvelle situation ouverte issue de la trajectoire et des placements.

### Les tirs et les xG

Le moteur crée d'abord la situation et le tir ; il ne distribue pas des « points de xG » pour atteindre un total prévu. Un estimateur de danger calcule ensuite une probabilité à partir de la situation connue avant le tir.

Pour la V1, distinguer deux objets : un indicateur de xG pré-tir, destiné au bilan, et un modèle de résolution qui peut tenir compte de l'exécution du tireur et de la réaction du gardien. Les deux doivent être reliés par calibration, pas artificiellement rendus identiques.

- **Géométrie :** distance, angle, position du gardien et défenseurs interposés.
- **Contexte :** type de passe, contrôle préalable, pression, équilibre et partie du corps.
- **Compétence :** effet borné et spécifique ; pas de conversion garantie parce qu'un attaquant est réputé.
- **Résolution :** tir bloqué, non cadré ou cadré, puis arrêt, but, rebond ou autre issue cohérente ; les probabilités de chaque étape doivent être normalisées.
- **Rebond :** conserver une trajectoire et une phase de jeu ; pas de nouveau tir offert sans placement favorable.
- **Lecture :** un total d'occasions élevé n'est pas une dette de buts que le moteur doit rembourser avant le coup de sifflet.

Exemple entièrement fictif : une occasion évaluée à 0,18 xG peut ne pas être marquée et une autre à 0,03 peut l'être. Ces valeurs illustrent l'incertitude, pas des probabilités validées pour une situation réelle précise.

### Défendre et se déplacer sans ballon

Les onze joueurs n'essaient pas tous de maximiser indépendamment le même indicateur : il faut une coordination des responsabilités. Sinon, tous convergent vers le ballon ou abandonnent la profondeur.

Une couche collective attribue temporairement pression, couverture, surveillance et protection de zone ; les agents choisissent ensuite leur déplacement sous ces contraintes. Une mauvaise coordination peut exister, mais elle doit être issue d'automatismes insuffisants, d'une transition ou d'une décision, pas d'une désactivation artificielle de l'IA.

### Fatigue et blessures

Séparer énergie disponible pendant le match, charge de travail, fraîcheur entre matchs et éventuelle gêne. Une barre unique de « condition » peut rester un résumé d'interface, mais ne suffit pas comme modèle.

Le risque d'incident est évalué par exposition ou contact, avec intensité, antécédents et contexte pertinents ; il n'existe pas de quota de blessés par rencontre. Le profil des incidents doit être vérifié sur de nombreux matchs et saisons avant tout discours de fidélité médicale.

### Arbitrage et temps de jeu

Le règlement résout hors-jeu, sorties, reprises et situations disciplinaires ; une couche d'observation arbitrale peut introduire une erreur bornée. Les erreurs ne ciblent jamais le score ou l'utilisateur.

Le temps additionnel doit découler des interruptions retenues par le modèle. Le moteur ne prolonge pas secrètement le match jusqu'à ce qu'un favori marque.

### Même rencontre, plusieurs vitesses

| Format V1 proposé | Résolution | Intervention |
|---|---|---|
| Intégral tactique | Moteur spatial complet ; rendu 2D | Consignes et remplacements aux moments autorisés |
| Essentiel | Même moteur, accéléré hors séquences retenues | Arrêts aux événements choisis |
| Temps forts à décisions | Même état jusqu'à la scène ; reprise après choix | Décision située du joueur ou du manager |
| Simulation interactive | Progression accélérée et tableau de bord | Pause ou intervention à tout instant autorisé |
| Résultat rapide local | Même résolution canonique, sans rendu ni interruptions | Plan préparé et délégation au staff |
| Championnats de contexte | Modèle agrégé documenté | Pas de promesse d'équivalence action par action |

**Choix recommandé : utiliser le même moteur sans affichage pour la simulation rapide des compétitions actives.** Le gain initial vient de la suppression du rendu et des pauses ; si les performances exigent ensuite un moteur agrégé, son introduction doit être explicitement versionnée et testée.

### Temps forts interactifs sans résultat écrit d'avance

La sélection d'un arrêt jouable ne peut utiliser que les informations disponibles au moment où le jeu s'arrête : occasion en développement, transition, duel ou consigne pertinente. Elle ne sait pas encore si l'action finira en but.

Une séquence historique déjà résolue peut être montrée en replay ; une séquence interactive doit reprendre la simulation avant sa résolution et invalider tout futur pré-calculé au-delà de ce point. Cela évite d'inviter le joueur à agir dans une scène dont le résultat resterait imposé.

Le curseur aléatoire et l'état sont conservés au changement de format. Une modification d'action peut naturellement entraîner une trajectoire et des tirages ultérieurs différents ; le moteur ne doit pas prétendre conserver un futur identique après une vraie intervention.

## V1 : les décisions qui changent vraiment un match

### Principes

Une décision intéressante oppose au moins deux avantages incompatibles dans le contexte. « Presser davantage » ne peut pas être une amélioration gratuite ; cela doit avoir un coût d'effort, d'organisation ou d'espace.

Les informations sont incomplètes et les conséquences probables restent présentées sans faux pourcentage de réussite. L'adjoint peut expliquer une hypothèse et signaler son incertitude ; il ne doit pas afficher la solution certaine.

### Avant la rencontre : manager

| Décision | Alternatives utiles | Conséquence attendue et contrepartie |
|---|---|---|
| Composition | Forme actuelle, compétence de rôle, fraîcheur, automatismes | Choisir un nom prestigieux peut réduire l'équilibre ou augmenter la fatigue |
| Structure | Avec ballon et sans ballon, puis transitions | Une meilleure présence offensive peut exposer la perte |
| Relance | Courte, mixte, plus directe | Conservation et qualité de sortie contre pression et risque de duel |
| Hauteur du bloc | Haut, médian, bas | Zone de récupération contre espace laissé derrière ou devant |
| Pressing | Déclencheurs précis et intensité | Récupérations possibles contre fatigue et élimination du premier rideau |
| Largeur | Étirer, équilibrer ou densifier | Accès aux côtés contre protection axiale et distances de soutien |
| Couverture | Nombre et profils laissés en sécurité | Soutien offensif contre vulnérabilité au contre |
| Attaque de surface | Centres, passes en retrait, combinaisons, profondeur | Dépend du profil disponible et du comportement adverse |
| Coups de pied arrêtés | Routine, cibles et couverture | Présence devant le but contre protection à la perte |
| Plan de gestion | Minutes prévues, seuils de remplacement, scénario si expulsion | Anticipation contre rigidité d'un plan mal adapté |

L'écran de préparation ne demande pas dix validations obligatoires : trois intentions principales suffisent en mode essentiel. Les réglages experts restent disponibles et le staff peut proposer un plan motivé.

### Avant la rencontre : carrière joueur

- **Comprendre son rôle :** demander quelle zone protéger ou quel espace attaquer plutôt que réclamer seulement une meilleure note.
- **Signaler une gêne :** information transmise au staff ; sélection et charge réévaluées, sans punition morale automatique.
- **Préparation :** travail léger d'un thème ou priorité à la récupération, sous contraintes du programme.
- **Risque individuel :** clarifier si l'entraîneur attend de la sécurité ou de l'initiative dans certaines zones.
- **Statut :** demander un entretien sur le temps de jeu, sans garantir une place ni déplacer immédiatement le titulaire.

### Pendant la rencontre : carrière joueur

La V1 à décisions propose des fenêtres rares, situées et courtes. Elles portent sur des actions accessibles au poste et à la situation ; leur nombre ne doit pas dépendre du besoin d'occuper artificiellement l'utilisateur.

| Situation fictive | Options proposées | Arbitrage |
|---|---|---|
| Réception dos au jeu sous pression | Remiser, protéger, se retourner si l'espace existe | Sécurité collective contre capacité à éliminer une ligne |
| Contre en supériorité | Fixer et donner, conduire, tenter une frappe accessible | Qualité de dernière passe contre fermeture progressive de l'espace |
| Latéral face à un ailier rapide | Contenir, orienter, tenter l'intervention | Temps donné au soutien contre risque d'être débordé |
| Milieu au début d'une transition défensive | Presser le porteur, fermer la passe, protéger l'axe | Récupération immédiate contre couverture |
| Attaquant sur un centre annoncé | Premier poteau, second, retrait ou fixation | Complémentarité avec les courses déjà engagées |
| Gardien sur ballon profond | Sortir, temporiser, rester selon distance accessible | Interception contre exposition du but |
| Joueur averti dans un duel | Accompagner, passer le relais, intervenir si nécessaire | Menace adverse contre risque disciplinaire |
| Fin de match avec gêne signalée | Alerter le banc, réduire les efforts demandés si consigne possible | État physique et organisation ; pas « courage = bonus caché » |

Les options indisponibles ne sont pas proposées. Un joueur ne peut ni se téléporter dans une ligne de passe ni garantir la réussite d'un dribble parce qu'il a choisi le bouton correspondant.

### Pendant la rencontre : manager

| Observation | Choix possibles | Risque à ne pas masquer |
|---|---|---|
| Relance étouffée | Appui supplémentaire, jeu plus direct, largeur différente | Déplacement des pertes et baisse possible de contrôle territorial |
| Adversaire qui surcharge un côté | Coulisser, aider avec l'ailier, changer le marquage | Zone libérée ailleurs |
| Beaucoup de possession sans danger | Courses supplémentaires, occupation différente, rythme ajusté | Plus de pertes si les profils ne suivent pas |
| Ligne défensive attaquée dans le dos | Reculer, réduire la pression désordonnée, adapter la couverture | L'adversaire peut gagner du terrain |
| Milieu dépassé | Modifier le rôle, ajouter un soutien, remplacer | Changement d'automatismes ou retrait d'un apport offensif |
| Joueur fatigué | Remplacer, changer sa tâche, baisser l'intensité collective | Coût d'un remplacement et exposition d'un autre secteur |
| Expulsion | Réorganiser, maintenir une menace, choisir où accepter l'infériorité | Aucun système ne supprime le joueur manquant |
| Avantage fragile | Conserver le ballon, défendre plus bas, garder une sortie de contre | Un bloc plus bas peut augmenter la pression subie |
| Déficit en fin de match | Augmenter la présence, simplifier, engager un profil différent | Davantage de vulnérabilité et de variance |

Une consigne est effective lorsqu'elle est transmise et assimilée, pas nécessairement au clic exact. Les changements les plus simples agissent plus vite que les réorganisations qui nécessitent plusieurs joueurs.

### Les remplacements : un rôle, pas un bonus d'entrée

Le remplaçant apporte ses capacités, sa fraîcheur et son adaptation au rôle. Il n'obtient pas automatiquement un bonus de but parce que l'utilisateur vient de le faire entrer.

L'interface montre ce qui change : occupation des zones, pied de sortie, couverture, jeu aérien et disponibilité pour la suite. Elle distingue les limites réglementaires de remplacement des préférences du staff.

### La mi-temps : trois gestes maximum en mode essentiel

- **Lire :** choisir un constat utile parmi ceux que le staff peut soutenir par les séquences observées.
- **Adapter :** une ou deux modifications cohérentes ; toutes les commandes expertes restent accessibles.
- **Communiquer :** préciser les attentes sans transformer la causerie en sortilège de performance.

Une intervention encourageante peut améliorer la clarté ou réduire une tension, mais ne donne pas « +10 à tous les attributs ». Des paroles contradictoires avec les faits peuvent être moins crédibles sans casser arbitrairement tout le vestiaire.

### Après la rencontre : transformer le match en carrière

| Décision | Effet recherché | Limite |
|---|---|---|
| Analyse vidéo | Comprendre une séquence et préparer un thème | Ne corrige pas instantanément une faiblesse |
| Récupération | Réévaluer charge et disponibilité | N'efface pas l'effort déjà fourni |
| Retour individuel | Clarifier une tâche et la suite | Un seul match ne définit pas tout le potentiel |
| Gestion médiatique | Choisir ce qui mérite une prise de parole | Réponse facultative dans les cas ordinaires |
| Plan de progression | Préparer des situations d'entraînement | Gain non garanti et non immédiat |
| Hiérarchie | Ajuster progressivement la confiance et le rôle | Pas de rotation automatique à chaque note médiocre |

### Les décisions économiques autour du match

Le manager peut aussi arbitrer une rotation en vue d'un calendrier chargé, une exposition d'un jeune, un besoin de résultat et une clause contractuelle. L'IA doit toutefois éviter qu'une prime ou un intérêt financier provoque systématiquement une décision sportivement absurde.

La carrière joueur voit ces contraintes par des explications plausibles, pas par l'accès omniscient aux comptes et intentions privées. Comprendre partiellement une décision fait partie du réalisme ; subir une décision sans aucun signal répétitivement n'est pas une bonne expérience.

## V1 : rendre l'IA adverse crédible

### Un adversaire avec un plan et des limites

Chaque entraîneur prépare un plan adapté à son effectif et à une estimation de l'adversaire. Il ne lit pas les commandes cachées de l'utilisateur avant leur manifestation sur le terrain.

Les adaptations se fondent sur des observations accumulées et une confiance suffisante dans le diagnostic. Un but contre le cours d'un match n'entraîne pas automatiquement un changement de système immédiat.

- **Identité :** préférences de relance, organisation, prise de risque et profils recherchés.
- **Pragmatisme :** adaptation à une absence ou à un adversaire sans abandonner toute cohérence.
- **Observation :** fréquence et précision dépendantes des moyens et compétences disponibles.
- **Réaction :** modification limitée et évaluée après un délai, pas une nouvelle tactique toutes les trente secondes.
- **Erreurs :** diagnostic imparfait possible, sans bêtise forcée pour aider l'utilisateur.
- **Apprentissage borné :** repérer une tendance sur plusieurs rencontres, pas connaître l'issue d'un choix encore non effectué.

### Difficulté

La difficulté peut modifier l'aide disponible, la finesse des diagnostics IA et la vitesse d'adaptation à l'intérieur de bornes crédibles. Elle ne doit pas augmenter secrètement la vitesse physique des joueurs adverses ou diminuer celle de l'utilisateur.

Le réalisme réglementaire, le détail des menus et le défi sportif doivent être trois réglages séparés. Une interface simplifiée ne doit pas rendre artificiellement les adversaires moins intelligents.

## V1 : un exemple de décision de match

### Situation entièrement fictive

À la 61e minute, Amiens et Rouen sont à 1-1 dans une rencontre de démonstration. Les noms servent uniquement à illustrer les mécaniques ; aucune tactique ni force réelle des deux clubs n'est affirmée.

Le rapport disponible indique plusieurs réceptions adverses derrière le milieu droit et des pertes d'Amiens en relance. L'utilisateur n'a pas besoin d'ouvrir dix tableaux : deux séquences et une phrase du staff suffisent à montrer le problème.

| Choix | Effet recherché | Contrepartie |
|---|---|---|
| Faire redescendre l'ailier | Aider le latéral et fermer une ligne de passe | Moins de présence haute à la récupération |
| Passer à trois milieux | Densifier la zone et proposer un relais | Modifier le rôle d'un offensif et ses automatismes |
| Jouer plus directement | Éviter certaines pertes près du but | Augmenter les duels et diminuer la maîtrise de possession |

Le joueur choisit de faire redescendre l'ailier et de préparer un remplacement au milieu. Les agents modifient leurs responsabilités ; le moteur ne déclenche ni égalisation adverse ni victoire d'Amiens pour « valider » le choix.

Dans une issue possible, le côté est mieux couvert mais les sorties deviennent plus difficiles. L'utilisateur doit alors décider de conserver cette sécurité ou de réintroduire une menace : la décision précédente a changé le problème, pas fermé l'histoire.

## V1 : calibration, intégrité et tests de simulation

### Ce qu'il faut mesurer

Les distributions de référence doivent être construites à partir de données autorisées et adaptées au niveau, au genre, à l'âge et à la compétition. Aucun objectif universel de possession, nombre de buts ou taux de passe ne peut servir seul à valider toutes les divisions de cette V1.

| Dimension | Vérification proposée |
|---|---|
| Score | Distribution des buts, nuls, écarts et scores rares ; pas seulement moyenne |
| Occasions | Volume, géométrie, origine, qualité et séquences menant aux tirs |
| Construction | Zones de circulation, pertes sous pression et progression |
| Défense | Interceptions, duels, couvertures et transitions subies |
| Discipline | Fautes et sanctions par contexte, pas quota fixe |
| Physique | Efforts, charge, substitutions et disponibilité cumulée |
| Styles | Deux équipes différentes doivent créer des profils de match distincts |
| Compétitions | Les niveaux et formats sont calibrés séparément sans caricature « amateur = erreurs à chaque action » |

### Tests indispensables

- **Reproductibilité :** sur une même version et une même cible d'exécution déterministe, état initial, réglages et séquence de commandes identiques produisent les mêmes événements canoniques ; l'équivalence entre plateformes doit être testée séparément.
- **Indépendance de l'affichage :** une caméra, un résumé ou la vitesse visuelle ne changent pas la simulation.
- **Permutation :** échanger équipes, maillots et identifiants ne crée pas de faveur cachée ; avantage domicile désactivé pour ce test.
- **Joueurs symétriques :** deux équipes strictement identiques ne doivent pas avantager systématiquement le premier identifiant.
- **Intervention :** une modification d'intensité change les comportements visés sans imposer une victoire ; comparaison sur de nombreuses graines.
- **Robustesse :** pas de formation gagnante dans tous les contextes par simple exploitation des agents.
- **Ablation :** désactiver une variable mesure son effet ; cela repère les coefficients dominants et les pénalisations doublonnées.
- **Contraintes :** expulsion, blessure sans remplacement disponible, effectif réduit, prolongation et tirs au but restent cohérents.
- **Frontières :** un passage de mode ne restaure pas l'énergie, ne crée pas une nouvelle possession et ne rejoue pas un événement acquis.
- **Contenu :** le N1 groupe C à 17 et le N2 groupe H à 13 génèrent des calendriers valides, avec exemptions et conséquences réglementaires.

### Budget de tests proposé

Commencer par des scénarios unitaires de quelques secondes, puis des lots d'au moins 10 000 rencontres pour comparer les grandes distributions. Ce volume est une recommandation de test initiale et ne garantit pas à lui seul la fiabilité des événements rares.

Les seuils statistiques doivent être fixés avant la validation, avec intervalles d'incertitude et correction des comparaisons multiples si nécessaire. Une belle vidéo de match ne prouve ni la calibration ni l'absence d'exploit.

### Politique de mise à jour

Un changement de moteur reçoit une version et un journal des effets attendus. Il ne réécrit pas les résultats déjà joués et ne modifie pas silencieusement l'équilibre d'une sauvegarde longue.

Une correction critique de règles doit préciser la saison d'application et le traitement des sauvegardes en cours. La base de contenu et le moteur sont versionnés séparément pour isoler un mauvais effectif d'un défaut de simulation.

## V1 : choix recommandés pour avancer

| Sujet | Choix recommandé | Motif |
|---|---|---|
| Premier lot réel | France, catalogue détaillé ci-dessus | Une pyramide profonde vaut mieux qu'un monde superficiel |
| Prototype moteur | Quelques équipes de test aux profils synthétiques, puis clubs réels sans notes inventées | Évaluer les mécanismes avant de prétendre reproduire leur force réelle |
| Présentation initiale | Vue tactique 2D lisible | Voir et diagnostiquer les causes |
| Match canonique | Spatial, agents, événements, trajectoires simplifiées | Produire des actions plutôt qu'habiller un score |
| Simulation rapide active | Même moteur sans rendu | Limiter les divergences de résultats et de conséquences |
| Interactivité initiale | Consignes manager et fenêtres de décisions joueur | Créer des arbitrages avant le chantier complet du contrôle d'action |
| Hasard | Borné, enregistré et dépendant du contexte | Variété sans scénarisation punitive |
| Attributs | Spécifiques au rôle et évaluations incertaines | Éviter que la note globale décide de tout |
| Coaching | Trois intentions principales en mode essentiel | Profondeur sans surcharge |
| Score | Jamais fixé avant le match | Résultat émergent |
| Données non vérifiées | Mention explicite, blocage d'import ou contenu synthétique identifié | Ne pas vendre une précision inexistante |
| Licences | Dossier séparé du catalogue | Ne pas confondre connaître un nom et disposer de ses droits |

Le premier livrable jouable doit démontrer trois choses : des styles distincts, des choix compréhensibles et des conséquences persistantes. Le catalogue de 401 inscriptions devient pertinent quand ce noyau fonctionne ; il ne doit pas masquer un moteur qui ne sait pas encore produire un match crédible.

## V1 : joueurs réels et effectifs

### Ce qui est ajouté, et ce qui ne peut pas être promis

L'annexe `generation-football-effectifs-v1.md` prolonge le catalogue équipe par équipe. Elle donne les noms publiés pour la saison 2026-2027, leurs postes et numéros lorsqu'ils sont indiqués, ainsi que les sources et réserves ; les champs non établis restent `n.a.`.

Par exemple, la page masculine du PSG rattache Achraf Hakimi, Ousmane Dembélé, Vitinha et Warren Zaïre-Emery à l'effectif 2026-2027, avec leurs numéros et rubriques de postes ([PSG, effectif masculin 2026-2027](https://www.psg.fr/football-masculin/effectif/season/2026-27)). La source conserve aussi le nom incomplet « Ferran » ; l'annexe ne lui ajoute donc pas un nom de famille supposé ([PSG, liste publiée](https://www.psg.fr/football-masculin/effectif/season/2026-27)).

Il faut distinguer une liste publiée d'un effectif administratif certifié. Une page d'effectif ne prouve pas, à elle seule, une licence valide, une présence au club le jour du lancement, un contrat actuel ou l'éligibilité à la compétition.

Le fichier `generation-football-joueurs-v1.csv` est une table de collecte pour la préparation du contenu, pas une base prête à injecter sans contrôle. Son champ `import_autorise` est initialisé à `false` : même une bonne source doit encore passer les contrôles d'identité, d'affectation, de date, de droits et de cohérence sportive.

### Bilan de cette collecte

Le décompte éditorial de l'annexe porte sur les 401 inscriptions du catalogue. Il retient 112 listes publiées et 28 listes de noms partiels, soit 3 065 occurrences équipe–nom ; 46 autres listes sont mises en quarantaine et 215 effectifs restent non établis.

| Catégorie | Inscriptions | Listes publiées retenues | Noms partiels | Quarantaine | Non établis |
|---|---:|---:|---:|---:|---:|
| Seniors masculins | 214 | 77 | 18 | 39 | 80 |
| Seniors féminines | 47 | 24 | 6 | 5 | 12 |
| U17 masculins | 84 | 2 | 3 | 1 | 78 |
| U19 masculins | 56 | 9 | 1 | 1 | 45 |
| Total | 401 | 112 | 28 | 46 | 215 |

Ces chiffres mesurent la couverture du livrable, pas un nombre de joueurs uniques ni une certification de présence. La couverture reste particulièrement incomplète chez les jeunes et dans les divisions moins documentées ; les noms écartés sont conservés pour audit dans le CSV et ne sont pas comptés dans les 3 065 occurrences retenues.

### Niveaux de confiance obligatoires

| État de collecte | Ce que cela signifie | Traitement dans le jeu |
|---|---|---|
| Liste publiée retenue | Effectif rattaché à la saison recherchée, sans contradiction majeure détectée dans la collecte | Base de travail ; contrôler individuellement les affectations avant validation |
| Noms partiels | Article de recrutement, feuille de résultats ou liste trop courte pour constituer un effectif | Ne pas présenter comme un groupe complet ; compléter et recouper |
| Quarantaine | Saison contradictoire, liste historique trop large, prêt non résolu ou anomalie importante | Aucun import automatique ; conserver la trace pour correction |
| Non établi | Aucune liste exploitable obtenue pour cette équipe et cette saison | Afficher `n.a.` ; ne pas inventer les vrais noms manquants |

Le statut qualifie la collecte, pas la personne. Deux sources qui donnent le même nom ne constituent pas forcément deux confirmations indépendantes ; une page qui reprend une autre page peut reproduire la même erreur.

### Une inscription d'équipe n'est pas un club, et un nom n'est pas une identité

- **Club :** entité sportive qui peut posséder une équipe première masculine, une féminine, plusieurs réserves et des catégories de formation.
- **Équipe :** unité engagée dans une compétition ; les identifiants `V1-…` du catalogue désignent ces inscriptions, pas des identifiants fédéraux officiels.
- **Personne :** identifiant interne stable après vérification ; deux homonymes ne sont jamais fusionnés sur leur seul nom.
- **Affectation :** relation datée entre une personne et une équipe, avec origine, fin, statut et source. Une apparition en réserve ne doit pas créer une seconde personne.
- **Prêt :** club d'appartenance, club d'accueil et dates sont des champs distincts. Si le sens ou les dates du prêt sont inconnus, la disponibilité reste non validée.
- **Mobilité de formation :** une présence publiée en U17 et en U19 n'autorise pas à supposer une double inscription illimitée ; l'éligibilité reste un contrôle séparé.

Le modèle minimal proposé comprend `person_id`, `nom_affiche`, `team_id`, `saison_source`, `poste_source`, `numero_source`, `source_url`, `date_collecte`, `date_source`, `statut_collecte`, `debut_affectation`, `fin_affectation`, `statut_pret`, `verification_identite` et `validation_import`. Les champs contractuels, identifiants de fournisseur et dates d'affectation restent inconnus tant qu'ils ne sont pas établis.

### Ne pas confondre noms réels et attributs réalistes

Les noms collectés ne fournissent pas automatiquement des notes de technique, de vitesse, d'endurance ou de potentiel. Aucune note réelle, aucun salaire, aucune durée de contrat, aucune blessure et aucune personnalité ne sont inventés pour combler la collecte.

Pour le prototype, les profils synthétiques déjà prévus restent identifiés comme tels. Une version commerciale utilisant des joueurs réels devra disposer d'une méthode documentée d'évaluation, d'une séparation entre faits observés et estimations de jeu, ainsi que d'un traitement approprié des droits ; ce document ne constitue pas une autorisation juridique.

### Date de départ de carrière

Une photographie collectée en novembre ne reconstitue pas automatiquement les effectifs du début de saison. Rejouer fidèlement juillet 2026 demanderait un historique daté des arrivées, départs, prêts et inscriptions, puis un état de départ cohérent avec cet historique.

La recommandation pour le premier prototype est donc une **saison de fiction à partir d'une base réelle documentée**, clairement annoncée. Il ne faut ni annoncer une reconstitution exacte de juillet avec des effectifs de novembre, ni prétendre reproduire un classement réel qui n'a pas été collecté.

### Jeunes, données manquantes et compléments fictifs

Seuls les noms sportifs publics nécessaires à cette collecte sont repris pour les catégories de formation, avec poste et numéro publiés lorsqu'ils existent. L'annexe ne collecte pas les dates de naissance, adresses, établissements scolaires, coordonnées ou informations privées.

Si une équipe incomplète doit être jouable dans le prototype, un mode explicitement hybride peut créer des joueurs fictifs identifiés « Généré ». Ces personnages ne doivent pas être présentés comme les jeunes réels du club ; une expérience revendiquant des effectifs intégralement réels reste bloquée tant que les manques ne sont pas résolus.

### Contrôle avant intégration

- **Identité :** vérifier les noms incomplets, initiales, variantes d'accents et homonymes sans compléter de mémoire.
- **Affectation :** recouper le club, l'équipe exacte, la saison et les éventuels départs ou prêts.
- **Cohérence :** détecter les numéros répétés, groupes anormalement larges, doublons et contradictions ; un numéro répété est un signal, pas une preuve suffisante d'erreur.
- **Traçabilité :** conserver la source d'origine et l'historique des corrections, sans réécrire silencieusement une sauvegarde.
- **Publication :** distinguer la consultation publique d'une donnée, sa réutilisation et les autorisations nécessaires.
- **Sauvegarde :** figer une version de contenu au lancement d'une carrière ; les corrections suivantes sont proposées explicitement.

## V1 : interface du match en vue 2D

### Intention et périmètre

La vue 2D doit permettre de comprendre une occasion avant de regarder une note. L'utilisateur voit les déplacements, la pression, les solutions de passe et les conséquences de ses consignes ; il ne voit pas toutes les intentions cachées ni une probabilité certaine de réussite.

Les éléments suivants sont une spécification proposée, pas une interface déjà développée. Le premier lot jouable reste le moteur commun, la vue tactique et les décisions de carrière ; le pilotage direct détaillé plus bas est un lot supplémentaire, qui ne doit pas bloquer la preuve du moteur.

| Rôle actif | Peut faire | Ne peut pas faire |
|---|---|---|
| Manager ou entraîneur autorisé | Préparer composition, consignes, remplacements et coups de pied arrêtés | Déplacer physiquement un agent par glisser-déposer |
| Joueur en carrière | Piloter son avatar si le mode direct est disponible, demander un ballon, communiquer une intention | Prendre instantanément le contrôle d'un coéquipier ou imposer une substitution |
| Joueur sur le banc | Observer, suivre l'échauffement demandé, préparer une décision de dialogue | Contrôler les onze ou donner les ordres du coach |
| Observateur | Regarder, consulter les informations autorisées et revoir les actions | Modifier les décisions des équipes |

### Organisation de l'écran

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Compétition · contexte   ÉQUIPE A  1–0  ÉQUIPE B   67:42  · DIRECT    │
│ Rôle : manager           Pause / lecture     Vitesse     Aide         │
├────────────────┬────────────────────────────────┬────────────────────┤
│ ONZE / BANC    │                                │ CONSIGNES          │
│ Nom, poste     │          TERRAIN 2D             │ / ANALYSE / STAFF  │
│ Avertissement  │                                │                    │
│ État estimé    │  Ballon, numéros, sélection,     │ Intention active   │
│                │  repères choisis               │ Projet en attente │
│ Remplacements  │                                │ Valider / Annuler  │
├────────────────┴────────────────────────────────┴────────────────────┤
│ Fil des événements · dernières actions · accès au replay en lecture  │
│ Contexte : « consigne transmise » / « ballon sorti » / « replay »     │
└──────────────────────────────────────────────────────────────────────┘
```

Le terrain garde la priorité d'espace. Les panneaux peuvent être repliés ; le schéma représente une organisation, pas une résolution minimale imposée.

- **Bandeau supérieur :** score, minute simulée, période, cartons rouges, contexte aller-retour si applicable, rôle actif, mode direct ou replay et vitesse de simulation.
- **Panneau gauche :** onze et banc, poste utilisé, carton, disponibilité et estimation physique. Les alertes de blessure renvoient au degré de certitude du staff, pas à un diagnostic instantané omniscient.
- **Terrain central :** position des agents, ballon, direction d'attaque, numéro ou abréviation, marque de sélection et repères optionnels.
- **Panneau droit :** onglets de tactique, analyse et staff, avec distinction visible entre l'état actif et un projet non appliqué.
- **Bandeau inférieur :** journal d'actions, messages courts et accès aux replays déjà disponibles ; aucun curseur ne permet d'effacer un événement canonique.

### Représentation du terrain et du ballon

Le terrain est vu du dessus, avec caméra fixe par défaut et zoom facultatif. Un mode « équipe toujours vers le haut » peut être proposé, mais la transformation de coordonnées ne change jamais le sens réel de l'attaque.

- **Joueurs :** silhouettes ou pastilles orientées ; couleur, contour et forme distinguent les équipes. Le numéro reste lisible, le nom apparaît à la sélection ou au survol.
- **Avatar :** double anneau et nom persistant en carrière joueur. L'anneau reste identifiable sans dépendre du vert ou du rouge.
- **Ballon :** contraste fort, ombre au sol et indice de hauteur pour les ballons aériens ; une passe lobée ne ressemble pas à une téléportation.
- **Possession :** petit indicateur du contrôle effectif ; un ballon libre, disputé ou en vol n'est pas attribué artificiellement à un porteur.
- **Sélection :** cliquer un adversaire ouvre sa fiche autorisée, sans révéler ses attributs cachés ni changer le joueur contrôlé.
- **Orientation :** une flèche indique toujours le sens d'attaque, notamment après la mi-temps, une prolongation ou un changement de caméra.

L'interpolation du rendu lisse les déplacements entre états de simulation. Elle n'est jamais réinjectée dans le moteur comme une position plus favorable.

### Informations utiles, sans mur de statistiques

Le mode essentiel affiche le terrain, les événements importants et trois intentions principales. Le mode expert ajoute les analyses à la demande ; il n'impose pas dix couches simultanées.

| Couche | Utilité | Limite de réalisme |
|---|---|---|
| Structure d'équipe | Comprendre bloc, largeur et occupation des zones | Forme observée ou consigne, pas trajectoire future certaine |
| Pression proche | Voir qui ferme le porteur et les lignes immédiates | Aucun radar omniscient sur les intentions adverses |
| Solutions de passe | Apprentissage et aide facultative | Estimations locales ; une ligne affichée ne garantit pas la passe |
| Courses récentes | Comprendre un dédoublement ou un appel | Historique court, désactivable |
| Zones d'activité | Analyser une période déjà jouée | Échantillon et période affichés explicitement |
| Tirs et occasions | Relier angle, distance, pression et résultat | Le xG éventuel est une sortie du modèle, pas une vérité certifiée |
| Fatigue | Repérer un besoin de gestion | Estimation du staff ; pas de jauge exacte de l'adversaire |

Les statistiques détaillées restent accessibles à l'arrêt de jeu ou sur un panneau repliable. Chaque message du staff doit renvoyer à un fait observable : « trois courses derrière notre latéral » plutôt que « baisse leur chance de gagner ».

### Préparer et transmettre une consigne

Une instruction suit les états `brouillon → validée → transmise → active`, avec issues `rejetée`, `annulée` ou `expirée`. Chaque transition porte un horodatage de simulation et une raison compréhensible.

- **Brouillon :** modifier une position cible, un rôle ou une consigne ne touche pas encore le moteur ; le terrain montre une silhouette fantôme.
- **Validation :** l'interface vérifie les autorisations, contraintes de postes, remplacements et conditions de match avant transmission.
- **Transmission :** une consigne tactique attend son canal d'exécution prévu ; elle ne coupe pas une action technique déjà engagée.
- **Activation :** les agents adaptent progressivement leurs décisions et déplacements, sans déplacement instantané.
- **Annulation :** possible avant la prise en charge irréversible ; après activation, il faut envoyer une nouvelle instruction.
- **Rejet :** la raison est affichée et la tactique précédente reste active. L'interface ne laisse pas croire qu'un ordre impossible est passé.

Une file limitée à trois changements prioritaires est recommandée dans le mode essentiel. Les modifications plus nombreuses sont regroupées dans un seul plan, avec résumé des différences avant validation.

### Remplacements et interruptions

Pour remplacer un joueur, sélectionner le sortant puis l'entrant, vérifier le poste et confirmer. L'écran indique « préparé », puis « demandé », puis « effectué » ; il ne montre pas l'entrant sur le terrain avant l'événement d'entrée.

Le nombre de changements autorisés, les fenêtres, les exceptions et l'éligibilité doivent provenir de la configuration de compétition validée. Ils ne sont pas codés en dur comme une règle universelle ; si cette configuration manque, le scénario correspondant n'est pas déclaré réglementairement prêt.

Une blessure, une expulsion ou l'épuisement du banc propose des adaptations possibles sans réorganiser silencieusement l'équipe. Une permutation tactique après un carton rouge doit laisser le poste réellement vacant jusqu'à la décision du coach ou à la réponse déléguée du staff.

### Pause, vitesse et replay

- **Pause solo :** arrête le temps de simulation et permet d'examiner ou de préparer ; elle n'autorise pas à tirer, tacler ou progresser pendant que le monde est figé.
- **Vitesse :** `1×`, `2×`, `4×` et `8×` sont des cibles de présentation proposées pour les modes pilotés par l'IA. La simulation sans rendu peut aller plus vite selon le matériel.
- **Contrôle direct :** limité à `1×` ; passer en accéléré demande de déléguer explicitement l'avatar, sans changer sa position ni son état physique.
- **Replay :** historique en lecture seule, bandeau « REPLAY » permanent, commandes de jeu bloquées. Dans le mode solo proposé, le direct se met en pause à l'ouverture du replay.
- **Retour direct :** retrouve exactement l'état canonique laissé en pause. Le replay ne permet ni de revenir avant un but pour le rejouer, ni de changer une décision passée.
- **Décision de carrière :** une fenêtre peut rester ouverte sans délai réel punitif ; elle ne crée pas un bonus technique de réussite.

## V1 : commandes du match 2D

### Raccourcis généraux et priorité du focus

Toutes les affectations sont proposées et remappables. Un profil AZERTY et un profil QWERTY sont fournis ; les raccourcis ne se déclenchent pas lorsqu'un champ de texte, une confirmation ou un menu possède le focus.

| Action | Clavier / souris | Manette proposée | Conditions |
|---|---|---|---|
| Pause / reprendre | Espace | Menu / Start | Solo ; efface les intentions techniques maintenues avant reprise |
| Fermer le panneau actif | Échap | Retour / View | Ferme d'abord la couche au premier plan, puis ouvre le menu si aucune couche n'est ouverte |
| Ouvrir l'aide | F1 | Menu d'aide depuis pause | Affiche les commandes du rôle actuel |
| Ouvrir le replay | F8 | Depuis pause | Seulement un événement déjà enregistré |
| Revenir au direct | F9 ou bouton « Direct » | Bouton « Direct » | Disponible uniquement en replay |
| Sélectionner / consulter | Clic gauche | Navigation puis validation | Ne change pas le contrôle en carrière joueur |
| Action contextuelle | Clic droit | Menu contextuel | Seulement les actions autorisées au rôle |

Le jeu traite d'abord l'interface modale, puis le rôle actif, puis les raccourcis généraux autorisés. Une même pression ne doit jamais confirmer une fenêtre et déclencher une passe sur le terrain.

### Commandes manager

| Action | Affectation proposée | Effet précis |
|---|---|---|
| Composition et banc | 1 | Ouvre l'effectif du match |
| Organisation | 2 | Ouvre structure avec et sans ballon |
| Consignes | 3 | Ouvre les intentions d'équipe et individuelles |
| Analyse | 4 | Ouvre statistiques et couches d'observation |
| Staff | 5 | Ouvre recommandations et délégations |
| Modifier une position cible | Glisser-déposer dans l'éditeur tactique | Déplace uniquement le repère de projet ; jamais l'agent réel |
| Sélection multiple | Maj + clic dans l'éditeur | Prépare une instruction compatible pour plusieurs joueurs |
| Valider le projet | Bouton « Transmettre » ; Entrée si le panneau possède le focus | Contrôle les contraintes puis crée un ordre |
| Annuler une modification | Ctrl + Z dans le brouillon | Annule seulement une édition non transmise |
| Accélérer / ralentir | Pavé numérique + / −, ou boutons visibles | Change la vitesse autorisée du mode IA |
| Centrer sur le ballon | Bouton « Ballon » | Déplace la caméra, pas le ballon |
| Préparer un remplacement | Glisser le remplaçant sur le poste dans le panneau, puis confirmer | Crée une demande ; attend la procédure réglementaire |

À la manette, le manager utilise la croix directionnelle ou le stick pour naviguer, les gâchettes hautes pour changer d'onglet, le bouton inférieur pour valider et le bouton droit pour revenir. Un curseur au stick droit peut être proposé, mais aucune décision essentielle ne dépend d'une précision de souris.

### Pilotage individuel : principes

En carrière authentique, l'utilisateur contrôle une seule personne. Les partenaires conservent leurs propres décisions ; demander le ballon ou une couverture est une communication, pas un ordre irrésistible.

Le déplacement modifie l'intention de course, avec accélération, orientation, inertie et capacité physique. Appuyer sur sprint ne donne pas instantanément la vitesse maximale, et un changement brutal de direction a un coût plausible.

| Action | AZERTY | QWERTY | Manette, libellés Xbox | Interprétation |
|---|---|---|---|---|
| Déplacement | Z Q S D | W A S D | Stick gauche | Direction souhaitée, normalisée en diagonale |
| Sprint | Maj | Maj | RT | Effort soutenu tant que maintenu, dans les capacités de l'avatar |
| Orientation / visée | Souris sur le terrain | Souris sur le terrain | Stick droit ; sinon direction de déplacement | Repère d'intention, pas trajectoire garantie |
| Passe courte | E | E | A | Vers cible choisie ou aide de visée autorisée |
| Passe dans la course | A | Q | Y | Vise un espace en avance sur le partenaire |
| Passe longue / centre | R | R | X | Direction et charge ; centre si contexte de couloir pertinent |
| Tir | F | F | B | Prépare puis déclenche à la libération |
| Protéger / orienter le corps | V | V | LT | Utilise placement et opposition ; pas invulnérabilité |
| Demander le ballon | C | C | LB | Signal à un partenaire ; réponse selon situation et relation tactique |
| Modificateur de précision | Alt | Alt | RB | Intention placée sur un tir compatible, pas un bonus gratuit |
| Annuler un geste préparé | Retour arrière ou clic droit | Retour arrière ou clic droit | Clic stick droit | Seulement avant engagement moteur ; prioritaire sur le menu contextuel |

Les lettres Xbox décrivent des positions de boutons configurables, pas une exigence de matériel. Les autres manettes affichent leurs propres libellés.

### Sans ballon : courir juste plutôt que marteler une touche

Les touches de déplacement gardent leur sens, avec possibilité d'appel, de décrochage, de soutien et de retour dans la structure. La touche C demande une passe lorsque l'équipe possède le ballon ; sans possession, elle signale un besoin de couverture plutôt que de télécommander un partenaire.

| Action défensive | Clavier | Manette | Garde-fou |
|---|---|---|---|
| Contenir / jockey | Maintenir V + direction | LT + stick gauche | Réduit la mobilité offensive en échange d'une posture défensive |
| Tacle debout | E | A | Un engagement par nouvelle pression ; portée et timing restent déterminants |
| Tacle glissé | Maintenir A sur AZERTY, Q sur QWERTY, puis relâcher | Maintenir puis relâcher X | Seuil proposé de 250 ms, réglable ; geste engagé et risque disciplinaire |
| Fermer une trajectoire / présenter le corps | F | B | Ne crée pas une interception automatique |
| Appeler une couverture | C | LB | Demande locale, acceptée ou non par l'IA |

La touche R n'exécute pas de geste technique sans ballon ; une volonté de dégagement se fait au moment où l'avatar peut réellement jouer le ballon. Le contexte ne doit jamais transformer une pression ancienne en tir, en passe ou en tacle après un changement de possession.

### Visée, charge et résolution

- **Direction :** le pointeur est projeté sur le terrain ou le stick donne une direction ; un indicateur montre l'intention sans dévoiler un résultat certain.
- **Charge :** maintenir passe longue ou tir règle l'effort souhaité, relâcher demande le geste. La durée maximale de charge est un réglage de gameplay à tester, pas une propriété réelle déjà mesurée.
- **Annulation :** avant engagement, annuler par une commande dédiée remappable ou le bouton visible ; après engagement moteur, la seule possibilité est la conséquence physique de l'action.
- **Assistance :** profils manuel, assisté et accessible ; l'aide choisit une cible admissible ou ajuste la visée, sans modifier secrètement les attributs.
- **Erreur :** dépend du geste, du corps, de la pression et des capacités modélisées ; un clic exactement sur un partenaire ne garantit pas une passe parfaite.
- **Conflit :** une seule intention technique est engagée à la fois. Une tentative impossible reçoit un retour discret, sans se stocker indéfiniment dans une file.
- **Changement de contexte :** perte ou gain de possession, arrêt de jeu, ouverture de menu et changement de rôle réinitialisent charge et intentions maintenues.
- **Reprise :** les boutons doivent avoir été relâchés avant de pouvoir déclencher un nouveau geste ; une pause ne devient pas une technique de tir instantané.

Une option d'accessibilité remplace le maintien par un premier appui de préparation et un second d'exécution. Elle doit préserver les mêmes possibilités de décision sans imposer de répétitions rapides.

### Phases arrêtées et postes particuliers

Lorsqu'il est tireur désigné, l'avatar choisit une zone, un type de ballon et une intention de puissance dans une préparation lisible. Le moteur applique ensuite position, pression, qualité d'exécution et réactions ; une trajectoire d'aide est indicative.

Lorsqu'il n'est pas tireur, il conserve le contrôle de sa propre course et de son placement. Il ne peut pas déplacer les défenseurs ni décider seul de l'appel d'un autre joueur.

La première version du contrôle direct peut se limiter aux joueurs de champ, avec gardien piloté par l'IA et limite annoncée dans la sélection de carrière. Une carrière gardien réellement jouable demanderait un lot spécifique : placement, plongeon, prise ou déviation, sorties et relances, avec tests propres ; elle n'est pas implicitement promise par cette table.

### Exemple jouable : vivre une transition

À la perte du ballon, l'avatar ailier voit son latéral débordé. Il peut fermer l'intérieur, suivre le porteur, demander une couverture ou rester haut, mais il ne peut pas baisser la ligne de toute l'équipe depuis son rôle joueur.

S'il récupère, il choisit entre sécuriser en E, lancer un partenaire en A ou tenter de porter le ballon. L'issue dépend des positions et du geste ; le débrief peut expliquer « passe trop tardive sous pression » sans inventer un malus moral ni garantir qu'un autre choix aurait donné un but.

## V1 : critères d'acceptation de l'expérience 2D

### Exigences prioritaires

| Priorité | Exigence | Dépendance |
|---|---|---|
| P0 | Même état canonique en vue 2D, replay et simulation rapide | Moteur et journal d'événements |
| P0 | Composition, consignes et remplacements avec statut explicite | Permissions et configuration de compétition |
| P0 | Terrain lisible, sens d'attaque et équipes distinguables sans couleur seule | Rendu et interface accessible |
| P0 | Focus, pause et replay sans double déclenchement ni modification du passé | Gestion centralisée des entrées |
| P1 | Pilotage individuel d'un joueur de champ | Locomotion, gestes, visée et résolution commune avec l'IA |
| P1 | Manette, remappage complet et profils d'assistance | Système d'entrées par actions abstraites |
| P1 | Analyse des séquences, zones et recommandations explicables | Historique de positions et événements |
| Hors premier lot | Carrière gardien directe, multijoueur et rendu 3D | Spécifications et budgets de test distincts |

### Scénarios de recette

- **Brouillon tactique :** étant donné un match en cours, quand un repère est déplacé sans validation, alors aucune position ni décision canonique ne change.
- **Activation :** étant donné une consigne transmise, quand le moteur la prend en charge, alors le statut passe à « active » et les agents s'adaptent sans téléportation.
- **Rejet :** étant donné un joueur inéligible, quand un remplacement est confirmé, alors la demande est refusée avec raison et les onze présents restent inchangés.
- **Annulation tardive :** étant donné un remplacement déjà effectué, quand l'utilisateur demande l'annulation, alors le jeu refuse le retour dans le passé et explique les options encore légales.
- **Focus :** étant donné un champ de saisie actif, quand la lettre E est tapée, alors elle est saisie et aucune passe n'est envoyée.
- **Modal :** étant donné une confirmation ouverte, quand le bouton de validation est pressé, alors il ferme ou valide cette confirmation sans déclencher un geste de terrain.
- **Pause :** étant donné un tir chargé avant pause, quand la partie reprend, alors aucun tir ne part sans relâchement et nouvelle entrée autorisée.
- **Possession :** étant donné une touche de passe maintenue, quand le ballon est perdu, alors aucun tacle n'est déclenché par cette pression ancienne.
- **Replay :** étant donné une action enregistrée, quand elle est revue puis refermée, alors score, fatigue, position et ordres retrouvent l'état canonique, sans nouvelle résolution aléatoire.
- **Rôle :** étant donné une carrière joueur, quand un partenaire est sélectionné, alors sa fiche s'ouvre sans transfert du contrôle.
- **Accélération :** étant donné un avatar en pilotage direct, quand `4×` est demandé, alors le jeu demande une délégation explicite ou refuse l'accélération.
- **Mi-temps :** étant donné un changement de côté, quand la caméra reste orientée vers le haut, alors la visée est correctement transformée et le sens d'attaque affiché reste exact.
- **Déconnexion :** étant donné une manette déconnectée en solo, quand la perte est détectée, alors le match se met en pause et propose un autre périphérique sans ordres fantômes.
- **Accessibilité :** étant donné une palette en niveaux de gris, quand deux équipes jouent, alors formes, contours et indicateurs permettent encore de les distinguer.
- **Simulation rapide :** étant donné même état, version, graine et commandes horodatées, quand seul le rendu est coupé, alors les événements canoniques restent identiques sur la cible déterministe testée.

### Mesure et questions ouvertes

La recette technique précède les tests utilisateurs. Ensuite, mesurer la réussite d'une première substitution, les erreurs de rôle, les consignes comprises et les doubles déclenchements ; la cible technique est zéro double déclenchement dans la suite de tests, tandis que les objectifs d'ergonomie seront fixés après une première mesure de référence.

Les arbitrages bloquants du contrôle direct sont la sensation de locomotion, la charge des gestes et le niveau d'assistance acceptable. Ils doivent être décidés sur un prototype testable ; le gardien jouable et le multijoueur restent hors du premier lot et ne doivent pas étendre silencieusement la promesse.

## Synthèse

Generation Football doit pouvoir raconter la carrière d'un prodige comme celle d'un joueur qui se fait une place à force de persévérance. Son réalisme vient de la cohérence entre les règles, les personnes, les décisions et le terrain, pas du nombre de menus ou de statistiques cachées.

**Le vrai objectif : que « je lance encore un match » devienne « j'ai envie de retrouver mon histoire », tout en restant libre d'arrêter.**
