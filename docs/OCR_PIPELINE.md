# OCR Pipeline

Hybrid OCR runs in the worker after a document is dequeued. Input is the stored file buffer + MIME type; output is plain text plus metadata saved on the document.

## Flow

```
Uploaded file
  ├─ PDF → pdf-parse (direct text)
  │         └─ quality OK? → use DIRECT_TEXT
  │         └─ quality poor / parse fail → pdftoppm → Tesseract
  └─ PNG / JPEG → materialize temp file → Tesseract
```

## PDF path

1. **Direct text** via `pdf-parse`.
2. **Quality evaluation** (`QualityEvaluatorService`): score from length, alphanumeric ratio, whitespace ratio, and readable word count. Acceptable when score ≥ `OCR_QUALITY_THRESHOLD` (default `0.55`) and length ≥ `OCR_MIN_TEXT_LENGTH` (default `80`).
3. If unacceptable (or parse fails): **rasterize** with Poppler `pdftoppm` at `OCR_PDF_RASTER_DPI` (default `150`), then **Tesseract.js** per page.

## Image path

PNG/JPEG buffers are written to a temp file and run through Tesseract directly (no PDF text path).

## Page merge

Multi-page results are joined with page markers (`----- PAGE N -----` and page-break separators). Empty pages are labeled.

## Cleanup

Each OCR run uses a unique directory under `TEMP_DIRECTORY` (default `./tmp/ocr`). The converter always best-effort `rm -rf`s that directory in a `finally` block after Tesseract finishes (or if `pdftoppm` fails mid-conversion).

## Metadata persisted

Saved on `document.ocr` when status advances to `OCR_COMPLETED`:

| Field | Meaning |
|---|---|
| `text` | Merged OCR/plain text |
| `method` | `DIRECT_TEXT` or `TESSERACT` |
| `confidence` | Average Tesseract confidence when applicable |
| `durationMs` | Wall time |
| `pageCount` | Page count |
| `qualityScore` | Direct-text quality score when evaluated |
| `fallbackTriggered` | `true` when PDF fell back to raster OCR |
| `completedAt` | Timestamp |

## Requirements

- Overall OCR step timeout: `OCR_TIMEOUT` (default 120 s)
- Language: `OCR_LANGUAGE` (default `eng`)
- Local scanned-PDF OCR needs **Poppler** (`pdftoppm`) installed; the Docker backend/worker image includes it
