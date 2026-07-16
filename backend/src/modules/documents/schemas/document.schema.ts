import { Schema, model, type HydratedDocument, type Model, Types } from 'mongoose';
import {
  DocumentProcessingStatus,
  type DocumentProcessingStatusValue,
} from '../../../common/constants';

/**
 * OCR artifact stored after Phase 6 hybrid extraction.
 */
export interface DocumentOcrArtifact {
  text: string;
  method: 'DIRECT_TEXT' | 'TESSERACT';
  confidence?: number;
  durationMs: number;
  pageCount: number;
  qualityScore?: number;
  fallbackTriggered: boolean;
  completedAt: Date;
}

/**
 * Classification Agent artifact (Phase 7).
 */
export interface DocumentClassificationArtifact {
  documentType: string;
  confidence: number;
  reasoningSummary: string;
  provider: string;
  model: string;
  durationMs: number;
  promptTokens?: number;
  completionTokens?: number;
  rawResponse?: string;
  completedAt: Date;
}

/**
 * Vendor Agent artifact (Phase 7).
 */
export interface DocumentVendorArtifact {
  name: string;
  confidence: number;
  provider: string;
  model: string;
  durationMs: number;
  promptTokens?: number;
  completionTokens?: number;
  rawResponse?: string;
  completedAt: Date;
}

/**
 * Extraction Agent artifact (Phase 7).
 */
export interface DocumentExtractionArtifact {
  documentType: string;
  vendor: string;
  fields: Record<string, string | number | null>;
  /** Immutable AI snapshot at extraction time — never updated on human edit. */
  originalFields?: Record<string, string | number | null>;
  confidenceScore: number;
  provider: string;
  model: string;
  durationMs: number;
  totalProcessingTimeMs: number;
  promptTokens?: number;
  completionTokens?: number;
  rawResponse?: string;
  completedAt: Date;
}

/**
 * Single validation warning (Phase 8).
 */
export interface DocumentValidationWarning {
  code: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  message: string;
  field?: string;
}

/**
 * Validation artifact (Phase 8) — never mutates OCR/AI.
 */
export interface DocumentValidationArtifact {
  isValid: boolean;
  warningCount: number;
  warnings: DocumentValidationWarning[];
  summary: string;
  validatedAt: Date;
  processingTime: number;
}

/**
 * Approval artifact (Phase 9).
 */
export interface DocumentApprovalArtifact {
  approved: boolean;
  approvedBy: Types.ObjectId;
  approvedAt: Date;
}

/**
 * Document metadata through Human Review (Phase 9).
 */
export interface ChildStatusSummary {
  processing: number;
  review: number;
  approved: number;
  failed: number;
}

export interface IDocument {
  userId: Types.ObjectId;
  originalFileName: string;
  storedFileName: string;
  storagePath: string;
  mimeType: string;
  fileSize: number;
  uploadTimestamp: Date;
  processingStatus: DocumentProcessingStatusValue;
  /** Parent upload record for multi-page PDF splits. */
  parentUploadId?: Types.ObjectId;
  /** 1-based page index for child page documents. */
  pageNumber?: number;
  /** Total pages in the source PDF (parent + children). */
  totalPages?: number;
  /** True on parent upload records that contain child page documents. */
  isUploadContainer?: boolean;
  jobId?: string;
  failureReason?: string;
  ocr?: DocumentOcrArtifact;
  classification?: DocumentClassificationArtifact;
  vendor?: DocumentVendorArtifact;
  extraction?: DocumentExtractionArtifact;
  validation?: DocumentValidationArtifact;
  /** Canonical approved field snapshot — set once on approval. */
  approvedFields?: Record<string, string | number | null>;
  approval?: DocumentApprovalArtifact;
  createdAt: Date;
  updatedAt: Date;
}

const ocrArtifactSchema = new Schema<DocumentOcrArtifact>(
  {
    text: { type: String, required: true },
    method: {
      type: String,
      enum: ['DIRECT_TEXT', 'TESSERACT'],
      required: true,
    },
    confidence: { type: Number, required: false },
    durationMs: { type: Number, required: true },
    pageCount: { type: Number, required: true },
    qualityScore: { type: Number, required: false },
    fallbackTriggered: { type: Boolean, required: true, default: false },
    completedAt: { type: Date, required: true },
  },
  { _id: false },
);

const classificationArtifactSchema = new Schema<DocumentClassificationArtifact>(
  {
    documentType: { type: String, required: true },
    confidence: { type: Number, required: true },
    reasoningSummary: { type: String, required: true, default: '' },
    provider: { type: String, required: true },
    model: { type: String, required: true },
    durationMs: { type: Number, required: true },
    promptTokens: { type: Number, required: false },
    completionTokens: { type: Number, required: false },
    rawResponse: { type: String, required: false },
    completedAt: { type: Date, required: true },
  },
  { _id: false },
);

const vendorArtifactSchema = new Schema<DocumentVendorArtifact>(
  {
    name: { type: String, required: true },
    confidence: { type: Number, required: true },
    provider: { type: String, required: true },
    model: { type: String, required: true },
    durationMs: { type: Number, required: true },
    promptTokens: { type: Number, required: false },
    completionTokens: { type: Number, required: false },
    rawResponse: { type: String, required: false },
    completedAt: { type: Date, required: true },
  },
  { _id: false },
);

const extractionArtifactSchema = new Schema<DocumentExtractionArtifact>(
  {
    documentType: { type: String, required: true },
    vendor: { type: String, required: true },
    fields: { type: Schema.Types.Mixed, required: true, default: {} },
    originalFields: { type: Schema.Types.Mixed, required: false },
    confidenceScore: { type: Number, required: true, default: 0 },
    provider: { type: String, required: true },
    model: { type: String, required: true },
    durationMs: { type: Number, required: true },
    totalProcessingTimeMs: { type: Number, required: true },
    promptTokens: { type: Number, required: false },
    completionTokens: { type: Number, required: false },
    rawResponse: { type: String, required: false },
    completedAt: { type: Date, required: true },
  },
  { _id: false },
);

const validationWarningSchema = new Schema<DocumentValidationWarning>(
  {
    code: { type: String, required: true },
    severity: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH'],
      required: true,
    },
    message: { type: String, required: true },
    field: { type: String, required: false },
  },
  { _id: false },
);

const validationArtifactSchema = new Schema<DocumentValidationArtifact>(
  {
    isValid: { type: Boolean, required: true },
    warningCount: { type: Number, required: true },
    warnings: { type: [validationWarningSchema], required: true, default: [] },
    summary: { type: String, required: true },
    validatedAt: { type: Date, required: true },
    processingTime: { type: Number, required: true },
  },
  { _id: false },
);

const approvalArtifactSchema = new Schema<DocumentApprovalArtifact>(
  {
    approved: { type: Boolean, required: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    approvedAt: { type: Date, required: true },
  },
  { _id: false },
);

const documentSchema = new Schema<IDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    originalFileName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
    },
    storedFileName: {
      type: String,
      required: true,
    },
    storagePath: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      required: true,
      min: 1,
    },
    uploadTimestamp: {
      type: Date,
      required: true,
      default: () => new Date(),
    },
    processingStatus: {
      type: String,
      enum: Object.values(DocumentProcessingStatus),
      required: true,
      default: DocumentProcessingStatus.UPLOADED,
      index: true,
    },
    parentUploadId: {
      type: Schema.Types.ObjectId,
      ref: 'Document',
      required: false,
      index: true,
    },
    pageNumber: {
      type: Number,
      required: false,
      min: 1,
    },
    totalPages: {
      type: Number,
      required: false,
      min: 1,
    },
    isUploadContainer: {
      type: Boolean,
      required: false,
      default: false,
      index: true,
    },
    jobId: {
      type: String,
      required: false,
    },
    failureReason: {
      type: String,
      required: false,
      maxlength: 2000,
    },
    ocr: {
      type: ocrArtifactSchema,
      required: false,
    },
    classification: {
      type: classificationArtifactSchema,
      required: false,
    },
    vendor: {
      type: vendorArtifactSchema,
      required: false,
    },
    extraction: {
      type: extractionArtifactSchema,
      required: false,
    },
    validation: {
      type: validationArtifactSchema,
      required: false,
    },
    approvedFields: {
      type: Schema.Types.Mixed,
      required: false,
    },
    approval: {
      type: approvalArtifactSchema,
      required: false,
    },
  },
  {
    timestamps: true,
    collection: 'documents',
    versionKey: false,
  },
);

documentSchema.index({ userId: 1, createdAt: -1 });
documentSchema.index({ parentUploadId: 1, pageNumber: 1 }, { sparse: true });
documentSchema.index({ userId: 1, isUploadContainer: 1, createdAt: -1 });
documentSchema.index({ jobId: 1 }, { sparse: true });
documentSchema.index({ 'vendor.name': 1, createdAt: -1 });
documentSchema.index({ processingStatus: 1, updatedAt: -1 });
documentSchema.index({ 'extraction.fields.Invoice Number': 1 }, { sparse: true });
documentSchema.index({ 'extraction.fields.Consumer Number': 1 }, { sparse: true });
documentSchema.index({ 'extraction.fields.Billing Period': 1 }, { sparse: true });

export type DocumentRecord = HydratedDocument<IDocument>;
export type DocumentModelType = Model<IDocument>;

export const DocumentModel: DocumentModelType = model<IDocument>('Document', documentSchema);

/**
 * Public document metadata returned by upload APIs.
 */
export interface PublicDocument {
  id: string;
  userId: string;
  originalFileName: string;
  storedFileName: string;
  storagePath: string;
  mimeType: string;
  fileSize: number;
  processingStatus: DocumentProcessingStatusValue;
  parentUploadId?: string;
  pageNumber?: number;
  totalPages?: number;
  isUploadContainer?: boolean;
  pageDocumentCount?: number;
  childStatusSummary?: ChildStatusSummary;
  jobId?: string;
  failureReason?: string;
  ocr?: DocumentOcrArtifact;
  classification?: DocumentClassificationArtifact;
  vendor?: DocumentVendorArtifact;
  extraction?: DocumentExtractionArtifact;
  validation?: DocumentValidationArtifact;
  approvedFields?: Record<string, string | number | null>;
  approval?: {
    approved: boolean;
    approvedBy: string;
    approvedAt: Date;
  };
  uploadTimestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Maps a Mongoose document to the public API shape.
 * Omits filesystem paths and raw LLM payloads (not needed by the UI).
 */
export function toPublicDocument(
  doc: DocumentRecord,
  extras?: { pageDocumentCount?: number; childStatusSummary?: ChildStatusSummary },
): PublicDocument {
  return {
    id: doc._id.toString(),
    userId: doc.userId.toString(),
    originalFileName: doc.originalFileName,
    storedFileName: doc.storedFileName,
    storagePath: '',
    mimeType: doc.mimeType,
    fileSize: doc.fileSize,
    processingStatus: doc.processingStatus,
    parentUploadId: doc.parentUploadId?.toString(),
    pageNumber: doc.pageNumber,
    totalPages: doc.totalPages,
    isUploadContainer: doc.isUploadContainer ?? false,
    pageDocumentCount: extras?.pageDocumentCount,
    childStatusSummary: extras?.childStatusSummary,
    jobId: doc.jobId,
    failureReason: doc.failureReason,
    ocr: doc.ocr
      ? {
          text: doc.ocr.text,
          method: doc.ocr.method,
          confidence: doc.ocr.confidence,
          durationMs: doc.ocr.durationMs,
          pageCount: doc.ocr.pageCount,
          qualityScore: doc.ocr.qualityScore,
          fallbackTriggered: doc.ocr.fallbackTriggered,
          completedAt: doc.ocr.completedAt,
        }
      : undefined,
    classification: stripAiRaw(doc.classification),
    vendor: stripAiRaw(doc.vendor),
    extraction: stripAiRaw(doc.extraction),
    validation: doc.validation,
    approvedFields: doc.approvedFields,
    approval: doc.approval
      ? {
          approved: doc.approval.approved,
          approvedBy: doc.approval.approvedBy.toString(),
          approvedAt: doc.approval.approvedAt,
        }
      : undefined,
    uploadTimestamp: doc.uploadTimestamp,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function stripAiRaw<T extends { rawResponse?: string }>(
  value: T | undefined,
): Omit<T, 'rawResponse'> | undefined {
  if (!value) {
    return undefined;
  }
  const { rawResponse: _raw, ...rest } = value;
  return rest;
}
