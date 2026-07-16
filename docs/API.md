# API Reference

Base path: `/api/v1`  
Health is also exposed at `/health` (and `/api/v1/health`).

All authenticated routes expect:

```http
Authorization: Bearer <jwt>
```

Successful responses use the shared envelope (`data`, `message`, `requestId`, optional `pagination`). Errors use the same shape with an `errors` array.

---

## Authentication

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/v1/auth/register` | No | Create account. Body: `{ name, email, password }`. First user becomes `ADMIN`; later users are `USER`. |
| `POST` | `/api/v1/auth/login` | No | Login. Body: `{ email, password }`. Returns JWT + user. |
| `GET` | `/api/v1/auth/profile` | Bearer | Current user profile. |

Register/login are rate-limited (`AUTH_RATE_LIMIT_*`).

---

## Documents

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/documents` | Bearer (`ADMIN` / `USER`) | Paginated list (top-level only: standalone docs + parent uploads). `USER` sees own docs; `ADMIN` sees all. |
| `GET` | `/api/v1/documents/:id` | Bearer | Document detail (owner or admin). |
| `GET` | `/api/v1/documents/:id/pages` | Bearer | Child page documents for a multi-page PDF parent upload, ordered by `pageNumber`. |
| `POST` | `/api/v1/documents/:id/reprocess` | Bearer | Requeue a `FAILED` document for processing. |

Parent upload documents (multi-page PDFs) include `pageDocumentCount` and `childStatusSummary` aggregates. Child page documents include `parentUploadId`, `pageNumber`, and `totalPages`.

### List query parameters

| Param | Default | Notes |
|---|---|---|
| `page` | `1` | 1-based |
| `limit` | `20` | Max `100` |
| `status` | `all` | One of: `all`, `processing`, `review`, `approved`, `failed` |

Response includes `documents`, status `counts`, and `pagination` (`page`, `limit`, `total`, `totalPages`).

---

## Upload

Multipart form uploads. Allowed MIME types: `application/pdf`, `image/png`, `image/jpeg`.

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/v1/documents/upload` | Bearer | Single file. Form field: `file`. |
| `POST` | `/api/v1/documents/uploads` | Bearer | Multiple files. Form field: `files` (up to `MAX_FILES_PER_UPLOAD`). |

Creates document metadata, stores the file, and enqueues background processing.

- **Single-page PDF or image:** status → `QUEUED`, job `PROCESS_DOCUMENT`.
- **Multi-page PDF:** creates a parent upload container, enqueues `SPLIT_UPLOAD`, status → `SPLITTING`. The worker splits each page into an independent child document (PNG), then enqueues one `PROCESS_DOCUMENT` job per page. Children run OCR → AI → validation → `WAITING_FOR_REVIEW` independently.

---

## Review & approve

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/documents/:id/review` | Bearer | Review payload (fields, validation warnings, status, `originalExtractionFields`). |
| `PUT` | `/api/v1/documents/:id/review` | Bearer | Update extracted business fields while `WAITING_FOR_REVIEW`. Body: `{ fields: Record<string, string \| number \| null> }`. Persists corrections and audit logs; status stays `WAITING_FOR_REVIEW`. |
| `POST` | `/api/v1/documents/:id/approve` | Bearer | Approve while `WAITING_FOR_REVIEW`. Freezes `approvedFields` from current `extraction.fields`. Original AI values remain in `extraction.originalFields`. Sets `APPROVED`. |

There is no reject endpoint. Approval is one-way.

---

## Users (admin)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/users` | Bearer + `ADMIN` | Paginated user list (`page`, `limit`). |
| `GET` | `/api/v1/users/:id` | Bearer | Self or admin. |
| `PATCH` | `/api/v1/users/:id` | Bearer + `ADMIN` | Update role. Body: `{ role: "ADMIN" \| "USER" }`. |

---

## Health

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | No | Readiness: MongoDB, Redis, queue. |
| `GET` | `/api/v1/health` | No | Same handler mounted under v1. |

Used by Docker Compose backend healthchecks.
