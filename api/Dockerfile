# Build from the project root:  docker build -f api/Dockerfile -t resume-api .
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    NLTK_DATA=/usr/local/share/nltk_data \
    HF_HOME=/opt/hf-cache

WORKDIR /app

COPY requirements.txt ./requirements.txt
COPY api/requirements.txt ./api/requirements.txt
RUN pip install --no-cache-dir -r api/requirements.txt

# Download the NLTK data and the embedding model at build time so the first request is fast.
RUN python -c "import nltk; [nltk.download(p, download_dir='/usr/local/share/nltk_data') for p in ('stopwords','wordnet','omw-1.4','punkt','punkt_tab')]" \
 && python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"

COPY api ./api
COPY src ./src
COPY models ./models
COPY data ./data

RUN useradd --create-home appuser && chown -R appuser /app /opt/hf-cache
USER appuser

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')" || exit 1

# GEMINI_API_KEY is supplied at run time (docker-compose reads it from .env); it is never baked into the image.
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
