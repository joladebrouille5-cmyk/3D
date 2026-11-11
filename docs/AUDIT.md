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
