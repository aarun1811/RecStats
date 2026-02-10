# Agent 10 — Infrastructure

## Mission
Polish Docker Compose setup, create Superset Dockerfile, write init/seed scripts, and ensure the full stack can start with one command.

## Read First
- `/Users/aarun/Workspace/Projects/RecStats/02-RecViz/CLAUDE.md`
- `/Users/aarun/Workspace/Projects/RecStats/02-RecViz/agents/AGENT_00_RESULT.md`

## Working Directory
`/Users/aarun/Workspace/Projects/RecStats/02-RecViz/recviz/`

## What Already Exists
- `infrastructure/docker-compose.yml` — basic services defined
- `infrastructure/nginx/nginx.conf` — reverse proxy config
- `superset/superset_config.py` — Superset configuration
- `Makefile` — basic make targets
- `backend/Dockerfile` — backend container
- `.gitignore`

## Files To Create/Update

### 1. `superset/Dockerfile`
```dockerfile
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
```

### 2. `superset/requirements-superset.txt`
```
apache-superset>=4.0
psycopg2-binary>=2.9
redis>=5.0
gevent>=24.0
python-oracledb>=2.0
pyhive[hive]>=0.7
elasticsearch-dbapi>=0.2
```

### 3. `superset/init_superset.sh`
```bash
#!/bin/bash
set -e

echo "Initializing Superset..."

# Upgrade database
superset db upgrade

# Create admin user (idempotent)
superset fab create-admin \
    --username admin \
    --firstname Admin \
    --lastname User \
    --email admin@recviz.local \
    --password admin \
    || true  # Don't fail if already exists

# Init default roles and permissions
superset init

echo "Superset initialization complete."
```

### 4. `frontend/Dockerfile`
```dockerfile
# Development
FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
```

Also create `frontend/Dockerfile.prod`:
```dockerfile
# Production build
FROM node:22-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### 5. Update `infrastructure/docker-compose.yml`
Polish the existing compose file:
- Add healthchecks for all services
- Add proper depends_on with condition: service_healthy
- Add resource limits
- Add named networks
- Add init container for Superset (runs init_superset.sh before main service)
- Volume mounts for development hot-reload
- Environment variable files (.env)

### 6. Create `infrastructure/docker-compose.prod.yml`
Production overrides:
- Frontend built as static files served by Nginx
- Backend with multiple Uvicorn workers
- Superset with Gunicorn
- No volume mounts (use built images)
- Resource limits

### 7. `infrastructure/scripts/setup-dev.sh`
```bash
#!/bin/bash
# One-command dev setup
set -e

echo "Setting up RecViz development environment..."

# Check prerequisites
command -v node >/dev/null || { echo "Node.js required"; exit 1; }
command -v python3 >/dev/null || { echo "Python 3.12+ required"; exit 1; }
command -v docker >/dev/null || { echo "Docker required"; exit 1; }

# Start infrastructure services
docker compose -f infrastructure/docker-compose.yml up -d redis postgres

# Wait for services
echo "Waiting for PostgreSQL..."
until docker compose -f infrastructure/docker-compose.yml exec -T postgres pg_isready; do sleep 1; done

echo "Waiting for Redis..."
until docker compose -f infrastructure/docker-compose.yml exec -T redis redis-cli ping; do sleep 1; done

# Frontend setup
echo "Setting up frontend..."
cd frontend && npm install && cd ..

# Backend setup
echo "Setting up backend..."
cd backend && pip install -e ".[dev]" && cd ..

echo "Development environment ready!"
echo "Run 'make dev' to start all services"
```

### 8. `infrastructure/scripts/seed-data.sh`
```bash
#!/bin/bash
# Seed sample data for development
set -e

echo "Seeding RecViz with sample data..."

# Register Oracle database connection in Superset (mock/local for dev)
# Register Elasticsearch connection
# Create sample datasets
# Create sample charts pointing to datasets
# Note: This would use curl to hit Superset's API

echo "Seeding complete."
```

Also create a Python seed script `backend/app/seed.py` that:
- Creates mock dashboard configs
- Creates sample chart definitions
- Creates sample break data (for dev without Oracle)

### 9. Update `Makefile`
Enhance with additional targets:
```makefile
.PHONY: setup dev frontend backend superset test lint build clean docker-up docker-down seed init-superset

setup:
	bash infrastructure/scripts/setup-dev.sh

dev: docker-up
	@echo "Starting frontend and backend..."
	@(cd frontend && npm run dev) &
	@(cd backend && uvicorn app.main:app --reload --port 8000) &
	@echo "RecViz running at http://localhost:5173"

docker-up:
	docker compose -f infrastructure/docker-compose.yml up -d redis postgres

docker-down:
	docker compose -f infrastructure/docker-compose.yml down

docker-all:
	docker compose -f infrastructure/docker-compose.yml up -d

init-superset:
	docker compose -f infrastructure/docker-compose.yml exec superset bash /app/init_superset.sh

clean:
	cd frontend && rm -rf node_modules dist
	cd backend && rm -rf __pycache__ .pytest_cache
	docker compose -f infrastructure/docker-compose.yml down -v
```

### 10. Create `.env.example` at project root
```env
# RecViz Environment Configuration

# Backend
RECVIZ_SUPERSET_URL=http://localhost:8088
RECVIZ_REDIS_URL=redis://localhost:6379/0
RECVIZ_ELASTICSEARCH_URL=http://localhost:9200
RECVIZ_DEBUG=true

# Superset
SUPERSET_SECRET_KEY=change-this-in-production
SUPERSET_METADATA_DB=postgresql://recviz:recviz_dev@localhost:5432/superset_meta

# PostgreSQL
POSTGRES_DB=superset_meta
POSTGRES_USER=recviz
POSTGRES_PASSWORD=recviz_dev

# Frontend
VITE_API_BASE_URL=/api
```

### 11. `infrastructure/redis/redis.conf`
```
maxmemory 256mb
maxmemory-policy allkeys-lru
appendonly yes
```

## Acceptance Criteria
- [ ] `docker compose up -d` starts all services (redis, postgres, nginx)
- [ ] Superset Dockerfile builds successfully
- [ ] Frontend Dockerfile builds and serves on port 5173
- [ ] Backend Dockerfile builds and serves on port 8000
- [ ] `init_superset.sh` initializes Superset DB and creates admin
- [ ] `setup-dev.sh` sets up local environment from scratch
- [ ] `make dev` starts frontend + backend with hot reload
- [ ] `make docker-all` starts the full stack
- [ ] `.env.example` documents all required variables
- [ ] Healthchecks pass for all services
