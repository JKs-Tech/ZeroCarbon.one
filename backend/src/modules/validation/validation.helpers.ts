import type { ValidationWarning } from './interfaces/validation-result.interface';

/**
 * Shared helpers for reading extracted fields without mutation.
 */

export function getField(
  fields: Record<string, string | number | null>,
  key: string,
): string | number | null | undefined {
  if (Object.prototype.hasOwnProperty.call(fields, key)) {
    return fields[key];
  }

  const lower = key.toLowerCase();
  for (const [candidate, value] of Object.entries(fields)) {
    if (candidate.toLowerCase() === lower) {
      return value;
    }
  }

  return undefined;
}

export function isMissing(value: string | number | null | undefined): boolean {
  if (value === null || value === undefined) {
    return true;
  }
  if (typeof value === 'string' && value.trim().length === 0) {
    return true;
  }
  return false;
}

export function parseNumeric(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  const cleaned = value
    .replace(/[,₹$]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .match(/-?\d+(\.\d+)?/);

  if (!cleaned) {
    return null;
  }

  const numeric = Number(cleaned[0]);
  return Number.isFinite(numeric) ? numeric : null;
}

/**
 * Best-effort date parse for common bill formats (ISO, DD/MM/YYYY, DD-MM-YYYY).
 */
export function parseDate(value: string | number | null | undefined): Date | null {
  if (value === null || value === undefined) {
    return null;
  }

  const raw = String(value).trim();
  if (!raw) {
    return null;
  }

  const iso = Date.parse(raw);
  if (!Number.isNaN(iso)) {
    return new Date(iso);
  }

  const dmy = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    let year = Number(dmy[3]);
    if (year < 100) {
      year += 2000;
    }
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    ) {
      return date;
    }
  }

  return null;
}

export function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function mergeWarnings(...groups: ValidationWarning[][]): ValidationWarning[] {
  const seen = new Set<string>();
  const result: ValidationWarning[] = [];

  for (const group of groups) {
    for (const warning of group) {
      const key = `${warning.code}:${warning.field ?? ''}:${warning.message}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      result.push(warning);
    }
  }

  return result;
}
