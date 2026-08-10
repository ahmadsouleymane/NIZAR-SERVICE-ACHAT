# Déploiement automatique (Vercel + Fly.io)

Ce dépôt déploie **automatiquement** l'application sur **Vercel** et le service OCR
sur **Fly.io**, à chaque `git push` sur la branche principale.

```
        git push (main)
             │
             ├────────► VERCEL ──► application web (Next.js)
             │            (intégration Git native)
             │
             └────────► FLY.IO ──► service OCR (PaddleOCR)
                           (GitHub Action + Dockerfile)
```

## Prérequis

1. Le dépôt est sur **GitHub** (déjà fait : `ahmadsouleymane/NIZAR-SERVICE-ACHAT`).
2. Un compte **Vercel** et un compte **Fly.io**.

---

## 1. Vercel — l'application web

1. **dashboard.vercel.com** → **Add New Project** → importer le dépôt GitHub.
2. Vercel détecte Next.js automatiquement (via `vercel.json`).
3. Renseigner les **variables d'environnement** (Settings → Environment Variables) :

   | Variable | Valeur |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | l'URL de ton projet Supabase |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | la clé « anon » |
   | `SUPABASE_SERVICE_ROLE_KEY` | la clé « service role » |
   | `OCR_SERVICE_URL` | l'URL du service OCR gratuit (Fly.io ou Render, voir ci-dessous) — **obligatoire**, le scan ne fonctionne pas sans |

4. **Deploy** → chaque `git push` sur `main` déploie automatiquement.

---

## 2. Fly.io — le service OCR

Le service OCR (PaddleOCR) vit dans `ocr-service/` (`app.py`, `Dockerfile`, `fly.toml`).
Un GitHub Action le redéploie automatiquement à chaque push touchant `ocr-service/`.

### Création (une seule fois)

1. **Créer un compte Fly.io** → https://fly.io/app/sign-up
2. **Installer le CLI** Fly :
   ```bash
   # macOS
   brew install flyctl
   ```
3. Se connecter : `flyctl auth login`
4. Dans le dossier `ocr-service/`, créer l'application :
   ```bash
   cd ocr-service
   fly launch --no-deploy
   ```
   (conserve le `fly.toml` et le `Dockerfile` fournis, confirme le nom `service-achat-ocr`)
5. Générer un **jeton API** : https://fly.io/user/personal_access_tokens →
   **Create token** → copier.
6. Sur GitHub (dépôt → Settings → Secrets and variables → Actions → **New secret**) :
   - Nom : `FLY_API_TOKEN`
   - Valeur : le jeton copié

### Premier déploiement

```bash
cd ocr-service
fly deploy
```

### Auto-déploiement (ensuite)

Chaque `git push` touchant `ocr-service/` déclenche le workflow
`.github/workflows/deploy-ocr-fly.yml` → redéploie automatiquement.

### Récupérer l'URL

```bash
flyctl apps open
# ou : flyctl status
```
L'URL est du type `https://service-achat-ocr.fly.dev` → la mettre dans
`OCR_SERVICE_URL` sur Vercel (puis redeployer Vercel).

### Coût

Fly.io est **facturé à l'usage** (petit montant, ~3-5 $/mois pour une machine
toujours active de 512 Mo). PaddleOCR a besoin de cette mémoire pour tourner.

---

## 3. Base de données Supabase (production)

Sur le projet Supabase de production :
1. Exécuter `supabase/migrations/0001_init.sql`, `0002_fix_rls.sql` puis
   `0003_routes_settings_receipts.sql` dans le **SQL Editor**.
2. Créer deux buckets de stockage publics : `plannings` et `receipts`.
3. Créer le premier compte admin (Authentication → Users), puis passer son rôle à `admin`.

---

## Tests en local

```bash
npm test        # tests unitaires
npm run build   # build de production
```
