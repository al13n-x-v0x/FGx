# FGx — production container image.
# Works on AWS ECS Fargate / ECR, Google Cloud Run, Fly.io, or any Docker host.
#
#   docker build -t fgx .
#   docker run --env-file .env -p 10000:10000 -v fgx-data:/app/data fgx
#
# The SQLite database lives in /app/data — mount a persistent volume there
# (EFS / EBS / named volume) or the DB resets every restart.

FROM node:22-alpine

ENV NODE_ENV=production \
    PORT=10000

WORKDIR /app

# Install production dependencies first (layer-cached).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# App source. The bot must run as the data volume owner, so keep it simple
# and run as node (Alpine images ship a non-root `node` user).
COPY --chown=node:node . .

# Writable data directory for SQLite (mount a volume here).
RUN mkdir -p /app/data && chown -R node:node /app/data
VOLUME ["/app/data"]

USER node

EXPOSE 10000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:10000/health || exit 1

CMD ["node", "src/index.js"]
