---
title: OCR Service Achat
emoji: 🚌
colorFrom: blue
colorTo: cyan
sdk: docker
app_port: 7860
pinned: false
---

# OCR Service Achat

Service FastAPI qui reconnaît le texte des photos de planning avec PaddleOCR
(gratuit, open source, Apache 2.0) et renvoie les mots groupés en lignes
(format consommé par le parseur du template de l'application Nizar Transport).

- Endpoint : `POST /extract` (multipart, champ `file`)
- Health check : `GET /health` → `{"ok": true}`

## Déploiement (une seule fois)

1. Créer un compte gratuit sur https://huggingface.co/join
2. **New Space** → https://huggingface.co/new-space :
   - **Space name** : `nizar-ocr`
   - **SDK** : **Docker**
   - **Hardware** : **CPU basic · 2 vCPU · 16 GB RAM · Free** (gratuit, sans carte bancaire)
   - **Create Space**
3. Le Space se crée avec une page "Files" vide. Déposer les **4 fichiers** de ce dossier
   (`Dockerfile`, `app.py`, `requirements.txt`, `README.md`) via **Add file → Upload files** :
   - glisser-déposer les 4 fichiers puis **Commit changes to main**.
4. Hugging Face construit automatiquement (3-6 min, install de PaddleOCR).
5. L'URL du service est `https://<ton-compte>-nizar-ocr.hf.space`
   (ex. `https://ahmadsouleymane-nizar-ocr.hf.space`).
   → la mettre dans la variable `OCR_SERVICE_URL` sur Vercel.

## Mise en veille

Les Spaces gratuits s'endorment après **48 h** d'inactivité (pas 15 min comme Render)
et se réveillent seuls au premier appel (~1-2 min). En usage quotidien, le service
reste chaud.

## Test rapide

```bash
curl -F "file=@planning.jpg" https://<ton-compte>-nizar-ocr.hf.space/extract
curl https://<ton-compte>-nizar-ocr.hf.space/health
```
