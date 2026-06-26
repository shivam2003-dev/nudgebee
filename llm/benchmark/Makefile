.PHONY: install fmt lint test validate run clean

PYTHON ?= .venv/bin/python

install:
	uv sync --python 3.13

fmt:
	$(PYTHON) -m black benchmark_server

lint:
	$(PYTHON) -m black --check benchmark_server
	$(PYTHON) -m flake8 benchmark_server

test:
	$(PYTHON) -m pytest benchmark_server/tests

validate: lint test

run:
	$(PYTHON) -m uvicorn app:app --host 0.0.0.0 --port $${PORT:-8000} --reload

clean:
	rm -rf .venv .mypy_cache __pycache__ .pytest_cache dist build *.egg-info
