# Neon Strike

Jeu de tir 3D (Expo / React Native + three.js) pour Android, avec un backend FastAPI + MongoDB pour le classement.

```
frontend/   Application mobile Expo SDK 54 (React Native 0.81, nouvelle architecture)
backend/    API FastAPI : /api/scores, /api/leaderboard, /api/leaderboard/best, /api/rewards/ad
memory/     PRD et notes produit
```

## Prérequis

| Outil | Version |
|---|---|
| Node.js | 20 LTS ou 22 |
| Yarn | 1.22 (`corepack enable`) |
| Python | 3.11 |
| MongoDB | 6+ (local, Docker ou Atlas) |
| JDK | 17 (pour compiler Android en local) |
| Android Studio | SDK Android 35/36 + un émulateur, ou un téléphone en mode développeur |

## 1. Backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # renseigner MONGO_URL / DB_NAME
# MongoDB via Docker si besoin : docker run -d -p 27017:27017 --name mongo mongo:7
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

Vérification : <http://localhost:8001/api/> renvoie `{"message": "Neon Protocol API online"}`.

Tests (en mémoire, sans MongoDB ni accès à Google) :

```bash
pip install -r requirements-dev.txt
pytest
```

En local, `PURCHASE_VERIFICATION=disabled` (dans `backend/.env`) accepte les achats sans interroger Google. Ne l'utilisez jamais en production.

## 2. Application mobile

```bash
cd frontend
yarn install
cp .env.example .env            # EXPO_PUBLIC_BACKEND_URL doit être joignable depuis le téléphone
```

L'app utilise des modules natifs (AdMob, expo-gl, expo-dev-client), elle ne tourne donc **pas dans Expo Go** : il faut un *development build*.

### Option A — Compilation locale (Android Studio)

```bash
yarn android          # = expo run:android : génère android/, compile et installe sur l'émulateur/téléphone
```

Ensuite, pour les modifications JS/TS : `yarn start:dev-client`, rechargement à chaud automatique.
Le dossier `android/` est régénéré par `expo prebuild` et n'est pas versionné : toute config native passe par `app.json` / les plugins.

### Option B — Compilation dans le cloud (EAS Build, sans Android Studio)

```bash
npm i -g eas-cli && eas login
eas init                                  # lie le projet à votre compte Expo (ajoute projectId dans app.json)
yarn build:android:dev                    # APK de développement à installer sur le téléphone
yarn start:dev-client                     # puis ouvrir l'app installée et scanner le QR code
```

Autres profils (`frontend/eas.json`) :
- `yarn build:android:preview` : APK autonome pour faire tester le jeu ;
- `yarn build:android:prod` : AAB signé pour le Play Store.

## Vérifications rapides

```bash
cd frontend
yarn typecheck   # TypeScript
yarn lint        # ESLint
yarn doctor      # expo-doctor (compatibilité des dépendances)
```

Pour ajouter une dépendance, utilisez `npx expo install <paquet>` : il choisit la version compatible avec le SDK Expo.

⚠️ `react-native-google-mobile-ads` est volontairement bloqué en **16.0.x** : à partir de 16.3, il embarque le SDK Google Mobile Ads 25, compilé avec une version de Kotlin plus récente que celle d'Expo SDK 54, ce qui fait échouer le build Android (`:react-native-google-mobile-ads:compileReleaseKotlin`). Ne le mettre à jour qu'avec une montée de version du SDK Expo.

## À prévoir avant une publication

- **Identifiant d'application** : `com.aymenkssi.neonstrike` (Android et iOS). Il ne peut plus changer une fois l'app publiée sur le Play Store.
- **AdMob** : les unités NEON STRIKE (bannière, interstitiel, récompensée) sont dans `frontend/src/ads/index.ts`. Seul le profil EAS `production` affiche de vraies pubs ; les builds `development` et `preview` utilisent les pubs de test. L'`iosAppId` est encore l'ID de test Google.
- **Consentement RGPD** : l'app affiche au démarrage le message configuré dans AdMob (**Privacy & messaging → GDPR**) et ne charge aucune pub avant la réponse. Le joueur peut modifier son choix dans Réglages → « Confidentialité des annonces ». Sans message publié dans AdMob, les joueurs européens ne verront pas de pubs.
- **Interstitiel** : affiché toutes les 2 fins de niveau ou morts, en quittant l'écran de résultat, et jamais dans la minute qui suit une pub récompensée (`INTERSTITIAL_EVERY` dans `frontend/src/ads/index.ts`).
- **Backend** : à déployer sur votre VPS avec Docker Compose (API + MongoDB + HTTPS automatique), voir [`deploy/README.md`](deploy/README.md). Ensuite, l'app utilise `https://api.gameneonstrike.com` (`frontend/eas.json`) ; le site `https://gameneonstrike.com` sert `app-ads.txt` et la politique de confidentialité.

## Progression du jeu

- **Campagne** de 30 niveaux (`frontend/src/game/progression.ts`) : 2 à 3 vagues par niveau, un boss à la dernière vague, difficulté croissante.
- **Étoiles** : ★ niveau terminé, ★★ au moins 50 % de santé, ★★★ au moins 30 % de tirs à la tête.
- **Crédits** gagnés en combat, en fin de niveau (bonus + étoiles, ×2 avec une pub) et via la **récompense quotidienne** (série de 7 jours).
- **Arsenal** : améliorations permanentes (dégâts, santé max, chargeur, rechargement), 5 niveaux chacune.
- **Difficulté** choisie dans la liste des niveaux : Facile (zombies plus lents et fragiles, crédits ×0,75), Normal, Cauchemar (plus nombreux, rapides et coriaces, crédits ×2 et un crâne rouge sur le niveau).
- **Zombies** (`frontend/src/game/content.ts`) : rôdeur, coureur (dès le niveau 3), blindé (niveau 5), explosif (niveau 7, explose au contact et en chaîne), cracheur (niveau 9, garde ses distances et crache de l'acide qu'on esquive en se décalant) et bouclier (niveau 12, les balles s'arrêtent sur son bouclier : viser la tête, le contourner ou utiliser des explosifs), plus un boss par niveau.
- **Combos** (DOUBLE KILL, TRIPLE KILL… en moins de 2,5 s) avec bonus de score et de crédits ; **bonus temporaires** lâchés par les zombies : dégâts ×2, vitesse, munitions infinies.
- **6 villes du monde**, une par secteur de 5 niveaux : Paris, New York, Tokyo, Londres, Le Caire, Rio (`frontend/src/game/cities.ts`). Chaque ville a son architecture, son monument au loin (tour Eiffel, Empire State, Tokyo Tower, Big Ben et London Eye, pyramides, Christ Rédempteur), ses accessoires et sa météo. Les 5 niveaux d'une ville vont du matin à la nuit.
- **Rendu cartoon** : éclairage « toon » à paliers, couleurs vives. La ville est générée (`frontend/src/game/world.ts`) puis fusionnée en 2 maillages, et les collisions utilisent des boîtes invisibles. Zombies cartoon (`characters.ts`) et armes aux couleurs de rareté avec main gantée (`weapons.ts`).
- **Objectifs** (`frontend/src/game/meta.ts`) : 3 missions du jour (les mêmes pour tous, renouvelées à minuit), 17 succès récompensés en crédits et des statistiques de joueur.
- **Armes** : fusil à pompe, SMG (niveau 2), fusil d'assaut (4), railgun perforant (10), minigun (15), lance-grenades (20).
- **Commandes** : joystick visible en bas à gauche (il suit le pouce, sprint en poussant à fond), visée à droite. Tous les boutons de combat sont des gestes natifs : on peut tirer en se déplaçant, et glisser le doigt sur FIRE vise en même temps.
- **Skins** (`frontend/src/game/skins.ts`) achetés avec les crédits : 6 finitions d'armes (camouflage, arctique, bonbon, néon, lave, or) et 5 tenues (commando, ninja, astronaute, cyber, royal) visibles sur les bras et les gants, avec un aperçu 3D qui tourne.
- **Réglages de jeu** : aide à la visée (ralentissement et légère attraction du viseur sur le zombie visé), inversion de l'axe vertical, vibrations, qualité graphique (Économie : décor allégé et 30 images/s ; Normal ; Élevée).
- **Suggestions** : les joueurs connectés envoient une idée ou un bug depuis Réglages ; tu les lis dans l'onglet « Suggestions » de la page d'administration.
- **Modes de tir** : bouton MODE au-dessus de FIRE pour les armes qui en ont plusieurs : coup par coup, rafale de 3 balles, automatique. Fusil d'assaut : coup par coup / rafale ; SMG : auto / rafale / coup par coup. Le mode choisi est mémorisé par arme pendant la partie.
- **Musique** : thèmes originaux du menu et du combat (`frontend/scripts/generate-music.py` les régénère), réglables dans Réglages.
- **Au premier lancement**, le joueur choisit : **créer un compte** (nom d'utilisateur unique, 3 à 16 lettres, chiffres ou `_`, sans distinction de casse, et mot de passe de 6 caractères minimum), **se connecter**, ou **jouer en invité**.
  - **Invité** : progression uniquement sur le téléphone, pas de classement. Il peut créer un compte plus tard (Réglages → Compte) et garde alors sa progression et ses achats.
  - **Compte** : progression synchronisée en ligne (`frontend/src/hooks/use-progress.ts`), retrouvée en se connectant sur un autre téléphone, et nom affiché au classement mondial.

## Langues

- Français et anglais (`frontend/src/i18n/`). Au premier lancement, le jeu suit la langue du téléphone (français si le téléphone est en français, anglais sinon). Le joueur peut changer sur l'écran d'accueil ou dans Réglages → Langue.
- Tous les textes passent par `t("clé")`. `fr.ts` est le dictionnaire de référence : `en.ts` doit avoir exactement les mêmes clés, sinon `yarn typecheck` échoue.
- Les messages de la page d'administration et les étiquettes des packs ont un champ anglais facultatif ; sans lui, les joueurs anglophones voient le texte français.

## Achat de crédits (Google Play Billing)

- Boutique accessible via le « + » du compteur de crédits (menu et Arsenal). Code : `frontend/src/iap/`.
- Packs (crédits, étiquettes, ordre, visibilité) et messages aux joueurs se gèrent sur la page d'administration `https://api.gameneonstrike.com/admin` (voir [`deploy/README.md`](deploy/README.md)). `frontend/src/iap/catalog.ts` sert de liste par défaut hors connexion.
- Produits **consommables** à créer dans Play Console → *Monétiser → Produits intégrés*, avec exactement ces ID : `coins_500`, `coins_1200`, `coins_3500`, `coins_8000`. Les prix se règlent dans Play Console ; l'app affiche le prix localisé renvoyé par Google.
- Les achats ne fonctionnent que dans un build Android installé (pas dans Expo Go ni sur le web). Pour tester sans payer : ajouter votre compte Google dans Play Console → *Paramètres → Test des licences*, puis installer l'app depuis un canal de test (interne ou fermé).
- Chaque achat est vérifié par le backend auprès de Google Play avant d'être crédité ; un reçu ne peut servir qu'à un seul joueur. Sans `EXPO_PUBLIC_BACKEND_URL` (développement), l'achat est crédité sans vérification.
- Les crédits sont ajoutés dès la confirmation de Google, puis l'achat est « consommé ». Un achat interrompu (app fermée, paiement en espèces en attente) est crédité au lancement suivant.

## Pistes d'évolution

Voir le backlog dans [`memory/PRD.md`](memory/PRD.md) : nouvelles armes et bonus, boss toutes les N vagues, mini-carte, interstitiel en fin de partie, défi quotidien, statistiques de joueur en ligne.
