# AI Workflow

Agentic extraction runs inside the document processing worker after OCR completes. The API does not call OpenAI directly.

## Pipeline

```
OCR text → Classification Agent → Vendor Agent → Extraction Agent → (validation next)
```

Orchestrated by `AiService.processOcrText()`:

1. **Classification** — document category (e.g. `electricity_bill`, `diesel_invoice`, …, `unknown`)
2. **Vendor** — supplier / utility name (falls back to `Unknown`)
3. **Extraction** — labeled business fields as JSON, given type + vendor from prior steps

Each step is an independent task behind the `AiProvider` interface. Default provider: **OpenAI** (`AI_PROVIDER=openai`).

## OpenAI integration

- Model default: `gpt-5-nano` (`OPENAI_MODEL`)
- API: **Responses API** (`client.responses.create`) with `text.format: json_object`
- Reasoning: `reasoning.effort` from `OPENAI_REASONING_EFFORT` (default `minimal`)
- `store: false` — no server-side retention
- Temperature is not set for gpt-5-nano (reasoning models)

## OCR packing (input token control)

Before each agent call, OCR text is compressed and budgeted by mode (`packOcrForAgent`):

| Mode | Approx char budget | Strategy |
|---|---|---|
| classify | 3 500 | Head only |
| vendor | 4 500 | Head only |
| extract | 9 000 | ~65% head + ~35% tail (captures letterhead + totals) |

## Output token budgets

Per-step caps (`AiOutputTokenBudget`):

| Step | `max_output_tokens` |
|---|---|
| Classification | 256 |
| Vendor | 192 |
| Extraction | `min(MAX_OUTPUT_TOKENS, 1800)` |

## Retries

Transient OpenAI failures (rate limits, 5xx, timeouts, empty/incomplete responses) retry up to `MAX_AI_RETRIES` (default `2`) per agent step. Permanent errors (401/403/400, empty OCR) fail the job as unrecoverable.

## Worker status transitions

| Status | Meaning |
|---|---|
| `AI_PROCESSING` | Pipeline started |
| `AI_COMPLETED` | Classification, vendor, and extraction persisted |

Then the worker continues to validation (`VALIDATING` → …).

Other providers (`ollama`, `claude`, etc.) exist as stubs/adapters behind the factory; production path uses OpenAI Option B.
