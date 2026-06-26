.PHONY: install fmt lint typecheck test validate run clean

install:
	poetry install

fmt:
	poetry run black .

lint:
	poetry run black --check .
	poetry run flake8 .

typecheck:
	poetry run mypy notifications_server

test:
	poetry run pytest

validate: lint typecheck test

run:
	poetry run uvicorn notifications_server.server:app --host 0.0.0.0 --port $${PORT:-8080} --reload

clean:
	rm -rf .mypy_cache __pycache__ .pytest_cache dist build *.egg-info
