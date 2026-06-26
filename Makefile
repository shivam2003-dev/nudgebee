.PHONY: help fmt lint test validate install clean

SERVICES := \
	api-server/services \
	ticket-server \
	collector-server/cloud-collector \
	collector-server/k8s-collector/relay-server \
	collector-server/k8s-collector/app \
	llm/code-analysis \
	llm/llm-server \
	llm/rag-server \
	ml-k8s-server \
	runbook-server \
	notifications-server \
	llm/benchmark \
	app \
	app-e2e-tests

FMT_SERVICES := \
	api-server/services \
	ticket-server \
	collector-server/cloud-collector \
	collector-server/k8s-collector/relay-server \
	collector-server/k8s-collector/app \
	llm/code-analysis \
	llm/llm-server \
	llm/rag-server \
	ml-k8s-server \
	runbook-server \
	notifications-server \
	llm/benchmark \
	app

LINT_SERVICES := $(FMT_SERVICES)
TEST_SERVICES := $(SERVICES)
INSTALL_SERVICES := \
	api-server/services \
	ticket-server \
	collector-server/cloud-collector \
	collector-server/k8s-collector/relay-server \
	collector-server/k8s-collector/app \
	llm/llm-server \
	llm/rag-server \
	ml-k8s-server \
	runbook-server \
	notifications-server \
	llm/benchmark \
	app \
	app-e2e-tests

CLEAN_SERVICES := \
	collector-server/k8s-collector/app \
	llm/code-analysis \
	llm/rag-server \
	ml-k8s-server \
	notifications-server \
	llm/benchmark \
	app \
	app-e2e-tests

help:
	@echo "Monorepo targets:"
	@echo "  make install   Run service install targets where available"
	@echo "  make fmt       Format services that support formatting"
	@echo "  make lint      Lint services that support linting"
	@echo "  make test      Run tests for services that support tests"
	@echo "  make validate  Run lint and tests"
	@echo "  make clean     Remove generated local artifacts"

install:
	@for service in $(INSTALL_SERVICES); do \
		echo "==> $$service: install"; \
		$(MAKE) -C $$service install; \
	done

fmt:
	@for service in $(FMT_SERVICES); do \
		echo "==> $$service: fmt"; \
		$(MAKE) -C $$service fmt; \
	done

lint:
	@for service in $(LINT_SERVICES); do \
		echo "==> $$service: lint"; \
		$(MAKE) -C $$service lint; \
	done

test:
	@for service in $(TEST_SERVICES); do \
		echo "==> $$service: test"; \
		$(MAKE) -C $$service test; \
	done

validate: lint test

clean:
	@for service in $(CLEAN_SERVICES); do \
		echo "==> $$service: clean"; \
		$(MAKE) -C $$service clean; \
	done
