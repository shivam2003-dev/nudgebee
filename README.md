# Nudgebee

Open-source SRE copilot — Kubernetes observability, runbook automation, and incident response.

## Quick Start (Local Development)

The fastest way to run Nudgebee from source. **Infra in containers, backend and frontend from source on the host.** This is the path contributors should use.

### Prerequisites

- [Docker](https://www.docker.com/products/docker-desktop/) (with `docker compose`) **or** [Podman Desktop](https://podman-desktop.io/) (with `podman-compose`)
- [Go 1.26+](https://go.dev/dl/)
- [Node 22+ and npm](https://nodejs.org/en/download)
- [golang-migrate](https://github.com/golang-migrate/migrate/releases/tag/v4.17.0) v4.17.0 (`brew install golang-migrate` on macOS) and `psql` (any version)

### 1. Clone

```bash
git clone https://github.com/nudgebee/nudgebee.git
cd nudgebee
```

### 2. Bring up infra containers

The full `docker-compose.yaml` references our internal registry for many services. For local dev you only need the **public infra images** — the rest of the stack runs from source.

```bash
docker compose up -d postgres rabbitmq redis
```

### 3. Apply the database schema

```bash
cd api-server/migrations

# Create the tracker schema once (golang-migrate doesn't auto-create it)
psql "postgres://postgres:postgrespassword@localhost:5432/nudgebee?sslmode=disable" \
  -c "CREATE SCHEMA IF NOT EXISTS nudgebee;"

# Apply all pending migrations
migrate -path ./migrations/app \
  -database "postgres://postgres:postgrespassword@localhost:5432/nudgebee?sslmode=disable&x-migrations-table=%22nudgebee%22.%22schema_migrations%22&x-migrations-table-quoted=true" \
  up

cd ../..
```

See [api-server/migrations/README.md](api-server/migrations/README.md) for how migration tracking works and how to add a new migration.

### 4. Configure backend env

Create `api-server/services/.env`:

```bash
cat > api-server/services/.env <<'EOF'
# DB
APP_DATABASE_URL=postgresql://postgres:postgrespassword@localhost:5432/nudgebee?sslmode=disable
NUDGEBEE_DB_SSL_ENABLED=false

# Auth / encryption (sample local-dev values)
NUDGEBEE_ENCRYPTION_KEY=3030303030303030303030303030303030303030303030303030303030303030
ACTION_API_SERVER_TOKEN=myadminsecretkey

# Server
API_PORT=8000
SERVICE_API_SERVER_URL=http://localhost:8000
ENV=local
BASE_URL=http://localhost:3000
NUDGEBEE_URL=http://localhost:3000
BRANDING_NAME=Nudgebee

# RabbitMQ
RABBIT_MQ_USERNAME=guest
RABBIT_MQ_PASSWORD=guest
RABBIT_MQ_HOST=localhost
RABBIT_MQ_PORT=5672

# Disabled locally
CLICKHOUSE_ENABLED=false

# Cache
CACHE_PROVIDER=in_memory
CACHE_EXPIRATION_MINUTES=30
EOF
```

### 5. Run the backend

```bash
cd api-server/services
make run
```

Listens on <http://localhost:8000>. Leave it running.

### 6. Configure frontend env

In a new terminal, create `app/.env`:

```bash
cat > app/.env <<'EOF'
# NextAuth
NEXTAUTH_SECRET=N+vHVMgf0+C678HnyDR9NFBksCz6yH/cIh4mK7hKDro=
NEXTAUTH_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCwXivpGawLzu7t\njf877Lpr+zrHRSEciBRM8uX9r4uYnOiCsXtTFQHwPdVTcfRIT1ty82NeRdYwAer4\nDgxRgGtB4TBh99zz6vtcfi8Sx/W5UvCyDwBt8tIsXcyUcrdqfjrQnXQwinuhi02v\n2tP7furZgZBeG3NHoB+gBHy5s/ihnFSlAAhFT1dYRIdHDwOW4kcEMdKKRkkC5iJs\nZUlXyipfnlTIGGYn4s764LS7tEsD4e1Pa5yBoISpjqfoxQ/ER1lsr5hw4so1C4a2\nTkQzSqDTRgYBENGkY1kF//dyAvE1e8dOxlopCQlGxgEz1WJXAN5Q5tMPLWuXDEbl\nWpQ87k4TAgMBAAECggEAQY+gLxSV+gXAl5oTaQlE+2L2pKC0AFEtirU4fadF80NQ\nw1SKjYXfpJi3tj9EGaU2T3LeW2sGhe4QlIlUVu+v71twitqCzkFpkyZtBURDudJ1\nGxusgzKiok9z/zLtr66g2m/Ng0XXU2PfSyHDb1fsoVIignkdz2BcoTVJ0BZwtFI0\nugIwoilb+cNdOKEVI2+ybp2zFvREFKnUMnV0NHUmdH0BBrVcy2/cooNDpYkuCKWO\n7VYJ3CiBjt/zZLVQ6fMx5budN9EhCGpQ/ZfgB5UEIvIu1eFjECEJugZqdbmtYhar\nLeHVXTwzrZBk8ynKzpg+jZ0XD/KXuiCjbw4rJCJ8EQKBgQDY/XzjjKRzZHEwI4L9\nGSXb0dZBy+0gNZ+u+lsk1XA66NAxw6VpkVTYHfNvtIQjbYLY902Q+BQ1BF2f8xXT\n/CQY8BXvsJ9NiIFDA5n145M4ghMWYiOO+oAzBXrHJrCjPGRjKdH65qh7IgPwWqak\nwe2j/U8jj0tBLkel8xfA7fyjTQKBgQDQEyCXUdsO9goJGvK2r8nD92fMzSaKigC7\nEO1CWnK0PmyQIyEB1XMVarRAKjax+1aShFNZ15Pxah6o9XznQwTiiLCT+Ms+XYaH\nn7JK1BD7aTI+qZ8sv6i+3Rsyuwr8CGQGQjLckYd9KjNWpfU9e9LM+uLlWn+/5BEs\nwA6jyYlG3wKBgCSQGhIxqagz/YqSAUlqimGO6x5tIUizIHQYhXEgcefLQQGRqPav\n4W8FJPbmoPljQ5ARo8VQt/7y/F+uUzhEHUUCd3/K8BzdaoKDQdcYAL+d01+LK9i0\nxxNR0g1qrIrk6zl2W4Z+hVcyNR2z+K58avGeBk7En3adOL9yxcbhkxdlAoGBAInh\nYuNjFqofWB8YgGWWrzjwpRQNjdCYCkvrt40UqpXOF9qbrK+uZgh3IOK0FnJyfrew\ngBs0w5BiJdcIdbA5tO74bSpg3y2AhDkzFc6IIIi4+NaVSCk7B/MSSYegcnL4jG+p\nRlLrDMFgSYzNhGktuE6kod4hzi22T7s7uXfHgPQ5AoGANSvyB4K4QEjwB7akkHhY\n7Gr1FcwG8O2Gn3OjqAKZo/SQDS5ozJ9pvQPhG7hNsPW6GLG4A3vl62c4KoMkL6G8\nUQn98ibp9U0Dw1byYITETl8dhuLz7BJNgk43nRPv44B8VVZh4DxC3pziNEn/QmWq\n1iIw/+ajK/hFP5PNhmBajYU=\n-----END PRIVATE KEY-----

NUDGEBEE_ENCRYPTION_KEY=3030303030303030303030303030303030303030303030303030303030303030

# Local-dev dummy login
NEXTAUTH_DUMMY_CREDS_ENABLED=true
NEXTAUTH_DUMMY_CREDS_PASSWORD="Test!24#5"

BASE_URL=http://localhost:3000
ON_PREM_MODE=true
EOF
```

> The private key above is a **sample for local development only**. NextAuth uses it to sign session JWTs. **Generate a fresh key for any non-local deployment.**

### 7. Run the frontend

```bash
cd app
npm install --legacy-peer-deps
npm run dev
```

Open <http://localhost:3000>.

### 8. Sign in

The local-dev signin form accepts any email with the dummy password:

- **Username**: any email (e.g. `dev@example.com`)
- **Password**: `Test!24#5` (the value of `NEXTAUTH_DUMMY_CREDS_PASSWORD`)

A tenant + admin user are created automatically on first sign-in.

### Troubleshooting

- **`error pinging postgres: lookup postgres: no such host`** from backend → `APP_DATABASE_URL` in `api-server/services/.env` still uses container hostname. Replace `@postgres:5432` with `@localhost:5432`.
- **`migrate: error: pq: relation "..." already exists`** → tracker schema drifted from actual tables. Inspect `SELECT version, dirty FROM nudgebee.schema_migrations;` and use `migrate force <version>` to align. See [api-server/migrations/README.md](api-server/migrations/README.md#troubleshooting).
- **Action call from frontend returns 502 `RPC gateway could not handle the operation`** → the requested action isn't registered in `app/src/lib/actions.yaml`, or it's a subscription / fragment / parse error. Check the frontend dev-server console for the unhandled reason.

---

## Developer Setup (Internal — nudgebee maintainers)

> Steps below are for the nudgebee dev cluster. Open-source contributors should follow [Quick Start](#quick-start-local-development) above.

### Softwares

- [Docker](https://www.docker.com/products/docker-desktop/)
- [Python3 & pip](https://www.python.org/downloads/)
- [Nodejs & npm](https://nodejs.org/en/download)
- [kubectl](https://kubernetes.io/docs/tasks/tools/)
- [AWS Cli](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
- [psql (DBeaver or similar)](https://dbeaver.io/)
- [Helm](https://helm.sh/)

### Configurations

- Get AWS Credentials
- [Configure Kubectl for EKS](https://docs.aws.amazon.com/eks/latest/userguide/create-kubeconfig.html)
  - `aws sts get-caller-identity` - varify AWS is configured correctly
  - `aws eks update-kubeconfig --region us-east-1 --name nudgebee-dev` update K8s Configs

#### Test Configurations

Varify AWS configured properly

```
aws sts get-caller-identity
```

Varify k8s configured properly

```
kubectl --namespace nudgebee get pods
```

### Accessing Dev Servers

Dev servers can be accessed using port-forwarding using kubectl

- Nudgebee Postgres

```
kubectl --namespace nudgebee port-forward svc/pg-main-proxy-service 5432:5432
```

- Clickhouse

```
kubectl --namespace clickhouse port-forward svc/clickhouse 8123:8123
```

- RabbitMQ

```
kubectl --namespace rabbit port-forward svc/rabbitmq 15672:15672
```

## Local Stack Bootstrap

The repo ships a `docker-compose.yaml` that wires every service against the dev container registry. You rarely need to bring all 20 containers up — start only the services that match what you're working on. The table below lists each service and the minimum set of upstream services required for it to boot successfully.

### Infra (no deps)

| Service | Image | Notes |
|---|---|---|
| `postgres` | postgres:16 | Primary RDBMS. App schema applied by golang-migrate on deploy. |
| `rabbitmq` | rabbitmq:3-management | Message bus. UI at `:15672`. |
| `clickhouse` | clickhouse/clickhouse-server:23.8 | Analytics DB. |
| `redis` | redis:7-alpine | Cache. |
| `qdrant` | qdrant/qdrant:v1.16.0 | Vector store for RAG / LLM. |
| `temporal` | temporalio/auto-setup:1.29.1 | Workflow engine. Backed by `postgres` (creates `temporal` + `temporal_visibility` DBs on first boot). Required by `workflow-server`. |
| `temporal-ui` | temporalio/ui:2.44.0 | Optional Temporal Web UI at `:8233`. |

### Application services

| Service | Min upstream deps | Why |
|---|---|---|
| `api-server-services` | `postgres`, `rabbitmq`, `clickhouse`, `redis` | Core backend. Needs the full data tier — won't bootstrap RabbitMQ consumers without RabbitMQ; queries fail without Postgres; cache/analytics pulls hit Redis/ClickHouse. |
| `services-sidecar` | `api-server-services` | Companion to api-server, shares the same image. |
| `ticket-server` | `postgres`, `rabbitmq` | DB writes + async Jira sync. |
| `workflow-server` (runbook-server / auto-pilot) | `postgres`, `rabbitmq`, `temporal` | Workflow state in PG; events on RMQ; Temporal SDK calls `Dial(7233)` at startup and crashes if unreachable. |
| `notifications-server` | `postgres`, `rabbitmq` | Persists messages, consumes RMQ events. |
| `cloud-collector` | `rabbitmq`, `clickhouse` | Publishes scrape events; writes findings to CH. |
| `otel-collector` | `clickhouse` | OTLP traces/metrics → ClickHouse. |
| `relay-server` | `postgres`, `rabbitmq` | K8s gateway; tunnel state in PG, events on RMQ. |
| `k8s-collector-app` | `rabbitmq`, `clickhouse` | Publishes K8s metrics to RMQ → CH. |
| `ml-k8s-server` | `postgres`, `clickhouse` | Reads/writes scaling features. |
| `llm-server` | `postgres`, `qdrant` | LLM session state + vector lookups. |
| `rag-server` | `postgres`, `qdrant` | RAG retrieval against Qdrant; metadata in PG. |
| `code-analysis` | (none — placeholder) | No published image; build locally if needed. |

### Frontend

| Service | Min upstream deps | Why |
|---|---|---|
| `app` (Next.js) | `api-server-services` | All GraphQL operations are served by the in-process RPC gateway in the Next.js server (`/api/graphql`) and forwarded to api-server-services action handlers. RabbitMQ/ClickHouse/Redis are required indirectly via api-server-services' own deps. |

### Common minimal stacks

- **DB exploration:** `postgres` (connect with `psql` / DBeaver).
- **Login + dashboard render:** `postgres` + `api-server-services` + `app` (will pull RabbitMQ/ClickHouse/Redis transitively).
- **Cloud findings pipeline:** add `rabbitmq` + `clickhouse` + `cloud-collector`.
- **LLM/RAG flows:** add `qdrant` + `llm-server` + `rag-server`.

Start a subset with `podman-compose up -d <service> [<service> ...]`; transitive deps are pulled in automatically via `depends_on`.

## Project Structure

Each module has its own README with setup and development instructions. Refer to them for module-specific guidance.

### Frontend

| Module | Description | README |
|--------|-------------|--------|
| `app/` | Frontend dashboard (Next.js + React, NextAuth) | [app/README.md](app/README.md) |

### API & GraphQL Layer

| Module | Description | README |
|--------|-------------|--------|
| `api-server/` | GraphQL API layer overview | [api-server/README.md](api-server/README.md) |
| `api-server/services/` | Core backend Go services (Gin) | [api-server/services/README.md](api-server/services/README.md) |
| `api-server/migrations/` | DB migrations (Postgres via golang-migrate, Clickhouse, RabbitMQ) | [api-server/migrations/README.md](api-server/migrations/README.md) |

### Data Collection

| Module | Description | README |
|--------|-------------|--------|
| `collector-server/cloud-collector/` | AWS/cloud data collection | [collector-server/cloud-collector/README.md](collector-server/cloud-collector/README.md) |
| `collector-server/otel-collector/` | OpenTelemetry collector | [collector-server/otel-collector/README.md](collector-server/otel-collector/README.md) |
| `collector-server/k8s-collector/app/` | K8s metrics aggregation (Python) | [collector-server/k8s-collector/app/README.md](collector-server/k8s-collector/app/README.md) |
| `collector-server/k8s-collector/relay-server/` | K8s relay gateway (WebSocket) | [collector-server/k8s-collector/relay-server/README.md](collector-server/k8s-collector/relay-server/README.md) |

### ML & LLM

| Module | Description | README |
|--------|-------------|--------|
| `ml-k8s-server/` | ML models & K8s autoscaling | [ml-k8s-server/README.md](ml-k8s-server/README.md) |
| `llm/llm-server/` | LLM inference service | [llm/llm-server/README.md](llm/llm-server/README.md) |
| `llm/code-analysis/` | Code analysis engine | [llm/code-analysis/README.md](llm/code-analysis/README.md) |
| `llm/rag-server/` | RAG (Retrieval Augmented Generation) | [llm/rag-server/README.md](llm/rag-server/README.md) |
| `llm/benchmark/` | LLM benchmarking | [llm/benchmark/README.md](llm/benchmark/README.md) |

### Automation & Operations

| Module | Description | README |
|--------|-------------|--------|
| `auto-pilot/` | Automation & remediation engine | *(no README — see CLAUDE.md)* |
| `runbook-server/` | Runbook management | [runbook-server/README.md](runbook-server/README.md) |
| `ticket-server/` | Ticket management (Jira integration) | [ticket-server/README.md](ticket-server/README.md) |
| `notifications-server/` | Notification delivery (Slack, Teams, etc.) | [notifications-server/README.md](notifications-server/README.md) |

### Deploy & Infrastructure

| Module | Description | README |
|--------|-------------|--------|
| `deploy/kubernetes/` | Helm charts & Kubernetes config files | [deploy/kubernetes/README.md](deploy/kubernetes/README.md) |

### Tests

| Module | Description |
|--------|-------------|
| `app-e2e-tests/` | End-to-end integration tests |

## App Deployments

- Currently using Github Actions for deployment
- Most of the apps are deployed on Kubernetes

## Infrastructure Components

Current Infra Components

### Logs

- Loki

### Ingress

- Nginx Ingress using Network load balancer
- Within Kubernetes `ingress-nginx` namespace

### SSL/TLS

- [Cert Manager](https://cert-manager.io/)
- Within Kubernetes `cert-manager` namespace

### Metrics Collection

- [Prometheus](https://prometheus.io/)
- Within Kubernetes `prometheus` namespace

### Messaging Queue

- [RabbitMQ](https://www.rabbitmq.com/)
- Within Kubernetes `rabbit` namespace

### Analytics DB

- [Clickhouse](https://clickhouse.com)
- Within Kubernetes `clickhouse` namespace

### RDBMS

- Primary DB, Postgres, Deployed on AWS

## Tech Docs -

https://drive.google.com/drive/folders/1l8q5SsZa-lQVCDbV6NQPOE565erullEi?usp=sharing
