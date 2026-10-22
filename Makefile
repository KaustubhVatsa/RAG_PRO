PY := backend/.venv/bin/python
.DEFAULT_GOAL := help

help:             ## list commands
	@grep -E '^[a-z-]+:.*##' $(MAKEFILE_LIST) | sed 's/:.*##/\t/'

setup:            ## backend venv + deps (core only: no torch). Add ML deps with `make setup-knowledge`
	cd backend && uv venv --python 3.12 .venv && uv pip install --python .venv/bin/python -e ".[dev]"
	cp -n .env.example .env || true

setup-knowledge:  ## + PyMuPDF, pymongo, sentence-transformers (partner)
	cd backend && uv pip install --python .venv/bin/python -e ".[dev,knowledge]"

setup-web:        ## frontend deps
	cd frontend && npm install

api:              ## API on :8000 (reads .env; defaults to mock mode, no keys needed)
	cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000

web:              ## frontend on :5173 (proxies /api to :8000)
	cd frontend && npm run dev

db:               ## local MongoDB with vector search
	docker compose up -d mongo

test:             ## backend tests
	cd backend && .venv/bin/python -m pytest -q

lint:             ## ruff check + format check
	cd backend && .venv/bin/ruff check . && .venv/bin/ruff format --check .

fmt:              ## auto-format backend
	cd backend && .venv/bin/ruff check . --fix && .venv/bin/ruff format .

cli:              ## knowledge CLI: make cli ARGS="search 'attention heads' --doc demo-attention"
	cd backend && .venv/bin/python -m app.knowledge.cli $(ARGS)

eval-retrieval:   ## retrieval eval (partner)   LABEL=name
	cd backend && .venv/bin/python -m evals.retrieval_eval --label $(or $(LABEL),dev)

eval-answer:      ## answer eval (reasoning)    LABEL=name
	cd backend && .venv/bin/python -m evals.answer_eval --label $(or $(LABEL),dev)

.PHONY: help setup setup-knowledge setup-web api web db test lint fmt cli eval-retrieval eval-answer
