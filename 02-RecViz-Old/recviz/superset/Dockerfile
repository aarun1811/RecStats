FROM python:3.12-slim

# System deps for database drivers
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements-superset.txt .
RUN pip install --no-cache-dir -r requirements-superset.txt

COPY superset_config.py /app/superset_config.py

ENV SUPERSET_CONFIG_PATH=/app/superset_config.py
ENV FLASK_APP=superset

# Init script
COPY init_superset.sh /app/init_superset.sh
RUN chmod +x /app/init_superset.sh

EXPOSE 8088

CMD ["gunicorn", "-w", "4", "-k", "gevent", "--timeout", "120", \
     "-b", "0.0.0.0:8088", "superset.app:create_app()"]
