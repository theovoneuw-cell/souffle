# Souffle

L'appli de Théo pour arrêter de fumer. Faite pour une seule personne.

**→ https://theovoneuw-cell.github.io/souffle/**

Web app autonome (un seul `index.html`), sans compte ni serveur : tout est stocké dans Safari, sur le téléphone. Le code est public, les données ne le sont jamais.

## Ce qu'elle fait

- **Aujourd'hui** : compteur live à la seconde, € économisés, cigarettes pas fumées, vie regagnée (estimation ~20 min/cigarette, UCL 2024), prochaine étape, tes raisons, ta récompense.
- **SOS « J'ai envie de fumer »** : 3 min de respiration guidée (4-4-6), tes raisons et tes chiffres qui défilent. L'envie est notée comme vaincue ou comme faux pas.
- **Ton corps** : les 12 étapes de récupération, de 20 min à 15 ans.
- **Santé** : pouls au repos, variabilité cardiaque, oxygène, fréquence respiratoire et pas, envoyés par l'Apple Watch via un Raccourci iPhone. Courbes et comparaison avec ta première mesure.
- **Toi** : réglages, raisons, récompense, sauvegarde/restauration, Tabac Info Service (39 89).

## Brancher l'Apple Watch (Raccourci iPhone)

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

Les données vivent dans Safari. Pense à **Toi › Exporter mes données** de temps en temps.
