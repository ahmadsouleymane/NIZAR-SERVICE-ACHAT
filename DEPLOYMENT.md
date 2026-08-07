# Déploiement automatique (Vercel + Render)

Ce dépôt déploie **automatiquement** l'application sur **Vercel** et le service OCR
sur **Render**, à chaque `git push` sur la branche principale.

## Vue d'ensemble

```
        git push (main)
             │
             ├────────────► Vercel ──► application web (Next.js)
             │              (intégration Git native)
             │
             └────────────► Render ──► service OCR (PaddleOCR)
                            (blueprint render.yaml)
```

## Prérequis

1. Le dépôt doit être sur **GitHub**.
2. Un compte **Vercel** et un compte **Render**.

---

## 1. GitHub Action (contrôle qualité automatique)

À chaque push, `.github/workflows/ci.yml` lance **tests + build + lint**.
Si ça échoue, ne déploiez pas (le push est signalé en rouge sur GitHub).

---

## 2. Vercel — l'application web

1. **dashboard.vercel.com** → **Add New Project** → importer le dépôt GitHub.
2. Vercel détecte Next.js automatiquement (via `vercel.json`).
3. Renseigner les **variables d'environnement** (Settings → Environment Variables) :

   | Variable | Valeur |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | l'URL de ton projet Supabase |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | la clé « anon » |
   | `SUPABASE_SERVICE_ROLE_KEY` | la clé « service role » |
   | `GEMINI_API_KEY` | ta clé Google Gemini |
   | `GEMINI_MODEL` | `gemini-3.6-flash` |
   | `OCR_SERVICE_URL` | l'URL du service Render (voir ci-dessous), ou laisser vide pour utiliser Gemini seul |

4. **Deploy** → à partir de maintenant, chaque `git push` sur `main` déploie automatiquement.

---

## 3. Render — le service OCR

1. **dashboard.render.com** → **New** → **Blueprint** → sélectionner le dépôt GitHub.
   Render lit automatiquement `render.yaml` (root `ocr-service`, Python + Uvicorn).
2. Le service `service-achat-ocr` est créé avec `autoDeploy: true` → chaque
   `git push` redéploie automatiquement.
3. **Instance** : le blueprint utilise le plan `starter` (recommandé). Le plan
   gratuit dort après 15 min d'inactivité (premier scan lent ~1 min).
4. Copier l'URL du service (ex. `https://service-achat-ocr.onrender.com`) et la
   mettre dans `OCR_SERVICE_URL` sur Vercel (puis redeployer Vercel).

---

## 4. Base de données Supabase

Sur le projet Supabase **de production** :
1. Exécuter `supabase/migrations/0001_init.sql` puis `supabase/migrations/0002_fix_rls.sql`
   dans le **SQL Editor**.
2. Créer un bucket de stockage public nommé `plannings`.
3. Créer le premier compte admin (Authentication → Users), puis passer son rôle
   à `admin` dans la table `profiles`.

---

## Tests en local (rapide)

```bash
npm test        # tests unitaires
npm run build   # build de production
```
