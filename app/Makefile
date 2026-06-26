.PHONY: install fmt lint test build validate run clean

install:
	npm ci --legacy-peer-deps

fmt:
	npm run lint2:fix

lint:
	npm run lint2

test:
	npm run test -- --ci --passWithNoTests

build:
	npm run build --legacy-peer-deps

validate: lint test build

run:
	npm run dev

clean:
	rm -rf .next node_modules coverage
