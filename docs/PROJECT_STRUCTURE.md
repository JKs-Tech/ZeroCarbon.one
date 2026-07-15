# Project Structure

```
zerocarbon.one_assignment/
├── Architecture.md
├── README.md
├── docker-compose.yml
├── docs/                 # Technical documentation
├── backend/              # Express API + BullMQ worker (+ .env.example)
└── frontend/             # React SPA (Vite)
```

## Backend (`backend/src`)

| Path | Role |
|---|---|
| `server.ts` / `app.ts` | API bootstrap, middleware, route mount |
| `workers/index.ts` | Worker process entry |
| `container.ts` | Composition root |
| `routes/v1/` | `/api/v1` routers |
| `common/` | Constants, middleware, response helpers, exceptions |
| `modules/config` | Env load + Zod schema |
| `modules/database` | Mongo connection |
| `modules/redis` | Redis client |
| `modules/logger` | Structured logging |
| `modules/health` | Health indicators + routes |
| `modules/authentication` | Register / login / profile, JWT |
| `modules/users` | User persistence + admin APIs |
| `modules/upload` | Multipart validation + enqueue |
| `modules/storage` | Local (and S3 adapter) storage |
| `modules/documents` | Schema, repository, list/get/reprocess |
| `modules/queue` | BullMQ producer + `DocumentProcessingWorker` |
| `modules/ocr` | Hybrid PDF/image OCR |
| `modules/ai` | Agentic classify → vendor → extract |
| `modules/validation` | Rule engine + warnings |
| `modules/review` | Edit fields + approve + audit |

## Frontend (`frontend/src`)

| Path | Role |
|---|---|
| `features/auth/` | Login, `AuthContext`, `RequireAuth` |
| `features/documents/` | Dashboard (upload + list), Upload page, Document details |
| `features/review/` | Human review & approve |
| `features/admin/` | Admin user management |
| `components/` | Shared UI (upload, cards, warnings, pagination) |
| `services/` | API clients (`auth`, `documents`, `review`, `admin`) |
| `layouts/` | App shell |
| `routes/` | React Router map |
| `constants/` / `types/` / `utils/` | Shared config and types |

Upload is available on the **dashboard** (`DashboardPage` + `FileUpload`) as well as the dedicated `/upload` route.
