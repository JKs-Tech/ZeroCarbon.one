# ZeroCarbon.one — Utility Bill Extraction

Upload utility bills → OCR → AI extraction → validation warnings → human review → approved output.

## What you need

| Tool | Why |
|---|---|
| **Node.js 20+** | Frontend + backend |
| **MongoDB** | Document store |
| **Redis** | BullMQ job queue |
| **Poppler** (`pdftoppm`) | Scanned PDF OCR (local only; included in Docker) |
| **OpenAI API key** | GPT-5 Nano extraction |
| **Docker** (optional) | One-command full stack |

Install Poppler on macOS: `brew install poppler`

---

## Quick start (Docker — easiest)

```bash
# 1. Env (one file for the whole stack)
cp backend/.env.example backend/.env

# 2. Edit backend/.env — set these two:
#    JWT_SECRET=<at least 32 characters>
#    OPENAI_API_KEY=<your key>

# 3. Run
docker compose up --build
```

| URL | |
|---|---|
| UI | http://localhost:8080 |
| API health | http://localhost:3000/health |

Compose overrides Mongo/Redis hosts automatically. You only manage `backend/.env`.

---

## Run locally (3 terminals)

### 1. Env files

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Edit **`backend/.env`**:

- `JWT_SECRET` — ≥ 32 characters  
- `OPENAI_API_KEY` — your OpenAI key  
- Keep `MONGODB_URI` / `REDIS_HOST` as `127.0.0.1` (defaults)

`frontend/.env` is already set to talk to `http://127.0.0.1:3000/api/v1`.

Start MongoDB + Redis on your machine (or: `docker compose up mongodb redis -d`).

### 2. Start services

```bash
# Terminal 1 — API
cd backend && npm install && npm run dev

# Terminal 2 — Worker (required for OCR/AI)
cd backend && npm run dev:worker

# Terminal 3 — UI
cd frontend && npm install && npm run dev
```

| URL | |
|---|---|
| UI | http://localhost:5173 |
| API | http://localhost:3000 |

Without the **worker**, uploads stay Queued.

---

## How admin is created

There is **no seed user**.

1. Open the app → **Register** with your name, email, password  
2. If you are the **first user** in the database → you become **ADMIN**  
3. Everyone who registers after that → **USER**  
4. An ADMIN can promote others on the **Admin** page (Users → change role)

| Role | Can do |
|---|---|
| **USER** | Upload / review / approve **own** documents |
| **ADMIN** | Same as USER for all documents + manage users |

---

## Demo flow (2 minutes)

1. Register (first user = admin) → Login  
2. **Workspace** → upload PDF/PNG/JPG  
3. Watch status: Queued → OCR → AI → Validating → Waiting for review  
4. Open **Review & Approve** → edit fields if needed → **Approve**  
5. **Document Details** → see **Final approved output**

---

## Architecture (short)

```
Browser → API → MongoDB + local file storage
              → BullMQ/Redis → Worker → OCR → AI (OpenAI) → Validation
              → Human review → Approved output in MongoDB
```

Full diagrams: [Architecture.md](./Architecture.md)

---

## Env files (no duplicates)

| File | Used by |
|---|---|
| `backend/.env` | Local API/worker **and** Docker Compose |
| `backend/.env.example` | Template — copy this |
| `frontend/.env` | Local Vite only |
| `frontend/.env.example` | Template — copy this |

Do **not** commit real `.env` files. Full variable list: [docs/ENVIRONMENT_VARIABLES.md](./docs/ENVIRONMENT_VARIABLES.md)

---

## Stack

React + Vite · Express · MongoDB · Redis/BullMQ · pdf-parse + Tesseract · OpenAI `gpt-5-nano`

## Folder structure

```
backend/     API + worker
frontend/    React SPA
docs/        Extra technical docs
docker-compose.yml
Architecture.md
```

## More docs

| Doc | Link |
|---|---|
| Architecture | [Architecture.md](./Architecture.md) |
| API | [docs/API.md](./docs/API.md) |
| AI / OCR / Validation | [docs/AI_WORKFLOW.md](./docs/AI_WORKFLOW.md) · [OCR](./docs/OCR_PIPELINE.md) · [Validation](./docs/VALIDATION.md) |
| Deploy / env / troubleshoot | [DEPLOYMENT](./docs/DEPLOYMENT.md) · [ENV](./docs/ENVIRONMENT_VARIABLES.md) · [TROUBLESHOOTING](./docs/TROUBLESHOOTING.md) |

## Known limits

- Needs OpenAI cloud (not local models)  
- No reject workflow (approve-only)  
- Without a running worker, jobs never leave Queued  
