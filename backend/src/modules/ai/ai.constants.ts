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

/** Tight per-step output caps — saves completion + reasoning tokens on gpt-5-nano. */
export const AiOutputTokenBudget = {
  classify: 256,
  vendor: 192,
  extract: 1_800,
} as const;
