# Consignes pour Claude

- **Livrer un APK à chaque fois.** Après toute modification du jeu, construire l'APK
  (`npm run apk`, SDK Android dans `$ANDROID_HOME` ou `~/android-sdk`) et l'envoyer à
  l'utilisateur en fichier joint. La GitHub Action `.github/workflows/apk.yml` publie aussi
  une pré-version `apk-<n>` à chaque push.
- Avant de livrer : `npm test` ; pour l'interface, `npm run serve` puis `npm run ui-check -- http://localhost:8000/index.html` et `npm run ui-check-career -- http://localhost:8000/index.html`.
- Le catalogue `src/data/catalog.js` est généré depuis `data/joueurs-v1.csv` (`npm run catalog`) : ne pas l'éditer à la main.
- Effectifs jeunes (mineurs) : jamais de noms réels, coéquipiers fictifs.
- L'interface doit rester utilisable sur téléphone en paysage (mise en page `max-height: 520px`).
- Les données réelles (`docs/`, `data/`) restent bloquées à l'import (`import_autorise=false`).
