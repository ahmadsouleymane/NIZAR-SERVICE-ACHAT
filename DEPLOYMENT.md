# Déploiement automatique (Vercel + Render)

Ce dépôt déploie **automatiquement** l'application sur **Vercel** et le service OCR
sur **Render**, à chaque `git push` sur la branche principale.

```
        git push (main)
             │
             ├────────► VERCEL ──► application web (Next.js)
             │            (intégration Git native)
             │
             └────────► RENDER ──► service OCR (PaddleOCR)
                           (intégration Git native, Root Directory: ocr-service)
```

## Prérequis

1. Le dépôt est sur **GitHub** (déjà fait : `ahmadsouleymane/NIZAR-SERVICE-ACHAT`).
2. Un compte **Vercel** et un compte **Render** (les deux ont un plan gratuit / à l'usage,
   aucun jeton API ni secret GitHub à configurer — l'intégration Git se fait depuis leur
   dashboard respectif).

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
   | `OCR_SERVICE_URL` | l'URL du service OCR (Render, voir ci-dessous) — **obligatoire**, le scan ne fonctionne pas sans |

4. **Deploy** → chaque `git push` sur `main` déploie automatiquement.

---

## 2. Render — le service OCR

Le service OCR (PaddleOCR) vit dans `ocr-service/` (`app.py`, `Dockerfile`, `requirements.txt`).
Render redéploie automatiquement à chaque push sur `main` une fois le service connecté (pas
besoin de GitHub Action ni de jeton API).

### Création (une seule fois)

1. **Créer un compte Render** → https://dashboard.render.com/register
2. **New** → **Web Service** → connecter le dépôt GitHub `NIZAR-SERVICE-ACHAT`.
3. Configurer :
   - **Root Directory** : `ocr-service`
   - **Environment** : `Python 3`
   - **Build Command** : `pip install -r requirements.txt`
   - **Start Command** : `uvicorn app:app --host 0.0.0.0 --port $PORT`
   - **Instance Type** : au moins **Starter** (512 Mo) — le plan gratuit dort après 15 min
     d'inactivité (premier scan lent, ~1 min de réveil) et PaddleOCR est gourmand en RAM.
4. **Create Web Service** → premier déploiement automatique (~3-5 min, téléchargement des
   modèles PaddleOCR inclus).

### Récupérer l'URL

Une fois déployé, Render affiche l'URL du service (type `https://xxx.onrender.com`)
en haut du dashboard → la mettre dans `OCR_SERVICE_URL` sur Vercel (puis redeployer Vercel).

### Auto-déploiement (ensuite)

Chaque `git push` sur `main` déclenche un nouveau déploiement Render automatiquement
(intégration Git native, rien à configurer côté GitHub Actions).

### Coût

Render facture à l'usage selon l'instance choisie (le plan **Starter** à 512 Mo suffit,
quelques dollars/mois ; le plan gratuit fonctionne aussi mais s'endort après inactivité).

---

## 3. Base de données Supabase (production)

Sur le projet Supabase de production :
1. Exécuter `supabase/migrations/0001_init.sql`, `0002_fix_rls.sql` puis
   `0003_routes_settings_receipts.sql` dans le **SQL Editor**.
2. Créer deux buckets de stockage : `plannings` (**public**) et `receipts`
   (**privé** — les reçus s'affichent via des URL signées, voir `(app)/recus/page.tsx`).
3. Créer le premier compte admin (Authentication → Users), puis passer son rôle à `admin`.

---

## Tests en local

```bash
npm test        # tests unitaires
npm run build   # build de production
```
