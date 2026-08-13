# Déploiement automatique (Vercel)

L'application web se déploie sur **Vercel** (gratuit). La reconnaissance des plannings
se fait **100% dans le navigateur** avec Tesseract.js (WASM, gratuit, sans serveur) —
**aucun service OCR externe à héberger**, aucune variable d'environnement de ce type.

```
        git push (main)
             │
             └────────► VERCEL ──► application web (Next.js)
                            (intégration Git GitHub)
```

## Prérequis

1. Le dépôt est sur **GitHub** (déjà fait : `ahmadsouleymane/NIZAR-SERVICE-ACHAT`).
2. Un compte **Vercel** (gratuit).

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
   | `DEEPSEEK_TEXT_API_KEY` | *(optionnel)* clé API DeepSeek pour la correction IA du planning |
   | `DEEPSEEK_TEXT_MODEL` | *(optionnel)* modèle texte, défaut `deepseek-chat` |

   *(Pas d'`OCR_SERVICE_URL` : le scan Tesseract est local au navigateur.)*
   ⚠️ **Ne jamais définir `DEEPSEEK_API_KEY`** : l'environnement de dev injecte une
   fausse clé sous ce nom qui écrase `.env.local`. Seule `DEEPSEEK_VISION_API_KEY` est valable.
4. **Deploy** → chaque `git push` sur `main` déploie automatiquement.

---

## 2. Base de données Supabase (production)

Sur le projet Supabase de production :
1. Exécuter `supabase/migrations/0001_init.sql`, `0002_fix_rls.sql` puis
   `0003_routes_settings_receipts.sql` dans le **SQL Editor**.
2. Créer deux buckets de stockage : `plannings` (**public**) et `receipts`
   (**privé** — les reçus s'affichent via des URL signées, voir `(app)/recus/page.tsx`).
3. Créer le premier compte admin (Authentication → Users), puis passer son rôle à `admin`.

---

## Notes sur la reconnaissance

- Le modèle OCR (Tesseract.js) est téléchargé au **premier scan** (WASM ~3 Mo +
  langue française ~15 Mo, depuis un CDN), puis mis en cache dans le navigateur.
  Les scans suivants sont rapides.
- Sans connexion internet au tout premier scan, la lecture échoue (il faut une fois
  le modèle téléchargé). Ensuite, tout est local.
- Les anciens fichiers `ocr-service/` (PaddleOCR) et `ocr-service-hf/` (Hugging Face)
  sont conservés dans le dépôt à titre de référence, mais ne sont plus utilisés.

## Correction IA optionnelle (DeepSeek, texte)

- Le bouton « Lire avec l’IA » fait d'abord l'OCR **local** (Tesseract), puis
  envoie le **texte brut** à la route `/api/ai/extract-planning`, qui appelle
  DeepSeek (texte uniquement) pour **corriger et structurer** en JSON. La clé
  reste côté serveur.
- **Pourquoi texte** : l'API publique DeepSeek ne supporte PAS les images
  (refus `image_url`, vérifié en réel). Tesseract « voit », DeepSeek « comprend ».
- **Coût** : minime (quelques milliers de tokens texte par scan).
- **Confidentialité** : seul le texte OCR (n° de bus, noms, téléphones) part
  vers DeepSeek — pas les photos. La lecture Tesseract reste 100 % locale.
- En cas d'échec (clé absente, timeout), l'app affiche l'erreur et la lecture
  classique reste disponible.

---

## Tests en local

```bash
npm test        # tests unitaires
npm run build   # build de production
```
