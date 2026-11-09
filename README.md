# Souffle

L'appli de Théo pour arrêter de fumer. Faite pour une seule personne.

**→ https://theovoneuw-cell.github.io/souffle/**

Web app autonome (HTML, CSS et JavaScript, sans dépendance), sans compte ni serveur : tout est stocké dans Safari, sur le téléphone. Le code est public, les données ne le sont jamais.

## Ce qu'elle fait

- **Aujourd'hui** : un ciel enfumé qui se dégage au fil des jours, compteur à la seconde (en secondes, minutes, heures puis jours), argent économisé, cigarettes évitées, vie regagnée, mission du jour, prochaine étape du corps, tes raisons, tes objectifs d'épargne, tes derniers trophées. Deux boutons toujours sous le pouce : « J'ai envie de fumer » et « J'ai craqué ».
- **SOS « J'ai envie de fumer »** : respiration guidée (4-4-6), « surfer l'envie », mini-jeu anti-envie, 16 techniques. L'envie est ensuite notée avec son intensité et son déclencheur.
- **« J'ai craqué »** : une feuille demande quand et combien, dit ce qui repart de zéro et ce qui est gardé, puis l'écran « On repart » rappelle ta série et ton record. Tout repart de zéro (compteur, argent, cigarettes évitées, étapes du corps, trophées, programme, point de départ des mesures de la montre) ; le journal, le record et les courbes restent. « Je n'ai pas fumé, annuler » ou la suppression de l'entrée dans le journal rend le compteur d'avant.
- **Journal** (bouton « Noter ») : envies, cigarettes fumées et substituts.
- **Stats** : bilan, tes séries et ton record, envies par jour, heures et jours à risque, déclencheurs, intensité, substituts, argent cumulé avec projection, conseils tirés de tes données. Après un craquage, la période « Tout » remonte avant lui.
- **Progrès** : les 12 étapes du corps, 63 trophées, le programme de 30 jours (une mission par jour), et une carte de progrès à partager en image.
- **Santé** : pouls au repos, variabilité cardiaque, oxygène, fréquence respiratoire et pas, envoyés par l'Apple Watch via un Raccourci iPhone.
- **Toi** : réglages, raisons, plusieurs objectifs d'épargne, thème clair/sombre/auto, sauvegarde/restauration, Tabac Info Service (39 89).

## Brancher l'Apple Watch (Raccourci iPhone)

**Le plus simple** : installer `Souffle Montre.shortcut` (déjà réglé), puis Santé › **Mettre à jour avec ma montre**. Pour l'écran d'accueil, ajouter Souffle depuis Safari en décochant « Ouvrir en tant qu'app web » : l'icône partage alors les données de Safari. La méthode à la main ci-dessous est l'ancienne version.

Une web app ne peut pas lire l'app Santé directement. Un Raccourci le fait à sa place, puis ouvre Souffle avec les valeurs dans l'adresse, après le `#`. Cette partie de l'adresse n'est jamais envoyée à un serveur.

1. App **Raccourcis** › ＋ › nom : **Souffle**.
2. **Rechercher des échantillons de santé** › Type **Fréquence cardiaque au repos** › filtre **Date de début est dans les derniers 7 jours**.
3. **Calculer les statistiques** › **Moyenne** (= Moyenne 1).
4. Pareil pour **Variabilité de la fréquence cardiaque** (Moyenne 2), **Saturation en oxygène** (Moyenne 3), **Fréquence respiratoire** (Moyenne 4).
5. Pareil pour **Nombre de pas**, avec **Somme**.
6. Action **URL** :
   `https://theovoneuw-cell.github.io/souffle/#rhr=[Moyenne 1]&hrv=[Moyenne 2]&o2=[Moyenne 3]&rr=[Moyenne 4]&pas7=[Somme]`
   (chaque `[…]` = la variable correspondante)
7. **Ouvrir les URL**. Lance une fois et autorise l'accès à Santé.
8. ⓘ › **Ajouter à l'écran d'accueil**, avec `icone-raccourci.png` comme icône. Cette icône devient ton appli Souffle : chaque ouverture met tes données à jour.
9. Option : **Automatisation** › Heure de la journée › 21:00 › Exécuter immédiatement › Souffle.

L'appli accepte les nombres avec virgule ou unité (`64,3 bpm`), et l'oxygène en `0,97` ou en `97`.

> Ouvre toujours Souffle par l'icône du Raccourci (ou dans Safari). Une version « ajoutée à l'écran d'accueil » depuis Safari aurait son propre stockage, séparé.

## Sauvegarde

Les données vivent dans Safari. Pense à **Toi › Exporter** de temps en temps.

## Pour qui modifie le code

- Une seule fonction remet le compteur à zéro : `resetOnSmoke`, appelée par `logSlip`. Le SOS, le journal et « J'ai craqué » passent tous par là.
- Tout ce qui s'affiche se calcule à partir de la date d'arrêt (`profile.quitDate`). `reconcile()` remet les missions et les trophées d'accord avec elle, à chaque ouverture et quand la date est corrigée à la main.
- À chaque mise en ligne, augmenter le `?v=` des quatre fichiers dans `index.html` : c'est ce qui déclenche la mise à jour sur le téléphone.
