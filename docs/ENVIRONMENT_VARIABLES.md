# Environment Variables

Defaults below match `backend/.env.example` and Zod validation in `env.schema.ts`. Docker Compose loads `backend/.env` and overrides Mongo/Redis hosts to service names (`mongodb`, `redis`) plus container paths.

## Application

| Variable | Default | Notes |
|---|---|---|
| `NODE_ENV` | `development` | `development` \| `test` \| `production` |
| `PORT` | `3000` | API listen port |
| `APP_NAME` | `zerocarbon-backend` | |
| `APP_VERSION` | `1.0.0` | |
| `LOG_LEVEL` | `info` | `debug` \| `info` \| `warn` \| `error` |

## JWT / auth

| Variable | Default | Notes |
|---|---|---|
| `JWT_SECRET` | *(required)* | ≥ 32 characters |
| `JWT_EXPIRES_IN` | `1d` | |
| `BCRYPT_SALT_ROUNDS` | `12` | |
| `AUTH_RATE_LIMIT_WINDOW_MS` | `60000` | |
| `AUTH_RATE_LIMIT_MAX` | `20` | Register/login |

## MongoDB

| Variable | Default | Notes |
|---|---|---|
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/zerocarbon` | Compose: `mongodb://mongodb:27017/zerocarbon` |
| `MONGODB_DB_NAME` | `zerocarbon` | |

## Redis / BullMQ

| Variable | Default | Notes |
|---|---|---|
| `REDIS_HOST` | `127.0.0.1` | Compose: `redis` |
| `REDIS_PORT` | `6379` | |
| `REDIS_PASSWORD` | *(empty)* | |
| `BULLMQ_PREFIX` | `zc` | |
| `QUEUE_CONCURRENCY` | `2` | Keep low (OCR is CPU-heavy) |
| `QUEUE_MAX_ATTEMPTS` | `3` | |
| `QUEUE_BACKOFF_MS` | `2000` | |
| `QUEUE_LOCK_DURATION_MS` | `900000` | Must cover OCR + multi-step AI |
| `QUEUE_STALLED_INTERVAL_MS` | `60000` | |
| `QUEUE_MAX_STALLED_COUNT` | `5` | |

## OpenAI / AI

| Variable | Default | Notes |
|---|---|---|
| `AI_PROVIDER` | `openai` | |
| `OPENAI_API_KEY` | *(required if openai)* | |
| `OPENAI_MODEL` | `gpt-5-nano` | |
| `OPENAI_TIMEOUT` | `60000` | |
| `OPENAI_BASE_URL` | *(optional)* | Custom base URL |
| `OPENAI_REASONING_EFFORT` | `minimal` | `minimal` \| `low` \| `medium` \| `high` |
| `MAX_AI_RETRIES` | `2` | Per agent step |
| `TEMPERATURE` | `1` | Ignored for gpt-5-nano |
| `MAX_OUTPUT_TOKENS` | `2048` | Cap for extraction step |

## OCR

| Variable | Default | Notes |
|---|---|---|
| `OCR_TIMEOUT` | `120000` | ms |
| `OCR_LANGUAGE` | `eng` | |
| `OCR_MIN_TEXT_LENGTH` | `80` | Direct-text minimum |
| `OCR_QUALITY_THRESHOLD` | `0.55` | Accept direct PDF text |
| `TEMP_DIRECTORY` | `./tmp/ocr` | Compose: `/app/tmp/ocr` |
| `OCR_PDF_RASTER_DPI` | `150` | `pdftoppm` DPI |

## Upload / storage

| Variable | Default | Notes |
|---|---|---|
| `MAX_UPLOAD_SIZE` / `UPLOAD_MAX_BYTES` | `10485760` | 10 MiB |
| `MAX_FILES_PER_UPLOAD` | `20` | Max 25 in schema |
| `STORAGE_DRIVER` | `local` | `local` \| `s3` (S3 not production-ready) |
| `STORAGE_LOCAL_PATH` | `./uploads` | Compose: `/app/uploads` |

## HTTP / CORS

| Variable | Default | Notes |
|---|---|---|
| `CORS_ORIGIN` | `http://localhost:5173` | Compose UI: `http://localhost:8080` |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Global API limit |
| `RATE_LIMIT_MAX` | `20000` | |
| `BODY_JSON_LIMIT` | `1mb` | |
| `TRUST_PROXY` | `false` | `true` behind nginx/Compose |

## Validation limits

| Variable | Default |
|---|---|
| `MAX_ALLOWED_AMOUNT` | `10000000` |
| `MAX_ALLOWED_CONSUMPTION` | `1000000` |
| `MAX_ALLOWED_QUANTITY` | `1000000` |
| `ENABLE_DUPLICATE_CHECK` | `true` |

## Frontend

| Variable | Default | Notes |
|---|---|---|
| `VITE_API_BASE_URL` | `/api/v1` (Docker) | Local: `http://127.0.0.1:3000/api/v1` |

## Compose host ports

| Variable | Default |
|---|---|
| `FRONTEND_PORT` | `8080` |
| `BACKEND_PORT` | `3000` |
