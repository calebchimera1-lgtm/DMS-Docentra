# Deployment guide

Three deployable units: `apps/api` (REST + GraphQL + Socket.IO), `apps/web`
(Next.js), and `apps/worker` (background jobs — no HTTP surface). All
three are stateless and horizontally scalable; state lives in Postgres,
Redis, and S3-compatible object storage.

## Docker Compose (single host)

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env       # edit secrets
cp apps/web/.env.example apps/web/.env
cp apps/worker/.env.example apps/worker/.env
docker compose up --build
```

Starts Postgres, Redis, Elasticsearch, MinIO, and all three apps. The web
app is served directly (port 3000) or behind the bundled nginx config
(`infra/nginx/nginx.conf`) for a single public entry point routing
`/api` and `/socket.io` to the API and everything else to the web app.

## Kubernetes

Manifests live in `infra/k8s`:

```
infra/k8s/
  base/
    namespace.yaml
    configmap.yaml           # non-secret env vars
    secret.example.yaml      # TEMPLATE — copy, fill in, apply separately
    api-deployment.yaml      # Deployment + Service
    web-deployment.yaml      # Deployment + Service
    worker-deployment.yaml   # Deployment only (no HTTP surface)
    redis-deployment.yaml    # dev/staging only — see the file's own note
    ingress.yaml              # path-based routing on one host
    hpa.yaml                  # HorizontalPodAutoscaler for api/web/worker
  overlays/
    production/
      kustomization.yaml      # patches: replica counts, ingress TLS
```

### Prerequisites

- A managed PostgreSQL instance (production should **not** run Postgres
  in-cluster without a proper operator) and a managed Redis instance are
  strongly recommended for production; `redis-deployment.yaml` is
  provided for dev/staging convenience only.
- An S3-compatible bucket (AWS S3, or self-hosted MinIO) reachable from
  the cluster.
- An ingress controller (the provided `ingress.yaml` targets
  `ingressClassName: nginx`) and, for the production overlay,
  [cert-manager](https://cert-manager.io/) for automatic TLS.

### Secrets

```bash
cp infra/k8s/base/secret.example.yaml infra/k8s/base/secret.yaml
# edit secret.yaml with real values — DATABASE_URL, REDIS_URL, JWT
# secrets, ENCRYPTION_KEY, S3 credentials
kubectl apply -f infra/k8s/base/secret.yaml
```

`secret.yaml` is gitignored and deliberately **not** referenced by
`kustomization.yaml`, so it's applied as a separate, explicit step and
never accidentally picked up by a generator. Prefer a secrets-manager
integration (External Secrets Operator, Sealed Secrets, or your cloud
provider's CSI driver) over hand-applied Secret manifests in a real
production cluster.

### Deploy

```bash
# base (dev/staging cluster)
kubectl apply -k infra/k8s/base

# production overlay (higher replica counts, TLS ingress)
kubectl apply -k infra/k8s/overlays/production
```

Build and push the three images first (or point CI at your registry —
see `.github/workflows/ci.yml`, which already builds all three on every
push):

```bash
docker build -f infra/docker/api.Dockerfile    -t <registry>/omniflow-api:<tag>    .
docker build -f infra/docker/web.Dockerfile    -t <registry>/omniflow-web:<tag>    .
docker build -f infra/docker/worker.Dockerfile -t <registry>/omniflow-worker:<tag> .
```

then update the `image:` field in the respective Deployment (or manage
it via `kustomize edit set image` / your CD pipeline).

### Database migrations

Migrations aren't run automatically by the Deployments — run them as a
one-off step in CI/CD before rolling out a new image:

```bash
pnpm --filter @omniflow/database exec prisma migrate deploy
```

### Scaling notes

- `api` and `web` scale on CPU via `hpa.yaml` (70% target utilization).
  Both are stateless — sessions/auth live in Postgres, not in-process —
  so scaling out is safe with no sticky-session requirement, **except**
  the Socket.IO realtime gateway: multiple `api` replicas each hold their
  own in-memory room membership, so a client's live notifications only
  arrive on whichever pod they're connected to. This is fine at current
  scale (a client only needs its own connection); if realtime fan-out
  across pods becomes necessary (e.g. broadcasting to an entire company
  regardless of which pod each member is connected to), add the
  [Socket.IO Redis adapter](https://socket.io/docs/v4/redis-adapter/) —
  Redis is already in the stack.
- `worker` scales on CPU too, but job *throughput* is really bounded by
  Redis and whatever the jobs call out to (e.g. downstream webhook
  endpoints) — watch queue depth (BullMQ exposes this via `Queue.getJobCounts()`)
  as the more meaningful scaling signal if CPU alone doesn't reflect load.
- Postgres connection limits: each `api`/`worker` pod holds its own
  Prisma connection pool. At high replica counts, put
  [PgBouncer](https://www.pgbouncer.org/) (or your managed Postgres
  provider's built-in pooler) in front rather than raising Postgres's
  `max_connections` indefinitely.

### Validation caveat

`kubectl`/`kustomize` aren't available in the sandboxed environment this
was built in, so these manifests were checked for YAML validity and for
internal consistency (every `configMapRef`/`secretRef`/`scaleTargetRef`/
Ingress backend name cross-checked against the resource it points to) by
hand, but **not** run through `kubectl apply --dry-run` or
`kustomize build` against a real cluster. Do that before relying on them
in production.
