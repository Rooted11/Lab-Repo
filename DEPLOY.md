# Deployment Guide — Ataraxia SOC

Step-by-step instructions to take this repo from `git clone` to a working SOC
dashboard you can log into. Targeted at a single host (laptop, VM, or VPS).

The README covers architecture and the detection pipeline; this file is the
runbook.

---

## What you get when you're done

- Web dashboard (Command Center, Incident Queue, AI Analyst, Live Feed,
  Playbooks, Audit Logs, Log Archive, Asset Inventory, Detections, etc.)
- REST API at `/api/...` with bearer-token auth and optional MFA
- Postgres + Redis + worker + backend + frontend, all in Docker
- Sample data and sample logs so the dashboard isn't empty on first run

Nothing in this repo will phone home or contact a Linode/host you don't
control. All credentials come from a local `.env` file you create yourself.

---

## 1. Prerequisites

You need the following on the deploy host (Linux is recommended; macOS works;
Windows works via WSL2):

| Dependency       | Minimum version | Notes                                  |
| ---------------- | --------------- | -------------------------------------- |
| Docker Engine    | 24.x            | with the `docker compose` v2 plugin    |
| git              | 2.30+           |                                        |
| 4 GB free RAM    |                 | the worker holds a small ML model      |
| 5 GB free disk   |                 | images + Postgres data + log archives  |

Optional:

- **Anthropic API key** — enables real AI explanations on incidents. Without
  one, the app falls back to template responses and still works.
- **Authenticator app** (Google Authenticator, 1Password, etc.) — only needed
  if you turn on MFA in step 4.
- **Cloudflare account + Tunnel** — only needed if you want a public hostname
  with TLS in front of the dashboard. Localhost works fine without it.

---

## 2. Get the code

```bash
git clone https://github.com/Rooted11/SOC_Application.git
cd SOC_Application
```

---

## 3. Create your `.env`

```bash
cp .env.example .env
```

Open `.env` in an editor and set at minimum:

```ini
# Pick whatever you want; you'll log in with these
AUTH_ENABLED=true
AUTH_USERNAME=soc_operator
AUTH_PASSWORD=<choose-a-strong-password>

# Random 32+ char string (used to sign JWTs)
AUTH_TOKEN_SECRET=<long-random-string>

# Database — match these between top and bottom of the file
POSTGRES_USER=soc
POSTGRES_PASSWORD=<choose-a-db-password>
POSTGRES_DB=soc_db

# Optional but recommended
ANTHROPIC_API_KEY=<your-anthropic-key-or-leave-blank>
ANTHROPIC_MODEL=claude-3-haiku
```

> Tip — generate a strong token secret with:
> ```bash
> python3 -c "import secrets; print(secrets.token_urlsafe(48))"
> ```

`.env` is gitignored, so your secrets stay on the host.

---

## 4. (Optional) Turn on MFA before first login

Skip this section if you just want to get the app up. You can enable MFA
later by repeating these steps.

Generate a TOTP secret:

```bash
python3 scripts/generate_mfa_secret.py --label "Ataraxia SOC" --issuer Ataraxia
```

Copy the printed `AUTH_TOTP_SECRET=...` and `otpauth_uri=...` lines.

In `.env`, set:

```ini
AUTH_MFA_ENABLED=true
AUTH_TOTP_SECRET=<the-secret-from-the-script>
```

Then add the secret to your authenticator app — either by pasting the
`otpauth://...` URI into a QR generator (e.g. `qrencode`) or typing the
raw secret into the app's manual-entry screen.

---

## 5. Build and start the stack

For local / single-host development:

```bash
docker compose up -d --build
```

For a hardened production-style deploy (auth required, rate limits on,
binds frontend to localhost so you can put a reverse proxy in front):

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Either way, verify the containers came up:

```bash
docker compose ps
```

You should see five running containers: `frontend`, `backend`, `worker`,
`db`, `redis`.

The first `up -d --build` will take a few minutes as Docker pulls Postgres,
Redis, and Node base images and builds the backend / frontend images.

---

## 6. Log in for the first time

- Local: open <http://localhost:3000>
- Remote VM: open `http://<vm-ip>:3000` (and make sure port 3000 is open)
- Behind a reverse proxy / Cloudflare Tunnel: use whatever public hostname
  you configured

Log in with the `AUTH_USERNAME` / `AUTH_PASSWORD` from your `.env`. If you
turned on MFA in step 4, also enter the 6-digit code from your authenticator
app.

You should land on the **Command Center**.

---

## 7. Verify the pipeline works

The app seeds enough sample data to look populated, but here's how to prove
the ingest → detect → respond pipeline is alive end-to-end:

### Send some test logs from any host

```bash
# from the cloned repo
python3 scripts/send_local_logs.py --target http://localhost:8000 \
        --token <AUTH_TOKEN_or_INGEST_TOKEN> --count 50
```

Watch them appear in:

- **Live Feed** — should show new rows immediately
- **Analytics** — anomaly counts tick up
- **Incident Queue** — if any logs scored as anomalous, an incident appears
- **Playbooks → Recent Auto-Fires** — if an incident triggered an enabled
  playbook, it shows up here
- **Audit Logs** — every login attempt (yours and any failures) is recorded

### Try the new pages

- **Log Archive** — Operations → Log Archive. Click *Search archives*
  with empty filters. (Won't show results until logs age past the
  retention window and the archive job runs; on a fresh deploy it will
  be empty for the first ~10 minutes.)
- **Audit Logs** — Operations Health → Audit Logs. Try logging out and
  attempting a bad password; you'll see the failure recorded.

---

## 8. (Optional) Run a log forwarder so real logs flow in

The deployed stack will only see logs you POST to its ingest endpoint.
If you want a Linux host to forward its own auth/syslog events:

1. Generate an ingest token (any random string in `.env` as `INGEST_TOKEN`).
2. On the source host, install the lightweight `soc-agent` from the
   `scripts/` directory. It tails `/var/log/auth.log` etc. and POSTs to
   `/api/logs/ingest` with `Authorization: Bearer <INGEST_TOKEN>`.

A systemd unit example is in `scripts/soc-agent.service`. Adjust the
`Environment=` lines and start with:

```bash
sudo cp scripts/soc-agent.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now soc-agent
sudo journalctl -fu soc-agent
```

Windows hosts can use `scripts/soc-forwarder-prod.ps1` as a scheduled task.

---

## 9. (Optional) Public access via Cloudflare Tunnel

If you want the dashboard reachable on a hostname like
`soc.example.com` without opening ports:

```bash
# install cloudflared on the host
cloudflared tunnel login
cloudflared tunnel create ataraxia-soc
cloudflared tunnel route dns ataraxia-soc soc.example.com

# create ~/.cloudflared/config.yml pointing to localhost:3000
cloudflared service install
sudo systemctl start cloudflared
```

Switch the prod compose file to bind `frontend` to `127.0.0.1:3000` only
(that's already the default in `docker-compose.prod.yml`) so the tunnel is
the only way in.

---

## 10. Day-2 operations

| Task                              | Command                                                                |
| --------------------------------- | ---------------------------------------------------------------------- |
| Tail logs                         | `docker compose logs -f backend worker`                                |
| Restart a single service          | `docker compose restart backend`                                       |
| Pull latest from GitHub & rebuild | `git pull && docker compose up -d --build`                             |
| Wipe everything (destructive)     | `docker compose down -v` then `docker compose up -d --build`           |
| Manually archive old logs        | open Live Feed → "Archive & Purge" button                              |
| Search archived logs              | open Log Archive page → fill filters → "Search archives"               |
| Inspect database directly         | `docker compose exec db psql -U soc soc_db`                            |

Archives live at `/var/backups/soc/log-archive/` on the host. Back this
directory up the same way you'd back up the Postgres volume.

---

## 11. Troubleshooting

**`docker compose ps` shows backend restarting**
Check the logs: `docker compose logs backend`. Most common cause is a
missing `AUTH_TOKEN_SECRET` or a `POSTGRES_PASSWORD` mismatch between
`.env` and what the running Postgres volume was first initialized with. If
you changed the password after the first start, run
`docker compose down -v` to drop the volume and re-init.

**Login screen says "Invalid username, password, or one-time code"**
Triple-check `AUTH_USERNAME` and `AUTH_PASSWORD` in `.env`. If MFA is on,
make sure your authenticator's clock is in sync (TOTP allows ±30s drift).

**Browser shows 502 / connection refused**
Frontend is up but backend isn't. `docker compose logs backend` and check
for migration errors. If running behind nginx/Cloudflare, confirm the
upstream port matches what compose exposes (3000 for frontend, 8000 for
backend if you expose it directly).

**Live Feed empty after several minutes**
Either no logs are being POSTed (try the `send_local_logs.py` step above)
or the worker hasn't picked them up. `docker compose logs worker` will
say if Redis Streams is reachable.

**Audit Logs shows "No audit entries match your search"**
This is expected on a fresh deploy until you log in / create configs.
Try a bad password — the failed attempt should appear.

---

## 12. Production hardening checklist

If you take this beyond a lab:

- [ ] Use `docker-compose.prod.yml` (`AUTH_ENABLED=true`, rate limits on,
      frontend bound to 127.0.0.1)
- [ ] Set a strong `AUTH_PASSWORD` and 32+ character `AUTH_TOKEN_SECRET`
- [ ] Turn on `AUTH_MFA_ENABLED`
- [ ] Put TLS in front (Cloudflare Tunnel, nginx + Let's Encrypt, or
      Caddy)
- [ ] Restrict the host firewall — only expose 443 if using a tunnel,
      keep 3000 / 8000 closed externally
- [ ] Schedule offsite backups of the Postgres volume and
      `/var/backups/soc/log-archive/`
- [ ] Subscribe `soc-agent` instances on every host you want monitored

---

That's it. From a clean machine, the path is: install Docker → clone →
edit `.env` → `docker compose up -d --build` → log in. Total setup time
on a decent connection is under 10 minutes.
