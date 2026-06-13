# Deploy AI YouTube Growth Studio

This guide covers running the app in production inside a single Docker container, optionally exposing it on a custom domain via Cloudflare Tunnel.

## What you get

- FastAPI backend + React frontend served from one process on port `8000`
- SQLite database persisted on the host
- Optional: custom domain via Cloudflare Tunnel (no public IP or reverse proxy needed)

## Requirements

- Docker 20.10+
- Git
- (Optional) A Cloudflare account + `cloudflared` for custom domain

## Quick deploy

### 1. Clone

```bash
git clone https://github.com/nrayyagari/ai-youtube-growth-studio.git
cd ai-youtube-growth-studio
```

### 2. Configure environment (optional)

Copy the example file and add at least one AI provider API key:

```bash
cp .env.example .env
```

Edit `.env` and set any of:

```env
GEMINI_API_KEY=...
GROQ_API_KEY=...
CEREBRAS_API_KEY=...
DEEPSEEK_API_KEY=...
OPENAI_API_KEY=...
JWT_SECRET=change-me-in-production
```

> Users can also add their own keys through the app's Settings page.

### 3. Build the image

```bash
mkdir -p data
docker build -t ai-youtube-growth-studio .
```

### 4. Run the container

```bash
docker run -d \
  --name ai-youtube-growth-studio \
  --restart unless-stopped \
  -p 80:8000 \
  -v $(pwd)/data:/app/data \
  ai-youtube-growth-studio:latest
```

The app is now available at `http://localhost:80`.

### 5. Verify

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:80/
# 200

curl -s http://localhost:80/api/workflows
# [{"id":1,"name":"AI Tool Explainer"}, ...]
```

## Expose on a custom domain with Cloudflare Tunnel

If you want the app on `https://yourdomain.com` without opening ports or managing TLS:

### Install and authenticate `cloudflared`

```bash
# Download from https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
cloudflared tunnel login
```

Open the printed URL in your browser and authorize Cloudflare.

### Create a tunnel

```bash
cloudflared tunnel create ai-youtube-growth-studio
```

Note the tunnel ID from the output.

### Configure the tunnel

Create `/etc/cloudflared/config.yml` (or `~/.cloudflared/config.yml`):

```yaml
tunnel: <TUNNEL_ID>
credentials-file: /etc/cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: yourdomain.com
    service: http://localhost:80
  - service: http_status:404
```

### Route DNS

```bash
cloudflared tunnel route dns <TUNNEL_ID> yourdomain.com
```

### Run as a service

```bash
sudo cloudflared service install
sudo systemctl start cloudflared
sudo systemctl enable cloudflared
```

Now `https://yourdomain.com` serves the app.

## Container management

```bash
# View logs
docker logs -f ai-youtube-growth-studio

# Restart
docker restart ai-youtube-growth-studio

# Stop and remove
docker stop ai-youtube-growth-studio
docker rm ai-youtube-growth-studio

# Update after pulling new code
git pull
docker build -t ai-youtube-growth-studio .
docker stop ai-youtube-growth-studio && docker rm ai-youtube-growth-studio
docker run -d --name ai-youtube-growth-studio --restart unless-stopped -p 80:8000 -v $(pwd)/data:/app/data ai-youtube-growth-studio:latest
```

## Notes

- The Dockerfile produces a single image that builds the React frontend and runs the FastAPI backend.
- The frontend is served as static files from `/app/frontend/dist` by the FastAPI app.
- API calls from the frontend are same-origin (`API_BASE = ""`), so no CORS proxy is needed when served this way.
- The SQLite database lives in `/app/data` inside the container. Mount a host directory to persist it.
- If you need SSL without Cloudflare, place a reverse proxy (nginx, Caddy, Traefik) in front and terminate TLS there.
