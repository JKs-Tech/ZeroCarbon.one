# Validation

Deterministic rule engine over AI extraction output. It never mutates fields and never calls AI. Warnings are informational — validation does not reject documents.

## Worker status flow

```
AI_COMPLETED → VALIDATING → VALIDATION_COMPLETED → WAITING_FOR_REVIEW
```

After warnings are saved, the worker sets `WAITING_FOR_REVIEW` so a human can edit and approve.

## Rule categories

| Category | What it checks |
|---|---|
| **Missing fields** | Required labels per document type (e.g. provider, consumer number, billing period, amounts) |
| **Units** | Allowed units (`kWh`, `Litres`, `Tonnes`) for water/gas/LPG/steam; unexpected non-kWh on electricity |
| **Amounts / suspicious values** | Negative amounts, GST, consumption, quantity; values above `MAX_ALLOWED_AMOUNT` / `MAX_ALLOWED_CONSUMPTION` / `MAX_ALLOWED_QUANTITY` |
| **Duplicates** | Optional DB lookup (`ENABLE_DUPLICATE_CHECK`) for matching supplier + invoice/consumer + billing period |
| **Dates / account / consistency** | Additional heuristic rules in the same engine |

`isValid` on the result is always `true` after a successful pass — the product treats issues as warnings only.

## UI display

Warnings are returned on document detail and review payloads and shown via `ValidationWarningCard` on:

- Document Details (`/documents/:id`)
- Human Review (`/documents/:id/review`)

If there are no warnings, the UI shows a success alert (“No validation warnings.”).

## Configuration

| Variable | Default | Role |
|---|---|---|
| `MAX_ALLOWED_AMOUNT` | `10000000` | Flag extreme totals |
| `MAX_ALLOWED_CONSUMPTION` | `1000000` | Flag extreme usage |
| `MAX_ALLOWED_QUANTITY` | `1000000` | Flag extreme quantities |
| `ENABLE_DUPLICATE_CHECK` | `true` | Toggle duplicate warnings |
