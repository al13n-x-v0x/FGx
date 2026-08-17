# Deploy kit

Files to run FGx 24/7 on a Linux VM (systemd) — ideal for the **Oracle Cloud
Always Free** ARM instance (2 OCPU / 12 GB RAM, free forever) or any VPS.

| File | Purpose |
| --- | --- |
| `fgx.service` | Hardened systemd unit (auto-restart, least privilege, only `data/` writable) |
| `setup.sh` | One-command provision: Node 22, `fgx` user, deps, service, env, firewall |

FGx needs only ~300 MB RAM, so even a tiny free VM is comfortable.

---

## Oracle Cloud free VM (recommended, genuinely free 24/7)

1. Sign up at <https://signup.oraclecloud.com/> (credit card needed for
   verification — charged $0). Pick the **Always Free** tier.
2. Create a VM: *Compute → Instances → Create instance* →
   **Canonical Ubuntu 22.04 (aarch64)** or **Ubuntu 24.04** (ARM Ampere A1,
   always free) — 2 OCPUs / 12 GB RAM default shape is fine.
3. In **Security lists** (or VCN subnet), allow inbound **TCP 3000** for the
   `/health` endpoint (SSH 22 is usually pre-opened).
4. Download the SSH private key Oracle generates, then connect:
   ```bash
   ssh -i ~/Downloads/ssh-key-*.key ubuntu@<VM_IP>
   ```

## Deploy the code

The repo is **private**, so the simplest path is to copy the folder from your
machine rather than clone:

```bash
# from your local FGx checkout
rsync -avz --exclude node_modules --exclude .git --exclude data \
  ./ ubuntu@<VM_IP>:/tmp/fgx-src/
```

then on the VM:

```bash
sudo bash /tmp/fgx-src/deploy/setup.sh /tmp/fgx-src
# edit the secrets:
sudo nano /opt/fgx/.env        # DISCORD_TOKEN, CLIENT_ID, AI keys
sudo systemctl enable --now fgx
curl localhost:3000/health     # -> {"status":"ok",...}
sudo journalctl -u fgx -f      # watch logs
```

If you prefer `git clone` on the VM instead, add a **deploy key** to the repo
(*Settings → Deploy keys*) and use
`sudo bash deploy/setup.sh git@github.com:al13n-x-v0x/FGx.git`.

## Updates

```bash
cd /opt/fgx
sudo systemctl stop fgx
# copy new code over (rsync as above), or git pull
sudo -u fgx npm ci --omit=dev
sudo systemctl start fgx        # migrations run automatically
```

## Backup (SQLite)

```bash
sudo systemctl stop fgx
sudo tar czf /root/fgx-backup-$(date +%F).tgz -C /opt/fgx data
sudo systemctl start fgx
```

---

## Render free tier (alternative: free but sleeps)

Render's free web services spin down after **15 minutes without inbound
traffic**, which drops the Discord gateway. Keep it awake by pinging the
health endpoint every 5 minutes with a free monitor (e.g. UptimeRobot):

1. Deploy from the GitHub repo (needs the GitHub connect to work — during a
   GitHub incident the repo list may fail; retry later).
2. Build: `npm install` — Start: `npm start`. Add a persistent disk for
   `data/` (`DATABASE_PATH=data/fgx.db`).
3. Add UptimeRobot: *New monitor → HTTP(s)* → `https://<your-app>.onrender.com/health`
   → 5-minute interval. The service stays awake as long as pings arrive.
