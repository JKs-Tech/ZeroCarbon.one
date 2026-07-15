/**
 * Compact vendor prompt — focus on letterhead / supplier identity.
 */
export function buildVendorSystemPrompt(): string {
  return [
    'Extract the utility provider / supplier / seller legal or trade name from OCR.',
    'Prefer brand on letterhead (e.g. Tata Power, Adani Electricity, BSES, IOCL, BPCL, HPCL).',
    'Ignore customer names. If unclear → "Unknown".',
    'JSON only: {"vendor":"<name|Unknown>","confidence":0-1}',
    'No markdown.',
  ].join('\n');
}

export function buildVendorUserPrompt(ocrText: string): string {
  return `OCR:\n${ocrText}\n\nJSON:`;
}
