# Deploying AFT to the GuardCyber droplet

Targets `aft.guardcybersolutionsllc.com` → `127.0.0.1:3013` on `<DROPLET_IP>`.

CI/CD pattern: **GitHub Actions builds an image → pushes to `ghcr.io/ixiondt/aft` → SSHes into the droplet → pulls + restarts** (≈ 5 s downtime).

## One-time droplet setup

Done as `deploy@<DROPLET_IP>` (the sudo'ing setup user). All paths are on the droplet.

### 1. Create the `aft-deploy` OS user

```bash
sudo useradd -r -m -s /bin/bash aft-deploy
sudo usermod --add-subuids 1265536-1331071 --add-subgids 1265536-1331071 aft-deploy
sudo loginctl enable-linger aft-deploy
```

(Subuid block per the GuardCyber README — next clean block above `uap-deploy`.)

### 2. Create the app directory

```bash
sudo mkdir -p /opt/apps/aft
sudo chown aft-deploy:aft-deploy /opt/apps/aft
sudo chmod 700 /opt/apps/aft
```

### 3. Drop in `podman-compose.yml` and the env file

```bash
sudo -u aft-deploy -i bash -c 'cat > /opt/apps/aft/podman-compose.yml' <<'YAML'
# (paste this repo's podman-compose.yml contents)
YAML

sudo -u aft-deploy -i bash -c 'cat > /opt/apps/aft/.env' <<'ENV'
# (paste from .env.production.example, fill the secrets)
ENV

sudo chmod 600 /opt/apps/aft/.env
```

### 4. Create the Postgres database

```bash
sudo -u postgres psql <<SQL
CREATE DATABASE db_aft;
CREATE USER aft_user WITH PASSWORD 'CHANGE_ME';
GRANT ALL PRIVILEGES ON DATABASE db_aft TO aft_user;
\c db_aft
GRANT ALL ON SCHEMA public TO aft_user;
SQL
```

Use the same password in `/opt/apps/aft/.env` `DATABASE_URL`.

### 5. Add the Caddy block

```bash
sudo nano /opt/apps/shared/caddy/Caddyfile
# Paste the contents of Caddyfile.snippet
sudo systemctl reload caddy
```

### 6. First-time pull + run

Until GHA pushes the first image, do the initial pull manually so the host can verify everything wires up.

```bash
sudo -u aft-deploy -i bash <<'EOF'
  cd /opt/apps/aft
  # Use a short-lived classic PAT with read:packages scope for THIS one-time pull only.
  echo "$GHCR_PAT" | podman login ghcr.io -u ixiondt --password-stdin
  podman pull ghcr.io/ixiondt/aft:latest
  podman logout ghcr.io

  podman run --rm \
    --add-host host.containers.internal:host-gateway \
    --env-file /opt/apps/aft/.env \
    ghcr.io/ixiondt/aft:latest \
    node /app/scripts/migrate.mjs

  podman-compose -f podman-compose.yml up -d
  curl -fsS http://127.0.0.1:3013/api/health
EOF
```

After this first run, all subsequent deploys use the ephemeral `GITHUB_TOKEN` minted by the workflow — no PAT needed on the droplet.

## GitHub Actions secrets

Set these at `https://github.com/ixiondt/AFT/settings/secrets/actions`:

| Secret | Value |
|---|---|
| `DEPLOY_HOST` | `<DROPLET_IP>` (or `aft.guardcybersolutionsllc.com` if SSH listens there) |
| `DEPLOY_USER` | `deploy` |
| `DEPLOY_SSH_KEY` | The private key matching the public key in `deploy@<DROPLET_IP>:~/.ssh/authorized_keys` |

The workflow uses `GITHUB_TOKEN` directly for `ghcr.io` — no PAT required.

## Cloudflare DNS

DNS entry exists already (per the request: `https://aft.guardcybersolutionsllc.com`).
Verify:

```
Type:   A
Name:   aft
Value:  <DROPLET_IP>
Proxy:  Proxied (orange cloud)
SSL/TLS mode: Full (Strict)
```

## Day-to-day deploy

```bash
git push origin main
```

The workflow:
1. Runs `tsc --noEmit` + Vitest. Fails fast on broken code.
2. Builds the multi-stage Dockerfile, pushes `ghcr.io/ixiondt/aft:latest` + `:<sha>`.
3. SSHes to the droplet as `deploy`, drops to `aft-deploy`, pulls + runs `scripts/migrate.mjs` + restarts the container.
4. Smoke-tests `/api/health` for 30 s before declaring success.

## Rollback

```bash
ssh deploy@<DROPLET_IP> \
  "sudo -u aft-deploy -i bash -c 'cd /opt/apps/aft && \
    sed -i \"s|aft:latest|aft:<previous-sha>|\" podman-compose.yml && \
    podman-compose pull && podman-compose up -d'"
```

Tag the previous SHA as `latest` once verified so the next deploy starts from the right baseline.

## Health checks

- `https://aft.guardcybersolutionsllc.com/api/health` — liveness (process up)
- `https://aft.guardcybersolutionsllc.com/api/ready` — readiness (DB reachable + scoring data loaded)

## Logs

```bash
ssh deploy@<DROPLET_IP> "sudo -u aft-deploy -i bash -c 'podman logs --tail 200 aft'"
```
