/**
 * Cost-aware OCR packing for LLM prompts.
 * Compresses whitespace and keeps high-signal slices so large utility bills
 * still expose consumer IDs, periods, and totals within the prompt budget.
 */

export type OcrPackMode = 'classify' | 'vendor' | 'extract';

/** Expanded budgets for large single-page scanned bills. */
const MODE_BUDGET: Record<OcrPackMode, number> = {
  classify: 6_000,
  vendor: 7_000,
  extract: 18_000,
};

const HIGH_SIGNAL =
  /\b(total|amount|due|bill\s*date|invoice|consumer|account|gst|cgst|sgst|igst|kwh|units?|period|meter|quantity|rate|gcv|litre|tonne|mwh|freight|certificate|pan|gstin|sac|hsn|contract\s*demand|maximum\s*demand)\b/i;

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
 * Packs OCR for a specific agent step within a char budget.
 * Extraction keeps head + high-signal middle lines + tail so large bills
 * do not lose amounts buried in the middle of a dense page.
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

  const headBudget = Math.floor(maxChars * 0.5);
  const tailBudget = Math.floor(maxChars * 0.3);
  const middleBudget = maxChars - headBudget - tailBudget - 80;

  const head = text.slice(0, headBudget);
  const tail = text.slice(-Math.max(tailBudget, 800));
  const middleSection = text.slice(headBudget, Math.max(headBudget, text.length - tailBudget));
  const priorityMiddle = pickHighSignalLines(middleSection, Math.max(middleBudget, 400));

  return [
    head,
    '…[priority middle lines]…',
    priorityMiddle,
    '…[tail]…',
    tail,
  ].join('\n');
}

/**
 * Keeps lines that look like labeled bill fields (amounts, IDs, dates).
 */
function pickHighSignalLines(section: string, maxChars: number): string {
  const lines = section.split('\n').map((line) => line.trim()).filter(Boolean);
  const selected: string[] = [];
  let used = 0;

  for (const line of lines) {
    const looksUseful =
      HIGH_SIGNAL.test(line) ||
      /\d{1,3}(?:,\d{3})+(?:\.\d+)?/.test(line) ||
      /\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(line) ||
      /\b\d{6,}\b/.test(line);

    if (!looksUseful) {
      continue;
    }

    if (used + line.length + 1 > maxChars) {
      break;
    }

    selected.push(line);
    used += line.length + 1;
  }

  if (selected.length === 0) {
    return section.slice(0, maxChars);
  }

  return selected.join('\n');
}
