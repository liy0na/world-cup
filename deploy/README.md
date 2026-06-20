# Deploy (Docker + Caddy, automatic HTTPS)

Runs the published image behind [Caddy](https://caddyserver.com), which obtains and renews
Let's Encrypt certificates automatically. No Traefik/nginx required.

## Prerequisites

- A domain whose `A` record (apex and, optionally, `www`) points at the server's public IP.
- Docker + the Compose plugin on the server.
- **Ports 80 and 443 free** on the host (Let's Encrypt needs 80; HTTPS uses 443). Check with:
  ```bash
  sudo ss -tlnp '( sport = :80 or sport = :443 )'
  ```
  If something already listens there (e.g. an xray/3x-ui panel on 443), free it or move it first.

## Run

```bash
cd deploy
echo "DOMAIN=your-domain.tld" > .env       # e.g. world-cup-2026.team
sudo docker compose up -d
sudo docker compose logs -f caddy          # watch the certificate get issued
```

Open `https://your-domain.tld`. Caddy redirects `http -> https` and `www -> apex`.

## Update to the latest image

```bash
cd deploy
sudo docker compose pull && sudo docker compose up -d
```

Keep the `caddy-data` volume — it holds your issued certificates.
