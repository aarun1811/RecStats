.PHONY: setup dev frontend backend superset test test-fe test-be lint build clean docker-up docker-down docker-all init-superset seed

setup:
	bash infrastructure/scripts/setup-dev.sh

dev: docker-up
	@echo "Starting frontend and backend with hot reload..."
	@(cd frontend && npm run dev) &
	@(cd backend && uvicorn app.main:app --reload --port 8000) &
	@echo "RecViz running at http://localhost:5173"

frontend:
	cd frontend && npm run dev

backend:
	cd backend && uvicorn app.main:app --reload --port 8000

superset:
	superset run -h 0.0.0.0 -p 8088

docker-up:
	docker compose -f infrastructure/docker-compose.yml up -d redis postgres

docker-down:
	docker compose -f infrastructure/docker-compose.yml down

docker-all:
	docker compose -f infrastructure/docker-compose.yml up -d

init-superset:
	docker compose -f infrastructure/docker-compose.yml exec superset bash /app/init_superset.sh

test: test-fe test-be

test-fe:
	cd frontend && npm run test

test-be:
	cd backend && pytest

lint:
	cd frontend && npm run lint
	cd backend && ruff check .

build:
	cd frontend && npm run build
	docker compose -f infrastructure/docker-compose.yml build

clean:
	cd frontend && rm -rf node_modules dist
	cd backend && rm -rf __pycache__ .pytest_cache .venv
	docker compose -f infrastructure/docker-compose.yml down -v

seed:
	bash infrastructure/scripts/seed-data.sh
