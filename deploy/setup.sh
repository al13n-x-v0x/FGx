#!/usr/bin/env bash
#
# FGx — one-command server setup (Ubuntu / Debian, incl. Oracle Cloud free tier)
#
#   sudo bash setup.sh [SOURCE]
#
# SOURCE is optional and can be:
#   - a local directory  -> copied to /opt/fgx
#   - a git URL          -> cloned to /opt/fgx (public, or private with a
#                           deploy key / token already configured)
#   - omitted            -> provision the machine only; assumes the code is
#                           already at /opt/fgx (e.g. rsync/scp'd there)
#
# What it does:
#   1. Installs Node.js 22 LTS + git + curl
#   2. Creates an unprivileged `fgx` system user
#   3. Places the code at /opt/fgx and installs locked dependencies
#   4. Installs the hardened systemd unit and enables auto-restart
#   5. Creates /opt/fgx/.env from .env.example if none exists (edit it!)
#   6. Best-effort firewall rules (ufw) — only opens port 22 by default
#
# Idempotent: safe to re-run.
set -euo pipefail

FGX_USER="fgx"
FGX_DIR="/opt/fgx"
SRC="${1:-}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash setup.sh [SOURCE]" >&2
  exit 1
fi

echo "==> [1/6] Installing Node.js 22 LTS, git, curl"
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v)" != v22* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get update -y
  apt-get install -y nodejs git curl
fi
node -v
npm -v

echo "==> [2/6] Creating unprivileged user '$FGX_USER'"
if ! id "$FGX_USER" >/dev/null 2>&1; then
  useradd --system --home "$FGX_DIR" --shell /usr/sbin/nologin "$FGX_USER"
fi
mkdir -p "$FGX_DIR/data"

echo "==> [3/6] Placing the code at $FGX_DIR"
if [[ -n "$SRC" ]]; then
  if [[ -d "$SRC" ]]; then
    echo "    copying from $SRC"
    rsync -a --delete --exclude node_modules --exclude .git --exclude data "$SRC/" "$FGX_DIR/"
  else
    echo "    cloning from $SRC"
    git clone "$SRC" "$FGX_DIR"
  fi
fi
if [[ ! -f "$FGX_DIR/package.json" ]]; then
  echo "No package.json found at $FGX_DIR. Pass a source dir or git URL, or place the code there first." >&2
  exit 1
fi
cd "$FGX_DIR"
npm ci --omit=dev

echo "==> [4/6] Installing the systemd service"
install -o root -g root -m 644 "$FGX_DIR/deploy/fgx.service" /etc/systemd/system/fgx.service
systemctl daemon-reload

echo "==> [5/6] Environment file"
if [[ ! -f "$FGX_DIR/.env" ]]; then
  cp "$FGX_DIR/.env.example" "$FGX_DIR/.env"
  echo "    created $FGX_DIR/.env from .env.example — EDIT IT with your real values!"
else
  echo "    .env already exists, leaving it untouched"
fi
chmod 600 "$FGX_DIR/.env"
chown -R "$FGX_USER:$FGX_USER" "$FGX_DIR"

echo "==> [6/6] Firewall (best effort, port 22 only)"
if command -v ufw >/dev/null 2>&1; then
  ufw allow OpenSSH >/dev/null 2>&1 || true
  echo "    note: allow TCP 3000 (ufw allow 3000) if you want the /health endpoint reachable from the internet"
fi

echo
echo "FGx is installed. To finish:"
echo "  1. Edit /opt/fgx/.env  (DISCORD_TOKEN, CLIENT_ID, AI keys, DATABASE_PATH=data/fgx.db)"
echo "  2. systemctl enable --now fgx"
echo "  3. systemctl status fgx   ->  curl localhost:3000/health"
