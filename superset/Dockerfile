FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    SUPERSET_CONFIG_PATH=/app/superset_config.py

WORKDIR /app

# System deps for psycopg2, pg_isready, and Superset native extensions
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Install Superset + drivers
RUN pip install --no-cache-dir \
    apache-superset \
    psycopg2-binary \
    redis \
    cachelib

# Copy config and entrypoint
COPY superset_config.py /app/superset_config.py
COPY superset-entrypoint.sh /app/superset-entrypoint.sh
RUN chmod +x /app/superset-entrypoint.sh

EXPOSE 8088

ENTRYPOINT ["/app/superset-entrypoint.sh"]
