# Déployer le backend Neon Strike sur un VPS

Ce dossier lance trois conteneurs avec Docker Compose :

| Service | Rôle | Exposé sur Internet |
|---|---|---|
| `caddy` | HTTPS automatique (Let's Encrypt) : sert l'API sur `api.gameneonstrike.com` et le site sur `gameneonstrike.com` | oui (ports 80 et 443) |
| `api` | API FastAPI : joueurs, classement, vérification des achats | non (seulement via Caddy) |
| `mongo` | Base MongoDB 7 avec mot de passe, données dans un volume | non |

> **Votre VPS a déjà Traefik devant d'autres applications ?** Utilisez la variante `docker-compose.traefik.yml` : elle n'installe pas Caddy, n'ouvre aucun port, et laisse votre Traefik router et certifier les domaines. Voir la section « Serveur avec Traefik » plus bas ; les autres étapes restent identiques.

**Prérequis** : un VPS Linux (Ubuntu 22.04/24.04 ou Debian 12, 1 vCPU et 1 Go de RAM suffisent), un nom de domaine, et l'accès root en SSH.

## 1. Nom de domaine `gameneonstrike.com`

Dans la zone DNS du domaine, chez votre registrar, créez ou modifiez ces 3 enregistrements, en remplaçant `IP_DU_VPS` par l'adresse IPv4 du VPS :

| Type | Nom | Valeur |
|---|---|---|
| A | `@` (le domaine nu) | `IP_DU_VPS` |
| A | `www` | `IP_DU_VPS` |
| A | `api` | `IP_DU_VPS` |

Aujourd'hui, `gameneonstrike.com` et `www` pointent vers `81.88.57.68` (probablement la page par défaut du registrar) et `api` n'existe pas. Supprimez aussi un éventuel enregistrement **AAAA** (IPv6) qui ne pointerait pas vers le VPS.

Avant de continuer, vérifiez que `ping api.gameneonstrike.com` répond avec l'IP du VPS (la propagation prend de quelques minutes à quelques heures). Caddy en a besoin pour obtenir les certificats HTTPS.

## 2. Préparer le VPS

```bash
# Docker et Docker Compose
curl -fsSL https://get.docker.com | sh

# Pare-feu : SSH + HTTP + HTTPS uniquement
apt install -y ufw
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw enable

# Récupérer le projet
git clone https://github.com/aymenkssi/NEON-STRIKE.git /opt/neon-strike
cd /opt/neon-strike/deploy
```

## 3. Configurer

```bash
cp .env.example .env
nano .env
```

- `DOMAIN=api.gameneonstrike.com` et `SITE_DOMAIN=gameneonstrike.com` (déjà remplis).
- `MONGO_PASSWORD` : un mot de passe long, générable avec `openssl rand -hex 24`.
- `PURCHASE_VERIFICATION=google`.

Copiez ensuite la clé du compte de service Google (étape 5) dans `secrets/play-service-account.json`. Tant qu'elle n'est pas là, l'API refuse de vérifier les achats (erreur 503) : aucun crédit ne peut être accordé sans vérification.

## 4. Lancer

```bash
docker compose up -d --build
docker compose ps                     # les 3 services doivent être "running"/"healthy"
curl https://api.gameneonstrike.com/api/   # {"message":"Neon Strike API online"}
curl https://gameneonstrike.com/app-ads.txt  # google.com, pub-7488746561313974, DIRECT, f08c47fec0942fa0
```

Mise à jour après un `git pull` : `docker compose up -d --build`.
Journaux : `docker compose logs -f api`.

## Serveur avec Traefik (variante)

| Service | Rôle | Réseaux |
|---|---|---|
| `api` | API FastAPI, routée par Traefik sur `api.gameneonstrike.com` | interne + réseau de Traefik |
| `site` | nginx qui sert `deploy/site/`, routé sur `gameneonstrike.com` et `www` | réseau de Traefik |
| `mongo` | MongoDB, uniquement sur le réseau interne | interne |

1. **Relevez 3 valeurs de votre Traefik**, dans sa configuration (`traefik.yml`, `traefik.toml` ou les arguments `--entrypoints…` / `--certificatesresolvers…` de son conteneur) :
   ```bash
   docker network ls                                   # réseau partagé avec Traefik, ex. "traefik" ou "proxy"
   docker inspect traefik --format '{{json .Args}}'    # nom du conteneur à adapter ; sinon lire traefik.yml
   ```
   - **Réseau** : celui auquel le conteneur Traefik est connecté.
   - **Entrypoint HTTPS** : par exemple `websecure` pour `--entrypoints.websecure.address=:443`.
   - **Certresolver** : par exemple `letsencrypt` pour `--certificatesresolvers.letsencrypt.acme…`.
2. **Dans `deploy/.env`** : décommentez `COMPOSE_FILE=docker-compose.traefik.yml` et renseignez `TRAEFIK_NETWORK`, `TRAEFIK_ENTRYPOINT` et `TRAEFIK_CERTRESOLVER`. Grâce à `COMPOSE_FILE`, toutes les commandes `docker compose` (et `backup.sh`) utilisent automatiquement cette variante.
3. **Lancez** `docker compose up -d --build` depuis `deploy/`. Le projet s'appelle `neon-strike` et ses routeurs Traefik `neon-api` et `neon-site` : ils n'entrent pas en conflit avec vos autres applications.
4. **Si Traefik redirige HTTP vers HTTPS globalement** (cas le plus courant), rien d'autre à faire. Sinon, les domaines ne répondront qu'en `https://`, ce qui suffit pour l'app.

## 5. Autoriser le serveur à vérifier les achats Google Play

1. **Google Cloud Console**, dans un projet existant ou nouveau :
   - activez l'API **Google Play Android Developer API** ;
   - dans **IAM** → **Comptes de service**, créez un compte de service (par exemple `neon-strike-verifier`) ;
   - dans l'onglet **Clés**, choisissez **Ajouter une clé** → **JSON** et téléchargez le fichier.
2. **Play Console** → **Utilisateurs et autorisations** → **Inviter un utilisateur** :
   - saisissez l'e-mail du compte de service (`…@….iam.gserviceaccount.com`) ;
   - dans **Autorisations de l'application**, choisissez Neon Strike et cochez **Afficher les données financières** ainsi que **Gérer les commandes et les abonnements** ;
   - enregistrez.
3. **Envoyez la clé sur le VPS**, puis redémarrez l'API :
   ```bash
   scp play-service-account.json root@IP_DU_VPS:/opt/neon-strike/deploy/secrets/
   docker compose restart api
   ```

> Google peut mettre jusqu'à 24 h à activer les droits d'un nouveau compte de service. Pendant ce délai, la vérification renvoie une erreur et les achats restent en attente : ils sont crédités automatiquement dès que ça fonctionne.

La clé JSON donne accès à votre compte Play : ne la commitez jamais (le dossier `secrets/` est ignoré par git) et ne la partagez pas.

## 6. Application et site web

- L'application est déjà branchée sur `https://api.gameneonstrike.com` pour tous les profils de build (`frontend/eas.json`).
- **Site** (`deploy/site/`) : page d'accueil, `app-ads.txt` pour AdMob et politique de confidentialité sur `https://gameneonstrike.com/privacy`. **Avant la mise en ligne**, remplacez `[NOM DU RESPONSABLE]` et `[ADRESSE E-MAIL DE CONTACT]` dans `privacy.html` et `index.html`.
- **Play Console** → **Fiche du Store** : renseignez `https://gameneonstrike.com` comme site web et `https://gameneonstrike.com/privacy` comme règles de confidentialité. AdMob vérifie ensuite automatiquement `app-ads.txt` (sous 24 h environ).

## 7. Administration : packs de crédits et messages aux joueurs

Page : **https://api.gameneonstrike.com/admin**. Connectez-vous avec le `ADMIN_TOKEN` de `deploy/.env` (générez-le avec `openssl rand -hex 32` ; vide = administration désactivée). Le jeton reste dans l'onglet du navigateur jusqu'à sa fermeture.

**Packs de crédits** : pour chaque pack, vous réglez le nombre de crédits, le bonus et l'étiquette affichés, l'ordre et la visibilité. Les joueurs voient les changements au prochain lancement du jeu, et les crédits accordés après un achat vérifié sont ceux configurés ici.

- **Le prix en euros se règle uniquement dans Play Console** : Google encaisse ce prix et l'app affiche toujours celui de Google.
- **Pour ajouter un pack**, créez d'abord le produit dans Play Console (**Monétiser** → **Produits intégrés**), puis ajoutez-le ici avec **exactement le même ID**. Il apparaît sans republier l'app.
- **Un pack déjà vendu** ne peut pas être supprimé, seulement masqué : les achats en cours restent honorés.
- **Exemple de promo** : passez `coins_1200` de 1 200 à 2 000 crédits avec l'étiquette « PROMO WEEK-END », publiez un message « Promotion », puis remettez 1 200 lundi.

**Messages** : titre, texte, type (Information, Promotion avec un bouton vers la boutique, Alerte), dates de début et de fin optionnelles. Chaque joueur voit un message une seule fois, à l'ouverture du menu. Au plus 5 messages sont en ligne à la fois.

## 8. Sauvegardes

```bash
./backup.sh     # crée backups/neon-AAAA-MM-JJ_HHMM.gz
crontab -e      # puis ajouter :
0 4 * * * cd /opt/neon-strike/deploy && ./backup.sh >> backups/backup.log 2>&1
```

Les 14 dernières sauvegardes sont conservées. Copiez-les régulièrement hors du VPS (par exemple avec `rsync` vers un autre serveur ou un stockage objet).
Restauration :

```bash
docker compose exec -T mongo mongorestore --gzip --archive=/backups/neon-XXXX.gz \
  --username "$MONGO_USER" --password "$MONGO_PASSWORD" --authenticationDatabase admin --drop
```

## Ce que fait l'API

| Route | Rôle |
|---|---|
| `POST /api/players` | Crée un joueur anonyme et renvoie une clé secrète. Le serveur n'en garde qu'une empreinte (SHA-256). |
| `POST /api/scores` | Enregistre un score. Joueur identifié obligatoire, contrôle de vraisemblance, un envoi toutes les 5 s au plus, un seul meilleur score par joueur. |
| `GET /api/leaderboard` | Top 100 maximum. |
| `GET /api/leaderboard/me` | Rang du joueur. |
| `GET /api/config` | Packs visibles et messages en ligne, lus par l'app au démarrage. |
| `/api/admin/…` et `/admin` | Administration (jeton `ADMIN_TOKEN` obligatoire). |
| `POST /api/purchases/verify` | Interroge Google Play. Répond `valid` uniquement si l'achat est payé. Un même reçu ne peut servir qu'à un seul joueur et un seul produit. |

Les crédits par produit sont ceux de la page d'administration. `frontend/src/iap/catalog.ts` ne sert que de liste par défaut quand le serveur est injoignable.
