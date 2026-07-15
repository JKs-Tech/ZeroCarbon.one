import type { RoleValue } from '../constants';
import type { DocumentProcessingStatusValue } from '../constants';

export interface ApiSuccess<T> {
  success: true;
  message: string;
  data: T;
  meta: {
    requestId: string;
    timestamp: string;
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

export interface ApiErrorBody {
  success: false;
  message: string;
  errors: Array<{ code: string; message: string; field?: string }>;
  meta: { requestId: string; timestamp: string };
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: RoleValue;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResult {
  user: PublicUser;
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
}

export interface DocumentSummary {
  id: string;
  userId: string;
  originalFileName: string;
  storedFileName: string;
  storagePath: string;
  mimeType: string;
  fileSize: number;
  processingStatus: DocumentProcessingStatusValue | string;
  jobId?: string;
  failureReason?: string;
  ocr?: unknown;
  classification?: {
    documentType: string;
    confidence: number;
    reasoningSummary: string;
    provider: string;
    model: string;
  };
  vendor?: {
    name: string;
    confidence: number;
    provider: string;
    model: string;
  };
  extraction?: {
    documentType: string;
    vendor: string;
    fields: Record<string, string | number | null>;
    confidenceScore?: number;
    provider: string;
    model: string;
  };
  validation?: {
    isValid: boolean;
    warningCount: number;
    warnings: ValidationWarning[];
    summary: string;
    validatedAt: string;
    processingTime: number;
  };
  approvedFields?: Record<string, string | number | null>;
  approval?: {
    approved: boolean;
    approvedBy: string;
    approvedAt: string;
  };
  uploadTimestamp: string;
  createdAt: string;
  updatedAt: string;
}

export interface ValidationWarning {
  code: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  message: string;
  field?: string;
}

export interface ReviewPayload {
  document: {
    id: string;
    userId: string;
    originalFileName: string;
    storedFileName: string;
    storagePath: string;
    mimeType: string;
    fileSize: number;
    processingStatus: string;
    uploadTimestamp: string;
    createdAt: string;
    updatedAt: string;
  };
  ocr?: {
    text: string;
    method: string;
    confidence?: number;
    durationMs: number;
    pageCount: number;
    qualityScore?: number;
    fallbackTriggered: boolean;
    completedAt: string;
  };
  extraction?: DocumentSummary['extraction'];
  classification?: DocumentSummary['classification'];
  vendor?: DocumentSummary['vendor'];
  validation?: DocumentSummary['validation'];
  editableFields: Record<string, string | number | null>;
  approvalStatus: 'WAITING_FOR_REVIEW' | 'APPROVED' | 'NOT_READY';
  approval?: DocumentSummary['approval'];
  approvedFields?: Record<string, string | number | null>;
}
