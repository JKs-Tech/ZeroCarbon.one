# Assumptions & Product Decisions

Documented choices reflected in the current codebase.

## Option B — OpenAI cloud AI

Assignment Option B is the supported path: OpenAI `gpt-5-nano` via the Responses API. Local/other providers behind `AiProvider` are stubs or unfinished adapters — not required for the demo.

`OPENAI_API_KEY` is required when `AI_PROVIDER=openai`.

## Approve-only (no reject)

Human review supports editing fields and a single **approve** action (`POST …/approve`). There is no reject API or UI path. Approval freezes `approvedFields` and moves status to `APPROVED`.

## First registered user is ADMIN

On register, if the user collection is empty, the new user gets role `ADMIN`. Every subsequent registration is `USER`. Admins can promote others via `PATCH /api/v1/users/:id`.

## Local storage default

`STORAGE_DRIVER=local` with files under `STORAGE_LOCAL_PATH` (Compose volume `uploads_data` shared by API and worker). Object storage (`s3`) is declared in config but not the default production path.

## Other implemented behaviors

- Human review is mandatory after validation — no auto-approve path is enabled.
- Validation emits **warnings only**; documents still reach `WAITING_FOR_REVIEW`.
- API and worker are separate processes (same codebase); uploads enqueue work that the worker consumes.
- Public API responses omit filesystem paths and raw LLM payloads where the public mapper strips sensitive artifacts.
