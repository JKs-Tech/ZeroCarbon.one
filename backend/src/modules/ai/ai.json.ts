import { DOCUMENT_CATEGORIES, DocumentCategory, type DocumentCategoryValue } from './ai.constants';
import { AiPermanentError, AiTransientError } from './ai.errors';

/**
 * Strips optional markdown fences and parses a JSON object from model output.
 * Invalid JSON is treated as transient so the orchestrator may retry.
 */
export function parseModelJson(content: string): Record<string, unknown> {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new AiTransientError('AI returned empty content');
  }

  const withoutFences = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  // Recover truncated JSON when gpt-5-nano hits output limit mid-object.
  const candidates = [withoutFences, repairTruncatedJson(withoutFences)];

  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      const parsed: unknown = JSON.parse(candidate);
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new AiTransientError('AI JSON must be an object');
      }
      return parsed as Record<string, unknown>;
    } catch (error) {
      lastError = error;
    }
  }

  throw new AiTransientError(
    `Invalid JSON from AI: ${lastError instanceof Error ? lastError.message : 'parse failed'}`,
    lastError,
  );
}

/** Kept for callers that need a permanent empty-text failure. */
export function assertNonEmptyOcr(ocrText: string): void {
  if (!ocrText.trim()) {
    throw new AiPermanentError('Empty OCR text — cannot run AI extraction');
  }
}

/**
 * Normalizes confidence to [0, 1].
 */
export function normalizeConfidence(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  if (numeric < 0) {
    return 0;
  }
  if (numeric > 1) {
    return 1;
  }
  return numeric;
}

const DOCUMENT_TYPE_ALIASES: Record<string, DocumentCategoryValue> = {
  electricity: DocumentCategory.ELECTRICITY_BILL,
  electricity_bill: DocumentCategory.ELECTRICITY_BILL,
  power_bill: DocumentCategory.ELECTRICITY_BILL,
  diesel: DocumentCategory.DIESEL_INVOICE,
  diesel_invoice: DocumentCategory.DIESEL_INVOICE,
  hsd: DocumentCategory.DIESEL_INVOICE,
  coal: DocumentCategory.COAL_INVOICE,
  coal_invoice: DocumentCategory.COAL_INVOICE,
  water: DocumentCategory.WATER_BILL,
  water_bill: DocumentCategory.WATER_BILL,
  gas: DocumentCategory.GAS_BILL,
  gas_bill: DocumentCategory.GAS_BILL,
  natural_gas: DocumentCategory.GAS_BILL,
  natural_gas_bill: DocumentCategory.GAS_BILL,
  png: DocumentCategory.GAS_BILL,
  cng: DocumentCategory.GAS_BILL,
  lpg: DocumentCategory.LPG_BILL,
  lpg_bill: DocumentCategory.LPG_BILL,
  steam: DocumentCategory.STEAM_BILL,
  steam_bill: DocumentCategory.STEAM_BILL,
  rec: DocumentCategory.RENEWABLE_ENERGY_CERTIFICATE,
  renewable: DocumentCategory.RENEWABLE_ENERGY_CERTIFICATE,
  renewable_energy_certificate: DocumentCategory.RENEWABLE_ENERGY_CERTIFICATE,
  i_rec: DocumentCategory.RENEWABLE_ENERGY_CERTIFICATE,
  fuel_transport: DocumentCategory.FUEL_TRANSPORT_INVOICE,
  fuel_transport_invoice: DocumentCategory.FUEL_TRANSPORT_INVOICE,
  fuel_transportation: DocumentCategory.FUEL_TRANSPORT_INVOICE,
  transportation_invoice: DocumentCategory.FUEL_TRANSPORT_INVOICE,
};

/**
 * Validates a document category value; falls back to unknown.
 */
export function normalizeDocumentType(value: unknown): DocumentCategoryValue {
  if (typeof value !== 'string') {
    return DocumentCategory.UNKNOWN;
  }

  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if ((DOCUMENT_CATEGORIES as string[]).includes(normalized)) {
    return normalized as DocumentCategoryValue;
  }

  return DOCUMENT_TYPE_ALIASES[normalized] ?? DocumentCategory.UNKNOWN;
}

/**
 * Coerces field map values to string | number | null.
 * Accepts either `fields` object or a flattened envelope.
 */
export function normalizeFields(value: unknown): Record<string, string | number | null> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const result: Record<string, string | number | null> = {};
  for (const [key, fieldValue] of Object.entries(value as Record<string, unknown>)) {
    if (fieldValue === null || fieldValue === undefined || fieldValue === '') {
      result[key] = null;
    } else if (typeof fieldValue === 'number' && Number.isFinite(fieldValue)) {
      result[key] = fieldValue;
    } else if (typeof fieldValue === 'boolean') {
      result[key] = fieldValue ? 1 : 0;
    } else if (typeof fieldValue === 'string') {
      const trimmed = fieldValue.trim();
      if (!trimmed || /^n\/?a$/i.test(trimmed) || trimmed === '-') {
        result[key] = null;
        continue;
      }
      const numeric = coerceNumericString(trimmed);
      result[key] = numeric ?? trimmed;
    } else if (typeof fieldValue === 'object') {
      // Skip nested objects — keep extraction flat for review UI.
      continue;
    } else {
      result[key] = String(fieldValue);
    }
  }

  return result;
}

function coerceNumericString(value: string): number | null {
  // "1,54,000.50" / "₹ 154000" / "12.5%" → number when unambiguous.
  const cleaned = value
    .replace(/[₹$€£,\s]/g, '')
    .replace(/%$/, '');
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) {
    return null;
  }
  const numeric = Number(cleaned);
  return Number.isFinite(numeric) ? numeric : null;
}

/**
 * Best-effort close of truncated JSON objects/arrays from incomplete model output.
 */
function repairTruncatedJson(raw: string): string {
  let text = raw.trim();
  if (!text.startsWith('{') && !text.startsWith('[')) {
    return text;
  }

  // Drop trailing incomplete string / number fragments.
  text = text.replace(/,\s*"[^"]*$/s, '');
  text = text.replace(/:\s*"[^"]*$/s, ': null');
  text = text.replace(/,\s*$/s, '');

  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  for (const char of text) {
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === '{' || char === '[') {
      stack.push(char);
    } else if (char === '}' || char === ']') {
      stack.pop();
    }
  }

  if (inString) {
    text += '"';
  }

  while (stack.length > 0) {
    const open = stack.pop();
    text += open === '{' ? '}' : ']';
  }

  return text;
}
