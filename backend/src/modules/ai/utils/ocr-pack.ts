/**
 * Cost-focused OCR packing for LLM prompts.
 * Compresses whitespace and keeps high-signal slices (header + footer)
 * so invoices still expose totals/dates while using fewer input tokens.
 */

export type OcrPackMode = 'classify' | 'vendor' | 'extract';

const MODE_BUDGET: Record<OcrPackMode, number> = {
  // Classification mainly needs letterhead / title lines.
  classify: 3_500,
  // Vendor names usually appear near the top.
  vendor: 4_500,
  // Extraction needs broader coverage; keep head + tail for amounts.
  extract: 9_000,
};

/**
 * Compresses OCR noise without destroying numeric/date content.
 */
export function compressOcrText(raw: string): string {
  return raw
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/**
 * Packs OCR for a specific agent step within a token budget (approx by chars).
 * For longer docs, keeps the beginning and end — utility bill totals often sit at the bottom.
 */
export function packOcrForAgent(raw: string, mode: OcrPackMode): string {
  const text = compressOcrText(raw);
  const maxChars = MODE_BUDGET[mode];

  if (text.length <= maxChars) {
    return text;
  }

  if (mode === 'classify' || mode === 'vendor') {
    return `${text.slice(0, maxChars)}\n…[truncated]`;
  }

  // Extraction: 65% head + 35% tail to capture header identity + footer totals.
  const headBudget = Math.floor(maxChars * 0.65);
  const tailBudget = maxChars - headBudget - 24;
  const head = text.slice(0, headBudget);
  const tail = text.slice(-Math.max(tailBudget, 500));
  return `${head}\n…[middle truncated for cost]…\n${tail}`;
}
