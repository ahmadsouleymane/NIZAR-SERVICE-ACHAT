# Service OCR — PaddleOCR (hébergé sur Render)

Service FastAPI qui reconnaît le texte des photos de planning avec PaddleOCR
(gratuit, open source, Apache 2.0) et renvoie les mots groupés en lignes
(format consommé par le parseur du template de l'application).

## Déploiement sur Render

1. **Pousser ce dossier sur GitHub** (le dossier `ocr-service/` à la racine du dépôt).
2. Sur **Render** (dashboard.render.com) → **New** → **Web Service** → connecter le dépôt.
3. Configurer :
   - **Root directory** : `ocr-service`
   - **Build command** : `pip install -r requirements.txt`
   - **Start command** : `uvicorn app:app --host 0.0.0.0 --port $PORT`
   - **Instance Type** : au moins **Starter** (512 Mo) — le free tier dort après 15 min
     d'inactivité (premier scan lent ~1 min) et PaddleOCR est gourmand en RAM.
   - La version de Python est fixée par `.python-version` (3.10) — `paddlepaddle` n'a pas
     de version compatible avec les Python plus récents que Render utilise par défaut.
4. **Deploy**.
5. Copier l'URL du service (ex. `https://mon-ocr.onrender.com`) → la mettre dans
   l'application Next.js : variable `OCR_SERVICE_URL` (`.env.local` et Vercel).

## Endpoints

- `GET /health` → `{"ok": true}`
- `POST /extract` (multipart, champ `file`) → `{"lines": [{"y": 123, "tokens": [...]}]}`

## Notes

- Modèles téléchargés au premier démarrage (~1-2 min, ~300 Mo).
- Si la RAM est insuffisante (OOM), passer l'instance Render en `Starter+` ou
  `Pro`, ou réduire à `lang="fr"` avec PP-OCRv5 mobile (déjà le cas).
- Test rapide en local : `uvicorn app:app --reload` puis
  `curl -F "file=@planning.jpg" http://localhost:8000/extract`
