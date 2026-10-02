# Mise à jour Google Play : Neon Strike 1.0.1

Ce dossier contient tout ce qu'il faut pour publier la première mise à jour du jeu, depuis la version **1.0.0** publiée sur Google Play :

- les nouvelles images de la fiche ;
- les textes à copier dans la Play Console ;
- la liste complète de ce qui a changé ;
- les étapes de publication.

## 1. Contenu du dossier

| Fichier | Où l'utiliser dans la Play Console | Exigence Google |
|---|---|---|
| `screenshots/fr/01…08.jpg` | Fiche principale du Store → Captures d'écran du téléphone (français) | 2 à 8 images, 16:9, 1920 × 1080 ✓ |
| `screenshots/en/01…08.jpg` | Même section, dans la traduction anglaise (en-US) | idem ✓ |
| `feature-graphic-1024x500.jpg` | Image de présentation (français) | 1024 × 500, JPEG ✓ |
| `feature-graphic-1024x500-en.jpg` | Image de présentation (anglais) | idem ✓ |
| `notes-de-version.txt` | Release → Notes de version (fr-FR et en-US) | 500 caractères max par langue ✓ |

L'icône (`../icon-512.png`) et le nom de l'application ne changent pas.

### Les 8 captures, dans l'ordre

Envoie-les dans l'ordre des numéros : la première est la plus vue.

| N° | Titre (FR) | Ce qu'on voit |
|---|---|---|
| 01 | Ton héros en 3e personne | Zed en combat à Paris, avec la radio de l'histoire et un combo |
| 02 | Une histoire en 5 actes | La BD de l'acte 5 avec les 6 héros |
| 03 | Des boss d'histoire | La Reine Néon à Londres, la nuit, avec sa barre de vie |
| 04 | 6 héros, 18 skins | L'onglet Personnages (Kira, skin bleu) |
| 05 | 10 armes réelles | L'Armurerie avec l'AK-47 |
| 06 | Vise en te déplaçant | Le mode AIM à Tokyo |
| 07 | Saisons mensuelles | Le classement de la saison d'octobre |
| 08 | Mode Cauchemar | Les 30 niveaux et les 3 difficultés |

Les captures viennent du vrai jeu (version web, 1920 × 1080), avec l'interface telle qu'elle apparaît sur téléphone. Les pseudos du classement sont des comptes de test.

## 2. Notes de version (« Nouveautés »)

Les mêmes textes sont dans `notes-de-version.txt`, déjà au format attendu par la Play Console (balises de langue).

**Français (fr-FR), 464 caractères :**
```
NOUVEAU : le mode histoire « L'Épidémie Néon » ! 5 actes en BD, des messages radio, 30 documents secrets et des boss légendaires.
• Joue en 3e personne avec 6 héros et 18 skins
• Armurerie : 10 armes réelles (AK-47, M4, sniper, RPG…) et munitions limitées
• Grenades, bouton AIM pour viser en courant, aide à la visée
• Difficultés Facile, Normal et Cauchemar, nouveaux zombies
• Saisons mensuelles avec récompenses
• Nouveaux réglages et corrections du classement
```

**Anglais (en-US), 412 caractères :**
```
NEW: the "Neon Outbreak" story mode! 5 acts told in comics, radio chatter, 30 secret documents and legendary bosses.
• Play in third person with 6 heroes and 18 skins
• Armory: 10 real weapons (AK-47, M4, sniper, RPG…) and limited ammo
• Grenades, AIM button to aim on the move, aim assist
• Easy, Normal and Nightmare difficulties, new zombies
• Monthly seasons with rewards
• New settings and leaderboard fixes
```

## 3. Textes de la fiche à remplacer

L'ancienne description parle d'un jeu « à la première personne » avec « 6 armes » et un « railgun ». Ce n'est plus vrai, il faut la remplacer.

### Français (fr-FR)

**Nom de l'application** (inchangé) :
```
Neon Strike : Zombie Shooter
```

**Description courte** (76 / 80 caractères) :
```
Zombies, 6 héros et un mode histoire : survie en 3D dans 6 villes du monde !
```

**Description complète :**
```
Bienvenue dans Neon Strike, un jeu de tir 3D au style cartoon : les zombies ont envahi les plus grandes villes du monde. Choisis ton héros et repousse l'épidémie !

• MODE HISTOIRE « L'ÉPIDÉMIE NÉON » : 5 actes racontés en bandes dessinées, des messages radio pendant les combats et 30 documents secrets à retrouver. Découvre ce que cache Helix Corp, de Paris jusqu'à la Tour Helix.
• 6 HÉROS EN 3E PERSONNE : Max le soldat, Rex le commando, Kira la ninja, Nova l'astronaute, Zed le cyber et Leo le royal, avec 3 skins chacun. Gagne-les en avançant dans l'histoire ou débloque-les tout de suite. La vue à la 1re personne reste disponible.
• DES BOSS LÉGENDAIRES : le Gardien, le Cracheur Géant, le Commandant Helix, la Reine Néon et le Fondateur.
• 10 ARMES RÉELLES dans l'Armurerie : pistolet, fusil à pompe, MP5, M16, M4, AK-47, sniper, lance-grenades, minigun et RPG. Munitions limitées : achète des caisses ou ramasse-les sur le terrain. Grenades à main pour les hordes.
• VISE EN COURANT : bouton AIM, aide à la visée réglable, tir en coup par coup, rafale ou automatique.
• 6 VILLES DU MONDE : Paris, New York, Tokyo, Londres, Le Caire et Rio de Janeiro, avec leurs monuments, du matin à la nuit.
• 30 NIVEAUX ET 3 DIFFICULTÉS : Facile, Normal ou Cauchemar (crédits doublés et crâne rouge). Des zombies variés : coureurs, blindés, explosifs, cracheurs d'acide et porteurs de bouclier.
• SAISONS MENSUELLES : un nouveau classement chaque mois et des récompenses pour les meilleurs survivants, avec un skin exclusif « Champion » pour le top 5.
• Missions du jour, succès, récompense quotidienne et améliorations de ton équipement.
• Joue en invité sans inscription, ou crée un compte pour sauvegarder ta progression en ligne.
• Commandes tactiles pensées pour le mobile : joystick à gauche ; visée, tir et boutons à droite. Glisse le pouce sur n'importe quel bouton pour viser en te déplaçant.

Jeu gratuit avec publicités et achats intégrés facultatifs (packs de crédits).
```

### Anglais (en-US)

**App name** (unchanged):
```
Neon Strike: Zombie Shooter
```

**Short description** (66 / 80 characters):
```
Zombies, 6 heroes and a story mode: 3D survival in 6 world cities!
```

**Full description:**
```
Welcome to Neon Strike, a cartoon-style 3D shooter: zombies have taken over the world's greatest cities. Pick your hero and stop the outbreak!

• "NEON OUTBREAK" STORY MODE: 5 acts told in comics, radio chatter during the fights and 30 secret documents to find. Uncover what Helix Corp is hiding, from Paris to Helix Tower.
• 6 HEROES IN THIRD PERSON: Max the soldier, Rex the commando, Kira the ninja, Nova the astronaut, Zed the cyber and Leo the royal, with 3 skins each. Earn them through the story or unlock them right away. First-person view is still available.
• LEGENDARY BOSSES: the Guardian, the Giant Spitter, the Helix Commander, the Neon Queen and the Founder.
• 10 REAL WEAPONS in the Armory: pistol, shotgun, MP5, M16, M4, AK-47, sniper, grenade launcher, minigun and RPG. Limited ammo: buy crates or pick them up in the field. Hand grenades for the hordes.
• AIM ON THE MOVE: AIM button, adjustable aim assist, single shot, burst or full auto.
• 6 WORLD CITIES: Paris, New York, Tokyo, London, Cairo and Rio de Janeiro, with their landmarks, from morning to night.
• 30 LEVELS AND 3 DIFFICULTIES: Easy, Normal or Nightmare (double credits and a red skull). Many kinds of zombies: runners, armored, exploding, acid spitters and shield bearers.
• MONTHLY SEASONS: a new leaderboard every month and rewards for the best survivors, with an exclusive "Champion" skin for the top 5.
• Daily missions, achievements, daily reward and gear upgrades.
• Play as a guest with no sign-up, or create an account to save your progress online.
• Touch controls built for mobile: joystick on the left; aim, fire and buttons on the right. Slide your thumb on any button to aim while you move.

Free to play with ads and optional in-app purchases (credit packs).
```

## 4. Étapes de publication

1. **Mettre le serveur à jour d'abord.** La nouvelle app utilise des routes qui n'existent pas sur l'ancien serveur (histoire, épisodes, affiches, messages…).
   ```bash
   cd /opt/apps/neon-strike
   git stash && git pull && git stash pop
   cd deploy && docker compose up -d --build
   ```
   Ouvre ensuite la page admin pour vérifier que tous les onglets s'affichent : Joueurs, Saisons, Épisodes, Publicités…
2. **Construire l'app pour Google Play** (fichier `.aab`, version **1.0.1**). EAS augmente le version code tout seul.
   ```bash
   cd /opt/apps/neon-strike/frontend
   yarn build:android:prod
   ```
   Télécharge le `.aab` depuis la page du build sur expo.dev.
3. **Play Console → Tester et publier → Production → Créer une release.**
   1. Importe le `.aab`.
   2. Colle les notes de version (fichier `notes-de-version.txt`).
   3. Clique sur Suivant, puis Enregistrer.
   4. Conseil : choisis un **déploiement progressif** (par exemple 20 % des utilisateurs). Tu l'élargis à 100 % après un ou deux jours sans problème.
4. **Fiche du Store** (Croissance → Présence sur le Store → Fiche principale) :
   1. Supprime les 8 anciennes captures et envoie les 8 nouvelles de `screenshots/fr/`.
   2. Remplace l'image de présentation.
   3. Colle la description courte et la description complète.
   4. Fais la même chose dans **Gérer les traductions → anglais (en-US)** avec les fichiers `en`.
5. **Envoyer pour examen** (Vue d'ensemble de la publication). L'examen de Google prend en général quelques heures à quelques jours.

## 5. Points à vérifier dans la Play Console

- **Classification du contenu :** rien ne change. La violence reste cartoon, sans sang ; la vue à la 3e personne et les nouveaux boss n'y changent rien. Tu n'as pas besoin de refaire le questionnaire.
- **Sécurité des données :** pas de nouveau type de donnée collecté.
  - Les scores de saison utilisent le compte déjà déclaré.
  - Les messages admin et les épisodes sont envoyés par le serveur ; ils ne viennent pas du joueur.
  - Les vues d'affiches sont des compteurs anonymes.
  - Le formulaire peut rester tel quel. La suppression de compte existe déjà, dans l'app et sur le site.
- **« Contient des annonces » :** reste sur **Oui**. Les affiches sur les façades sont aussi des publicités. Celles que tu vends doivent respecter le règlement Google Play sur les annonces (pas de contenu trompeur, adulte ou interdit aux enfants).
- **Cartes-cadeaux :** la fenêtre des saisons annonce des cartes-cadeaux « dès 10 000 joueurs, selon le règlement ». Google demande des règles officielles publiées avant tout concours avec un lot réel. Ne mets donc pas cette promesse dans la fiche du Store tant que le règlement n'est pas en ligne. Les textes ci-dessus ne parlent que des récompenses dans le jeu.

## 6. Tout ce qui a changé depuis la version 1.0.0

### Gameplay
- **Vue à la 3e personne** par défaut : le personnage est visible en entier et animé (marche, visée, recul, rechargement). La caméra passe au-dessus de l'épaule et se rapproche contre les murs. La 1re personne reste disponible dans les Réglages.
- **6 héros** (Max, Rex, Kira, Nova, Zed, Leo) avec 3 skins de couleur chacun, plus le skin exclusif « Max Vétéran ».
- **Armurerie : 10 armes réelles**, avec des modèles 3D réalistes (pistolet, fusil à pompe, MP5, M16, M4, AK-47, sniper .50 perforant, lance-grenades, minigun, RPG). Les prix sont réglés depuis la page admin. Le joueur emporte 4 armes en jeu.
- **Munitions limitées** par arme : on achète des caisses dans l'Armurerie ou on les ramasse sur les zombies. Le pistolet reste illimité.
- **Grenades à main** : 3 par niveau, d'autres à ramasser.
- **Bouton AIM** pour viser en se déplaçant (zoom, tir plus précis). Tous les boutons de droite font tourner la vue en glissant le pouce, pour viser en courant.
- **3 difficultés** : Facile, Normal, Cauchemar (crédits ×2 et crâne rouge sur le niveau).
- **2 nouveaux zombies** : le cracheur d'acide et le porteur de bouclier.
- **Nouveaux réglages** : vue 1re ou 3e personne, aide à la visée, qualité graphique, vibrations, axe vertical inversé.
- **Bouton pour quitter le jeu** (menu et pause).

### Mode histoire « L'Épidémie Néon »
- 5 actes sur les 30 niveaux, une ville par acte (le dernier en traverse deux), racontés en bandes dessinées avec des scènes 3D. On les revoit dans le Journal.
- Messages radio des héros au début de chaque niveau et à l'arrivée du boss.
- 5 boss d'histoire avec leur propre apparence et leur nom sur la barre de vie : le Gardien, le Cracheur Géant, le Commandant Helix, la Reine Néon, le Fondateur.
- Récompenses d'acte : des crédits, le skin « Max Vétéran » et les héros rencontrés, offerts.
- 30 documents secrets cachés dans les niveaux, lisibles dans le Journal.
- Épisodes de saison publiés depuis la page admin, sans mise à jour de l'app.

### Saisons et classement
- Saisons mensuelles : le classement repart à zéro chaque mois. Récompenses en crédits pour le top 100, skin « Champion » et badge pour le top 5. Une fenêtre explique les saisons au lancement.
- Correction : les scores sont maintenant enregistrés à chaque niveau terminé (pas seulement à la fin de la partie), et renvoyés plus tard en cas de coupure réseau.

### Boutique et personnalisation
- Illustrations des packs de crédits dans la boutique.
- Skins d'armes (camouflage, arctique, bonbon, néon, lave, or) et onglet Personnages avec un aperçu 3D du héros.

### Ce qui change pour toi (page admin et serveur)
- Onglet **Joueurs** : liste, recherche, suppression d'un joueur, et **message personnel** à un joueur précis (« POUR TOI » dans le jeu).
- Onglet **Saisons** : contrôle et validation des résultats du mois.
- Onglet **Épisodes** : écrire et publier un nouvel épisode de l'histoire.
- Onglet **Publicités** : affiches sur les façades des immeubles (3 emplacements par niveau), avec les vues comptées.
- Onglet **Boutique** : prix des armes et des munitions.
