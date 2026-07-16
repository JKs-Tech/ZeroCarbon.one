import type { DocumentCategoryValue } from '../ai.constants';
import { DocumentCategory } from '../ai.constants';

/**
 * Dense extraction prompt — mandatory keys + any other labeled facts found.
 * Keeps instructions short to reduce prompt tokens while maximizing recall.
 */
export function buildExtractionSystemPrompt(documentType: DocumentCategoryValue): string {
  const fields = fieldListForType(documentType);
  return [
    'Extract ALL useful structured fields from a utility/fuel bill into JSON.',
    'You may receive OCR text and optionally a page image of the same bill.',
    'When an image is present, use both: prefer readable values from the image when OCR is noisy or incomplete.',
    'JSON only. No markdown.',
    'Shape: {"document_type":"...","vendor":"...","fields":{...},"confidence_score":0-1}',
    `document_type MUST be "${documentType}".`,
    `Required keys in fields (null if absent): ${fields.join(' | ')}`,
    'Also add ANY other clearly labeled values (GSTIN, PAN, meter no, address, late fee, SAC, HSN, CGST/SGST/IGST, PO no, vehicle no, certificate id, bill month, billing period, invoice number, consumer number, etc.) using the label as the key.',
    'Rules: never invent; keep exact numbers/dates from the document; prefer numbers for amounts/qty; strip currency symbols; ISO dates YYYY-MM-DD when unambiguous; confidence_score = fraction of required keys confidently filled.',
    'This page is one independent bill — extract only fields for this page.',
  ].join('\n');
}

export function buildExtractionUserPrompt(
  ocrText: string,
  documentType: DocumentCategoryValue,
  vendor: string,
  withImage = false,
): string {
  return [
    `TYPE:${documentType}`,
    `VENDOR:${vendor}`,
    withImage
      ? 'A page IMAGE of this bill is attached — cross-check OCR against the image and fill every labeled field you can read.'
      : 'OCR text only (no image).',
    'OCR:',
    ocrText,
    'JSON:',
  ].join('\n');
}

export function fieldListForType(documentType: DocumentCategoryValue): string[] {
  switch (documentType) {
    case DocumentCategory.ELECTRICITY_BILL:
      return [
        'Utility Provider',
        'Consumer Number',
        'Account Number',
        'Billing Period',
        'Bill Month',
        'Bill Date',
        'Due Date',
        'Units Consumed (kWh)',
        'Contract Demand',
        'Maximum Demand',
        'Total Bill Amount',
        'GST Amount',
      ];
    case DocumentCategory.DIESEL_INVOICE:
      return [
        'Supplier Name',
        'Invoice Number',
        'Invoice Date',
        'Quantity (Litres)',
        'Rate Per Litre',
        'Total Amount',
      ];
    case DocumentCategory.COAL_INVOICE:
      return [
        'Supplier Name',
        'Invoice Number',
        'Invoice Date',
        'Coal Grade',
        'Quantity (Tonnes)',
        'GCV',
        'Moisture %',
        'Total Amount',
      ];
    case DocumentCategory.WATER_BILL:
      return [
        'Supplier Name',
        'Billing Period',
        'Consumption Volume',
        'Unit',
        'Total Amount',
      ];
    case DocumentCategory.GAS_BILL:
    case DocumentCategory.LPG_BILL:
    case DocumentCategory.STEAM_BILL:
      return [
        'Supplier Name',
        'Billing Period',
        'Consumption Volume',
        'Unit',
        'Total Amount',
      ];
    case DocumentCategory.RENEWABLE_ENERGY_CERTIFICATE:
      return [
        'Certificate Number',
        'Issuer',
        'Energy Source',
        'Quantity (MWh)',
        'Issue Date',
        'Validity Period',
        'Total Amount',
      ];
    case DocumentCategory.FUEL_TRANSPORT_INVOICE:
      return [
        'Supplier Name',
        'Invoice Number',
        'Invoice Date',
        'Vehicle Number',
        'Fuel Type',
        'Quantity',
        'Unit',
        'Freight Amount',
        'Total Amount',
      ];
    default:
      return [
        'Supplier Name',
        'Invoice Number',
        'Invoice Date',
        'Billing Period',
        'Quantity',
        'Unit',
        'Total Amount',
        'GST Amount',
      ];
  }
}
