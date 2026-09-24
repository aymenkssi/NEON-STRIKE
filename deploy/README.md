# Déployer le backend Neon Strike sur un VPS

Ce dossier lance trois conteneurs avec Docker Compose :

| Service | Rôle | Exposé sur Internet |
|---|---|---|
| `caddy` | HTTPS automatique (Let's Encrypt) et reverse proxy | oui (ports 80 et 443) |
| `api` | API FastAPI : joueurs, classement, vérification des achats | non (seulement via Caddy) |
| `mongo` | Base MongoDB 7 avec mot de passe, données dans un volume | non |

**Prérequis** : un VPS Linux (Ubuntu 22.04/24.04 ou Debian 12, 1 vCPU et 1 Go de RAM suffisent), un nom de domaine, et l'accès root en SSH.

## 1. Nom de domaine

Chez votre registrar, créez un enregistrement DNS de type **A**, par exemple `api.votre-domaine.fr`, pointant vers l'adresse IP du VPS. Vérifiez avec `ping api.votre-domaine.fr` avant de continuer : Caddy en a besoin pour obtenir le certificat HTTPS.

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

- `DOMAIN` : le domaine de l'étape 1, par exemple `api.votre-domaine.fr`.
- `MONGO_PASSWORD` : un mot de passe long, générable avec `openssl rand -hex 24`.
- `PURCHASE_VERIFICATION=google`.

Copiez ensuite la clé du compte de service Google (étape 5) dans `secrets/play-service-account.json`. Tant qu'elle n'est pas là, l'API refuse de vérifier les achats (erreur 503) : aucun crédit ne peut être accordé sans vérification.

## 4. Lancer

```bash
docker compose up -d --build
docker compose ps                     # les 3 services doivent être "running"/"healthy"
curl https://api.votre-domaine.fr/api/  # {"message":"Neon Strike API online"}
```

Mise à jour après un `git pull` : `docker compose up -d --build`.
Journaux : `docker compose logs -f api`.

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

## 6. Brancher l'application

Dans `frontend/eas.json`, ajoutez l'URL de l'API aux variables du profil `production` (et `preview` si vous voulez tester avec le vrai serveur) :

```json
"env": {
  "EXPO_PUBLIC_AD_MODE": "production",
  "EXPO_PUBLIC_BACKEND_URL": "https://api.votre-domaine.fr"
}
```

Pour le développement local, mettez la même variable dans `frontend/.env`.

## 7. Sauvegardes

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
| `POST /api/purchases/verify` | Interroge Google Play. Répond `valid` uniquement si l'achat est payé. Un même reçu ne peut servir qu'à un seul joueur et un seul produit. |

Les crédits par produit sont définis côté serveur (`PRODUCT_CREDITS` dans `backend/server.py`) et doivent correspondre à `frontend/src/iap/catalog.ts`.
