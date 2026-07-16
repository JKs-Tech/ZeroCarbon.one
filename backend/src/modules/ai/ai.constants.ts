/**
 * Allowed document categories for Classification Agent.
 * Covers all bill/invoice families named in the assignment brief.
 */
export const DocumentCategory = {
  ELECTRICITY_BILL: 'electricity_bill',
  DIESEL_INVOICE: 'diesel_invoice',
  COAL_INVOICE: 'coal_invoice',
  WATER_BILL: 'water_bill',
  GAS_BILL: 'gas_bill',
  LPG_BILL: 'lpg_bill',
  STEAM_BILL: 'steam_bill',
  RENEWABLE_ENERGY_CERTIFICATE: 'renewable_energy_certificate',
  FUEL_TRANSPORT_INVOICE: 'fuel_transport_invoice',
  UNKNOWN: 'unknown',
} as const;

export type DocumentCategoryValue =
  (typeof DocumentCategory)[keyof typeof DocumentCategory];

export const DOCUMENT_CATEGORIES: DocumentCategoryValue[] = Object.values(DocumentCategory);

/**
 * Supported AI provider identifiers.
 */
export const AiProviderId = {
  OPENAI: 'openai',
  OLLAMA: 'ollama',
  CLAUDE: 'claude',
  GEMINI: 'gemini',
  MISTRAL: 'mistral',
  LLAMA: 'llama',
  AZURE_OPENAI: 'azure-openai',
} as const;

export type AiProviderIdValue = (typeof AiProviderId)[keyof typeof AiProviderId];

/**
 * Per-step Responses API output caps.
 * GPT-5 reasoning tokens count against max_output_tokens — budgets must leave
 * room for reasoning + JSON, not just the final object.
 */
export const AiOutputTokenBudget = {
  classify: 1_536,
  vendor: 1_024,
  extract: 8_192,
} as const;

/** Tesseract confidence (0–100) below which vision extraction is preferred. */
export const OCR_VISION_CONFIDENCE_THRESHOLD = 65;

/** Minimum OCR char length before treating text as too thin for text-only extract. */
export const OCR_THIN_TEXT_CHARS = 120;
