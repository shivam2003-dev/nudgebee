.PHONY: install test test-dev test-test report validate clean

install:
	npm ci
	npx playwright install

test:
	npm run test

test-dev:
	npm run test:dev

test-test:
	npm run test:test

report:
	npm run report

validate: test

clean:
	rm -rf playwright-report test-results node_modules
