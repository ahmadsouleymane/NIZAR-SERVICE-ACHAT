# Déploiement automatique (Vercel + Hugging Face Spaces)

Ce dépôt déploie l'application web sur **Vercel** (gratuit) et le service OCR sur
**Hugging Face Spaces** (gratuit, Docker). Aucun coût, aucune carte bancaire.

```
        (app web)        VERCEL ──► Next.js  (intégration Git GitHub)
        (service OCR)    HUGGING FACE SPACES ──► PaddleOCR (Docker, 16 Go RAM)
```

## Prérequis

1. Le dépôt est sur **GitHub** (déjà fait : `ahmadsouleymane/NIZAR-SERVICE-ACHAT`).
2. Un compte **Vercel** (gratuit) et un compte **Hugging Face** (gratuit).

---

## 1. Hugging Face Spaces — le service OCR

Fichiers prêts dans `ocr-service-hf/` (`Dockerfile`, `app.py`, `requirements.txt`,
`README.md`). Hugging Face offre **16 Go de RAM sur le plan gratuit**, bien assez pour
PaddleOCR (le plan gratuit de Render, 512 Mo, faisait planter le service).

### Création (une seule fois)

1. **Créer un compte Hugging Face** → https://huggingface.co/join
2. **New Space** → https://huggingface.co/new-space :
   - **Space name** : `nizar-ocr`
   - **SDK** : **Docker**
   - **Hardware** : **CPU basic · 2 vCPU · 16 GB RAM · Free** (gratuit)
   - **Create Space**
3. Sur la page du Space, onglet **Files** → **Add file** → **Upload files** →
   déposer les **4 fichiers** de `ocr-service-hf/` (`Dockerfile`, `app.py`,
   `requirements.txt`, `README.md`) → **Commit changes to main**.
4. Hugging Face construit automatiquement (~3-6 min, installation de PaddleOCR incluse).

### Récupérer l'URL

L'URL est `https://<ton-compte>-nizar-ocr.hf.space`
(ex. `https://ahmadsouleymane-nizar-ocr.hf.space`). Vérifier :
```bash
curl https://<ton-compte>-nizar-ocr.hf.space/health   # → {"ok": true}
```
→ la mettre dans `OCR_SERVICE_URL` sur Vercel (voir § 2).

### Mise en veille

Les Spaces gratuits s'endorment après **48 h** d'inactivité et se réveillent seuls
au premier appel (~1-2 min). En usage quotidien le service reste chaud.

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
   | `OCR_SERVICE_URL` | l'URL du Space Hugging Face (voir § 1) — **obligatoire**, le scan ne fonctionne pas sans |

4. **Deploy** → chaque `git push` sur `main` déploie automatiquement.

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
