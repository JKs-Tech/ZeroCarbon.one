# Troubleshooting

## Worker not running

**Symptom:** Documents stay `QUEUED` / never reach OCR or review.

**Fix:**

- Docker: ensure the `worker` service is up (`docker compose ps`). Start with `docker compose up --build` so both `backend` and `worker` start.
- Local: run a second process — `cd backend && npm run dev:worker` (API alone does not process jobs).
- Confirm Redis is reachable (`REDIS_HOST` / `REDIS_PORT`).

## OpenAI errors

**Symptom:** Jobs fail during `AI_PROCESSING`; logs show OpenAI API or empty/incomplete response errors.

**Fix:**

- Set a valid `OPENAI_API_KEY` (`AI_PROVIDER=openai` requires it at boot).
- Check model access for `OPENAI_MODEL` (default `gpt-5-nano`).
- `429` / `5xx` / timeouts retry up to `MAX_AI_RETRIES`; permanent `401`/`403` need key/permission fixes.
- Incomplete JSON: raise `MAX_OUTPUT_TOKENS` or reduce OCR length; packing already truncates long bills.

## Stalled BullMQ jobs

**Symptom:** Logs show `Job stalled`; status stuck mid-OCR/AI; eventual `FAILED` after stall limit.

**Fix:**

- Keep `QUEUE_LOCK_DURATION_MS` high enough for OCR + 3 AI steps (default `900000`).
- Lower `QUEUE_CONCURRENCY` if the host is CPU-starved (Tesseract).
- Raise `QUEUE_MAX_STALLED_COUNT` if short worker restarts are common.
- Reprocess via `POST /api/v1/documents/:id/reprocess` when status is `FAILED`.

## Docker issues

**Symptom:** Containers exit, healthchecks fail, uploads missing on worker.

**Fix:**

- `backend/.env` exists with `JWT_SECRET` and `OPENAI_API_KEY`.
- Wait for Mongo/Redis healthy before API; inspect `docker compose logs backend worker`.
- Shared volume `uploads_data` must mount on both API and worker at `/app/uploads`.
- Frontend: open `http://localhost:8080` (not the Vite-only port).

## CORS

**Symptom:** Browser blocks API calls from the UI origin.

**Fix:**

- Local Vite (`5173`): `CORS_ORIGIN=http://localhost:5173` in `backend/.env`.
- Docker UI (`8080`): `CORS_ORIGIN=http://localhost:8080`. Prefer same-origin `/api/v1` via nginx to avoid CORS entirely.
- Restart API after changing `CORS_ORIGIN`.

## Poppler missing (`pdftoppm`)

**Symptom:** Scanned PDFs fail OCR with conversion errors; message about `pdftoppm` / no pages.

**Fix:**

- Local macOS: `brew install poppler`.
- Docker: use the project backend image (Poppler is installed there).
- Text-native PDFs may succeed via `pdf-parse` without Poppler; scanned PDFs need rasterization.
