# Deploying FGx on AWS

FGx ships with a production `Dockerfile`, so it runs on **ECS Fargate** (recommended),
**Elastic Beanstalk**, or any container host. The container is:

- **Node 22 Alpine** (matches `engines: >=22.5`), zero native dependencies
- Non-root (`node` user), with a `HEALTHCHECK` against `/health`
- Writable SQLite volume at `/app/data` — **mount persistent storage there or the DB resets on every redeploy**

> The bot registers all slash commands globally at startup — a fresh task needs
> `DISCORD_TOKEN` + `CLIENT_ID` (and optionally `GUILD_ID` for instant dev-only
> registration). First boot takes ~30s before commands appear.

---

## Option A — ECS Fargate (recommended)

### 1. Build & push the image to ECR

```bash
aws ecr create-repository --repository-name fgx --region us-east-1   # once

# login, then:
docker build -t fgx .
docker tag fgx:latest <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/fgx:latest
docker push <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/fgx:latest
```

### 2. Create an EFS filesystem (for the SQLite DB)

FGx needs a persistent volume for `/app/data`. Create one **EFS** filesystem,
note its ID, and make sure it's mounted into your task's VPC (mount targets in
the same subnets as the task).

### 3. Register a task definition

Create a task definition (Fargate, ~0.5 vCPU / 1 GB RAM is plenty):

| Setting | Value |
|---|---|
| Container image | your ECR `fgx:latest` |
| Port mappings | `10000` (tcp) |
| Mount points | **EFS volume** → container path `/app/data` |
| Health check | `CMD-SHELL` → `wget -qO- http://127.0.0.1:10000/health \|\| exit 1` |
| User | `node` (already set in the image) |

Environment variables (from [render.yaml](../render.yaml) — the same list works):

```text
NODE_ENV=production
PORT=10000
DATABASE_PATH=/app/data/fgx.db     # ← must point at the EFS mount
DISCORD_INTENTS=full               # after enabling intents in the dev portal
AI_PROVIDER=gemini
AI_FAILOVER_MODE=shuffle
AI_ACTION_MODE=LOG
AI_TIMEOUT_MS=30000
```

Secrets — **never in plaintext env vars on AWS**; use ECS secrets backed by
**Secrets Manager** or **SSM Parameter Store** (secure strings):

```text
DISCORD_TOKEN      → arn:aws:secretsmanager:…:DISCORD_TOKEN
CLIENT_ID          → arn:aws:secretsmanager:…:CLIENT_ID
GEMINI_KEYS        → arn:aws:secretsmanager:…:GEMINI_KEYS
GROQ_KEYS          → arn:aws:secretsmanager:…:GROQ_KEYS
```

### 4. Service + load balancer

- Create an ECS **service** (Fargate, 1 task, no rolling-update surprises)
- Point it at an ALB target group with health check path **`/health`** (healthy = `200`)
- The bot's Discord connection needs **outbound** internet — ECS tasks with
  `awsvpc` networking get it automatically.

That's it — auto-restarts, health checks, and per-deploy DB persistence included.

---

## Option B — Elastic Beanstalk (simpler, single container)

1. `eb init` → platform **Docker**
2. `eb create fgx-prod` → deploy with `eb deploy`
3. Attach the **`data`** directory to EFS: mount it and set `DATABASE_PATH=/efs/fgx.db`
4. Put secrets in **EB environment properties** (they're encrypted at rest)

---

## Environment variables reference

| Variable | Required | Purpose |
|---|---|---|
| `DISCORD_TOKEN` | ✅ | Bot token (secret) |
| `CLIENT_ID` | ✅ | Bot application ID (secret) |
| `GUILD_ID` | – | Server ID — set it for instant (guild-only) command registration |
| `DATABASE_PATH` | – | SQLite path; default `data/fgx.db`. **Must point at your volume on AWS** |
| `PORT` | – | HTTP port for the dashboard/health; default 10000 |
| `DISCORD_INTENTS` | – | `basic` or `full` (full = Server Members + Message Content) |
| `AI_PROVIDER` | – | `gemini` / `groq` / `openai` / auto-detect |
| `GEMINI_KEYS` | – | Comma-separated Gemini keys (shuffled for failover) |
| `GROQ_KEYS` | – | Comma-separated Groq keys |
| `AI_FAILOVER_MODE` | – | `failover` / `roundrobin` / `shuffle` |
| `AI_ACTION_MODE` | – | `LOG` (default) — moderation enforcement level |

## Checklist before going live on AWS

- [ ] Intents enabled in the Discord Developer Portal (Members + Message Content) and `DISCORD_INTENTS=full`
- [ ] `DATABASE_PATH` points at the mounted volume
- [ ] Secrets via Secrets Manager / SSM, not plain env vars
- [ ] ALB health check on `/health` passes (you'll see the JSON status)
- [ ] Verify commands are live: `/fgx` should open the panel in your server
