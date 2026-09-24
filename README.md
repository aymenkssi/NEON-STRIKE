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

Tests (ils appellent une API en HTTP) :

```bash
EXPO_PUBLIC_BACKEND_URL=http://localhost:8001 pytest
```

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

## À prévoir avant une publication

- **Identifiant d'application** : `com.aymenkssi.neonstrike` (Android et iOS). Il ne peut plus changer une fois l'app publiée sur le Play Store.
- **AdMob** : les unités NEON STRIKE (bannière, interstitiel, récompensée) sont dans `frontend/src/ads/index.ts`. Seul le profil EAS `production` affiche de vraies pubs ; les builds `development` et `preview` utilisent les pubs de test. L'`iosAppId` est encore l'ID de test Google.
- **Consentement RGPD** : l'app affiche au démarrage le message configuré dans AdMob (**Privacy & messaging → GDPR**) et ne charge aucune pub avant la réponse. Le joueur peut modifier son choix dans Réglages → « Confidentialité des annonces ». Sans message publié dans AdMob, les joueurs européens ne verront pas de pubs.
- **Interstitiel** : affiché toutes les 2 fins de niveau ou morts, en quittant l'écran de résultat, et jamais dans la minute qui suit une pub récompensée (`INTERSTITIAL_EVERY` dans `frontend/src/ads/index.ts`).
- **Backend** : à héberger (Render, Railway, Fly.io…) avec une base MongoDB Atlas, puis `EXPO_PUBLIC_BACKEND_URL` doit pointer vers son URL publique.

## Progression du jeu

- **Campagne** de 30 niveaux (`frontend/src/game/progression.ts`) : 2 à 3 vagues par niveau, un boss à la dernière vague, difficulté croissante.
- **Étoiles** : ★ niveau terminé, ★★ au moins 50 % de santé, ★★★ au moins 30 % de tirs à la tête.
- **Crédits** gagnés en combat, en fin de niveau (bonus + étoiles, ×2 avec une pub) et via la **récompense quotidienne** (série de 7 jours).
- **Arsenal** : améliorations permanentes (dégâts, santé max, chargeur, rechargement), 5 niveaux chacune.
- La progression est sauvegardée sur l'appareil (`frontend/src/hooks/use-progress.ts`, clé `np_progress_v1`).

## Pistes d'évolution

Voir le backlog dans [`memory/PRD.md`](memory/PRD.md) : nouvelles armes et bonus, boss toutes les N vagues, mini-carte, interstitiel en fin de partie, défi quotidien, statistiques de joueur en ligne.
