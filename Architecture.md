# Architecture

ZeroCarbon.one utility bill extraction — as implemented.

---

## 1. System overview

```mermaid
flowchart TB
  subgraph Client
    FE[React SPA]
  end

  subgraph API Process
    API[Express API<br/>JWT · Upload · Review · Admin]
  end

  subgraph Worker Process
    W[BullMQ Worker]
    OCR[Hybrid OCR]
    AI[Agentic AI<br/>Classify → Vendor → Extract]
    VAL[Validation]
  end

  subgraph Data
    MONGO[(MongoDB)]
    REDIS[(Redis)]
    FS[(Upload files)]
  end

  OPENAI[OpenAI GPT-5 Nano]

  FE -->|REST / JWT| API
  API --> MONGO
  API --> FS
  API -->|enqueue PROCESS_DOCUMENT| REDIS
  REDIS --> W
  W --> OCR --> AI --> VAL
  AI --> OPENAI
  W --> MONGO
  W --> FS
  FE -->|edit / approve| API
```

**Idea:** the API accepts uploads and reviews; a separate worker does the heavy OCR + AI work so the UI stays responsive.

---

## 2. End-to-end pipeline

```mermaid
sequenceDiagram
  actor User
  participant FE as Frontend
  participant API as Express API
  participant Q as BullMQ / Redis
  participant W as Worker
  participant DB as MongoDB

  User->>FE: Register / Login
  FE->>API: JWT auth
  User->>FE: Upload bill
  FE->>API: multipart file
  API->>DB: create document QUEUED
  API->>Q: PROCESS_DOCUMENT
  Q->>W: job
  W->>W: OCR
  W->>W: Classification → Vendor → Extraction
  W->>W: Validation warnings
  W->>DB: WAITING_FOR_REVIEW
  User->>FE: Review & edit
  FE->>API: save fields
  User->>FE: Approve
  FE->>API: approve
  API->>DB: APPROVED + approvedFields
```

```mermaid
flowchart LR
  A[Upload] --> B[Queued]
  B --> C[OCR]
  C --> D[Classification]
  D --> E[Vendor]
  E --> F[Extraction]
  F --> G[Validation]
  G --> H[Waiting for review]
  H --> I[Human edit]
  I --> J[Approved]
```

---

## 3. Hybrid OCR

```mermaid
flowchart TD
  F[Uploaded file] --> PDF{Is PDF?}
  PDF -->|Yes| T[Extract embedded text<br/>pdf-parse]
  T --> Q{Text quality OK?}
  Q -->|Yes| OUT[OCR text + metadata]
  Q -->|No| R[Rasterize pages<br/>pdftoppm]
  R --> TE[Tesseract OCR]
  TE --> OUT
  PDF -->|No — image| TE
```

Quality uses length + alphanumeric ratio. Multi-page PDFs are merged. Temp raster files are cleaned up after OCR.

---

## 4. Agentic AI (OpenAI)

```mermaid
flowchart LR
  OCR[OCR text] --> C[1. Classification Agent]
  C --> V[2. Vendor Agent]
  V --> E[3. Extraction Agent]
  E --> JSON[Structured JSON fields]
  C -.->|gpt-5-nano| OAI[OpenAI Responses API]
  V -.-> OAI
  E -.-> OAI
```

Behind an `AiProvider` interface (Option B — cloud). Prompts live in separate files. Output is structured JSON for validation and review.

---

## 5. Human review & RBAC

```mermaid
flowchart TB
  WAIT[WAITING_FOR_REVIEW] --> EDIT[Edit extracted fields]
  EDIT --> SAVE[Saved + audit log]
  SAVE --> APPR[Approve]
  APPR --> DONE[APPROVED<br/>approvedFields frozen]

  subgraph Roles
    U[USER — own documents only]
    A[ADMIN — all documents + manage users]
  end
```

**First registered user → ADMIN.** Later users → USER. Admins can promote others.

---

## 6. Docker Compose layout

```mermaid
flowchart TB
  Browser --> FE[frontend<br/>nginx :8080]
  FE -->|/api proxy| BE[backend :3000]
  BE --> M[(mongodb)]
  BE --> R[(redis)]
  W[worker] --> R
  W --> M
  W --> OAI[OpenAI]
  BE --- VOL[(uploads volume)]
  W --- VOL
```

```bash
cp backend/.env.example backend/.env   # set JWT_SECRET + OPENAI_API_KEY
docker compose up --build
```

Compose sets Mongo/Redis service hostnames. API and worker share the same image and upload volume.

---

## 7. Backend modules

| Module | Responsibility |
|---|---|
| `authentication` / `users` | JWT, register/login, RBAC |
| `upload` | Multipart validation, store file, enqueue |
| `queue` | BullMQ producer + worker consumer |
| `ocr` | Hybrid PDF / image OCR |
| `ai` | Classify → vendor → extract |
| `validation` | Warnings (missing, units, duplicate, suspicious) |
| `review` | Edit fields + approve |
| `documents` | Persistence + lists |
| `health` | Mongo / Redis / queue status |

---

## Why this shape

- Matches assignment: Upload → Queue → OCR → AI → Validation → Human review  
- API and worker scale independently  
- Human approval is required (no auto-approve)  
- Secrets live only in `backend/.env` (never committed)  
