# ── Stage 1: builder ────────────────────────────────────────────────────────
# Install dependencies with build tools present, then discard the toolchain.
FROM python:3.12-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
# Install into an isolated prefix so we can COPY just the packages into the
# lean runtime stage without carrying over the compiler toolchain.
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ── Stage 2: production runtime ─────────────────────────────────────────────
FROM python:3.12-slim AS production

WORKDIR /app

# libpq5 is the runtime-only PostgreSQL client library (psycopg2 needs it).
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 && \
    rm -rf /var/lib/apt/lists/*

# Copy installed packages from builder (no compiler toolchain in this layer).
COPY --from=builder /install /usr/local

COPY . .

# Run as non-root to limit blast radius if the process is compromised.
RUN groupadd --system app && useradd --system --gid app app
USER app

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
