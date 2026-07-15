# Deployment

Production stack is defined in root `docker-compose.yml`.

## Services

| Service | Image / build | Role |
|---|---|---|
| `mongodb` | `mongo:7` | Document store |
| `redis` | `redis:7-alpine` | BullMQ broker (AOF enabled) |
| `backend` | `./backend` Dockerfile | Express API |
| `worker` | Same backend image | BullMQ consumer (`node dist/workers/index.js`) |
| `frontend` | `./frontend` Dockerfile | Vite build + nginx (SPA + `/api` proxy) |

## Volumes

| Volume | Mount |
|---|---|
| `mongodb_data` | `/data/db` |
| `redis_data` | `/data` |
| `uploads_data` | `/app/uploads` on **backend** and **worker** (shared local storage) |

## Healthchecks

| Service | Probe |
|---|---|
| `mongodb` | `mongosh` ping |
| `redis` | `redis-cli ping` |
| `backend` | `curl http://127.0.0.1:3000/health` |
| `worker` | TCP connect to Redis |
| `frontend` | `wget http://127.0.0.1/health` (nginx) |

`backend` / `worker` wait until Mongo and Redis are healthy. `frontend` waits until `backend` is healthy.

## Ports

| Host (default) | Container | Purpose |
|---|---|---|
| `8080` (`FRONTEND_PORT`) | `80` | UI |
| `3000` (`BACKEND_PORT`) | `3000` | API (also reachable via nginx `/api` on 8080) |

MongoDB and Redis are not published to the host by default (compose network only).

## Environment

1. Copy `backend/.env.example` → `backend/.env`
2. Set at least `JWT_SECRET` (≥ 32 chars) and `OPENAI_API_KEY`
3. Compose overrides `MONGODB_URI`, `REDIS_HOST`, storage paths, and `CORS_ORIGIN` as needed

Frontend build arg: `VITE_API_BASE_URL` (default `/api/v1`) so the browser calls same-origin `/api`, proxied by nginx to `backend:3000`.

## Start

```bash
cp backend/.env.example backend/.env
# edit JWT_SECRET + OPENAI_API_KEY
docker compose up --build
```

| URL | Purpose |
|---|---|
| http://localhost:8080 | Frontend |
| http://localhost:3000/health | API health |

## Notes

- Worker is mandatory — without it, uploads stay queued.
- Backend image installs Poppler for scanned PDF OCR.
- Local (non-Docker) API + worker: see root README (`npm run dev` / `npm run dev:worker`).
