# Service OCR PaddleOCR — conteneur pour Hugging Face Spaces (Docker, gratuit)
# Hugging Face attend que l'app écoute sur le port 7860.

FROM python:3.10-slim

# Bibliothèques système requises par OpenCV / PaddleOCR
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py ./

# HF Spaces détecte automatiquement le port 7860
EXPOSE 7860
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]
