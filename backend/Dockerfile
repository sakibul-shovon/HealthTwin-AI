FROM python:3.11-slim

# espeak-ng is required by kokoro for English phonemization
RUN apt-get update && apt-get install -y --no-install-recommends \
    espeak-ng \
    espeak-ng-data \
    libsndfile1 \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps first (separate layer — cached unless requirements.txt changes)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ── Pre-bake the Kokoro model into this image layer ──────────────────────────
# On first docker build this downloads ~300 MB from HuggingFace.
# After that it's a cached layer — zero download cost on every container start.
RUN python -c "\
from kokoro import KPipeline; \
import numpy as np; \
p = KPipeline(lang_code='a'); \
list(p('warmup', voice='af_bella', speed=1.0)); \
print('Kokoro model baked into image')"

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
