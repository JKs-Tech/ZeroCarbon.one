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
| `GET` | `/api/v1/documents` | Bearer (`ADMIN` / `USER`) | Paginated list. `USER` sees own docs; `ADMIN` sees all. |
| `GET` | `/api/v1/documents/:id` | Bearer | Document detail (owner or admin). |
| `POST` | `/api/v1/documents/:id/reprocess` | Bearer | Requeue a `FAILED` document for processing. |

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

Creates document metadata, stores the file, sets status to `QUEUED`, and enqueues a BullMQ `PROCESS_DOCUMENT` job.

---

## Review & approve

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/documents/:id/review` | Bearer | Review payload (fields, validation warnings, status). |
| `PUT` | `/api/v1/documents/:id/review` | Bearer | Update extracted fields. Body: `{ fields: Record<string, string \| number \| null> }` (at least one key). |
| `POST` | `/api/v1/documents/:id/approve` | Bearer | Approve while `WAITING_FOR_REVIEW`. Freezes `approvedFields` and sets `APPROVED`. |

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
