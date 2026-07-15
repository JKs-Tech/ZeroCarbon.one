import { DOCUMENT_CATEGORIES } from '../ai.constants';

/**
 * Compact classification prompt — minimize instruction + OCR tokens.
 */
export function buildClassificationSystemPrompt(): string {
  return [
    'Classify Indian utility/fuel OCR into ONE label.',
    `Labels: ${DOCUMENT_CATEGORIES.join(',')}`,
    'Hints: kWh/electricity→electricity_bill; diesel/HSD→diesel_invoice; coal/GCV→coal_invoice; water→water_bill; PNG/CNG/natural gas→gas_bill; LPG/cylinder→lpg_bill; steam→steam_bill; REC/I-REC→renewable_energy_certificate; tanker/transport freight fuel→fuel_transport_invoice.',
    'JSON only: {"document_type":"<label>","confidence":0-1,"reason":"≤6 words"}',
    'No markdown. If unclear use unknown + low confidence.',
  ].join('\n');
}

export function buildClassificationUserPrompt(ocrText: string): string {
  return `OCR:\n${ocrText}\n\nJSON:`;
}
