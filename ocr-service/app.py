# Service OCR auto-hébergé (PaddleOCR) pour lire les plannings de départs.
# Déploiement : Render (service Web Python). Voir README.md
#
# Endpoint : POST /extract  (multipart "file")
#   Renvoie les mots reconnus groupés en lignes, au format attendu par le
#   parseur du template (voir docs/planning-template.md) :
#   {"lines": [{"y": 123, "tokens": [{"text": "CG", "x0": 0, "y0": 0, "x1": 40, "y1": 20}, ...]}, ...]}

import cv2
import numpy as np
from fastapi import FastAPI, UploadFile, File
from paddleocr import PaddleOCR

app = FastAPI(title="OCR Service Achat", version="1.0")

_ocr = None


def get_ocr():
    global _ocr
    if _ocr is None:
        # PP-OCRv5 (léger, adapté CPU) ; français + chiffres
        _ocr = PaddleOCR(
            lang="fr",
            use_doc_orientation_classify=False,
            use_doc_unwarping=False,
            use_textline_orientation=False,
        )
    return _ocr


@app.on_event("startup")
def preload_ocr():
    # Télécharge/charge les modèles au démarrage du conteneur plutôt qu'au premier
    # scan : Render ne route le trafic qu'une fois le démarrage terminé, ce qui
    # évite un premier scan qui expire côté client pendant le téléchargement.
    get_ocr()


def poly_to_bbox(poly):
    """Convertit un polygone (points [x,y] du contour) en boîte x0,y0,x1,y1."""
    pts = np.asarray(poly).reshape(-1, 2)
    xs, ys = pts[:, 0], pts[:, 1]
    return int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/extract")
async def extract(file: UploadFile = File(...)):
    data = await file.read()
    image = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
    ocr = get_ocr()
    results = ocr.predict(image)

    words = []  # (y_center, x0, y0, x1, y1, text)
    for res in results:
        polys = res.get("dt_polys", [])
        texts = res.get("rec_texts", [])
        scores = res.get("rec_scores", [])
        for poly, text, score in zip(polys, texts, scores):
            if not text or not text.strip():
                continue
            if float(score) < 0.3:  # ignore les mots très peu confiants
                continue
            x0, y0, x1, y1 = poly_to_bbox(poly)
            words.append(((y0 + y1) / 2, x0, y0, x1, y1, text.strip()))

    # regroupe les mots en lignes (même hauteur Y) puis trie par X
    words.sort(key=lambda w: (w[0], w[2]))
    lines = []
    current = []
    last_y = None
    for w in words:
        y = w[0]
        if last_y is not None and abs(y - last_y) > 12:  # changement de ligne
            lines.append(current)
            current = []
        current.append(w)
        last_y = y
    if current:
        lines.append(current)

    out_lines = []
    for line_words in lines:
        line_words.sort(key=lambda w: w[1])  # tri par x0
        tokens = [
            {"text": w[5], "x0": w[1], "y0": w[2], "x1": w[3], "y1": w[4]}
            for w in line_words
        ]
        ys = [w[2] for w in line_words]
        out_lines.append({"y": sum(ys) / len(ys), "tokens": tokens})

    return {"lines": out_lines}
